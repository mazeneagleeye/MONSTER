const { get, run } = require('./db-adapter');

const keys = {
  MONSTER_CHANNEL_ID: 'MONSTER_CHANNEL_ID',
  LAST_MONSTER_ID: 'LAST_MONSTER_ID'
};

async function getConfig(db, key, fallback = null) {
  const row = await get(db, { key: key });
  if (!row) return fallback;
  return row.value;
}

async function setConfig(db, key, value) {
  await run(db,
    { key: key, value: value },
    { $set: { key: key, value: value } }
  );
}

async function ensureDefaults({ monsterDb }) {
  // No env defaults required. Admin should set the channel via /monster-setup.
}


module.exports = { keys, getConfig, setConfig, ensureDefaults };