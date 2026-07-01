const { get, run, all } = require('./db');
const { getPlayer, ensurePlayer } = require('./players');

// Tournament types
const TOURNAMENT_TYPES = {
  SINGLE_ELIMINATION: 'single_elimination',
  DOUBLE_ELIMINATION: 'double_elimination',
  ROUND_ROBIN: 'round_robin',
  SURVIVAL: 'survival'
};

// Create a tournament
async function createTournament(creatorId, name, type, maxParticipants = 8) {
  const tournamentId = `tournament_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();
  
  const rewards = {
    single_elimination: { xp: 500, gold: 250, gems: 10, title: 'Champion' },
    double_elimination: { xp: 750, gold: 375, gems: 15, title: 'Undefeated' },
    round_robin: { xp: 400, gold: 200, gems: 8, title: 'Master' },
    survival: { xp: 600, gold: 300, gems: 12, title: 'Survivor' }
  };
  
  await run(
    require('./db').monsterDb,
    `INSERT INTO tournaments (tournamentId, name, type, participants, maxParticipants, status, rewards, createdAt)
     VALUES(?, ?, ?, '[]', ?, 'open', ?, ?)`,
    [tournamentId, name, type, maxParticipants, JSON.stringify(rewards[type] || rewards.single_elimination), now]
  );
  
  return { success: true, tournamentId, name, type };
}

// Join a tournament
async function joinTournament(tournamentId, userId) {
  const tournament = await getTournament(tournamentId);
  
  if (!tournament) {
    return { success: false, message: 'Tournament not found!' };
  }
  
  if (tournament.status !== 'open') {
    return { success: false, message: 'This tournament is no longer accepting participants!' };
  }
  
  const participants = JSON.parse(tournament.participants || '[]');
  
  if (participants.length >= tournament.maxParticipants) {
    return { success: false, message: 'Tournament is full!' };
  }
  
  if (participants.includes(userId)) {
    return { success: false, message: 'You are already in this tournament!' };
  }
  
  participants.push(userId);
  
  await run(
    require('./db').monsterDb,
    `UPDATE tournaments SET participants = ? WHERE tournamentId = ?`,
    [JSON.stringify(participants), tournamentId]
  );
  
  return { success: true, message: `Joined tournament: ${tournament.name}!` };
}

// Leave a tournament
async function leaveTournament(tournamentId, userId) {
  const tournament = await getTournament(tournamentId);
  
  if (!tournament) {
    return { success: false, message: 'Tournament not found!' };
  }
  
  if (tournament.status !== 'open') {
    return { success: false, message: 'Cannot leave a tournament that has started!' };
  }
  
  const participants = JSON.parse(tournament.participants || '[]');
  const newParticipants = participants.filter(id => id !== userId);
  
  await run(
    require('./db').monsterDb,
    `UPDATE tournaments SET participants = ? WHERE tournamentId = ?`,
    [JSON.stringify(newParticipants), tournamentId]
  );
  
  return { success: true, message: 'Left the tournament!' };
}

// Get tournament by ID
async function getTournament(tournamentId) {
  const tournament = await get(require('./db').monsterDb,
    `SELECT * FROM tournaments WHERE tournamentId = ?`,
    [tournamentId]
  );
  
  if (!tournament) return null;
  
  const participants = JSON.parse(tournament.participants || '[]');
  const rewards = JSON.parse(tournament.rewards || '{}');
  
  return {
    ...tournament,
    participants,
    rewards,
    participantCount: participants.length
  };
}

// Get open tournaments
async function getOpenTournaments(type = null) {
  let query = `SELECT * FROM tournaments WHERE status = 'open'`;
  const params = [];
  
  if (type) {
    query += ` AND type = ?`;
    params.push(type);
  }
  
  query += ` ORDER BY createdAt DESC LIMIT 20`;
  
  const tournaments = await all(require('./db').monsterDb, query, params);
  
  return tournaments.map(t => ({
    ...t,
    rewards: JSON.parse(t.rewards || '{}'),
    participantCount: JSON.parse(t.participants || '[]').length
  }));
}

// Start tournament
async function startTournament(tournamentId, userId) {
  const tournament = await getTournament(tournamentId);
  
  if (!tournament) {
    return { success: false, message: 'Tournament not found!' };
  }
  
  // In a real implementation, you'd check if the user is the creator or has permission
  const participants = JSON.parse(tournament.participants || '[]');
  
  if (participants.length < 2) {
    return { success: false, message: 'Not enough participants to start!' };
  }
  
  await run(
    require('./db').monsterDb,
    `UPDATE tournaments SET status = 'active' WHERE tournamentId = ?`,
    [tournamentId]
  );
  
  return { success: true, message: `Tournament ${tournament.name} has started!`, participants };
}

// End tournament and award winner
async function endTournament(tournamentId, winnerId) {
  const tournament = await getTournament(tournamentId);
  
  if (!tournament) {
    return { success: false, message: 'Tournament not found!' };
  }
  
  const { addXP, addGold, addGems, addTitle } = require('./players');
  
  // Award winner
  if (tournament.rewards.xp) await addXP(winnerId, tournament.rewards.xp);
  if (tournament.rewards.gold) await addGold(winnerId, tournament.rewards.gold);
  if (tournament.rewards.gems) await addGems(winnerId, tournament.rewards.gems);
  if (tournament.rewards.title) await addTitle(winnerId, tournament.rewards.title);
  
  await run(
    require('./db').monsterDb,
    `UPDATE tournaments SET status = 'completed' WHERE tournamentId = ?`,
    [tournamentId]
  );
  
  return { success: true, message: `Tournament ended! Winner: ${winnerId}` };
}

// Cancel tournament
async function cancelTournament(tournamentId, userId) {
  const tournament = await getTournament(tournamentId);
  
  if (!tournament) {
    return { success: false, message: 'Tournament not found!' };
  }
  
  await run(
    require('./db').monsterDb,
    `UPDATE tournaments SET status = 'cancelled' WHERE tournamentId = ?`,
    [tournamentId]
  );
  
  return { success: true, message: 'Tournament cancelled!' };
}

module.exports = {
  TOURNAMENT_TYPES,
  createTournament,
  joinTournament,
  leaveTournament,
  getTournament,
  getOpenTournaments,
  startTournament,
  endTournament,
  cancelTournament
};