// MongoDB connection
let client = null;
let db = null;

// Collection names mapping
const COLLECTIONS = {
  players: 'players',
  player_monsters: 'player_monsters',
  guilds: 'guilds',
  guild_members: 'guild_members',
  market_listings: 'market_listings',
  trades: 'trades',
  mail: 'mail',
  daily_quests: 'daily_quests',
  achievements: 'achievements',
  monster_state: 'monster_state',
  monster_attacks: 'monster_attacks',
  monster_config: 'monster_config',
  monster_history: 'monster_history',
  global_market: 'global_market',
  global_chat: 'global_chat',
  events: 'events',
  event_progress: 'event_progress',
  battle_history: 'battle_history',
  crafting_recipes: 'crafting_recipes',
  daily_dungeon: 'daily_dungeon',
  parties: 'parties',
  tournaments: 'tournaments',
  private_shops: 'private_shops',
  season_rankings: 'season_rankings',
  player_skills: 'player_skills',
  join_reminders: 'join_reminders',
  monsters: 'monsters'
};

// Initialize MongoDB connection
async function init() {
  if (client) return db;

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGODB_URI or MONGO_URI environment variable is required');
  }

  const { MongoClient } = require('mongodb');
  client = new MongoClient(uri);
  
  try {
    await client.connect();
    const dbName = process.env.MONGODB_DB_NAME || 'monster_bot';
    db = client.db(dbName);
    
    console.log('Connected to MongoDB successfully');
    return db;
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    client = null;
    throw err;
  }
}

// Get database instance
function getDb() {
  if (!db) {
    throw new Error('MongoDB not initialized. Call init() first.');
  }
  return db;
}

// Get collection
function getCollection(collectionName) {
  return getDb().collection(COLLECTIONS[collectionName] || collectionName);
}

// Execute a query (insert, update, delete)
async function run(collectionName, operation, filter, update, options = {}) {
  const collection = getCollection(collectionName);
  
  switch (operation) {
    case 'insert':
      return await collection.insertOne(filter, options);
    
    case 'insertMany':
      return await collection.insertMany(filter, options);
    
    case 'update':
      return await collection.updateOne(filter, update, options);
    
    case 'updateMany':
      return await collection.updateMany(filter, update, options);
    
    case 'replace':
      return await collection.replaceOne(filter, filter, options);
    
    case 'delete':
      return await collection.deleteOne(filter, options);
    
    case 'deleteMany':
      return await collection.deleteMany(filter, options);
    
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

// Get single document
async function get(collectionName, filter) {
  const collection = getCollection(collectionName);
  return await collection.findOne(filter);
}

// Get multiple documents
async function all(collectionName, filter = {}) {
  const collection = getCollection(collectionName);
  return await collection.find(filter).toArray();
}

// Close connection
async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

// Check if connected
function isConnected() {
  return client !== null && db !== null;
}

module.exports = {
  init,
  getDb,
  getCollection,
  run,
  get,
  all,
  close,
  isConnected,
  COLLECTIONS
};