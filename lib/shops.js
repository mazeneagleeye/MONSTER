const { get, run, all } = require('./db');
const { getPlayer, ensurePlayer, spendGold, addGold } = require('./players');

// Create a private shop
async function createShop(ownerId, name) {
  const shopId = `shop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();
  
  await run(
    require('./db').monsterDb,
    `INSERT INTO private_shops (shopId, ownerId, name, items, visitors, createdAt)
     VALUES(?, ?, ?, '[]', '[]', ?)`,
    [shopId, ownerId, name, now]
  );
  
  return { success: true, shopId, name };
}

// Add item to shop
async function addShopItem(shopId, ownerId, item, price) {
  const shop = await getShop(shopId);
  
  if (!shop) {
    return { success: false, message: 'Shop not found!' };
  }
  
  if (shop.ownerId !== ownerId) {
    return { success: false, message: 'You do not own this shop!' };
  }
  
  const items = JSON.parse(shop.items || '[]');
  
  const shopItem = {
    id: `shop_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    item: item,
    price: price,
    listedAt: Date.now()
  };
  
  items.push(shopItem);
  
  await run(
    require('./db').monsterDb,
    `UPDATE private_shops SET items = ? WHERE shopId = ?`,
    [JSON.stringify(items), shopId]
  );
  
  return { success: true, message: `Added ${item.name} to your shop for ${price} gold!` };
}

// Remove item from shop
async function removeShopItem(shopId, ownerId, itemId) {
  const shop = await getShop(shopId);
  
  if (!shop) {
    return { success: false, message: 'Shop not found!' };
  }
  
  if (shop.ownerId !== ownerId) {
    return { success: false, message: 'You do not own this shop!' };
  }
  
  const items = JSON.parse(shop.items || '[]');
  const newItems = items.filter(i => i.id !== itemId);
  
  await run(
    require('./db').monsterDb,
    `UPDATE private_shops SET items = ? WHERE shopId = ?`,
    [JSON.stringify(newItems), shopId]
  );
  
  return { success: true, message: 'Item removed from shop!' };
}

// Buy from private shop
async function buyFromShop(shopId, itemId, buyerId) {
  const shop = await getShop(shopId);
  
  if (!shop) {
    return { success: false, message: 'Shop not found!' };
  }
  
  if (shop.ownerId === buyerId) {
    return { success: false, message: 'Cannot buy from your own shop!' };
  }
  
  const items = JSON.parse(shop.items || '[]');
  const itemIndex = items.findIndex(i => i.id === itemId);
  
  if (itemIndex === -1) {
    return { success: false, message: 'Item not found in shop!' };
  }
  
  const shopItem = items[itemIndex];
  const buyer = await getPlayer(buyerId);
  
  if (buyer.gold < shopItem.price) {
    return { success: false, message: 'Not enough gold!' };
  }
  
  // Transfer gold
  await spendGold(buyerId, shopItem.price);
  await addGold(shop.ownerId, shopItem.price);
  
  // Add item to buyer's inventory
  await require('./players').addToInventory(buyerId, shopItem.item);
  
  // Remove item from shop
  items.splice(itemIndex, 1);
  await run(
    require('./db').monsterDb,
    `UPDATE private_shops SET items = ? WHERE shopId = ?`,
    [JSON.stringify(items), shopId]
  );
  
  // Add to visitors
  const visitors = JSON.parse(shop.visitors || '[]');
  if (!visitors.includes(buyerId)) {
    visitors.push(buyerId);
    await run(
      require('./db').monsterDb,
      `UPDATE private_shops SET visitors = ? WHERE shopId = ?`,
      [JSON.stringify(visitors), shopId]
    );
  }
  
  return { success: true, message: `Purchased ${shopItem.item.name} for ${shopItem.price} gold!` };
}

// Get shop by ID
async function getShop(shopId) {
  const shop = await get(require('./db').monsterDb,
    `SELECT * FROM private_shops WHERE shopId = ?`,
    [shopId]
  );
  
  if (!shop) return null;
  
  const owner = await getPlayer(shop.ownerId);
  
  return {
    ...shop,
    items: JSON.parse(shop.items || '[]'),
    visitors: JSON.parse(shop.visitors || '[]'),
    ownerName: owner ? owner.username : 'Unknown'
  };
}

// Get player's shop
async function getPlayerShop(userId) {
  const shop = await get(require('./db').monsterDb,
    `SELECT * FROM private_shops WHERE ownerId = ?`,
    [userId]
  );
  
  if (!shop) return null;
  
  return await getShop(shop.shopId);
}

// Get all shops
async function getAllShops(limit = 50) {
  const shops = await all(require('./db').monsterDb,
    `SELECT * FROM private_shops ORDER BY createdAt DESC LIMIT ?`,
    [limit]
  );
  
  const shopDetails = [];
  for (const shop of shops) {
    const owner = await getPlayer(shop.ownerId);
    const items = JSON.parse(shop.items || '[]');
    const visitors = JSON.parse(shop.visitors || '[]');
    
    shopDetails.push({
      ...shop,
      items: items,
      visitorCount: visitors.length,
      ownerName: owner ? owner.username : 'Unknown'
    });
  }
  
  return shopDetails;
}

// Delete shop
async function deleteShop(shopId, userId) {
  const shop = await getShop(shopId);
  
  if (!shop) {
    return { success: false, message: 'Shop not found!' };
  }
  
  if (shop.ownerId !== userId) {
    return { success: false, message: 'You do not own this shop!' };
  }
  
  await run(
    require('./db').monsterDb,
    `DELETE FROM private_shops WHERE shopId = ?`,
    [shopId]
  );
  
  return { success: true, message: 'Shop deleted!' };
}

// Search shops
async function searchShops(query, limit = 20) {
  const shops = await getAllShops(100);
  
  return shops.filter(shop => 
    shop.name.toLowerCase().includes(query.toLowerCase()) ||
    shop.ownerName.toLowerCase().includes(query.toLowerCase())
  ).slice(0, limit);
}

module.exports = {
  createShop,
  addShopItem,
  removeShopItem,
  buyFromShop,
  getShop,
  getPlayerShop,
  getAllShops,
  deleteShop,
  searchShops
};