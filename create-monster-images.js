// Script to create monster images with colored backgrounds and emojis
const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, 'images');

// Create images directory if it doesn't exist
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// All 30 monsters from the catalog with colors and emojis
const monsters = [
  // Fire Element
  { id: 'fire_001', name: 'ember_sprite', emoji: '🔥', color: '#FF5722' },
  { id: 'fire_002', name: 'flame_wisp', emoji: '💨', color: '#FF9800' },
  { id: 'fire_003', name: 'inferno_drake', emoji: '🐉', color: '#F44336' },
  
  // Water Element
  { id: 'water_001', name: 'droplet_fairy', emoji: '💧', color: '#2196F3' },
  { id: 'water_002', name: 'wave_spirit', emoji: '🌊', color: '#03A9F4' },
  { id: 'water_003', name: 'leviathan', emoji: '🐍', color: '#00BCD4' },
  
  // Earth Element
  { id: 'earth_001', name: 'pebble_golem', emoji: '🪨', color: '#795548' },
  { id: 'earth_002', name: 'boulder_guardian', emoji: '🗿', color: '#607D8B' },
  
  // Electric Element
  { id: 'electric_001', name: 'spark_bug', emoji: '⚡', color: '#FFEB3B' },
  { id: 'electric_002', name: 'thunder_hawk', emoji: '🦅', color: '#FFC107' },
  
  // Wind Element
  { id: 'wind_001', name: 'breeze_fairy', emoji: '🌬️', color: '#8BC34A' },
  { id: 'wind_002', name: 'storm_eagle', emoji: '🦅', color: '#4CAF50' },
  
  // Ice Element
  { id: 'ice_001', name: 'snowflake_spirit', emoji: '❄️', color: '#B3E5FC' },
  { id: 'ice_002', name: 'frost_wyrm', emoji: '🐉', color: '#81D4FA' },
  
  // Dark Element
  { id: 'dark_001', name: 'shadow_imp', emoji: '👺', color: '#424242' },
  { id: 'dark_002', name: 'nightmare_stalker', emoji: '👹', color: '#212121' },
  
  // Light Element
  { id: 'light_001', name: 'sparkle_pixie', emoji: '✨', color: '#FFF9C4' },
  { id: 'light_002', name: 'celestial_seraph', emoji: '👼', color: '#FFEB3B' },
  
  // Poison Element
  { id: 'poison_001', name: 'toxic_slime', emoji: '☠️', color: '#8BC34A' },
  { id: 'poison_002', name: 'venom_hydra', emoji: '🐍', color: '#4CAF50' },
  
  // Psychic Element
  { id: 'psychic_001', name: 'mind_moth', emoji: '🦋', color: '#9C27B0' },
  { id: 'psychic_002', name: 'astral_dragon', emoji: '🐉', color: '#673AB7' },
  
  // Additional monsters
  { id: 'beast_001', name: 'forest_wolf', emoji: '🐺', color: '#8D6E63' },
  { id: 'undead_001', name: 'skeleton_knight', emoji: '💀', color: '#BDBDBD' },
  { id: 'plant_001', name: 'vine_whip', emoji: '🌿', color: '#66BB6A' },
  { id: 'machine_001', name: 'clockwork_beetle', emoji: '🪲', color: '#607D8B' },
  { id: 'dragon_001', name: 'dragon_whelp', emoji: '🐲', color: '#FF9800' },
  { id: 'dragon_002', name: 'adult_dragon', emoji: '🐉', color: '#F44336' },
  { id: 'dragon_003', name: 'ancient_dragon', emoji: '👑', color: '#9C27B0' },
  { id: 'goblin_001', name: 'goblin_scout', emoji: '👺', color: '#8BC34A' },
  { id: 'orc_001', name: 'orc_warrior', emoji: '🪓', color: '#795548' },
  { id: 'slime_001', name: 'gelatinous_slime', emoji: '🟢', color: '#4CAF50' },
  { id: 'troll_001', name: 'cave_troll', emoji: '👹', color: '#9E9E9E' },
  { id: 'phantom_001', name: 'wraith', emoji: '👻', color: '#757575' },
  { id: 'holy_001', name: 'unicorn_foal', emoji: '🦄', color: '#E91E63' },
  { id: 'titan_001', name: 'stone_titan', emoji: '🗿', color: '#3F51B5' }
];

// Simple 200x200 PNG with solid color background (minimal valid PNG)
function createSimplePNG(color) {
  // PNG signature
  const signature = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
  ]);

  // IHDR chunk (200x200, 8-bit RGB)
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // Length
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(200, 8); // Width
  ihdr.writeUInt32BE(200, 12); // Height
  ihdr.writeUInt8(8, 16); // Bit depth
  ihdr.writeUInt8(2, 17); // Color type (RGB)
  ihdr.writeUInt8(0, 18); // Compression
  ihdr.writeUInt8(0, 19); // Filter
  ihdr.writeUInt8(0, 20); // Interlace

  // Calculate CRC for IHDR
  const ihdrData = ihdr.slice(4, 21);
  const ihdrCrc = crc32(ihdrData);
  ihdr.writeUInt32BE(ihdrCrc, 21);

  // IDAT chunk (image data - solid color)
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  // Create raw image data (200x200 RGB with filter byte)
  const rawData = Buffer.alloc(200 * 201); // 200 rows, each 200 bytes + 1 filter byte
  for (let y = 0; y < 200; y++) {
    rawData[y * 201] = 0; // Filter type: None
    for (let x = 0; x < 200; x++) {
      rawData[y * 201 + 1 + x * 3] = r;
      rawData[y * 201 + 1 + x * 3 + 1] = g;
      rawData[y * 201 + 1 + x * 3 + 2] = b;
    }
  }

  // Compress with zlib (simple deflate)
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(rawData);

  const idat = Buffer.alloc(compressed.length + 12);
  idat.writeUInt32BE(compressed.length, 0);
  idat.write('IDAT', 4);
  compressed.copy(idat, 8);
  const idatCrc = crc32(idat.slice(4, idat.length - 4));
  idat.writeUInt32BE(idatCrc, idat.length - 4);

  // IEND chunk
  const iend = Buffer.from([
    0x00, 0x00, 0x00, 0x00, // Length: 0
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// CRC32 implementation
function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = makeCRCTable();
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeCRCTable() {
  const table = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xEDB88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[n] = c;
  }
  return table;
}

// Create images for each monster
console.log('Creating monster images...\n');
monsters.forEach(monster => {
  const filename = `${monster.name}.png`;
  const filepath = path.join(imagesDir, filename);
  const pngData = createSimplePNG(monster.color);
  fs.writeFileSync(filepath, pngData);
  console.log(`✅ Created: ${filename} (${monster.emoji}) - ${monster.id}`);
});

console.log(`\n🎉 Successfully created ${monsters.length} monster images!`);
console.log('📁 Location:', imagesDir);
console.log('\n💡 Tip: Replace these placeholder images with actual monster artwork for better visuals.');