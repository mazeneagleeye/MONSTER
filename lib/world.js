const { get, run, all } = require('./db');
const { getPlayer, ensurePlayer, spendEnergy, addXP, addGold, addGems } = require('./players');
const { getRandomMonster } = require('./monsters');

// World regions
const REGIONS = [
  { id: 'forest', name: '🌲 Enchanted Forest', description: 'A mystical forest filled with magical creatures', minLevel: 1, maxLevel: 20, monsters: ['monster_1', 'monster_2', 'monster_3', 'monster_4', 'monster_5'] },
  { id: 'desert', name: '🏜️ Scorching Desert', description: 'A harsh desert with ancient secrets', minLevel: 10, maxLevel: 30, monsters: ['monster_10', 'monster_11', 'monster_12', 'monster_13', 'monster_14'] },
  { id: 'volcano', name: '🌋 Volcanic Wasteland', description: 'A dangerous volcanic region', minLevel: 20, maxLevel: 40, monsters: ['monster_20', 'monster_21', 'monster_22', 'monster_23', 'monster_24'] },
  { id: 'ice', name: '❄️ Frozen Tundra', description: 'An icy wasteland of eternal winter', minLevel: 30, maxLevel: 50, monsters: ['monster_30', 'monster_31', 'monster_32', 'monster_33', 'monster_34'] },
  { id: 'space', name: '🌌 Cosmic Void', description: 'The depths of space', minLevel: 40, maxLevel: 60, monsters: ['monster_40', 'monster_41', 'monster_42', 'monster_43', 'monster_44'] },
  { id: 'ocean', name: '🌊 Abyssal Ocean', description: 'The deepest trenches of the ocean', minLevel: 50, maxLevel: 70, monsters: ['monster_50', 'monster_51', 'monster_52', 'monster_53', 'monster_54'] },
  { id: 'shadow', name: '🌑 Shadow Realm', description: 'A realm of darkness and despair', minLevel: 60, maxLevel: 80, monsters: ['monster_60', 'monster_61', 'monster_62', 'monster_63', 'monster_64'] },
  { id: 'celestial', name: '✨ Celestial Plains', description: 'Heavenly plains of light', minLevel: 70, maxLevel: 90, monsters: ['monster_70', 'monster_71', 'monster_72', 'monster_73', 'monster_74'] },
  { id: 'chaos', name: '🌀 Chaos Dimension', description: 'A dimension of pure chaos', minLevel: 80, maxLevel: 100, monsters: ['monster_80', 'monster_81', 'monster_82', 'monster_83', 'monster_84'] },
  { id: 'legendary', name: '⭐ Legendary Lands', description: 'The most dangerous region, only for the strongest', minLevel: 100, maxLevel: 500, monsters: ['monster_90', 'monster_100', 'monster_150', 'monster_200', 'monster_500'] }
];

// Weather types
const WEATHER_TYPES = [
  { id: 'clear', name: '☀️ Clear', effect: 'none', battleBonus: 0 },
  { id: 'rain', name: '🌧️ Rain', effect: 'water_boost', battleBonus: 1.2 },
  { id: 'storm', name: '⛈️ Storm', effect: 'electric_boost', battleBonus: 1.3 },
  { id: 'snow', name: '❄️ Snow', effect: 'ice_boost', battleBonus: 1.2 },
  { id: 'fog', name: '🌫️ Fog', effect: 'dark_boost', battleBonus: 1.15 },
  { id: 'wind', name: '💨 Windy', effect: 'wind_boost', battleBonus: 1.2 },
  { id: 'heat', name: '🔥 Heat Wave', effect: 'fire_boost', battleBonus: 1.25 },
  { id: 'aurora', name: '🌌 Aurora', effect: 'light_boost', battleBonus: 1.3 }
];

// Time of day
const TIME_OF_DAY = {
  MORNING: 'morning',
  DAY: 'day',
  EVENING: 'evening',
  NIGHT: 'night'
};

// Get current time of day
function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return TIME_OF_DAY.MORNING;
  if (hour >= 12 && hour < 17) return TIME_OF_DAY.DAY;
  if (hour >= 17 && hour < 20) return TIME_OF_DAY.EVENING;
  return TIME_OF_DAY.NIGHT;
}

// Get time bonus
function getTimeBonus() {
  const time = getTimeOfDay();
  switch (time) {
    case TIME_OF_DAY.MORNING: return { bonus: 1.1, description: 'Morning freshness!' };
    case TIME_OF_DAY.DAY: return { bonus: 1.0, description: 'Normal day' };
    case TIME_OF_DAY.EVENING: return { bonus: 1.15, description: 'Evening energy!' };
    case TIME_OF_DAY.NIGHT: return { bonus: 1.3, description: 'Night power!' };
    default: return { bonus: 1.0, description: 'Normal' };
  }
}

// Get random weather for a region
function getRandomWeather(regionId) {
  const region = REGIONS.find(r => r.id === regionId);
  if (!region) return WEATHER_TYPES[0];
  
  // Some regions have weather preferences
  let weatherPool = [...WEATHER_TYPES];
  
  if (regionId === 'ice' || regionId === 'volcano') {
    weatherPool = weatherPool.filter(w => w.id === 'snow' || w.id === 'clear' || w.id === 'heat');
  } else if (regionId === 'ocean') {
    weatherPool = weatherPool.filter(w => w.id === 'rain' || w.id === 'storm' || w.id === 'fog');
  } else if (regionId === 'desert') {
    weatherPool = weatherPool.filter(w => w.id === 'clear' || w.id === 'heat');
  }
  
  return weatherPool[Math.floor(Math.random() * weatherPool.length)];
}

// Get available regions for player level
async function getAvailableRegions(playerLevel) {
  return REGIONS.filter(region => playerLevel >= region.minLevel);
}

// Get region by ID
function getRegion(regionId) {
  return REGIONS.find(r => r.id === regionId);
}

// Explore region
async function exploreRegion(userId, regionId) {
  const player = await getPlayer(userId);
  const region = getRegion(regionId);
  
  if (!region) {
    return { success: false, message: 'Region not found!' };
  }
  
  if (player.level < region.minLevel) {
    return { success: false, message: `You need to be level ${region.minLevel} to explore this region!` };
  }
  
  // Cost energy to explore
  const canExplore = await spendEnergy(userId, 5);
  if (!canExplore) {
    return { success: false, message: 'Not enough energy! (Cost: 5)' };
  }
  
  // Get random monster from region
  const monsterId = region.monsters[Math.floor(Math.random() * region.monsters.length)];
  const monster = await getRandomMonster();
  
  // Get current weather and time
  const weather = getRandomWeather(regionId);
  const timeBonus = getTimeBonus();
  
  // Calculate rewards with bonuses
  const baseXP = 50 + (player.level * 2);
  const baseGold = 25 + player.level;
  const weatherMultiplier = weather.battleBonus;
  const timeMultiplier = timeBonus.bonus;
  
  const xpGained = Math.floor(baseXP * weatherMultiplier * timeMultiplier);
  const goldGained = Math.floor(baseGold * weatherMultiplier);
  
  // Award rewards
  await addXP(userId, xpGained);
  await addGold(userId, goldGained);
  
  // Small chance to find gems
  const gemChance = 0.1 + (weather.id === 'aurora' ? 0.2 : 0);
  if (Math.random() < gemChance) {
    await addGems(userId, 1);
  }
  
  return {
    success: true,
    region: region.name,
    weather: weather.name,
    timeOfDay: timeBonus.description,
    monster: monster ? monster.name : 'Unknown',
    xpGained,
    goldGained,
    foundGem: Math.random() < gemChance
  };
}

// Get world status
async function getWorldStatus(userId) {
  const player = await getPlayer(userId);
  const timeOfDay = getTimeOfDay();
  const timeBonus = getTimeBonus();
  const availableRegions = await getAvailableRegions(player.level);
  
  // Get current weather for each region (simplified - in production, store this in DB)
  const regionsWithWeather = availableRegions.map(region => ({
    ...region,
    weather: getRandomWeather(region.id)
  }));
  
  return {
    timeOfDay: timeOfDay,
    timeBonus: timeBonus.description,
    playerLevel: player.level,
    availableRegions: regionsWithWeather
  };
}

// Get daily dungeon
async function getDailyDungeon() {
  const today = new Date().toISOString().split('T')[0];
  const dungeon = await get(require('./db').monsterDb,
    `SELECT * FROM daily_dungeon WHERE date = ?`,
    [today]
  );
  
  if (!dungeon) {
    // Generate new daily dungeon
    const dungeonId = `dungeon_${Date.now()}`;
    const region = REGIONS[Math.floor(Math.random() * REGIONS.length)];
    const monster = await getRandomMonster();
    
    const dungeonData = {
      dungeonId,
      name: `Daily: ${region.name}`,
      regionId: region.id,
      monsterId: monster.id,
      difficulty: 1 + Math.floor(Math.random() * 3),
      rewards: { xp: 200, gold: 100, gems: 5 }
    };
    
    await run(require('./db').monsterDb,
      `INSERT INTO daily_dungeon (dungeonId, date, name, regionId, monsterId, difficulty, rewards)
       VALUES(?, ?, ?, ?, ?, ?, ?)`,
      [dungeonId, today, dungeonData.name, region.id, monster.id, dungeonData.difficulty, JSON.stringify(dungeonData.rewards)]
    );
    
    return dungeonData;
  }
  
  return {
    dungeonId: dungeon.dungeonId,
    name: dungeon.name,
    regionId: dungeon.regionId,
    monsterId: dungeon.monsterId,
    difficulty: dungeon.difficulty,
    rewards: JSON.parse(dungeon.rewards)
  };
}

module.exports = {
  REGIONS,
  WEATHER_TYPES,
  TIME_OF_DAY,
  getTimeOfDay,
  getTimeBonus,
  getRandomWeather,
  getAvailableRegions,
  getRegion,
  exploreRegion,
  getWorldStatus,
  getDailyDungeon
};