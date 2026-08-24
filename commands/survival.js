const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer, ensurePlayer, updateEnergy } = require('../lib/players');
const { startBattle, BATTLE_TYPES, DIFFICULTIES } = require('../lib/battles');
const { updateSurvivalHighScore } = require('../lib/battles');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('survival')
    .setDescription('Enter survival mode - fight endless waves!')
    .addStringOption(opt => opt
      .setName('difficulty')
      .setDescription('Survival difficulty')
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
    const difficulty = interaction.options.getString('difficulty') || 'normal';
    
    if (!player.activeMonster || player.activeMonster === 'null') {
      return interaction.reply({ 
        content: 'You need to set an active monster first! Use `/monsters set-active`', 
        ephemeral: true 
      });
    }
    
    await interaction.deferReply();
    
    // Survival mode - fight multiple waves
    const difficultyData = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
    let wave = 1;
    let totalWaves = 0;
    let playerHp = 100; // Will be set by first battle
    let monsterXpGained = 0;
    let goldGained = 0;
    let xpGained = 0;
    let gemsGained = 0;
    
    const battleLogs = [];
    const maxWaves = 10; // Maximum waves per survival run
    
    while (totalWaves < maxWaves) {
      // Scale enemy with wave number
      const waveOptions = {
        difficulty: difficulty,
        wave: wave
      };
      
      const result = await startBattle(interaction.user.id, BATTLE_TYPES.SURVIVAL, waveOptions);
      
      if (!result.success) {
        return interaction.editReply({ content: result.message });
      }
      
      battleLogs.push({
        wave: wave,
        won: result.won,
        rounds: result.rounds || result.battleLog.length,
        playerHp: result.playerHp,
        enemyHp: result.enemyHp
      });
      
      if (result.won) {
        // Accumulate rewards
        xpGained += result.rewards?.xp || 0;
        goldGained += result.rewards?.gold || 0;
        gemsGained += result.rewards?.gems || 0;
        monsterXpGained += result.rewards?.monsterXp || 0;
        
        // Heal 20% HP between waves
        playerHp = Math.min(100, result.playerHp + 20);
        totalWaves++;
        wave++;
        
        // Continue to next wave
        continue;
      } else {
        // Player lost - end survival
        break;
      }
    }
    
    // Award accumulated rewards
    const { addXP, addGold, addGems } = require('../lib/players');
    const { addMonsterXP } = require('../lib/monsters');
    
    await addXP(interaction.user.id, xpGained);
    await addGold(interaction.user.id, goldGained);
    await addGems(interaction.user.id, gemsGained);
    
    // Add monster XP
    const activeMonsterId = player.activeMonster;
    if (activeMonsterId && activeMonsterId !== 'null') {
      await addMonsterXP(activeMonsterId, monsterXpGained);
    }
    
    // Update high score
    const isNewHighScore = await updateSurvivalHighScore(interaction.user.id, totalWaves);
    
    // Create survival embed
    const embed = new EmbedBuilder()
      .setTitle(totalWaves >= maxWaves ? '🏆 Survival Complete!' : '💀 Survival Ended')
      .setColor(totalWaves >= maxWaves ? 0xf39c12 : 0xe74c3c)
      .setDescription(`You survived ${totalWaves} wave${totalWaves !== 1 ? 's' : ''}!`)
      .addFields(
        { name: 'Difficulty', value: difficultyData.name, inline: true },
        { name: 'Waves Survived', value: `${totalWaves}/${maxWaves}`, inline: true },
        { name: 'Final HP', value: `${Math.max(0, playerHp)}/100`, inline: true }
      );
    
    // Show wave results
    const waveResults = battleLogs.map(log => 
      `Wave ${log.wave}: ${log.won ? '✅' : '❌'} (${log.rounds} rounds)`
    ).join('\n');
    
    if (waveResults) {
      embed.addFields({
        name: 'Wave Results',
        value: waveResults || 'No waves completed',
        inline: false
      });
    }
    
    // Show rewards
    const rewardsText = [
      `**XP:** +${xpGained}`,
      `**Gold:** +${goldGained}`,
      `**Gems:** +${gemsGained}`,
      `**Monster XP:** +${monsterXpGained}`
    ].join('\n');
    
    embed.addFields({
      name: '🎁 Total Rewards',
      value: rewardsText,
      inline: false
    });
    
    if (isNewHighScore) {
      embed.addFields({
        name: '🏆 New High Score!',
        value: `You survived ${totalWaves} waves!`,
        inline: false
      });
    }
    
    embed.setFooter({ 
      text: totalWaves >= maxWaves 
        ? 'Incredible! You conquered all waves!' 
        : 'Train stronger and try again!' 
    });
    
    await interaction.editReply({ embeds: [embed] });
  }
};