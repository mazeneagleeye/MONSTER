const { init } = require('./lib/db');
const { initMonsters } = require('./lib/monsters');

async function main() {
  console.log('Initializing database...');
  await init();
  console.log('Database initialized!');
  
  console.log('Generating 500+ monsters...');
  await initMonsters();
  console.log('Monsters generated successfully!');
  
  console.log('Setup complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});