const { get, run, all } = require('./db-adapter');

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}

async function ensurePlayer(userId, profile = {}) {
  const username = profile.username || '';
  const displayName = profile.displayName || '';
  const avatarUrl = profile.avatarUrl || '';
  const accountCreatedAt = profile.accountCreatedAt || 0;
  const lastLogin = profile.lastLogin || 0;
  const createdAt = profile.createdAt || lastLogin;

  await run(
    require('./db-adapter').getPlayersDb(),
    `INSERT INTO players(userId, username, displayName, avatarUrl, accountCreatedAt, lastLogin, level, xp, gold, gems, energy, maxEnergy, hp, maxHp, attackLevel, totalDamage, monstersParticipated, lastAttackAt, prestige, titles, achievements, inventory, equipped, monsterCollection, activeMonster, currentRegion, currentParty, currentClass, currentJob, statistics, settings, guildId, guildRank, lastEnergyUpdate, createdAt, started, resources, workLevels, knowledgeBooks, dailyStreak, lastDailyClaim)
     VALUES(?, ?, ?, ?, ?, ?, 1, 0, 0, 0, 100, 100, 100, 100, 1, 0, 0, NULL, 0, '[]', '[]', '[]', '{}', '[]', 'null', 'Starter Village', 'None', 'None', 'None', '{}', '{}', NULL, 'member', 0, ?, ?, '{}', '{}', 0, 0, 0)
     ON CONFLICT(userId) DO NOTHING`,
    [userId, username, displayName, avatarUrl, accountCreatedAt, lastLogin, createdAt, createdAt]
  );
}

async function updatePlayerProfile(userId, profile = {}) {
  const fields = [];
  const values = [];

  if (profile.username !== undefined) {
    fields.push('username = ?');
    values.push(profile.username);
  }
  if (profile.displayName !== undefined) {
    fields.push('displayName = ?');
    values.push(profile.displayName);
  }
  if (profile.avatarUrl !== undefined) {
    fields.push('avatarUrl = ?');
    values.push(profile.avatarUrl);
  }
  if (profile.lastLogin !== undefined) {
    fields.push('lastLogin = ?');
    values.push(profile.lastLogin);
  }
  if (profile.currentRegion !== undefined) {
    fields.push('currentRegion = ?');
    values.push(profile.currentRegion);
  }
  if (profile.currentParty !== undefined) {
    fields.push('currentParty = ?');
    values.push(profile.currentParty);
  }
  if (profile.currentClass !== undefined) {
    fields.push('currentClass = ?');
    values.push(profile.currentClass);
  }
  if (profile.currentJob !== undefined) {
    fields.push('currentJob = ?');
    values.push(profile.currentJob);
  }

  if (fields.length === 0) return;

  values.push(userId);
  await run(require('./db-adapter').getPlayersDb(),
    `UPDATE players SET ${fields.join(', ')} WHERE userId = ?`,
    values
  );
}

async function setLastLogin(userId) {
  const now = Date.now();
  await run(require('./db').playersDb,
    `UPDATE players SET lastLogin = ? WHERE userId = ?`,
    [now, userId]
  );
  return now;
}

async function markPlayerStarted(userId) {
  const now = Date.now();
  await run(require('./db').playersDb,
    `UPDATE players SET started = 1, createdAt = CASE WHEN createdAt = 0 THEN ? ELSE createdAt END, lastLogin = ? WHERE userId = ?`,
    [now, now, userId]
  );
}

async function getPlayer(userId) {
  const row = await get(require('./db-adapter').getPlayersDb(), { userId: userId });
  if (!row) {
    await ensurePlayer(userId);
    return await getPlayer(userId);
  }
  return row;
}

async function getPlayerResources(userId) {
  const player = await getPlayer(userId);
  return parseJson(player.resources, {});
}

async function addPlayerResource(userId, resource, amount) {
  const player = await getPlayer(userId);
  const resources = parseJson(player.resources, {});
  resources[resource] = (resources[resource] || 0) + amount;
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $set: { resources: JSON.stringify(resources) } }
  );
  return resources;
}

async function addKnowledgeBook(userId, amount = 1) {
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $inc: { knowledgeBooks: amount } }
  );
}

async function getPlayerWorkLevels(userId) {
  const player = await getPlayer(userId);
  return parseJson(player.workLevels, {});
}

async function addDamage(userId, amount) {
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $inc: { totalDamage: amount } }
  );
}

async function setLastAttackAt(userId, ts) {
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $set: { lastAttackAt: ts } }
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
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $inc: { attackLevel: 1, monstersParticipated: 1 } }
  );
  } else {
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $inc: { attackLevel: 1 } }
  );
  }
}

async function getLeaderboard(limit = null) {
  const rows = await all(require('./db-adapter').getPlayersDb(), {});
  rows.sort((left, right) => Number(right.totalDamage || 0) - Number(left.totalDamage || 0));
  return limit ? rows.slice(0, limit) : rows;
}

async function getLevelLeaderboard(limit = null) {
  const rows = await all(require('./db-adapter').getPlayersDb(), {});
  rows.sort((left, right) => Number(right.level || 0) - Number(left.level || 0) || Number(right.prestige || 0) - Number(left.prestige || 0));
  return limit ? rows.slice(0, limit) : rows;
}

async function getGoldLeaderboard(limit = null) {
  const rows = await all(require('./db-adapter').getPlayersDb(), {});
  rows.sort((left, right) => Number(right.gold || 0) - Number(left.gold || 0));
  return limit ? rows.slice(0, limit) : rows;
}

// New progression functions
async function addXP(userId, amount) {
  const player = await getPlayer(userId);
  let { level, xp } = player;
  
  xp += amount;
  let leveledUp = false;
  
  while (xp >= level * 100 && level < 500) {
    xp -= level * 100;
    level += 1;
    leveledUp = true;
  }
  
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $set: { level, xp } }
  );
  
  return { level, xp, leveledUp };
}

async function addGold(userId, amount) {
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $inc: { gold: amount } }
  );
}

async function addGems(userId, amount) {
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $inc: { gems: amount } }
  );
}

async function spendGold(userId, amount) {
  const player = await getPlayer(userId);
  if (player.gold < amount) return false;
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $inc: { gold: -amount } }
  );
  return true;
}

async function spendGems(userId, amount) {
  const player = await getPlayer(userId);
  if (player.gems < amount) return false;
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $inc: { gems: -amount } }
  );
  return true;
}

async function addEnergy(userId, amount) {
  const player = await getPlayer(userId);
  const newEnergy = Math.min(player.maxEnergy, player.energy + amount);
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $set: { energy: newEnergy } }
  );
  return newEnergy;
}

async function spendEnergy(userId, amount) {
  const player = await getPlayer(userId);
  if (player.energy < amount) return false;
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $inc: { energy: -amount } }
  );
  return true;
}

async function updateEnergy(userId) {
  const player = await getPlayer(userId);
  const now = Date.now();
  const lastUpdate = player.lastEnergyUpdate || player.accountCreatedAt || now;
  const maxEnergy = player.maxEnergy || 100;
  
  // Energy regenerates 1 every 5 minutes
  const minutesPassed = Math.floor((now - lastUpdate) / 300000);
  if (minutesPassed > 0) {
    const newEnergy = Math.min(maxEnergy, player.energy + minutesPassed);
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $set: { energy: newEnergy, lastEnergyUpdate: now } }
  );
    return newEnergy;
  }
  return player.energy;
}

async function getPlayerSettings(userId) {
  const player = await getPlayer(userId);
  return parseJson(player.settings, {});
}

async function updatePlayerSettings(userId, updates) {
  const player = await getPlayer(userId);
  const settings = parseJson(player.settings, {});
  const merged = { ...settings, ...updates };
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $set: { settings: JSON.stringify(merged) } }
  );
  return merged;
}

async function getStatistics(userId) {
  const player = await getPlayer(userId);
  return parseJson(player.statistics, {});
}

async function incrementStatistic(userId, statKey, amount = 1) {
  const player = await getPlayer(userId);
  const statistics = parseJson(player.statistics, {});
  statistics[statKey] = (Number(statistics[statKey]) || 0) + amount;
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $set: { statistics: JSON.stringify(statistics) } }
  );
  return statistics;
}

async function claimDailyReward(userId) {
  const player = await getPlayer(userId);
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const lastClaim = player.lastDailyClaim || 0;
  const gap = now - lastClaim;

  if (lastClaim && gap < oneDay) {
    return { success: false, message: 'You have already claimed your daily reward today. Come back tomorrow!' };
  }

  let streak = 1;
  if (lastClaim && gap <= oneDay * 2) {
    streak = (player.dailyStreak || 0) + 1;
  }

  const roundedStreak = Math.min(streak, 30);
  const reward = { gold: 0, gems: 0, item: null, message: '' };

  if (roundedStreak === 1) {
    reward.gold = 100;
    reward.message = 'Day 1 reward: 100 Gold';
  } else if (roundedStreak === 2) {
    reward.gems = 5;
    reward.message = 'Day 2 reward: 5 Gems';
  } else if (roundedStreak === 3) {
    reward.gold = 150;
    reward.message = 'Day 3 reward: 150 Gold';
  } else if (roundedStreak === 4) {
    reward.gems = 10;
    reward.message = 'Day 4 reward: 10 Gems';
  } else if (roundedStreak === 5) {
    reward.gold = 200;
    reward.message = 'Day 5 reward: 200 Gold';
  } else if (roundedStreak === 6) {
    reward.gems = 15;
    reward.message = 'Day 6 reward: 15 Gems';
  } else if (roundedStreak === 7) {
    reward.item = {
      id: `rare_egg_${Date.now()}`,
      name: 'Rare Egg',
      type: 'egg',
      rarity: 'Rare',
      description: 'A rare egg for dedicated adventurers.'
    };
    reward.message = 'Day 7 reward: Rare Egg!';
  } else if (roundedStreak === 30) {
    reward.gems = 30;
    reward.item = {
      id: `legendary_key_${Date.now()}`,
      name: 'Legendary Key',
      type: 'key',
      rarity: 'Legendary',
      description: 'A legendary key for the most faithful heroes.'
    };
    reward.message = 'Day 30 reward: Legendary Key and 30 Gems!';
  } else {
    reward.gold = 250;
    reward.message = `Day ${roundedStreak} reward: 250 Gold`;
  }

  if (reward.gold) {
    await addGold(userId, reward.gold);
    await incrementStatistic(userId, 'goldEarned', reward.gold);
  }
  if (reward.gems) {
    await addGems(userId, reward.gems);
  }
  if (reward.item) {
    await addToInventory(userId, reward.item);
  }

  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $set: { dailyStreak: roundedStreak, lastDailyClaim: now } }
  );

  if (roundedStreak === 1) {
    await addAchievement(userId, '🎉 First Steps');
  }

  return { success: true, streak: roundedStreak, reward, message: reward.message };
}

async function getDailyStatus(userId) {
  const player = await getPlayer(userId);
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const lastClaim = player.lastDailyClaim || 0;
  const nextClaimAt = lastClaim + oneDay;
  return {
    streak: player.dailyStreak || 0,
    lastClaim,
    nextClaimAt,
    canClaim: !lastClaim || now >= nextClaimAt
  };
}

async function getMonsterCollectionLeaderboard(limit = null) {
  const rows = await all(require('./db-adapter').getPlayersDb(), {});
  const parsed = rows.map(row => {
    const collection = parseJson(row.monsterCollection, []);
    return { userId: row.userId, username: row.username || row.userId, collected: Array.isArray(collection) ? collection.length : 0 };
  });
  parsed.sort((a, b) => b.collected - a.collected);
  return limit ? parsed.slice(0, limit) : parsed;
}

async function addToInventory(userId, item) {
  const player = await getPlayer(userId);
  const inventory = JSON.parse(player.inventory || '[]');
  inventory.push(item);
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $set: { inventory: JSON.stringify(inventory) } }
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
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $set: { equipped: JSON.stringify(equipped) } }
  );
}

async function addTitle(userId, title) {
  const player = await getPlayer(userId);
  const titles = JSON.parse(player.titles || '[]');
  if (!titles.includes(title)) {
    titles.push(title);
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $set: { titles: JSON.stringify(titles) } }
  );
  }
}

async function addAchievement(userId, achievement) {
  const player = await getPlayer(userId);
  const achievements = JSON.parse(player.achievements || '[]');
  if (!achievements.includes(achievement)) {
    achievements.push(achievement);
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $set: { achievements: JSON.stringify(achievements) } }
  );
  }
}

async function prestige(userId) {
  const player = await getPlayer(userId);
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $set: { prestige: 1, level: 1, xp: 0, gold: 0, attackLevel: 1 } }
  );
}

module.exports = {
  ensurePlayer,
  updatePlayerProfile,
  setLastLogin,
  getPlayer,
  getPlayerResources,
  addPlayerResource,
  addKnowledgeBook,
  getPlayerWorkLevels,
  addDamage,
  setLastAttackAt,
  canAttackToday,
  incrementAttackLevelAndParticipated,
  getLeaderboard,
  getLevelLeaderboard,
  getGoldLeaderboard,
  getMonsterCollectionLeaderboard,
  addXP,
  addGold,
  addGems,
  spendGold,
  spendGems,
  addEnergy,
  spendEnergy,
  updateEnergy,
  getPlayerSettings,
  updatePlayerSettings,
  getStatistics,
  incrementStatistic,
  claimDailyReward,
  getDailyStatus,
  addToInventory,
  removeFromInventory,
  equipItem,
  addTitle,
  addAchievement,
  prestige
};

