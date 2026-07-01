const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ensurePlayer, updateEnergy } = require('../lib/players');
const { gatherResource } = require('../lib/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gather')
    .setDescription('Gather resources')
    .addStringOption(opt => opt
      .setName('activity')
      .setDescription('Gathering activity')
      .setRequired(true)
      .addChoices(
        { name: '🎣 Fishing', value: 'fishing' },
        { name: '⛏️ Mining', value: 'mining' },
        { name: '🌾 Farming', value: 'farming' },
        { name: '🍳 Cooking', value: 'cooking' },
        { name: '⚗️ Alchemy', value: 'alchemy' }
      )),

  async execute(interaction) {
    await ensurePlayer(interaction.user.id);
    await updateEnergy(interaction.user.id);
    
    const activity = interaction.options.getString('activity');
    const result = await gatherResource(interaction.user.id, activity);
    
    if (result.success) {
      const rarityEmoji = {
        'Common': '⚪',
        'Uncommon': '🟢',
        'Rare': '🔵',
        'Epic': '🟣',
        'Legendary': '🟡'
      };
      
      const embed = new EmbedBuilder()
        .setTitle('🔨 Resource Gathered!')
        .setColor(0x27ae60)
        .setDescription(`${rarityEmoji[result.resource.rarity] || '⚪'} **${result.resource.name}**`)
        .addFields(
          { name: 'Rarity', value: result.resource.rarity, inline: true },
          { name: 'Activity', value: activity.charAt(0).toUpperCase() + activity.slice(1), inline: true }
        );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else {
      await interaction.reply({ content: result.message, ephemeral: true });
    }
  }
};