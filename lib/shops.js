const { get, run, all } = require('./db-adapter');
const { getPlayer, addGold, spendGold, addGems, spendGems, addToInventory } = require('./players');

// Shop items
const SHOP_ITEMS = {
  // Consumables
  health_potion: { id: 'health_potion', name: 'Health Potion', type: 'consumable', price: 50, currency: 'gold', description: 'Restores 50 HP' },
  energy_potion: { id: 'energy_potion', name: 'Energy Potion', type: 'consumable', price: 30, currency: 'gold', description: 'Restores 30 Energy' },
  rare_egg: { id: 'rare_egg', name: 'Rare Egg', type: 'consumable', price: 100, currency: 'gems', description: 'Contains a rare monster' },
  
  // Equipment
  iron_sword: { id: 'iron_sword', name: 'Iron Sword', type: 'weapon', price: 200, currency: 'gold', attack: 10, description: 'A basic iron sword' },
  steel_sword: { id: 'steel_sword', name: 'Steel Sword', type: 'weapon', price: 500, currency: 'gold', attack: 25, description: 'A sturdy steel sword' },
  magic_sword: { id: 'magic_sword', name: 'Magic Sword', type: 'weapon', price: 50, currency: 'gems', attack: 50, description: 'A sword imbued with magic' },
  
  leather_armor: { id: 'leather_armor', name: 'Leather Armor', type: 'armor', price: 150, currency: 'gold', defense: 8, description: 'Basic leather protection' },
  chain_mail: { id: 'chain_mail', name: 'Chain Mail', type: 'armor', price: 400, currency: 'gold', defense: 20, description: 'Interlocking metal rings' },
  magic_armor: { id: 'magic_armor', name: 'Magic Armor', type: 'armor', price: 80, currency: 'gems', defense: 40, description: 'Enchanted protective armor' },
  
  // Accessories
  power_ring: { id: 'power_ring', name: 'Power Ring', type: 'accessory', price: 300, currency: 'gold', attack: 5, description: 'Increases attack power' },
  defense_amulet: { id: 'defense_amulet', name: 'Defense Amulet', type: 'accessory', price: 300, currency: 'gold', defense: 5, description: 'Increases defense' },
  
  // Special
  monster_food: { id: 'monster_food', name: 'Monster Food', type: 'special', price: 20, currency: 'gold', description: 'Increases monster happiness' },
  knowledge_book: { id: 'knowledge_book', name: 'Knowledge Book', type: 'special', price: 100, currency: 'gems', description: 'Used to upgrade work skills' }
};

// Buy item from shop
async function buyItem(userId, itemId, quantity = 1) {
  const item = SHOP_ITEMS[itemId];
  
  if (!item) {
    return { success: false, message: 'Item not found!' };
  }
  
  const totalPrice = item.price * quantity;
  
  // Check currency
  if (item.currency === 'gold') {
    const canAfford = await spendGold(userId, totalPrice);
    if (!canAfford) {
      return { success: false, message: `Not enough gold! Need ${totalPrice} gold` };
    }
  } else if (item.currency === 'gems') {
    const canAfford = await spendGems(userId, totalPrice);
    if (!canAfford) {
      return { success: false, message: `Not enough gems! Need ${totalPrice} gems` };
    }
  }
  
  // Add to inventory
  for (let i = 0; i < quantity; i++) {
    await addToInventory(userId, {
      id: `${itemId}_${Date.now()}_${i}`,
      name: item.name,
      type: item.type,
      description: item.description,
      attack: item.attack || 0,
      defense: item.defense || 0
    });
  }
  
  return { success: true, message: `Purchased ${quantity}x ${item.name}` };
}

// Get shop items
function getShopItems(category = null) {
  if (!category) {
    return Object.values(SHOP_ITEMS);
  }
  
  return Object.values(SHOP_ITEMS).filter(item => item.type === category);
}

// Sell item (50% of original price)
async function sellItem(userId, itemId) {
  const player = await getPlayer(userId);
  const inventory = JSON.parse(player.inventory || '[]');
  
  const itemIndex = inventory.findIndex(item => item.id === itemId);
  if (itemIndex === -1) {
    return { success: false, message: 'Item not found in inventory!' };
  }
  
  const item = inventory[itemIndex];
  const shopItem = Object.values(SHOP_ITEMS).find(si => si.name === item.name);
  
  if (!shopItem) {
    return { success: false, message: 'This item cannot be sold!' };
  }
  
  const sellPrice = Math.floor(shopItem.price * 0.5);
  
  // Remove from inventory
  inventory.splice(itemIndex, 1);
  await run(require('./db-adapter').getPlayersDb(),
    { userId: userId },
    { $set: { inventory: JSON.stringify(inventory) } }
  );
  
  // Add gold
  await addGold(userId, sellPrice);
  
  return { success: true, message: `Sold ${item.name} for ${sellPrice} gold` };
}

// Private shop functions
async function createPrivateShop(ownerId, shopName, items = []) {
  const shopId = `shop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();
  
  await run(require('./db-adapter').getMonsterDb(),
    {
      shopId: shopId,
      ownerId: ownerId,
      name: shopName,
      items: JSON.stringify(items),
      visitors: JSON.stringify([]),
      createdAt: now
    }
  );
  
  return { success: true, shopId };
}

async function getPrivateShop(shopId) {
  const shop = await get(require('./db-adapter').getMonsterDb(),
    { shopId: shopId }
  );
  
  if (!shop) return null;
  
  return {
    ...shop,
    items: JSON.parse(shop.items || '[]'),
    visitors: JSON.parse(shop.visitors || '[]')
  };
}

async function getAllPrivateShops() {
  const shops = await all(require('./db-adapter').getMonsterDb(),
    {},
    { sort: { createdAt: -1 } }
  );
  
  return shops.map(shop => ({
    ...shop,
    items: JSON.parse(shop.items || '[]'),
    visitors: JSON.parse(shop.visitors || '[]')
  }));
}

async function addShopItem(shopId, item) {
  const shop = await getPrivateShop(shopId);
  
  if (!shop) {
    return { success: false, message: 'Shop not found!' };
  }
  
  const items = shop.items || [];
  items.push({
    ...item,
    addedAt: Date.now()
  });
  
  await run(require('./db-adapter').getMonsterDb(),
    { shopId: shopId },
    { $set: { items: JSON.stringify(items) } }
  );
  
  return { success: true, message: 'Item added to shop!' };
}

async function removeShopItem(shopId, itemId) {
  const shop = await getPrivateShop(shopId);
  
  if (!shop) {
    return { success: false, message: 'Shop not found!' };
  }
  
  const items = (shop.items || []).filter(item => item.id !== itemId);
  
  await run(require('./db-adapter').getMonsterDb(),
    { shopId: shopId },
    { $set: { items: JSON.stringify(items) } }
  );
  
  return { success: true, message: 'Item removed from shop!' };
}

async function visitShop(shopId, userId) {
  const shop = await getPrivateShop(shopId);
  
  if (!shop) {
    return { success: false, message: 'Shop not found!' };
  }
  
  const visitors = shop.visitors || [];
  if (!visitors.includes(userId)) {
    visitors.push(userId);
    
    await run(require('./db-adapter').getMonsterDb(),
      { shopId: shopId },
      { $set: { visitors: JSON.stringify(visitors) } }
    );
  }
  
  return { success: true, shop };
}

module.exports = {
  SHOP_ITEMS,
  buyItem,
  getShopItems,
  sellItem,
  createPrivateShop,
  getPrivateShop,
  getAllPrivateShops,
  addShopItem,
  removeShopItem,
  visitShop
};