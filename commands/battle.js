const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getPlayer, ensurePlayer, updateEnergy } = require('../lib/players');
const { startBattle, BATTLE_TYPES } = require('../lib/battles');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('battle')
    .setDescription('Battle with your monster')
    .addSubcommand(sub => sub
      .setName('pve')
      .setDescription('Battle against a random enemy'))
    .addSubcommand(sub => sub
      .setName('boss')
      .setDescription('Battle against a boss (costs 10 energy)'))
    .addSubcommand(sub => sub
      .setName('worldboss')
      .setDescription('Battle against the world boss (costs 20 energy)'))
    .addSubcommand(sub => sub
      .setName('pvp')
      .setDescription('Challenge another player')
      .addUserOption(opt => opt
        .setName('opponent')
        .setDescription('Player to challenge')
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName('tower')
      .setDescription('Climb the tower')
      .addIntegerOption(opt => opt
        .setName('floor')
        .setDescription('Floor to challenge')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(100)))
    .addSubcommand(sub => sub
      .setName('survival')
      .setDescription('Enter survival mode'))
    .addSubcommand(sub => sub
      .setName('dungeon')
      .setDescription('Enter a dungeon')
      .addStringOption(opt => opt
        .setName('id')
        .setDescription('Dungeon ID')
        .setRequired(false))),

  async execute(interaction) {
    await ensurePlayer(interaction.user.id);
    await updateEnergy(interaction.user.id);
    
    const subcommand = interaction.options.getSubcommand();
    const player = await getPlayer(interaction.user.id);
    
    if (!player.activeMonster || player.activeMonster === 'null') {
      return interaction.reply({ content: 'You need to set an active monster first! Use `/monsters set-active`', ephemeral: true });
    }
    
    let battleType;
    let options = {};
    
    switch (subcommand) {
      case 'pve':
        battleType = BATTLE_TYPES.PVE;
        break;
      case 'boss':
        battleType = BATTLE_TYPES.BOSS;
        break;
      case 'worldboss':
        battleType = BATTLE_TYPES.WORLD_BOSS;
        break;
      case 'pvp':
        battleType = BATTLE_TYPES.PVP;
        const opponent = interaction.options.getUser('opponent');
        if (opponent.bot || opponent.id === interaction.user.id) {
          return interaction.reply({ content: 'Invalid opponent!', ephemeral: true });
        }
        options.opponentId = opponent.id;
        break;
      case 'tower':
        battleType = BATTLE_TYPES.TOWER;
        options.floor = interaction.options.getInteger('floor') || 1;
        break;
      case 'survival':
        battleType = BATTLE_TYPES.SURVIVAL;
        break;
      case 'dungeon':
        battleType = BATTLE_TYPES.DUNGEON;
        options.dungeonId = interaction.options.getString('id') || 'dungeon_1';
        break;
    }
    
    await interaction.deferReply();
    
    const result = await startBattle(interaction.user.id, battleType, options);
    
    if (!result.success) {
      return interaction.editReply({ content: result.message });
    }
    
    // Create battle log embed
    const embed = new EmbedBuilder()
      .setTitle(result.won ? '🏆 Victory!' : '💀 Defeat')
      .setColor(result.won ? 0x27ae60 : 0xe74c3c)
      .setDescription(`Battle completed in ${result.battleLog.length} rounds`);
    
    // Show last 5 rounds
    const recentRounds = result.battleLog.slice(-5);
    for (const round of recentRounds) {
      embed.addFields({
        name: `Round ${round.round}`,
        value: round.message,
        inline: true
      });
    }
    
    if (result.won && result.rewards) {
      embed.addFields(
        { name: 'XP Gained', value: `+${result.rewards.xp}`, inline: true },
        { name: 'Gold Gained', value: `+${result.rewards.gold}`, inline: true },
        { name: 'Gems Gained', value: `+${result.rewards.gems}`, inline: true }
      );
    }
    
    embed.setFooter({ text: `Your HP: ${result.playerHp} | Enemy HP: ${result.enemyHp}` });
    
    await interaction.editReply({ embeds: [embed] });
  }
};