const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { getPlayer, ensurePlayer, getPlayerMonsters, getMonster, createPlayerMonster, interactWithMonster, getPersonalityReaction } = require('../lib/monsters');
const { getRandomMonster } = require('../lib/monsters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('monsters')
    .setDescription('Manage your monster collection')
    .addSubcommand(sub => sub
      .setName('collection')
      .setDescription('View your monster collection'))
    .addSubcommand(sub => sub
      .setName('summon')
      .setDescription('Summon a new monster (costs 100 gold)'))
    .addSubcommand(sub => sub
      .setName('interact')
      .setDescription('Interact with your monster')
      .addStringOption(opt => opt
        .setName('action')
        .setDescription('Interaction type')
        .setRequired(true)
        .addChoices(
          { name: '🍖 Feed', value: 'feed' },
          { name: '🎾 Play', value: 'play' },
          { name: '💪 Train', value: 'train' },
          { name: '✋ Pet', value: 'pet' }
        ))
      .addStringOption(opt => opt
        .setName('monster')
        .setDescription('Monster ID to interact with')
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName('set-active')
      .setDescription('Set your active monster for battles')
      .addStringOption(opt => opt
        .setName('monster')
        .setDescription('Monster ID to set as active')
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName('info')
      .setDescription('View detailed monster info')
      .addStringOption(opt => opt
        .setName('monster')
        .setDescription('Monster ID')
        .setRequired(true))),

  async execute(interaction) {
    await ensurePlayer(interaction.user.id);
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'collection':
        await showCollection(interaction);
        break;
      case 'summon':
        await summonMonster(interaction);
        break;
      case 'interact':
        await interactWithMonsterCmd(interaction);
        break;
      case 'set-active':
        await setActiveMonster(interaction);
        break;
      case 'info':
        await showMonsterInfo(interaction);
        break;
    }
  }
};

async function showCollection(interaction) {
  const userId = interaction.user.id;
  const monsters = await getPlayerMonsters(userId);
  
  if (monsters.length === 0) {
    return interaction.reply({ content: 'You have no monsters! Use `/monsters summon` to get your first monster.', ephemeral: true });
  }
  
  const embed = new EmbedBuilder()
    .setTitle(`🐲 ${interaction.user.username}'s Monster Collection`)
    .setColor(0x9b59b6)
    .setDescription(`You have ${monsters.length} monster(s)`);
  
  for (const monster of monsters.slice(0, 10)) {
    const elementEmoji = getElementEmoji(monster.monsterData.element);
    embed.addFields({
      name: `${elementEmoji} ${monster.nickname || monster.monsterData.name}`,
      value: `ID: ${monster.id}\nLevel: ${monster.level} | Happiness: ${monster.happiness}% | Loyalty: ${monster.loyalty}%\nPersonality: ${monster.personality}`,
      inline: true
    });
  }
  
  if (monsters.length > 10) {
    embed.setFooter({ text: `Showing 10 of ${monsters.length} monsters` });
  }
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function summonMonster(interaction) {
  const userId = interaction.user.id;
  const player = await getPlayer(userId);
  
  if (player.gold < 100) {
    return interaction.reply({ content: 'You need 100 gold to summon a monster!', ephemeral: true });
  }
  
  // Random monster based on player level
  const rarity = Math.random() < 0.1 ? 'Legendary' : 
                 Math.random() < 0.3 ? 'Rare' : 
                 Math.random() < 0.6 ? 'Uncommon' : 'Common';
  
  const monster = await getRandomMonster(rarity);
  if (!monster) {
    return interaction.reply({ content: 'Failed to summon monster. Try again!', ephemeral: true });
  }
  
  // Spend gold
  const { spendGold } = require('../lib/players');
  await spendGold(userId, 100);
  
  // Create player monster
  const playerMonster = await createPlayerMonster(userId, monster.id);
  
  const rarityColors = {
    'Common': 0x95a5a6,
    'Uncommon': 0x27ae60,
    'Rare': 0x3498db,
    'Epic': 0x9b59b6,
    'Legendary': 0xf39c12,
    'Mythic': 0xe74c3c
  };
  
  const embed = new EmbedBuilder()
    .setTitle(`🎉 New Monster Summoned!`)
    .setColor(rarityColors[monster.rarity] || 0x3498db)
    .setDescription(`You summoned a **${monster.rarity}** ${monster.name}!`)
    .addFields(
      { name: 'Element', value: getElementEmoji(monster.element) + ' ' + monster.element, inline: true },
      { name: 'Type', value: monster.type, inline: true },
      { name: 'Personality', value: playerMonster.personality, inline: true },
      { name: 'Base HP', value: `${monster.baseHp}`, inline: true },
      { name: 'Base Attack', value: `${monster.baseAttack}`, inline: true },
      { name: 'Base Defense', value: `${monster.baseDefense}`, inline: true }
    );
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function interactWithMonsterCmd(interaction) {
  const userId = interaction.user.id;
  const action = interaction.options.getString('action');
  const monsterId = interaction.options.getString('monster');
  
  const result = await interactWithMonster(monsterId, action);
  
  if (!result) {
    return interaction.reply({ content: 'Monster not found!', ephemeral: true });
  }
  
  const embed = new EmbedBuilder()
    .setTitle('💕 Monster Interaction')
    .setColor(0xe91e63)
    .setDescription(result.message)
    .addFields(
      { name: 'Happiness', value: `${result.happiness}%`, inline: true },
      { name: 'Hunger', value: `${result.hunger}%`, inline: true },
      { name: 'Loyalty', value: `${result.loyalty}%`, inline: true }
    );
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function setActiveMonster(interaction) {
  const userId = interaction.user.id;
  const monsterId = interaction.options.getString('monster');
  
  const monster = await getPlayerMonster(monsterId);
  if (!monster) {
    return interaction.reply({ content: 'Monster not found!', ephemeral: true });
  }
  
  const { run } = require('../lib/db');
  await run(require('../lib/db').playersDb,
    `UPDATE players SET activeMonster = ? WHERE userId = ?`,
    [monsterId, userId]
  );
  
  await interaction.reply({ 
    content: `Set ${monster.nickname || monster.monsterData.name} as your active monster!`, 
    ephemeral: true 
  });
}

async function showMonsterInfo(interaction) {
  const monsterId = interaction.options.getString('monster');
  const monster = await getPlayerMonster(monsterId);
  
  if (!monster) {
    return interaction.reply({ content: 'Monster not found!', ephemeral: true });
  }
  
  const elementEmoji = getElementEmoji(monster.monsterData.element);
  
  const embed = new EmbedBuilder()
    .setTitle(`${elementEmoji} ${monster.nickname || monster.monsterData.name}`)
    .setColor(0x9b59b6)
    .addFields(
      { name: 'Level', value: `${monster.level} (XP: ${monster.xp}/${monster.level * 100})`, inline: true },
      { name: 'Element', value: monster.monsterData.element, inline: true },
      { name: 'Type', value: monster.monsterData.type, inline: true },
      { name: 'Rarity', value: monster.monsterData.rarity, inline: true },
      { name: 'Personality', value: monster.personality, inline: true },
      { name: 'Battles', value: `${monster.wins}/${monster.battles}`, inline: true },
      { name: 'Happiness', value: `${monster.happiness}%`, inline: true },
      { name: 'Hunger', value: `${monster.hunger}%`, inline: true },
      { name: 'Loyalty', value: `${monster.loyalty}%`, inline: true }
    );
  
  if (monster.skills && monster.skills.length > 0) {
    const skillsText = monster.skills.map(s => `${s.name} Lv.${s.level}`).join('\n');
    embed.addFields({ name: 'Skills', value: skillsText, inline: false });
  }
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

function getElementEmoji(element) {
  const emojis = {
    'Fire': '🔥',
    'Water': '💧',
    'Earth': '🌍',
    'Electric': '⚡',
    'Dark': '🌑',
    'Light': '✨',
    'Wind': '💨',
    'Ice': '❄️',
    'Poison': '☠️',
    'Psychic': '🔮'
  };
  return emojis[element] || '⚪';
}