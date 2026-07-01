const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'monster.db');
const playerDbPath = path.join(__dirname, '..', 'players.db');

const monsterDb = new sqlite3.Database(dbPath);
const playersDb = new sqlite3.Database(playerDbPath);

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function init() {
  // Players table with full progression
  await run(playersDb, `
    CREATE TABLE IF NOT EXISTS players (
      userId TEXT PRIMARY KEY,
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      gold INTEGER NOT NULL DEFAULT 0,
      gems INTEGER NOT NULL DEFAULT 0,
      energy INTEGER NOT NULL DEFAULT 100,
      maxEnergy INTEGER NOT NULL DEFAULT 100,
      attackLevel INTEGER NOT NULL DEFAULT 1,
      totalDamage INTEGER NOT NULL DEFAULT 0,
      monstersParticipated INTEGER NOT NULL DEFAULT 0,
      lastAttackAt INTEGER,
      prestige INTEGER NOT NULL DEFAULT 0,
      titles TEXT DEFAULT '[]',
      achievements TEXT DEFAULT '[]',
      inventory TEXT DEFAULT '[]',
      equipped TEXT DEFAULT '{}',
      monsterCollection TEXT DEFAULT '[]',
      activeMonster TEXT DEFAULT 'null',
      guildId TEXT,
      guildRank TEXT DEFAULT 'member',
      lastEnergyUpdate INTEGER DEFAULT 0,
      createdAt INTEGER DEFAULT 0
    );
  `);

  // Player monsters (owned monsters with personality)
  await run(playersDb, `
    CREATE TABLE IF NOT EXISTS player_monsters (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      monsterId TEXT NOT NULL,
      nickname TEXT,
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      happiness INTEGER NOT NULL DEFAULT 100,
      hunger INTEGER NOT NULL DEFAULT 0,
      loyalty INTEGER NOT NULL DEFAULT 50,
      personality TEXT DEFAULT 'neutral',
      battles INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      skills TEXT DEFAULT '[]',
      equipment TEXT DEFAULT '{}',
      createdAt INTEGER NOT NULL,
      lastInteract INTEGER DEFAULT 0,
      FOREIGN KEY (userId) REFERENCES players(userId)
    );
  `);

  // Guilds
  await run(playersDb, `
    CREATE TABLE IF NOT EXISTS guilds (
      guildId TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      bank INTEGER NOT NULL DEFAULT 0,
      upgrades TEXT DEFAULT '{}',
      research TEXT DEFAULT '{}',
      createdAt INTEGER NOT NULL
    );
  `);

  // Guild members
  await run(playersDb, `
    CREATE TABLE IF NOT EXISTS guild_members (
      guildId TEXT NOT NULL,
      userId TEXT NOT NULL,
      rank TEXT NOT NULL DEFAULT 'member',
      contribution INTEGER NOT NULL DEFAULT 0,
      joinedAt INTEGER NOT NULL,
      PRIMARY KEY (guildId, userId),
      FOREIGN KEY (guildId) REFERENCES guilds(guildId)
    );
  `);

  // Market listings
  await run(playersDb, `
    CREATE TABLE IF NOT EXISTS market_listings (
      id TEXT PRIMARY KEY,
      sellerId TEXT NOT NULL,
      itemType TEXT NOT NULL,
      itemId TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (sellerId) REFERENCES players(userId)
    );
  `);

  // Trades
  await run(playersDb, `
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      fromUserId TEXT NOT NULL,
      toUserId TEXT NOT NULL,
      offer TEXT NOT NULL,
      request TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (fromUserId) REFERENCES players(userId),
      FOREIGN KEY (toUserId) REFERENCES players(userId)
    );
  `);

  // Mail
  await run(playersDb, `
    CREATE TABLE IF NOT EXISTS mail (
      id TEXT PRIMARY KEY,
      toUserId TEXT NOT NULL,
      fromUserId TEXT NOT NULL,
      subject TEXT NOT NULL,
      content TEXT NOT NULL,
      attachments TEXT DEFAULT '[]',
      read INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (toUserId) REFERENCES players(userId)
    );
  `);

  // Daily quests
  await run(playersDb, `
    CREATE TABLE IF NOT EXISTS daily_quests (
      userId TEXT NOT NULL,
      questId TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      claimed INTEGER NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      PRIMARY KEY (userId, questId, date)
    );
  `);

  // Achievements
  await run(playersDb, `
    CREATE TABLE IF NOT EXISTS achievements (
      userId TEXT NOT NULL,
      achievementId TEXT NOT NULL,
      unlockedAt INTEGER NOT NULL,
      PRIMARY KEY (userId, achievementId)
    );
  `);

  // Monster state (world boss)
  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS monster_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS monster_attacks (
      monsterId TEXT NOT NULL,
      userId TEXT NOT NULL,
      damage INTEGER NOT NULL,
      attackAt INTEGER NOT NULL,
      PRIMARY KEY (monsterId, userId)
    );
  `);

  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS monster_config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS monster_history (
      seq INTEGER PRIMARY KEY,
      monsterId TEXT NOT NULL,
      title TEXT NOT NULL,
      maxHp INTEGER NOT NULL,
      bonusHp INTEGER NOT NULL,
      rareType TEXT,
      killedAt INTEGER NOT NULL
    );
  `);

  // Global market
  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS global_market (
      id TEXT PRIMARY KEY,
      sellerId TEXT NOT NULL,
      itemType TEXT NOT NULL,
      itemId TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL
    );
  `);

  // Global chat messages
  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS global_chat (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      message TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'global',
      createdAt INTEGER NOT NULL
    );
  `);

  // Events
  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS events (
      eventId TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      startTime INTEGER NOT NULL,
      endTime INTEGER NOT NULL,
      rewards TEXT DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Player event progress
  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS event_progress (
      userId TEXT NOT NULL,
      eventId TEXT NOT NULL,
      progress TEXT DEFAULT '{}',
      claimed TEXT DEFAULT '[]',
      PRIMARY KEY (userId, eventId)
    );
  `);

  // Crafting recipes
  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS crafting_recipes (
      recipeId TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ingredients TEXT NOT NULL,
      result TEXT NOT NULL,
      skill TEXT NOT NULL
    );
  `);

  // Daily dungeon
  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS daily_dungeon (
      dungeonId TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      regionId TEXT NOT NULL,
      monsterId TEXT NOT NULL,
      difficulty INTEGER NOT NULL,
      rewards TEXT NOT NULL
    );
  `);

  // Parties
  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS parties (
      partyId TEXT PRIMARY KEY,
      leaderId TEXT NOT NULL,
      members TEXT NOT NULL DEFAULT '[]',
      activity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      createdAt INTEGER NOT NULL
    );
  `);

  // Tournaments
  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS tournaments (
      tournamentId TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      participants TEXT NOT NULL DEFAULT '[]',
      maxParticipants INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      rewards TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );
  `);

  // Private shops
  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS private_shops (
      shopId TEXT PRIMARY KEY,
      ownerId TEXT NOT NULL,
      name TEXT NOT NULL,
      items TEXT NOT NULL DEFAULT '[]',
      visitors TEXT NOT NULL DEFAULT '[]',
      createdAt INTEGER NOT NULL
    );
  `);

  // Season rankings
  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS season_rankings (
      userId TEXT NOT NULL,
      seasonId TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      rank INTEGER,
      PRIMARY KEY (userId, seasonId)
    );
  `);

  // Player skills
  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS player_skills (
      userId TEXT NOT NULL,
      skill TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (userId, skill)
    );
  `);

  // Monsters catalog (500+ monsters)
  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS monsters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      element TEXT NOT NULL,
      type TEXT NOT NULL,
      rarity TEXT NOT NULL,
      rarityMultiplier REAL NOT NULL,
      baseHp INTEGER NOT NULL,
      baseAttack INTEGER NOT NULL,
      baseDefense INTEGER NOT NULL,
      baseSpeed INTEGER NOT NULL,
      skills TEXT NOT NULL,
      evolution TEXT
    );
  `);
}


module.exports = {
  monsterDb,
  playersDb,
  init,
  run,
  get,
  all
};

