# 🐉 Monster Kingdom - Discord Bot

A comprehensive Discord bot game featuring monster collection, battles, guilds, and world exploration.

## ✨ Features

### Core Gameplay
- **500+ Monsters** - Collect, train, and evolve monsters with unique personalities
- **Battle System** - PVE, PVP, Boss battles, Tower, Survival, and Dungeon modes
- **World Exploration** - 10 unique regions with weather and time bonuses
- **Guild System** - Create/join guilds, construct buildings, research upgrades
- **Economy** - Market, trading, mail system, private shops
- **Events** - Special events with rewards and leaderboards
- **Tournaments** - Competitive PvP tournaments
- **Daily Rewards** - Streak bonuses and special items

### Monster Features
- Personality system (12 unique personalities)
- Equipment system (weapons, armor, accessories, relics)
- Evolution chains
- Monster interactions (feed, play, train, pet)
- Statistics tracking
- Skins and customization

### Player Progression
- Level system (1-500)
- Prestige system
- Achievements and titles
- Daily quests
- Work skills (lumberjack, miner, jeweler, etc.)
- Energy system with regeneration

## 🚀 Quick Start

### Prerequisites
- Node.js 16.9.0 or higher
- Discord Bot Token
- MongoDB database (for bot hosting) OR SQLite (for local development)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/mazeneagleeye/MONSTER.git
cd MONSTER
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
```

Edit `.env` and add your Discord token and MongoDB connection string:
```env
DISCORD_TOKEN=your_bot_token_here
MONGODB_URI=your_mongodb_connection_string_here
```

For browser login, add these OAuth values as well:
```env
DISCORD_CLIENT_ID=your_discord_application_client_id
DISCORD_CLIENT_SECRET=your_discord_application_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback
WEB_PORT=3000
```

In the Discord Developer Portal, open **OAuth2 > General > Redirects** and add
`http://localhost:3000/auth/callback` exactly. The scheme, host, port, path, and
trailing slash must match the value in `.env`. Start the browser game with
`npm run web`.

Open the game at `http://localhost:3000` in the same browser where you start
login. Do not open `web/index.html` directly or switch between `localhost` and
`127.0.0.1`; those are different OAuth callback URLs.

4. Start the bot:
```bash
npm start
```

## 📊 Database Configuration

### MongoDB (Recommended for Bot Hosting)

The bot supports MongoDB for persistent storage, which is **required for bot hosting platforms** (like Replit, Heroku, etc.) that use ephemeral filesystems.

**Setup:**
1. Create a MongoDB database (MongoDB Atlas recommended)
2. Add your MongoDB connection string to `.env`:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/monster_bot
   ```
3. The bot will automatically use MongoDB when `MONGODB_URI` is set

**Benefits:**
- ✅ Persistent storage across bot restarts
- ✅ Works on bot hosting platforms
- ✅ No file system dependencies
- ✅ Automatic fallback to SQLite if MongoDB fails

### SQLite (Local Development)

If no MongoDB URI is provided, the bot falls back to SQLite for local development:
- `monster.db` - Monster catalog and world state
- `players.db` - Player data, monsters, guilds, etc.

## 🎮 Game Mechanics

### Getting Started
1. Use `/start` to create your character
2. Summon your first monster with `/summon`
3. Set your active monster with `/monsters set-active`
4. Battle enemies with `/battle`
5. Explore the world with `/explore`

### Battle System
- **PVE**: Fight random enemies for XP and gold
- **Boss**: Challenge powerful bosses for rare rewards
- **World Boss**: Community event - everyone fights together
- **PVP**: Battle other players' monsters
- **Tower**: Climb the tower for increasing rewards
- **Survival**: Survive as many waves as possible
- **Dungeon**: Daily dungeon with special rewards

### Element System
- Fire > Ice > Earth > Fire
- Water > Fire > Electric > Water
- Dark <-> Light
- And more strategic matchups!

### Guild Features
- Create or join guilds
- Contribute resources and gold
- Build guild structures
- Research upgrades
- Guild boss battles
- Member management

## 🛠️ Commands

### Player Commands
- `/start` - Create your character
- `/profile` - View your profile
- `/summon` - Summon a new monster
- `/monsters` - Manage your monsters
- `/battle` - Battle enemies
- `/explore` - Explore the world
- `/gather` - Gather resources

### Guild Commands
- `/guild create` - Create a guild
- `/guild join` - Join a guild
- `/guild info` - View guild info
- `/guild contribute` - Contribute to guild

### Economy Commands
- `/shop` - View shop items
- `/market` - Player marketplace
- `/trade` - Trade with other players
- `/mail` - Mail system

### Social Commands
- `/party` - Party system
- `/tournament` - Tournaments
- `/global` - Global chat

## 📁 Project Structure

```
monster-bot/
├── commands/          # Discord slash commands
├── lib/              # Core game logic
│   ├── db.js         # SQLite database
│   ├── mongodb.js    # MongoDB connection
│   ├── db-adapter.js # Universal database adapter
│   ├── players.js    # Player management
│   ├── monsters.js   # Monster system
│   ├── battles.js    # Battle system
│   ├── guilds.js     # Guild system
│   ├── world.js      # World exploration
│   ├── economy.js    # Market & trading
│   ├── events.js     # Event system
│   ├── parties.js    # Party system
│   ├── tournaments.js # Tournament system
│   ├── shops.js      # Shop system
│   └── ...
├── images/           # Monster images
├── data/             # SQLite database files (local only)
├── index.js          # Main bot entry point
└── package.json

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Your Discord bot token |
| `MONGODB_URI` | No* | MongoDB connection string (*required for bot hosting) |
| `MONGO_URI` | No* | Alternative MongoDB URI variable |
| `MONGODB_DB_NAME` | No | MongoDB database name (default: `monster_bot`) |
| `DATA_DIR` | No | SQLite data directory (default: `./data`) |
| `DISCORD_CLIENT_ID` | No* | Discord application client ID for browser login |
| `DISCORD_CLIENT_SECRET` | No* | Discord application client secret for browser login |
| `DISCORD_REDIRECT_URI` | No* | Exact OAuth callback registered in Discord (*required together for browser login) |
| `WEB_PORT` | No | Browser game port (default: `3000`) |

### Bot Permissions

Your bot needs these permissions:
- `Send Messages`
- `Use Slash Commands`
- `Embed Links`
- `Attach Files`
- `Add Reactions`
- `Read Message History`
- `Use External Emojis`

## 🎯 Game Balance

- **Energy**: 1 energy per 5 minutes
- **Battle Cost**: 3-20 energy depending on mode
- **Summon Cost**: 100 gold or 10 gems
- **Level Cap**: 500
- **Monster Level Cap**: 100
- **Prestige**: Reset for permanent bonuses

## 🐛 Known Issues

- Some command files still use direct SQLite imports (being migrated)
- Image assets for some monsters are missing
- Tournament system needs testing

## 📝 TODO

- [ ] Complete migration of all command files to db-adapter
- [ ] Add more monster images
- [ ] Implement monster trading
- [ ] Add more battle modes
- [ ] Seasonal rankings
- [ ] Mobile-friendly embeds

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

Created by Eagle Eye

## 🙏 Acknowledgments

- Discord.js community
- MongoDB for database support
- All the players and testers

---

**Note**: This bot is designed to be hosting-ready. Always use MongoDB for production deployments to ensure data persistence.