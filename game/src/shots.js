// MOTHFLAME — deterministic screenshot scenes.
// The house games shoot their screenshots from seeded scenes, and so do we:
// ?shot=title|play|levelup|victory&seed=N sets the game up at a fixed moment
// and raises window.__shotReady when the frame is ready to capture. Nothing
// here runs in a normal game; it only stages the four screenshots.

import { createRng } from './config.js';

export function setupShot(game, scene, seed = 1) {
  const rng = createRng(seed * 7919 + 13);
  game.audio.setMuted(true);

  if (scene === 'title') {
    game.showTitle();
    game.titleOrbit = 2.2;
    game.time = 2.5;
    // Let the motes and the orbiting moth settle for a few frames.
    for (let i = 0; i < 40; i++) game.update(1 / 60);
    game.draw();
    window.__shotReady = true;
    return;
  }

  if (scene === 'play') {
    stageFight(game, rng, { wave: 3, level: 4, score: 2450, kills: 31 });
    game.draw();
    window.__shotReady = true;
    return;
  }

  if (scene === 'levelup') {
    stageFight(game, rng, { wave: 4, level: 5, score: 3980, kills: 44 });
    game.pendingLevels = 1;
    game.openLevelUp();
    game.draw();
    window.__shotReady = true;
    return;
  }

  if (scene === 'victory') {
    stageFight(game, rng, { wave: 10, level: 12, score: 18450, kills: 212 });
    game.runTime = 14 * 60 + 32;
    game.shotsFired = 420;
    game.shotsHit = 301;
    game.waves.wave = 10;
    game.endRun(true);
    game.draw();
    window.__shotReady = true;
    return;
  }

  if (scene === 'defeat') {
    stageFight(game, rng, { wave: 7, level: 8, score: 9120, kills: 118 });
    game.runTime = 9 * 60 + 5;
    game.shotsFired = 260;
    game.shotsHit = 171;
    game.waves.wave = 7;
    game.endRun(false);
    game.draw();
    window.__shotReady = true;
    return;
  }

  window.__shotReady = true;
}

// A mid-fight tableau: the moth at the garden's heart, a mixed swarm around
// it, bolts in the air, embers on the ground, a combo running.
function stageFight(game, rng, { wave, level, score, kills }) {
  game.startRun();
  game.waves.wave = wave;
  game.waves.active = true;
  game.player.level = level;
  game.player.xp = 4;
  game.player.xpNext = 20 + level * 4;
  game.player.hp = Math.round(game.player.stats.maxHp * 0.72);
  game.player.x = 470;
  game.player.y = 400;
  game.player.angle = -0.4;
  game.score = score;
  game.kills = kills;
  game.combo = { count: 7, timer: 2.1, mult: 1.7 };
  game.runTime = 180 + wave * 40;

  // A few upgrades already chosen, so the moth reads as grown.
  const grown = ['damage', 'firerate', 'multishot', 'magnet', 'speed'];
  for (const id of grown.slice(0, Math.min(level - 1, grown.length))) {
    const def = game.upgrades.available().find((u) => u.id === id);
    if (def) game.upgrades.apply(def, game.player);
  }

  // The swarm: a spread of kinds at staged distances.
  const staging = [
    ['wisp', 820, 180], ['wisp', 940, 320], ['wisp', 880, 520],
    ['wisp', 220, 160], ['spitter', 1010, 240], ['spitter', 180, 480],
    ['brute', 1080, 420], ['splitter', 700, 150], ['splitter', 300, 580],
    ['dasher', 760, 560], ['dasher', 1020, 120], ['wisp', 620, 620],
  ];
  for (const [kind, x, y] of staging) {
    game.enemies.spawn(kind, x, y, wave, true);
  }
  // Some foes already hurt, so health bars show.
  for (const e of game.enemies.list.slice(0, 5)) {
    e.hp = Math.round(e.maxHp * (0.4 + rng() * 0.4));
  }
  // One dasher mid-telegraph.
  const dasher = game.enemies.list.find((e) => e.kind === 'dasher');
  if (dasher) dasher.state.telegraph = 0.4;

  // Bolts in flight toward the swarm.
  for (let i = 0; i < 5; i++) {
    const a = -0.5 + i * 0.22;
    game.bullets.firePlayer(500 + i * 26, 392 - i * 8, a, {
      speed: 640, damage: 12, radius: 5, life: 0.9, pierce: 1, crit: i === 2, burn: 0,
    });
  }
  // A spitter orb arcing in.
  game.bullets.fireEnemy(980, 260, Math.PI - 0.3, 240, 8);

  // Embers scattered near the moth.
  for (let i = 0; i < 9; i++) {
    const a = rng() * Math.PI * 2;
    const r = 60 + rng() * 130;
    game.gems.push({
      x: game.player.x + Math.cos(a) * r,
      y: game.player.y + Math.sin(a) * r,
      vx: 0, vy: 0, value: 1, bob: rng() * Math.PI * 2,
    });
  }

  // Kill flashes and drifting embers for life.
  game.particles.burst(880, 300, '#8b7bd8', 16, 200, 0.8, 4);
  game.particles.burst(700, 150, '#6d28d9', 10, 160, 0.7, 3);
  game.particles.addText(880, 280, '24', '#ffd166', 16);
  game.particles.addText(700, 130, 'CRIT 48', '#ffffff', 18);
  game.particles.trail(470, 400, '#ffd166', 5);

  // Advance a few fixed steps so motion blur of life is in the frame, but
  // keep the staged tableau: enemies drift, bolts fly, nothing resolves.
  game.state = 'playing';
  for (let i = 0; i < 18; i++) {
    game.time += 1 / 60;
    game.particles.update(1 / 60);
    game.bullets.update(1 / 60);
    for (const e of game.enemies.list) {
      e.x += Math.sin(i * 0.1 + e.id) * 0.4;
      e.y += Math.cos(i * 0.08 + e.id) * 0.4;
    }
  }
}
