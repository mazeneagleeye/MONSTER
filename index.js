require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { Client, Collection, GatewayIntentBits, Partials, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');

const { registerCommands } = require('./lib/commandsRegister');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.Channel]
});

client.commands = new Collection();

// Load command modules
const commandsDir = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsDir)) {
  if (!file.endsWith('.js')) continue;
  const command = require(path.join(commandsDir, file));
  if (!command?.data || !command?.execute) continue;
  client.commands.set(command.data.name, command);
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands(client);

  // Start monster loop
  const { startMonsterLoop } = require('./lib/monsterLoop');
  await startMonsterLoop(client);
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction, client);
      return;
    }

    if (interaction.isButton()) {
      const { handleAttackButton } = require('./lib/monsterAttacks');
      if (interaction.customId === 'attack') {
        await handleAttackButton(interaction, client);
      }
    }
  } catch (err) {
    console.error(err);
    if (interaction?.replied || interaction?.deferred) {
      await interaction.followUp({ content: 'An error occurred.', ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: 'An error occurred.', ephemeral: true }).catch(() => {});
    }
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token || token === 'PUT_TOKEN_HERE') {
  console.error('Missing DISCORD_TOKEN in .env (or still using placeholder).');
  process.exit(1);
}
client.login(token);

