const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { monsterDb } = require('./db');
const { get, run } = require('./db');

const { ensurePlayer, canAttackToday, addDamage, setLastAttackAt, incrementAttackLevelAndParticipated } = require('./players');
const { getCurrentMonster, reduceHpBy } = require('./monsterState');
const path = require('path');

// image assets live in: <projectRoot>/images/monster1.png ... monster5.png



async function getMonsterAttackTodayCooldownRemaining(interactionUserId) {
  return null;
}

function formatCooldown(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

async function handleAttackButton(interaction, client) {
  const userId = interaction.user.id;
  const now = Date.now();

  await ensurePlayer(userId);

  const { allowed, cooldownMs } = await canAttackToday(userId, now);
  if (!allowed) {
    return interaction.reply({ content: `You already attacked today. Come back in ${formatCooldown(cooldownMs)}.`, ephemeral: true });
  }

  const monster = await getCurrentMonster();
  const player = await require('./players').getPlayer(userId);
  const attackLevel = player.attackLevel ?? 1;

  // damage range: level L => L - (L+2) ? requested example: level1 => 1-3; level2 => 2-4.
  // That means min=L, max=L+2.
  const minDmg = attackLevel;
  const maxDmg = attackLevel + 2;
  const damage = Math.floor(Math.random() * (maxDmg - minDmg + 1)) + minDmg;

  const newHp = await reduceHpBy(damage);

  // Save attack for participation rewards
  await run(monsterDb,
    `INSERT INTO monster_attacks(monsterId, userId, damage, attackAt) VALUES(?,?,?,?)
     ON CONFLICT(monsterId,userId) DO UPDATE SET damage=excluded.damage, attackAt=excluded.attackAt`,
    [monster.monsterId, userId, damage, now]
  );

  await addDamage(userId, damage);
  await setLastAttackAt(userId, now);

  const embed = new EmbedBuilder()
    .setTitle(monster.title)
    .setColor(0x2b2d42)
    .addFields(
      { name: 'Damage dealt', value: String(damage), inline: true },
      { name: 'Monster HP', value: `${newHp}/${monster.maxHp}`, inline: true }
    );

  // Attach monster image (requires images/monster1.png .. monster5.png)
  const imageTier = monster.imageTier ?? require('./monsterState').clampMonsterImageTier(monster.maxHp);
  const imagePath = path.join(__dirname, '..', 'images', `monster${imageTier}.png`);
  let attachment = null;
  try {
    attachment = new AttachmentBuilder(imagePath, { name: `monster${imageTier}.png` });
    embed.setImage(`attachment://monster${imageTier}.png`);
  } catch (e) {
    console.warn(`Monster image missing: ${imagePath}. Sending without image.`);
  }


  // Show damage breakdown + cooldown handled elsewhere



  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('attack').setLabel('⚔️ Attack (once/day)').setStyle(ButtonStyle.Danger)
  );

  // Update the message where button lives
  if (interaction.deferred || interaction.replied) {
    // If not, do normal reply
  }

  await interaction.reply({ embeds: [embed], components: [row], files: [attachment], ephemeral: false });


  if (newHp <= 0) {
    // Award participation to those who attacked the monster
    const attackers = await require('./db').all(
      monsterDb,
      `SELECT userId FROM monster_attacks WHERE monsterId = ?`,
      [monster.monsterId]
    );

    for (const a of attackers) {
      // +1 attack level (only for participants)
      await incrementAttackLevelAndParticipated(a.userId, true);
    }

    // Update kills and history
    const { getMonsterStateValue, setMonsterStateValue, spawnNewMonster: spawnNext } = require('./monsterState');
    const currentKills = Number(await getMonsterStateValue('kills', 0));
    await setMonsterStateValue('kills', currentKills + 1);

    const bonusHp = Number(await getMonsterStateValue('lastBonusHp', 2));
    const seq = Number(await getMonsterStateValue('monsterSeq', 0));
    await run(
      monsterDb,
      `INSERT INTO monster_history(seq, monsterId, title, maxHp, bonusHp, rareType, killedAt)
       VALUES(?,?,?,?,?,?,?)`,
      [seq, monster.monsterId, monster.title, monster.maxHp, bonusHp, bonusHp >= 10 ? 'Legendary' : bonusHp >= 5 ? 'Rare' : null, Date.now()]
    ).catch(() => {});

    // Spawn next monster (+2/+5/+10 logic handled in monsterState)
    const next = await spawnNext();

    // Post the new monster into the configured channel
    const { getConfig, keys } = require('./config');
    const channelId = await getConfig(monsterDb, keys.MONSTER_CHANNEL_ID, process.env.MONSTER_CHANNEL_ID);
    if (channelId) {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (channel) {
        const afterDeath = await getCurrentMonster();
        const nextEmbed = new EmbedBuilder()
          .setTitle(afterDeath.title)
          .setColor(0x2b2d42)
          .setDescription(`**HP:** ${afterDeath.hp}/${afterDeath.maxHp}`)
          .setImage(afterDeath.imageUrl);

        const nextRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('attack').setLabel('⚔️ Attack (once/day)').setStyle(ButtonStyle.Danger)
        );

        // Rare announcement (⭐)
        let announce = null;
        if (next?.bonusHp >= 10) {
          announce = `⭐ **LEGENDARY BOSS!** (+${next.bonusHp} HP) ⭐`;
        } else if (next?.bonusHp >= 5) {
          announce = `⭐ **Rare Boss!** (+${next.bonusHp} HP) ⭐`;
        }

        if (announce) {
          await channel.send({ content: announce });
        }

        await channel.send({ embeds: [nextEmbed], components: [nextRow] });
      }
    }
  }
}

module.exports = { handleAttackButton };

