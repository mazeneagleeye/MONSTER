const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { ensurePlayer } = require('../lib/players');
const { createParty, joinParty, leaveParty, getParty, getPlayerParty, getOpenParties, disbandParty, startPartyActivity } = require('../lib/parties');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('party')
    .setDescription('Party system')
    .addSubcommand(sub => sub
      .setName('create')
      .setDescription('Create a new party')
      .addStringOption(opt => opt
        .setName('activity')
        .setDescription('Party activity')
        .setRequired(true)
        .addChoices(
          { name: '⚔️ Raid Boss', value: 'raid' },
          { name: '🏰 Dungeon', value: 'dungeon' },
          { name: '🗺️ Exploration', value: 'explore' },
          { name: '⚔️ PvP Battle', value: 'pvp' },
          { name: '🌊 World Boss', value: 'world_boss' }
        )))
    .addSubcommand(sub => sub
      .setName('join')
      .setDescription('Join a party')
      .addStringOption(opt => opt
        .setName('id')
        .setDescription('Party ID')
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName('leave')
      .setDescription('Leave your current party'))
    .addSubcommand(sub => sub
      .setName('info')
      .setDescription('View party information'))
    .addSubcommand(sub => sub
      .setName('browse')
      .setDescription('Browse open parties'))
    .addSubcommand(sub => sub
      .setName('disband')
      .setDescription('Disband your party (leader only)'))
    .addSubcommand(sub => sub
      .setName('start')
      .setDescription('Start party activity (leader only)')),

  async execute(interaction) {
    await ensurePlayer(interaction.user.id);
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'create':
        await createPartyCmd(interaction);
        break;
      case 'join':
        await joinPartyCmd(interaction);
        break;
      case 'leave':
        await leavePartyCmd(interaction);
        break;
      case 'info':
        await partyInfo(interaction);
        break;
      case 'browse':
        await browseParties(interaction);
        break;
      case 'disband':
        await disbandPartyCmd(interaction);
        break;
      case 'start':
        await startActivity(interaction);
        break;
    }
  }
};

async function createPartyCmd(interaction) {
  const activity = interaction.options.getString('activity');
  const result = await createParty(interaction.user.id, activity);
  
  if (result.success) {
    await interaction.reply({ 
      content: `Created party for **${activity}**! Party ID: ${result.partyId}\nShare this ID with friends to join!`, 
      ephemeral: true 
    });
  } else {
    await interaction.reply({ content: result.message, ephemeral: true });
  }
}

async function joinPartyCmd(interaction) {
  const partyId = interaction.options.getString('id');
  const result = await joinParty(partyId, interaction.user.id);
  
  await interaction.reply({ content: result.message, ephemeral: true });
}

async function leavePartyCmd(interaction) {
  const party = await getPlayerParty(interaction.user.id);
  
  if (!party) {
    return interaction.reply({ content: 'You are not in a party!', ephemeral: true });
  }
  
  const result = await leaveParty(party.partyId, interaction.user.id);
  await interaction.reply({ content: result.message, ephemeral: true });
}

async function partyInfo(interaction) {
  const party = await getPlayerParty(interaction.user.id);
  
  if (!party) {
    return interaction.reply({ content: 'You are not in a party!', ephemeral: true });
  }
  
  const activityNames = {
    raid: '⚔️ Raid Boss',
    dungeon: '🏰 Dungeon',
    explore: '🗺️ Exploration',
    pvp: '⚔️ PvP Battle',
    world_boss: '🌊 World Boss'
  };
  
  const embed = new EmbedBuilder()
    .setTitle('👥 Party Info')
    .setColor(0x3498db)
    .setDescription(`**Activity:** ${activityNames[party.activity] || party.activity}\n**Status:** ${party.status}`)
    .addFields(
      { name: 'Leader', value: `<@${party.leaderId}>`, inline: true },
      { name: 'Members', value: `${party.members.length}/4`, inline: true }
    );
  
  if (party.members.length > 0) {
    const memberList = party.members.map(m => 
      `${m.isLeader ? '👑' : '👤'} ${m.username} (Lv.${m.level})`
    ).join('\n');
    embed.addFields({ name: 'Members', value: memberList, inline: false });
  }
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function browseParties(interaction) {
  const parties = await getOpenParties();
  
  if (parties.length === 0) {
    return interaction.reply({ content: 'No open parties available! Create one with /party create', ephemeral: true });
  }
  
  const activityNames = {
    raid: '⚔️ Raid Boss',
    dungeon: '🏰 Dungeon',
    explore: '🗺️ Exploration',
    pvp: '⚔️ PvP Battle',
    world_boss: '🌊 World Boss'
  };
  
  const embed = new EmbedBuilder()
    .setTitle('🔍 Open Parties')
    .setColor(0x2ecc71)
    .setDescription(parties.map((party, i) => 
      `${i + 1}. **${activityNames[party.activity] || party.activity}**\n   ID: ${party.partyId}\n   Members: ${party.memberCount}/4\n   Leader: <@${party.leaderId}>`
    ).join('\n\n'));
  
  embed.setFooter({ text: 'Use /party join [id] to join!' });
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function disbandPartyCmd(interaction) {
  const party = await getPlayerParty(interaction.user.id);
  
  if (!party) {
    return interaction.reply({ content: 'You are not in a party!', ephemeral: true });
  }
  
  if (party.leaderId !== interaction.user.id) {
    return interaction.reply({ content: 'Only the party leader can disband the party!', ephemeral: true });
  }
  
  const result = await disbandParty(party.partyId, interaction.user.id);
  await interaction.reply({ content: result.message, ephemeral: true });
}

async function startActivity(interaction) {
  const party = await getPlayerParty(interaction.user.id);
  
  if (!party) {
    return interaction.reply({ content: 'You are not in a party!', ephemeral: true });
  }
  
  if (party.leaderId !== interaction.user.id) {
    return interaction.reply({ content: 'Only the party leader can start the activity!', ephemeral: true });
  }
  
  const result = await startPartyActivity(party.partyId, interaction.user.id);
  await interaction.reply({ content: result.message, ephemeral: true });
}