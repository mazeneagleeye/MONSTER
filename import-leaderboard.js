const fs = require('fs');
const path = require('path');
const db = require('./lib/db');

(async () => {
  await db.init();

  const backupPath = path.join(__dirname, 'leaderboard-backup.json');
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const entries = Array.isArray(backup.leaderboard) ? backup.leaderboard : [];

  for (const entry of entries) {
    await db.run(
      db.playersDb,
      `INSERT INTO players(userId, totalDamage) VALUES(?, ?)
       ON CONFLICT(userId) DO UPDATE SET totalDamage = excluded.totalDamage`,
      [String(entry.userId), Number(entry.damage || 0)]
    );
  }

  db.saveDatabases();
  console.log(`Imported ${entries.length} leaderboard entries.`);

  const guildBackupPath = path.join(__dirname, 'guilds-backup.json');
  if (fs.existsSync(guildBackupPath)) {
    const guildBackup = JSON.parse(fs.readFileSync(guildBackupPath, 'utf8'));
    const guilds = Array.isArray(guildBackup.guilds) ? guildBackup.guilds : Array.isArray(guildBackup) ? guildBackup : [];
    if (guilds.length > 0) {
      const now = Date.now();
      for (const guild of guilds) {
        const guildId = String(guild.guildId || guild.tag || guild.name || `guild-${Math.random().toString(36).slice(2, 8)}`);
        const name = String(guild.tag || guild.name || 'Unknown');
        const level = Number(guild.level || 1);
        const xp = Number(guild.xp || 0);
        const bank = Number(guild.bank || 0);
        await db.run(db.playersDb,
          `INSERT INTO guilds(guildId, name, level, xp, bank, upgrades, research, createdAt, resources, buildings, construction)
           VALUES(?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(guildId) DO UPDATE SET name=excluded.name, level=excluded.level, xp=excluded.xp, bank=excluded.bank`,
          [guildId, name, level, xp, bank, '{}', '{}', now, '{}', '{}', '{}']
        );

        const memberCount = Number(guild.members || 1);
        for (let i = 0; i < Math.max(1, memberCount); i++) {
          const memberId = String((guild.memberIds && guild.memberIds[i]) || `${guildId}_member_${i + 1}`);
          await db.run(db.playersDb,
            `INSERT INTO players(userId, level, xp, gold, gems, energy, maxEnergy, attackLevel, totalDamage, monstersParticipated, lastAttackAt, prestige, titles, achievements, inventory, equipped, monsterCollection, activeMonster, guildId, guildRank, lastEnergyUpdate, createdAt)
             VALUES(?, 1, 0, 0, 0, 100, 100, 1, 0, 0, NULL, 0, '[]', '[]', '[]', '{}', '[]', 'null', ?, 'member', 0, ?)
             ON CONFLICT(userId) DO NOTHING`,
            [memberId, guildId, now]
          );

          await db.run(db.playersDb,
            `INSERT OR IGNORE INTO guild_members(guildId, userId, rank, contribution, joinedAt) VALUES(?,?,?,?,?)`,
            [guildId, memberId, 'member', 0, now]
          );
        }
      }
      db.saveDatabases();
      console.log(`Imported ${guilds.length} guild entries.`);
    }
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
