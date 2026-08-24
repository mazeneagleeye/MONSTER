const { init } = require('./lib/db');
const { initMonsters } = require('./lib/monsters');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🐉 Initializing Monster System...\n');
  console.log('='.repeat(50));
  
  console.log('\n1️⃣ Initializing database...');
  await init();
  console.log('✅ Database initialized');
  
  console.log('\n2️⃣ Loading curated monster catalog (30 unique monsters)...');
  await initMonsters();
  console.log('✅ Monsters loaded successfully!');
  
  // Verify monster count
  const { getAllMonsters } = require('./lib/monsters');
  const allMonsters = await getAllMonsters();
  console.log(`\n📊 Database contains ${allMonsters.length} monsters`);
  
  // Show rarity distribution
  const rarityCount = {};
  allMonsters.forEach(m => {
    rarityCount[m.rarity] = (rarityCount[m.rarity] || 0) + 1;
  });
  console.log('   Rarity distribution:', rarityCount);
  
  // Show element distribution
  const elementCount = {};
  allMonsters.forEach(m => {
    elementCount[m.element] = (elementCount[m.element] || 0) + 1;
  });
  console.log('   Element distribution:', elementCount);
  
  // Create placeholder images for monster types
  console.log('\n3️⃣ Creating placeholder images...');
  const imagesDir = path.join(__dirname, 'images');
  
  // Minimal 1x1 transparent PNG (67 bytes)
  const minimalPNG = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0A, 0x49, 0x44, 0x48, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  
  // Create images directory if it doesn't exist
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  
  // List of all monster image names needed
  const monsterImages = [
    'slime', 'goblin', 'orc', 'troll', 'ogre', 
    'dragon_whelp', 'dragon', 'ancient_dragon', 'titan'
  ];
  
  for (const imageName of monsterImages) {
    const filepath = path.join(imagesDir, `${imageName}.png`);
    if (!fs.existsSync(filepath)) {
      fs.writeFileSync(filepath, minimalPNG);
      console.log(`   Created placeholder: ${imageName}.png`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Monster system initialization complete!');
  console.log('='.repeat(50));
  console.log('\n📝 Next steps:');
  console.log('   1. Run: node test-monster-system.js');
  console.log('   2. Test all monster commands in Discord');
  console.log('   3. Add real monster images to the images/ folder');
  console.log('   4. Expand the catalog in lib/monsters-catalog.js');
  console.log('\n🎮 Available commands:');
  console.log('   • /monsters summon - Summon monsters');
  console.log('   • /monsters collection - View your monsters');
  console.log('   • /monsters info - View monster details');
  console.log('   • /monsters interact - Interact with monsters');
  console.log('   • /monsters set-active - Set active monster');
  console.log('   • /monsters favorite - Favorite monsters');
  console.log('   • /monsters rename - Rename monsters');
  console.log('   • /monsters encyclopedia - View encyclopedia');
  console.log('   • /monstermanage evolve - Evolve monsters');
  console.log('   • /monstermanage equip - Equip items');
  console.log('   • /monstermanage skin - Change skins');
  console.log('   • /monstermanage stats - View statistics');
  console.log('\n');
  
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Error:', err);
  console.error(err.stack);
  process.exit(1);
});
