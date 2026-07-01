const { get, run, all } = require('./db');
const { getPlayer, addXP, addGold, addGems, addTitle, addAchievement } = require('./players');

// Event types
const EVENT_TYPES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  SEASONAL: 'seasonal',
  HOLIDAY: 'holiday',
  SPECIAL: 'special'
};

// Daily quest templates
const DAILY_QUESTS = [
  { id: 'attack_world', name: 'World Attack', description: 'Attack the world boss', objective: 'attacks', target: 1, rewards: { xp: 100, gold: 50, gems: 2 } },
  { id: 'battle_pve', name: 'PVE Warrior', description: 'Win 3 PvE battles', objective: 'pve_wins', target: 3, rewards: { xp: 150, gold: 75, gems: 3 } },
  { id: 'battle_pvp', name: 'PVP Champion', description: 'Win 2 PvP battles', objective: 'pvp_wins', target: 2, rewards: { xp: 200, gold: 100, gems: 5 } },
  { id: 'gather', name: 'Gatherer', description: 'Gather resources 5 times', objective: 'gathers', target: 5, rewards: { xp: 100, gold: 40, gems: 2 } },
  { id: 'trade', name: 'Trader', description: 'Buy 2 items from market', objective: 'purchases', target: 2, rewards: { xp: 80, gold: 30, gems: 1 } },
  { id: 'monster_care', name: 'Monster Caretaker', description: 'Interact with your monster 3 times', objective: 'interactions', target: 3, rewards: { xp: 120, gold: 60, gems: 3 } },
  { id: 'guild_contribute', name: 'Guild Contributor', description: 'Contribute 100 gold to guild', objective: 'contribution', target: 100, rewards: { xp: 150, gold: 50, gems: 4 } },
  { id: 'level_up', name: 'Level Up', description: 'Gain 1 level', objective: 'levels', target: 1, rewards: { xp: 200, gold: 100, gems: 5 } }
];

// Weekly quest templates
const WEEKLY_QUESTS = [
  { id: 'weekly_boss', name: 'Boss Slayer', description: 'Defeat 5 bosses', objective: 'boss_kills', target: 5, rewards: { xp: 500, gold: 250, gems: 15 } },
  { id: 'weekly_tower', name: 'Tower Climber', description: 'Reach floor 10 in tower', objective: 'tower_floor', target: 10, rewards: { xp: 400, gold: 200, gems: 10 } },
  { id: 'weekly_survival', name: 'Survivor', description: 'Complete 3 survival runs', objective: 'survival_runs', target: 3, rewards: { xp: 350, gold: 175, gems: 8 } },
  { id: 'weekly_market', name: 'Market Mogul', description: 'Sell 10 items', objective: 'sales', target: 10, rewards: { xp: 300, gold: 150, gems: 7 } }
];

// Monthly pass rewards
const MONTHLY_PASS_REWARDS = {
  free: [
    { day: 1, rewards: { gold: 100, gems: 5 } },
    { day: 7, rewards: { gold: 200, gems: 10 } },
    { day: 14, rewards: { gold: 300, gems: 15 } },
    { day: 21, rewards: { gold: 400, gems: 20 } },
    { day: 30, rewards: { gold: 500, gems: 25, title: 'Monthly Veteran' } }
  ],
  premium: [
    { day: 1, rewards: { gold: 200, gems: 10, item: 'premium_box' } },
    { day: 7, rewards: { gold: 400, gems: 20, item: 'rare_box' } },
    { day: 14, rewards: { gold: 600, gems: 30, item: 'epic_box' } },
    { day: 21, rewards: { gold: 800, gems: 40, item: 'legendary_box' } },
    { day: 30, rewards: { gold: 1000, gems: 50, title: 'Monthly Legend', monster: 'monster_500' } }
  ]
};

// Seasonal events
const SEASONAL_EVENTS = [
  {
    id: 'spring_festival',
    name: 'Spring Festival',
    type: EVENT_TYPES.SEASONAL,
    duration: 7 * 24 * 60 * 60 * 1000, // 7 days
    rewards: { xp: 2, gold: 2, gems: 2 },
    specialMonsters: ['monster_1', 'monster_2', 'monster_3']
  },
  {
    id: 'summer_heat',
    name: 'Summer Heat',
    type: EVENT_TYPES.SEASONAL,
    duration: 7 * 24 * 60 * 60 * 1000,
    rewards: { xp: 2, gold: 2, gems: 2 },
    specialMonsters: ['monster_10', 'monster_20', 'monster_30']
  },
  {
    id: 'autumn_harvest',
    name: 'Autumn Harvest',
    type: EVENT_TYPES.SEASONAL,
    duration: 7 * 24 * 60 * 60 * 1000,
    rewards: { xp: 2, gold: 2, gems: 2 },
    specialMonsters: ['monster_40', 'monster_50', 'monster_60']
  },
  {
    id: 'winter_frost',
    name: 'Winter Frost',
    type: EVENT_TYPES.SEASONAL,
    duration: 7 * 24 * 60 * 60 * 1000,
    rewards: { xp: 2, gold: 2, gems: 2 },
    specialMonsters: ['monster_70', 'monster_80', 'monster_90']
  }
];

// Holiday events
const HOLIDAY_EVENTS = [
  {
    id: 'new_year',
    name: 'New Year Celebration',
    type: EVENT_TYPES.HOLIDAY,
    duration: 3 * 24 * 60 * 60 * 1000,
    rewards: { xp: 3, gold: 3, gems: 3 }
  },
  {
    id: 'halloween',
    name: 'Halloween Spooktacular',
    type: EVENT_TYPES.HOLIDAY,
    duration: 7 * 24 * 60 * 60 * 1000,
    rewards: { xp: 2, gold: 2, gems: 2 },
    specialMonsters: ['monster_100', 'monster_101', 'monster_102']
  },
  {
    id: 'christmas',
    name: 'Winter Wonderland',
    type: EVENT_TYPES.HOLIDAY,
    duration: 14 * 24 * 60 * 60 * 1000,
    rewards: { xp: 2, gold: 2, gems: 2 }
  }
];

async function getDailyQuests(userId) {
  const today = new Date().toISOString().split('T')[0];
  const quests = await all(require('./db').playersDb,
    `SELECT * FROM daily_quests WHERE userId = ? AND date = ?`,
    [userId, today]
  );
  
  return quests;
}

async function assignDailyQuests(userId) {
  const today = new Date().toISOString().split('T')[0];
  
  // Check if already assigned
  const existing = await all(require('./db').playersDb,
    `SELECT * FROM daily_quests WHERE userId = ? AND date = ?`,
    [userId, today]
  );
  
  if (existing.length > 0) {
    return existing;
  }
  
  // Assign 3 random daily quests
  const selectedQuests = [];
  const shuffled = [...DAILY_QUESTS].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < Math.min(3, shuffled.length); i++) {
    const quest = shuffled[i];
    await run(require('./db').playersDb,
      `INSERT INTO daily_quests (userId, questId, progress, completed, claimed, date)
       VALUES(?, ?, 0, 0, 0, ?)`,
      [userId, quest.id, today]
    );
    selectedQuests.push(quest);
  }
  
  return selectedQuests;
}

async function updateQuestProgress(userId, objective, amount = 1) {
  const today = new Date().toISOString().split('T')[0];
  const quests = await all(require('./db').playersDb,
    `SELECT * FROM daily_quests WHERE userId = ? AND date = ? AND completed = 0`,
    [userId, today]
  );
  
  for (const quest of quests) {
    const questTemplate = DAILY_QUESTS.find(q => q.id === quest.questId);
    if (!questTemplate || questTemplate.objective !== objective) continue;
    
    const newProgress = quest.progress + amount;
    const completed = newProgress >= questTemplate.target;
    
    await run(require('./db').playersDb,
      `UPDATE daily_quests SET progress = ?, completed = ? WHERE userId = ? AND questId = ? AND date = ?`,
      [newProgress, completed ? 1 : 0, userId, quest.questId, today]
    );
    
    if (completed) {
      // Award rewards
      const rewards = questTemplate.rewards;
      await addXP(userId, rewards.xp);
      await addGold(userId, rewards.gold);
      await addGems(userId, rewards.gems);
      
      if (rewards.title) {
        await addTitle(userId, rewards.title);
      }
    }
  }
}

async function claimQuestReward(userId, questId) {
  const today = new Date().toISOString().split('T')[0];
  const quest = await get(require('./db').playersDb,
    `SELECT * FROM daily_quests WHERE userId = ? AND questId = ? AND date = ?`,
    [userId, questId, today]
  );
  
  if (!quest || quest.completed === 0) {
    return { success: false, message: 'Quest not completed!' };
  }
  
  if (quest.claimed === 1) {
    return { success: false, message: 'Reward already claimed!' };
  }
  
  await run(require('./db').playersDb,
    `UPDATE daily_quests SET claimed = 1 WHERE userId = ? AND questId = ? AND date = ?`,
    [userId, questId, today]
  );
  
  const questTemplate = DAILY_QUESTS.find(q => q.id === questId);
  
  return { success: true, message: `Claimed ${questTemplate.name} rewards!` };
}

async function getWeeklyQuests(userId) {
  const weekStart = getWeekStart();
  const quests = await all(require('./db').playersDb,
    `SELECT * FROM daily_quests WHERE userId = ? AND date >= ? AND questId IN (?, ?, ?, ?)`,
    [userId, weekStart, 'weekly_boss', 'weekly_tower', 'weekly_survival', 'weekly_market']
  );
  
  return quests;
}

async function updateWeeklyProgress(userId, objective, amount = 1) {
  const weekStart = getWeekStart();
  const questIds = ['weekly_boss', 'weekly_tower', 'weekly_survival', 'weekly_market'];
  
  const quests = await all(require('./db').playersDb,
    `SELECT * FROM daily_quests WHERE userId = ? AND date >= ? AND questId IN (${questIds.map(() => '?').join(',')}) AND completed = 0`,
    [userId, weekStart, ...questIds]
  );
  
  for (const quest of quests) {
    const questTemplate = WEEKLY_QUESTS.find(q => q.id === quest.questId);
    if (!questTemplate || questTemplate.objective !== objective) continue;
    
    const newProgress = quest.progress + amount;
    const completed = newProgress >= questTemplate.target;
    
    await run(require('./db').playersDb,
      `UPDATE daily_quests SET progress = ?, completed = ? WHERE userId = ? AND questId = ? AND date = ?`,
      [newProgress, completed ? 1 : 0, userId, quest.questId, quest.date]
    );
    
    if (completed) {
      const rewards = questTemplate.rewards;
      await addXP(userId, rewards.xp);
      await addGold(userId, rewards.gold);
      await addGems(userId, rewards.gems);
    }
  }
}

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  return weekStart.toISOString().split('T')[0];
}

async function getMonthlyPassStatus(userId) {
  const player = await require('./players').getPlayer(userId);
  const hasPremium = player.gems >= 1000; // Premium pass costs 1000 gems
  
  return {
    hasPremium,
    loginDays: player.monthlyLoginDays || 0,
    lastLogin: player.lastMonthlyLogin || null
  };
}

async function claimMonthlyReward(userId) {
  const status = await getMonthlyPassStatus(userId);
  const today = new Date().getDate();
  
  if (status.lastLogin === today) {
    return { success: false, message: 'Already claimed today!' };
  }
  
  const passType = status.hasPremium ? 'premium' : 'free';
  const rewards = MONTHLY_PASS_REWARDS[passType].find(r => r.day === today);
  
  if (!rewards) {
    return { success: false, message: 'No reward for today!' };
  }
  
  // Award rewards
  if (rewards.gold) await addGold(userId, rewards.gold);
  if (rewards.gems) await addGems(userId, rewards.gems);
  if (rewards.title) await addTitle(userId, rewards.title);
  
  // Update login status
  await run(require('./db').playersDb,
    `UPDATE players SET monthlyLoginDays = monthlyLoginDays + 1, lastMonthlyLogin = ? WHERE userId = ?`,
    [today, userId]
  );
  
  return { success: true, message: `Claimed day ${today} reward!` };
}

async function getActiveEvents() {
  const now = Date.now();
  const events = await all(require('./db').monsterDb,
    `SELECT * FROM events WHERE active = 1 AND startTime <= ? AND endTime >= ?`,
    [now, now]
  );
  
  return events.map(event => ({
    ...event,
    rewards: JSON.parse(event.rewards || '[]')
  }));
}

async function createEvent(eventData) {
  const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();
  
  await run(require('./db').monsterDb,
    `INSERT INTO events (eventId, name, type, startTime, endTime, rewards, active)
     VALUES(?, ?, ?, ?, ?, ?, 1)`,
    [
      eventId,
      eventData.name,
      eventData.type,
      now,
      now + eventData.duration,
      JSON.stringify(eventData.rewards || []),
    ]
  );
  
  return { success: true, eventId };
}

async function getEventProgress(userId, eventId) {
  const progress = await get(require('./db').monsterDb,
    `SELECT * FROM event_progress WHERE userId = ? AND eventId = ?`,
    [userId, eventId]
  );
  
  if (!progress) {
    return { progress: {}, claimed: [] };
  }
  
  return {
    progress: JSON.parse(progress.progress || '{}'),
    claimed: JSON.parse(progress.claimed || '[]')
  };
}

async function updateEventProgress(userId, eventId, objective, amount = 1) {
  const progress = await getEventProgress(userId, eventId);
  const newProgress = { ...progress.progress, [objective]: (progress.progress[objective] || 0) + amount };
  
  await run(require('./db').monsterDb,
    `INSERT OR REPLACE INTO event_progress (userId, eventId, progress, claimed)
     VALUES(?, ?, ?, ?)`,
    [userId, eventId, JSON.stringify(newProgress), JSON.stringify(progress.claimed)]
  );
  
  return newProgress;
}

async function claimEventReward(userId, eventId, rewardIndex) {
  const progress = await getEventProgress(userId, eventId);
  
  if (progress.claimed.includes(rewardIndex)) {
    return { success: false, message: 'Reward already claimed!' };
  }
  
  const event = await get(require('./db').monsterDb,
    `SELECT * FROM events WHERE eventId = ?`,
    [eventId]
  );
  
  if (!event) {
    return { success: false, message: 'Event not found!' };
  }
  
  const rewards = JSON.parse(event.rewards || '[]');
  const reward = rewards[rewardIndex];
  
  if (!reward) {
    return { success: false, message: 'Invalid reward!' };
  }
  
  // Award reward
  if (reward.xp) await addXP(userId, reward.xp);
  if (reward.gold) await addGold(userId, reward.gold);
  if (reward.gems) await addGems(userId, reward.gems);
  if (reward.title) await addTitle(userId, reward.title);
  
  // Mark as claimed
  const newClaimed = [...progress.claimed, rewardIndex];
  await run(require('./db').monsterDb,
    `UPDATE event_progress SET claimed = ? WHERE userId = ? AND eventId = ?`,
    [JSON.stringify(newClaimed), userId, eventId]
  );
  
  return { success: true, message: `Claimed reward!` };
}

module.exports = {
  EVENT_TYPES,
  DAILY_QUESTS,
  WEEKLY_QUESTS,
  MONTHLY_PASS_REWARDS,
  SEASONAL_EVENTS,
  HOLIDAY_EVENTS,
  getDailyQuests,
  assignDailyQuests,
  updateQuestProgress,
  claimQuestReward,
  getWeeklyQuests,
  updateWeeklyProgress,
  getMonthlyPassStatus,
  claimMonthlyReward,
  getActiveEvents,
  createEvent,
  getEventProgress,
  updateEventProgress,
  claimEventReward
};