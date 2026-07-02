const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateResourceReward } = require('../lib/world');

test('calculateResourceReward rewards wood more in forests and respects work boosts', () => {
  const reward = calculateResourceReward('forest', { id: 'clear' }, { bonus: 1 }, 10, { lumberjack: 2 });
  assert.equal(reward.resource, 'wood');
  assert.ok(reward.amount >= 3);
});

test('calculateResourceReward rewards stone for desert regions', () => {
  const reward = calculateResourceReward('desert', { id: 'heat' }, { bonus: 1.1 }, 12, {});
  assert.equal(reward.resource, 'stone');
  assert.ok(reward.amount >= 2);
});
