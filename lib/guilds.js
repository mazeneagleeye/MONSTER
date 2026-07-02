const { get, run, all } = require('./db');
const { getPlayer, addXP, addGold, addGems } = require('./players');

const BUILDING_DEFINITIONS = {
  laboratory: {
    name: 'Clan Laboratory',
    description: 'Unlocks research and advanced clan upgrades.',
    requirements: { wood: 5000, stone: 3000, iron: 2000 },
    buildTimeHours: 24
  }
};

const RESOURCE_DEFINITIONS = {
  wood: { label: 'Wood', icon: '🪵' },
  stone: { label: 'Stone', icon: '🪨' },
  iron: { label: 'Iron', icon: '⚙️' },
  gems: { label: 'Gems', icon: '💎' }
};

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}

async function addGuildResources(guildId, resources) {
  const guild = await getGuild(guildId);
  if (!guild) return false;
  const current = parseJson(guild.resources, {});
  const next = { ...current };
  for (const [key, amount] of Object.entries(resources)) {
    next[key] = (next[key] || 0) + amount;
  }
  await run(require('./db').playersDb,
    `UPDATE guilds SET resources = ? WHERE guildId = ?`,
    [JSON.stringify(next), guildId]
  );
  return true;
}

async function contributeGuildResources(userId, resource, amount) {
  const player = await getPlayer(userId);
  if (!player.guildId) return { success: false, message: 'You are not in a guild!' };
  if (!RESOURCE_DEFINITIONS[resource]) return { success: false, message: 'Unknown resource.' };
  if (amount <= 0) return { success: false, message: 'Amount must be positive.' };

  const current = parseJson(player.resources, {});
  const owned = current[resource] || 0;
  if (owned < amount) {
    return { success: false, message: `You do not have enough ${resource} to contribute.` };
  }

  const nextResources = { ...current };
  nextResources[resource] = owned - amount;
  await run(require('./db').playersDb,
    `UPDATE players SET resources = ? WHERE userId = ?`,
    [JSON.stringify(nextResources), userId]
  );

  await addGuildResources(player.guildId, { [resource]: amount });
  return { success: true, message: `Contributed ${amount} ${resource} to the guild.` };
}

async function getPlayerResourceState(userId) {
  const player = await getPlayer(userId);
  const resources = parseJson(player.resources, {});
  const workLevels = parseJson(player.workLevels, {});
  return { resources, workLevels, knowledgeBooks: player.knowledgeBooks || 0 };
}

async function spendPlayerResource(userId, resource, amount) {
  const player = await getPlayer(userId);
  const resources = parseJson(player.resources, {});
  const owned = resources[resource] || 0;
  if (owned < amount) return false;
  resources[resource] = owned - amount;
  await run(require('./db').playersDb,
    `UPDATE players SET resources = ? WHERE userId = ?`,
    [JSON.stringify(resources), userId]
  );
  return true;
}

async function addPlayerResource(userId, resource, amount) {
  const player = await getPlayer(userId);
  const resources = parseJson(player.resources, {});
  resources[resource] = (resources[resource] || 0) + amount;
  await run(require('./db').playersDb,
    `UPDATE players SET resources = ? WHERE userId = ?`,
    [JSON.stringify(resources), userId]
  );
}

async function spendKnowledgeBook(userId) {
  const player = await getPlayer(userId);
  if ((player.knowledgeBooks || 0) <= 0) return false;
  await run(require('./db').playersDb,
    `UPDATE players SET knowledgeBooks = knowledgeBooks - 1 WHERE userId = ?`,
    [userId]
  );
  return true;
}

async function investKnowledge(userId, workName) {
  if (!['lumberjack','miner','jeweler','banker','builder','engineer','merchant','knight','negociant','blacksmith'].includes(workName)) {
    return { success: false, message: 'Unknown work.' };
  }
  const player = await getPlayer(userId);
  const workLevels = parseJson(player.workLevels, {});
  workLevels[workName] = (workLevels[workName] || 0) + 1;
  const spent = await spendKnowledgeBook(userId);
  if (!spent) return { success: false, message: 'You need at least one knowledge book to invest.' };
  await run(require('./db').playersDb,
    `UPDATE players SET workLevels = ? WHERE userId = ?`,
    [JSON.stringify(workLevels), userId]
  );
  return { success: true, message: `Invested 1 point into ${workName}.` };
}

async function startGuildConstruction(guildId, buildingId) {
  const guild = await getGuild(guildId);
  if (!guild) return { success: false, message: 'Guild not found!' };
  const definition = BUILDING_DEFINITIONS[buildingId];
  if (!definition) return { success: false, message: 'Unknown building.' };
  const construction = parseJson(guild.construction, {});
  if (construction[buildingId]) return { success: false, message: 'Construction already in progress.' };
  const currentResources = parseJson(guild.resources, {});
  const missing = Object.entries(definition.requirements).filter(([resource, amount]) => (currentResources[resource] || 0) < amount);
  if (missing.length) {
    return { success: false, message: `Need more resources to start: ${missing.map(([resource, amount]) => `${resource} ${currentResources[resource] || 0}/${amount}`).join(', ')}` };
  }
  const nextResources = { ...currentResources };
  for (const [resource, amount] of Object.entries(definition.requirements)) {
    nextResources[resource] = (nextResources[resource] || 0) - amount;
  }
  const startedAt = Date.now();
  construction[buildingId] = {
    startedAt,
    completedAt: startedAt + (definition.buildTimeHours * 60 * 60 * 1000),
    progress: 0
  };
  await run(require('./db').playersDb,
    `UPDATE guilds SET resources = ?, construction = ? WHERE guildId = ?`,
    [JSON.stringify(nextResources), JSON.stringify(construction), guildId]
  );
  return { success: true, message: `Started construction of ${definition.name}.` };
}

async function getGuildConstructionStatus(guildId) {
  const guild = await getGuild(guildId);
  if (!guild) return null;
  const construction = parseJson(guild.construction, {});
  const buildings = parseJson(guild.buildings, {});
  return { guild, construction, buildings };
}

async function buildGuildStructure(guildId, buildingId) {
  const guild = await getGuild(guildId);
  if (!guild) return { success: false, message: 'Guild not found!' };
  const construction = parseJson(guild.construction, {});
  const current = construction[buildingId];
  if (!current) return { success: false, message: 'Nothing is being built.' };
  const now = Date.now();
  if (now < current.completedAt) {
    return { success: false, message: 'Construction is still in progress.' };
  }
  const buildings = parseJson(guild.buildings, {});
  buildings[buildingId] = true;
  delete construction[buildingId];
  await run(require('./db').playersDb,
    `UPDATE guilds SET buildings = ?, construction = ? WHERE guildId = ?`,
    [JSON.stringify(buildings), JSON.stringify(construction), guildId]
  );
  return { success: true, message: `Completed ${BUILDING_DEFINITIONS[buildingId].name}.` };
}

async function contributeToGuild(userId, amount) {
  const player = await getPlayer(userId);
  if (!player.guildId) {
    return { success: false, message: 'You are not in a guild!' };
  }
  
  const canAfford = await spendGold(userId, amount);
  if (!canAfford) {
    return { success: false, message: 'Not enough gold!' };
  }
  
  await run(require('./db').playersDb,
    `UPDATE guilds SET bank = bank + ? WHERE guildId = ?`,
    [amount, player.guildId]
  );
  
  await run(require('./db').playersDb,
    `UPDATE guild_members SET contribution = contribution + ? WHERE guildId = ? AND userId = ?`,
    [amount, player.guildId, userId]
  );
  
  await addGuildXP(player.guildId, Math.floor(amount / 10));
  
  return { success: true, message: `Contributed ${amount} gold to guild!` };
}

async function createGuild(userId, guildName) {
  const player = await getPlayer(userId);
  if (player.guildId) {
    return { success: false, message: 'You are already in a guild!' };
  }
  
  const guildId = `guild_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();
  
  await run(
    require('./db').playersDb,
    `INSERT INTO guilds (guildId, name, level, xp, bank, upgrades, research, createdAt)
     VALUES(?, ?, 1, 0, 0, '{}', '{}', ?)`,
    [guildId, guildName, now]
  );
  
  // Add creator as guild master
  await run(
    require('./db').playersDb,
    `INSERT INTO guild_members (guildId, userId, rank, contribution, joinedAt)
     VALUES(?, ?, 'master', 0, ?)`,
    [guildId, userId, now]
  );
  
  // Update player
  await run(
    require('./db').playersDb,
    `UPDATE players SET guildId = ?, guildRank = 'master' WHERE userId = ?`,
    [guildId, userId]
  );
  
  return { success: true, guildId, name: guildName };
}

async function joinGuild(userId, guildId) {
  const player = await getPlayer(userId);
  if (player.guildId) {
    return { success: false, message: 'You are already in a guild!' };
  }
  
  const guild = await getGuild(guildId);
  if (!guild) {
    return { success: false, message: 'Guild not found!' };
  }
  
  const now = Date.now();
  
  await run(
    require('./db').playersDb,
    `INSERT INTO guild_members (guildId, userId, rank, contribution, joinedAt)
     VALUES(?, ?, 'member', 0, ?)`,
    [guildId, userId, now]
  );
  
  await run(
    require('./db').playersDb,
    `UPDATE players SET guildId = ?, guildRank = 'member' WHERE userId = ?`,
    [guildId, userId]
  );
  
  return { success: true, message: `Joined ${guild.name}!` };
}

async function leaveGuild(userId) {
  const player = await getPlayer(userId);
  if (!player.guildId) {
    return { success: false, message: 'You are not in a guild!' };
  }
  
  const guild = await getGuild(player.guildId);
  if (guild && guild.rank === 'master') {
    return { success: false, message: 'Guild master cannot leave! Transfer leadership or disband the guild.' };
  }
  
  await run(
    require('./db').playersDb,
    `DELETE FROM guild_members WHERE guildId = ? AND userId = ?`,
    [player.guildId, userId]
  );
  
  await run(
    require('./db').playersDb,
    `UPDATE players SET guildId = NULL, guildRank = 'member' WHERE userId = ?`,
    [userId]
  );
  
  return { success: true, message: 'Left the guild.' };
}

async function getGuild(guildId) {
  const guild = await get(require('./db').playersDb,
    `SELECT * FROM guilds WHERE guildId = ?`,
    [guildId]
  );
  
  if (!guild) return null;
  
  const members = await all(require('./db').playersDb,
    `SELECT gm.*, p.level FROM guild_members gm 
     JOIN players p ON gm.userId = p.userId 
     WHERE gm.guildId = ?`,
    [guildId]
  );
  
  return {
    ...guild,
    upgrades: JSON.parse(guild.upgrades || '{}'),
    research: JSON.parse(guild.research || '{}'),
    members
  };
}

async function getPlayerGuild(userId) {
  const player = await getPlayer(userId);
  if (!player.guildId) return null;
  
  return await getGuild(player.guildId);
}

async function addGuildXP(guildId, amount) {
  const guild = await getGuild(guildId);
  if (!guild) return;
  
  let { level, xp } = guild;
  xp += amount;
  
  const xpNeeded = level * 1000;
  
  while (xp >= xpNeeded && level < 50) {
    xp -= xpNeeded;
    level += 1;
  }
  
  await run(require('./db').playersDb,
    `UPDATE guilds SET level = ?, xp = ? WHERE guildId = ?`,
    [level, xp, guildId]
  );
}

async function contributeToGuild(userId, amount) {
  const player = await getPlayer(userId);
  if (!player.guildId) {
    return { success: false, message: 'You are not in a guild!' };
  }
  
  const canAfford = await spendGold(userId, amount);
  if (!canAfford) {
    return { success: false, message: 'Not enough gold!' };
  }
  
  await run(require('./db').playersDb,
    `UPDATE guilds SET bank = bank + ? WHERE guildId = ?`,
    [amount, player.guildId]
  );
  
  await run(require('./db').playersDb,
    `UPDATE guild_members SET contribution = contribution + ? WHERE guildId = ? AND userId = ?`,
    [amount, player.guildId, userId]
  );
  
  await addGuildXP(player.guildId, Math.floor(amount / 10));
  
  return { success: true, message: `Contributed ${amount} gold to guild!` };
}

async function upgradeGuild(guildId, upgradeType) {
  const guild = await getGuild(guildId);
  if (!guild) {
    return { success: false, message: 'Guild not found!' };
  }
  
  const upgrades = guild.upgrades || {};
  const currentLevel = upgrades[upgradeType] || 0;
  const cost = (currentLevel + 1) * 1000;
  
  if (guild.bank < cost) {
    return { success: false, message: `Not enough guild bank funds! Need ${cost} gold.` };
  }
  
  await run(require('./db').playersDb,
    `UPDATE guilds SET bank = bank - ?, upgrades = ? WHERE guildId = ?`,
    [cost, JSON.stringify({ ...upgrades, [upgradeType]: currentLevel + 1 }), guildId]
  );
  
  return { success: true, message: `Upgraded ${upgradeType} to level ${currentLevel + 1}!` };
}

async function startGuildBoss(guildId) {
  const guild = await getGuild(guildId);
  if (!guild) {
    return { success: false, message: 'Guild not found!' };
  }
  
  const bossLevel = guild.level * 10;
  
  return {
    success: true,
    boss: {
      name: `Guild Boss Lv.${bossLevel}`,
      hp: bossLevel * 100,
      maxHp: bossLevel * 100,
      level: bossLevel
    }
  };
}

async function getGuildLeaderboard(limit = 10) {
  const rows = await all(require('./db').playersDb,
    `SELECT g.name, g.level, g.xp, COUNT(gm.userId) as memberCount 
     FROM guilds g 
     LEFT JOIN guild_members gm ON g.guildId = gm.guildId 
     GROUP BY g.guildId 
     ORDER BY g.level DESC, g.xp DESC 
     LIMIT ?`,
    [limit]
  );
  
  return rows;
}

async function getGuildMembers(guildId) {
  const members = await all(require('./db').playersDb,
    `SELECT gm.*, p.level, p.attackLevel 
     FROM guild_members gm 
     JOIN players p ON gm.userId = p.userId 
     WHERE gm.guildId = ?
     ORDER BY gm.contribution DESC`,
    [guildId]
  );
  
  return members;
}

async function kickMember(guildId, userId, kickerId) {
  const guild = await getGuild(guildId);
  if (!guild) {
    return { success: false, message: 'Guild not found!' };
  }
  
  const kicker = guild.members.find(m => m.userId === kickerId);
  const target = guild.members.find(m => m.userId === userId);
  
  if (!kicker || !target) {
    return { success: false, message: 'Member not found!' };
  }
  
  if (kicker.rank === 'member') {
    return { success: false, message: 'Only officers can kick members!' };
  }
  
  if (target.rank === 'master') {
    return { success: false, message: 'Cannot kick the guild master!' };
  }
  
  if (kicker.rank === 'officer' && target.rank === 'officer') {
    return { success: false, message: 'Officers cannot kick other officers!' };
  }
  
  await run(require('./db').playersDb,
    `DELETE FROM guild_members WHERE guildId = ? AND userId = ?`,
    [guildId, userId]
  );
  
  await run(require('./db').playersDb,
    `UPDATE players SET guildId = NULL, guildRank = 'member' WHERE userId = ?`,
    [userId]
  );
  
  return { success: true, message: `Kicked ${target.username || 'member'} from the guild!` };
}

async function promoteMember(guildId, userId, promoterId) {
  const guild = await getGuild(guildId);
  if (!guild) {
    return { success: false, message: 'Guild not found!' };
  }
  
  const promoter = guild.members.find(m => m.userId === promoterId);
  const target = guild.members.find(m => m.userId === userId);
  
  if (!promoter || !target) {
    return { success: false, message: 'Member not found!' };
  }
  
  if (promoter.rank !== 'master') {
    return { success: false, message: 'Only the guild master can promote!' };
  }
  
  const newRank = target.rank === 'member' ? 'officer' : 'member';
  
  await run(require('./db').playersDb,
    `UPDATE guild_members SET rank = ? WHERE guildId = ? AND userId = ?`,
    [newRank, guildId, userId]
  );
  
  await run(require('./db').playersDb,
    `UPDATE players SET guildRank = ? WHERE userId = ?`,
    [newRank, userId]
  );
  
  return { success: true, message: `Promoted to ${newRank}!` };
}

async function disbandGuild(guildId, userId) {
  const guild = await getGuild(guildId);
  if (!guild) {
    return { success: false, message: 'Guild not found!' };
  }
  
  const member = guild.members.find(m => m.userId === userId);
  if (!member || member.rank !== 'master') {
    return { success: false, message: 'Only the guild master can disband the guild!' };
  }
  
  // Remove all members
  await run(require('./db').playersDb,
    `UPDATE players SET guildId = NULL, guildRank = 'member' WHERE guildId = ?`,
    [guildId]
  );
  
  // Delete guild
  await run(require('./db').playersDb,
    `DELETE FROM guilds WHERE guildId = ?`,
    [guildId]
  );
  
  await run(require('./db').playersDb,
    `DELETE FROM guild_members WHERE guildId = ?`,
    [guildId]
  );
  
  return { success: true, message: 'Guild disbanded!' };
}

module.exports = {
  createGuild,
  joinGuild,
  leaveGuild,
  getGuild,
  getPlayerGuild,
  addGuildXP,
  contributeToGuild,
  upgradeGuild,
  startGuildBoss,
  getGuildLeaderboard,
  getGuildMembers,
  kickMember,
  promoteMember,
  disbandGuild,
  addGuildResources,
  contributeGuildResources,
  getPlayerResourceState,
  spendPlayerResource,
  addPlayerResource,
  spendKnowledgeBook,
  investKnowledge,
  startGuildConstruction,
  getGuildConstructionStatus,
  buildGuildStructure,
  BUILDING_DEFINITIONS,
  RESOURCE_DEFINITIONS
};