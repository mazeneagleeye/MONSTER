const { init: initMongoDB, getCollection, run: mongoRun, get: mongoGet, all: mongoAll, isConnected } = require('./mongodb');
const sqlite = require('./db');
const { init: initSqlite, run: sqliteRun, get: sqliteGet, all: sqliteAll } = sqlite;

// Determine which database to use
const USE_MONGODB = process.env.USE_MONGODB === 'true' || !!process.env.MONGODB_URI || !!process.env.MONGO_URI;

let currentDb = 'sqlite'; // 'sqlite' or 'mongodb'

// Initialize the appropriate database
async function init() {
  if (USE_MONGODB) {
    try {
      await initMongoDB();
      currentDb = 'mongodb';
      console.log('Using MongoDB for data storage');
      return;
    } catch (err) {
      console.error('Failed to initialize MongoDB, falling back to SQLite:', err.message);
    }
  }
  
  // Fallback to SQLite
  await initSqlite();
  currentDb = 'sqlite';
  console.log('Using SQLite for data storage');
}

// Get current database type
function getDbType() {
  return currentDb;
}

// Check if using MongoDB
function isUsingMongoDB() {
  return currentDb === 'mongodb';
}

// Universal run function
async function run(collectionOrDb, sql, params = [], options = {}) {
  if (currentDb === 'mongodb') {
    const collectionName = collectionOrDb;

    // Several helpers use the native Mongo shape: run(collection, filter, update).
    if (typeof sql === 'object' && sql !== null) {
      return await mongoRun(collectionName, 'update', sql, params, options);
    }

    const sqlUpper = sql.trim().toUpperCase();
    if (sqlUpper.startsWith('INSERT')) {
      const { columns, values } = parseInsert(sql, params);
      const document = Object.fromEntries(columns.map((column, index) => [column, values[index]]));
      if (sqlUpper.includes('ON CONFLICT')) {
        const key = columns[0];
        return await mongoRun(collectionName, 'update', { [key]: document[key] }, { $setOnInsert: document }, { upsert: true });
      }
      return await mongoRun(collectionName, 'insert', document);
    }

    if (sqlUpper.startsWith('UPDATE')) {
      const { filter, update } = parseUpdate(sql, params);
      return await mongoRun(collectionName, 'update', filter, update);
    }

    if (sqlUpper.startsWith('DELETE')) {
      return await mongoRun(collectionName, 'delete', parseWhere(sql, params));
    }

    throw new Error(`Unsupported SQL operation for MongoDB: ${sql}`);
  } else {
    if (typeof sql === 'object' && sql !== null) {
      return await sqliteObjectRun(collectionOrDb, sql, params);
    }
    // Use SQLite
    return await sqliteRun(collectionOrDb, sql, params);
  }
}

// Universal get function
async function get(collectionOrDb, sql, params = []) {
  if (currentDb === 'mongodb') {
    const collectionName = collectionOrDb;
    if (typeof sql === 'object' && sql !== null) return await mongoGet(collectionName, sql);
    return await mongoGet(collectionName, parseWhere(sql, params));
  } else {
    if (typeof sql === 'object' && sql !== null) {
      const query = objectQuery(collectionOrDb, sql);
      return await sqliteGet(collectionOrDb, query.sql, query.params);
    }
    return await sqliteGet(collectionOrDb, sql, params);
  }
}

// Universal all function
async function all(collectionOrDb, sql, params = []) {
  if (currentDb === 'mongodb') {
    const collectionName = collectionOrDb;
    if (typeof sql === 'object' && sql !== null) {
      const options = params || {};
      const rows = await mongoAll(collectionName, sql);
      if (options.sort) rows.sort((left, right) => compareSort(left, right, options.sort));
      return options.limit ? rows.slice(0, options.limit) : rows;
    }
    return await mongoAll(collectionName, parseWhere(sql, params));
  } else {
    if (typeof sql === 'object' && sql !== null) {
      const query = objectQuery(collectionOrDb, sql);
      return await sqliteAll(collectionOrDb, query.sql, query.params);
    }
    return await sqliteAll(collectionOrDb, sql, params);
  }
}

function objectQuery(db, filter) {
  const entries = Object.entries(filter);
  const table = db === sqlite.playersDb
    ? 'players'
    : db === sqlite.monsterDb
      ? 'monsters'
      : 'player_monsters';
  if (entries.length === 0) return { sql: `SELECT * FROM ${table}`, params: [] };

  const conditions = entries.map(([field, value]) => `${field} IS ?`);
  return {
    sql: `SELECT * FROM ${table} WHERE ${conditions.join(' AND ')}`,
    params: entries.map(([, value]) => value)
  };
}

async function sqliteObjectRun(db, document, options = {}) {
  const table = tableForDocument(db, document);
  if (document.$delete) {
    const filter = Object.fromEntries(Object.entries(document).filter(([key]) => key !== '$delete'));
    const query = objectWhere(filter);
    return await sqliteRun(db, `DELETE FROM ${table} WHERE ${query.sql}`, query.params);
  }
  if (document.$set || document.$inc) {
    const filter = Object.fromEntries(Object.entries(document).filter(([key]) => !key.startsWith('$')));
    const assignments = [];
    const params = [];
    for (const [field, value] of Object.entries(document.$set || {})) {
      assignments.push(`${field} = ?`);
      params.push(value);
    }
    for (const [field, value] of Object.entries(document.$inc || {})) {
      assignments.push(`${field} = ${field} + ?`);
      params.push(value);
    }
    const query = objectWhere(filter);
    return await sqliteRun(db, `UPDATE ${table} SET ${assignments.join(', ')} WHERE ${query.sql}`, [...params, ...query.params]);
  }
  const fields = Object.keys(document);
  const placeholders = fields.map(() => '?').join(', ');
  return await sqliteRun(db, `INSERT OR IGNORE INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})`, fields.map(field => document[field]));
}

function objectWhere(filter) {
  const entries = Object.entries(filter);
  if (entries.length === 0) return { sql: '1 = 1', params: [] };
  return { sql: entries.map(([field]) => `${field} IS ?`).join(' AND '), params: entries.map(([, value]) => value) };
}

function tableForDocument(db, document) {
  if (db === sqlite.monsterDb) return 'monsters';
  if (document.monsterId || document.evolutionStage || document.personality) return 'player_monsters';
  if (document.guildId && (document.name || document.level !== undefined)) return 'guilds';
  if (document.guildId && document.userId) return 'guild_members';
  return 'players';
}

// Save databases (SQLite only)
async function saveDatabases() {
  if (currentDb === 'sqlite') {
    return await sqlite.saveDatabases();
  }
  // MongoDB doesn't need explicit saves
  return;
}

// Get monster database reference
function getMonsterDb() {
  if (currentDb === 'mongodb') {
    return 'monsters'; // Collection name for MongoDB
  }
  return sqlite.monsterDb;
}

// Get players database reference
function getPlayersDb() {
  if (currentDb === 'mongodb') {
    return 'players'; // Collection name for MongoDB
  }
  return sqlite.playersDb;
}

function parseInsert(sql, params) {
  const match = sql.match(/INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+([\w]+)/i);
  const columnsMatch = sql.match(/\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
  if (!match || !columnsMatch) throw new Error(`Unsupported INSERT for MongoDB: ${sql}`);
  const columns = columnsMatch[1].split(',').map(column => column.trim());
  const values = splitSqlList(columnsMatch[2]).map((value, index) => parseSqlValue(value, params, index));
  return { collectionName: match[1], columns, values };
}

function parseUpdate(sql, params) {
  const match = sql.match(/UPDATE\s+\w+\s+SET\s+(.+?)\s+WHERE\s+(.+?)(?:\s*;)?$/is);
  if (!match) throw new Error(`Unsupported UPDATE for MongoDB: ${sql}`);
  const assignments = splitSqlList(match[1]);
  const update = { $set: {} };
  let valueIndex = 0;
  for (const assignment of assignments) {
    const [field, rawValue] = assignment.split(/\s*=\s*/);
    if (!field || rawValue === undefined || /CASE\s/i.test(rawValue)) throw new Error(`Unsupported UPDATE expression: ${assignment}`);
    update.$set[field.trim()] = parseSqlValue(rawValue, params, valueIndex++);
  }
  return { filter: parseWhere(match[2], params, valueIndex), update };
}

function parseWhere(sql, params, startIndex = 0) {
  const where = (sql.match(/\bWHERE\b(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|\s*;|$)/is) || [])[1];
  if (!where) return {};
  let valueIndex = startIndex;
  return Object.fromEntries(where.split(/\s+AND\s+/i).map(condition => {
    const match = condition.trim().match(/^([\w]+)\s*=\s*(\?|NULL|[-\d.]+|'[^']*')$/i);
    if (!match) throw new Error(`Unsupported WHERE condition: ${condition}`);
    return [match[1], parseSqlValue(match[2], params, valueIndex++)];
  }));
}

function parseSqlValue(value, params, index) {
  const trimmed = value.trim();
  if (trimmed === '?') return params[index];
  if (/^NULL$/i.test(trimmed)) return null;
  if (/^'.*'$/.test(trimmed)) return trimmed.slice(1, -1).replace(/''/g, "'");
  if (!Number.isNaN(Number(trimmed))) return Number(trimmed);
  return trimmed;
}

function splitSqlList(value) {
  return value.match(/(?:[^,'"]|"[^"]*"|'(?:''|[^'])*')+/g).map(item => item.trim());
}

function compareSort(left, right, sort) {
  for (const [field, direction] of Object.entries(sort)) {
    if (left[field] === right[field]) continue;
    return (left[field] > right[field] ? 1 : -1) * (direction < 0 ? -1 : 1);
  }
  return 0;
}

// Close connections
async function close() {
  if (currentDb === 'mongodb') {
    const { close: closeMongo } = require('./mongodb');
    return await closeMongo();
  }
  // SQLite doesn't need explicit close
  return;
}

module.exports = {
  init,
  getDbType,
  isUsingMongoDB,
  run,
  get,
  all,
  saveDatabases,
  getMonsterDb,
  getPlayersDb,
  close
};