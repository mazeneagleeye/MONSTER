const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { getCurrentMonster } = require('../lib/monsterState');
const { getPlayerMonster, buildMonsterProfile, setMonsterFavorite, renameMonster, setActiveMonster } = require('../lib/monsters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('monster')
    .setDescription('Manage your monster and view the current one')
    .addSubcommand(sub => sub.setName('view').setDescription('Show the current monster and attack button'))
    .addSubcommand(sub => sub
      .setName('info')
      .setDescription('Show detailed info for a monster')
      .addStringOption(opt => opt.setName('monster').setDescription('Monster ID').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('favorite')
      .setDescription('Favorite or unfavorite a monster')
      .addStringOption(opt => opt.setName('monster').setDescription('Monster ID').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('active')
      .setDescription('Make a monster your active companion')
      .addStringOption(opt => opt.setName('monster').setDescription('Monster ID').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('rename')
      .setDescription('Rename a monster')
      .addStringOption(opt => opt.setName('monster').setDescription('Monster ID').setRequired(true))
      .addStringOption(opt => opt.setName('name').setDescription('New nickname').setRequired(true))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'info') {
      const monster = await getPlayerMonster(interaction.options.getString('monster'));
      if (!monster) {
        return interaction.reply({ content: 'Monster not found!', ephemeral: true });
      }
      const profile = buildMonsterProfile(monster.monsterData, monster);
      const embed = new EmbedBuilder()
        .setTitle(profile.name)
        .setColor(0x2b2d42)
        .setDescription(profile.description)
        .addFields(
          { name: 'Rarity', value: profile.rarity, inline: true },
          { name: 'Element', value: profile.element, inline: true },
          { name: 'Personality', value: profile.personality, inline: true },
          { name: 'Needs', value: `Hunger ${profile.needs.hunger}%\nHappiness ${profile.needs.happiness}%\nLoyalty ${profile.needs.loyalty}%`, inline: false }
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
      return interaction.reply(replyOptions);
    }

    if (subcommand === 'favorite') {
      const result = await setMonsterFavorite(interaction.options.getString('monster'));
      const state = result?.isFavorite ? 'favorited' : 'unfavorited';
      return interaction.reply({ content: `Monster ${state}.`, ephemeral: true });
    }

    if (subcommand === 'active') {
      const monster = await setActiveMonster(interaction.user.id, interaction.options.getString('monster'));
      if (!monster) {
        return interaction.reply({ content: 'Monster not found!', ephemeral: true });
      }
      return interaction.reply({ content: `Set ${monster.nickname || monster.monsterData?.name} as your active monster.`, ephemeral: true });
    }

    if (subcommand === 'rename') {
      const result = await renameMonster(interaction.options.getString('monster'), interaction.options.getString('name'));
      if (!result) {
        return interaction.reply({ content: 'Monster not found!', ephemeral: true });
      }
      return interaction.reply({ content: `Renamed your monster to **${result.nickname}**.`, ephemeral: true });
    }

    const monster = await getCurrentMonster();
    const embed = new EmbedBuilder()
      .setTitle(monster.title)
      .setColor(0x2b2d42)
      .setDescription(`**HP:** ${monster.hp}/${monster.maxHp}`);

    const imageName = require('../lib/monsterState').getMonsterImageName(monster.title);
    const imagePath = path.join(__dirname, '..', 'images', `${imageName}.png`);
    let attachment = null;
    try {
      attachment = new AttachmentBuilder(imagePath, { name: `${imageName}.png` });
      embed.setImage(`attachment://${imageName}.png`);
    } catch (e) {
      console.warn(`Monster image missing: ${imagePath}. Sending without image.`);
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('attack').setLabel('⚔️ Attack (once/hour)').setStyle(ButtonStyle.Danger)
    );

    const replyOptions = { embeds: [embed], components: [row], ephemeral: false };
    if (attachment) {
      replyOptions.files = [attachment];
    }
    await interaction.reply(replyOptions);
  }
};


