const { get, run, all } = require('./db-adapter');
const { getPlayer } = require('./players');
const { MONSTER_CATALOG } = require('./monsters-catalog');
const path = require('path');

// Monster elements
const ELEMENTS = ['Fire', 'Water', 'Earth', 'Electric', 'Dark', 'Light', 'Wind', 'Ice', 'Poison', 'Psychic'];

// Monster rarities
const RARITIES = [
  { name: 'Common', multiplier: 1, color: 0x95a5a6 },
  { name: 'Uncommon', multiplier: 1.5, color: 0x27ae60 },
  { name: 'Rare', multiplier: 2, color: 0x3498db },
  { name: 'Epic', multiplier: 3, color: 0x9b59b6 },
  { name: 'Legendary', multiplier: 5, color: 0xf39c12 },
  { name: 'Mythic', multiplier: 10, color: 0xe74c3c }
];

// Monster types
const TYPES = ['Beast', 'Dragon', 'Undead', 'Elemental', 'Machine', 'Spirit', 'Demon', 'Angel', 'Plant', 'Aquatic'];

// Monster personalities for AI system
const PERSONALITIES = [
  'brave', 'shy', 'playful', 'lazy', 'aggressive', 'curious', 
  'loyal', 'rebellious', 'wise', 'clumsy', 'proud', 'humble'
];

function getMonsterImageName(monsterId, monsterName) {
  // Convert monster ID or name to image filename
  const imageMap = {
    // Fire Element
    'fire_001': 'ember_sprite',
    'fire_002': 'flame_wisp',
    'fire_003': 'inferno_drake',
    // Water Element
    'water_001': 'droplet_fairy',
    'water_002': 'wave_spirit',
    'water_003': 'leviathan',
    // Earth Element
    'earth_001': 'pebble_golem',
    'earth_002': 'boulder_guardian',
    // Electric Element
    'electric_001': 'spark_bug',
    'electric_002': 'thunder_hawk',
    // Wind Element
    'wind_001': 'breeze_fairy',
    'wind_002': 'storm_eagle',
    // Ice Element
    'ice_001': 'snowflake_spirit',
    'ice_002': 'frost_wyrm',
    // Dark Element
    'dark_001': 'shadow_imp',
    'dark_002': 'nightmare_stalker',
    // Light Element
    'light_001': 'sparkle_pixie',
    'light_002': 'celestial_seraph',
    // Poison Element
    'poison_001': 'toxic_slime',
    'poison_002': 'venom_hydra',
    // Psychic Element
    'psychic_001': 'mind_moth',
    'psychic_002': 'astral_dragon',
    // Additional monsters
    'beast_001': 'forest_wolf',
    'undead_001': 'skeleton_knight',
    'plant_001': 'vine_whip',
    'machine_001': 'clockwork_beetle',
    'dragon_001': 'dragon_whelp',
    'dragon_002': 'adult_dragon',
    'dragon_003': 'ancient_dragon',
    'goblin_001': 'goblin_scout',
    'orc_001': 'orc_warrior',
    'slime_001': 'gelatinous_slime',
    'troll_001': 'cave_troll',
    'phantom_001': 'wraith',
    'holy_001': 'unicorn_foal',
    'titan_001': 'stone_titan'
  };

  return imageMap[monsterId] || monsterName.toLowerCase().replace(/\s+/g, '_');
}

function getMonsterImagePath(monsterId, monsterName) {
  const imageName = getMonsterImageName(monsterId, monsterName);
  return path.join(__dirname, '..', 'images', `${imageName}.png`);
}

function buildMonsterProfile(monster, owner = {}) {
  const baseStats = {
    hp: Number(monster.baseHp || 50),
    attack: Number(monster.baseAttack || 20),
    defense: Number(monster.baseDefense || 15),
    speed: Number(monster.baseSpeed || 20),
    critRate: Number(monster.critRate || 0.08),
    critDamage: Number(monster.critDamage || 1.5),
    accuracy: Number(monster.accuracy || 0.95),
    dodge: Number(monster.dodge || 0.05)
  };

  const imagePath = getMonsterImagePath(monster.id, monster.name);

  return {
    id: monster.id,
    name: monster.name,
    description: monster.description || 'A mysterious monster from the wild.',
    lore: monster.lore || 'No lore has been recorded yet.',
    element: monster.element,
    rarity: monster.rarity,
    type: monster.type,
    stats: baseStats,
    skills: Array.isArray(monster.skills) ? monster.skills : [],
    evolution: monster.evolution || null,
    region: monster.region || 'Unknown',
    favoriteFood: monster.favoriteFood || 'Mystery meal',
    personality: owner.personality || 'neutral',
    needs: {
      hunger: Number(owner.hunger ?? 0),
      happiness: Number(owner.happiness ?? 100),
      loyalty: Number(owner.loyalty ?? 50),
      energy: Number(owner.energy ?? 100)
    },
    equipment: owner.equipment || { weapon: null, armor: null, accessory: null, relic: null },
    skin: owner.skin || 'default',
    evolutionStage: Number(owner.evolutionStage ?? monster.evolutionStage ?? 1),
    imagePath: imagePath
  };
}

function getMonsterEvolutionChain(monster, catalog = {}) {
  const chain = [];
  let current = monster;

  while (current) {
    chain.push(current);
    if (!current.evolution) break;
    current = catalog[current.evolution] || null;
  }

  return chain;
}

async function summonMonsterForUser(userId, summonType = 'gold') {
  const player = await getPlayer(userId);
  const summonConfig = {
    gold: { cost: 100, costType: 'gold', rarityBias: 0.2 },
    gem: { cost: 10, costType: 'gems', rarityBias: 0.45 },
    event: { cost: 0, costType: 'none', rarityBias: 0.7 },
    beginner: { cost: 0, costType: 'none', rarityBias: 0.1 }
  }[summonType] || { cost: 100, costType: 'gold', rarityBias: 0.2 };

  if (summonConfig.costType === 'gold' && player.gold < summonConfig.cost) {
    return { success: false, message: 'You need 100 gold to summon a monster.' };
  }
  if (summonConfig.costType === 'gems' && player.gems < summonConfig.cost) {
    return { success: false, message: 'You need 10 gems to summon a monster.' };
  }

  let rarity = 'Common';
  if (summonType === 'beginner') {
    rarity = 'Common';
  } else {
    const roll = Math.random();
    if (roll < 0.05) rarity = 'Mythic';
    else if (roll < 0.15 + summonConfig.rarityBias) rarity = 'Legendary';
    else if (roll < 0.35 + summonConfig.rarityBias) rarity = 'Epic';
    else if (roll < 0.6 + summonConfig.rarityBias) rarity = 'Rare';
    else if (roll < 0.85 + summonConfig.rarityBias) rarity = 'Uncommon';
  }

  const monster = await getRandomMonster(rarity);
  if (!monster) {
    return { success: false, message: 'Failed to summon a monster. Try again.' };
  }

  if (summonConfig.costType === 'gold') {
    const { spendGold } = require('./players');
    await spendGold(userId, summonConfig.cost);
  } else if (summonConfig.costType === 'gems') {
    const { spendGems } = require('./players');
    await spendGems(userId, summonConfig.cost);
  }

  const playerMonster = await createPlayerMonster(userId, monster.id);
  const profile = buildMonsterProfile(playerMonster.monsterData || monster, playerMonster);

  return { success: true, monster, playerMonster, profile };
}

async function setMonsterFavorite(monsterInstanceId) {
  const monster = await getPlayerMonster(monsterInstanceId);
  if (!monster) return null;
  const nextValue = monster.isFavorite ? 0 : 1;
  await run(require('./db-adapter').getPlayersDb(),
    { id: monsterInstanceId },
    { $set: { isFavorite: nextValue } }
  );
  return { isFavorite: nextValue };
}

async function renameMonster(monsterInstanceId, nickname) {
  const monster = await getPlayerMonster(monsterInstanceId);
  if (!monster) return null;
  const trimmed = nickname.trim();
  await run(require('./db-adapter').getPlayersDb(),
    { id: monsterInstanceId },
    { $set: { nickname: trimmed || monster.monsterData.name } }
  );
  return { nickname: trimmed || monster.monsterData.name };
}

async function setActiveMonster(userId, monsterInstanceId) {
  const monster = await getPlayerMonster(monsterInstanceId);
  if (!monster) return null;
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $set: { activeMonster: monsterInstanceId } }
  );
  return monster;
}

// Initialize monsters from curated catalog
async function initMonsters() {
  // Clear existing monsters
  await run(require('./db-adapter').getMonsterDb(), {}, { $all: true });
  
  for (const monster of MONSTER_CATALOG) {
    const rarity = RARITIES.find(r => r.name === monster.rarity) || RARITIES[0];
    
    await run(
      require('./db-adapter').getMonsterDb(),
      {
        id: monster.id,
        name: monster.name,
        description: monster.description || '',
        lore: monster.lore || '',
        element: monster.element,
        type: monster.type,
        rarity: monster.rarity,
        rarityMultiplier: rarity.multiplier,
        baseHp: monster.baseHp,
        baseAttack: monster.baseAttack,
        baseDefense: monster.baseDefense,
        baseSpeed: monster.baseSpeed,
        critRate: monster.critRate || 0.05,
        critDamage: monster.critDamage || 1.5,
        skills: JSON.stringify(monster.skills || []),
        evolution: monster.evolution || null,
        region: monster.region || 'Unknown',
        favoriteFood: monster.favoriteFood || 'Mystery meal',
        evolutionStage: monster.evolutionStage || 1
      }
    );
  }
}

async function getMonster(monsterId) {
  const row = await get(require('./db-adapter').getMonsterDb(), 
    { id: monsterId }
  );
  if (row) {
    row.skills = JSON.parse(row.skills || '[]');
  }
  return row;
}

async function getAllMonsters() {
  const rows = await all(require('./db-adapter').getMonsterDb(), 
    {}
  );
  return rows.map(row => ({
    ...row,
    skills: JSON.parse(row.skills || '[]')
  }));
}

async function getMonstersByRarity(rarity) {
  const rows = await all(require('./db-adapter').getMonsterDb(),
    { rarity: rarity }
  );
  return rows.map(row => ({
    ...row,
    skills: JSON.parse(row.skills || '[]')
  }));
}

async function getRandomMonster(rarity = null) {
  const rows = await all(require('./db-adapter').getMonsterDb(), 
    rarity ? { rarity: rarity } : {}
  );
  
  if (rows.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * rows.length);
  const row = rows[randomIndex];
  
  if (row) {
    row.skills = JSON.parse(row.skills || '[]');
  }
  return row;
}

async function createPlayerMonster(userId, monsterId) {
  const monster = await getMonster(monsterId);
  if (!monster) return null;
  
  const monsterInstanceId = `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
  const now = Date.now();
  
  await run(
    require('./db-adapter').getPlayersDb(),
    {
      id: monsterInstanceId,
      userId: userId,
      monsterId: monsterId,
      nickname: monster.name,
      level: 1,
      xp: 0,
      happiness: 100,
      hunger: 0,
      loyalty: 50,
      personality: personality,
      battles: 0,
      wins: 0,
      skills: JSON.stringify(monster.skills),
      equipment: '{}',
      createdAt: now,
      lastInteract: now,
      statistics: '{}',
      evolutionStage: 1
    }
  );
  
  // Add to player's collection
  const player = await require('./players').getPlayer(userId);
  const collection = JSON.parse(player.monsterCollection || '[]');
  collection.push(monsterInstanceId);
  
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $set: { monsterCollection: JSON.stringify(collection) } }
  );
  
  return {
    id: monsterInstanceId,
    userId,
    monsterId,
    nickname: monster.name,
    level: 1,
    xp: 0,
    happiness: 100,
    hunger: 0,
    loyalty: 50,
    personality,
    battles: 0,
    wins: 0,
    skills: monster.skills,
    equipment: {},
    createdAt: now,
    lastInteract: now,
    monsterData: monster
  };
}

async function getPlayerMonster(monsterInstanceId) {
  const row = await get(require('./db-adapter').getPlayersDb(),
    'SELECT * FROM player_monsters WHERE id = ?',
    [monsterInstanceId]
  );
  
  if (!row) return null;
  
  const monster = await getMonster(row.monsterId);
  
  return {
    ...row,
    skills: JSON.parse(row.skills || '[]'),
    equipment: JSON.parse(row.equipment || '{}'),
    monsterData: monster
  };
}

async function getPlayerMonsters(userId) {
  const rows = await all(require('./db-adapter').getPlayersDb(),
    'SELECT * FROM player_monsters WHERE userId = ?',
    [userId]
  );
  
  const monsters = [];
  for (const row of rows) {
    const monster = await getMonster(row.monsterId);
    monsters.push({
      ...row,
      skills: JSON.parse(row.skills || '[]'),
      equipment: JSON.parse(row.equipment || '{}'),
      monsterData: monster
    });
  }
  
  return monsters;
}

async function interactWithMonster(monsterInstanceId, interactionType) {
  const monster = await getPlayerMonster(monsterInstanceId);
  if (!monster) return null;
  
  let happinessChange = 0;
  let hungerChange = 0;
  let loyaltyChange = 0;
  let message = '';
  
  switch (interactionType) {
    case 'feed':
      happinessChange = 10;
      hungerChange = -20;
      loyaltyChange = 5;
      message = getPersonalityReaction(monster.personality, 'feed', monster.happiness);
      break;
    case 'play':
      happinessChange = 15;
      hungerChange = 10;
      loyaltyChange = 8;
      message = getPersonalityReaction(monster.personality, 'play', monster.happiness);
      break;
    case 'train':
      happinessChange = -5;
      hungerChange = 15;
      loyaltyChange = 10;
      message = getPersonalityReaction(monster.personality, 'train', monster.happiness);
      break;
    case 'pet':
      happinessChange = 5;
      loyaltyChange = 3;
      message = getPersonalityReaction(monster.personality, 'pet', monster.happiness);
      break;
  }
  
  const newHappiness = Math.min(100, Math.max(0, monster.happiness + happinessChange));
  const newHunger = Math.min(100, Math.max(0, monster.hunger + hungerChange));
  const newLoyalty = Math.min(100, Math.max(0, monster.loyalty + loyaltyChange));
  
  await run(require('./db-adapter').getPlayersDb(),
    { id: monsterInstanceId },
    { $set: { happiness: newHappiness, hunger: newHunger, loyalty: newLoyalty, lastInteract: Date.now() } }
  );
  
  return {
    happiness: newHappiness,
    hunger: newHunger,
    loyalty: newLoyalty,
    message
  };
}

function getPersonalityReaction(personality, action, happiness) {
  const reactions = {
    brave: {
      feed: happiness > 70 ? "Takes the food proudly!" : "Eats quickly, ready for action!",
      play: "Charges into the game with enthusiasm!",
      train: "Gets stronger with each session!",
      pet: "Stands tall, accepting the affection."
    },
    shy: {
      feed: happiness > 70 ? "Takes the food quietly." : "Hides behind you while eating.",
      play: "Plays hesitantly at first, then gets into it.",
      train: "Tries hard despite being nervous.",
      pet: "Nuzzles your hand gently."
    },
    playful: {
      feed: "Bounces around excitedly before eating!",
      play: "Full of energy and joy!",
      train: "Treats training like a game!",
      pet: "Wags tail and wants to play more!"
    },
    lazy: {
      feed: "Groans but eventually eats.",
      play: "Would rather sleep...",
      train: "Moves slowly through the exercises.",
      pet: "Too tired to react much."
    },
    aggressive: {
      feed: "Snatches the food aggressively!",
      play: "Plays too rough!",
      train: "Attacks the training equipment!",
      pet: "Growls but doesn't pull away."
    },
    curious: {
      feed: "Sniffs the food curiously before eating.",
      play: "Explores every part of the game!",
      train: "Asks lots of questions (in monster language).",
      pet: "Tilts head, wondering what you're doing."
    },
    loyal: {
      feed: "Eats gratefully, looking at you.",
      play: "Plays but keeps an eye on you.",
      train: "Gives their all for you!",
      pet: "Loyal as ever, always by your side."
    },
    rebellious: {
      feed: happiness > 50 ? "Takes the food." : "Knocks it away!",
      play: "Does what they want, not what you want.",
      train: "Refuses to follow orders.",
      pet: "Pulls away stubbornly."
    },
    wise: {
      feed: "Eats mindfully.",
      play: "Plays strategically.",
      train: "Learns quickly and efficiently.",
      pet: "Nods knowingly."
    },
    clumsy: {
      feed: "Trips over their own feet!",
      play: "Accidentally ruins the game.",
      train: "Keeps making mistakes.",
      pet: "Leans in too hard and falls over."
    },
    proud: {
      feed: "Deigns to accept your offering.",
      play: "Only plays if they can win.",
      train: "Only trains if they're the best.",
      pet: "Allows it, but doesn't show emotion."
    },
    humble: {
      feed: "Thanks you humbly.",
      play: "Lets others win.",
      train: "Trains hard without complaint.",
      pet: "Appreciates the attention greatly."
    }
  };
  
  return reactions[personality]?.[action] || "The monster seems happy!";
}

async function addMonsterXP(monsterInstanceId, xp) {
  const monster = await getPlayerMonster(monsterInstanceId);
  if (!monster) return;
  
  let { level, xp: currentXp } = monster;
  currentXp += xp;
  
  const xpNeeded = level * 100;
  let leveledUp = false;
  
  while (currentXp >= xpNeeded && level < 100) {
    currentXp -= xpNeeded;
    level += 1;
    leveledUp = true;
  }
  
  await run(require('./db-adapter').getPlayersDb(),
    { id: monsterInstanceId },
    { $set: { level, xp: currentXp } }
  );
  
  return { leveledUp, newLevel: level };
}

async function evolveMonster(monsterInstanceId) {
  const monster = await getPlayerMonster(monsterInstanceId);
  if (!monster) return { success: false, message: 'Monster not found!' };
  
  if (!monster.monsterData.evolution) {
    return { success: false, message: 'This monster cannot evolve!' };
  }
  
  const currentStage = monster.evolutionStage || 1;
  const nextEvolutionId = monster.monsterData.evolution;
  
  const nextMonster = await getMonster(nextEvolutionId);
  if (!nextMonster) {
    return { success: false, message: 'Evolution data not found!' };
  }
  
  if (monster.level < 10) {
    return { success: false, message: `Monster must be at least level 10 to evolve! (Current: ${monster.level})` };
  }
  
  await run(require('./db-adapter').getPlayersDb(),
    { id: monsterInstanceId },
    { $set: { monsterId: nextMonster.id, evolutionStage: currentStage + 1 } }
  );
  
  const evolvedMonster = await getPlayerMonster(monsterInstanceId);
  
  return {
    success: true,
    message: `Your ${monster.nickname || monster.monsterData.name} evolved into ${nextMonster.name}!`,
    monster: evolvedMonster
  };
}

async function equipMonsterItem(monsterInstanceId, itemId, slot) {
  const monster = await getPlayerMonster(monsterInstanceId);
  if (!monster) return { success: false, message: 'Monster not found!' };
  
  const validSlots = ['weapon', 'armor', 'accessory', 'relic'];
  if (!validSlots.includes(slot)) {
    return { success: false, message: 'Invalid equipment slot!' };
  }
  
  const equipment = monster.equipment || {};
  equipment[slot] = itemId;
  
  await run(require('./db-adapter').getPlayersDb(),
    { id: monsterInstanceId },
    { $set: { equipment: JSON.stringify(equipment) } }
  );
  
  return { success: true, message: `Equipped ${slot} for ${monster.nickname || monster.monsterData.name}!` };
}

async function unequipMonsterItem(monsterInstanceId, slot) {
  const monster = await getPlayerMonster(monsterInstanceId);
  if (!monster) return { success: false, message: 'Monster not found!' };
  
  const equipment = monster.equipment || {};
  if (!equipment[slot]) {
    return { success: false, message: 'No item equipped in this slot!' };
  }
  
  delete equipment[slot];
  
  await run(require('./db-adapter').getPlayersDb(),
    { id: monsterInstanceId },
    { $set: { equipment: JSON.stringify(equipment) } }
  );
  
  return { success: true, message: `Unequipped ${slot}!` };
}

async function setMonsterSkin(monsterInstanceId, skinName) {
  const monster = await getPlayerMonster(monsterInstanceId);
  if (!monster) return { success: false, message: 'Monster not found!' };
  
  const validSkins = ['default', 'halloween', 'christmas', 'summer', 'anniversary', 'golden', 'shadow'];
  if (!validSkins.includes(skinName)) {
    return { success: false, message: 'Invalid skin!' };
  }
  
  await run(require('./db-adapter').getPlayersDb(),
    { id: monsterInstanceId },
    { $set: { skin: skinName } }
  );
  
  return { success: true, message: `Applied ${skinName} skin to ${monster.nickname || monster.monsterData.name}!` };
}

async function getMonsterStatistics(monsterInstanceId) {
  const monster = await getPlayerMonster(monsterInstanceId);
  if (!monster) return null;
  
  const statistics = JSON.parse(monster.statistics || '{}');
  
  return {
    battlesWon: monster.wins || 0,
    battlesLost: (monster.battles || 0) - (monster.wins || 0),
    totalBattles: monster.battles || 0,
    damageDealt: statistics.damageDealt || 0,
    bossKills: statistics.bossKills || 0,
    timeOwned: Date.now() - (monster.createdAt || Date.now()),
    favoriteFood: monster.monsterData?.favoriteFood || 'Unknown'
  };
}

module.exports = {
  ELEMENTS,
  RARITIES,
  TYPES,
  PERSONALITIES,
  buildMonsterProfile,
  getMonsterEvolutionChain,
  getMonsterImageName,
  getMonsterImagePath,
  initMonsters,
  getMonster,
  getAllMonsters,
  getMonstersByRarity,
  getRandomMonster,
  summonMonsterForUser,
  createPlayerMonster,
  getPlayerMonster,
  getPlayerMonsters,
  interactWithMonster,
  setMonsterFavorite,
  renameMonster,
  setActiveMonster,
  getPersonalityReaction,
  addMonsterXP,
  evolveMonster,
  equipMonsterItem,
  unequipMonsterItem,
  setMonsterSkin,
  getMonsterStatistics
};