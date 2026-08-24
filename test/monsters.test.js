const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMonsterProfile, getMonsterEvolutionChain } = require('../lib/monsters');

test('buildMonsterProfile exposes rich monster metadata for the UI', () => {
  const profile = buildMonsterProfile({
    id: 'monster_1',
    name: 'Baby Dragon',
    element: 'Fire',
    rarity: 'Rare',
    baseHp: 60,
    baseAttack: 30,
    baseDefense: 20,
    baseSpeed: 25,
    description: 'A hatchling with bright ember scales.',
    lore: 'Legend says it grows into a sky guardian.',
    region: 'Volcano',
    favoriteFood: 'Smoked fish',
    evolution: 'monster_2'
  }, {
    personality: 'brave',
    happiness: 90,
    hunger: 20,
    loyalty: 70,
    evolutionStage: 1
  });

  assert.equal(profile.name, 'Baby Dragon');
  assert.equal(profile.element, 'Fire');
  assert.equal(profile.needs.happiness, 90);
  assert.equal(profile.evolution, 'monster_2');
  assert.equal(profile.stats.hp, 60);
});

test('getMonsterEvolutionChain follows the full evolution path', () => {
  const base = { id: 'monster_1', evolution: 'monster_2' };
  const mid = { id: 'monster_2', evolution: 'monster_3' };
  const final = { id: 'monster_3' };

  const chain = getMonsterEvolutionChain(base, {
    monster_1: base,
    monster_2: mid,
    monster_3: final
  });

  assert.deepEqual(chain.map(monster => monster.id), ['monster_1', 'monster_2', 'monster_3']);
});
