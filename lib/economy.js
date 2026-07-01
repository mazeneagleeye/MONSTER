const { get, run, all } = require('./db');
const { getPlayer, spendGold, addGold, getPlayerMonsters, getMonster } = require('./players');
const { createPlayerMonster } = require('./monsters');

// Item types
const ITEM_TYPES = {
  MONSTER: 'monster',
  EQUIPMENT: 'equipment',
  MATERIAL: 'material',
  CONSUMABLE: 'consumable'
};

// Equipment slots
const EQUIPMENT_SLOTS = ['weapon', 'armor', 'accessory', 'helmet'];

// Generate random equipment
function generateEquipment(level = 1) {
  const equipmentNames = {
    weapon: ['Sword', 'Axe', 'Bow', 'Staff', 'Dagger', 'Mace', 'Spear', 'Wand'],
    armor: ['Plate', 'Chainmail', 'Leather', 'Robe', 'Scale', 'Bone'],
    accessory: ['Ring', 'Amulet', 'Bracelet', 'Necklace', 'Earring', 'Charm'],
    helmet: ['Helm', 'Crown', 'Hood', 'Hat', 'Cap', 'Mask']
  };
  
  const prefixes = ['Sharp', 'Sturdy', 'Magical', 'Ancient', 'Cursed', 'Blessed', 'Swift', 'Mighty'];
  const slot = EQUIPMENT_SLOTS[Math.floor(Math.random() * EQUIPMENT_SLOTS.length)];
  const name = equipmentNames[slot][Math.floor(Math.random() * equipmentNames[slot].length)];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  
  const rarity = Math.random() < 0.1 ? 'Legendary' : 
                 Math.random() < 0.3 ? 'Rare' : 
                 Math.random() < 0.6 ? 'Uncommon' : 'Common';
  
  const stats = {
    attack: Math.floor(Math.random() * 10 * level) + 1,
    defense: Math.floor(Math.random() * 10 * level) + 1,
    speed: Math.floor(Math.random() * 5 * level) + 1
  };
  
  return {
    id: `equip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: `${prefix} ${name}`,
    type: ITEM_TYPES.EQUIPMENT,
    slot,
    rarity,
    level,
    stats,
    price: Math.floor((stats.attack + stats.defense + stats.speed) * 10)
  };
}

// Generate materials
function generateMaterial() {
  const materials = [
    { name: 'Iron Ore', rarity: 'Common', price: 10 },
    { name: 'Gold Ore', rarity: 'Uncommon', price: 25 },
    { name: 'Crystal', rarity: 'Rare', price: 50 },
    { name: 'Dragon Scale', rarity: 'Epic', price: 100 },
    { name: 'Star Fragment', rarity: 'Legendary', price: 250 },
    { name: 'Monster Essence', rarity: 'Common', price: 5 },
    { name: 'Magic Dust', rarity: 'Uncommon', price: 15 },
    { name: 'Ancient Rune', rarity: 'Rare', price: 75 }
  ];
  
  const material = materials[Math.floor(Math.random() * materials.length)];
  
  return {
    id: `mat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: material.name,
    type: ITEM_TYPES.MATERIAL,
    rarity: material.rarity,
    price: material.price
  };
}

// Marketplace functions
async function listItem(userId, item, price, quantity = 1) {
  const listingId = `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();
  
  await run(
    require('./db').playersDb,
    `INSERT INTO market_listings (id, sellerId, itemType, itemId, price, quantity, createdAt)
     VALUES(?, ?, ?, ?, ?, ?, ?)`,
    [listingId, userId, item.type, item.id, price, quantity, now]
  );
  
  return { success: true, listingId };
}

async function buyItem(listingId, buyerId, quantity = 1) {
  const listing = await get(require('./db').playersDb,
    `SELECT * FROM market_listings WHERE id = ?`,
    [listingId]
  );
  
  if (!listing) {
    return { success: false, message: 'Listing not found!' };
  }
  
  if (listing.sellerId === buyerId) {
    return { success: false, message: 'Cannot buy your own listing!' };
  }
  
  if (listing.quantity < quantity) {
    return { success: false, message: 'Not enough items in stock!' };
  }
  
  const totalPrice = listing.price * quantity;
  const buyer = await getPlayer(buyerId);
  
  if (buyer.gold < totalPrice) {
    return { success: false, message: 'Not enough gold!' };
  }
  
  // Transfer gold
  await spendGold(buyerId, totalPrice);
  await addGold(listing.sellerId, totalPrice);
  
  // Update listing quantity
  const newQuantity = listing.quantity - quantity;
  if (newQuantity <= 0) {
    await run(require('./db').playersDb,
      `DELETE FROM market_listings WHERE id = ?`,
      [listingId]
    );
  } else {
    await run(require('./db').playersDb,
      `UPDATE market_listings SET quantity = ? WHERE id = ?`,
      [newQuantity, listingId]
    );
  }
  
  // Add item to buyer's inventory
  const item = {
    id: listing.itemId,
    type: listing.itemType,
    ...JSON.parse(listing.itemId)
  };
  
  await require('./players').addToInventory(buyerId, item);
  
  return { success: true, message: `Purchased ${quantity} item(s) for ${totalPrice} gold!` };
}

async function getMarketListings(itemType = null, limit = 50) {
  let query = `SELECT * FROM market_listings`;
  const params = [];
  
  if (itemType) {
    query += ` WHERE itemType = ?`;
    params.push(itemType);
  }
  
  query += ` ORDER BY createdAt DESC LIMIT ?`;
  params.push(limit);
  
  const rows = await all(require('./db').playersDb, query, params);
  
  return rows.map(row => ({
    ...row,
    item: JSON.parse(row.itemId)
  }));
}

async function cancelListing(listingId, userId) {
  const listing = await get(require('./db').playersDb,
    `SELECT * FROM market_listings WHERE id = ?`,
    [listingId]
  );
  
  if (!listing) {
    return { success: false, message: 'Listing not found!' };
  }
  
  if (listing.sellerId !== userId) {
    return { success: false, message: 'You cannot cancel someone else\'s listing!' };
  }
  
  await run(require('./db').playersDb,
    `DELETE FROM market_listings WHERE id = ?`,
    [listingId]
  );
  
  return { success: true, message: 'Listing cancelled!' };
}

// Trading functions
async function createTrade(fromUserId, toUserId, offer, request) {
  const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();
  
  await run(
    require('./db').playersDb,
    `INSERT INTO trades (id, fromUserId, toUserId, offer, request, status, createdAt)
     VALUES(?, ?, ?, ?, ?, 'pending', ?)`,
    [tradeId, fromUserId, toUserId, JSON.stringify(offer), JSON.stringify(request), now]
  );
  
  return { success: true, tradeId };
}

async function acceptTrade(tradeId, userId) {
  const trade = await get(require('./db').playersDb,
    `SELECT * FROM trades WHERE id = ? AND status = 'pending'`,
    [tradeId]
  );
  
  if (!trade) {
    return { success: false, message: 'Trade not found or already completed!' };
  }
  
  if (trade.toUserId !== userId) {
    return { success: false, message: 'You cannot accept this trade!' };
  }
  
  const offer = JSON.parse(trade.offer);
  const request = JSON.parse(trade.request);
  
  // Execute trade
  await run(require('./db').playersDb,
    `UPDATE trades SET status = 'completed' WHERE id = ?`,
    [tradeId]
  );
  
  return { success: true, message: 'Trade completed!' };
}

async function declineTrade(tradeId, userId) {
  const trade = await get(require('./db').playersDb,
    `SELECT * FROM trades WHERE id = ? AND status = 'pending'`,
    [tradeId]
  );
  
  if (!trade) {
    return { success: false, message: 'Trade not found or already completed!' };
  }
  
  if (trade.toUserId !== userId && trade.fromUserId !== userId) {
    return { success: false, message: 'You cannot decline this trade!' };
  }
  
  await run(require('./db').playersDb,
    `UPDATE trades SET status = 'declined' WHERE id = ?`,
    [tradeId]
  );
  
  return { success: true, message: 'Trade declined!' };
}

// Mail functions
async function sendMail(fromUserId, toUserId, subject, content, attachments = []) {
  const mailId = `mail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();
  
  await run(
    require('./db').playersDb,
    `INSERT INTO mail (id, toUserId, fromUserId, subject, content, attachments, read, createdAt)
     VALUES(?, ?, ?, ?, ?, ?, 0, ?)`,
    [mailId, toUserId, fromUserId, subject, content, JSON.stringify(attachments), now]
  );
  
  return { success: true, mailId };
}

async function getMail(userId, limit = 50) {
  const mails = await all(require('./db').playersDb,
    `SELECT * FROM mail WHERE toUserId = ? ORDER BY createdAt DESC LIMIT ?`,
    [userId, limit]
  );
  
  return mails.map(mail => ({
    ...mail,
    attachments: JSON.parse(mail.attachments || '[]')
  }));
}

async function readMail(mailId, userId) {
  await run(require('./db').playersDb,
    `UPDATE mail SET read = 1 WHERE id = ? AND toUserId = ?`,
    [mailId, userId]
  );
  
  const mail = await get(require('./db').playersDb,
    `SELECT * FROM mail WHERE id = ?`,
    [mailId]
  );
  
  return mail;
}

async function deleteMail(mailId, userId) {
  await run(require('./db').playersDb,
    `DELETE FROM mail WHERE id = ? AND toUserId = ?`,
    [mailId, userId]
  );
  
  return { success: true };
}

// Crafting functions
async function getCraftingRecipes() {
  const recipes = await all(require('./db').monsterDb,
    `SELECT * FROM crafting_recipes`
  );
  
  return recipes.map(recipe => ({
    ...recipe,
    ingredients: JSON.parse(recipe.ingredients),
    result: JSON.parse(recipe.result)
  }));
}

async function craftItem(userId, recipeId) {
  const recipe = await get(require('./db').monsterDb,
    `SELECT * FROM crafting_recipes WHERE recipeId = ?`,
    [recipeId]
  );
  
  if (!recipe) {
    return { success: false, message: 'Recipe not found!' };
  }
  
  const ingredients = JSON.parse(recipe.ingredients);
  const result = JSON.parse(recipe.result);
  
  // Check if player has ingredients
  const player = await getPlayer(userId);
  const inventory = JSON.parse(player.inventory || '[]');
  
  for (const ingredient of ingredients) {
    const hasItem = inventory.find(i => i.id === ingredient.id && i.quantity >= ingredient.quantity);
    if (!hasItem) {
      return { success: false, message: `Missing ingredient: ${ingredient.name}` };
    }
  }
  
  // Remove ingredients
  for (const ingredient of ingredients) {
    const itemIndex = inventory.findIndex(i => i.id === ingredient.id);
    if (itemIndex >= 0) {
      inventory[itemIndex].quantity -= ingredient.quantity;
      if (inventory[itemIndex].quantity <= 0) {
        inventory.splice(itemIndex, 1);
      }
    }
  }
  
  // Add result
  const resultItem = {
    ...result,
    quantity: result.quantity || 1
  };
  inventory.push(resultItem);
  
  await run(require('./db').playersDb,
    `UPDATE players SET inventory = ? WHERE userId = ?`,
    [JSON.stringify(inventory), userId]
  );
  
  return { success: true, message: `Crafted ${result.name}!` };
}

// Fishing, Mining, Farming, Cooking, Alchemy
async function gatherResource(userId, activity) {
  const energyCost = 5;
  const canGather = await spendEnergy(userId, energyCost);
  if (!canGather) {
    return { success: false, message: 'Not enough energy!' };
  }
  
  const player = await getPlayer(userId);
  const skillLevel = player[`${activity}Skill`] || 1;
  
  const resources = {
    fishing: [
      { name: 'Fish', rarity: 'Common', price: 5 },
      { name: 'Rare Fish', rarity: 'Uncommon', price: 15 },
      { name: 'Golden Fish', rarity: 'Rare', price: 50 }
    ],
    mining: [
      { name: 'Stone', rarity: 'Common', price: 3 },
      { name: 'Iron', rarity: 'Uncommon', price: 10 },
      { name: 'Gold', rarity: 'Rare', price: 30 },
      { name: 'Diamond', rarity: 'Epic', price: 100 }
    ],
    farming: [
      { name: 'Wheat', rarity: 'Common', price: 2 },
      { name: 'Vegetables', rarity: 'Uncommon', price: 8 },
      { name: 'Fruit', rarity: 'Rare', price: 25 }
    ],
    cooking: [
      { name: 'Basic Meal', rarity: 'Common', price: 10 },
      { name: 'Gourmet Dish', rarity: 'Rare', price: 50 }
    ],
    alchemy: [
      { name: 'Potion', rarity: 'Common', price: 15 },
      { name: 'Elixir', rarity: 'Rare', price: 75 },
      { name: 'Legendary Potion', rarity: 'Legendary', price: 200 }
    ]
  };
  
  const activityResources = resources[activity] || resources.fishing;
  const rarityRoll = Math.random();
  let selectedRarity = 'Common';
  
  if (rarityRoll < 0.05 * skillLevel) selectedRarity = 'Legendary';
  else if (rarityRoll < 0.15 * skillLevel) selectedRarity = 'Epic';
  else if (rarityRoll < 0.35 * skillLevel) selectedRarity = 'Rare';
  else if (rarityRoll < 0.65 * skillLevel) selectedRarity = 'Uncommon';
  
  const availableResources = activityResources.filter(r => r.rarity === selectedRarity);
  const resource = availableResources[Math.floor(Math.random() * availableResources.length)] || activityResources[0];
  
  // Add to inventory
  const item = {
    id: `${activity}_${Date.now()}`,
    name: resource.name,
    type: ITEM_TYPES.MATERIAL,
    rarity: resource.rarity,
    quantity: 1
  };
  
  await require('./players').addToInventory(userId, item);
  
  // Add skill XP
  await run(require('./db').monsterDb,
    `INSERT OR REPLACE INTO player_skills (userId, skill, level, xp)
     VALUES(?, ?, ?, COALESCE((SELECT xp FROM player_skills WHERE userId = ? AND skill = ?), 0) + 10)
     ON CONFLICT(userId, skill) DO UPDATE SET xp = xp + 10`,
    [userId, activity, skillLevel, userId, activity]
  );
  
  return {
    success: true,
    resource: item,
    message: `Gathered ${resource.name}!`
  };
}

module.exports = {
  ITEM_TYPES,
  EQUIPMENT_SLOTS,
  generateEquipment,
  generateMaterial,
  listItem,
  buyItem,
  getMarketListings,
  cancelListing,
  createTrade,
  acceptTrade,
  declineTrade,
  sendMail,
  getMail,
  readMail,
  deleteMail,
  getCraftingRecipes,
  craftItem,
  gatherResource
};