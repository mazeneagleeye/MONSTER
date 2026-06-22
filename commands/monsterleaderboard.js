const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLeaderboard } = require('../lib/players');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('monsterleaderboard')
    .setDescription('Top players by total damage.'),

  async execute(interaction) {
    const rows = await getLeaderboard(10);

    const desc = rows.length
      ? rows.map((r, i) => `**${i + 1}.** <@${r.userId}> — ${r.totalDamage} damage`).join('\n')
      : 'No data yet.';

    const embed = new EmbedBuilder()
      .setTitle('🏆 Top Hunters')
      .setColor(0x8d99ae)
      .setDescription(desc);

    await interaction.reply({ embeds: [embed], ephemeral: false });
  }
};

