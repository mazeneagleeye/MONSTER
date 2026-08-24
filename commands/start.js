const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer, ensurePlayer, updatePlayerProfile, setLastLogin, updateEnergy, addGold, addGems, addToInventory } = require('../lib/players');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('Start your adventure and create your player account'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const displayName = interaction.user.tag;
    const avatarUrl = interaction.user.displayAvatarURL({ dynamic: true });
    
    // Check if player already exists
    const existingPlayer = await getPlayer(userId);
    if (existingPlayer && existingPlayer.createdAt && existingPlayer.createdAt !== 0 && existingPlayer.level > 1) {
      return interaction.reply({ 
        content: 'You already have an account! Use `/profile` to view your stats.', 
        ephemeral: true 
      });
    }

    // Create or update player account
    const now = Date.now();
    await ensurePlayer(userId, {
      username,
      displayName,
      avatarUrl,
      accountCreatedAt: now,
      lastLogin: now
    });
    await updatePlayerProfile(userId, { username, displayName, avatarUrl, lastLogin: now });
    await setLastLogin(userId);
    await updateEnergy(userId);

    // Add starting resources
    await addGold(userId, 500);
    await addGems(userId, 50);
    
    // Add starting items to inventory
    await addToInventory(userId, {
      id: `egg_beginner_${Date.now()}`,
      name: 'Beginner Egg',
      type: 'egg',
      rarity: 'Common',
      description: 'A mysterious egg that can hatch into a monster'
    });
    
    await addToInventory(userId, {
      id: `food_${Date.now()}_1`,
      name: 'Food',
      type: 'consumable',
      rarity: 'Common',
      quantity: 5,
      description: 'Basic food for your monsters'
    });
    
    await addToInventory(userId, {
      id: `potion_${Date.now()}_1`,
      name: 'Potion',
      type: 'consumable',
      rarity: 'Common',
      quantity: 2,
      description: 'Restores HP in battle'
    });

    // Remove any pending join reminder now that the player has started
    try {
      const { run } = require('../lib/db');
      await run(require('../lib/db').monsterDb,
        `DELETE FROM join_reminders WHERE userId = ?`,
        [userId]
      );
    } catch (reminderErr) {
      console.error('Could not clear join reminder:', reminderErr.message);
    }

    // Create welcome embed
    const embed = new EmbedBuilder()
      .setTitle('🐉 Welcome to Monster Kingdom!')
      .setDescription(`Welcome, ${username}!\n\nYour adventure begins now!`)
      .setColor(0x9b59b6)
      .addFields(
        { name: '🪙 Gold', value: '500', inline: true },
        { name: '💎 Gems', value: '50', inline: true },
        { name: '🥚 Beginner Egg', value: '1', inline: true },
        { name: '🍞 Food', value: '5', inline: true },
        { name: '🧪 Potions', value: '2', inline: true },
        { name: '⚡ Energy', value: '100/100', inline: true }
      )
      .addFields(
        { name: 'Level', value: '1', inline: true },
        { name: 'XP', value: '0/100', inline: true }
      )
      .setFooter({ text: 'Type /summon to hatch your first monster.' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};