const { get, run, monsterDb } = require('./db');
const path = require('path');

const MONSTERS = [
  { title: '🐍 Slime', baseHp: 10 },
  { title: '👺 Goblin', baseHp: 12 },
  { title: '🪓 Orc', baseHp: 14 },
  { title: '👹 Troll', baseHp: 16 },
  { title: '🧌 Ogre', baseHp: 18 },
  { title: '🐉 Dragon Whelp', baseHp: 20 },
  { title: '🐲 Dragon', baseHp: 25 },
  { title: '👑 Ancient Dragon', baseHp: 35 },
  { title: '🗿 Titan', baseHp: 50 }
];

const DAILY_HP_INCREASE = 2;


function getMonsterImageName(title) {
  // Map monster titles to their specific image filenames
  const imageMap = {
    '🐍 Slime': 'slime',
    '👺 Goblin': 'goblin',
    '🪓 Orc': 'orc',
    '👹 Troll': 'troll',
    '🧌 Ogre': 'ogre',
    '🐉 Dragon Whelp': 'dragon_whelp',
    '🐲 Dragon': 'dragon',
    '👑 Ancient Dragon': 'ancient_dragon',
    '🗿 Titan': 'titan'
  };
  
  return imageMap[title] || 'slime'; // Default to slime if not found
}

function imageUrlFromTitle(title) {
  const imageName = getMonsterImageName(title);
  return `attachment://${imageName}.png`;
}

function pickNextBaseMonster(killCount) {
  // cycle through MONSTERS based on progression
  const idx = Math.min(killCount, MONSTERS.length - 1);
  return MONSTERS[idx];
}

function rollRareHpBonus() {
  const r = Math.random();
  // 80% -> +2
  // 19% -> +5
  // 1% -> +10
  if (r < 0.80) return 2;
  if (r < 0.99) return 5;
  return 10;
}

async function getMonsterStateValue(key, defaultValue = null) {
  const row = await get(monsterDb, `SELECT value FROM monster_state WHERE key = ?`, [key]);
  return row?.value ?? defaultValue;
}

async function setMonsterStateValue(key, value) {
  await run(
    monsterDb,
    `INSERT INTO monster_state(key,value) VALUES(?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    [key, String(value)]
  );
}


async function getCurrentMonster() {
  const monsterId = await getMonsterStateValue('monsterId', null);
  const hp = Number(await getMonsterStateValue('hp', 10));
  const maxHp = Number(await getMonsterStateValue('maxHp', 10));
  const baseTitle = await getMonsterStateValue('title', '🐍 Slime');

  return {
    monsterId,
    hp,
    maxHp,
    title: baseTitle,
    imageUrl: imageUrlFromTitle(baseTitle)
  };
}

async function resetMonsterState() {
  await run(monsterDb, `DELETE FROM monster_state`);
  await setMonsterStateValue('kills', 0);
  await spawnNewMonster({ hardReset: true });
}


async function spawnNewMonster({ hardReset = false } = {}) {
  const current = await getCurrentMonster().catch(() => null);
  const currentKills = Number(await getMonsterStateValue('kills', 0));

  const currentMonsterSeq = Number(await getMonsterStateValue('monsterSeq', 0));
  const nextSeq = hardReset ? 1 : currentMonsterSeq + 1;

  const { baseHp, title } = pickNextBaseMonster(currentKills);

  // Per requirements: base progression is +2, but can be +5 or +10.
  // This roll decides the bonus of the *incoming* monster.
  const bonusHp = rollRareHpBonus(); // 2 / 5 / 10

  // Each new monster arrives with: (previous maxHp) + bonusHp.
  // For the very first spawn after a reset: start at baseHp.
  let maxHp;
  if (hardReset || !current) {
    maxHp = baseHp;
  } else {
    maxHp = Number(current.maxHp) + bonusHp;
  }

  const monsterId = `m_${nextSeq}_${Date.now()}`;

  await setMonsterStateValue('monsterId', monsterId);
  await setMonsterStateValue('hp', maxHp);
  await setMonsterStateValue('maxHp', maxHp);
  await setMonsterStateValue('title', title);
  await setMonsterStateValue('monsterSeq', nextSeq);
  await setMonsterStateValue('lastBonusHp', bonusHp);

  // Clear per-monster attack records
  await run(monsterDb, `DELETE FROM monster_attacks WHERE monsterId = ?`, [monsterId]).catch(() => {});

  return { monsterId, hp: maxHp, maxHp, title, bonusHp };
}


async function applyDailyHealIfNeeded(now = Date.now()) {
  // Approximation of: if nobody attacks during the day, monster recovers all HP.
  const lastDamageAtRaw = await getMonsterStateValue('lastDamageAt', null);
  const hp = Number(await getMonsterStateValue('hp', 0));
  const maxHp = Number(await getMonsterStateValue('maxHp', 0));
  if (!maxHp || hp >= maxHp) return;
  if (!lastDamageAtRaw) return;

  const lastDamageAt = Number(lastDamageAtRaw);
  const dayMs = 24 * 60 * 60 * 1000;
  if (now - lastDamageAt >= dayMs) {
    await setMonsterStateValue('hp', maxHp);
  }
}


async function reduceHpBy(amount) {
  const hp = Number(await getMonsterStateValue('hp', 0));
  const newHp = Math.max(0, hp - amount);
  await setMonsterStateValue('hp', newHp);
  await setMonsterStateValue('lastDamageAt', Date.now());
  return newHp;
}

async function setMonsterLastAttackMeta() {
  // placeholder for future
}

module.exports = {
  getCurrentMonster,
  spawnNewMonster,
  resetMonsterState,
  reduceHpBy,
  applyDailyHealIfNeeded,
  rollRareHpBonus,
  getMonsterStateValue,
  setMonsterStateValue,
};


