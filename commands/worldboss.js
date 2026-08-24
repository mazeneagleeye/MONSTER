const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getPlayer, ensurePlayer, updateEnergy } = require('../lib/players');
const { BATTLE_TYPES, damageWorldBoss, getWorldBossRankings } = require('../lib/battles');
const { getPlayerMonster } = require('../lib/monsters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('worldboss')
    .setDescription('Battle against the world boss (costs 20 energy)'),

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
    
    const activeMonsterId = player.activeMonster;
    const playerMonster = await getPlayerMonster(activeMonsterId);
    
    if (!playerMonster) {
      return interaction.reply({ 
        content: 'Active monster not found!', 
        ephemeral: true 
      });
    }
    
    // World boss costs 20 energy
    const energyCost = 20;
    const { spendEnergy } = require('../lib/players');
    const canBattle = await spendEnergy(interaction.user.id, energyCost);
    
    if (!canBattle) {
      return interaction.reply({ 
        content: `Not enough energy! You need ${energyCost} energy to challenge the world boss.`,
        ephemeral: true 
      });
    }
    
    await interaction.deferReply();
    
    // Calculate damage dealt by player's monster
    const { calculateDamage, calculateHP } = require('../lib/battles');
    const worldBoss = await getWorldBossEnemy();
    
    if (!worldBoss) {
      return interaction.editReply({ 
        content: 'World boss is not available right now!',
        ephemeral: true 
      });
    }
    
    // Simulate a quick battle to determine damage
    const playerHp = calculateHP(playerMonster);
    const bossHp = calculateHP(worldBoss);
    let currentPlayerHp = playerHp;
    let currentBossHp = bossHp;
    let totalDamage = 0;
    let rounds = 0;
    const maxRounds = 50;
    
    while (currentPlayerHp > 0 && currentBossHp > 0 && rounds < maxRounds) {
      // Player attacks
      const playerSkills = playerMonster.skills || [];
      const playerSkill = playerSkills.length > 0 ? playerSkills[Math.floor(Math.random() * playerSkills.length)] : null;
      
      const playerAttack = await calculateDamage(playerMonster, worldBoss, playerSkill);
      currentBossHp -= playerAttack.damage;
      totalDamage += playerAttack.damage;
      
      if (currentBossHp <= 0) break;
      
      // Boss attacks
      const bossSkills = worldBoss.skills || [];
      const bossSkill = bossSkills.length > 0 ? bossSkills[Math.floor(Math.random() * bossSkills.length)] : null;
      
      const bossAttack = await calculateDamage(worldBoss, playerMonster, bossSkill);
      currentPlayerHp -= bossAttack.damage;
      
      rounds++;
    }
    
    // Record damage to world boss
    const bossId = 'world_boss_current';
    const newBossHp = await damageWorldBoss(bossId, totalDamage, interaction.user.id);
    
    // Award participation rewards
    const { addXP, addGold, addGems } = require('../lib/players');
    const { addMonsterXP } = require('../lib/monsters');
    
    const participationXp = Math.floor(totalDamage / 10);
    const participationGold = Math.floor(totalDamage / 20);
    const participationGems = Math.floor(totalDamage / 100);
    const monsterXp = Math.floor(totalDamage / 15);
    
    await addXP(interaction.user.id, participationXp);
    await addGold(interaction.user.id, participationGold);
    await addGems(interaction.user.id, participationGems);
    await addMonsterXP(activeMonsterId, monsterXp);
    
    // Get rankings
    const rankings = await getWorldBossRankings(bossId, 10);
    const playerRank = rankings.findIndex(r => r.userId === interaction.user.id) + 1;
    
    // Create world boss embed
    const embed = new EmbedBuilder()
      .setTitle(currentBossHp <= 0 ? '🎉 World Boss Defeated!' : '⚔️ World Boss Battle')
      .setColor(currentBossHp <= 0 ? 0xf39c12 : 0xe74c3c)
      .setDescription(
        currentBossHp <= 0 
          ? 'The world boss has been defeated by the community!' 
          : `You dealt **${totalDamage}** damage to the world boss!`
      )
      .addFields(
        { name: 'Your Damage', value: totalDamage.toLocaleString(), inline: true },
        { name: 'Your Rank', value: playerRank > 0 ? `#${playerRank}` : 'Unranked', inline: true },
        { name: 'Rounds', value: String(rounds), inline: true },
        { name: 'Boss HP Remaining', value: Math.max(0, newBossHp || 0).toLocaleString(), inline: true }
      );
    
    // Show rewards
    const rewardsText = [
      `**XP:** +${participationXp}`,
      `**Gold:** +${participationGold}`,
      `**Gems:** +${participationGems}`,
      `**Monster XP:** +${monsterXp}`
    ].join('\n');
    
    embed.addFields({
      name: '🎁 Participation Rewards',
      value: rewardsText,
      inline: false
    });
    
    // Show top 5 rankings
    if (rankings.length > 0) {
      const topPlayers = rankings.slice(0, 5).map((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
        return `${medal} <@${player.userId}> - ${player.damage.toLocaleString()} damage`;
      }).join('\n');
      
      embed.addFields({
        name: '🏆 Top Damage Dealers',
        value: topPlayers,
        inline: false
      });
    }
    
    if (currentBossHp <= 0) {
      embed.addFields({
        name: '🎊 Celebration!',
        value: 'The world boss has been defeated! All participants will receive bonus rewards on the next reset.',
        inline: false
      });
    }
    
    embed.setFooter({ text: 'Keep attacking to climb the rankings!' });
    embed.setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  }
};

async function getWorldBossEnemy() {
  const { getMonster } = require('./monsters');
  const monster = await getMonster('monster_500');
  
  if (!monster) {
    return {
      id: 'world_boss',
      name: 'World Boss',
      element: 'Dark',
      type: 'Demon',
      rarity: 'Mythic',
      baseHp: 10000,
      baseAttack: 150,
      baseDefense: 100,
      baseSpeed: 60,
      skills: [
        { name: 'Apocalypse', damage: 300, statusEffect: 'burn', statusChance: 0.3 },
        { name: 'Dark Wave', damage: 200, statusEffect: 'poison', statusChance: 0.4 }
      ],
      level: 100,
      isWorldBoss: true
    };
  }
  
  return {
    ...monster,
    level: 100,
    skills: JSON.parse(monster.skills || '[]'),
    isWorldBoss: true
  };
}