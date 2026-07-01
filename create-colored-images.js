const fs = require('fs');
const path = require('path');

// Simple PNG generator for colored rectangles with text
// This creates basic but visible monster images

function createSimplePNG(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
  ]);

  // IHDR chunk (image header)
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);  // width
  ihdr.writeUInt32BE(height, 4); // height
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type (RGB)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Create image data (RGB)
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      // Create a simple gradient pattern
      const factor = (x + y) / (width + height);
      const cr = Math.min(255, Math.floor(r * (1 + factor * 0.3)));
      const cg = Math.min(255, Math.floor(g * (1 + factor * 0.3)));
      const cb = Math.min(255, Math.floor(b * (1 + factor * 0.3)));
      rawData.push(cr, cg, cb);
    }
  }

  const rawDataBuffer = Buffer.from(rawData);
  const compressed = require('zlib').deflateSync(rawDataBuffer);

  // IDAT chunk (image data)
  const idat = Buffer.alloc(4 + 4 + compressed.length + 4);
  idat.writeUInt32BE(compressed.length, 4);
  compressed.copy(idat, 8);
  const crc = crc32(Buffer.concat([
    Buffer.from('IDAT'),
    compressed
  ]));
  idat.writeUInt32BE(crc, 8 + compressed.length);

  // IEND chunk
  const iend = Buffer.from([
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);

  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdr),
    idat,
    iend
  ]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type);
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = [];
  
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      if (c & 1) {
        c = 0xEDB88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[i] = c;
  }

  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Monster image definitions with colors
const monsterImages = [
  { name: 'slime', color: [100, 200, 100], size: 200 },
  { name: 'goblin', color: [150, 100, 50], size: 200 },
  { name: 'orc', color: [100, 80, 60], size: 200 },
  { name: 'troll', color: [80, 120, 80], size: 200 },
  { name: 'ogre', color: [120, 90, 70], size: 200 },
  { name: 'dragon_whelp', color: [180, 140, 50], size: 200 },
  { name: 'dragon', color: [200, 100, 50], size: 200 },
  { name: 'ancient_dragon', color: [150, 50, 150], size: 200 },
  { name: 'titan', color: [100, 100, 150], size: 200 }
];

const imagesDir = path.join(__dirname, 'images');

// Create images directory if it doesn't exist
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

console.log('Creating colored monster images...');

for (const monster of monsterImages) {
  const filepath = path.join(imagesDir, `${monster.name}.png`);
  const png = createSimplePNG(monster.size, monster.size, ...monster.color);
  fs.writeFileSync(filepath, png);
  console.log(`Created: ${monster.name}.png (${monster.color.join(',')})`);
}

console.log('\nAll monster images created successfully!');
console.log('These are basic colored placeholders. Replace with real artwork for better visuals.');