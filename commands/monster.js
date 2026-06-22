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

    // Attach monster image (requires images/monster1.png .. monster5.png)
    const imagePath = path.join(__dirname, '..', 'images', `monster${monster.imageTier}.png`);
    const attachment = new AttachmentBuilder(imagePath, { name: `monster${monster.imageTier}.png` });
    embed.setImage(`attachment://monster${monster.imageTier}.png`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('attack').setLabel('⚔️ Attack (once/day)').setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({ embeds: [embed], components: [row], files: [attachment] });
  }
};


