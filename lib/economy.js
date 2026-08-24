const { get, run, all } = require('./db-adapter');
const { getPlayer, addGold, spendGold, addGems, spendGems } = require('./players');

// Market fees
const MARKET_FEE_PERCENT = 0.05; // 5% fee
const LISTING_DURATION_DAYS = 7;

// Calculate market fee
function calculateMarketFee(price) {
  return Math.ceil(price * MARKET_FEE_PERCENT);
}

// Create market listing
async function createMarketListing(sellerId, itemType, itemId, price, quantity = 1) {
  const listingId = `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const fee = calculateMarketFee(price * quantity);
  
  // Check if player can afford fee
  const canAfford = await spendGold(sellerId, fee);
  if (!canAfford) {
    return { success: false, message: `Not enough gold for market fee (${fee} gold)` };
  }
  
  await run(require('./db-adapter').getMonsterDb(),
    {
      id: listingId,
      sellerId: sellerId,
      itemType: itemType,
      itemId: itemId,
      price: price,
      quantity: quantity,
      createdAt: Date.now()
    }
  );
  
  return { success: true, listingId, fee };
}

// Get market listings
async function getMarketListings(itemType = null, limit = 50) {
  const filter = itemType ? { itemType: itemType } : {};
  const listings = await all(require('./db-adapter').getMonsterDb(),
    filter,
    { sort: { createdAt: -1 }, limit: limit }
  );
  
  return listings;
}

// Buy from market
async function buyFromMarket(listingId, buyerId) {
  const listing = await get(require('./db-adapter').getMonsterDb(),
    { id: listingId }
  );
  
  if (!listing) {
    return { success: false, message: 'Listing not found!' };
  }
  
  if (listing.sellerId === buyerId) {
    return { success: false, message: 'Cannot buy your own listing!' };
  }
  
  if (listing.quantity <= 0) {
    return { success: false, message: 'Item out of stock!' };
  }
  
  const totalPrice = listing.price * listing.quantity;
  const canAfford = await spendGold(buyerId, totalPrice);
  if (!canAfford) {
    return { success: false, message: 'Not enough gold!' };
  }
  
  // Add gold to seller
  await addGold(listing.sellerId, totalPrice);
  
  // Remove listing or reduce quantity
  if (listing.quantity === 1) {
    await run(require('./db-adapter').getMonsterDb(),
      { id: listingId },
      { $delete: true }
    );
  } else {
    await run(require('./db-adapter').getMonsterDb(),
      { id: listingId },
      { $inc: { quantity: -1 } }
    );
  }
  
  return { success: true, message: 'Purchase successful!' };
}

// Cancel market listing
async function cancelMarketListing(listingId, userId) {
  const listing = await get(require('./db-adapter').getMonsterDb(),
    { id: listingId }
  );
  
  if (!listing) {
    return { success: false, message: 'Listing not found!' };
  }
  
  if (listing.sellerId !== userId) {
    return { success: false, message: 'You do not own this listing!' };
  }
  
  await run(require('./db-adapter').getMonsterDb(),
    { id: listingId },
    { $delete: true }
  );
  
  return { success: true, message: 'Listing cancelled!' };
}

// Trade system
async function createTrade(fromUserId, toUserId, offer, request) {
  const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await run(require('./db-adapter').getMonsterDb(),
    {
      id: tradeId,
      fromUserId: fromUserId,
      toUserId: toUserId,
      offer: JSON.stringify(offer),
      request: JSON.stringify(request),
      status: 'pending',
      createdAt: Date.now()
    }
  );
  
  return { success: true, tradeId };
}

async function acceptTrade(tradeId, userId) {
  const trade = await get(require('./db-adapter').getMonsterDb(),
    { id: tradeId }
  );
  
  if (!trade) {
    return { success: false, message: 'Trade not found!' };
  }
  
  if (trade.toUserId !== userId) {
    return { success: false, message: 'You cannot accept this trade!' };
  }
  
  if (trade.status !== 'pending') {
    return { success: false, message: 'Trade is no longer pending!' };
  }
  
  // Update trade status
  await run(require('./db-adapter').getMonsterDb(),
    { id: tradeId },
    { $set: { status: 'accepted' } }
  );
  
  return { success: true, message: 'Trade accepted!' };
}

async function declineTrade(tradeId, userId) {
  const trade = await get(require('./db-adapter').getMonsterDb(),
    { id: tradeId }
  );
  
  if (!trade) {
    return { success: false, message: 'Trade not found!' };
  }
  
  if (trade.fromUserId !== userId && trade.toUserId !== userId) {
    return { success: false, message: 'You cannot decline this trade!' };
  }
  
  await run(require('./db-adapter').getMonsterDb(),
    { id: tradeId },
    { $set: { status: 'declined' } }
  );
  
  return { success: true, message: 'Trade declined!' };
}

// Mail system
async function sendMail(toUserId, fromUserId, subject, content, attachments = []) {
  const mailId = `mail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await run(require('./db-adapter').getMonsterDb(),
    {
      id: mailId,
      toUserId: toUserId,
      fromUserId: fromUserId,
      subject: subject,
      content: content,
      attachments: JSON.stringify(attachments),
      read: 0,
      createdAt: Date.now()
    }
  );
  
  return { success: true, mailId };
}

async function getMail(userId, unreadOnly = false) {
  const filter = { toUserId: userId };
  if (unreadOnly) {
    filter.read = 0;
  }
  
  const mail = await all(require('./db-adapter').getMonsterDb(),
    filter,
    { sort: { createdAt: -1 } }
  );
  
  return mail;
}

async function markMailRead(mailId, userId) {
  const mail = await get(require('./db-adapter').getMonsterDb(),
    { id: mailId }
  );
  
  if (!mail || mail.toUserId !== userId) {
    return { success: false, message: 'Mail not found!' };
  }
  
  await run(require('./db-adapter').getMonsterDb(),
    { id: mailId },
    { $set: { read: 1 } }
  );
  
  return { success: true };
}

module.exports = {
  MARKET_FEE_PERCENT,
  LISTING_DURATION_DAYS,
  calculateMarketFee,
  createMarketListing,
  getMarketListings,
  buyFromMarket,
  cancelMarketListing,
  createTrade,
  acceptTrade,
  declineTrade,
  sendMail,
  getMail,
  markMailRead
};