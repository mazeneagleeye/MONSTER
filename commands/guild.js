const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ensurePlayer, getPlayer } = require('../lib/players');
const { createGuild, joinGuild, leaveGuild, getGuild, getGuildMembers, contributeToGuild, upgradeGuild, getGuildLeaderboard } = require('../lib/guilds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guild')
    .setDescription('Guild management')
    .addSubcommand(sub => {
      sub
        .setName('create')
        .setDescription('Create a new guild')
        .addStringOption(opt => opt
          .setName('name')
          .setDescription('Guild name')
          .setRequired(true)
          .setMaxLength(32));
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('join')
        .setDescription('Join a guild')
        .addStringOption(opt => opt
          .setName('guild_id')
          .setDescription('Guild ID to join')
          .setRequired(true));
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('leave')
        .setDescription('Leave your guild');
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('info')
        .setDescription('View guild information');
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('members')
        .setDescription('View guild members');
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('contribute')
        .setDescription('Contribute gold to guild')
        .addIntegerOption(opt => opt
          .setName('amount')
          .setDescription('Amount of gold')
          .setRequired(true)
          .setMinValue(1));
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('upgrade')
        .setDescription('Upgrade guild')
        .addStringOption(opt => opt
          .setName('type')
          .setDescription('Upgrade type')
          .setRequired(true)
          .addChoices(
            { name: 'Bank', value: 'bank' },
            { name: 'Members', value: 'members' },
            { name: 'Research', value: 'research' }
          ));
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('leaderboard')
        .setDescription('View guild leaderboard');
      return sub;
    }),

  async execute(interaction) {
    await ensurePlayer(interaction.user.id);
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'create':
        await createGuildCmd(interaction);
        break;
      case 'join':
        await joinGuildCmd(interaction);
        break;
      case 'leave':
        await leaveGuildCmd(interaction);
        break;
      case 'info':
        await guildInfo(interaction);
        break;
      case 'members':
        await guildMembers(interaction);
        break;
      case 'contribute':
        await contributeCmd(interaction);
        break;
      case 'upgrade':
        await upgradeCmd(interaction);
        break;
      case 'leaderboard':
        await guildLeaderboard(interaction);
        break;
    }
  }
};

async function createGuildCmd(interaction) {
  const name = interaction.options.getString('name');
  const result = await createGuild(interaction.user.id, name);
  
  if (result.success) {
    await interaction.reply({ content: `Created guild **${result.name}**! ID: ${result.guildId}`, ephemeral: true });
  } else {
    await interaction.reply({ content: result.message, ephemeral: true });
  }
}

async function joinGuildCmd(interaction) {
  const guildId = interaction.options.getString('id');
  const result = await joinGuild(interaction.user.id, guildId);
  
  await interaction.reply({ content: result.message, ephemeral: true });
}

async function leaveGuildCmd(interaction) {
  const result = await leaveGuild(interaction.user.id);
  await interaction.reply({ content: result.message, ephemeral: true });
}

async function guildInfo(interaction) {
  const player = await getPlayer(interaction.user.id);
  
  if (!player.guildId) {
    return interaction.reply({ content: 'You are not in a guild!', ephemeral: true });
  }
  
  const guild = await getGuild(player.guildId);
  
  const embed = new EmbedBuilder()
    .setTitle(`🏰 ${guild.name}`)
    .setColor(0x3498db)
    .addFields(
      { name: 'Level', value: `${guild.level}`, inline: true },
      { name: 'XP', value: `${guild.xp}/${guild.level * 1000}`, inline: true },
      { name: 'Members', value: `${guild.members?.length || 0}`, inline: true },
      { name: 'Bank', value: `${guild.bank} gold`, inline: true }
    );
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function guildMembers(interaction) {
  const player = await getPlayer(interaction.user.id);
  
  if (!player.guildId) {
    return interaction.reply({ content: 'You are not in a guild!', ephemeral: true });
  }
  
  const members = await getGuildMembers(player.guildId);
  
  const embed = new EmbedBuilder()
    .setTitle('Guild Members')
    .setColor(0x3498db)
    .setDescription(members.map((m, i) => 
      `${i + 1}. <@${m.userId}> - ${m.rank} (Lv.${m.level}) - ${m.contribution} contribution`
    ).join('\n'));
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function contributeCmd(interaction) {
  const amount = interaction.options.getInteger('amount');
  const result = await contributeToGuild(interaction.user.id, amount);
  
  await interaction.reply({ content: result.message, ephemeral: true });
}

async function upgradeCmd(interaction) {
  const upgradeType = interaction.options.getString('type');
  const player = await getPlayer(interaction.user.id);
  
  if (!player.guildId) {
    return interaction.reply({ content: 'You are not in a guild!', ephemeral: true });
  }
  
  const result = await upgradeGuild(player.guildId, upgradeType);
  await interaction.reply({ content: result.message, ephemeral: true });
}

async function guildLeaderboard(interaction) {
  const topGuilds = await getGuildLeaderboard(10);
  
  const embed = new EmbedBuilder()
    .setTitle('🏆 Guild Leaderboard')
    .setColor(0xf39c12)
    .setDescription(topGuilds.map((g, i) => 
      `${i + 1}. **${g.name}** - Lv.${g.level} (${g.memberCount} members)`
    ).join('\n') || 'No guilds yet');
  
  await interaction.reply({ embeds: [embed] });
}