// Script to create monster images with colored backgrounds and emojis
const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, 'images');

// Create images directory if it doesn't exist
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Monster definitions with colors
const monsters = [
  { name: 'slime', emoji: '🐍', color: '#4CAF50' },
  { name: 'goblin', emoji: '👺', color: '#8BC34A' },
  { name: 'orc', emoji: '🪓', color: '#795548' },
  { name: 'troll', emoji: '👹', color: '#9E9E9E' },
  { name: 'ogre', emoji: '🧌', color: '#607D8B' },
  { name: 'dragon_whelp', emoji: '🐉', color: '#FF9800' },
  { name: 'dragon', emoji: '🐲', color: '#F44336' },
  { name: 'ancient_dragon', emoji: '👑', color: '#9C27B0' },
  { name: 'titan', emoji: '🗿', color: '#3F51B5' }
];

// Simple 200x200 PNG with solid color background (minimal valid PNG)
function createSimplePNG(color) {
  // This creates a minimal 200x200 PNG with the specified color
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
monsters.forEach(monster => {
  const filename = `${monster.name}.png`;
  const filepath = path.join(imagesDir, filename);
  const pngData = createSimplePNG(monster.color);
  fs.writeFileSync(filepath, pngData);
  console.log(`Created: ${filename} (${monster.emoji})`);
});

console.log('\nAll monster images created successfully!');
console.log('Note: These are simple colored placeholders.');
console.log('For better images, replace them with actual monster artwork.');