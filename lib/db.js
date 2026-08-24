const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

// Database instances
let monsterDb = null;
let playersDb = null;
let initPromise = null;

const dataDir = (() => {
  const rootDir = path.join(__dirname, '..');
  const rootPlayersPath = path.join(rootDir, 'players.db');
  const rootMonsterPath = path.join(rootDir, 'monster.db');
  const defaultDataDir = path.join(rootDir, 'data');

  if (process.env.DATA_DIR) {
    return path.isAbsolute(process.env.DATA_DIR)
      ? process.env.DATA_DIR
      : path.join(rootDir, process.env.DATA_DIR);
  }

  if (fs.existsSync(rootPlayersPath) || fs.existsSync(rootMonsterPath)) {
    return rootDir;
  }

  return defaultDataDir;
})();

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize databases
async function init() {
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    const SQL = await initSqlJs();
    
    const dbPath = path.join(dataDir, 'monster.db');
    const playerDbPath = path.join(dataDir, 'players.db');
    const leaderboardBackupPath = path.join(__dirname, '..', 'leaderboard-backup.json');
    const guildBackupPath = path.join(__dirname, '..', 'guilds-backup.json');
    const playerDbExists = fs.existsSync(playerDbPath);
    
    // Load or create monster database
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      monsterDb = new SQL.Database(fileBuffer);
    } else {
      monsterDb = new SQL.Database();
    }
    
    // Load or create players database
    if (playerDbExists) {
      const fileBuffer = fs.readFileSync(playerDbPath);
      playersDb = new SQL.Database(fileBuffer);
    } else {
      playersDb = new SQL.Database();
    }
    
    // Create tables
    await createTables();
    
    // Restore leaderboard from backup if this is a new or empty players database
    if (!playerDbExists || await getPlayerCount() === 0) {
      const restored = await importLeaderboardBackup(leaderboardBackupPath);
      if (restored) {
        console.log('Imported leaderboard backup into players database.');
      }
    }

    // Restore guild backup if there are no guilds yet
    if (await getGuildCount() === 0) {
      const restoredGuilds = await importGuildsBackup(guildBackupPath);
      if (restoredGuilds) {
        console.log('Imported guild leaderboard backup into players database.');
      }
    }
    
    // Save databases
    saveDatabases();
  })();
  
  return initPromise;
}

function saveDatabases() {
  const monsterDbPath = path.join(dataDir, 'monster.db');
  const playersDbPath = path.join(dataDir, 'players.db');

  if (monsterDb) {
    const data = monsterDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(monsterDbPath, buffer);
  }
  
  if (playersDb) {
    const data = playersDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(playersDbPath, buffer);
  }
}

async function getPlayerCount() {
  const row = await get(playersDb, 'SELECT COUNT(*) AS count FROM players');
  return row?.count || 0;
}

async function importLeaderboardBackup(backupPath) {
  if (!fs.existsSync(backupPath)) {
    return false;
  }

  let backup;
  try {
    backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  } catch (err) {
    console.error('Leaderboard backup file could not be parsed:', err.message);
    return false;
  }

  const entries = Array.isArray(backup.leaderboard) ? backup.leaderboard : [];
  if (entries.length === 0) {
    return false;
  }

  for (const entry of entries) {
    const userId = String(entry.userId || entry.id || '');
    const totalDamage = Number(entry.damage || 0);
    if (!userId) continue;

    await run(playersDb,
      `INSERT INTO players(userId, totalDamage) VALUES(?, ?)
       ON CONFLICT(userId) DO UPDATE SET totalDamage = excluded.totalDamage`,
      [userId, totalDamage]
    );
  }

  return true;
}

async function getGuildCount() {
  const row = await get(playersDb, 'SELECT COUNT(*) AS count FROM guilds');
  return row?.count || 0;
}

async function importGuildsBackup(backupPath) {
  if (!fs.existsSync(backupPath)) {
    return false;
  }

  let backup;
  try {
    backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  } catch (err) {
    console.error('Guild backup file could not be parsed:', err.message);
    return false;
  }

  const guilds = Array.isArray(backup.guilds)
    ? backup.guilds
    : Array.isArray(backup)
      ? backup
      : [];
  if (guilds.length === 0) {
    return false;
  }

  const now = Date.now();
  for (const guild of guilds) {
    const guildId = String(guild.guildId || guild.tag || guild.name || `guild-${Math.random().toString(36).slice(2, 8)}`);
    const name = String(guild.tag || guild.name || 'Unknown');
    const level = Number(guild.level || 1);
    const xp = Number(guild.xp || 0);
    const bank = Number(guild.bank || 0);
    const upgrades = JSON.stringify(guild.upgrades || {});
    const research = JSON.stringify(guild.research || {});
    const createdAt = Number(guild.createdAt || now);
    const resources = JSON.stringify(guild.resources || {});
    const buildings = JSON.stringify(guild.buildings || {});
    const construction = JSON.stringify(guild.construction || {});

    await run(playersDb,
      `INSERT INTO guilds(guildId, name, level, xp, bank, upgrades, research, createdAt, resources, buildings, construction)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(guildId) DO UPDATE SET name=excluded.name, level=excluded.level, xp=excluded.xp, bank=excluded.bank, upgrades=excluded.upgrades, research=excluded.research, resources=excluded.resources, buildings=excluded.buildings, construction=excluded.construction`,
      [guildId, name, level, xp, bank, upgrades, research, createdAt, resources, buildings, construction]
    );

    if (Array.isArray(guild.members) && guild.members.length > 0) {
      for (const memberIdRaw of guild.members) {
        const memberId = String(memberIdRaw || `${guildId}-member-${Math.random().toString(36).slice(2, 6)}`);
        await run(playersDb,
          `INSERT INTO players(userId, level, xp, gold, gems, energy, maxEnergy, attackLevel, totalDamage, monstersParticipated, lastAttackAt, prestige, titles, achievements, inventory, equipped, monsterCollection, activeMonster, guildId, guildRank, lastEnergyUpdate, createdAt)
           VALUES(?, 1, 0, 0, 0, 100, 100, 1, 0, 0, NULL, 0, '[]', '[]', '[]', '{}', '[]', 'null', ?, 'member', 0, ?)
           ON CONFLICT(userId) DO NOTHING`,
          [memberId, guildId, now]
        );

        await run(playersDb,
          `INSERT OR IGNORE INTO guild_members(guildId, userId, rank, contribution, joinedAt) VALUES(?,?,?,?,?)`,
          [guildId, memberId, 'member', 0, now]
        );
      }
    }
  }

  return true;
}

async function ensureColumn(db, tableName, columnName, definition) {
  const columns = await all(db, `PRAGMA table_info(${tableName})`);
  if (!columns.some(col => col.name === columnName)) {
    await run(db, `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const result = stmt.run();
      stmt.free();
      resolve(result);
    } catch (err) {
      reject(err);
    }
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const row = stmt.step() ? stmt.getAsObject() : null;
      stmt.free();
      resolve(row);
    } catch (err) {
      reject(err);
    }
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      resolve(results);
    } catch (err) {
      reject(err);
    }
  });
}


async function createTables() {
  // Players table with full progression
  await run(playersDb, `
    CREATE TABLE IF NOT EXISTS players (
      userId TEXT PRIMARY KEY,
      username TEXT DEFAULT '',
      displayName TEXT DEFAULT '',
      avatarUrl TEXT DEFAULT '',
      accountCreatedAt INTEGER DEFAULT 0,
      lastLogin INTEGER DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      gold INTEGER NOT NULL DEFAULT 0,
      gems INTEGER NOT NULL DEFAULT 0,
      energy INTEGER NOT NULL DEFAULT 100,
      maxEnergy INTEGER NOT NULL DEFAULT 100,
      hp INTEGER NOT NULL DEFAULT 100,
      maxHp INTEGER NOT NULL DEFAULT 100,
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
      currentRegion TEXT DEFAULT 'Starter Village',
      currentParty TEXT DEFAULT 'None',
      currentClass TEXT DEFAULT 'None',
      currentJob TEXT DEFAULT 'None',
      statistics TEXT DEFAULT '{}',
      settings TEXT DEFAULT '{}',
      guildId TEXT,
      guildRank TEXT DEFAULT 'member',
      lastEnergyUpdate INTEGER DEFAULT 0,
      createdAt INTEGER DEFAULT 0,
      started INTEGER NOT NULL DEFAULT 0,
      resources TEXT DEFAULT '{}',
      workLevels TEXT DEFAULT '{}',
      knowledgeBooks INTEGER DEFAULT 0,
      dailyStreak INTEGER DEFAULT 0,
      lastDailyClaim INTEGER DEFAULT 0
    );
  `);
  await ensureColumn(playersDb, 'players', 'username', "TEXT DEFAULT ''" );
  await ensureColumn(playersDb, 'players', 'displayName', "TEXT DEFAULT ''" );
  await ensureColumn(playersDb, 'players', 'avatarUrl', "TEXT DEFAULT ''" );
  await ensureColumn(playersDb, 'players', 'accountCreatedAt', 'INTEGER DEFAULT 0');
  await ensureColumn(playersDb, 'players', 'lastLogin', 'INTEGER DEFAULT 0');
  await ensureColumn(playersDb, 'players', 'hp', 'INTEGER DEFAULT 100');
  await ensureColumn(playersDb, 'players', 'maxHp', 'INTEGER DEFAULT 100');
  await ensureColumn(playersDb, 'players', 'currentRegion', "TEXT DEFAULT 'Starter Village'" );
  await ensureColumn(playersDb, 'players', 'currentParty', "TEXT DEFAULT 'None'" );
  await ensureColumn(playersDb, 'players', 'currentClass', "TEXT DEFAULT 'None'" );
  await ensureColumn(playersDb, 'players', 'currentJob', "TEXT DEFAULT 'None'" );
  await ensureColumn(playersDb, 'players', 'statistics', "TEXT DEFAULT '{}'" );
  await ensureColumn(playersDb, 'players', 'settings', "TEXT DEFAULT '{}'" );
  await ensureColumn(playersDb, 'players', 'started', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(playersDb, 'players', 'dailyStreak', 'INTEGER DEFAULT 0');
  await ensureColumn(playersDb, 'players', 'lastDailyClaim', 'INTEGER DEFAULT 0');
  await ensureColumn(playersDb, 'players', 'resources', "TEXT DEFAULT '{}'" );
  await ensureColumn(playersDb, 'players', 'workLevels', "TEXT DEFAULT '{}'" );
  await ensureColumn(playersDb, 'players', 'knowledgeBooks', 'INTEGER DEFAULT 0');

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
      energy INTEGER DEFAULT 100,
      isFavorite INTEGER DEFAULT 0,
      skin TEXT DEFAULT 'default',
      statistics TEXT DEFAULT '{}',
      evolutionStage INTEGER DEFAULT 1,
      FOREIGN KEY (userId) REFERENCES players(userId)
    );
  `);
  await ensureColumn(playersDb, 'player_monsters', 'energy', 'INTEGER DEFAULT 100');
  await ensureColumn(playersDb, 'player_monsters', 'isFavorite', 'INTEGER DEFAULT 0');
  await ensureColumn(playersDb, 'player_monsters', 'skin', "TEXT DEFAULT 'default'");
  await ensureColumn(playersDb, 'player_monsters', 'statistics', "TEXT DEFAULT '{}'");
  await ensureColumn(playersDb, 'player_monsters', 'evolutionStage', 'INTEGER DEFAULT 1');

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
      createdAt INTEGER NOT NULL,
      resources TEXT DEFAULT '{}',
      buildings TEXT DEFAULT '{}',
      construction TEXT DEFAULT '{}'
    );
  `);
  await ensureColumn(playersDb, 'guilds', 'resources', "TEXT DEFAULT '{}'" );
  await ensureColumn(playersDb, 'guilds', 'buildings', "TEXT DEFAULT '{}'" );
  await ensureColumn(playersDb, 'guilds', 'construction', "TEXT DEFAULT '{}'" );

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

  // Battle history
  await run(playersDb, `
    CREATE TABLE IF NOT EXISTS battle_history (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      result TEXT NOT NULL,
      enemyName TEXT NOT NULL,
      damageDealt INTEGER NOT NULL DEFAULT 0,
      damageTaken INTEGER NOT NULL DEFAULT 0,
      rounds INTEGER NOT NULL DEFAULT 0,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES players(userId)
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

  // Join reminders for 24-hour start reminder
  await run(monsterDb, `
    CREATE TABLE IF NOT EXISTS join_reminders (
      userId TEXT PRIMARY KEY,
      joinedAt INTEGER NOT NULL,
      reminded INTEGER NOT NULL DEFAULT 0
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
      evolution TEXT,
      description TEXT DEFAULT '',
      lore TEXT DEFAULT '',
      region TEXT DEFAULT 'Unknown',
      favoriteFood TEXT DEFAULT 'Mystery meal',
      critRate REAL DEFAULT 0.05,
      critDamage REAL DEFAULT 1.5,
      accuracy REAL DEFAULT 0.95,
      dodge REAL DEFAULT 0.05,
      image TEXT DEFAULT '',
      evolutionStage INTEGER DEFAULT 1
    );
  `);
  await ensureColumn(monsterDb, 'monsters', 'description', "TEXT DEFAULT ''");
  await ensureColumn(monsterDb, 'monsters', 'lore', "TEXT DEFAULT ''");
  await ensureColumn(monsterDb, 'monsters', 'region', "TEXT DEFAULT 'Unknown'");
  await ensureColumn(monsterDb, 'monsters', 'favoriteFood', "TEXT DEFAULT 'Mystery meal'");
  await ensureColumn(monsterDb, 'monsters', 'critRate', 'REAL DEFAULT 0.05');
  await ensureColumn(monsterDb, 'monsters', 'critDamage', 'REAL DEFAULT 1.5');
  await ensureColumn(monsterDb, 'monsters', 'accuracy', 'REAL DEFAULT 0.95');
  await ensureColumn(monsterDb, 'monsters', 'dodge', 'REAL DEFAULT 0.05');
  await ensureColumn(monsterDb, 'monsters', 'image', "TEXT DEFAULT ''");
  await ensureColumn(monsterDb, 'monsters', 'evolutionStage', 'INTEGER DEFAULT 1');
}

module.exports = {
  init,
  saveDatabases,
  run,
  get,
  all,
  get monsterDb() {
    if (!monsterDb) {
      throw new Error('Monster database not initialized. Call init() first.');
    }
    return monsterDb;
  },
  get playersDb() {
    if (!playersDb) {
      throw new Error('Players database not initialized. Call init() first.');
    }
    return playersDb;
  }
};
