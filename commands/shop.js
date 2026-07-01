const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ensurePlayer } = require('../lib/players');
const { createShop, addShopItem, removeShopItem, buyFromShop, getShop, getPlayerShop, getAllShops, deleteShop, searchShops } = require('../lib/shops');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Private shop system')
    .addSubcommand(sub => {
      sub
        .setName('create')
        .setDescription('Create your own shop')
        .addStringOption(opt => opt
          .setName('name')
          .setDescription('Shop name')
          .setRequired(true)
          .setMaxLength(32));
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('add-item')
        .setDescription('Add item to your shop')
        .addStringOption(opt => opt
          .setName('item')
          .setDescription('Item ID from inventory')
          .setRequired(true))
        .addIntegerOption(opt => opt
          .setName('price')
          .setDescription('Price in gold')
          .setRequired(true)
          .setMinValue(1));
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('remove-item')
        .setDescription('Remove item from your shop')
        .addStringOption(opt => opt
          .setName('item')
          .setDescription('Item ID to remove')
          .setRequired(true));
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('view')
        .setDescription('View your shop');
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('browse')
        .setDescription('Browse all shops');
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('visit')
        .setDescription('Visit a specific shop')
        .addStringOption(opt => opt
          .setName('shop_id')
          .setDescription('Shop ID to visit')
          .setRequired(true));
      return sub;
    })
    .addSubcommand(sub => {
      sub
        .setName('delete')
        .setDescription('Delete your shop');
      return sub;
    }),

  async execute(interaction) {
    await ensurePlayer(interaction.user.id);
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'create':
        await createShopCmd(interaction);
        break;
      case 'add-item':
        await addItemCmd(interaction);
        break;
      case 'remove-item':
        await removeItemCmd(interaction);
        break;
      case 'view':
        await viewShop(interaction);
        break;
      case 'browse':
        await browseShops(interaction);
        break;
      case 'visit':
        await visitShop(interaction);
        break;
      case 'delete':
        await deleteShopCmd(interaction);
        break;
    }
  }
};

async function createShopCmd(interaction) {
  const name = interaction.options.getString('name');
  const result = await createShop(interaction.user.id, name);
  
  if (result.success) {
    await interaction.reply({ 
      content: `Created shop **${name}**!\nShop ID: ${result.shopId}\nUse /shop add-item to add items!`, 
      ephemeral: true 
    });
  } else {
    await interaction.reply({ content: result.message, ephemeral: true });
  }
}

async function addItemCmd(interaction) {
  const itemId = interaction.options.getString('item');
  const price = interaction.options.getInteger('price');
  
  const shop = await getPlayerShop(interaction.user.id);
  
  if (!shop) {
    return interaction.reply({ content: 'You don\'t have a shop! Create one with /shop create', ephemeral: true });
  }
  
  const player = await getPlayer(interaction.user.id);
  const inventory = JSON.parse(player.inventory || '[]');
  const item = inventory.find(i => i.id === itemId);
  
  if (!item) {
    return interaction.reply({ content: 'Item not found in your inventory!', ephemeral: true });
  }
  
  const result = await addShopItem(shop.shopId, interaction.user.id, item, price);
  
  await interaction.reply({ content: result.message, ephemeral: true });
}

async function removeItemCmd(interaction) {
  const itemId = interaction.options.getString('item');
  
  const shop = await getPlayerShop(interaction.user.id);
  
  if (!shop) {
    return interaction.reply({ content: 'You don\'t have a shop!', ephemeral: true });
  }
  
  const result = await removeShopItem(shop.shopId, interaction.user.id, itemId);
  
  await interaction.reply({ content: result.message, ephemeral: true });
}

async function viewShop(interaction) {
  const shop = await getPlayerShop(interaction.user.id);
  
  if (!shop) {
    return interaction.reply({ content: 'You don\'t have a shop! Create one with /shop create', ephemeral: true });
  }
  
  const embed = new EmbedBuilder()
    .setTitle(`🏪 ${shop.name}`)
    .setColor(0x2ecc71)
    .setDescription(`**Owner:** <@${shop.ownerId}>\n**Visitors:** ${shop.visitors.length}\n**Items:** ${shop.items.length}`);
  
  if (shop.items.length > 0) {
    const itemsList = shop.items.map((item, i) => 
      `${i + 1}. **${item.item.name}** - ${item.price} gold\n   ID: ${item.id}`
    ).join('\n\n');
    embed.addFields({ name: 'Items for Sale', value: itemsList || 'No items', inline: false });
  }
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function browseShops(interaction) {
  const shops = await getAllShops(20);
  
  if (shops.length === 0) {
    return interaction.reply({ content: 'No shops available! Create one with /shop create', ephemeral: true });
  }
  
  const embed = new EmbedBuilder()
    .setTitle('🏪 All Shops')
    .setColor(0x2ecc71)
    .setDescription(shops.map((shop, i) => 
      `${i + 1}. **${shop.name}**\n   Owner: <@${shop.ownerId}>\n   Items: ${shop.items.length}\n   Visitors: ${shop.visitorCount}\n   ID: ${shop.shopId}`
    ).join('\n\n'));
  
  embed.setFooter({ text: 'Use /shop visit [id] to visit a shop!' });
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function visitShop(interaction) {
  const shopId = interaction.options.getString('id');
  const shop = await getShop(shopId);
  
  if (!shop) {
    return interaction.reply({ content: 'Shop not found!', ephemeral: true });
  }
  
  const embed = new EmbedBuilder()
    .setTitle(`🏪 ${shop.name}`)
    .setColor(0x2ecc71)
    .setDescription(`**Owner:** <@${shop.ownerId}>\n**Total Visitors:** ${shop.visitors.length}`)
    .addFields(
      { name: 'Items for Sale', value: shop.items.length > 0 ? 
        shop.items.map((item, i) => 
          `${i + 1}. **${item.item.name}** - ${item.price} gold\n   Item ID: ${item.id}`
        ).join('\n\n') : 'No items for sale', inline: false }
    );
  
  if (shop.items.length > 0) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`buy_${shopId}`)
        .setLabel('💵 Buy Items')
        .setStyle(ButtonStyle.Success)
    );
    
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  } else {
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function deleteShopCmd(interaction) {
  const shop = await getPlayerShop(interaction.user.id);
  
  if (!shop) {
    return interaction.reply({ content: 'You don\'t have a shop!', ephemeral: true });
  }
  
  const result = await deleteShop(shop.shopId, interaction.user.id);
  
  await interaction.reply({ content: result.message, ephemeral: true });
}