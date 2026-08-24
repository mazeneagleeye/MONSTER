const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer, ensurePlayer, updateEnergy } = require('../lib/players');
const { startBattle, BATTLE_TYPES, DIFFICULTIES } = require('../lib/battles');
const { updateTowerProgress } = require('../lib/battles');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tower')
    .setDescription('Climb the tower of monsters')
    .addNumberOption(opt => opt
      .setName('floor')
      .setDescription('Floor to challenge (leave empty for next floor)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(100))
    .addStringOption(opt => opt
      .setName('difficulty')
      .setDescription('Tower difficulty')
      .setRequired(false)
      .addChoices(
        { name: 'Normal', value: 'normal' },
        { name: 'Hard', value: 'hard' },
        { name: 'Nightmare', value: 'nightmare' },
        { name: 'Mythic', value: 'mythic' }
      )),

  async execute(interaction) {
    await ensurePlayer(interaction.user.id);
    await updateEnergy(interaction.user.id);
    
    const player = await getPlayer(interaction.user.id);
    
    if (!player.activeMonster || player.activeMonster === 'null') {
      return interaction.reply({ 
        content: 'You need to set an active monster first! Use `/monsters set-active`', 
        ephemeral: true 
      });
    }
    
    const requestedFloor = interaction.options.getNumber('floor');
    const difficulty = interaction.options.getString('difficulty') || 'normal';
    const currentProgress = await updateTowerProgress(interaction.user.id, 0); // Get current progress
    
    // Get actual tower progress
    const { getTowerProgress } = require('../lib/battles');
    const highestFloor = await getTowerProgress(interaction.user.id);
    
    const floor = requestedFloor || (highestFloor + 1);
    
    if (floor > highestFloor + 1) {
      return interaction.reply({ 
        content: `You can only challenge floor ${highestFloor + 1} or lower! Your highest floor is ${highestFloor}.`,
        ephemeral: true 
      });
    }
    
    await interaction.deferReply();
    
    const result = await startBattle(interaction.user.id, BATTLE_TYPES.TOWER, { 
      floor: floor,
      difficulty: difficulty 
    });
    
    if (!result.success) {
      return interaction.editReply({ content: result.message });
    }
    
    const difficultyData = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
    
    // Create tower embed
    const embed = new EmbedBuilder()
      .setTitle(result.won ? `🏰 Tower Floor ${floor} - Cleared!` : `🏰 Tower Floor ${floor} - Failed`)
      .setColor(result.won ? 0x27ae60 : 0xe74c3c)
      .setDescription(result.won 
        ? `You conquered floor ${floor} of the tower!` 
        : `You were defeated on floor ${floor}.`)
      .addFields(
        { name: 'Difficulty', value: difficultyData.name, inline: true },
        { name: 'Rounds', value: String(result.rounds || result.battleLog.length), inline: true },
        { name: 'Your HP', value: String(result.playerHp), inline: true },
        { name: 'Enemy HP', value: String(result.enemyHp), inline: true }
      );
    
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
      
      // Update tower progress
      const newProgress = await updateTowerProgress(interaction.user.id, floor);
      if (newProgress) {
        embed.addFields({
          name: '🏆 New Record!',
          value: `You reached floor ${floor}!`,
          inline: false
        });
      }
    }
    
    // Show last 5 rounds
    const recentRounds = result.battleLog.slice(-5);
    for (const round of recentRounds) {
      embed.addFields({
        name: `Round ${round.round}`,
        value: round.message || 'Unknown',
        inline: true
      });
    }
    
    embed.setFooter({ 
      text: result.won 
        ? `Highest floor: ${Math.max(highestFloor, floor)}` 
        : `Try again on floor ${floor}` 
    });
    
    await interaction.editReply({ embeds: [embed] });
  }
};