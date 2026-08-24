require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { Client, Collection, GatewayIntentBits, Partials, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');

const { registerCommands } = require('./lib/commandsRegister');
const { createWelcomeImage } = require('./lib/welcomeImage');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
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
  const heartbeat = () => {
    const uptimeMinutes = Math.floor(process.uptime() / 60);
    console.log(`[HEARTBEAT] Bot is online as ${client.user.tag} | uptime: ${uptimeMinutes}m`);
  };
  heartbeat();
  setInterval(heartbeat, 30 * 1000);

  // Initialize DBs BEFORE any command/interaction can access them
  const db = require('./lib/db-adapter');
  await db.init();

  await registerCommands(client);

  // Start monster loop
  const { startMonsterLoop } = require('./lib/monsterLoop');
  await startMonsterLoop(client);

  const { start: startWeb } = require('./web/server');
  await startWeb({ databaseInitialized: true });
});

client.on('error', error => {
  console.error('Discord client error:', error.message);
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
      } else if (interaction.customId === 'welcome_start') {
        await interaction.reply({ content: 'Use `/start` to begin your adventure!', ephemeral: true });
      } else if (interaction.customId === 'welcome_rules') {
        await interaction.reply({ content: 'Please read the rules channel to get started!', ephemeral: true });
      } else if (interaction.customId === 'welcome_guide') {
        await interaction.reply({ content: 'Check out the guide channel for tips and tricks!', ephemeral: true });
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

// Welcome system
const WELCOME_CHANNEL_ID = '1521885990552076460';
const ADVENTURER_ROLE_ID = '1522277535860129902';

client.on('guildMemberAdd', async (member) => {
  try {
    // Give Adventurer role
    await member.roles.add(ADVENTURER_ROLE_ID);
    
    // Log join
    console.log(`[JOIN] ${member.user.username}#${member.user.discriminator} (${member.user.id}) joined the server`);
    
    // Send welcome message
    const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!welcomeChannel) {
      console.error('Welcome channel not found!');
      return;
    }
    
    const memberCount = member.guild.memberCount;
    const joinDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const joinLabel = 'Today';

    let welcomeAttachment = null;
    try {
      const imageBuffer = await createWelcomeImage(member.user.username, memberCount, joinLabel);
      welcomeAttachment = new AttachmentBuilder(imageBuffer, { name: 'monster-welcome.png' });
    } catch (imgErr) {
      console.error('Could not create welcome image:', imgErr.message);
    }

    const embed = new EmbedBuilder()
      .setTitle('🐉 Welcome to Monster Kingdom!')
      .setDescription(`🏰 The gates of Monster Kingdom have opened...\n\nWelcome, **${member.user.username}**.\n\nThe Warden has recognized your arrival and granted you the 🐣 Adventurer title.\n\nYour destiny awaits.\nUse \`/start\` to begin your adventure.`)
      .setColor(0x8e44ad)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Before you begin', value: '• 📜 Read the rules\n• 🎮 Use `/start` to create your character\n• 🐉 Summon your first monster\n• ⚔️ Battle enemies and level up\n• 🏰 Join or create a guild\n• 🌍 Explore the world', inline: false },
        { name: 'Member Info', value: `Member #${memberCount}\nJoined: ${joinLabel}\nRole: 🐣 Adventurer`, inline: false }
      )
      .setFooter({ text: 'We\'re glad to have you with us!' })
      .setTimestamp();
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('welcome_start').setLabel('🎮 Start').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('welcome_rules').setLabel('📜 Rules').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('welcome_guide').setLabel('📖 Guide').setStyle(ButtonStyle.Secondary)
    );
    
    const welcomePayload = {
      content: `Welcome ${member}!`,
      embeds: [embed],
      components: [row]
    };
    if (welcomeAttachment) {
      welcomePayload.files = [welcomeAttachment];
    }

    await welcomeChannel.send(welcomePayload);
    
    // Send DM with beginner tips
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle('🐉 Welcome to Monster Kingdom!')
        .setDescription(`You are now an Adventurer.\n\nTo begin your journey:\n\n1️⃣ Type \`/start\`\n2️⃣ Summon your first monster\n3️⃣ Battle enemies\n4️⃣ Explore the world\n\nGood luck!`)
        .setColor(0x9b59b6)
        .setFooter({ text: 'The Warden is watching over you.' });
      
      await member.send({ embeds: [dmEmbed] });
    } catch (dmErr) {
      console.log(`Could not send DM to ${member.user.username}: ${dmErr.message}`);
    }
    
    // Store join time for 24-hour reminder
    const { run } = require('./lib/db-adapter');
    await run(require('./lib/db-adapter').getMonsterDb(),
      `INSERT OR IGNORE INTO join_reminders (userId, joinedAt, reminded) VALUES(?, ?, 0)`,
      [member.user.id, Date.now()]
    );
    
  } catch (err) {
    console.error('Error in guildMemberAdd:', err);
  }
});

// 24-hour reminder system
setInterval(async () => {
  try {
    const { get, run, all } = require('./lib/db-adapter');
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    // Find users who joined 24+ hours ago and haven't been reminded
    const reminders = await all(require('./lib/db-adapter').getMonsterDb(),
      `SELECT * FROM join_reminders WHERE joinedAt <= ? AND reminded = 0`,
      [twentyFourHoursAgo]
    );
    
    for (const reminder of reminders) {
      // Check if player has started
      const player = await get(require('./lib/db-adapter').getPlayersDb(),
        `SELECT * FROM players WHERE userId = ?`,
        [reminder.userId]
      );
      
      if (!player) {
        // Player hasn't started, send reminder
        try {
          const guild = client.guilds.cache.first(); // Adjust if you have multiple guilds
          if (!guild) continue;
          
          const member = await guild.members.fetch(reminder.userId);
          if (member) {
            await member.send({
              content: '🐉 Hey, your adventure hasn\'t started yet!\nType `/start` to enter Monster Kingdom!'
            });
            
            // Mark as reminded
    await run(require('./lib/db-adapter').getMonsterDb(),
              `UPDATE join_reminders SET reminded = 1 WHERE userId = ?`,
              [reminder.userId]
            );
          }
        } catch (err) {
          console.error(`Could not send reminder to ${reminder.userId}:`, err.message);
        }
      } else {
        // Player has started, remove from reminders
        await run(require('./lib/db-adapter').getMonsterDb(),
          `DELETE FROM join_reminders WHERE userId = ?`,
          [reminder.userId]
        );
      }
    }
  } catch (err) {
    console.error('Error in reminder system:', err);
  }
}, 60 * 60 * 1000); // Check every hour

const token = process.env.DISCORD_TOKEN;
if (!token || token === 'PUT_TOKEN_HERE') {
  console.error('Missing DISCORD_TOKEN in .env (or still using placeholder).');
  process.exit(1);
}
client.login(token).catch(error => {
  console.error('Discord login failed:', error.message);
  process.exitCode = 1;
});

