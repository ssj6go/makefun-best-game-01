// MOTHFLAME — the game itself: state machine, collisions, scoring, screens.
// This file owns the run: title, play, level-up, pause, victory and defeat.
// The simulation pieces (player, enemies, bullets, waves) live in their own
// files; here they meet — shots hit foes, foes touch the moth, embers fly
// home, and the score, combo and banners answer every action.

import { WORLD, PALETTE, ENEMY_TYPES, TOTAL_WAVES, WAVE_CLEAR_BONUS, COMBO_WINDOW, COMBO_STEP, COMBO_MAX_MULT } from './config.js';
import { Player } from './player.js';
import { Enemies } from './enemies.js';
import { Bullets } from './bullets.js';
import { Particles } from './particles.js';
import { WaveDirector } from './waves.js';
import { UpgradePool } from './upgrades.js';
import { Renderer } from './render.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';

const BEST_KEY = 'mothflame.best.v1';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.renderer = new Renderer(this.ctx);
    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    this.player = new Player();
    this.enemies = new Enemies();
    this.bullets = new Bullets();
    this.particles = new Particles();
    this.waves = new WaveDirector(this.enemies);
    this.upgrades = new UpgradePool();

    this.state = 'title';
    this.time = 0; // wall time for animation
    this.runTime = 0; // time in this run, for the stats screen
    this.score = 0;
    this.kills = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.combo = { count: 0, timer: 0, mult: 1 };
    this.gems = [];
    this.banner = null;
    this.pendingLevels = 0;
    this.offers = [];
    this.endTimer = 0;
    this.titleOrbit = 0;
    this.titleOrbitRx = 210; // attract-mode orbit radii (the title shot
    this.titleOrbitRy = 130; // widens them so the moth shows beside the panel)
    this.best = this.loadBest();

    this.input.onFirstGesture = () => {
      this.audio.ensure();
      this.audio.startMusic();
    };

    this.bindDom();
    this.showTitle();
  }

  loadBest() {
    try {
      const raw = localStorage.getItem(BEST_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage unavailable: play without it */ }
    return { score: 0, wave: 0, wins: 0 };
  }

  saveBest() {
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(this.best));
    } catch (e) { /* ignore */ }
  }

  // ------------------------------------------------------------ DOM wiring -

  $(id) {
    return document.getElementById(id);
  }

  bindDom() {
    this.$('btn-start').addEventListener('click', () => {
      this.audio.ensure();
      this.audio.click();
      this.audio.startMusic();
      this.startRun();
    });
    this.$('btn-again').addEventListener('click', () => {
      this.audio.click();
      this.startRun();
    });
    this.$('btn-resume').addEventListener('click', () => {
      this.audio.click();
      this.resume();
    });
    this.$('btn-restart-pause').addEventListener('click', () => {
      this.audio.click();
      this.startRun();
    });
    this.$('btn-mute').addEventListener('click', () => this.toggleMute());
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') this.toggleMute();
      if (e.code === 'KeyR' && (this.state === 'victory' || this.state === 'defeat')) {
        this.startRun();
      }
      if ((e.code === 'KeyP' || e.code === 'Escape') && this.state === 'playing') this.pause();
      else if ((e.code === 'KeyP' || e.code === 'Escape') && this.state === 'paused') this.resume();
      if (this.state === 'levelup' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
        const i = Number(e.code.slice(-1)) - 1;
        if (this.offers[i]) this.chooseUpgrade(i);
      }
      if (e.code === 'Enter' && this.state === 'title') {
        this.audio.ensure();
        this.startRun();
      }
    });
  }

  toggleMute() {
    this.audio.ensure();
    this.audio.setMuted(!this.audio.muted);
    this.$('btn-mute').textContent = this.audio.muted ? '🔇' : '🔊';
    this.$('btn-mute').setAttribute('aria-label', this.audio.muted ? 'Unmute' : 'Mute');
  }

  hideOverlays() {
    for (const id of ['overlay-title', 'overlay-levelup', 'overlay-pause', 'overlay-end']) {
      this.$(id).classList.add('hidden');
    }
  }

  showTitle() {
    this.state = 'title';
    this.hideOverlays();
    this.$('overlay-title').classList.remove('hidden');
    const bestLine = this.$('best-line');
    if (this.best.score > 0) {
      bestLine.textContent = `Best: ${this.best.score.toLocaleString('en-US')} pts · Wave ${this.best.wave}${this.best.wins ? ` · ${this.best.wins} lantern${this.best.wins > 1 ? 's' : ''} saved` : ''}`;
    } else {
      bestLine.textContent = 'No flights yet — the night is waiting.';
    }
  }

  showBanner(title, sub = '', color = '#ffd166', duration = 2.2) {
    this.banner = { title, sub, color, timer: duration, duration };
  }

  // ------------------------------------------------------------ run control -

  startRun() {
    this.player = new Player();
    this.enemies.clear();
    this.bullets.clear();
    this.particles.clear();
    this.gems = [];
    this.score = 0;
    this.kills = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.combo = { count: 0, timer: 0, mult: 1 };
    this.pendingLevels = 0;
    this.offers = [];
    this.runTime = 0;
    this.banner = null;
    this.upgrades.reset();
    this.waves.startRun();
    this.hideOverlays();
    this.state = 'playing';
    this.audio.startMusic();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.$('overlay-pause').classList.remove('hidden');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.$('overlay-pause').classList.add('hidden');
  }

  openLevelUp() {
    this.state = 'levelup';
    this.offers = this.upgrades.roll(3);
    const wrap = this.$('levelup-cards');
    wrap.innerHTML = '';
    this.offers.forEach((offer, i) => {
      const taken = this.upgrades.count(offer.id);
      const card = document.createElement('button');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-key">${i + 1}</div>
        <div class="card-icon">${offer.icon}</div>
        <div class="card-name">${offer.name}</div>
        <div class="card-blurb">${offer.blurb}</div>
        <div class="card-pips">${'●'.repeat(taken)}${'○'.repeat(offer.max - taken)}</div>`;
      card.addEventListener('click', () => this.chooseUpgrade(i));
      wrap.appendChild(card);
    });
    this.$('overlay-levelup').classList.remove('hidden');
  }

  chooseUpgrade(i) {
    const offer = this.offers[i];
    if (!offer) return;
    this.upgrades.apply(offer, this.player);
    this.audio.levelUp();
    this.pendingLevels -= 1;
    this.$('overlay-levelup').classList.add('hidden');
    if (this.pendingLevels > 0) {
      this.openLevelUp();
    } else {
      this.state = 'playing';
    }
  }

  endRun(won) {
    this.state = won ? 'victory' : 'defeat';
    this.best.score = Math.max(this.best.score, this.score);
    this.best.wave = Math.max(this.best.wave, this.waves.wave);
    if (won) this.best.wins += 1;
    this.saveBest();
    const accuracy = this.shotsFired > 0
      ? Math.round((this.shotsHit / this.shotsFired) * 100)
      : 0;
    const mins = Math.floor(this.runTime / 60);
    const secs = Math.floor(this.runTime % 60);
    this.$('end-title').textContent = won ? 'THE LANTERN ENDURES' : 'THE LIGHT GOES OUT';
    this.$('end-title').className = won ? 'end-title win' : 'end-title lose';
    this.$('end-sub').textContent = won
      ? 'The Gloom Herald is unmade. Dawn will find the garden lit.'
      : 'The Gloom takes another moth. The lantern waits for the next flight.';
    this.$('end-stats').innerHTML = `
      <div class="stat"><span>SCORE</span><strong>${this.score.toLocaleString('en-US')}</strong></div>
      <div class="stat"><span>WAVE</span><strong>${this.waves.wave} / ${TOTAL_WAVES}</strong></div>
      <div class="stat"><span>FOES BURNED</span><strong>${this.kills}</strong></div>
      <div class="stat"><span>LEVEL</span><strong>${this.player.level}</strong></div>
      <div class="stat"><span>TIME</span><strong>${mins}:${String(secs).padStart(2, '0')}</strong></div>
      <div class="stat"><span>ACCURACY</span><strong>${accuracy}%</strong></div>
      <div class="stat best"><span>BEST SCORE</span><strong>${this.best.score.toLocaleString('en-US')}</strong></div>`;
    this.$('overlay-end').classList.remove('hidden');
    if (won) this.audio.victory();
    else this.audio.defeat();
  }

  // -------------------------------------------------------------- simulation -

  update(dt) {
    this.time += dt;
    if (this.banner) this.banner.timer -= dt;

    if (this.state === 'title') {
      // Attract mode: the moth circles the lantern while embers drift.
      this.titleOrbit += dt * 0.5;
      this.player.x = WORLD.width / 2 + Math.cos(this.titleOrbit) * this.titleOrbitRx;
      this.player.y = WORLD.height / 2 + Math.sin(this.titleOrbit) * this.titleOrbitRy;
      this.player.angle = this.titleOrbit + Math.PI / 2;
      this.player.wingPhase += dt * 14;
      this.particles.update(dt);
      if (Math.random() < dt * 6) {
        this.particles.trail(this.player.x, this.player.y, '#ff9a3d', 3);
      }
      return;
    }
    if (this.state !== 'playing') {
      // Level-up, pause and end screens freeze the fight but let the
      // embers settle. Keys pressed here must not leak into the next run.
      this.particles.update(dt * 0.25);
      this.input.endStep();
      return;
    }

    this.runTime += dt;
    const p = this.player;

    // Dash trail.
    if (p.dashTimer > 0 && Math.random() < 0.8) {
      this.particles.trail(p.x, p.y, '#ffd166', 5);
    }

    p.update(dt, this.input, (event) => {
      if (event === 'shoot') this.fireVolley();
      if (event === 'dash') {
        this.audio.dash();
        this.particles.ring(p.x, p.y, '#ffd166', 44);
      }
    });

    // Thorn halo: a slow sear on everything close.
    if (p.stats.halo > 0) {
      p.haloTimer -= dt;
      if (p.haloTimer <= 0) {
        p.haloTimer = 0.5;
        const radius = 58 + p.stats.halo * 8;
        const dps = 6 + p.stats.halo * 6;
        for (const e of this.enemies.list) {
          const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
          if (d2 < (radius + e.radius) ** 2) {
            this.damageEnemy(e, dps * 0.5, false, true);
          }
        }
      }
    }

    // Ward recharge tick.
    if (p.stats.ward > 0 && !p.wardReady && p.wardCd <= 0) p.wardReady = true;

    const waveEvent = this.waves.update(dt);
    if (waveEvent === 'started') {
      if (this.waves.isBossWave) {
        const def = ENEMY_TYPES[WAVES_BOSS[this.waves.wave]];
        this.showBanner(def.name.toUpperCase(), 'The dark gathers — hold the light', '#fb7185', 2.6);
        this.audio.bossRoar();
      } else {
        this.showBanner(`WAVE ${this.waves.wave}`, waveSubtitle(this.waves.wave), '#ffd166', 2.0);
      }
    } else if (waveEvent === 'cleared') {
      const bonus = WAVE_CLEAR_BONUS * this.waves.wave;
      this.score += bonus;
      this.showBanner(`WAVE ${this.waves.wave} CLEARED`, `+${bonus} bonus — catch your breath`, '#5eead4', 2.2);
      this.audio.waveClear();
      this.player.heal(8);
    }

    this.enemies.update(dt, p, {
      onShoot: (x, y, angle, speed, damage) => {
        this.bullets.fireEnemy(x, y, angle, speed, damage);
      },
      onSummon: (x, y, count) => {
        for (let i = 0; i < count; i++) {
          const a = Math.random() * Math.PI * 2;
          this.enemies.spawn('wisp', x + Math.cos(a) * 70, y + Math.sin(a) * 70, this.waves.wave);
        }
      },
    });

    this.bullets.update(dt);
    this.collide();
    this.updateGems(dt);
    this.particles.update(dt);

    // Combo decay.
    if (this.combo.timer > 0) {
      this.combo.timer -= dt;
      if (this.combo.timer <= 0) {
        this.combo.count = 0;
        this.combo.mult = 1;
      }
    }

    if (this.waves.done) {
      this.endRun(true);
      return;
    }

    // Death: a burst, a shake, then the end screen after a beat.
    if (p.dead) {
      if (this.endTimer === 0) {
        this.particles.burst(p.x, p.y, '#ffb347', 60, 320, 1.1, 5);
        this.particles.burst(p.x, p.y, '#f43f5e', 30, 220, 0.9, 4);
        this.particles.ring(p.x, p.y, '#ffd166', 120);
        this.particles.addTrauma(1);
        this.audio.hurt();
      }
      this.endTimer += dt;
      if (this.endTimer > 1.4) {
        this.endTimer = 0;
        this.endRun(false);
      }
      return;
    }

    // Level-ups queue behind the action: open the choice once per frame.
    if (this.pendingLevels > 0) {
      this.openLevelUp();
    }

    this.input.endStep();
  }

  fireVolley() {
    const p = this.player;
    this.shotsFired += 1;
    const crit = Math.random() < p.stats.critChance;
    for (const angle of p.volleyAngles()) {
      this.bullets.firePlayer(p.x, p.y, angle, {
        speed: p.stats.bulletSpeed,
        damage: p.stats.damage * (crit ? 2 : 1),
        radius: 5,
        life: p.stats.bulletLife,
        pierce: p.stats.pierce,
        crit,
        burn: p.stats.burn,
      });
    }
    this.audio.shoot();
    this.particles.trail(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, '#ffd166', 2);
  }

  damageEnemy(enemy, amount, crit, silent = false) {
    const died = this.enemies.hurt(enemy, amount, crit);
    if (!silent) {
      this.shotsHit += 1;
      this.particles.addText(
        enemy.x, enemy.y - enemy.radius - 6,
        String(Math.round(amount)),
        crit ? '#ffffff' : '#ffd166',
        crit ? 19 : 14,
      );
    }
    if (died) this.onEnemyKilled(enemy);
    return died;
  }

  onEnemyKilled(enemy) {
    enemy.paid = true;
    this.kills += 1;
    this.combo.count += 1;
    this.combo.timer = COMBO_WINDOW;
    this.combo.mult = Math.min(COMBO_MAX_MULT, 1 + this.combo.count * COMBO_STEP);
    const gained = Math.round(enemy.score * this.combo.mult);
    this.score += gained;
    this.particles.addText(enemy.x, enemy.y - enemy.radius - 20, `+${gained}`, '#5eead4', 13);
    const def = ENEMY_TYPES[enemy.kind];
    this.particles.burst(enemy.x, enemy.y, def.color, def.boss ? 46 : 14, def.boss ? 320 : 190, 0.7, 4);
    this.particles.burst(enemy.x, enemy.y, '#ffd166', 6, 120, 0.5, 3);
    if (def.boss) {
      this.particles.ring(enemy.x, enemy.y, '#ffd166', 160);
      this.particles.addTrauma(0.8);
      this.showBanner(`${def.name.toUpperCase()} FALLS`, `+${gained} points`, '#5eead4', 2.4);
    }
    this.audio.kill();
    // Embers scatter from the fallen foe.
    for (let i = 0; i < enemy.xp; i++) {
      const a = Math.random() * Math.PI * 2;
      this.gems.push({
        x: enemy.x + Math.cos(a) * 14,
        y: enemy.y + Math.sin(a) * 14,
        vx: Math.cos(a) * 60,
        vy: Math.sin(a) * 60,
        value: 1,
        bob: Math.random() * Math.PI * 2,
      });
    }
    if (this.gems.length > 220) this.gems.splice(0, this.gems.length - 220);
  }

  collide() {
    const p = this.player;

    // Flame bolts against foes.
    for (const b of this.bullets.player) {
      for (const e of this.enemies.list) {
        if (e.spawnAnim > 0 || e.dead || b.hit.has(e.id)) continue;
        const rr = b.radius + e.radius;
        if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 < rr * rr) {
          b.hit.add(e.id);
          if (b.burn > 0) this.enemies.ignite(e, 4 + b.burn * 4, 2.5);
          const died = this.damageEnemy(e, b.damage, b.crit);
          if (!died) this.audio.hit();
          this.particles.burst(b.x, b.y, '#ffd166', 3, 90, 0.3, 2);
          if (b.hit.size > b.pierce) {
            b.life = 0;
            break;
          }
        }
      }
    }

    // Reap the dead (splitters leave children). Foes that died by burn
    // never passed through damageEnemy, so pay them out here — bullet
    // kills are already marked paid and are skipped.
    const dead = this.enemies.reap((splitter) => {
      for (let i = 0; i < ENEMY_TYPES.splitter.children; i++) {
        const a = Math.random() * Math.PI * 2;
        this.enemies.spawn(
          'wisplet',
          splitter.x + Math.cos(a) * 22,
          splitter.y + Math.sin(a) * 22,
          this.waves.wave,
          true,
        );
      }
    });
    for (const e of dead) {
      if (!e.paid) this.onEnemyKilled(e);
    }

    if (p.dead) return;

    // Foes touching the moth.
    for (const e of this.enemies.list) {
      if (e.spawnAnim > 0) continue;
      const rr = p.radius + e.radius - 4;
      if ((p.x - e.x) ** 2 + (p.y - e.y) ** 2 < rr * rr) {
        const result = p.takeDamage(e.damage);
        if (result === 'ward') {
          this.audio.ward();
          this.particles.ring(p.x, p.y, '#5eead4', 70);
          this.particles.addText(p.x, p.y - 30, 'WARDED', '#5eead4', 16);
        } else if (result) {
          this.audio.hurt();
          this.particles.burst(p.x, p.y, '#f43f5e', 16, 240, 0.6, 4);
          this.particles.addTrauma(0.55);
          this.combo.count = 0;
          this.combo.mult = 1;
          // Shove the attacker back so one touch is not a chain of them.
          const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
          e.x += ((e.x - p.x) / d) * 30;
          e.y += ((e.y - p.y) / d) * 30;
        }
      }
    }

    // Gloom orbs against the moth.
    for (const b of this.bullets.enemy) {
      const rr = p.radius + b.radius - 2;
      if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 < rr * rr) {
        b.life = 0;
        const result = p.takeDamage(b.damage);
        if (result === 'ward') {
          this.audio.ward();
          this.particles.ring(p.x, p.y, '#5eead4', 70);
        } else if (result) {
          this.audio.hurt();
          this.particles.burst(p.x, p.y, '#f43f5e', 12, 200, 0.5, 4);
          this.particles.addTrauma(0.4);
          this.combo.count = 0;
          this.combo.mult = 1;
        }
      }
    }
  }

  updateGems(dt) {
    const p = this.player;
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      g.bob += dt * 5;
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < p.stats.magnet) {
        const pull = 620 * (1 - d / (p.stats.magnet * 1.6));
        g.vx += (dx / d) * pull * dt * 8;
        g.vy += (dy / d) * pull * dt * 8;
      }
      g.vx *= Math.max(0, 1 - 3 * dt);
      g.vy *= Math.max(0, 1 - 3 * dt);
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (d < p.radius + 12) {
        this.gems.splice(i, 1);
        const gained = p.gainXp(g.value);
        this.audio.pickup(this.combo.count);
        this.particles.burst(g.x, g.y, '#5eead4', 4, 80, 0.35, 2);
        if (gained > 0) {
          this.pendingLevels += gained;
          this.particles.ring(p.x, p.y, '#5eead4', 80);
        }
      }
    }
  }

  // --------------------------------------------------------------- drawing -

  draw() {
    const { ctx } = this;
    const shake = this.particles.shakeOffset();
    ctx.save();
    ctx.translate(shake.x, shake.y);
    this.renderer.drawBackground(this.time * 1.4);
    this.particles.drawMotes(ctx);
    this.renderer.drawGems(this.gems);
    this.renderer.drawEnemies(this.enemies, this.time);
    this.bullets.draw(ctx);
    this.renderer.drawPlayer(this.player, this.time);
    this.particles.draw(ctx);
    this.renderer.drawVignette();
    ctx.restore();
    if (this.state === 'playing' || this.state === 'levelup' || this.state === 'paused') {
      this.renderer.drawHUD(this);
    }
    this.renderer.drawBanner(this.banner);
  }
}

// Boss per boss-wave, for the banner and the roar.
const WAVES_BOSS = { 5: 'warden', 10: 'herald' };

function waveSubtitle(wave) {
  const lines = {
    1: 'The wisps come first, curious and hungry',
    2: 'Spitters keep their distance — close it',
    3: 'Splitters burst into smaller darks',
    4: 'Dashers telegraph, then lunge',
    6: 'The swarm thickens — spend your embers well',
    7: 'Brutes lead the line now',
    8: 'No quarter from the night',
    9: 'One wave stands between you and the Herald',
  };
  return lines[wave] || 'Hold the light';
}
