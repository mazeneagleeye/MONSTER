const { get, run, all } = require('./db');

async function ensurePlayer(userId) {
  await run(
    require('./db').playersDb,
    `INSERT INTO players(userId, attackLevel, totalDamage, monstersParticipated, lastAttackAt)
     VALUES(?, 1, 0, 0, NULL)
     ON CONFLICT(userId) DO NOTHING`,
    [userId]
  );
}

async function getPlayer(userId) {
  const row = await get(require('./db').playersDb, `SELECT * FROM players WHERE userId = ?`, [userId]);
  return row ?? { userId, attackLevel: 1, totalDamage: 0, monstersParticipated: 0, lastAttackAt: null };
}

async function addDamage(userId, amount) {
  await run(require('./db').playersDb,
    `UPDATE players SET totalDamage = totalDamage + ? WHERE userId = ?`,
    [amount, userId]
  );
}

async function setLastAttackAt(userId, ts) {
  await run(require('./db').playersDb,
    `UPDATE players SET lastAttackAt = ? WHERE userId = ?`,
    [ts, userId]
  );
}

async function canAttackToday(userId, nowTs) {
  const player = await getPlayer(userId);
  const last = player.lastAttackAt;
  if (!last) return { allowed: true, cooldownMs: 0 };
  const dayMs = 1 * 60 * 60 * 1000;
  const elapsed = nowTs - last;
  if (elapsed >= dayMs) return { allowed: true, cooldownMs: 0 };
  return { allowed: false, cooldownMs: dayMs - elapsed };
}

async function incrementAttackLevelAndParticipated(userId, newParticipated = true) {
  if (newParticipated) {
    await run(require('./db').playersDb,
      `UPDATE players SET attackLevel = attackLevel + 1, monstersParticipated = monstersParticipated + 1 WHERE userId = ?`,
      [userId]
    );
  } else {
    await run(require('./db').playersDb,
      `UPDATE players SET attackLevel = attackLevel + 1 WHERE userId = ?`,
      [userId]
    );
  }
}

async function getLeaderboard(limit = 10) {
  const rows = await all(require('./db').playersDb,
    `SELECT userId, totalDamage FROM players ORDER BY totalDamage DESC LIMIT ?`,
    [limit]
  );
  return rows;
}

module.exports = {
  ensurePlayer,
  getPlayer,
  addDamage,
  setLastAttackAt,
  canAttackToday,
  incrementAttackLevelAndParticipated,
  getLeaderboard
};

