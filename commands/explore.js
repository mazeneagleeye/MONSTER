const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ensurePlayer, updateEnergy } = require('../lib/players');
const { exploreRegion, getWorldStatus, getAvailableRegions, getRegion, getDailyDungeon } = require('../lib/world');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('explore')
    .setDescription('Explore the world')
    .addSubcommand(sub => {
      sub
        .setName('world')
        .setDescription('View world status and available regions');
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('region')
        .setDescription('Explore a specific region')
        .addStringOption(opt => opt
          .setName('region')
          .setDescription('Region name')
          .setRequired(true)
          .addChoices(
            { name: '🌲 Forest', value: 'forest' },
            { name: '🏜️ Desert', value: 'desert' },
            { name: '🌋 Volcano', value: 'volcano' },
            { name: '❄️ Ice', value: 'ice' },
            { name: '🌌 Space', value: 'space' },
            { name: '🌊 Ocean', value: 'ocean' },
            { name: '🌑 Shadow', value: 'shadow' },
            { name: '✨ Celestial', value: 'celestial' },
            { name: '🌀 Chaos', value: 'chaos' },
            { name: '⭐ Legendary', value: 'legendary' }
          ));
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('dungeon')
        .setDescription('Enter the daily dungeon');
      return sub;
    }),

  async execute(interaction) {
    await ensurePlayer(interaction.user.id);
    await updateEnergy(interaction.user.id);
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'world':
        await showWorldStatus(interaction);
        break;
      case 'region':
        await exploreRegionCmd(interaction);
        break;
      case 'dungeon':
        await enterDailyDungeon(interaction);
        break;
    }
  }
};

async function showWorldStatus(interaction) {
  const status = await getWorldStatus(interaction.user.id);
  
  const embed = new EmbedBuilder()
    .setTitle('🌍 World Status')
    .setColor(0x3498db)
    .setDescription(`**Time:** ${status.timeOfDay} - ${status.timeBonus}\n**Your Level:** ${status.playerLevel}`)
    .addFields(
      { name: 'Available Regions', value: status.availableRegions.map(r => 
        `${r.name} - ${r.weather.name}\n   ${r.description}\n   Min Level: ${r.minLevel}`
      ).join('\n\n') || 'No regions available yet. Keep leveling up!', inline: false }
    );
  
  embed.setFooter({ text: 'Use /explore region [region] to explore!' });
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function exploreRegionCmd(interaction) {
  const regionId = interaction.options.getString('region');
  const result = await exploreRegion(interaction.user.id, regionId);
  
  if (!result.success) {
    return interaction.reply({ content: result.message, ephemeral: true });
  }
  
  const embed = new EmbedBuilder()
    .setTitle(`🗺️ Explored ${result.region}`)
    .setColor(0x27ae60)
    .setDescription(`You encountered a **${result.monster}** while exploring!`)
    .addFields(
      { name: 'Weather', value: result.weather, inline: true },
      { name: 'Time', value: result.timeOfDay, inline: true },
      { name: 'XP Gained', value: `+${result.xpGained}`, inline: true },
      { name: 'Gold Gained', value: `+${result.goldGained}`, inline: true }
    );
  
  if (result.foundGem) {
    embed.addFields({ name: 'Bonus', value: '💎 Found a gem!', inline: true });
  }
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function enterDailyDungeon(interaction) {
  const dungeon = await getDailyDungeon();
  const region = getRegion(dungeon.regionId);
  
  const embed = new EmbedBuilder()
    .setTitle('🏰 Daily Dungeon')
    .setColor(0x9b59b6)
    .setDescription(`**${dungeon.name}**\nDifficulty: ${'⭐'.repeat(dungeon.difficulty)}`)
    .addFields(
      { name: 'Region', value: region ? region.name : dungeon.regionId, inline: true },
      { name: 'Difficulty', value: `${dungeon.difficulty}/3`, inline: true },
      { name: 'Rewards', value: `+${dungeon.rewards.xp} XP, +${dungeon.rewards.gold} Gold, +${dungeon.rewards.gems} Gems`, inline: false }
    );
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dungeon_enter_${dungeon.dungeonId}`)
      .setLabel('⚔️ Enter Dungeon (10 Energy)')
      .setStyle(ButtonStyle.Danger)
  );
  
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}