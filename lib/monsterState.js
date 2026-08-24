const { get, run, all } = require('./db-adapter');

// Get current monster
async function getCurrentMonster() {
  const row = await get(require('./db-adapter').getMonsterDb(),
    { key: 'current_monster' }
  );
  
  if (!row) return null;
  
  return {
    monsterId: row.monsterId,
    title: row.title,
    hp: parseInt(row.hp) || 10000,
    maxHp: parseInt(row.maxHp) || 10000,
    spawnedAt: parseInt(row.spawnedAt) || Date.now()
  };
}

// Spawn new monster
async function spawnNewMonster(level = 0, options = {}) {
  const { hardReset = false } = options;
  
  // Get random monster from catalog
  const monsterId = `monster_${Math.floor(Math.random() * 100) + 1}`;
  const monster = await get(require('./db-adapter').getMonsterDb(), { id: monsterId });
  
  if (!monster) {
    // Fallback monster
    const fallbackMonster = {
      id: 'monster_1',
      name: 'Wild Monster',
      baseHp: 1000
    };
    
    const monsterData = {
      key: 'current_monster',
      monsterId: fallbackMonster.id,
      title: fallbackMonster.name,
      hp: fallbackMonster.baseHp,
      maxHp: fallbackMonster.baseHp,
      spawnedAt: Date.now()
    };
    
    await run(require('./db-adapter').getMonsterDb(),
      monsterData
    );
    
    return monsterData;
  }
  
  const baseHp = parseInt(monster.baseHp) || 1000;
  const levelBonus = level * 100;
  const maxHp = baseHp + levelBonus;
  
  const monsterData = {
    key: 'current_monster',
    monsterId: monster.id,
    title: monster.name,
    hp: maxHp,
    maxHp: maxHp,
    spawnedAt: Date.now()
  };
  
  await run(require('./db-adapter').getMonsterDb(),
    monsterData
  );
  
  return monsterData;
}

// Apply daily heal if needed
async function applyDailyHealIfNeeded(now = Date.now()) {
  const monster = await getCurrentMonster();
  if (!monster) return;
  
  const spawnedAt = monster.spawnedAt || now;
  const dayMs = 24 * 60 * 60 * 1000;
  const timeSinceSpawn = now - spawnedAt;
  
  // Heal 10% every day
  if (timeSinceSpawn >= dayMs) {
    const healAmount = Math.floor(monster.maxHp * 0.1);
    const newHp = Math.min(monster.maxHp, monster.hp + healAmount);
    
    await run(require('./db-adapter').getMonsterDb(),
      { key: 'current_monster' },
      { $set: { hp: newHp } }
    );
  }
}

// Damage monster
async function damageMonster(damage) {
  const monster = await getCurrentMonster();
  if (!monster) return null;
  
  const newHp = Math.max(0, monster.hp - damage);
  
  await run(require('./db-adapter').getMonsterDb(),
    { key: 'current_monster' },
    { $set: { hp: newHp } }
  );
  
  return newHp;
}

// Check if monster is dead
async function isMonsterDead() {
  const monster = await getCurrentMonster();
  if (!monster) return true;
  return monster.hp <= 0;
}

// Get monster image name
function getMonsterImageName(title) {
  const imageMap = {
    'Wild Monster': 'monster1',
    'Dragon': 'dragon',
    'Goblin': 'goblin',
    'Skeleton': 'skeleton',
    'Slime': 'slime',
    'Troll': 'troll',
    'Wolf': 'wolf',
    'Spider': 'spider',
    'Ghost': 'ghost',
    'Demon': 'demon'
  };
  
  return imageMap[title] || 'monster1';
}

module.exports = {
  getCurrentMonster,
  spawnNewMonster,
  applyDailyHealIfNeeded,
  damageMonster,
  isMonsterDead,
  getMonsterImageName
};