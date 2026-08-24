const { getPlayer } = require('./players');
const { getPlayerMonsters, buildMonsterProfile } = require('./monsters');
const { getWorldStatus } = require('./world');

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}

function toPublicMonster(monster, activeMonsterId) {
  const profile = buildMonsterProfile(monster.monsterData || {}, monster);
  const xp = Number(monster.xp || 0);
  const level = Number(monster.level || 1);

  return {
    id: monster.id,
    name: monster.nickname || profile.name,
    species: profile.name,
    element: profile.element || 'Unknown',
    rarity: profile.rarity || 'Common',
    type: profile.type || 'Unknown',
    level,
    xp,
    xpToNextLevel: level * 100,
    stats: profile.stats,
    needs: profile.needs,
    personality: profile.personality,
    skills: profile.skills,
    evolution: profile.evolution,
    evolutionStage: profile.evolutionStage,
    region: profile.region,
    image: `/images/${profile.imagePath.split(/[\\/]/).pop()}`,
    isActive: monster.id === activeMonsterId,
    isFavorite: Boolean(monster.isFavorite)
  };
}

async function getDashboard(userId) {
  const player = await getPlayer(userId);
  const monsters = await getPlayerMonsters(userId);
  const activeMonsterId = player.activeMonster && player.activeMonster !== 'null'
    ? player.activeMonster
    : null;
  const publicMonsters = monsters.map(monster => toPublicMonster(monster, activeMonsterId));
  const activeMonster = publicMonsters.find(monster => monster.isActive) || publicMonsters[0] || null;
  const world = await getWorldStatus(userId);

  return {
    player: {
      id: player.userId,
      username: player.displayName || player.username || 'Adventurer',
      handle: player.username ? `@${player.username}` : null,
      avatarUrl: player.avatarUrl || null,
      level: Number(player.level || 1),
      xp: Number(player.xp || 0),
      xpToNextLevel: Number(player.level || 1) * 100,
      totalDamage: Number(player.totalDamage || 0),
      gold: Number(player.gold || 0),
      gems: Number(player.gems || 0),
      energy: Number(player.energy || 0),
      maxEnergy: Number(player.maxEnergy || 100),
      region: player.currentRegion || 'Starter Village',
      className: player.currentClass || 'Adventurer',
      job: player.currentJob || 'None',
      guildId: player.guildId || null,
      guildRank: player.guildRank || null,
      achievements: parseJson(player.achievements, []),
      titles: parseJson(player.titles, []),
      inventory: parseJson(player.inventory, [])
    },
    activeMonster,
    monsters: publicMonsters,
    world: {
      timeOfDay: world.timeOfDay,
      timeBonus: world.timeBonus,
      availableRegions: world.availableRegions.map(region => ({
        id: region.id,
        name: region.name,
        description: region.description,
        minLevel: region.minLevel,
        maxLevel: region.maxLevel,
        weather: region.weather.name
      }))
    }
  };
}

module.exports = { getDashboard, toPublicMonster };
