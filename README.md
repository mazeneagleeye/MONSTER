# Monster Bot (discord.js v14 + SQLite)

Daily monster attack game:
- One **⚔️ Attack** button per monster.
- Each member attacks **once per 24h**.
- Monster HP decreases by random damage based on **Attack Level**.
- When the monster dies, participants get **+1 Attack Level** and the next monster spawns.
- Next monster HP increases using: **80% +2**, **19% +5**, **1% +10**.

## Setup
1. Install Node.js 22 LTS.
2. Open this folder in VS Code.
3. Copy `.env.example` to `.env`.
4. Edit `.env` with:
   - `DISCORD_TOKEN`
   - `GUILD_ID`
   - `MONSTER_CHANNEL_ID`
5. Install deps:
   ```bash
   npm install
   ```
6. Run:
   ```bash
   npm start
   ```

## Discord permissions (invite bot)
- View Channels
- Send Messages
- Embed Links
- Attach Files
- Use Slash Commands
- Read Message History

## Commands
- `/monster` : shows current monster + attack button
- `/monsterstats` : your stats
- `/monsterleaderboard` : top hunters
- `/monsterprofile @user` : view another member stats
- `/monster-setup` (admin): set channel, optional `action=reset`

## Images
The bot uses attachment-based images from the `images/` folder:
- `images/monster1.png` ... `images/monster5.png`

The code automatically attaches the correct image based on monster HP tier.
If images are missing, the bot will still function and display the monster without an image.

