const { REST, Routes } = require('discord.js');

async function registerCommands(client) {
  const commands = [];
  for (const cmd of client.commands.values()) {
    commands.push(cmd.data.toJSON());
  }

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  // Global commands (no GUILD_ID needed)
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
  console.log(`Registered ${commands.length} global commands.`);
}

module.exports = { registerCommands };


