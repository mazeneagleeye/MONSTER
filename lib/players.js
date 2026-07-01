const { get, run, all } = require('./db');

async function ensurePlayer(userId) {
  const now = Date.now();
  await run(
    require('./db').playersDb,
    `INSERT INTO players(userId, level, xp, gold, gems, energy, maxEnergy, attackLevel, totalDamage, monstersParticipated, lastAttackAt, prestige, titles, achievements, inventory, equipped, monsterCollection, activeMonster, guildId, guildRank, lastEnergyUpdate, createdAt)
     VALUES(?, 1, 0, 100, 10, 100, 100, 1, 0, 0, NULL, 0, '[]', '[]', '[]', '{}', '[]', 'null', NULL, 'member', ?, ?)
     ON CONFLICT(userId) DO NOTHING`,
    [userId, now, now]
  );
}

async function getPlayer(userId) {
  const row = await get(require('./db').playersDb, `SELECT * FROM players WHERE userId = ?`, [userId]);
  if (!row) {
    await ensurePlayer(userId);
    return await getPlayer(userId);
  }
  return row;
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

// New progression functions
async function addXP(userId, amount) {
  const player = await getPlayer(userId);
  let { level, xp, prestige } = player;
  
  xp += amount;
  const xpNeeded = level * 100;
  
  while (xp >= xpNeeded && level < 500) {
    xp -= xpNeeded;
    level += 1;
  }
  
  await run(require('./db').playersDb,
    `UPDATE players SET level = ?, xp = ? WHERE userId = ?`,
    [level, xp, userId]
  );
  
  return { level, xp, leveledUp: xp < amount };
}

async function addGold(userId, amount) {
  await run(require('./db').playersDb,
    `UPDATE players SET gold = gold + ? WHERE userId = ?`,
    [amount, userId]
  );
}

async function addGems(userId, amount) {
  await run(require('./db').playersDb,
    `UPDATE players SET gems = gems + ? WHERE userId = ?`,
    [amount, userId]
  );
}

async function spendGold(userId, amount) {
  const player = await getPlayer(userId);
  if (player.gold < amount) return false;
  await run(require('./db').playersDb,
    `UPDATE players SET gold = gold - ? WHERE userId = ?`,
    [amount, userId]
  );
  return true;
}

async function spendGems(userId, amount) {
  const player = await getPlayer(userId);
  if (player.gems < amount) return false;
  await run(require('./db').playersDb,
    `UPDATE players SET gems = gems - ? WHERE userId = ?`,
    [amount, userId]
  );
  return true;
}

async function addEnergy(userId, amount) {
  await run(require('./db').playersDb,
    `UPDATE players SET energy = energy + ? WHERE userId = ?`,
    [amount, userId]
  );
}

async function spendEnergy(userId, amount) {
  const player = await getPlayer(userId);
  if (player.energy < amount) return false;
  await run(require('./db').playersDb,
    `UPDATE players SET energy = energy - ? WHERE userId = ?`,
    [amount, userId]
  );
  return true;
}

async function updateEnergy(userId) {
  const player = await getPlayer(userId);
  const now = Date.now();
  const lastUpdate = player.lastEnergyUpdate || now;
  const maxEnergy = player.maxEnergy || 100;
  
  // Energy regenerates 1 per minute
  const minutesPassed = Math.floor((now - lastUpdate) / 60000);
  if (minutesPassed > 0) {
    const newEnergy = Math.min(maxEnergy, player.energy + minutesPassed);
    await run(require('./db').playersDb,
      `UPDATE players SET energy = ?, lastEnergyUpdate = ? WHERE userId = ?`,
      [newEnergy, now, userId]
    );
    return newEnergy;
  }
  return player.energy;
}

async function addToInventory(userId, item) {
  const player = await getPlayer(userId);
  const inventory = JSON.parse(player.inventory || '[]');
  inventory.push(item);
  await run(require('./db').playersDb,
    `UPDATE players SET inventory = ? WHERE userId = ?`,
    [JSON.stringify(inventory), userId]
  );
}

async function removeFromInventory(userId, itemId) {
  const player = await getPlayer(userId);
  const inventory = JSON.parse(player.inventory || '[]');
  const filtered = inventory.filter(i => i.id !== itemId);
  await run(require('./db').playersDb,
    `UPDATE players SET inventory = ? WHERE userId = ?`,
    [JSON.stringify(filtered), userId]
  );
}

async function equipItem(userId, itemId, slot) {
  const player = await getPlayer(userId);
  const equipped = JSON.parse(player.equipped || '{}');
  equipped[slot] = itemId;
  await run(require('./db').playersDb,
    `UPDATE players SET equipped = ? WHERE userId = ?`,
    [JSON.stringify(equipped), userId]
  );
}

async function addTitle(userId, title) {
  const player = await getPlayer(userId);
  const titles = JSON.parse(player.titles || '[]');
  if (!titles.includes(title)) {
    titles.push(title);
    await run(require('./db').playersDb,
      `UPDATE players SET titles = ? WHERE userId = ?`,
      [JSON.stringify(titles), userId]
    );
  }
}

async function addAchievement(userId, achievement) {
  const player = await getPlayer(userId);
  const achievements = JSON.parse(player.achievements || '[]');
  if (!achievements.includes(achievement)) {
    achievements.push(achievement);
    await run(require('./db').playersDb,
      `UPDATE players SET achievements = ? WHERE userId = ?`,
      [JSON.stringify(achievements), userId]
    );
  }
}

async function prestige(userId) {
  const player = await getPlayer(userId);
  await run(require('./db').playersDb,
    `UPDATE players SET prestige = prestige + 1, level = 1, xp = 0, gold = 0, attackLevel = 1 WHERE userId = ?`,
    [userId]
  );
}

module.exports = {
  ensurePlayer,
  getPlayer,
  addDamage,
  setLastAttackAt,
  canAttackToday,
  incrementAttackLevelAndParticipated,
  getLeaderboard,
  addXP,
  addGold,
  addGems,
  spendGold,
  spendGems,
  addEnergy,
  spendEnergy,
  updateEnergy,
  addToInventory,
  removeFromInventory,
  equipItem,
  addTitle,
  addAchievement,
  prestige
};

