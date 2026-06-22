const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer, ensurePlayer, getPlayerTotalDamage } = require('../lib/players');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('monsterstats')
    .setDescription('Your personal monster stats.'),

  async execute(interaction) {
    await ensurePlayer(interaction.user.id);
    const player = await getPlayer(interaction.user.id);

    const totalDamage = player.totalDamage ?? 0;
    const monstersParticipated = player.monstersParticipated ?? 0;
    const attackLevel = player.attackLevel ?? 1;

    const embed = new EmbedBuilder()
      .setTitle(`Stats for ${interaction.user.username}`)
      .setColor(0x264653)
      .addFields(
        { name: 'Attack Level', value: String(attackLevel), inline: true },
        { name: 'Total Damage', value: String(totalDamage), inline: true },
        { name: 'Kills Participated', value: String(monstersParticipated), inline: true }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};

