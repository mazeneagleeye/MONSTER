const { get, run, all } = require('./db');

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

// Generate 500+ monsters
function generateMonsters() {
  const monsters = [];
  const prefixes = ['Dark', 'Light', 'Shadow', 'Crystal', 'Ancient', 'Young', 'Elder', 'Wild', 'Tamed', 'Feral', 'Cosmic', 'Earthly'];
  const suffixes = ['Lord', 'King', 'Queen', 'Knight', 'Mage', 'Rogue', 'Warrior', 'Guardian', 'Spirit', 'Wraith', 'Phoenix', 'Dragon'];
  const baseNames = [
    'Slime', 'Goblin', 'Orc', 'Troll', 'Ogre', 'Wolf', 'Bat', 'Spider', 'Snake', 'Eagle',
    'Bear', 'Lion', 'Tiger', 'Shark', 'Octopus', 'Scorpion', 'Crab', 'Frog', 'Turtle', 'Phoenix',
    'Dragon', 'Wyvern', 'Hydra', 'Golem', 'Golem', 'Wraith', 'Ghost', 'Skeleton', 'Zombie', 'Vampire',
    'Werewolf', 'Chimera', 'Manticore', 'Griffin', 'Unicorn', 'Pegasus', 'Kraken', 'Leviathan', 'Behemoth', 'Titan',
    'Goblin', 'Hobgoblin', 'Bugbear', 'Kobold', 'Gnoll', 'Ogre', 'Ettin', 'Cyclops', 'Giant', 'Troll'
  ];

  let id = 1;
  
  // Generate base monsters
  for (let i = 0; i < 500 && id <= 520; i++) {
    const baseName = baseNames[i % baseNames.length];
    const prefix = prefixes[Math.floor(i / baseNames.length) % prefixes.length];
    const suffix = suffixes[Math.floor(i / (baseNames.length * prefixes.length)) % suffixes.length];
    
    const rarityIndex = Math.min(Math.floor(i / 100), 5);
    const rarity = RARITIES[rarityIndex];
    const element = ELEMENTS[i % ELEMENTS.length];
    const type = TYPES[i % TYPES.length];
    
    const baseHp = 10 + (i * 2);
    const baseAttack = 5 + i;
    const baseDefense = 3 + Math.floor(i / 2);
    const baseSpeed = 5 + (i % 20);
    
    monsters.push({
      id: `monster_${id}`,
      name: `${prefix} ${baseName} ${suffix}`.trim(),
      element,
      type,
      rarity: rarity.name,
      rarityMultiplier: rarity.multiplier,
      baseHp,
      baseAttack,
      baseDefense,
      baseSpeed,
      skills: generateSkills(i),
      evolution: i % 10 === 0 ? `monster_${id + 1}` : null
    });
    
    id++;
  }

  return monsters;
}

function generateSkills(seed) {
  const allSkills = [
    'Fire Breath', 'Water Blast', 'Earthquake', 'Thunder Strike', 'Dark Pulse', 'Holy Light',
    'Wind Slash', 'Ice Shard', 'Poison Cloud', 'Psychic Wave', 'Heal', 'Shield',
    'Berserk', 'Steal', 'Counter', 'Dodge', 'Critical Hit', 'Life Drain',
    'Fire Shield', 'Water Healing', 'Stone Skin', 'Electric Speed', 'Dark Stealth', 'Light Blessing'
  ];
  
  const numSkills = 1 + (seed % 4);
  const skills = [];
  
  for (let i = 0; i < numSkills; i++) {
    const skillIndex = (seed + i) % allSkills.length;
    skills.push({
      name: allSkills[skillIndex],
      level: 1 + (seed % 5),
      damage: 10 + (seed * 2)
    });
  }
  
  return skills;
}

async function initMonsters() {
  const monsters = generateMonsters();
  
  for (const monster of monsters) {
    await run(
      require('./db').monsterDb,
      `INSERT OR REPLACE INTO monsters (id, name, element, type, rarity, rarityMultiplier, baseHp, baseAttack, baseDefense, baseSpeed, skills, evolution)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        monster.id,
        monster.name,
        monster.element,
        monster.type,
        monster.rarity,
        monster.rarityMultiplier,
        monster.baseHp,
        monster.baseAttack,
        monster.baseDefense,
        monster.baseSpeed,
        JSON.stringify(monster.skills),
        monster.evolution
      ]
    );
  }
}

async function getMonster(monsterId) {
  const row = await get(require('./db').monsterDb, 
    `SELECT * FROM monsters WHERE id = ?`, 
    [monsterId]
  );
  return row;
}

async function getAllMonsters() {
  const rows = await all(require('./db').monsterDb, 
    `SELECT * FROM monsters ORDER BY rarityMultiplier DESC, id ASC`
  );
  return rows.map(row => ({
    ...row,
    skills: JSON.parse(row.skills || '[]')
  }));
}

async function getMonstersByRarity(rarity) {
  const rows = await all(require('./db').monsterDb,
    `SELECT * FROM monsters WHERE rarity = ? ORDER BY id ASC`,
    [rarity]
  );
  return rows.map(row => ({
    ...row,
    skills: JSON.parse(row.skills || '[]')
  }));
}

async function getRandomMonster(rarity = null) {
  let query = `SELECT * FROM monsters`;
  const params = [];
  
  if (rarity) {
    query += ` WHERE rarity = ?`;
    params.push(rarity);
  }
  
  query += ` ORDER BY RANDOM() LIMIT 1`;
  
  const row = await get(require('./db').monsterDb, query, params);
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
    require('./db').playersDb,
    `INSERT INTO player_monsters (id, userId, monsterId, nickname, level, xp, happiness, hunger, loyalty, personality, battles, wins, skills, equipment, createdAt, lastInteract)
     VALUES(?, ?, ?, ?, 1, 0, 100, 0, 50, ?, 0, 0, ?, '{}', ?, ?)`,
    [
      monsterInstanceId,
      userId,
      monsterId,
      monster.name,
      personality,
      JSON.stringify(monster.skills),
      now,
      now
    ]
  );
  
  // Add to player's collection
  const player = await require('./players').getPlayer(userId);
  const collection = JSON.parse(player.monsterCollection || '[]');
  collection.push(monsterInstanceId);
  
  await run(require('./db').playersDb,
    `UPDATE players SET monsterCollection = ? WHERE userId = ?`,
    [JSON.stringify(collection), userId]
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
  const row = await get(require('./db').playersDb,
    `SELECT * FROM player_monsters WHERE id = ?`,
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
  const rows = await all(require('./db').playersDb,
    `SELECT * FROM player_monsters WHERE userId = ?`,
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
  
  await run(require('./db').playersDb,
    `UPDATE player_monsters SET happiness = ?, hunger = ?, loyalty = ?, lastInteract = ? WHERE id = ?`,
    [newHappiness, newHunger, newLoyalty, Date.now(), monsterInstanceId]
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

module.exports = {
  ELEMENTS,
  RARITIES,
  TYPES,
  PERSONALITIES,
  generateMonsters,
  initMonsters,
  getMonster,
  getAllMonsters,
  getMonstersByRarity,
  getRandomMonster,
  createPlayerMonster,
  getPlayerMonster,
  getPlayerMonsters,
  interactWithMonster,
  getPersonalityReaction
};