const { init } = require('./lib/db');
const { initMonsters } = require('./lib/monsters');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Initializing database...');
  await init();
  console.log('Database initialized!');
  
  console.log('Generating 500+ monsters...');
  await initMonsters();
  console.log('Monsters generated successfully!');
  
  // Create placeholder images for all monster types
  console.log('Creating placeholder images...');
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
      console.log(`Created placeholder: ${imageName}.png`);
    }
  }
  
  console.log('\nSetup complete!');
  console.log('\nTo add real monster images:');
  console.log('1. Add PNG images to the images/ folder');
  console.log('2. Name them: slime.png, goblin.png, orc.png, troll.png, ogre.png,');
  console.log('   dragon_whelp.png, dragon.png, ancient_dragon.png, titan.png');
  console.log('\nThe bot will work with placeholder images until you add real ones.');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
