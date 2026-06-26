const { init } = require('./db');
const { ensureDefaults, keys, getConfig } = require('./config');
const { getCurrentMonster, spawnNewMonster, applyDailyHealIfNeeded } = require('./monsterState');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');


function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function startMonsterLoop(client) {
  await init();
  await ensureDefaults({ monsterDb: require('./db').monsterDb });

  // Ensure monster exists
  const monster = await getCurrentMonster().catch(() => null);
  if (!monster?.monsterId) {
    await spawnNewMonster(0, { hardReset: true });
  }

  // Post monster once on startup (after /monster-setup has set channel id)
  const channelId = await getConfig(require('./db').monsterDb, keys.MONSTER_CHANNEL_ID, null);
  if (channelId) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (channel) {
      const m = await getCurrentMonster();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('attack')
          .setLabel('⚔️ Attack (once/hour)')
          .setStyle(ButtonStyle.Danger)
      );

      const embed = new EmbedBuilder()
        .setTitle(m.title)
        .setColor(0x2b2d42)
        .setDescription(`**HP:** ${m.hp}/${m.maxHp}`);

      // Attach monster image (requires images/monster1.png .. monster5.png)
      // If the file doesn't exist (first setup), we still send the embed without the image.
      const imageName = require('./monsterState').getMonsterImageName(m.title);
      const imagePath = path.join(__dirname, '..', 'images', `${imageName}.png`);
      try {
        const attachment = new AttachmentBuilder(imagePath, { name: `${imageName}.png` });
        embed.setImage(`attachment://${imageName}.png`);
        await channel.send({ embeds: [embed], components: [row], files: [attachment] });
      } catch (e) {
        console.warn(`Monster image missing: ${imagePath}. Sending without image.`);
        await channel.send({ embeds: [embed], components: [row] });
      }

      return;
    }

  }


  // Poll for daily heal
  // (Light polling to match requested day-based reset).
  // In production you may prefer cron.
  while (true) {
    await applyDailyHealIfNeeded(Date.now());
    await sleep(60 * 1000);
  }
}

module.exports = { startMonsterLoop };

