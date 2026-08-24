const { get, run, all } = require('./db-adapter');
const { getPlayer, addXP, addGold, addGems, incrementStatistic } = require('./players');
const { getPlayerMonster, addMonsterXP } = require('./monsters');

// Handle attack button
async function handleAttackButton(interaction, client) {
  try {
    const userId = interaction.user.id;
    const player = await getPlayer(userId);
    
    // Check cooldown (1 hour)
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    if (player.lastAttackAt && (now - player.lastAttackAt < oneHour)) {
      const remaining = oneHour - (now - player.lastAttackAt);
      const minutes = Math.floor(remaining / 60000);
      return await interaction.reply({ 
        content: `⏰ You can attack again in ${minutes} minutes!`, 
        ephemeral: true 
      });
    }
    
    // Get current monster
    const monster = await get(require('./db-adapter').getMonsterDb(),
      { key: 'current_monster' }
    );
    
    if (!monster) {
      return await interaction.reply({ 
        content: 'No monster is currently spawned!', 
        ephemeral: true 
      });
    }
    
    // Check if monster is dead
    if (parseInt(monster.hp) <= 0) {
      return await interaction.reply({ 
        content: 'The monster has been defeated! Waiting for a new one...', 
        ephemeral: true 
      });
    }
    
    // Get player's active monster
    if (!player.activeMonster || player.activeMonster === 'null') {
      return await interaction.reply({ 
        content: 'You need to set an active monster! Use `/monsters set-active`', 
        ephemeral: true 
      });
    }
    
    const playerMonster = await getPlayerMonster(player.activeMonster);
    if (!playerMonster) {
      return await interaction.reply({ 
        content: 'Active monster not found!', 
        ephemeral: true 
      });
    }
    
    // Calculate damage
    const damage = calculateDamage(playerMonster, monster);
    const newHp = Math.max(0, parseInt(monster.hp) - damage);
    
    // Update monster HP
    await run(require('./db-adapter').getMonsterDb(),
      { key: 'current_monster' },
      { $set: { hp: newHp } }
    );
    
    // Update player cooldown
    await run(require('./db-adapter').getPlayersDb(),
      { userId: userId },
      { $set: { lastAttackAt: now } }
    );
    
    // Add damage to player stats
    await incrementStatistic(userId, 'totalDamage', damage);
    
    // Record attack
    await run(require('./db-adapter').getMonsterDb(),
      {
        monsterId: monster.monsterId,
        userId: userId,
        damage: damage,
        attackAt: now
      }
    );
    
    // Check if monster died
    if (newHp <= 0) {
      // Rewards
      const xpReward = 100;
      const goldReward = 50;
      
      await addXP(userId, xpReward);
      await addGold(userId, goldReward);
      
      // Monster XP
      await addMonsterXP(player.activeMonster, 25);
      
      // Spawn new monster after delay
      setTimeout(async () => {
        const { spawnNewMonster } = require('./monsterState');
        await spawnNewMonster(0, { hardReset: false });
      }, 5000);
      
      return await interaction.reply({ 
        content: `💥 **CRITICAL HIT!** You dealt ${damage} damage and defeated the monster!\n\nRewards: +${xpReward} XP, +${goldReward} Gold`,
        ephemeral: false 
      });
    }
    
    // Not dead yet
    const critMessage = damage > 50 ? ' CRITICAL HIT!' : '';
    
    return await interaction.reply({ 
      content: `⚔️ You dealt **${damage}** damage!${critMessage}\nMonster HP: ${newHp}/${monster.maxHp}`,
      ephemeral: false 
    });
    
  } catch (err) {
    console.error('Error in handleAttackButton:', err);
    return await interaction.reply({ 
      content: 'An error occurred during the attack!', 
      ephemeral: true 
    });
  }
}

// Calculate damage
function calculateDamage(playerMonster, monster) {
  const baseDamage = playerMonster.monsterData?.baseAttack || 20;
  const level = playerMonster.level || 1;
  const attack = baseDamage * (1 + (level * 0.1));
  
  // Critical hit chance
  const critRate = playerMonster.monsterData?.critRate || 0.05;
  const isCrit = Math.random() < critRate;
  const critMultiplier = isCrit ? 1.5 : 1;
  
  // Random variance
  const variance = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
  
  const damage = Math.floor(attack * critMultiplier * variance);
  
  return damage;
}

module.exports = {
  handleAttackButton,
  calculateDamage
};