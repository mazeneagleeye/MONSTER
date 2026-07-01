const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer, ensurePlayer } = require('../lib/players');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your player profile')
    .addUserOption(opt => opt.setName('user').setDescription('User to view (optional)').setRequired(false)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    await ensurePlayer(targetUser.id);
    const player = await getPlayer(targetUser.id);
    
    const embed = new EmbedBuilder()
      .setTitle(`👤 ${targetUser.username}'s Profile`)
      .setColor(0x3498db)
      .addFields(
        { name: 'Level', value: `${player.level} (Prestige: ${player.prestige})`, inline: true },
        { name: 'XP', value: `${player.xp}/${player.level * 100}`, inline: true },
        { name: 'Attack Level', value: `${player.attackLevel}`, inline: true },
        { name: '💰 Gold', value: `${player.gold}`, inline: true },
        { name: '💎 Gems', value: `${player.gems}`, inline: true },
        { name: '⚡ Energy', value: `${player.energy}/${player.maxEnergy}`, inline: true },
        { name: 'Total Damage', value: `${player.totalDamage}`, inline: true },
        { name: 'Monsters Participated', value: `${player.monstersParticipated}`, inline: true }
      );
    
    if (player.guildId) {
      embed.addFields({ name: 'Guild', value: player.guildId, inline: true });
    }
    
    const titles = JSON.parse(player.titles || '[]');
    if (titles.length > 0) {
      embed.addFields({ name: 'Titles', value: titles.join(', '), inline: false });
    }
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};