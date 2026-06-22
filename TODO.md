# TODO - Monster Discord Bot

## Step 1: Fix monster progression (kills + HP scaling)
- [ ] Update `lib/monsterState.js` to store `kills` in `monster_state`.
- [ ] Ensure each new monster increases HP by +2, with rare overrides +5/+10.
- [ ] Ensure tier selection works with new maxHp.

## Step 2: Fix death flow + participation rewards
- [ ] Update `lib/monsterAttacks.js` to increment kills, award only attackers, then spawn next monster.
- [ ] Post next monster to configured channel reliably.

## Step 3: Add rare boss announcement
- [ ] Detect when rare bonus roll is +5 or +10.
- [ ] Announce in channel when rare boss appears.

## Step 4: Make monster images actually display
- [ ] Implement attachment-based images (requires `images/monster1.png`..`monster5.png`).
- [ ] Update monster embed send logic in `lib/monsterLoop.js`, `commands/monster.js`, and death reply.

## Step 5: Improve daily heal accuracy (optional)
- [ ] If needed, tie heal to day key stored in DB.

## Step 6: Run/test checklist
- [ ] `/monster-setup` sets channel.
- [ ] `/monster` shows monster.
- [ ] Attack cooldown works (once/day).
- [ ] Monster dies -> next spawns + attackers level up.

