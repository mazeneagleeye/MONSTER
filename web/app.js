const $ = selector => document.querySelector(selector);
const number = value => Number(value || 0).toLocaleString();
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('#theme-toggle').textContent = theme === 'dark' ? '☀' : '☾';
  $('#theme-toggle').setAttribute('aria-label', theme === 'dark' ? 'Use light mode' : 'Use dark mode');
}

function setText(selector, value) {
  $(selector).textContent = value;
}

function renderMonster(monster) {
  if (!monster) return '<div class="empty-state">Summon your first companion in Discord to begin your collection.</div>';
  const needs = monster.needs;
  return `<div class="feature-art"><img src="${monster.image}" alt="${escapeHtml(monster.name)}" onerror="this.style.display='none'"><span class="element-badge">${escapeHtml(monster.element)}</span></div><div class="feature-copy"><div class="monster-title"><div><h3>${escapeHtml(monster.name)}</h3><p>${escapeHtml(monster.rarity)} · ${escapeHtml(monster.type)}</p></div><strong>LV ${monster.level}</strong></div><div class="stat-line"><span>HP</span><div class="mini-track"><i style="width: ${Math.min(100, monster.stats.hp / 10)}%"></i></div><b>${number(monster.stats.hp)}</b></div><div class="needs"><span>Hunger <b>${needs.hunger}%</b></span><span>Loyalty <b>${needs.loyalty}%</b></span><span>Happiness <b>${needs.happiness}%</b></span></div></div>`;
}

function renderCollection(monsters) {
  if (!monsters.length) return '<div class="empty-state">No monsters yet. Use /summon in Discord to call a companion.</div>';
  return monsters.map(monster => `<article class="monster-card ${monster.isActive ? 'is-active' : ''}"><div class="card-art"><img src="${monster.image}" alt="${escapeHtml(monster.name)}" onerror="this.style.display='none'"><span>${escapeHtml(monster.element)}</span></div><div class="card-info"><div><h3>${escapeHtml(monster.name)}</h3><p>${escapeHtml(monster.rarity)}</p></div><strong>LV ${monster.level}</strong></div><div class="card-footer"><span>${number(monster.xp)} / ${number(monster.xpToNextLevel)} XP</span>${monster.isActive ? '<b>Active</b>' : ''}</div></article>`).join('');
}

function renderRegions(regions) {
  return regions.map(region => `<article class="region-card"><div class="region-icon">${region.name.slice(0, 2)}</div><div><h3>${escapeHtml(region.name.slice(2).trim())}</h3><p>${escapeHtml(region.description)}</p></div><div class="region-meta"><span>${escapeHtml(region.weather)}</span><small>Levels ${region.minLevel}-${region.maxLevel}</small></div><button class="quiet-button explore-button" data-region="${escapeHtml(region.id)}">Explore · 5 energy</button></article>`).join('');
}

function renderActions(monster) {
  if (!monster) return '<button class="action-button" data-action="summon">Summon beginner monster</button>';
  return `<button class="action-button" data-action="interact" data-monster="${monster.id}" data-value="feed">Feed</button><button class="action-button" data-action="interact" data-monster="${monster.id}" data-value="play">Play</button><button class="action-button" data-action="interact" data-monster="${monster.id}" data-value="pet">Pet</button>`;
}

async function postJson(url, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || result.error || 'Action failed');
  return result;
}

function notify(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

async function loadDashboard() {
  setText('#connection', 'Syncing kingdom');
  const response = await fetch('/api/dashboard');
  if (response.status === 401) {
    $('#signed-out').classList.remove('hidden');
    $('#app').classList.add('hidden');
    $('#login').classList.remove('hidden');
    setText('#connection', 'Not connected');
    return;
  }
  if (!response.ok) throw new Error('Dashboard unavailable');
  const data = await response.json();
  const player = data.player;
  setText('#player-name', player.username);
  setText('#profile-name', player.username);
  setText('#player-handle', player.handle || 'Discord adventurer');
  $('#profile-avatar').src = player.avatarUrl || '/images/monster%20kingdom.jpeg';
  $('#profile-avatar').alt = `${player.username} Discord profile`;
  setText('#player-class', player.className);
  setText('#player-region', player.region);
  setText('#player-level', player.level);
  setText('#progress-level', player.level);
  setText('#profile-class', player.className);
  setText('#profile-job', player.job);
  setText('#profile-guild', player.guildId || 'Independent');
  setText('#profile-damage', number(player.totalDamage));
  setText('#energy', number(player.energy));
  setText('#max-energy', number(player.maxEnergy));
  setText('#gold', number(player.gold));
  setText('#gems', number(player.gems));
  setText('#xp', number(player.xp));
  setText('#xp-next', number(player.xpToNextLevel));
  const progress = Math.min(100, Math.round((player.xp / player.xpToNextLevel) * 100));
  setText('#progress-percent', `${progress}%`);
  $('#progress-bar').style.width = `${progress}%`;
  $('#active-monster').innerHTML = renderMonster(data.activeMonster);
  $('#monster-actions').innerHTML = renderActions(data.activeMonster);
  $('#collection').innerHTML = renderCollection(data.monsters);
  setText('#monster-count', data.monsters.length);
  setText('#time-of-day', data.world.timeOfDay);
  $('#regions').innerHTML = renderRegions(data.world.availableRegions);
  $('#signed-out').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#login').classList.add('hidden');
  setText('#connection', 'Live from Discord');
}

function login() { window.location.href = '/auth/login'; }
$('#login').addEventListener('click', login);
$('#login-main').addEventListener('click', login);
$('#refresh').addEventListener('click', () => loadDashboard().catch(showError));
$('#summon').addEventListener('click', async () => { try { const result = await postJson('/api/monsters/summon', { type: 'beginner' }); notify(result.profile ? `Summoned ${result.profile.name}!` : result.message); await loadDashboard(); } catch (error) { notify(error.message); } });
$('#collection').addEventListener('click', async event => { const card = event.target.closest('.monster-card'); if (!card) return; const monster = card.querySelector('h3')?.textContent; if (monster) notify(`${monster} is part of your shared Discord collection.`); });
$('#regions').addEventListener('click', async event => { const button = event.target.closest('.explore-button'); if (!button) return; try { const result = await postJson('/api/explore', { regionId: button.dataset.region }); notify(result.success ? `Explored ${result.region}: +${result.xpGained} XP, +${result.goldGained} gold.` : result.message); await loadDashboard(); } catch (error) { notify(error.message); } });
$('#monster-actions').addEventListener('click', async event => { const button = event.target.closest('[data-action]'); if (!button) return; try { const result = button.dataset.action === 'summon' ? await postJson('/api/monsters/summon', { type: 'beginner' }) : await postJson(`/api/monsters/${encodeURIComponent(button.dataset.monster)}/interact`, { action: button.dataset.value }); notify(result.message || 'Action complete.'); await loadDashboard(); } catch (error) { notify(error.message); } });
let leaderboardData = null;
const leaderboardLabels = { damage: ['Damage', 'totalDamage'], level: ['Level', 'level'], gold: ['Gold', 'gold'], collection: ['Collection', 'collected'] };
function renderLeaderboard(board = 'damage') {
  const [label, field] = leaderboardLabels[board];
  const rows = leaderboardData?.[board] || [];
  $('#leaderboard-value-heading').textContent = label;
  $('#leaderboard-count').textContent = `${rows.length} player${rows.length === 1 ? '' : 's'}`;
  $('#leaderboard-rows').innerHTML = rows.length ? rows.map((player, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(player.displayName || (player.username ? `@${player.username}` : 'Adventurer'))}</td><td>${number(player[field])}</td></tr>`).join('') : '<tr><td colspan="3">No players yet.</td></tr>';
  document.querySelectorAll('#leaderboard-tabs button').forEach(button => { const selected = button.dataset.board === board; button.classList.toggle('active', selected); button.setAttribute('aria-selected', String(selected)); });
}
$('#leaderboards').addEventListener('click', async () => { try { const response = await fetch('/api/leaderboards'); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Leaderboard unavailable'); leaderboardData = data; $('#leaderboard-panel').classList.remove('hidden'); renderLeaderboard(); $('#leaderboard-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (error) { notify(error.message); } });
$('#leaderboard-tabs').addEventListener('click', event => { const button = event.target.closest('[data-board]'); if (button) renderLeaderboard(button.dataset.board); });
$('#shop').addEventListener('click', async () => { try { const data = await (await fetch('/api/shop')).json(); notify(`${data.items.length} shop items are available through the shared economy.`); } catch (error) { notify(error.message); } });
function showError(error) { setText('#connection', 'Sync failed'); if (error) notify(error.message || 'The kingdom could not be loaded.'); }
const savedTheme = localStorage.getItem('monster-kingdom-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
applyTheme(savedTheme);
$('#theme-toggle').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('monster-kingdom-theme', theme);
  applyTheme(theme);
});
loadDashboard().catch(showError);
