const { get, run, all } = require('./db-adapter');
const { getPlayer, addXP, addGold, addGems, addToInventory } = require('./players');

// Event types
const EVENT_TYPES = {
  DOUBLE_XP: 'double_xp',
  DOUBLE_GOLD: 'double_gold',
  RARE_MONSTER: 'rare_monster',
  GUILD_WAR: 'guild_war',
  WORLD_BOSS: 'world_boss',
  FESTIVAL: 'festival'
};

// Create event
async function createEvent(eventId, name, type, startTime, endTime, rewards = []) {
  await run(require('./db-adapter').getMonsterDb(),
    {
      eventId: eventId,
      name: name,
      type: type,
      startTime: startTime,
      endTime: endTime,
      rewards: JSON.stringify(rewards),
      active: 1
    }
  );
  
  return { success: true, eventId };
}

// Get active events
async function getActiveEvents() {
  const now = Date.now();
  const events = await all(require('./db-adapter').getMonsterDb(),
    {
      active: 1,
      startTime: { $lte: now },
      endTime: { $gte: now }
    }
  );
  
  return events.map(event => ({
    ...event,
    rewards: JSON.parse(event.rewards || '[]')
  }));
}

// Get all events
async function getAllEvents() {
  const events = await all(require('./db-adapter').getMonsterDb(),
    {},
    { sort: { startTime: -1 } }
  );
  
  return events.map(event => ({
    ...event,
    rewards: JSON.parse(event.rewards || '[]')
  }));
}

// Update event progress
async function updateEventProgress(userId, eventId, progressData) {
  await run(require('./db-adapter').getMonsterDb(),
    {
      userId: userId,
      eventId: eventId,
      progress: JSON.stringify(progressData),
      claimed: JSON.stringify([])
    },
    { $set: { progress: JSON.stringify(progressData) } }
  );
  
  return { success: true };
}

// Get event progress
async function getEventProgress(userId, eventId) {
  const progress = await get(require('./db-adapter').getMonsterDb(),
    { userId: userId, eventId: eventId }
  );
  
  if (!progress) {
    return {
      userId: userId,
      eventId: eventId,
      progress: {},
      claimed: []
    };
  }
  
  return {
    ...progress,
    progress: JSON.parse(progress.progress || '{}'),
    claimed: JSON.parse(progress.claimed || '[]')
  };
}

// Claim event reward
async function claimEventReward(userId, eventId, rewardIndex) {
  const eventProgress = await getEventProgress(userId, eventId);
  
  if (eventProgress.claimed.includes(rewardIndex)) {
    return { success: false, message: 'Reward already claimed!' };
  }
  
  const event = await get(require('./db-adapter').getMonsterDb(),
    { eventId: eventId }
  );
  
  if (!event) {
    return { success: false, message: 'Event not found!' };
  }
  
  const rewards = JSON.parse(event.rewards || '[]');
  const reward = rewards[rewardIndex];
  
  if (!reward) {
    return { success: false, message: 'Invalid reward!' };
  }
  
  // Give reward
  if (reward.xp) {
    await addXP(userId, reward.xp);
  }
  if (reward.gold) {
    await addGold(userId, reward.gold);
  }
  if (reward.gems) {
    await addGems(userId, reward.gems);
  }
  if (reward.item) {
    await addToInventory(userId, reward.item);
  }
  
  // Mark as claimed
  const claimed = [...eventProgress.claimed, rewardIndex];
  await run(require('./db-adapter').getMonsterDb(),
    { userId: userId, eventId: eventId },
    { $set: { claimed: JSON.stringify(claimed) } }
  );
  
  return { success: true, reward };
}

// End event
async function endEvent(eventId) {
  await run(require('./db-adapter').getMonsterDb(),
    { eventId: eventId },
    { $set: { active: 0 } }
  );
  
  return { success: true };
}

// Get event leaderboard
async function getEventLeaderboard(eventId, limit = 10) {
  const progress = await all(require('./db-adapter').getMonsterDb(),
    { eventId: eventId },
    { sort: { 'progress.score': -1 }, limit: limit }
  );
  
  return progress.map(p => ({
    userId: p.userId,
    score: JSON.parse(p.progress || '{}').score || 0
  }));
}

module.exports = {
  EVENT_TYPES,
  createEvent,
  getActiveEvents,
  getAllEvents,
  updateEventProgress,
  getEventProgress,
  claimEventReward,
  endEvent,
  getEventLeaderboard
};