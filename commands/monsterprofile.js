const { SlashCommandBuilder, EmbedBuilder, User } = require('discord.js');
const { ensurePlayer, getPlayer } = require('../lib/players');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('monsterprofile')
    .setDescription("View another user's monster stats")
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    if (!user) return;

    await ensurePlayer(user.id);
    const player = await getPlayer(user.id);

    const embed = new EmbedBuilder()
      .setTitle(`Stats for ${user.username}`)
      .setColor(0x264653)
      .addFields(
        { name: 'Attack Level', value: String(player.attackLevel ?? 1), inline: true },
        { name: 'Total Damage', value: String(player.totalDamage ?? 0), inline: true },
        { name: 'Kills Participated', value: String(player.monstersParticipated ?? 0), inline: true }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};

