const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getPlayer, ensurePlayer, updateEnergy } = require('../lib/players');
const { startBattle, BATTLE_TYPES, STATUS_EFFECTS } = require('../lib/battles');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('battle')
    .setDescription('Battle with your monster')
    .addSubcommand(sub => {
      sub
        .setName('pve')
        .setDescription('Battle against a random enemy')
        .addStringOption(opt => opt
          .setName('difficulty')
          .setDescription('Battle difficulty')
          .setRequired(false)
          .addChoices(
            { name: 'Easy', value: 'easy' },
            { name: 'Normal', value: 'normal' },
            { name: 'Hard', value: 'hard' },
            { name: 'Nightmare', value: 'nightmare' },
            { name: 'Mythic', value: 'mythic' }
          ));
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('boss')
        .setDescription('Battle against a boss (costs 10 energy)')
        .addStringOption(opt => opt
          .setName('difficulty')
          .setDescription('Battle difficulty')
          .setRequired(false)
          .addChoices(
            { name: 'Easy', value: 'easy' },
            { name: 'Normal', value: 'normal' },
            { name: 'Hard', value: 'hard' },
            { name: 'Nightmare', value: 'nightmare' },
            { name: 'Mythic', value: 'mythic' }
          ));
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('worldboss')
        .setDescription('Battle against the world boss (costs 20 energy)');
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('pvp')
        .setDescription('Challenge another player')
        .addUserOption(opt => opt
          .setName('opponent')
          .setDescription('Player to challenge')
          .setRequired(true));
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('tower')
        .setDescription('Climb the tower')
        .addNumberOption(opt => opt
          .setName('floor')
          .setDescription('Floor to challenge')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(100));
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('survival')
        .setDescription('Enter survival mode');
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('dungeon')
        .setDescription('Enter a dungeon')
        .addStringOption(opt => opt
          .setName('id')
          .setDescription('Dungeon ID')
          .setRequired(false));
      return sub;
    }),

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
        options.difficulty = interaction.options.getString('difficulty') || 'normal';
        break;
      case 'boss':
        battleType = BATTLE_TYPES.BOSS;
        options.difficulty = interaction.options.getString('difficulty') || 'normal';
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
        options.floor = interaction.options.getNumber('floor') || 1;
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
    
    // Record battle in history
    const { recordBattle } = require('../lib/battles');
    const enemyName = battleType === BATTLE_TYPES.PVP ? 'PvP Battle' : 
                      battleType === BATTLE_TYPES.WORLD_BOSS ? 'World Boss' :
                      battleType === BATTLE_TYPES.BOSS ? 'Boss' :
                      battleType === BATTLE_TYPES.TOWER ? `Tower Floor ${options.floor || 1}` :
                      battleType === BATTLE_TYPES.SURVIVAL ? 'Survival' :
                      battleType === BATTLE_TYPES.DUNGEON ? 'Dungeon' : 'Wild Monster';
    
    await recordBattle(interaction.user.id, {
      result: result.won ? 'win' : 'loss',
      enemyName: enemyName,
      damageDealt: result.battleLog.filter(log => log.attacker === 'player').reduce((sum, log) => sum + (log.damage || 0), 0),
      damageTaken: result.battleLog.filter(log => log.attacker === 'enemy').reduce((sum, log) => sum + (log.damage || 0), 0),
      rounds: result.rounds || result.battleLog.length
    });
    
    // Create battle log embed
    const embed = new EmbedBuilder()
      .setTitle(result.won ? '🏆 Victory!' : '💀 Defeat')
      .setColor(result.won ? 0x27ae60 : 0xe74c3c)
      .setDescription(`Battle completed in ${result.rounds || result.battleLog.length} rounds | Difficulty: ${result.difficulty || 'Normal'}`);
    
    // Show last 10 rounds with better formatting
    const recentRounds = result.battleLog.slice(-10);
    for (const round of recentRounds) {
      let roundText = round.message || 'Unknown action';
      
      // Add status effect indicators
      if (round.statusApplied) {
        const statusEmoji = STATUS_EFFECTS[round.statusApplied.type]?.emoji || '✨';
        roundText += ` ${statusEmoji}`;
      }
      
      if (round.skipped) {
        roundText = `⏭️ ${roundText}`;
      } else if (round.confused) {
        roundText = `🌀 ${roundText}`;
      }
      
      embed.addFields({
        name: `Round ${round.round}`,
        value: roundText,
        inline: true
      });
    }
    
    if (result.won && result.rewards) {
      const rewardsText = [
        `**XP:** +${result.rewards.xp}`,
        `**Gold:** +${result.rewards.gold}`,
        `**Gems:** +${result.rewards.gems}`,
        result.rewards.monsterXp ? `**Monster XP:** +${result.rewards.monsterXp}` : null
      ].filter(Boolean).join('\n');
      
      embed.addFields({
        name: '🎁 Rewards',
        value: rewardsText,
        inline: false
      });
    }
    
    embed.setFooter({ text: `Your HP: ${result.playerHp} | Enemy HP: ${result.enemyHp}` });
    
    await interaction.editReply({ embeds: [embed] });
  }
};