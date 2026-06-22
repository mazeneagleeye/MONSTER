const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'monster.db');
const playerDbPath = path.join(__dirname, '..', 'players.db');

const monsterDb = new sqlite3.Database(dbPath);
const playersDb = new sqlite3.Database(playerDbPath);

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function init() {
  await run(playersDb, `
    CREATE TABLE IF NOT EXISTS players (
      userId TEXT PRIMARY KEY,
      attackLevel INTEGER NOT NULL DEFAULT 1,
      totalDamage INTEGER NOT NULL DEFAULT 0,
      monstersParticipated INTEGER NOT NULL DEFAULT 0,
      lastAttackAt INTEGER
    );
  `);

  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS monster_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Record per-monster per-user attacks so we can award participation.
  // We'll use: monsterId + userId as PK.
  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS monster_attacks (
      monsterId TEXT NOT NULL,
      userId TEXT NOT NULL,
      damage INTEGER NOT NULL,
      attackAt INTEGER NOT NULL,
      PRIMARY KEY (monsterId, userId)
    );
  `);

  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS monster_config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS monster_history (
      seq INTEGER PRIMARY KEY,
      monsterId TEXT NOT NULL,
      title TEXT NOT NULL,
      maxHp INTEGER NOT NULL,
      bonusHp INTEGER NOT NULL,
      rareType TEXT,
      killedAt INTEGER NOT NULL
    );
  `);
}


module.exports = {
  monsterDb,
  playersDb,
  init,
  run,
  get,
  all
};

