const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ensurePlayer } = require('../lib/players');
const { assignDailyQuests, getDailyQuests, claimQuestReward, updateQuestProgress, getWeeklyQuests } = require('../lib/events');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quests')
    .setDescription('View and manage quests')
    .addSubcommand(sub => sub
      .setName('daily')
      .setDescription('View your daily quests'))
    .addSubcommand(sub => sub
      .setName('claim')
      .setDescription('Claim quest reward')
      .addStringOption(opt => opt
        .setName('quest')
        .setDescription('Quest ID to claim')
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName('weekly')
      .setDescription('View your weekly quests')),

  async execute(interaction) {
    await ensurePlayer(interaction.user.id);
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'daily':
        await showDailyQuests(interaction);
        break;
      case 'claim':
        await claimReward(interaction);
        break;
      case 'weekly':
        await showWeeklyQuests(interaction);
        break;
    }
  }
};

async function showDailyQuests(interaction) {
  const quests = await assignDailyQuests(interaction.user.id);
  
  if (quests.length === 0) {
    return interaction.reply({ content: 'No daily quests available!', ephemeral: true });
  }
  
  const embed = new EmbedBuilder()
    .setTitle('📋 Daily Quests')
    .setColor(0x3498db)
    .setDescription('Complete these quests to earn rewards!');
  
  for (const quest of quests) {
    const progress = quest.progress || 0;
    const completed = quest.completed ? '✅' : '⏳';
    embed.addFields({
      name: `${completed} ${quest.name}`,
      value: `${quest.description}\nProgress: ${progress}/${quest.target}\nRewards: ${quest.rewards.xp} XP, ${quest.rewards.gold} Gold, ${quest.rewards.gems} Gems`,
      inline: false
    });
  }
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function claimReward(interaction) {
  const questId = interaction.options.getString('quest');
  const result = await claimQuestReward(interaction.user.id, questId);
  
  await interaction.reply({ content: result.message, ephemeral: true });
}

async function showWeeklyQuests(interaction) {
  const quests = await getWeeklyQuests(interaction.user.id);
  
  if (quests.length === 0) {
    return interaction.reply({ content: 'No weekly quests available!', ephemeral: true });
  }
  
  const embed = new EmbedBuilder()
    .setTitle('📅 Weekly Quests')
    .setColor(0x9b59b6)
    .setDescription('Complete these quests for big rewards!');
  
  for (const quest of quests) {
    const questTemplate = require('../lib/events').WEEKLY_QUESTS.find(q => q.id === quest.questId);
    if (!questTemplate) continue;
    
    const progress = quest.progress || 0;
    const completed = quest.completed ? '✅' : '⏳';
    embed.addFields({
      name: `${completed} ${questTemplate.name}`,
      value: `${questTemplate.description}\nProgress: ${progress}/${questTemplate.target}\nRewards: ${questTemplate.rewards.xp} XP, ${questTemplate.rewards.gold} Gold, ${questTemplate.rewards.gems} Gems`,
      inline: false
    });
  }
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}