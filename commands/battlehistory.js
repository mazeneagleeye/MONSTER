const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer, ensurePlayer } = require('../lib/players');
const { getBattleHistory } = require('../lib/battles');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('battlehistory')
    .setDescription('View your battle history')
    .addNumberOption(opt => opt
      .setName('limit')
      .setDescription('Number of battles to show')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(50)),

  async execute(interaction) {
    await ensurePlayer(interaction.user.id);
    
    const limit = interaction.options.getNumber('limit') || 10;
    const history = await getBattleHistory(interaction.user.id, limit);
    
    if (!history || history.length === 0) {
      return interaction.reply({ 
        content: 'No battle history found! Start battling to build your history.',
        ephemeral: true 
      });
    }
    
    // Create battle history embed
    const embed = new EmbedBuilder()
      .setTitle('⚔️ Battle History')
      .setColor(0x3498db)
      .setDescription(`Showing last ${history.length} battles`);
    
    // Group battles by result
    const wins = history.filter(h => h.result === 'win').length;
    const losses = history.filter(h => h.result === 'loss').length;
    
    embed.addFields(
      { name: '📊 Overall Record', value: `**Wins:** ${wins} | **Losses:** ${losses} | **Win Rate:** ${((wins / history.length) * 100).toFixed(1)}%`, inline: false }
    );
    
    // Show recent battles
    const recentBattles = history.slice(0, 10).map(battle => {
      const date = new Date(battle.timestamp);
      const resultEmoji = battle.result === 'win' ? '✅' : '❌';
      const timeAgo = getTimeAgo(battle.timestamp);
      
      return `${resultEmoji} **${battle.enemyName}** - ${timeAgo}\n` +
             `   Damage: ${battle.damageDealt} | Rounds: ${battle.rounds}`;
    }).join('\n\n');
    
    if (recentBattles) {
      embed.addFields({
        name: 'Recent Battles',
        value: recentBattles,
        inline: false
      });
    }
    
    // Show statistics
    const totalDamage = history.reduce((sum, battle) => sum + (battle.damageDealt || 0), 0);
    const avgDamage = history.length > 0 ? Math.floor(totalDamage / history.length) : 0;
    
    embed.addFields(
      { name: 'Total Damage Dealt', value: totalDamage.toLocaleString(), inline: true },
      { name: 'Average Damage', value: avgDamage.toLocaleString(), inline: true },
      { name: 'Total Battles', value: String(history.length), inline: true }
    );
    
    embed.setFooter({ text: 'Keep battling to improve your stats!' });
    embed.setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }
};

function getTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString();
}