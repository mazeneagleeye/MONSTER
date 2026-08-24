const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { ensurePlayer } = require('../lib/players');
const { getPlayerMonsters, getPlayerMonster, interactWithMonster, buildMonsterProfile, summonMonsterForUser, setMonsterFavorite, renameMonster, setActiveMonster, getAllMonsters } = require('../lib/monsters');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('monsters')
    .setDescription('Manage your monster collection')
    .addSubcommand(sub => sub.setName('collection').setDescription('View your monster collection'))
    .addSubcommand(sub => sub
      .setName('summon')
      .setDescription('Summon a new monster')
      .addStringOption(opt => opt.setName('type').setDescription('Summon type').addChoices(
        { name: 'Gold Summon', value: 'gold' },
        { name: 'Gem Summon', value: 'gem' },
        { name: 'Event Summon', value: 'event' },
        { name: 'Beginner Summon', value: 'beginner' }
      )))
    .addSubcommand(sub => sub
      .setName('interact')
      .setDescription('Interact with your monster')
      .addStringOption(opt => opt.setName('action').setDescription('Interaction type').setRequired(true).addChoices(
        { name: '🍖 Feed', value: 'feed' },
        { name: '🎾 Play', value: 'play' },
        { name: '💪 Train', value: 'train' },
        { name: '✋ Pet', value: 'pet' }
      ))
      .addStringOption(opt => opt.setName('monster').setDescription('Monster ID to interact with').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('set-active')
      .setDescription('Set your active monster for battles')
      .addStringOption(opt => opt.setName('monster').setDescription('Monster ID to set as active').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('favorite')
      .setDescription('Favorite or unfavorite a monster')
      .addStringOption(opt => opt.setName('monster').setDescription('Monster ID').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('rename')
      .setDescription('Rename a monster')
      .addStringOption(opt => opt.setName('monster').setDescription('Monster ID').setRequired(true))
      .addStringOption(opt => opt.setName('name').setDescription('New nickname').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('info')
      .setDescription('View detailed monster info')
      .addStringOption(opt => opt.setName('monster').setDescription('Monster ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('encyclopedia').setDescription('Browse the monster encyclopedia')),

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
        await setActiveMonsterCmd(interaction);
        break;
      case 'favorite':
        await favoriteMonster(interaction);
        break;
      case 'rename':
        await renameMonsterCmd(interaction);
        break;
      case 'info':
        await showMonsterInfo(interaction);
        break;
      case 'encyclopedia':
        await showEncyclopedia(interaction);
        break;
    }
  }
};

async function showCollection(interaction) {
  const monsters = await getPlayerMonsters(interaction.user.id);

  if (monsters.length === 0) {
    return interaction.reply({ content: 'You have no monsters! Use `/monsters summon` to get your first monster.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle(`🐲 ${interaction.user.username}'s Monster Collection`)
    .setColor(0x9b59b6)
    .setDescription(`You have ${monsters.length} monster(s)`);

  for (const monster of monsters.slice(0, 10)) {
    const elementEmoji = getElementEmoji(monster.monsterData?.element);
    const favoriteMarker = monster.isFavorite ? '⭐ ' : '';
    embed.addFields({
      name: `${favoriteMarker}${elementEmoji} ${monster.nickname || monster.monsterData?.name}`,
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
  const type = interaction.options.getString('type') || 'gold';
  const result = await summonMonsterForUser(interaction.user.id, type);

  if (!result.success) {
    return interaction.reply({ content: result.message, ephemeral: true });
  }

  const { monster, profile } = result;
  const rarityColors = {
    Common: 0x95a5a6,
    Uncommon: 0x27ae60,
    Rare: 0x3498db,
    Epic: 0x9b59b6,
    Legendary: 0xf39c12,
    Mythic: 0xe74c3c
  };

  const embed = new EmbedBuilder()
    .setTitle('🎉 New Monster Summoned!')
    .setColor(rarityColors[monster.rarity] || 0x3498db)
    .setDescription(`You summoned a **${monster.rarity}** ${monster.name}!`)
    .addFields(
      { name: 'Element', value: `${getElementEmoji(monster.element)} ${monster.element}`, inline: true },
      { name: 'Type', value: monster.type, inline: true },
      { name: 'Personality', value: profile.personality, inline: true },
      { name: 'HP', value: `${profile.stats.hp}`, inline: true },
      { name: 'Attack', value: `${profile.stats.attack}`, inline: true },
      { name: 'Defense', value: `${profile.stats.defense}`, inline: true }
    );

  // Add monster image
  const imagePath = profile.imagePath || path.join(__dirname, '..', 'images', 'slime.png');
  let attachment = null;
  try {
    attachment = new AttachmentBuilder(imagePath, { name: 'monster.png' });
    embed.setImage('attachment://monster.png');
  } catch (e) {
    console.warn(`Monster image missing: ${imagePath}`);
  }

  const replyOptions = { embeds: [embed], ephemeral: true };
  if (attachment) {
    replyOptions.files = [attachment];
  }
  await interaction.reply(replyOptions);
}

async function interactWithMonsterCmd(interaction) {
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

async function setActiveMonsterCmd(interaction) {
  const monster = await setActiveMonster(interaction.user.id, interaction.options.getString('monster'));
  if (!monster) {
    return interaction.reply({ content: 'Monster not found!', ephemeral: true });
  }

  await interaction.reply({ content: `Set ${monster.nickname || monster.monsterData?.name} as your active monster!`, ephemeral: true });
}

async function favoriteMonster(interaction) {
  const result = await setMonsterFavorite(interaction.options.getString('monster'));
  if (!result) {
    return interaction.reply({ content: 'Monster not found!', ephemeral: true });
  }
  const state = result.isFavorite ? 'favorited' : 'unfavorited';
  await interaction.reply({ content: `Monster ${state}.`, ephemeral: true });
}

async function renameMonsterCmd(interaction) {
  const result = await renameMonster(interaction.options.getString('monster'), interaction.options.getString('name'));
  if (!result) {
    return interaction.reply({ content: 'Monster not found!', ephemeral: true });
  }
  await interaction.reply({ content: `Renamed your monster to **${result.nickname}**.`, ephemeral: true });
}

async function showMonsterInfo(interaction) {
  const monster = await getPlayerMonster(interaction.options.getString('monster'));
  if (!monster) {
    return interaction.reply({ content: 'Monster not found!', ephemeral: true });
  }

  const profile = buildMonsterProfile(monster.monsterData, monster);
  const elementEmoji = getElementEmoji(profile.element);

  const embed = new EmbedBuilder()
    .setTitle(`${elementEmoji} ${monster.nickname || profile.name}`)
    .setColor(0x9b59b6)
    .setDescription(profile.description)
    .addFields(
      { name: 'Level', value: `${monster.level} (XP: ${monster.xp}/${monster.level * 100})`, inline: true },
      { name: 'Element', value: profile.element, inline: true },
      { name: 'Type', value: profile.type, inline: true },
      { name: 'Rarity', value: profile.rarity, inline: true },
      { name: 'Personality', value: profile.personality, inline: true },
      { name: 'Battles', value: `${monster.wins}/${monster.battles}`, inline: true },
      { name: 'Happiness', value: `${profile.needs.happiness}%`, inline: true },
      { name: 'Hunger', value: `${profile.needs.hunger}%`, inline: true },
      { name: 'Loyalty', value: `${profile.needs.loyalty}%`, inline: true },
      { name: 'Region', value: profile.region, inline: true },
      { name: 'Favorite Food', value: profile.favoriteFood, inline: true },
      { name: 'Lore', value: profile.lore, inline: false }
    );

  if (profile.skills && profile.skills.length > 0) {
    const skillsText = profile.skills.map(skill => `${skill.name} Lv.${skill.level}`).join('\n');
    embed.addFields({ name: 'Skills', value: skillsText, inline: false });
  }

  // Add monster image
  const imagePath = profile.imagePath || path.join(__dirname, '..', 'images', 'slime.png');
  let attachment = null;
  try {
    attachment = new AttachmentBuilder(imagePath, { name: 'monster.png' });
    embed.setImage('attachment://monster.png');
  } catch (e) {
    console.warn(`Monster image missing: ${imagePath}`);
  }

  const replyOptions = { embeds: [embed], ephemeral: true };
  if (attachment) {
    replyOptions.files = [attachment];
  }
  await interaction.reply(replyOptions);
}

async function showEncyclopedia(interaction) {
  const ownedMonsters = await getPlayerMonsters(interaction.user.id);
  const discoveredIds = new Set(ownedMonsters.map(monster => monster.monsterId));
  const catalog = await getAllMonsters();
  const discovered = catalog.filter(monster => discoveredIds.has(monster.id));
  const missing = catalog.filter(monster => !discoveredIds.has(monster.id));
  
  const totalDiscovered = discovered.length;
  const totalMissing = missing.length;
  const completionPercentage = Math.round((totalDiscovered / catalog.length) * 100);

  // Group discovered by element
  const discoveredByElement = {};
  discovered.forEach(monster => {
    if (!discoveredByElement[monster.element]) {
      discoveredByElement[monster.element] = [];
    }
    discoveredByElement[monster.element].push(monster.name);
  });

  // Group missing by rarity
  const missingByRarity = {};
  missing.forEach(monster => {
    if (!missingByRarity[monster.rarity]) {
      missingByRarity[monster.rarity] = [];
    }
    missingByRarity[monster.rarity].push(monster.name);
  });

  const embed = new EmbedBuilder()
    .setTitle('📚 Monster Encyclopedia')
    .setColor(0x2f80ed)
    .setDescription(`**Progress:** ${totalDiscovered}/${catalog.length} (${completionPercentage}%)\n\nExplore the world to discover more monsters!`)
    .addFields(
      { name: '📊 Discovery Progress', value: `Discovered: ${totalDiscovered}\nMissing: ${totalMissing}`, inline: true },
      { name: '🎯 Completion', value: `${completionPercentage}%`, inline: true }
    );

  // Add discovered by element
  if (totalDiscovered > 0) {
    const elementText = Object.entries(discoveredByElement)
      .map(([element, monsters]) => `${getElementEmoji(element)} ${element}: ${monsters.length}`)
      .join('\n');
    embed.addFields({ name: '🔥 Discovered by Element', value: elementText || 'None', inline: false });
  }

  // Add missing by rarity (show top 3 rarities)
  if (totalMissing > 0) {
    const rarityOrder = ['Mythic', 'Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'];
    const missingText = rarityOrder
      .filter(rarity => missingByRarity[rarity])
      .slice(0, 3)
      .map(rarity => `${rarity}: ${missingByRarity[rarity].length} missing`)
      .join('\n');
    embed.addFields({ name: '❌ Missing by Rarity', value: missingText || 'None', inline: false });
  }

  // Show some missing monsters
  if (totalMissing > 0) {
    const sampleMissing = missing.slice(0, 5).map(m => `${getElementEmoji(m.element)} ${m.name}`).join('\n');
    embed.addFields({ name: '🔍 Rare Finds', value: sampleMissing || 'None', inline: false });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

function getElementEmoji(element) {
  const emojis = {
    Fire: '🔥',
    Water: '💧',
    Earth: '🌍',
    Electric: '⚡',
    Dark: '🌑',
    Light: '✨',
    Wind: '💨',
    Ice: '❄️',
    Poison: '☠️',
    Psychic: '🔮'
  };
  return emojis[element] || '⚪';
}