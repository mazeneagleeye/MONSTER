const { get, run, all } = require('./db-adapter');
const { getPlayer } = require('./players');

// Create party
async function createParty(leaderId, activity) {
  const partyId = `party_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();
  
  await run(require('./db-adapter').getMonsterDb(),
    {
      partyId: partyId,
      leaderId: leaderId,
      members: JSON.stringify([leaderId]),
      activity: activity,
      status: 'open',
      createdAt: now
    }
  );
  
  return { success: true, partyId };
}

// Join party
async function joinParty(partyId, userId) {
  const party = await get(require('./db-adapter').getMonsterDb(),
    { partyId: partyId }
  );
  
  if (!party) {
    return { success: false, message: 'Party not found!' };
  }
  
  if (party.status !== 'open') {
    return { success: false, message: 'Party is not open!' };
  }
  
  const members = JSON.parse(party.members || '[]');
  if (members.includes(userId)) {
    return { success: false, message: 'You are already in this party!' };
  }
  
  members.push(userId);
  
  await run(require('./db-adapter').getMonsterDb(),
    { partyId: partyId },
    { $set: { members: JSON.stringify(members) } }
  );
  
  return { success: true, message: 'Joined party!' };
}

// Leave party
async function leaveParty(partyId, userId) {
  const party = await get(require('./db-adapter').getMonsterDb(),
    { partyId: partyId }
  );
  
  if (!party) {
    return { success: false, message: 'Party not found!' };
  }
  
  const members = JSON.parse(party.members || '[]');
  const newMembers = members.filter(id => id !== userId);
  
  if (newMembers.length === 0) {
    // Disband party if empty
    await run(require('./db-adapter').getMonsterDb(),
      { partyId: partyId },
      { $delete: true }
    );
  } else {
    await run(require('./db-adapter').getMonsterDb(),
      { partyId: partyId },
      { $set: { members: JSON.stringify(newMembers) } }
    );
  }
  
  return { success: true, message: 'Left party!' };
}

// Get party
async function getParty(partyId) {
  const party = await get(require('./db-adapter').getMonsterDb(),
    { partyId: partyId }
  );
  
  if (!party) return null;
  
  return {
    ...party,
    members: JSON.parse(party.members || '[]')
  };
}

// Get player's party
async function getPlayerParty(userId) {
  const parties = await all(require('./db-adapter').getMonsterDb(),
    {},
    { sort: { createdAt: -1 } }
  );
  
  for (const party of parties) {
    const members = JSON.parse(party.members || '[]');
    if (members.includes(userId)) {
      return {
        ...party,
        members: members
      };
    }
  }
  
  return null;
}

// Get all open parties
async function getOpenParties(activity = null) {
  const filter = { status: 'open' };
  if (activity) {
    filter.activity = activity;
  }
  
  const parties = await all(require('./db-adapter').getMonsterDb(),
    filter,
    { sort: { createdAt: -1 } }
  );
  
  return parties.map(party => ({
    ...party,
    members: JSON.parse(party.members || '[]')
  }));
}

// Close party
async function closeParty(partyId, userId) {
  const party = await get(require('./db-adapter').getMonsterDb(),
    { partyId: partyId }
  );
  
  if (!party) {
    return { success: false, message: 'Party not found!' };
  }
  
  if (party.leaderId !== userId) {
    return { success: false, message: 'Only the party leader can close the party!' };
  }
  
  await run(require('./db-adapter').getMonsterDb(),
    { partyId: partyId },
    { $set: { status: 'closed' } }
  );
  
  return { success: true, message: 'Party closed!' };
}

// Disband party
async function disbandParty(partyId, userId) {
  const party = await get(require('./db-adapter').getMonsterDb(),
    { partyId: partyId }
  );
  
  if (!party) {
    return { success: false, message: 'Party not found!' };
  }
  
  if (party.leaderId !== userId) {
    return { success: false, message: 'Only the party leader can disband the party!' };
  }
  
  await run(require('./db-adapter').getMonsterDb(),
    { partyId: partyId },
    { $delete: true }
  );
  
  return { success: true, message: 'Party disbanded!' };
}

module.exports = {
  createParty,
  joinParty,
  leaveParty,
  getParty,
  getPlayerParty,
  getOpenParties,
  closeParty,
  disbandParty
};