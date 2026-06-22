const { get, run } = require('./db');

const keys = {
  MONSTER_CHANNEL_ID: 'MONSTER_CHANNEL_ID',
  LAST_MONSTER_ID: 'LAST_MONSTER_ID'
};

async function getConfig(db, key, fallback = null) {
  const row = await get(db, `SELECT value FROM monster_config WHERE key = ?`, [key]);
  if (!row) return fallback;
  return row.value;
}

async function setConfig(db, key, value) {
  await run(db, `INSERT INTO monster_config(key,value) VALUES(?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [key, value]);
}

async function ensureDefaults({ monsterDb }) {
  // No env defaults required. Admin should set the channel via /monster-setup.
}


module.exports = { keys, getConfig, setConfig, ensureDefaults };

