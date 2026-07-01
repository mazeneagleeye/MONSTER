const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ensurePlayer } = require('../lib/players');
const { createTournament, joinTournament, leaveTournament, getTournament, getOpenTournaments, startTournament } = require('../lib/tournaments');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tournament')
    .setDescription('Tournament system')
    .addSubcommand(sub => {
      sub
        .setName('create')
        .setDescription('Create a new tournament')
        .addStringOption(opt => opt
          .setName('name')
          .setDescription('Tournament name')
          .setRequired(true)
          .setMaxLength(32))
        .addStringOption(opt => opt
          .setName('type')
          .setDescription('Tournament type')
          .setRequired(true)
          .addChoices(
            { name: 'Single Elimination', value: 'single' },
            { name: 'Double Elimination', value: 'double' },
            { name: 'Round Robin', value: 'round_robin' },
            { name: 'Survival', value: 'survival' }
          ))
        .addIntegerOption(opt => opt
          .setName('max_players')
          .setDescription('Maximum participants')
          .setRequired(false)
          .setMinValue(2)
          .setMaxValue(32)
          .setDefaultValue(8));
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('join')
        .setDescription('Join a tournament')
        .addStringOption(opt => opt
          .setName('tournament_id')
          .setDescription('Tournament ID to join')
          .setRequired(true));
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('leave')
        .setDescription('Leave a tournament')
        .addStringOption(opt => opt
          .setName('tournament_id')
          .setDescription('Tournament ID to leave')
          .setRequired(true));
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('browse')
        .setDescription('Browse open tournaments');
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('info')
        .setDescription('View tournament details')
        .addStringOption(opt => opt
          .setName('tournament_id')
          .setDescription('Tournament ID')
          .setRequired(true));
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('start')
        .setDescription('Start a tournament (creator only)')
        .addStringOption(opt => opt
          .setName('tournament_id')
          .setDescription('Tournament ID to start')
          .setRequired(true));
      return sub;
    }),

  async execute(interaction) {
    await ensurePlayer(interaction.user.id);
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'create':
        await createTournamentCmd(interaction);
        break;
      case 'join':
        await joinTournamentCmd(interaction);
        break;
      case 'leave':
        await leaveTournamentCmd(interaction);
        break;
      case 'browse':
        await browseTournaments(interaction);
        break;
      case 'info':
        await tournamentInfo(interaction);
        break;
      case 'start':
        await startTournamentCmd(interaction);
        break;
    }
  }
};

async function createTournamentCmd(interaction) {
  const name = interaction.options.getString('name');
  const type = interaction.options.getString('type');
  const maxPlayers = interaction.options.getInteger('players') || 8;
  
  const result = await createTournament(interaction.user.id, name, type, maxPlayers);
  
  if (result.success) {
    await interaction.reply({ 
      content: `Created tournament **${name}**!\nType: ${type}\nMax Players: ${maxPlayers}\nTournament ID: ${result.tournamentId}`, 
      ephemeral: true 
    });
  } else {
    await interaction.reply({ content: result.message, ephemeral: true });
  }
}

async function joinTournamentCmd(interaction) {
  const tournamentId = interaction.options.getString('id');
  const result = await joinTournament(tournamentId, interaction.user.id);
  
  await interaction.reply({ content: result.message, ephemeral: true });
}

async function leaveTournamentCmd(interaction) {
  const tournamentId = interaction.options.getString('id');
  const result = await leaveTournament(tournamentId, interaction.user.id);
  
  await interaction.reply({ content: result.message, ephemeral: true });
}

async function browseTournaments(interaction) {
  const tournaments = await getOpenTournaments();
  
  if (tournaments.length === 0) {
    return interaction.reply({ content: 'No open tournaments available! Create one with /tournament create', ephemeral: true });
  }
  
  const typeNames = {
    single_elimination: 'Single Elimination',
    double_elimination: 'Double Elimination',
    round_robin: 'Round Robin',
    survival: 'Survival'
  };
  
  const embed = new EmbedBuilder()
    .setTitle('🏆 Open Tournaments')
    .setColor(0xf39c12)
    .setDescription(tournaments.map((t, i) => 
      `${i + 1}. **${t.name}**\n   Type: ${typeNames[t.type] || t.type}\n   Players: ${t.participantCount}/${t.maxParticipants}\n   ID: ${t.tournamentId}`
    ).join('\n\n'));
  
  embed.setFooter({ text: 'Use /tournament join [id] to join!' });
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function tournamentInfo(interaction) {
  const tournamentId = interaction.options.getString('id');
  const tournament = await getTournament(tournamentId);
  
  if (!tournament) {
    return interaction.reply({ content: 'Tournament not found!', ephemeral: true });
  }
  
  const typeNames = {
    single_elimination: 'Single Elimination',
    double_elimination: 'Double Elimination',
    round_robin: 'Round Robin',
    survival: 'Survival'
  };
  
  const statusEmoji = {
    open: '🟢',
    active: '🔴',
    completed: '✅',
    cancelled: '❌'
  };
  
  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${tournament.name}`)
    .setColor(0xf39c12)
    .setDescription(`**Status:** ${statusEmoji[tournament.status] || tournament.status}`)
    .addFields(
      { name: 'Type', value: typeNames[tournament.type] || tournament.type, inline: true },
      { name: 'Participants', value: `${tournament.participantCount}/${tournament.maxParticipants}`, inline: true },
      { name: 'Rewards', value: `+${tournament.rewards.xp} XP, +${tournament.rewards.gold} Gold, +${tournament.rewards.gems} Gems\nTitle: ${tournament.rewards.title}`, inline: false }
    );
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function startTournamentCmd(interaction) {
  const tournamentId = interaction.options.getString('id');
  const result = await startTournament(tournamentId, interaction.user.id);
  
  await interaction.reply({ content: result.message, ephemeral: true });
}