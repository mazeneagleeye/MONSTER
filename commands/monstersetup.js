const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { ensureDefaults, keys, setConfig } = require('../lib/config');
const { get, run } = require('../lib/db');
const { resetMonsterState } = require('../lib/monsterState');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('monster-setup')
    .setDescription('Admin: set up monster channel and reset the game.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post monsters').setRequired(false))
    .addStringOption(opt => opt.setName('action').setDescription('Action: reset').setRequired(false)
      .addChoices({ name: 'reset', value: 'reset' })),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const action = interaction.options.getString('action');

    const { monsterDb } = require('../lib/db');

    if (channel) {
      await setConfig(monsterDb, keys.MONSTER_CHANNEL_ID, String(channel.id));
      await interaction.reply({ content: `Monster channel set to ${channel}.`, ephemeral: true });
    } else {
      await interaction.reply({ content: 'No channel provided; keeping existing setting.', ephemeral: true });
    }

    if (action === 'reset') {
      await resetMonsterState();
      await interaction.followUp({ content: 'Monster game state reset.', ephemeral: true });
    }
  }
};

