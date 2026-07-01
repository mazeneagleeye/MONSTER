const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, AttachmentBuilder } = require('discord.js');
const { getCurrentMonster } = require('../lib/monsterState');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('monster')
    .setDescription('Show the current monster and attack button.'),

  async execute(interaction) {
    const monster = await getCurrentMonster();

    const embed = new EmbedBuilder()
      .setTitle(monster.title)
      .setColor(0x2b2d42)
      .setDescription(`**HP:** ${monster.hp}/${monster.maxHp}`);

    // Attach monster image (requires images/slime.png, goblin.png, etc.)
    const imageName = require('../lib/monsterState').getMonsterImageName(monster.title);
    const imagePath = path.join(__dirname, '..', 'images', `${imageName}.png`);
    let attachment = null;
    try {
      attachment = new AttachmentBuilder(imagePath, { name: `${imageName}.png` });
      embed.setImage(`attachment://${imageName}.png`);
    } catch (e) {
      console.warn(`Monster image missing: ${imagePath}. Sending without image.`);
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('attack').setLabel('⚔️ Attack (once/hour)').setStyle(ButtonStyle.Danger)
    );

    const replyOptions = { embeds: [embed], components: [row], ephemeral: false };
    if (attachment) {
      replyOptions.files = [attachment];
    }
    await interaction.reply(replyOptions);
  }
};


