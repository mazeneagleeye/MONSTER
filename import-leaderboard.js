const fs = require('fs');
const path = require('path');
const db = require('./lib/db-adapter');

async function importLeaderboardEntry(entry) {
  const userId = String(entry.userId || entry.id || '');
  if (!userId) return false;

  const totalDamage = Number(entry.damage || 0);
  if (db.getDbType() === 'mongodb') {
    await db.run(db.getPlayersDb(), { userId }, { $set: { totalDamage } }, { upsert: true });
  } else {
    await db.run(
      db.getPlayersDb(),
      `INSERT INTO players(userId, totalDamage) VALUES(?, ?)
       ON CONFLICT(userId) DO UPDATE SET totalDamage = excluded.totalDamage`,
      [userId, totalDamage]
    );
  }
  return true;
}

async function importGuild(guild) {
  const guildId = String(guild.guildId || guild.tag || guild.name || `guild-${Math.random().toString(36).slice(2, 8)}`);
  const name = String(guild.tag || guild.name || 'Unknown');
  const level = Number(guild.level || 1);
  const xp = Number(guild.xp || 0);
  const bank = Number(guild.bank || 0);
  const now = Date.now();

  if (db.getDbType() === 'mongodb') {
    await db.run('guilds', { guildId }, {
      $set: { name, level, xp, bank },
      $setOnInsert: { upgrades: '{}', research: '{}', createdAt: now, resources: '{}', buildings: '{}', construction: '{}' }
    }, { upsert: true });
  } else {
    await db.run(db.getPlayersDb(),
      `INSERT INTO guilds(guildId, name, level, xp, bank, upgrades, research, createdAt, resources, buildings, construction)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(guildId) DO UPDATE SET name=excluded.name, level=excluded.level, xp=excluded.xp, bank=excluded.bank`,
      [guildId, name, level, xp, bank, '{}', '{}', now, '{}', '{}', '{}']
    );
  }

  const memberIds = Array.isArray(guild.memberIds) ? guild.memberIds : [];
  const memberCount = Number(guild.members || memberIds.length || 1);
  for (let i = 0; i < Math.max(1, memberCount); i++) {
    const memberId = String(memberIds[i] || `${guildId}_member_${i + 1}`);
    if (db.getDbType() === 'mongodb') {
      await db.run('players', { userId: memberId }, {
        $setOnInsert: { level: 1, xp: 0, gold: 0, gems: 0, energy: 100, maxEnergy: 100, attackLevel: 1, totalDamage: 0, guildId, guildRank: 'member', createdAt: now }
      }, { upsert: true });
      await db.run('guild_members', { guildId, userId: memberId }, {
        $setOnInsert: { rank: 'member', contribution: 0, joinedAt: now }
      }, { upsert: true });
    } else {
      await db.run(db.getPlayersDb(),
        `INSERT INTO players(userId, level, xp, gold, gems, energy, maxEnergy, attackLevel, totalDamage, monstersParticipated, lastAttackAt, prestige, titles, achievements, inventory, equipped, monsterCollection, activeMonster, guildId, guildRank, lastEnergyUpdate, createdAt)
         VALUES(?, 1, 0, 0, 0, 100, 100, 1, 0, 0, NULL, 0, '[]', '[]', '[]', '{}', '[]', 'null', ?, 'member', 0, ?)
         ON CONFLICT(userId) DO NOTHING`,
        [memberId, guildId, now]
      );
      await db.run(db.getPlayersDb(),
        `INSERT OR IGNORE INTO guild_members(guildId, userId, rank, contribution, joinedAt) VALUES(?,?,?,?,?)`,
        [guildId, memberId, 'member', 0, now]
      );
    }
  }
}

(async () => {
  await db.init();

  const backupPath = path.join(__dirname, 'leaderboard-backup.json');
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const entries = Array.isArray(backup.leaderboard) ? backup.leaderboard : [];

  let importedEntries = 0;
  for (const entry of entries) {
    if (await importLeaderboardEntry(entry)) importedEntries++;
  }

  await db.saveDatabases();
  console.log(`Imported ${importedEntries} leaderboard entries into ${db.getDbType()}.`);

  const guildBackupPath = path.join(__dirname, 'guilds-backup.json');
  if (fs.existsSync(guildBackupPath)) {
    const guildBackup = JSON.parse(fs.readFileSync(guildBackupPath, 'utf8'));
    const guilds = Array.isArray(guildBackup.guilds) ? guildBackup.guilds : Array.isArray(guildBackup) ? guildBackup : [];
    if (guilds.length > 0) {
      for (const guild of guilds) {
        await importGuild(guild);
      }
      await db.saveDatabases();
      console.log(`Imported ${guilds.length} guild entries.`);
    }
  }

  await db.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
