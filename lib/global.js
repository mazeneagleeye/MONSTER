const { get, run, all } = require('./db');
const { getPlayer } = require('./players');

// Global chat channels
const CHAT_CHANNELS = {
  GLOBAL: 'global',
  TRADE: 'trade',
  GUILD: 'guild',
  HELP: 'help',
  SPAM: 'spam'
};

// Global leaderboard types
const LEADERBOARD_TYPES = {
  LEVEL: 'level',
  DAMAGE: 'damage',
  GOLD: 'gold',
  GUILD: 'guild',
  TOWER: 'tower',
  PVP: 'pvp'
};

// Global market functions
async function listToGlobalMarket(sellerId, item, price, quantity = 1) {
  const listingId = `global_listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();
  
  await run(
    require('./db').monsterDb,
    `INSERT INTO global_market (id, sellerId, itemType, itemId, price, quantity, createdAt)
     VALUES(?, ?, ?, ?, ?, ?, ?)`,
    [listingId, sellerId, item.type, JSON.stringify(item), price, quantity, now]
  );
  
  return { success: true, listingId };
}

async function getGlobalMarketListings(itemType = null, limit = 50, offset = 0) {
  let query = `SELECT * FROM global_market`;
  const params = [];
  
  if (itemType) {
    query += ` WHERE itemType = ?`;
    params.push(itemType);
  }
  
  query += ` ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  const rows = await all(require('./db').monsterDb, query, params);
  
  return rows.map(row => ({
    ...row,
    item: JSON.parse(row.itemId)
  }));
}

async function buyFromGlobalMarket(listingId, buyerId, quantity = 1) {
  const listing = await get(require('./db').monsterDb,
    `SELECT * FROM global_market WHERE id = ?`,
    [listingId]
  );
  
  if (!listing) {
    return { success: false, message: 'Listing not found!' };
  }
  
  if (listing.sellerId === buyerId) {
    return { success: false, message: 'Cannot buy your own listing!' };
  }
  
  if (listing.quantity < quantity) {
    return { success: false, message: 'Not enough items in stock!' };
  }
  
  const totalPrice = listing.price * quantity;
  const buyer = await getPlayer(buyerId);
  
  if (buyer.gold < totalPrice) {
    return { success: false, message: 'Not enough gold!' };
  }
  
  // Transfer gold
  const { spendGold, addGold } = require('./players');
  await spendGold(buyerId, totalPrice);
  await addGold(listing.sellerId, totalPrice);
  
  // Update listing quantity
  const newQuantity = listing.quantity - quantity;
  if (newQuantity <= 0) {
    await run(require('./db').monsterDb,
      `DELETE FROM global_market WHERE id = ?`,
      [listingId]
    );
  } else {
    await run(require('./db').monsterDb,
      `UPDATE global_market SET quantity = ? WHERE id = ?`,
      [newQuantity, listingId]
    );
  }
  
  // Add item to buyer's inventory
  const item = JSON.parse(listing.itemId);
  await require('./players').addToInventory(buyerId, item);
  
  return { success: true, message: `Purchased ${quantity} item(s) for ${totalPrice} gold!` };
}

// Global chat functions
async function sendGlobalMessage(userId, message, channel = CHAT_CHANNELS.GLOBAL) {
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();
  
  // Rate limiting
  const recentMessages = await all(require('./db').monsterDb,
    `SELECT COUNT(*) as count FROM global_chat WHERE userId = ? AND createdAt > ?`,
    [userId, now - 5000]
  );
  
  if (recentMessages[0]?.count >= 3) {
    return { success: false, message: 'You are sending messages too fast!' };
  }
  
  await run(
    require('./db').monsterDb,
    `INSERT INTO global_chat (id, userId, message, channel, createdAt)
     VALUES(?, ?, ?, ?, ?)`,
    [messageId, userId, message, channel, now]
  );
  
  return { success: true, messageId };
}

async function getGlobalMessages(channel = CHAT_CHANNELS.GLOBAL, limit = 50, offset = 0) {
  const messages = await all(require('./db').monsterDb,
    `SELECT gc.*, p.username, p.level FROM global_chat gc
     JOIN players p ON gc.userId = p.userId
     WHERE gc.channel = ?
     ORDER BY gc.createdAt DESC
     LIMIT ? OFFSET ?`,
    [channel, limit, offset]
  );
  
  return messages.reverse();
}

async function getGlobalChatChannels() {
  return Object.values(CHAT_CHANNELS);
}

// Global leaderboards
async function getGlobalLeaderboard(type = LEADERBOARD_TYPES.LEVEL, limit = 100, offset = 0) {
  let query = '';
  const params = [limit, offset];
  
  switch (type) {
    case LEADERBOARD_TYPES.LEVEL:
      query = `SELECT userId, username, level, prestige FROM players ORDER BY level DESC, prestige DESC LIMIT ? OFFSET ?`;
      break;
    case LEADERBOARD_TYPES.DAMAGE:
      query = `SELECT userId, username, totalDamage, attackLevel FROM players ORDER BY totalDamage DESC LIMIT ? OFFSET ?`;
      break;
    case LEADERBOARD_TYPES.GOLD:
      query = `SELECT userId, username, gold, gems FROM players ORDER BY gold DESC LIMIT ? OFFSET ?`;
      break;
    case LEADERBOARD_TYPES.GUILD:
      query = `SELECT g.guildId, g.name, g.level, g.xp, COUNT(gm.userId) as memberCount 
               FROM guilds g 
               LEFT JOIN guild_members gm ON g.guildId = gm.guildId 
               GROUP BY g.guildId 
               ORDER BY g.level DESC, g.xp DESC 
               LIMIT ? OFFSET ?`;
      break;
    default:
      query = `SELECT userId, username, level FROM players ORDER BY level DESC LIMIT ? OFFSET ?`;
  }
  
  const rows = await all(require('./db').playersDb, query, params);
  return rows;
}

async function getPlayerRank(userId, type = LEADERBOARD_TYPES.LEVEL) {
  let query = '';
  
  switch (type) {
    case LEADERBOARD_TYPES.LEVEL:
      query = `SELECT COUNT(*) + 1 as rank FROM players WHERE level > (SELECT level FROM players WHERE userId = ?) OR (level = (SELECT level FROM players WHERE userId = ?) AND prestige > (SELECT prestige FROM players WHERE userId = ?))`;
      break;
    case LEADERBOARD_TYPES.DAMAGE:
      query = `SELECT COUNT(*) + 1 as rank FROM players WHERE totalDamage > (SELECT totalDamage FROM players WHERE userId = ?)`;
      break;
    case LEADERBOARD_TYPES.GOLD:
      query = `SELECT COUNT(*) + 1 as rank FROM players WHERE gold > (SELECT gold FROM players WHERE userId = ?)`;
      break;
    default:
      return null;
  }
  
  const row = await get(require('./db').playersDb, query, [userId, userId, userId]);
  return row?.rank || null;
}

// World boss functions
async function getWorldBossStatus() {
  const boss = await get(require('./db').monsterDb,
    `SELECT * FROM monster_state WHERE key = 'world_boss'`
  );
  
  if (!boss) {
    return null;
  }
  
  const bossData = JSON.parse(boss.value);
  const attackers = await all(require('./db').monsterDb,
    `SELECT userId, damage FROM monster_attacks WHERE monsterId = ? ORDER BY damage DESC LIMIT 10`,
    [bossData.monsterId]
  );
  
  return {
    ...bossData,
    attackers
  };
}

async function spawnWorldBoss() {
  const bossId = `world_boss_${Date.now()}`;
  const boss = {
    monsterId: bossId,
    name: 'World Boss',
    hp: 10000,
    maxHp: 10000,
    level: 100,
    element: 'Dark',
    type: 'Demon',
    rarity: 'Mythic'
  };
  
  await run(require('./db').monsterDb,
    `INSERT OR REPLACE INTO monster_state (key, value) VALUES (?, ?)`,
    ['world_boss', JSON.stringify(boss)]
  );
  
  return boss;
}

async function attackWorldBoss(userId, damage) {
  const boss = await getWorldBossStatus();
  if (!boss) {
    return { success: false, message: 'No active world boss!' };
  }
  
  const newHp = Math.max(0, boss.hp - damage);
  
  await run(require('./db').monsterDb,
    `UPDATE monster_state SET value = ? WHERE key = 'world_boss'`,
    [JSON.stringify({ ...boss, hp: newHp })]
  );
  
  // Record attack
  await run(require('./db').monsterDb,
    `INSERT OR REPLACE INTO monster_attacks (monsterId, userId, damage, attackAt)
     VALUES(?, ?, ?, ?)`,
    [boss.monsterId, userId, damage, Date.now()]
  );
  
  // Award participation
  const { addXP, addGold, addGems } = require('./players');
  await addXP(userId, 10);
  await addGold(userId, 5);
  
  if (newHp <= 0) {
    // Boss defeated - award all participants
    const attackers = await all(require('./db').monsterDb,
      `SELECT userId, damage FROM monster_attacks WHERE monsterId = ?`,
      [boss.monsterId]
    );
    
    for (const attacker of attackers) {
      await addXP(attacker.userId, 500);
      await addGold(attacker.userId, 250);
      await addGems(attacker.userId, 15);
    }
    
    // Spawn new boss after delay
    setTimeout(() => spawnWorldBoss(), 3600000); // 1 hour
    
    return { success: true, defeated: true, message: 'World boss defeated!' };
  }
  
  return { success: true, hp: newHp, maxHp: boss.maxHp };
}

// Cross-server PvP functions
async function getCrossServerLeaderboard(limit = 100) {
  return await getGlobalLeaderboard(LEADERBOARD_TYPES.LEVEL, limit);
}

async function getSeasonRankings(seasonId) {
  const rankings = await all(require('./db').monsterDb,
    `SELECT userId, score, rank FROM season_rankings WHERE seasonId = ? ORDER BY rank ASC LIMIT 100`,
    [seasonId]
  );
  
  return rankings;
}

async function updateSeasonRanking(userId, seasonId, score) {
  await run(require('./db').monsterDb,
    `INSERT OR REPLACE INTO season_rankings (userId, seasonId, score, rank)
     VALUES(?, ?, ?, (SELECT COUNT(*) + 1 FROM season_rankings WHERE seasonId = ? AND score > ?))`,
    [userId, seasonId, score, seasonId, score]
  );
}

// World events
async function triggerWorldEvent(eventType) {
  const events = {
    'double_xp': { name: 'Double XP Weekend', duration: 48 * 60 * 60 * 1000, multiplier: 2 },
    'double_gold': { name: 'Gold Rush', duration: 24 * 60 * 60 * 1000, multiplier: 2 },
    'rare_monsters': { name: 'Rare Monster Invasion', duration: 12 * 60 * 60 * 1000, multiplier: 1 },
    'guild_wars': { name: 'Guild Wars', duration: 7 * 24 * 60 * 60 * 1000, multiplier: 1 }
  };
  
  const event = events[eventType];
  if (!event) return null;
  
  const eventId = `world_event_${Date.now()}`;
  const now = Date.now();
  
  await run(require('./db').monsterDb,
    `INSERT INTO events (eventId, name, type, startTime, endTime, rewards, active)
     VALUES(?, ?, 'world', ?, ?, '[]', 1)`,
    [eventId, event.name, now, now + event.duration]
  );
  
  return { success: true, eventId, ...event };
}

module.exports = {
  CHAT_CHANNELS,
  LEADERBOARD_TYPES,
  listToGlobalMarket,
  getGlobalMarketListings,
  buyFromGlobalMarket,
  sendGlobalMessage,
  getGlobalMessages,
  getGlobalChatChannels,
  getGlobalLeaderboard,
  getPlayerRank,
  getWorldBossStatus,
  spawnWorldBoss,
  attackWorldBoss,
  getCrossServerLeaderboard,
  getSeasonRankings,
  updateSeasonRanking,
  triggerWorldEvent
};