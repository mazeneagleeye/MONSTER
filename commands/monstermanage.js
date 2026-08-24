const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ensurePlayer } = require('../lib/players');
const { 
  getPlayerMonster, 
  evolveMonster, 
  equipMonsterItem, 
  unequipMonsterItem, 
  setMonsterSkin,
  getMonsterStatistics,
  buildMonsterProfile
} = require('../lib/monsters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('monstermanage')
    .setDescription('Manage your monster - evolve, equip, skins, and stats')
    .addSubcommand(sub => sub
      .setName('evolve')
      .setDescription('Evolve your monster (requires level 10)')
      .addStringOption(opt => opt.setName('monster').setDescription('Monster ID to evolve').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('equip')
      .setDescription('Equip an item to your monster')
      .addStringOption(opt => opt.setName('monster').setDescription('Monster ID').setRequired(true))
      .addStringOption(opt => opt.setName('slot').setDescription('Equipment slot').setRequired(true).addChoices(
        { name: 'Weapon', value: 'weapon' },
        { name: 'Armor', value: 'armor' },
        { name: 'Accessory', value: 'accessory' },
        { name: 'Relic', value: 'relic' }
      ))
      .addStringOption(opt => opt.setName('item').setDescription('Item ID to equip').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('unequip')
      .setDescription('Unequip an item from your monster')
      .addStringOption(opt => opt.setName('monster').setDescription('Monster ID').setRequired(true))
      .addStringOption(opt => opt.setName('slot').setDescription('Equipment slot').setRequired(true).addChoices(
        { name: 'Weapon', value: 'weapon' },
        { name: 'Armor', value: 'armor' },
        { name: 'Accessory', value: 'accessory' },
        { name: 'Relic', value: 'relic' }
      )))
    .addSubcommand(sub => sub
      .setName('skin')
      .setDescription('Change your monster\'s skin appearance')
      .addStringOption(opt => opt.setName('monster').setDescription('Monster ID').setRequired(true))
      .addStringOption(opt => opt.setName('skin').setDescription('Skin type').setRequired(true).addChoices(
        { name: 'Default', value: 'default' },
        { name: 'Halloween', value: 'halloween' },
        { name: 'Christmas', value: 'christmas' },
        { name: 'Summer', value: 'summer' },
        { name: 'Anniversary', value: 'anniversary' },
        { name: 'Golden', value: 'golden' },
        { name: 'Shadow', value: 'shadow' }
      )))
    .addSubcommand(sub => sub
      .setName('stats')
      .setDescription('View detailed statistics for your monster')
      .addStringOption(opt => opt.setName('monster').setDescription('Monster ID').setRequired(true))),

  async execute(interaction) {
    await ensurePlayer(interaction.user.id);
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'evolve':
        await evolveMonsterCmd(interaction);
        break;
      case 'equip':
        await equipMonsterCmd(interaction);
        break;
      case 'unequip':
        await unequipMonsterCmd(interaction);
        break;
      case 'skin':
        await setSkinCmd(interaction);
        break;
      case 'stats':
        await showMonsterStats(interaction);
        break;
    }
  }
};

async function evolveMonsterCmd(interaction) {
  const monsterId = interaction.options.getString('monster');
  const result = await evolveMonster(monsterId);

  if (!result.success) {
    return interaction.reply({ content: result.message, ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🎉 Evolution Success!')
    .setColor(0xf39c12)
    .setDescription(result.message)
    .setFooter({ text: 'Your monster has grown stronger!' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function equipMonsterCmd(interaction) {
  const monsterId = interaction.options.getString('monster');
  const slot = interaction.options.getString('slot');
  const itemId = interaction.options.getString('item');

  const result = await equipMonsterItem(monsterId, itemId, slot);

  if (!result.success) {
    return interaction.reply({ content: result.message, ephemeral: true });
  }

  await interaction.reply({ content: result.message, ephemeral: true });
}

async function unequipMonsterCmd(interaction) {
  const monsterId = interaction.options.getString('monster');
  const slot = interaction.options.getString('slot');

  const result = await unequipMonsterItem(monsterId, slot);

  if (!result.success) {
    return interaction.reply({ content: result.message, ephemeral: true });
  }

  await interaction.reply({ content: result.message, ephemeral: true });
}

async function setSkinCmd(interaction) {
  const monsterId = interaction.options.getString('monster');
  const skin = interaction.options.getString('skin');

  const result = await setMonsterSkin(monsterId, skin);

  if (!result.success) {
    return interaction.reply({ content: result.message, ephemeral: true });
  }

  const skinEmojis = {
    default: '⚪',
    halloween: '🎃',
    christmas: '🎄',
    summer: '🏖️',
    anniversary: '🎂',
    golden: '⭐',
    shadow: '🌑'
  };

  const embed = new EmbedBuilder()
    .setTitle('🎨 Skin Applied!')
    .setColor(0xe91e63)
    .setDescription(result.message)
    .setFooter({ text: `${skinEmojis[skin] || '⚪'} ${skin.charAt(0).toUpperCase() + skin.slice(1)} skin` });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function showMonsterStats(interaction) {
  const monsterId = interaction.options.getString('monster');
  const monster = await getPlayerMonster(monsterId);

  if (!monster) {
    return interaction.reply({ content: 'Monster not found!', ephemeral: true });
  }

  const profile = buildMonsterProfile(monster.monsterData, monster);
  const stats = await getMonsterStatistics(monsterId);

  if (!stats) {
    return interaction.reply({ content: 'Could not retrieve statistics!', ephemeral: true });
  }

  const timeOwned = formatTimeOwned(stats.timeOwned);

  const embed = new EmbedBuilder()
    .setTitle(`📊 Statistics for ${monster.nickname || profile.name}`)
    .setColor(0x3498db)
    .addFields(
      { name: '⚔️ Battles Won', value: String(stats.battlesWon), inline: true },
      { name: '💀 Battles Lost', value: String(stats.battlesLost), inline: true },
      { name: '🎮 Total Battles', value: String(stats.totalBattles), inline: true },
      { name: '⏱️ Time Owned', value: timeOwned, inline: true },
      { name: '🍖 Favorite Food', value: stats.favoriteFood, inline: true },
      { name: '📈 Win Rate', value: stats.totalBattles > 0 ? `${Math.round((stats.battlesWon / stats.totalBattles) * 100)}%` : 'N/A', inline: true }
    );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

function formatTimeOwned(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day(s)`;
  if (hours > 0) return `${hours} hour(s)`;
  if (minutes > 0) return `${minutes} minute(s)`;
  return `${seconds} second(s)`;
}