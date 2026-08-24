const { get, run, all } = require('./db-adapter');
const { getPlayer, addXP, addGold, addGems, spendEnergy, updateEnergy, incrementStatistic } = require('./players');
const { getPlayerMonster, getPlayerMonsters, addMonsterXP } = require('./monsters');
const { getMonster } = require('./monsters');

// Battle types
const BATTLE_TYPES = {
  PVE: 'pve',
  PVP: 'pvp',
  BOSS: 'boss',
  WORLD_BOSS: 'world_boss',
  GUILD_BOSS: 'guild_boss',
  TOWER: 'tower',
  SURVIVAL: 'survival',
  DUNGEON: 'dungeon'
};

// Difficulty levels
const DIFFICULTIES = {
  easy: { multiplier: 0.7, name: 'Easy', color: 0x27ae60 },
  normal: { multiplier: 1.0, name: 'Normal', color: 0x3498db },
  hard: { multiplier: 1.5, name: 'Hard', color: 0xf39c12 },
  nightmare: { multiplier: 2.0, name: 'Nightmare', color: 0xe74c3c },
  mythic: { multiplier: 3.0, name: 'Mythic', color: 0x9b59b6 }
};

// Status Effects
const STATUS_EFFECTS = {
  burn: { name: 'Burn', emoji: '🔥', damage: 5, duration: 3, description: 'Takes damage each turn' },
  freeze: { name: 'Freeze', emoji: '❄️', skipTurn: true, duration: 1, description: 'Skips next turn' },
  poison: { name: 'Poison', emoji: '☠️', damage: 3, duration: 4, description: 'Takes damage each turn' },
  stun: { name: 'Stun', emoji: '⚡', skipTurn: true, duration: 1, description: 'Skips next turn' },
  sleep: { name: 'Sleep', emoji: '😴', skipTurn: true, duration: 2, description: 'Skips turns while asleep' },
  confusion: { name: 'Confusion', emoji: '🌀', selfHit: true, duration: 2, description: 'May attack self' },
  bleed: { name: 'Bleed', emoji: '💢', damage: 4, duration: 3, description: 'Takes damage each turn' },
  blind: { name: 'Blind', emoji: '🌫', accuracyReduction: 0.3, duration: 2, description: 'Reduced accuracy' }
};

// Battle rewards with difficulty scaling
const BATTLE_REWARDS = {
  pve: { xp: 50, gold: 25, gems: 1, monsterXp: 25 },
  boss: { xp: 200, gold: 100, gems: 5, monsterXp: 100 },
  world_boss: { xp: 500, gold: 250, gems: 15, monsterXp: 250 },
  guild_boss: { xp: 300, gold: 150, gems: 10, monsterXp: 150 },
  tower: { xp: 100, gold: 50, gems: 3, monsterXp: 50 },
  survival: { xp: 75, gold: 40, gems: 2, monsterXp: 37 },
  dungeon: { xp: 150, gold: 75, gems: 4, monsterXp: 75 }
};

async function calculateDamage(attacker, defender, skill = null) {
  const baseDamage = skill ? skill.damage : (attacker.monsterData?.baseAttack || attacker.baseAttack || 20);
  const attack = baseDamage * (1 + ((attacker.level || 1) * 0.1));
  const defense = (defender.monsterData?.baseDefense || defender.baseDefense || 15) * (1 + ((defender.level || 1) * 0.1));
  
  // Element effectiveness
  let elementMultiplier = 1;
  const attackerElement = attacker.monsterData?.element || attacker.element;
  const defenderElement = defender.monsterData?.element || defender.element;
  if (skill && attackerElement) {
    elementMultiplier = getElementEffectiveness(attackerElement, defenderElement);
  }
  
  // Critical hit
  const critRate = attacker.monsterData?.critRate || attacker.critRate || 0.05;
  const critDamage = attacker.monsterData?.critDamage || attacker.critDamage || 1.5;
  const isCrit = Math.random() < critRate;
  const critMultiplier = isCrit ? critDamage : 1;
  
  // Accuracy and Dodge
  const accuracy = attacker.monsterData?.accuracy || attacker.accuracy || 0.95;
  const dodge = defender.monsterData?.dodge || defender.dodge || 0.05;
  const hitChance = accuracy * (1 - dodge);
  const dodged = Math.random() > hitChance;
  
  if (dodged) {
    return { damage: 0, dodged: true, crit: false, missed: true };
  }
  
  const damage = Math.max(1, Math.floor((attack - defense / 2) * elementMultiplier * critMultiplier));
  
  return { damage, dodged: false, crit: isCrit, missed: false };
}

function getElementEffectiveness(attackerElement, defenderElement) {
  const effectiveness = {
    'Fire': { 'Water': 0.5, 'Ice': 2, 'Earth': 0.5, 'Fire': 0.5 },
    'Water': { 'Fire': 2, 'Electric': 0.5, 'Earth': 0.5, 'Water': 0.5 },
    'Earth': { 'Electric': 2, 'Fire': 2, 'Wind': 0.5, 'Earth': 0.5 },
    'Electric': { 'Water': 2, 'Earth': 0.5, 'Wind': 2, 'Electric': 0.5 },
    'Dark': { 'Light': 2, 'Psychic': 2, 'Dark': 0.5 },
    'Light': { 'Dark': 2, 'Psychic': 0.5, 'Light': 0.5 },
    'Wind': { 'Electric': 0.5, 'Earth': 0.5, 'Fire': 2, 'Wind': 0.5 },
    'Ice': { 'Fire': 0.5, 'Water': 2, 'Earth': 2, 'Ice': 0.5 },
    'Poison': { 'Earth': 2, 'Light': 0.5, 'Poison': 0.5 },
    'Psychic': { 'Dark': 0.5, 'Poison': 2, 'Psychic': 0.5 }
  };
  
  const multiplier = effectiveness[attackerElement]?.[defenderElement] || 1;
  return multiplier;
}

async function startBattle(userId, battleType, options = {}) {
  const player = await getPlayer(userId);
  const difficulty = options.difficulty || 'normal';
  const difficultyData = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  
  const energyCost = battleType === BATTLE_TYPES.BOSS ? 10 : 
                     battleType === BATTLE_TYPES.WORLD_BOSS ? 20 :
                     battleType === BATTLE_TYPES.PVP ? 5 : 3;
  
  const canBattle = await spendEnergy(userId, energyCost);
  if (!canBattle) {
    return { success: false, message: 'Not enough energy!' };
  }
  
  const activeMonsterId = player.activeMonster;
  if (!activeMonsterId || activeMonsterId === 'null') {
    return { success: false, message: 'No active monster! Set one with /monsters set-active' };
  }
  
  const playerMonster = await getPlayerMonster(activeMonsterId);
  if (!playerMonster) {
    return { success: false, message: 'Active monster not found!' };
  }
  
  let enemy;
  let rewards = { ...BATTLE_REWARDS[battleType] || BATTLE_REWARDS.pve };
  
  // Apply difficulty multiplier
  rewards.xp = Math.floor(rewards.xp * difficultyData.multiplier);
  rewards.gold = Math.floor(rewards.gold * difficultyData.multiplier);
  rewards.gems = Math.floor(rewards.gems * difficultyData.multiplier);
  rewards.monsterXp = Math.floor((rewards.monsterXp || 0) * difficultyData.multiplier);
  
  switch (battleType) {
    case BATTLE_TYPES.PVE:
      enemy = await getRandomEnemy(player.level, difficulty);
      break;
    case BATTLE_TYPES.BOSS:
      enemy = await getRandomBoss(player.level, difficulty);
      rewards.xp *= 2;
      break;
    case BATTLE_TYPES.WORLD_BOSS:
      enemy = await getWorldBoss();
      break;
    case BATTLE_TYPES.PVP:
      enemy = await getPVPEnemy(options.opponentId);
      if (!enemy) {
        await addEnergy(userId, energyCost);
        return { success: false, message: 'Opponent not found or invalid!' };
      }
      break;
    case BATTLE_TYPES.TOWER:
      enemy = await getTowerEnemy(options.floor || 1, difficulty);
      rewards.xp = Math.floor(rewards.xp * (options.floor || 1));
      break;
    case BATTLE_TYPES.SURVIVAL:
      enemy = await getRandomEnemy(player.level, difficulty);
      break;
    case BATTLE_TYPES.DUNGEON:
      enemy = await getDungeonEnemy(options.dungeonId, difficulty);
      break;
    default:
      enemy = await getRandomEnemy(player.level, difficulty);
  }
  
  if (!enemy) {
    await addEnergy(userId, energyCost);
    return { success: false, message: 'Could not find enemy!' };
  }
  
  // Battle simulation with status effects
  const battleLog = [];
  let playerHp = calculateHP(playerMonster);
  let enemyHp = calculateHP(enemy);
  let round = 1;
  
  // Status effect tracking
  let playerStatusEffects = [];
  let enemyStatusEffects = [];
  
  while (playerHp > 0 && enemyHp > 0 && round <= 100) {
    // Player turn - select random skill
    const playerSkills = playerMonster.skills || [];
    const playerSkill = playerSkills.length > 0 ? playerSkills[Math.floor(Math.random() * playerSkills.length)] : null;
    
    const playerTurnResult = await processTurn(playerMonster, enemy, playerStatusEffects, enemyStatusEffects, 'player', playerSkill);
    if (playerTurnResult.damage) {
      enemyHp -= playerTurnResult.damage;
    }
    if (playerTurnResult.statusApplied) {
      enemyStatusEffects.push(playerTurnResult.statusApplied);
    }
    battleLog.push({
      round,
      attacker: 'player',
      ...playerTurnResult
    });
    
    if (enemyHp <= 0) break;
    
    // Enemy turn - select random skill
    const enemySkills = enemy.skills || [];
    const enemySkill = enemySkills.length > 0 ? enemySkills[Math.floor(Math.random() * enemySkills.length)] : null;
    
    const enemyTurnResult = await processTurn(enemy, playerMonster, enemyStatusEffects, playerStatusEffects, 'enemy', enemySkill);
    if (enemyTurnResult.damage) {
      playerHp -= enemyTurnResult.damage;
    }
    if (enemyTurnResult.statusApplied) {
      playerStatusEffects.push(enemyTurnResult.statusApplied);
    }
    battleLog.push({
      round,
      attacker: 'enemy',
      ...enemyTurnResult
    });
    
    // Process status effect damage
    const playerStatusDamage = processStatusDamage(playerStatusEffects);
    const enemyStatusDamage = processStatusDamage(enemyStatusEffects);
    
    if (playerStatusDamage > 0) {
      playerHp -= playerStatusDamage;
      battleLog.push({
        round,
        attacker: 'status',
        target: 'player',
        damage: playerStatusDamage,
        message: `Player takes ${playerStatusDamage} damage from status effects`
      });
    }
    
    if (enemyStatusDamage > 0) {
      enemyHp -= enemyStatusDamage;
      battleLog.push({
        round,
        attacker: 'status',
        target: 'enemy',
        damage: enemyStatusDamage,
        message: `Enemy takes ${enemyStatusDamage} damage from status effects`
      });
    }
    
    // Decrement status effect durations
    playerStatusEffects = decrementStatusEffects(playerStatusEffects);
    enemyStatusEffects = decrementStatusEffects(enemyStatusEffects);
    
    round++;
  }
  
  const playerWon = playerHp > 0;
  
  // Calculate total damage dealt by player's monster
  let totalDamageDealt = 0;
  for (const log of battleLog) {
    if (log.attacker === 'player') {
      totalDamageDealt += log.damage || 0;
    }
  }
  
  // Award rewards
  if (playerWon) {
    await addXP(userId, rewards.xp);
    await addGold(userId, rewards.gold);
    await addGems(userId, rewards.gems);
    
    // Update battle statistics
    await incrementStatistic(userId, 'battlesWon', 1);
    if (battleType === BATTLE_TYPES.BOSS || battleType === BATTLE_TYPES.WORLD_BOSS) {
      await incrementStatistic(userId, 'bossKills', 1);
    }
    
    // Update monster stats
    const monsterStats = JSON.parse((await getPlayerMonster(activeMonsterId))?.statistics || '{}');
    const newDamageDealt = (monsterStats.damageDealt || 0) + totalDamageDealt;
    const newBossKills = (monsterStats.bossKills || 0) + (battleType === BATTLE_TYPES.BOSS || battleType === BATTLE_TYPES.WORLD_BOSS ? 1 : 0);
    
    await run(require('./db-adapter').getPlayersDb(),
      { id: activeMonsterId },
      { $set: { 
        battles: 1, 
        wins: 1, 
        lastInteract: Date.now(), 
        statistics: JSON.stringify({ ...monsterStats, damageDealt: newDamageDealt, bossKills: newBossKills }) 
      } }
    );
    
    // Monster gains XP
    if (rewards.monsterXp > 0) {
      await addMonsterXP(activeMonsterId, rewards.monsterXp);
    }
    
    // Track win streak
    const playerStats = await getStatistics(userId);
    const winStreak = (playerStats.winStreak || 0) + 1;
    await incrementStatistic(userId, 'winStreak', 1);
    if (winStreak > (playerStats.longestWinStreak || 0)) {
      await incrementStatistic(userId, 'longestWinStreak', winStreak - (playerStats.longestWinStreak || 0));
    }
  } else {
    // Reset win streak on loss
    const playerStats = await getStatistics(userId);
    await run(require('./db-adapter').getPlayersDb(),
      { userId: userId },
      { $set: { 'statistics.winStreak': 0 } }
    );
    
    const monsterStats = JSON.parse((await getPlayerMonster(activeMonsterId))?.statistics || '{}');
    const newDamageDealt = (monsterStats.damageDealt || 0) + totalDamageDealt;
    
    await run(require('./db-adapter').getPlayersDb(),
      { id: activeMonsterId },
      { $set: { 
        battles: 1, 
        lastInteract: Date.now(), 
        statistics: JSON.stringify({ ...monsterStats, damageDealt: newDamageDealt }) 
      } }
    );
  }
  
  // Track favorite monster
  await incrementStatistic(userId, 'totalBattles', 1);
  
  return {
    success: true,
    won: playerWon,
    battleLog,
    rewards: playerWon ? rewards : null,
    playerHp: Math.max(0, playerHp),
    enemyHp: Math.max(0, enemyHp),
    rounds: round,
    difficulty: difficultyData.name
  };
}

function calculateHP(monster) {
  const baseHp = monster.monsterData?.baseHp || monster.baseHp || 50;
  const level = monster.level || 1;
  return Math.floor(baseHp * (1 + (level * 0.2)));
}

async function processTurn(attacker, defender, attackerStatus, defenderStatus, turnType, forcedSkill = null) {
  // Check if attacker is stunned/frozen/asleep
  const skipTurn = attackerStatus.some(status => 
    STATUS_EFFECTS[status.type]?.skipTurn && status.duration > 0
  );
  
  if (skipTurn) {
    return {
      damage: 0,
      message: `${turnType === 'player' ? 'Your' : 'Enemy'} monster is ${attackerStatus.find(s => STATUS_EFFECTS[s.type]?.skipTurn)?.type || 'incapacitated'}!`,
      skipped: true
    };
  }
  
  // Check for confusion (may attack self)
  const confusion = attackerStatus.find(s => s.type === 'confusion');
  if (confusion && Math.random() < 0.3) {
    const selfDamage = Math.floor((attacker.monsterData?.baseAttack || attacker.baseAttack || 20) * 0.5);
    return {
      damage: selfDamage,
      message: `${turnType === 'player' ? 'Your' : 'Enemy'} monster is confused and hurt itself!`,
      confused: true
    };
  }
  
  // Select skill
  const skills = attacker.monsterData?.skills || attacker.skills || [];
  const skill = forcedSkill || (skills.length > 0 ? skills[Math.floor(Math.random() * skills.length)] : null);
  
  // Calculate damage
  const damageResult = await calculateDamage(attacker, defender, skill);
  
  // Apply status effect from skill
  let statusApplied = null;
  if (damageResult.damage > 0 && skill?.statusEffect && Math.random() < (skill.statusChance || 0.2)) {
    statusApplied = {
      type: skill.statusEffect,
      duration: STATUS_EFFECTS[skill.statusEffect]?.duration || 2,
      source: turnType
    };
  }
  
  // Build message
  let message = '';
  if (damageResult.missed) {
    message = `${turnType === 'player' ? 'Your' : 'Enemy'} attack missed!`;
  } else if (damageResult.damage === 0) {
    message = `${turnType === 'player' ? 'Enemy' : 'Your'} monster dodged!`;
  } else {
    message = damageResult.crit 
      ? `${turnType === 'player' ? 'CRITICAL HIT!' : 'Enemy CRITICAL HIT!'} ${damageResult.damage} damage!`
      : `${turnType === 'player' ? 'Dealt' : 'Enemy dealt'} ${damageResult.damage} damage`;
    
    if (skill && skill.name) {
      message = `${turnType === 'player' ? 'Used' : 'Enemy used'} ${skill.name}! ${message}`;
    }
  }
  
  return {
    damage: damageResult.damage,
    dodged: damageResult.dodged,
    crit: damageResult.crit,
    missed: damageResult.missed,
    message,
    skill: skill?.name,
    statusApplied
  };
}

function processStatusDamage(statusEffects) {
  let totalDamage = 0;
  for (const status of statusEffects) {
    const effect = STATUS_EFFECTS[status.type];
    if (effect && effect.damage && status.duration > 0) {
      totalDamage += effect.damage;
    }
  }
  return totalDamage;
}

function decrementStatusEffects(statusEffects) {
  return statusEffects
    .map(status => ({ ...status, duration: status.duration - 1 }))
    .filter(status => status.duration > 0);
}

async function getRandomEnemy(playerLevel, difficulty = 'normal') {
  const difficultyData = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const monster = await getMonster(`monster_${Math.floor(Math.random() * 100) + 1}`);
  
  if (!monster) return null;
  
  const levelVariation = Math.floor(Math.random() * 5) - 2;
  const baseLevel = Math.max(1, playerLevel - 2 + levelVariation);
  const level = Math.max(1, Math.floor(baseLevel * difficultyData.multiplier));
  
  return {
    ...monster,
    level: level,
    skills: JSON.parse(monster.skills || '[]')
  };
}

async function getRandomBoss(playerLevel, difficulty = 'normal') {
  const difficultyData = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const monster = await getMonster(`monster_${Math.floor(Math.random() * 20) + 1}`);
  
  if (!monster) return null;
  
  const bossLevel = Math.floor((playerLevel + 5) * difficultyData.multiplier);
  
  return {
    ...monster,
    level: bossLevel,
    skills: JSON.parse(monster.skills || '[]'),
    isBoss: true
  };
}

async function getWorldBoss() {
  const monster = await getMonster('monster_500');
  
  if (!monster) {
    return {
      id: 'world_boss',
      name: 'World Boss',
      element: 'Dark',
      type: 'Demon',
      rarity: 'Mythic',
      baseHp: 10000,
      baseAttack: 150,
      baseDefense: 100,
      baseSpeed: 60,
      skills: [
        { name: 'Apocalypse', damage: 300, statusEffect: 'burn', statusChance: 0.3 },
        { name: 'Dark Wave', damage: 200, statusEffect: 'poison', statusChance: 0.4 }
      ],
      level: 100,
      isWorldBoss: true
    };
  }
  
  return {
    ...monster,
    level: 100,
    skills: JSON.parse(monster.skills || '[]'),
    isWorldBoss: true
  };
}

async function getPVPEnemy(opponentId) {
  if (!opponentId) return null;
  
  const opponent = await getPlayer(opponentId);
  if (!opponent || !opponent.activeMonster || opponent.activeMonster === 'null') {
    return null;
  }
  
  const opponentMonster = await getPlayerMonster(opponent.activeMonster);
  if (!opponentMonster) return null;
  
  return {
    ...opponentMonster.monsterData,
    level: opponentMonster.level,
    skills: opponentMonster.skills,
    ownerId: opponentId,
    nickname: opponentMonster.nickname
  };
}

async function getTowerEnemy(floor, difficulty = 'normal') {
  const difficultyData = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const monsterId = Math.min(500, Math.max(1, floor * 5));
  const monster = await getMonster(`monster_${monsterId}`);
  
  if (!monster) return null;
  
  const towerLevel = Math.floor(floor * 2 * difficultyData.multiplier);
  
  return {
    ...monster,
    level: towerLevel,
    skills: JSON.parse(monster.skills || '[]'),
    isTower: true,
    floor: floor
  };
}

async function getDungeonEnemy(dungeonId, difficulty = 'normal') {
  const difficultyData = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const monster = await getMonster(`monster_${Math.floor(Math.random() * 50) + 1}`);
  
  if (!monster) return null;
  
  const dungeonLevel = Math.floor(20 * difficultyData.multiplier);
  
  return {
    ...monster,
    level: dungeonLevel,
    skills: JSON.parse(monster.skills || '[]'),
    dungeonId: dungeonId
  };
}

// World Boss functions
async function damageWorldBoss(monsterId, damage, userId) {
  const monsterDb = require('./db-adapter').getMonsterDb();
  
  // Record damage
  await run(monsterDb,
    {
      monsterId: monsterId,
      userId: userId,
      damage: damage,
      attackAt: Date.now()
    }
  );
  
  // Reduce boss HP
  const boss = await get(monsterDb, { key: 'current_boss_hp' });
  if (boss) {
    const currentHp = parseInt(boss.value) || 10000;
    const newHp = Math.max(0, currentHp - damage);
    await run(monsterDb,
      { key: 'current_boss_hp' },
      { $set: { value: newHp } }
    );
    return newHp;
  }
  
  return null;
}

async function getWorldBossRankings(monsterId, limit = 10) {
  const monsterDb = require('./db-adapter').getMonsterDb();
  const rows = await all(monsterDb,
    { monsterId: monsterId },
    { sort: { damage: -1 }, limit: limit }
  );
  return rows;
}

// Battle history functions
async function getBattleHistory(userId, limit = 20) {
  const playerDb = require('./db-adapter').getPlayersDb();
  const rows = await all(playerDb,
    { userId: userId },
    { sort: { timestamp: -1 }, limit: limit }
  );
  return rows;
}

async function recordBattle(userId, battleData) {
  const playerDb = require('./db-adapter').getPlayersDb();
  const battleId = `battle_${Date.now()}_${userId}`;
  
  await run(playerDb,
    {
      id: battleId,
      userId: userId,
      result: battleData.result,
      enemyName: battleData.enemyName,
      damageDealt: battleData.damageDealt,
      damageTaken: battleData.damageTaken,
      rounds: battleData.rounds,
      timestamp: Date.now()
    }
  );
}

// Survival mode functions
async function getSurvivalHighScore(userId) {
  const player = await getPlayer(userId);
  const stats = JSON.parse(player.statistics || '{}');
  return stats.survivalHighScore || 0;
}

async function updateSurvivalHighScore(userId, wavesSurvived) {
  const currentHigh = await getSurvivalHighScore(userId);
  if (wavesSurvived > currentHigh) {
    await incrementStatistic(userId, 'survivalHighScore', wavesSurvived - currentHigh);
    return true;
  }
  return false;
}

// Tower functions
async function getTowerProgress(userId) {
  const player = await getPlayer(userId);
  const stats = JSON.parse(player.statistics || '{}');
  return stats.highestTowerFloor || 0;
}

async function updateTowerProgress(userId, floor) {
  const currentProgress = await getTowerProgress(userId);
  if (floor > currentProgress) {
    await incrementStatistic(userId, 'highestTowerFloor', floor - currentProgress);
    return true;
  }
  return false;
}

module.exports = {
  BATTLE_TYPES,
  DIFFICULTIES,
  STATUS_EFFECTS,
  BATTLE_REWARDS,
  startBattle,
  calculateDamage,
  getElementEffectiveness,
  calculateHP,
  addMonsterXP,
  processTurn,
  processStatusDamage,
  decrementStatusEffects,
  damageWorldBoss,
  getWorldBossRankings,
  getBattleHistory,
  recordBattle,
  getSurvivalHighScore,
  updateSurvivalHighScore,
  getTowerProgress,
  updateTowerProgress
};