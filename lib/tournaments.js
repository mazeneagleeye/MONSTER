const { get, run, all } = require('./db-adapter');
const { getPlayer } = require('./players');

// Create tournament
async function createTournament(tournamentId, name, type, maxParticipants, rewards = []) {
  const now = Date.now();
  
  await run(require('./db-adapter').getMonsterDb(),
    {
      tournamentId: tournamentId,
      name: name,
      type: type,
      participants: JSON.stringify([]),
      maxParticipants: maxParticipants,
      status: 'open',
      rewards: JSON.stringify(rewards),
      createdAt: now
    }
  );
  
  return { success: true, tournamentId };
}

// Join tournament
async function joinTournament(tournamentId, userId) {
  const tournament = await get(require('./db-adapter').getMonsterDb(),
    { tournamentId: tournamentId }
  );
  
  if (!tournament) {
    return { success: false, message: 'Tournament not found!' };
  }
  
  if (tournament.status !== 'open') {
    return { success: false, message: 'Tournament is not open!' };
  }
  
  const participants = JSON.parse(tournament.participants || '[]');
  if (participants.includes(userId)) {
    return { success: false, message: 'You are already in this tournament!' };
  }
  
  if (participants.length >= tournament.maxParticipants) {
    return { success: false, message: 'Tournament is full!' };
  }
  
  participants.push(userId);
  
  await run(require('./db-adapter').getMonsterDb(),
    { tournamentId: tournamentId },
    { $set: { participants: JSON.stringify(participants) } }
  );
  
  return { success: true, message: 'Joined tournament!' };
}

// Get tournament
async function getTournament(tournamentId) {
  const tournament = await get(require('./db-adapter').getMonsterDb(),
    { tournamentId: tournamentId }
  );
  
  if (!tournament) return null;
  
  return {
    ...tournament,
    participants: JSON.parse(tournament.participants || '[]'),
    rewards: JSON.parse(tournament.rewards || '[]')
  };
}

// Get all tournaments
async function getTournaments(status = null) {
  const filter = {};
  if (status) {
    filter.status = status;
  }
  
  const tournaments = await all(require('./db-adapter').getMonsterDb(),
    filter,
    { sort: { createdAt: -1 } }
  );
  
  return tournaments.map(tournament => ({
    ...tournament,
    participants: JSON.parse(tournament.participants || '[]'),
    rewards: JSON.parse(tournament.rewards || '[]')
  }));
}

// Start tournament
async function startTournament(tournamentId) {
  const tournament = await getTournament(tournamentId);
  
  if (!tournament) {
    return { success: false, message: 'Tournament not found!' };
  }
  
  if (tournament.status !== 'open') {
    return { success: false, message: 'Tournament is not open!' };
  }
  
  await run(require('./db-adapter').getMonsterDb(),
    { tournamentId: tournamentId },
    { $set: { status: 'active' } }
  );
  
  return { success: true, message: 'Tournament started!' };
}

// End tournament
async function endTournament(tournamentId, winnerId) {
  await run(require('./db-adapter').getMonsterDb(),
    { tournamentId: tournamentId },
    { $set: { status: 'ended', winnerId: winnerId } }
  );
  
  return { success: true };
}

// Get tournament leaderboard
async function getTournamentLeaderboard(tournamentId, limit = 10) {
  const tournament = await getTournament(tournamentId);
  
  if (!tournament) {
    return [];
  }
  
  const participants = tournament.participants || [];
  const leaderboard = [];
  
  for (const userId of participants) {
    const player = await getPlayer(userId);
    if (player) {
      leaderboard.push({
        userId: userId,
        username: player.username || player.userId,
        level: player.level,
        totalDamage: player.totalDamage || 0
      });
    }
  }
  
  leaderboard.sort((a, b) => b.totalDamage - a.totalDamage);
  
  return leaderboard.slice(0, limit);
}

module.exports = {
  createTournament,
  joinTournament,
  getTournament,
  getTournaments,
  startTournament,
  endTournament,
  getTournamentLeaderboard
};