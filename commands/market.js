const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ensurePlayer, getPlayer } = require('../lib/players');
const { listItem, buyItem, getMarketListings, cancelListing, generateEquipment, generateMaterial } = require('../lib/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('market')
    .setDescription('Marketplace commands')
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('List an item for sale')
      .addStringOption(opt => opt
        .setName('item')
        .setDescription('Item ID from inventory')
        .setRequired(true))
      .addIntegerOption(opt => opt
        .setName('price')
        .setDescription('Price in gold')
        .setRequired(true)
        .setMinValue(1))
      .addIntegerOption(opt => opt
        .setName('quantity')
        .setDescription('Quantity to sell')
        .setRequired(false)
        .setMinValue(1)
        .setDefaultValue(1)))
    .addSubcommand(sub => sub
      .setName('buy')
      .setDescription('Buy an item')
      .addStringOption(opt => opt
        .setName('listing')
        .setDescription('Listing ID')
        .setRequired(true))
      .addIntegerOption(opt => opt
        .setName('quantity')
        .setDescription('Quantity to buy')
        .setRequired(false)
        .setMinValue(1)
        .setDefaultValue(1)))
    .addSubcommand(sub => sub
      .setName('cancel')
      .setDescription('Cancel a listing')
      .addStringOption(opt => opt
        .setName('listing')
        .setDescription('Listing ID')
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName('browse')
      .setDescription('Browse marketplace')
      .addStringOption(opt => opt
        .setName('type')
        .setDescription('Item type filter')
        .setRequired(false)
        .addChoices(
          { name: 'Equipment', value: 'equipment' },
          { name: 'Materials', value: 'material' },
          { name: 'Monsters', value: 'monster' }
        )))
    .addSubcommand(sub => sub
      .setName('sell-monster')
      .setDescription('Sell a monster from your collection')
      .addStringOption(opt => opt
        .setName('monster')
        .setDescription('Monster ID')
        .setRequired(true))
      .addIntegerOption(opt => opt
        .setName('price')
        .setDescription('Price in gold')
        .setRequired(true)
        .setMinValue(1))),

  async execute(interaction) {
    await ensurePlayer(interaction.user.id);
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'list':
        await listItemCmd(interaction);
        break;
      case 'buy':
        await buyItemCmd(interaction);
        break;
      case 'cancel':
        await cancelListingCmd(interaction);
        break;
      case 'browse':
        await browseMarket(interaction);
        break;
      case 'sell-monster':
        await sellMonster(interaction);
        break;
    }
  }
};

async function listItemCmd(interaction) {
  const itemId = interaction.options.getString('item');
  const price = interaction.options.getInteger('price');
  const quantity = interaction.options.getInteger('quantity') || 1;
  
  const player = await getPlayer(interaction.user.id);
  const inventory = JSON.parse(player.inventory || '[]');
  const item = inventory.find(i => i.id === itemId);
  
  if (!item) {
    return interaction.reply({ content: 'Item not found in your inventory!', ephemeral: true });
  }
  
  const result = await listItem(interaction.user.id, item, price, quantity);
  
  if (result.success) {
    await interaction.reply({ content: `Listed ${item.name} for ${price} gold each! Listing ID: ${result.listingId}`, ephemeral: true });
  } else {
    await interaction.reply({ content: result.message, ephemeral: true });
  }
}

async function buyItemCmd(interaction) {
  const listingId = interaction.options.getString('listing');
  const quantity = interaction.options.getInteger('quantity') || 1;
  
  const result = await buyItem(listingId, interaction.user.id, quantity);
  await interaction.reply({ content: result.message, ephemeral: true });
}

async function cancelListingCmd(interaction) {
  const listingId = interaction.options.getString('listing');
  const result = await cancelListing(listingId, interaction.user.id);
  await interaction.reply({ content: result.message, ephemeral: true });
}

async function browseMarket(interaction) {
  const itemType = interaction.options.getString('type');
  const listings = await getMarketListings(itemType, 20);
  
  if (listings.length === 0) {
    return interaction.reply({ content: 'No items listed!', ephemeral: true });
  }
  
  const embed = new EmbedBuilder()
    .setTitle('🛒 Marketplace')
    .setColor(0x2ecc71)
    .setDescription(listings.map((listing, i) => 
      `${i + 1}. **${listing.item?.name || 'Unknown'}** - ${listing.price} gold (Qty: ${listing.quantity})\n   ID: ${listing.id}`
    ).join('\n\n'));
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function sellMonster(interaction) {
  const monsterId = interaction.options.getString('monster');
  const price = interaction.options.getInteger('price');
  
  const { getPlayerMonster, getPlayerMonsters } = require('../lib/monsters');
  const { removeFromInventory } = require('../lib/players');
  
  const monster = await getPlayerMonster(monsterId);
  if (!monster) {
    return interaction.reply({ content: 'Monster not found!', ephemeral: true });
  }
  
  const item = {
    id: monsterId,
    type: 'monster',
    name: monster.nickname || monster.monsterData.name,
    monsterData: monster.monsterData
  };
  
  const result = await listItem(interaction.user.id, item, price, 1);
  
  if (result.success) {
    // Remove from collection
    const player = await getPlayer(interaction.user.id);
    const collection = JSON.parse(player.monsterCollection || '[]');
    const newCollection = collection.filter(id => id !== monsterId);
    
    await require('../lib/db').run(
      require('../lib/db').playersDb,
      `UPDATE players SET monsterCollection = ? WHERE userId = ?`,
      [JSON.stringify(newCollection), interaction.user.id]
    );
    
    await interaction.reply({ content: `Listed ${monster.nickname || monster.monsterData.name} for ${price} gold!`, ephemeral: true });
  } else {
    await interaction.reply({ content: result.message, ephemeral: true });
  }
}