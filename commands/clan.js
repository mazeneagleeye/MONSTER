const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ensurePlayer, getPlayer } = require('../lib/players');
const {
  contributeGuildResources,
  getPlayerResourceState,
  investKnowledge,
  startGuildConstruction,
  getGuildConstructionStatus,
  buildGuildStructure,
  RESOURCE_DEFINITIONS,
  BUILDING_DEFINITIONS
} = require('../lib/guilds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clan')
    .setDescription('Manage clan resources, works, and constructions')
    .addSubcommand(sub => sub.setName('state').setDescription('View your clan resource and work state'))
    .addSubcommand(sub => sub.setName('give').setDescription('Contribute resources to your guild').addStringOption(opt => opt.setName('resource').setDescription('Resource to contribute').setRequired(true).addChoices(
      { name: 'Wood', value: 'wood' },
      { name: 'Stone', value: 'stone' },
      { name: 'Iron', value: 'iron' },
      { name: 'Gems', value: 'gems' }
    )).addIntegerOption(opt => opt.setName('amount').setDescription('Amount to contribute').setRequired(true).setMinValue(1)))
    .addSubcommand(sub => sub.setName('invest').setDescription('Invest a knowledge book into a work').addStringOption(opt => opt.setName('work').setDescription('Work to invest in').setRequired(true).addChoices(
      { name: 'Lumberjack', value: 'lumberjack' },
      { name: 'Miner', value: 'miner' },
      { name: 'Jeweler', value: 'jeweler' },
      { name: 'Banker', value: 'banker' },
      { name: 'Builder', value: 'builder' },
      { name: 'Engineer', value: 'engineer' },
      { name: 'Merchant', value: 'merchant' },
      { name: 'Knight', value: 'knight' },
      { name: 'Negotiant', value: 'negociant' },
      { name: 'Blacksmith', value: 'blacksmith' }
    )))
    .addSubcommand(sub => sub.setName('build').setDescription('Start building a new clan structure').addStringOption(opt => opt.setName('structure').setDescription('Structure to build').setRequired(true).addChoices(
      { name: 'Clan Laboratory', value: 'laboratory' }
    )))
    .addSubcommand(sub => sub.setName('finish').setDescription('Finish a clan construction if its timer has expired')),

  async execute(interaction) {
    await ensurePlayer(interaction.user.id);
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'state':
        await showClanState(interaction);
        break;
      case 'give':
        await giveResources(interaction);
        break;
      case 'invest':
        await investWork(interaction);
        break;
      case 'build':
        await buildStructure(interaction);
        break;
      case 'finish':
        await finishStructure(interaction);
        break;
    }
  }
};

async function showClanState(interaction) {
  const player = await getPlayer(interaction.user.id);
  if (!player.guildId) {
    return interaction.reply({ content: 'You are not in a guild yet.', ephemeral: true });
  }
  const state = await getPlayerResourceState(interaction.user.id);
  const construction = await getGuildConstructionStatus(player.guildId);
  const embed = new EmbedBuilder()
    .setTitle('🏰 Clan Overview')
    .setColor(0x2ecc71)
    .addFields(
      { name: 'Personal Resources', value: formatResources(state.resources), inline: false },
      { name: 'Works', value: formatWorks(state.workLevels), inline: false },
      { name: 'Knowledge Books', value: `${state.knowledgeBooks}`, inline: true }
    );

  if (construction) {
    const buildingEntries = Object.entries(construction.construction || {}).map(([id, data]) => {
      const definition = BUILDING_DEFINITIONS[id];
      const timeLeft = Math.max(0, Math.ceil((data.completedAt - Date.now()) / 3600000));
      return `${definition?.name || id}: ${timeLeft}h left`;
    });
    embed.addFields({ name: 'Active Constructions', value: buildingEntries.length ? buildingEntries.join('\n') : 'None', inline: false });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function giveResources(interaction) {
  const resource = interaction.options.getString('resource');
  const amount = interaction.options.getInteger('amount');
  const result = await contributeGuildResources(interaction.user.id, resource, amount);
  await interaction.reply({ content: result.message, ephemeral: true });
}

async function investWork(interaction) {
  const work = interaction.options.getString('work');
  const result = await investKnowledge(interaction.user.id, work);
  await interaction.reply({ content: result.message, ephemeral: true });
}

async function buildStructure(interaction) {
  const player = await getPlayer(interaction.user.id);
  if (!player.guildId) {
    return interaction.reply({ content: 'You are not in a guild yet.', ephemeral: true });
  }
  const structure = interaction.options.getString('structure');
  const result = await startGuildConstruction(player.guildId, structure);
  await interaction.reply({ content: result.message, ephemeral: true });
}

async function finishStructure(interaction) {
  const player = await getPlayer(interaction.user.id);
  if (!player.guildId) {
    return interaction.reply({ content: 'You are not in a guild yet.', ephemeral: true });
  }
  const result = await buildGuildStructure(player.guildId, 'laboratory');
  await interaction.reply({ content: result.message, ephemeral: true });
}

function formatResources(resources) {
  if (!Object.keys(resources).length) {
    return 'No resources yet';
  }
  return Object.entries(resources).map(([key, value]) => `${RESOURCE_DEFINITIONS[key]?.icon || '📦'} ${key}: ${value}`).join('\n');
}

function formatWorks(workLevels) {
  if (!Object.keys(workLevels).length) {
    return 'No work invested yet';
  }
  return Object.entries(workLevels).map(([key, value]) => `${key}: ${value}`).join('\n');
}
