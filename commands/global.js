const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ensurePlayer } = require('../lib/players');
const { sendGlobalMessage, getGlobalMessages, getGlobalLeaderboard, getPlayerRank } = require('../lib/global');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('global')
    .setDescription('Global features')
    .addSubcommand(sub => {
      sub
        .setName('chat')
        .setDescription('Send a global message')
        .addStringOption(opt => opt
          .setName('message')
          .setDescription('Message to send')
          .setRequired(true)
          .setMaxLength(200));
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('leaderboard')
        .setDescription('View global leaderboards')
        .addStringOption(opt => opt
          .setName('type')
          .setDescription('Leaderboard type')
          .setRequired(false)
          .addChoices(
            { name: 'Level', value: 'level' },
            { name: 'Damage', value: 'damage' },
            { name: 'Gold', value: 'gold' },
            { name: 'Guilds', value: 'guild' }
          ));
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('rank')
        .setDescription('Check your global rank');
      return sub;
    }),

  async execute(interaction) {
    await ensurePlayer(interaction.user.id);
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'chat':
        await globalChat(interaction);
        break;
      case 'leaderboard':
        await globalLeaderboard(interaction);
        break;
      case 'rank':
        await checkRank(interaction);
        break;
    }
  }
};

async function globalChat(interaction) {
  const message = interaction.options.getString('message');
  const result = await sendGlobalMessage(interaction.user.id, message);
  
  if (result.success) {
    await interaction.reply({ content: `📢 Message sent to global chat!`, ephemeral: true });
  } else {
    await interaction.reply({ content: result.message, ephemeral: true });
  }
}

async function globalLeaderboard(interaction) {
  const type = interaction.options.getString('type') || 'level';
  const topPlayers = await getGlobalLeaderboard(type, 20);
  
  const typeNames = {
    level: 'Level',
    damage: 'Damage',
    gold: 'Gold',
    guild: 'Guild'
  };
  
  const embed = new EmbedBuilder()
    .setTitle(`🌍 Global ${typeNames[type]} Leaderboard`)
    .setColor(0xf39c12)
    .setDescription(topPlayers.map((player, i) => {
      if (type === 'guild') {
        return `${i + 1}. **${player.name}** - Lv.${player.level} (${player.memberCount} members)`;
      }
      return `${i + 1}. <@${player.userId}> - ${type === 'level' ? `Lv.${player.level}` : type === 'damage' ? `${player.totalDamage} damage` : `${player.gold} gold`}`;
    }).join('\n') || 'No data yet');
  
  await interaction.reply({ embeds: [embed] });
}

async function checkRank(interaction) {
  const type = 'level';
  const rank = await getPlayerRank(interaction.user.id, type);
  
  if (!rank) {
    return interaction.reply({ content: 'Could not find your rank!', ephemeral: true });
  }
  
  await interaction.reply({ content: `Your global rank: #${rank}`, ephemeral: true });
}