# 🐉 Monster Kingdom - Discord Bot

A persistent online world where every Discord server is its own kingdom, but all servers share one global universe.

## 🌍 World Features
- **500+ monsters** to discover and collect
- **10 different elements**: Fire, Water, Earth, Electric, Dark, Light, Wind, Ice, Poison, Psychic
- **6 rarity levels**: Common, Uncommon, Rare, Epic, Legendary, Mythic
- Monster evolutions and unique skills
- Day/night cycle and weather effects
- Seasonal events and holiday celebrations

## 👤 Player System
- **Level 1-500** with prestige system
- XP, Gold, Gems, and Energy mechanics
- Inventory and equipment system
- Titles and achievements
- Monster collection with AI personalities

## 🐲 Monster Collection
- Summon monsters with gold
- Each monster has unique:
  - Personality (brave, shy, playful, lazy, aggressive, curious, loyal, rebellious, wise, clumsy, proud, humble)
  - Happiness, hunger, and loyalty stats
  - Skills and equipment slots
  - Battle history
- Interact with your monsters (feed, play, train, pet)
- Build relationships with your monsters

## ⚔ Battle System
- **PvE**: Battle random enemies
- **PvP**: Challenge other players
- **Bosses**: Fight powerful bosses for rare rewards
- **World Boss**: Global boss that all servers can fight
- **Tower Mode**: Climb 100 floors of increasing difficulty
- **Survival Mode**: Endless waves of enemies
- **Daily Dungeons**: Special dungeon challenges

## 🏰 Guild System
- Create and join guilds
- Guild bank and upgrades
- Guild research tree
- Guild wars and guild bosses
- Member ranks (master, officer, member)
- Guild leaderboards

## 💰 Economy
- **Marketplace**: Buy and sell items
- **Player Trading**: Direct trades with other players
- **Mail System**: Send gifts and messages
- **Crafting**: Create items from materials
- **Gathering**: Fishing, Mining, Farming, Cooking, Alchemy
- Equipment with rarity tiers

## 🎁 Daily Content
- **Daily Quests**: 3 random quests every day
- **Weekly Quests**: Bigger challenges weekly
- **Monthly Pass**: Free and premium rewards
- **Seasonal Events**: Spring, Summer, Autumn, Winter festivals
- **Holiday Events**: New Year, Halloween, Christmas

## 🤝 Communication
- **Global Chat**: Chat with players across all servers
- **Trade Chat**: Dedicated trading channel
- **Private Mail**: Send gifts and messages
- **Parties**: Team up for raids
- **Tournaments**: Create and join tournaments

## 🌎 Global Features
All servers share the same world:
- Global leaderboards (level, damage, gold, guild)
- Global marketplace
- World bosses that span all servers
- Cross-server PvP rankings
- Seasonal rankings

## 🤖 AI Monster Personality System
Each monster has its own personality that affects:
- How they react to feeding
- Play behavior
- Training responses
- Affection display
- Loyalty development
- Battle performance

Monsters remember battles and get hungry. Neglect them and they may become disobedient!

## 🎮 Commands

### Player Commands
- `/profile` - View your profile
- `/monsters collection` - View your monsters
- `/monsters summon` - Summon a new monster (100 gold)
- `/monsters interact` - Interact with your monster
- `/monsters set-active` - Set active monster for battles
- `/monsters info` - View monster details

### Battle Commands
- `/battle pve` - Battle random enemy
- `/battle boss` - Fight a boss (10 energy)
- `/battle worldboss` - Fight world boss (20 energy)
- `/battle pvp @user` - Challenge another player
- `/battle tower [floor]` - Climb the tower
- `/battle survival` - Survival mode
- `/battle dungeon` - Enter dungeon

### Guild Commands
- `/guild create [name]` - Create a guild
- `/guild join [id]` - Join a guild
- `/guild leave` - Leave guild
- `/guild info` - View guild info
- `/guild members` - View members
- `/guild contribute [amount]` - Contribute gold
- `/guild upgrade [type]` - Upgrade guild
- `/guild leaderboard` - Top guilds

### Economy Commands
- `/market list [item] [price]` - List item for sale
- `/market buy [listing]` - Buy item
- `/market browse` - Browse marketplace
- `/market sell-monster [id] [price]` - Sell monster
- `/gather [activity]` - Gather resources (fishing, mining, farming, cooking, alchemy)

### Quest Commands
- `/quests daily` - View daily quests
- `/quests weekly` - View weekly quests
- `/quests claim [quest]` - Claim rewards

### Global Commands
- `/global chat [message]` - Send global message
- `/global leaderboard [type]` - View global rankings
- `/global rank` - Check your rank

### World Commands
- `/explore world` - View world status and available regions
- `/explore region [region]` - Explore a specific region
- `/explore dungeon` - Enter the daily dungeon

### Party Commands
- `/party create [activity]` - Create a new party
- `/party join [id]` - Join a party
- `/party leave` - Leave your party
- `/party info` - View party information
- `/party browse` - Browse open parties
- `/party disband` - Disband your party (leader only)
- `/party start` - Start party activity (leader only)

### Tournament Commands
- `/tournament create [name] [type]` - Create a tournament
- `/tournament join [id]` - Join a tournament
- `/tournament leave [id]` - Leave a tournament
- `/tournament browse` - Browse open tournaments
- `/tournament info [id]` - View tournament details
- `/tournament start [id]` - Start a tournament (creator only)

### Shop Commands
- `/shop create [name]` - Create your own shop
- `/shop add-item [item] [price]` - Add item to your shop
- `/shop remove-item [item]` - Remove item from your shop
- `/shop view` - View your shop
- `/shop browse` - Browse all shops
- `/shop visit [id]` - Visit a specific shop
- `/shop delete` - Delete your shop

### Admin Commands
- `/monster-setup [channel]` - Set monster channel
- `/monster-setup action=reset` - Reset monster state

## 🚀 Setup

1. Install Node.js 22 LTS
2. Clone this repository
3. Install dependencies:
   ```bash
   npm install
   ```
4. Copy `.env.example` to `.env` and fill in:
   - `DISCORD_TOKEN` - Your bot token
   - `GUILD_ID` - Your server ID (for testing)
   - `MONSTER_CHANNEL_ID` - Channel for world boss
5. Initialize the database and generate monsters:
   ```bash
   node init-monsters.js
   ```
6. Start the bot:
   ```bash
   npm start
   ```

## 📋 Discord Permissions
- View Channels
- Send Messages
- Embed Links
- Attach Files
- Use Slash Commands
- Read Message History
- Administrator (for setup commands)

## 🎨 Features That Make This Bot Unique

### AI Monster Personalities
Unlike other Discord bots, Monster Kingdom features an AI system where each monster has:
- **Memory**: Remembers battles and interactions
- **Personality**: 12 unique personalities affecting behavior
- **Needs**: Gets hungry over time, needs care
- **Loyalty System**: Build trust or face disobedience
- **Unique Reactions**: Different responses to gifts and training

### Persistent World
- All servers share the same universe
- Global economy and marketplace
- Cross-server competitions
- World events affecting all players

### Deep Progression
- 500 levels of player progression
- Prestige system for endgame
- 500+ unique monsters to collect
- Complex equipment and crafting
- Multiple endgame activities

## 🛠️ Technical Features
- **Discord.js v14** with slash commands
- **SQLite** databases for players and world state
- **Button-based UI** - No typing commands!
- **Image attachments** for monster displays
- **Energy system** to prevent grinding
- **Rate limiting** for global chat

## 📝 License
MIT

## 🤝 Contributing
Pull requests are welcome! Feel free to add new features, monsters, or improve the code.

