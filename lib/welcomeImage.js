const path = require('path');
const Jimp = require('jimp');

async function createWelcomeImage(username, memberCount, joinDate, roleName = '🐣 Adventurer') {
  const width = 1920;
  const height = 720;
  const background = new Jimp(width, height, 0x1a0b2bff);

  // Add soft glow stripes to give some depth.
  for (let y = 0; y < height; y += 40) {
    const opacity = 0.05 + (y / height) * 0.15;
    const line = new Jimp(width, 24, Jimp.rgbaToInt(255, 255, 255, Math.round(255 * opacity)));
    background.composite(line, 0, y);
  }

  const castleOverlay = new Jimp(width, height, 0x00000044);
  background.composite(castleOverlay, 0, 0);

  const bottomBar = new Jimp(width, 160, 0x000000b0);
  background.composite(bottomBar, 0, height - 160);

  const titleFont = await Jimp.loadFont(Jimp.FONT_SANS_128_WHITE);
  const headingFont = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
  const bodyFont = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  const smallFont = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);

  const titleText = '🐉 Monster Kingdom';
  const welcomeText = `Welcome, ${username}`;
  const subtitleText = 'Your adventure begins today.';

  background.print(titleFont, 80, 80, titleText);
  background.print(headingFont, 80, 240, welcomeText);
  background.print(bodyFont, 80, 340, subtitleText);

  const rightSideX = width - 980;
  const dragonPath = path.join(__dirname, '..', 'images', 'dragon.png');
  try {
    const dragonImage = await Jimp.read(dragonPath);
    dragonImage.resize(860, Jimp.AUTO);
    const y = height - dragonImage.bitmap.height - 40;
    background.composite(dragonImage, rightSideX, y, {
      mode: Jimp.BLEND_SOURCE_OVER,
      opacitySource: 0.95
    });
  } catch (err) {
    console.warn('Could not load dragon image for welcome card:', err.message);
  }

  const infoX = 88;
  const infoY = height - 130;
  background.print(smallFont, infoX, infoY, `Member #${memberCount}`);
  background.print(smallFont, infoX, infoY + 42, `Joined: ${joinDate}`);
  background.print(smallFont, infoX + 520, infoY + 42, `Role: ${roleName}`);

  const footerText = 'The Warden watches over the kingdom.';
  background.print(bodyFont, 80, height - 90, footerText);

  const buffer = await background.getBufferAsync(Jimp.MIME_PNG);
  return buffer;
}

module.exports = {
  createWelcomeImage
};
