const { get, run, all } = require('./db-adapter');
const { getPlayer } = require('./players');

// Global chat messages
async function sendGlobalChatMessage(userId, message, channel = 'global') {
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await run(require('./db-adapter').getMonsterDb(),
    {
      id: messageId,
      userId: userId,
      message: message,
      channel: channel,
      createdAt: Date.now()
    }
  );
  
  return { success: true, messageId };
}

// Get global chat messages
async function getGlobalChatMessages(channel = 'global', limit = 50) {
  const messages = await all(require('./db-adapter').getMonsterDb(),
    { channel: channel },
    { sort: { createdAt: -1 }, limit: limit }
  );
  
  return messages.reverse();
}

// Get player messages
async function getPlayerMessages(userId, limit = 20) {
  const messages = await all(require('./db-adapter').getMonsterDb(),
    { userId: userId },
    { sort: { createdAt: -1 }, limit: limit }
  );
  
  return messages;
}

// Delete message
async function deleteChatMessage(messageId, userId) {
  const message = await get(require('./db-adapter').getMonsterDb(),
    { id: messageId }
  );
  
  if (!message) {
    return { success: false, message: 'Message not found!' };
  }
  
  // Only allow deleting own messages (or admin)
  if (message.userId !== userId) {
    return { success: false, message: 'You can only delete your own messages!' };
  }
  
  await run(require('./db-adapter').getMonsterDb(),
    { id: messageId },
    { $delete: true }
  );
  
  return { success: true, message: 'Message deleted!' };
}

// Leaderboard functions
async function getTopPlayersByLevel(limit = 10) {
  const players = await all(require('./db-adapter').getPlayersDb(),
    {},
    { sort: { level: -1, prestige: -1 }, limit: limit }
  );
  
  return players.map(player => ({
    userId: player.userId,
    username: player.username || player.userId,
    level: player.level,
    prestige: player.prestige || 0
  }));
}

async function getTopPlayersByGold(limit = 10) {
  const players = await all(require('./db-adapter').getPlayersDb(),
    {},
    { sort: { gold: -1 }, limit: limit }
  );
  
  return players.map(player => ({
    userId: player.userId,
    username: player.username || player.userId,
    gold: player.gold || 0
  }));
}

async function getTopPlayersByDamage(limit = 10) {
  const players = await all(require('./db-adapter').getPlayersDb(),
    {},
    { sort: { totalDamage: -1 }, limit: limit }
  );
  
  return players.map(player => ({
    userId: player.userId,
    username: player.username || player.userId,
    totalDamage: player.totalDamage || 0
  }));
}

// Search players
async function searchPlayers(query, limit = 10) {
  const players = await all(require('./db-adapter').getPlayersDb(),
    {},
    { sort: { level: -1 } }
  );
  
  const filtered = players.filter(player => 
    (player.username && player.username.toLowerCase().includes(query.toLowerCase())) ||
    player.userId.includes(query)
  );
  
  return filtered.slice(0, limit);
}

// Get player count
async function getPlayerCount() {
  const players = await all(require('./db-adapter').getPlayersDb(), {});
  return players.length;
}

// Get server stats
async function getServerStats() {
  const players = await all(require('./db-adapter').getPlayersDb(), {});
  
  const totalLevel = players.reduce((sum, p) => sum + (p.level || 0), 0);
  const totalGold = players.reduce((sum, p) => sum + (p.gold || 0), 0);
  const totalDamage = players.reduce((sum, p) => sum + (p.totalDamage || 0), 0);
  
  return {
    totalPlayers: players.length,
    totalLevel,
    totalGold,
    totalDamage,
    averageLevel: players.length > 0 ? Math.floor(totalLevel / players.length) : 0
  };
}

module.exports = {
  sendGlobalChatMessage,
  getGlobalChatMessages,
  getPlayerMessages,
  deleteChatMessage,
  getTopPlayersByLevel,
  getTopPlayersByGold,
  getTopPlayersByDamage,
  searchPlayers,
  getPlayerCount,
  getServerStats
};