const { init } = require('./lib/db');

async function checkSchema() {
  console.log('Checking database schema...\n');
  
  await init();
  
  const { get, all } = require('./lib/db');
  
  // Check players table schema
  console.log('Players table columns:');
  const playerColumns = await all(require('./lib/db').playersDb, 
    "PRAGMA table_info(players)"
  );
  console.log(`Count: ${playerColumns.length}`);
  playerColumns.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });
  
  console.log('\nPlayer_monsters table columns:');
  const monsterColumns = await all(require('./lib/db').playersDb,
    "PRAGMA table_info(player_monsters)"
  );
  console.log(`Count: ${monsterColumns.length}`);
  monsterColumns.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });
}

checkSchema().catch(console.error);