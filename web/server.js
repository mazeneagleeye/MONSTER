require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const db = require('../lib/db-adapter');
const { getDashboard } = require('../lib/web-game');
const { exploreRegion } = require('../lib/world');
const { getPlayerMonsters, summonMonsterForUser, interactWithMonster, setActiveMonster } = require('../lib/monsters');
const { getShopItems, buyItem } = require('../lib/shops');
const { getLevelLeaderboard, getGoldLeaderboard, getMonsterCollectionLeaderboard, getLeaderboard } = require('../lib/players');

const webRoot = __dirname;
const imageRoot = path.join(__dirname, '..', 'images');
const sessions = new Map();
const oauthStates = new Map();
const port = Number(process.env.WEB_PORT || 3000);

function send(response, status, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  response.end(body);
}

function sendJson(response, status, body) {
  send(response, status, JSON.stringify(body), 'application/json; charset=utf-8');
}

function getCookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map(cookie => {
    const separator = cookie.indexOf('=');
    return [cookie.slice(0, separator).trim(), decodeURIComponent(cookie.slice(separator + 1).trim())];
  }));
}

function sessionUserId(request) {
  const sessionId = getCookies(request).mk_session;
  if (sessionId) return sessions.get(sessionId)?.userId || null;
  return discordConfigured() ? null : process.env.WEB_USER_ID || null;
}

function createSession(userId) {
  const sessionId = crypto.randomBytes(24).toString('hex');
  sessions.set(sessionId, { userId, createdAt: Date.now() });
  return sessionId;
}

function createOAuthState() {
  const state = crypto.randomBytes(24).toString('hex');
  oauthStates.set(state, Date.now() + 10 * 60 * 1000);
  return state;
}

function consumeOAuthState(state) {
  const expiresAt = oauthStates.get(state);
  oauthStates.delete(state);
  return Boolean(expiresAt && expiresAt > Date.now());
}

function discordConfigured() {
  return process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.DISCORD_REDIRECT_URI;
}

function validateDiscordRedirectUri() {
  if (!process.env.DISCORD_REDIRECT_URI) return;
  let redirectUri;
  try {
    redirectUri = new URL(process.env.DISCORD_REDIRECT_URI);
  } catch {
    throw new Error('DISCORD_REDIRECT_URI must be a complete URL, for example http://localhost:3000/auth/callback.');
  }
  if (!['http:', 'https:'].includes(redirectUri.protocol) || redirectUri.username || redirectUri.password || redirectUri.search || redirectUri.hash) {
    throw new Error('DISCORD_REDIRECT_URI must use http or https and contain no credentials, query string, or fragment.');
  }
  if (redirectUri.pathname !== '/auth/callback') {
    throw new Error('DISCORD_REDIRECT_URI must end with /auth/callback.');
  }
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

async function authenticatedUser(request, response) {
  const userId = sessionUserId(request);
  if (!userId) {
    sendJson(response, 401, { error: 'Login with Discord to enter Monster Kingdom.' });
    return null;
  }
  return userId;
}

async function ownedMonster(userId, monsterId) {
  const monsters = await getPlayerMonsters(userId);
  return monsters.find(monster => monster.id === monsterId) || null;
}

async function exchangeDiscordCode(code) {
  const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI
    })
  });
  if (!tokenResponse.ok) throw new Error(`Discord token exchange failed (${tokenResponse.status})`);
  const token = await tokenResponse.json();
  const userResponse = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `${token.token_type} ${token.access_token}` }
  });
  if (!userResponse.ok) throw new Error(`Discord user lookup failed (${userResponse.status})`);
  return userResponse.json();
}

function serveStatic(response, pathname) {
  let requested;
  try {
    requested = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  } catch {
    return send(response, 400, 'Invalid path');
  }
  const root = requested.startsWith('images/') ? imageRoot : webRoot;
  const relativePath = requested.startsWith('images/') ? requested.slice('images/'.length) : requested;
  const filePath = path.resolve(root, relativePath);
  if (!filePath.startsWith(path.resolve(root) + path.sep)) return send(response, 403, 'Forbidden');

  const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return send(response, 404, 'Not found');
  send(response, 200, fs.readFileSync(filePath), contentTypes[path.extname(filePath)] || 'application/octet-stream');
}

async function handle(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (url.pathname === '/auth/login') {
    if (!discordConfigured()) return send(response, 503, 'Discord OAuth is not configured. Set DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, and DISCORD_REDIRECT_URI.');
    const state = createOAuthState();
    const params = new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, redirect_uri: process.env.DISCORD_REDIRECT_URI, response_type: 'code', scope: 'identify', state });
    response.writeHead(302, { Location: `https://discord.com/oauth2/authorize?${params}` });
    return response.end();
  }

  if (url.pathname === '/auth/callback') {
    if (url.searchParams.get('error')) {
      return send(response, 400, `Discord login was not completed: ${url.searchParams.get('error_description') || url.searchParams.get('error')}.`);
    }
    if (!consumeOAuthState(url.searchParams.get('state'))) {
      return send(response, 400, 'Discord login expired or was opened in another browser tab. Start login again.');
    }
    if (!url.searchParams.get('code')) return send(response, 400, 'Discord did not return an authorization code. Start login again.');
    try {
      const discordUser = await exchangeDiscordCode(url.searchParams.get('code'));
      const sessionId = createSession(discordUser.id);
      const secureCookie = process.env.DISCORD_REDIRECT_URI.startsWith('https:') ? '; Secure' : '';
      response.writeHead(302, { 'Set-Cookie': `mk_session=${sessionId}; HttpOnly; SameSite=Lax; Path=/${secureCookie}`, Location: '/' });
      return response.end();
    } catch (error) {
      return send(response, 502, `Discord login failed: ${error.message}`);
    }
  }

  if (url.pathname === '/auth/logout') {
    const sessionId = getCookies(request).mk_session;
    if (sessionId) sessions.delete(sessionId);
    response.writeHead(302, { 'Set-Cookie': 'mk_session=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/', Location: '/' });
    return response.end();
  }

  if (url.pathname === '/api/dashboard') {
    const userId = await authenticatedUser(request, response);
    if (!userId) return;
    try {
      return sendJson(response, 200, await getDashboard(userId));
    } catch (error) {
      console.error('Dashboard request failed:', error);
      return sendJson(response, 500, { error: 'The kingdom could not be loaded.' });
    }
  }

  if (url.pathname === '/api/shop' && request.method === 'GET') {
    const userId = await authenticatedUser(request, response);
    if (!userId) return;
    return sendJson(response, 200, { items: getShopItems() });
  }

  if (url.pathname === '/api/leaderboards' && request.method === 'GET') {
    const userId = await authenticatedUser(request, response);
    if (!userId) return;
    return sendJson(response, 200, {
      level: await getLevelLeaderboard(),
      gold: await getGoldLeaderboard(),
      collection: await getMonsterCollectionLeaderboard(),
      damage: await getLeaderboard()
    });
  }

  if (request.method === 'POST' && url.pathname === '/api/explore') {
    const userId = await authenticatedUser(request, response);
    if (!userId) return;
    const result = await exploreRegion(userId, (await readJson(request)).regionId);
    return sendJson(response, result.success ? 200 : 400, result);
  }

  if (request.method === 'POST' && url.pathname === '/api/monsters/summon') {
    const userId = await authenticatedUser(request, response);
    if (!userId) return;
    const body = await readJson(request);
    const result = await summonMonsterForUser(userId, body.type || 'gold');
    return sendJson(response, result.success ? 200 : 400, result);
  }

  const monsterAction = url.pathname.match(/^\/api\/monsters\/([^/]+)\/(interact|active)$/);
  if (request.method === 'POST' && monsterAction) {
    const userId = await authenticatedUser(request, response);
    if (!userId) return;
    const monsterId = decodeURIComponent(monsterAction[1]);
    if (!await ownedMonster(userId, monsterId)) return sendJson(response, 403, { error: 'That monster does not belong to this account.' });
    const body = await readJson(request);
    const result = monsterAction[2] === 'interact'
      ? await interactWithMonster(monsterId, body.action)
      : await setActiveMonster(userId, monsterId);
    return sendJson(response, result ? 200 : 400, result || { error: 'Monster action failed.' });
  }

  if (request.method === 'POST' && url.pathname === '/api/shop/buy') {
    const userId = await authenticatedUser(request, response);
    if (!userId) return;
    const body = await readJson(request);
    const quantity = Math.max(1, Math.min(20, Number(body.quantity) || 1));
    const result = await buyItem(userId, body.itemId, quantity);
    return sendJson(response, result.success ? 200 : 400, result);
  }

  serveStatic(response, url.pathname);
}

async function start() {
  validateDiscordRedirectUri();
  await db.init();
  const server = http.createServer((request, response) => handle(request, response).catch(error => {
    console.error('Web request failed:', error);
    send(response, 500, 'Internal server error');
  }));
  server.listen(port, () => console.log(`Monster Kingdom web game listening at http://localhost:${port}`));
  return server;
}

if (require.main === module) start().catch(error => {
  console.error('Could not start web game:', error);
  process.exitCode = 1;
});

module.exports = { start, handle, sessions, validateDiscordRedirectUri };
