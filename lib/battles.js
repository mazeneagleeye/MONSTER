const { get, run, all } = require('./db');
const { getPlayer, addXP, addGold, addGems, spendEnergy, updateEnergy } = require('./players');
const { getPlayerMonster, getPlayerMonsters, interactWithMonster } = require('./monsters');
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

// Battle rewards
const BATTLE_REWARDS = {
  pve: { xp: 50, gold: 25, gems: 1 },
  boss: { xp: 200, gold: 100, gems: 5 },
  world_boss: { xp: 500, gold: 250, gems: 15 },
  guild_boss: { xp: 300, gold: 150, gems: 10 },
  tower: { xp: 100, gold: 50, gems: 3 },
  survival: { xp: 75, gold: 40, gems: 2 },
  dungeon: { xp: 150, gold: 75, gems: 4 }
};

async function calculateDamage(attacker, defender, skill = null) {
  const baseDamage = skill ? skill.damage : attacker.monsterData.baseAttack;
  const attack = baseDamage * (1 + (attacker.level * 0.1));
  const defense = defender.monsterData.baseDefense * (1 + (defender.level * 0.1));
  
  // Element effectiveness
  let elementMultiplier = 1;
  if (skill && attacker.monsterData.element) {
    elementMultiplier = getElementEffectiveness(attacker.monsterData.element, defender.monsterData.element);
  }
  
  // Critical hit
  const critChance = 0.1 + (attacker.loyalty / 1000);
  const isCrit = Math.random() < critChance;
  const critMultiplier = isCrit ? 2 : 1;
  
  // Dodge
  const dodgeChance = defender.monsterData.baseSpeed / 200;
  const dodged = Math.random() < dodgeChance;
  
  if (dodged) {
    return { damage: 0, dodged: true, crit: false };
  }
  
  const damage = Math.max(1, Math.floor((attack - defense / 2) * elementMultiplier * critMultiplier));
  
  return { damage, dodged: false, crit: isCrit };
}

function getElementEffectiveness(attackerElement, defenderElement) {
  const effectiveness = {
    'Fire': { 'Water': 0.5, 'Ice': 2, 'Plant': 2 },
    'Water': { 'Fire': 2, 'Electric': 0.5, 'Plant': 0.5 },
    'Earth': { 'Electric': 2, 'Water': 2, 'Fire': 0.5 },
    'Electric': { 'Water': 2, 'Earth': 0.5, 'Wind': 2 },
    'Dark': { 'Light': 2, 'Psychic': 2 },
    'Light': { 'Dark': 2, 'Undead': 2 },
    'Wind': { 'Electric': 0.5, 'Earth': 0.5 },
    'Ice': { 'Fire': 0.5, 'Water': 2 },
    'Poison': { 'Plant': 2, 'Undead': 0.5 },
    'Psychic': { 'Dark': 0.5, 'Machine': 2 }
  };
  
  return effectiveness[attackerElement]?.[defenderElement] || 1;
}

async function startBattle(userId, battleType, options = {}) {
  const player = await getPlayer(userId);
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
  let rewards = BATTLE_REWARDS[battleType] || BATTLE_REWARDS.pve;
  
  switch (battleType) {
    case BATTLE_TYPES.PVE:
      enemy = await getRandomEnemy(player.level);
      break;
    case BATTLE_TYPES.BOSS:
      enemy = await getRandomBoss(player.level);
      rewards = { ...rewards, xp: rewards.xp * 2 };
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
      enemy = await getTowerEnemy(options.floor || 1);
      rewards = { ...rewards, xp: rewards.xp * (options.floor || 1) };
      break;
    case BATTLE_TYPES.SURVIVAL:
      enemy = await getRandomEnemy(player.level);
      break;
    case BATTLE_TYPES.DUNGEON:
      enemy = await getDungeonEnemy(options.dungeonId);
      break;
    default:
      enemy = await getRandomEnemy(player.level);
  }
  
  if (!enemy) {
    await addEnergy(userId, energyCost);
    return { success: false, message: 'Could not find enemy!' };
  }
  
  // Battle simulation
  const battleLog = [];
  let playerHp = calculateHP(playerMonster);
  let enemyHp = calculateHP(enemy);
  let round = 1;
  
  while (playerHp > 0 && enemyHp > 0 && round <= 50) {
    // Player attacks
    const playerAttack = await calculateDamage(playerMonster, enemy, 
      playerMonster.skills[Math.floor(Math.random() * playerMonster.skills.length)]
    );
    enemyHp -= playerAttack.damage;
    battleLog.push({
      round,
      attacker: 'player',
      damage: playerAttack.damage,
      crit: playerAttack.crit,
      dodged: playerAttack.dodged,
      message: playerAttack.dodged ? 'Enemy dodged!' : 
               playerAttack.crit ? `CRITICAL HIT! ${playerAttack.damage} damage!` :
               `Dealt ${playerAttack.damage} damage`
    });
    
    if (enemyHp <= 0) break;
    
    // Enemy attacks
    const enemyAttack = await calculateDamage(enemy, playerMonster,
      enemy.skills?.[Math.floor(Math.random() * enemy.skills.length)]
    );
    playerHp -= enemyAttack.damage;
    battleLog.push({
      round,
      attacker: 'enemy',
      damage: enemyAttack.damage,
      crit: enemyAttack.crit,
      dodged: enemyAttack.dodged,
      message: enemyAttack.dodged ? 'You dodged!' :
               enemyAttack.crit ? `Enemy CRITICAL HIT! ${enemyAttack.damage} damage!` :
               `Enemy dealt ${enemyAttack.damage} damage`
    });
    
    round++;
  }
  
  const playerWon = playerHp > 0;
  
  // Award rewards
  if (playerWon) {
    await addXP(userId, rewards.xp);
    await addGold(userId, rewards.gold);
    await addGems(userId, rewards.gems);
    
    // Update monster stats
    await run(require('./db').playersDb,
      `UPDATE player_monsters SET battles = battles + 1, wins = wins + 1, lastInteract = ? WHERE id = ?`,
      [Date.now(), activeMonsterId]
    );
    
    // Monster gains XP
    const monsterXp = Math.floor(rewards.xp / 2);
    await addMonsterXP(activeMonsterId, monsterXp);
  } else {
    await run(require('./db').playersDb,
      `UPDATE player_monsters SET battles = battles + 1, lastInteract = ? WHERE id = ?`,
      [Date.now(), activeMonsterId]
    );
  }
  
  return {
    success: true,
    won: playerWon,
    battleLog,
    rewards: playerWon ? rewards : null,
    playerHp: Math.max(0, playerHp),
    enemyHp: Math.max(0, enemyHp)
  };
}

function calculateHP(monster) {
  const baseHp = monster.monsterData?.baseHp || monster.baseHp || 50;
  const level = monster.level || 1;
  return Math.floor(baseHp * (1 + (level * 0.2)));
}

async function getRandomEnemy(playerLevel) {
  const difficulty = Math.min(5, Math.floor(playerLevel / 10) + 1);
  const monster = await getMonster(`monster_${Math.floor(Math.random() * 100) + 1}`);
  
  if (!monster) return null;
  
  return {
    ...monster,
    level: Math.max(1, playerLevel - 2 + Math.floor(Math.random() * 5)),
    skills: JSON.parse(monster.skills || '[]')
  };
}

async function getRandomBoss(playerLevel) {
  const monster = await getMonster(`monster_${Math.floor(Math.random() * 20) + 1}`);
  
  if (!monster) return null;
  
  return {
    ...monster,
    level: playerLevel + 5,
    skills: JSON.parse(monster.skills || '[]')
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
      baseHp: 1000,
      baseAttack: 100,
      baseDefense: 80,
      baseSpeed: 50,
      skills: [{ name: 'Apocalypse', damage: 200 }],
      level: 100
    };
  }
  
  return {
    ...monster,
    level: 100,
    skills: JSON.parse(monster.skills || '[]')
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
    ownerId: opponentId
  };
}

async function getTowerEnemy(floor) {
  const monster = await getMonster(`monster_${Math.min(500, floor * 10)}`);
  
  if (!monster) return null;
  
  return {
    ...monster,
    level: floor * 2,
    skills: JSON.parse(monster.skills || '[]')
  };
}

async function getDungeonEnemy(dungeonId) {
  const monster = await getMonster(`monster_${Math.floor(Math.random() * 50) + 1}`);
  
  if (!monster) return null;
  
  return {
    ...monster,
    level: 20,
    skills: JSON.parse(monster.skills || '[]')
  };
}

async function addMonsterXP(monsterInstanceId, xp) {
  const monster = await getPlayerMonster(monsterInstanceId);
  if (!monster) return;
  
  let { level, xp: currentXp } = monster;
  currentXp += xp;
  
  const xpNeeded = level * 100;
  
  while (currentXp >= xpNeeded && level < 100) {
    currentXp -= xpNeeded;
    level += 1;
  }
  
  await run(require('./db').playersDb,
    `UPDATE player_monsters SET level = ?, xp = ? WHERE id = ?`,
    [level, currentXp, monsterInstanceId]
  );
}

module.exports = {
  BATTLE_TYPES,
  BATTLE_REWARDS,
  startBattle,
  calculateDamage,
  getElementEffectiveness,
  calculateHP,
  addMonsterXP
};