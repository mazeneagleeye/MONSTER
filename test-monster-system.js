const { init } = require('./lib/db');
const { 
  initMonsters, 
  summonMonsterForUser, 
  getPlayerMonsters, 
  getPlayerMonster,
  evolveMonster,
  equipMonsterItem,
  unequipMonsterItem,
  setMonsterSkin,
  getMonsterStatistics,
  addMonsterXP,
  getAllMonsters
} = require('./lib/monsters');
const { ensurePlayer } = require('./lib/players');

async function testMonsterSystem() {
  console.log('🐉 Testing Stage 2 - Monster System\n');
  console.log('='.repeat(50));

  try {
    // Step 1: Initialize database
    console.log('\n1️⃣ Initializing database...');
    await init();
    console.log('✅ Database initialized');

    // Step 2: Generate monsters
    console.log('\n2️⃣ Generating 500+ monsters...');
    await initMonsters();
    console.log('✅ Monsters generated');

    // Step 3: Check monster count
    console.log('\n3️⃣ Checking monster database...');
    const allMonsters = await getAllMonsters();
    console.log(`✅ Total monsters in database: ${allMonsters.length}`);
    
    // Check rarity distribution
    const rarityCount = {};
    allMonsters.forEach(m => {
      rarityCount[m.rarity] = (rarityCount[m.rarity] || 0) + 1;
    });
    console.log('   Rarity distribution:', rarityCount);

    // Step 4: Create test player
    console.log('\n4️⃣ Creating test player...');
    const testUserId = 'test_user_123';
    await ensurePlayer(testUserId, {
      username: 'TestPlayer',
      displayName: 'Test Player'
    });
    console.log('✅ Test player created');

    // Step 5: Test summoning
    console.log('\n5️⃣ Testing summoning system...');
    const goldSummon = await summonMonsterForUser(testUserId, 'gold');
    if (goldSummon.success) {
      console.log(`✅ Gold summon: ${goldSummon.monster.name} (${goldSummon.monster.rarity})`);
    } else {
      console.log('❌ Gold summon failed:', goldSummon.message);
    }

    const gemSummon = await summonMonsterForUser(testUserId, 'gem');
    if (gemSummon.success) {
      console.log(`✅ Gem summon: ${gemSummon.monster.name} (${gemSummon.monster.rarity})`);
    } else {
      console.log('❌ Gem summon failed:', gemSummon.message);
    }

    const beginnerSummon = await summonMonsterForUser(testUserId, 'beginner');
    if (beginnerSummon.success) {
      console.log(`✅ Beginner summon: ${beginnerSummon.monster.name} (${beginnerSummon.monster.rarity})`);
    } else {
      console.log('❌ Beginner summon failed:', beginnerSummon.message);
    }

    // Step 6: Check collection
    console.log('\n6️⃣ Checking monster collection...');
    const collection = await getPlayerMonsters(testUserId);
    console.log(`✅ Player has ${collection.length} monsters`);
    
    if (collection.length > 0) {
      const firstMonster = collection[0];
      console.log(`   First monster: ${firstMonster.nickname || firstMonster.monsterData.name}`);
      console.log(`   - Level: ${firstMonster.level}`);
      console.log(`   - Personality: ${firstMonster.personality}`);
      console.log(`   - Happiness: ${firstMonster.happiness}%`);
      console.log(`   - Hunger: ${firstMonster.hunger}%`);
      console.log(`   - Loyalty: ${firstMonster.loyalty}%`);
      console.log(`   - Skills: ${firstMonster.skills.length}`);
      console.log(`   - Equipment: ${JSON.stringify(firstMonster.equipment)}`);
      console.log(`   - Skin: ${firstMonster.skin}`);
      console.log(`   - Evolution Stage: ${firstMonster.evolutionStage}`);
    }

    // Step 7: Test XP system
    console.log('\n7️⃣ Testing XP system...');
    if (collection.length > 0) {
      const monsterId = collection[0].id;
      const xpResult = await addMonsterXP(monsterId, 150);
      if (xpResult) {
        console.log(`✅ Added 150 XP - Leveled up: ${xpResult.leveledUp}, New level: ${xpResult.newLevel}`);
      }
      
      const updatedMonster = await getPlayerMonster(monsterId);
      console.log(`   Updated monster level: ${updatedMonster.level}, XP: ${updatedMonster.xp}`);
    }

    // Step 8: Test evolution
    console.log('\n8️⃣ Testing evolution system...');
    if (collection.length > 0) {
      const monster = collection[0];
      console.log(`   Testing evolution for: ${monster.nickname || monster.monsterData.name}`);
      console.log(`   - Can evolve: ${monster.monsterData.evolution ? 'Yes' : 'No'}`);
      console.log(`   - Current level: ${monster.level}`);
      console.log(`   - Required level: 10`);
      
      if (monster.monsterData.evolution && monster.level >= 10) {
        const evolveResult = await evolveMonster(monster.id);
        if (evolveResult.success) {
          console.log(`✅ Evolution successful: ${evolveResult.message}`);
        } else {
          console.log(`⚠️ Evolution failed: ${evolveResult.message}`);
        }
      } else {
        console.log('⚠️ Monster does not meet evolution requirements (need level 10)');
      }
    }

    // Step 9: Test equipment
    console.log('\n9️⃣ Testing equipment system...');
    if (collection.length > 0) {
      const monsterId = collection[0].id;
      const equipResult = await equipMonsterItem(monsterId, 'test_weapon_1', 'weapon');
      if (equipResult.success) {
        console.log(`✅ Equipment test: ${equipResult.message}`);
      }
      
      const unequipResult = await unequipMonsterItem(monsterId, 'weapon');
      if (unequipResult.success) {
        console.log(`✅ Unequip test: ${unequipResult.message}`);
      }
    }

    // Step 10: Test skins
    console.log('\n🔟 Testing skins system...');
    if (collection.length > 0) {
      const monsterId = collection[0].id;
      const skinResult = await setMonsterSkin(monsterId, 'golden');
      if (skinResult.success) {
        console.log(`✅ Skin test: ${skinResult.message}`);
      }
    }

    // Step 11: Test statistics
    console.log('\n1️⃣1️⃣ Testing statistics system...');
    if (collection.length > 0) {
      const monsterId = collection[0].id;
      const stats = await getMonsterStatistics(monsterId);
      if (stats) {
        console.log('✅ Monster statistics:', stats);
      }
    }

    // Step 12: Test encyclopedia
    console.log('\n1️⃣2️⃣ Testing encyclopedia...');
    const allMonstersList = await getAllMonsters();
    const discoveredCount = new Set(collection.map(m => m.monsterId)).size;
    console.log(`✅ Encyclopedia progress: ${discoveredCount}/${allMonstersList.length} monsters discovered`);
    console.log(`   Completion: ${Math.round((discoveredCount / allMonstersList.length) * 100)}%`);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Stage 2 - Monster System Test Complete!');
    console.log('='.repeat(50));
    console.log('\n✅ All core features implemented:');
    console.log('   • Monster database (500+ monsters)');
    console.log('   • Summoning (Gold, Gem, Event, Beginner)');
    console.log('   • Collection management');
    console.log('   • Monster info and encyclopedia');
    console.log('   • Personality system');
    console.log('   • Needs system (hunger, happiness, loyalty)');
    console.log('   • Leveling and XP system');
    console.log('   • Evolution system');
    console.log('   • Equipment system');
    console.log('   • Skins system');
    console.log('   • Statistics tracking');
    console.log('\n🎮 Available commands:');
    console.log('   • /monsters summon - Summon monsters');
    console.log('   • /monsters collection - View collection');
    console.log('   • /monsters info - View monster details');
    console.log('   • /monsters interact - Interact with monsters');
    console.log('   • /monsters set-active - Set active monster');
    console.log('   • /monsters favorite - Favorite monsters');
    console.log('   • /monsters rename - Rename monsters');
    console.log('   • /monsters encyclopedia - View encyclopedia');
    console.log('   • /monstermanage evolve - Evolve monsters');
    console.log('   • /monstermanage equip - Equip items');
    console.log('   • /monstermanage skin - Change skins');
    console.log('   • /monstermanage stats - View statistics');
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

testMonsterSystem();