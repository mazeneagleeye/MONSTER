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
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
