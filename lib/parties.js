const { get, run, all } = require('./db');
const { getPlayer, ensurePlayer } = require('./players');

// Create a party
async function createParty(leaderId, activity) {
  const partyId = `party_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();
  
  await run(
    require('./db').monsterDb,
    `INSERT INTO parties (partyId, leaderId, members, activity, status, createdAt)
     VALUES(?, ?, ?, ?, 'open', ?)`,
    [partyId, leaderId, JSON.stringify([leaderId]), activity, now]
  );
  
  return { success: true, partyId, activity };
}

// Join a party
async function joinParty(partyId, userId) {
  const party = await getParty(partyId);
  
  if (!party) {
    return { success: false, message: 'Party not found!' };
  }
  
  if (party.status !== 'open') {
    return { success: false, message: 'This party is no longer accepting members!' };
  }
  
  const members = JSON.parse(party.members || '[]');
  
  if (members.length >= 4) {
    return { success: false, message: 'Party is full!' };
  }
  
  if (members.includes(userId)) {
    return { success: false, message: 'You are already in this party!' };
  }
  
  members.push(userId);
  
  await run(
    require('./db').monsterDb,
    `UPDATE parties SET members = ? WHERE partyId = ?`,
    [JSON.stringify(members), partyId]
  );
  
  return { success: true, message: `Joined ${party.leaderId}'s party!` };
}

// Leave a party
async function leaveParty(partyId, userId) {
  const party = await getParty(partyId);
  
  if (!party) {
    return { success: false, message: 'Party not found!' };
  }
  
  const members = JSON.parse(party.members || '[]');
  const newMembers = members.filter(id => id !== userId);
  
  if (newMembers.length === 0) {
    // Disband party if empty
    await run(
      require('./db').monsterDb,
      `DELETE FROM parties WHERE partyId = ?`,
      [partyId]
    );
    return { success: true, message: 'Party disbanded!' };
  }
  
  // If leader left, transfer leadership
  if (party.leaderId === userId && newMembers.length > 0) {
    const newLeader = newMembers[0];
    await run(
      require('./db').monsterDb,
      `UPDATE parties SET leaderId = ?, members = ? WHERE partyId = ?`,
      [newLeader, JSON.stringify(newMembers), partyId]
    );
    return { success: true, message: `Left party. ${newLeader} is now the leader.` };
  }
  
  await run(
    require('./db').monsterDb,
    `UPDATE parties SET members = ? WHERE partyId = ?`,
    [JSON.stringify(newMembers), partyId]
  );
  
  return { success: true, message: 'Left the party!' };
}

// Get party by ID
async function getParty(partyId) {
  const party = await get(require('./db').monsterDb,
    `SELECT * FROM parties WHERE partyId = ?`,
    [partyId]
  );
  
  if (!party) return null;
  
  // Get member details
  const members = JSON.parse(party.members || '[]');
  const memberDetails = [];
  
  for (const memberId of members) {
    const player = await getPlayer(memberId);
    if (player) {
      memberDetails.push({
        userId: memberId,
        username: player.username,
        level: player.level,
        isLeader: memberId === party.leaderId
      });
    }
  }
  
  return {
    ...party,
    members: memberDetails
  };
}

// Get player's party
async function getPlayerParty(userId) {
  const parties = await all(require('./db').monsterDb,
    `SELECT * FROM parties WHERE members LIKE ?`,
    [`%${userId}%`]
  );
  
  if (parties.length === 0) return null;
  
  return await getParty(parties[0].partyId);
}

// Get open parties
async function getOpenParties(activity = null) {
  let query = `SELECT * FROM parties WHERE status = 'open'`;
  const params = [];
  
  if (activity) {
    query += ` AND activity = ?`;
    params.push(activity);
  }
  
  query += ` ORDER BY createdAt DESC LIMIT 20`;
  
  const parties = await all(require('./db').monsterDb, query, params);
  
  const partyDetails = [];
  for (const party of parties) {
    const members = JSON.parse(party.members || '[]');
    partyDetails.push({
      ...party,
      memberCount: members.length
    });
  }
  
  return partyDetails;
}

// Disband party
async function disbandParty(partyId, userId) {
  const party = await getParty(partyId);
  
  if (!party) {
    return { success: false, message: 'Party not found!' };
  }
  
  if (party.leaderId !== userId) {
    return { success: false, message: 'Only the party leader can disband the party!' };
  }
  
  await run(
    require('./db').monsterDb,
    `DELETE FROM parties WHERE partyId = ?`,
    [partyId]
  );
  
  return { success: true, message: 'Party disbanded!' };
}

// Start party activity
async function startPartyActivity(partyId, userId) {
  const party = await getParty(partyId);
  
  if (!party) {
    return { success: false, message: 'Party not found!' };
  }
  
  if (party.leaderId !== userId) {
    return { success: false, message: 'Only the party leader can start the activity!' };
  }
  
  await run(
    require('./db').monsterDb,
    `UPDATE parties SET status = 'active' WHERE partyId = ?`,
    [partyId]
  );
  
  return { success: true, message: `Started ${party.activity}!` };
}

module.exports = {
  createParty,
  joinParty,
  leaveParty,
  getParty,
  getPlayerParty,
  getOpenParties,
  disbandParty,
  startPartyActivity
};