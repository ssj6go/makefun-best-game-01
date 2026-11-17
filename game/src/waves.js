// MOTHFLAME — the wave director.
// Turns a wave's composition into a trickle of spawns, watches for the clear,
// and hands the game its banners and breather. Boss waves spawn the boss up
// front and keep a thin trickle of wisps beside it.

import { WAVES, TOTAL_WAVES, WAVE_BREATHER, createRng } from './config.js';

export class WaveDirector {
  constructor(enemies) {
    this.enemies = enemies;
    this.wave = 0;
    this.queue = []; // kinds still to spawn, in order
    this.spawnTimer = 0;
    this.spawnInterval = 0.9;
    this.breather = 0;
    this.active = false;
    this.rng = createRng((Math.random() * 1e9) | 0);
    this.bossSpawned = false;
  }

  get isBossWave() {
    return this.wave > 0 && !!WAVES[this.wave - 1].boss;
  }

  get remaining() {
    return this.queue.length + this.enemies.aliveCount;
  }

  startRun(seed) {
    if (seed !== undefined) this.rng = createRng(seed);
    this.wave = 0;
    this.queue = [];
    this.active = false;
    this.breather = 1.2; // a breath before the first wave
  }

  startWave(n) {
    this.wave = n;
    const def = WAVES[n - 1];
    this.queue = [];
    for (const [kind, count] of Object.entries(def.composition)) {
      for (let i = 0; i < count; i++) this.queue.push(kind);
    }
    // Shuffle the queue so the mix arrives unpredictably.
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    this.spawnInterval = Math.max(0.35, 0.95 - n * 0.05);
    this.spawnTimer = 0.4;
    this.active = true;
    this.bossSpawned = false;
    if (def.boss) {
      // The boss enters from the top edge, centre stage.
      this.enemies.spawn(def.boss, 640, 90, n);
      this.bossSpawned = true;
    }
  }

  // Returns 'cleared' when the wave is done, 'boss' when a boss wave starts.
  update(dt) {
    if (!this.active) {
      if (this.breather > 0) {
        this.breather -= dt;
        if (this.breather <= 0 && this.wave < TOTAL_WAVES) {
          this.startWave(this.wave + 1);
          return 'started';
        }
      }
      return null;
    }
    if (this.queue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.spawnInterval;
        // Spawn in small clusters on later waves.
        const batch = this.wave >= 6 ? 2 : 1;
        for (let i = 0; i < batch && this.queue.length > 0; i++) {
          this.enemies.spawnAtEdge(this.queue.shift(), this.wave, this.rng);
        }
      }
    }
    if (this.queue.length === 0 && this.enemies.aliveCount === 0) {
      this.active = false;
      this.breather = WAVE_BREATHER;
      return 'cleared';
    }
    return null;
  }

  get done() {
    return this.wave >= TOTAL_WAVES && !this.active && this.enemies.aliveCount === 0;
  }
}
