// MOTHFLAME — the Gloom: six foe kinds and two bosses.
// Each enemy is a plain object with a kind, a behaviour tick and a small
// state bag; the behaviours are one function per kind so a new foe is one
// more branch, not a new class. Enemies arrive through a spawn portal that
// telegraphs them for a beat before they can act.

import { WORLD, ENEMY_TYPES, waveHpScale, waveSpeedScale, clamp } from './config.js';

let nextId = 1;

export class Enemies {
  constructor() {
    this.list = [];
    this.portals = []; // pending spawns: {x, y, kind, timer}
  }

  spawn(kind, x, y, wave = 1, instant = false) {
    if (instant) {
      this.list.push(this._make(kind, x, y, wave));
      return;
    }
    this.portals.push({ x, y, kind, wave, timer: 0.6 });
  }

  _make(kind, x, y, wave) {
    const def = ENEMY_TYPES[kind];
    const hp = Math.round(def.hp * waveHpScale(wave));
    return {
      id: nextId++,
      kind,
      x, y,
      vx: 0, vy: 0,
      hp, maxHp: hp,
      speed: def.speed * waveSpeedScale(wave) * (0.92 + Math.random() * 0.16),
      radius: def.radius,
      damage: def.damage,
      xp: def.xp,
      score: def.score,
      dead: false, // set on the killing blow; corpses stop taking hits
      paid: false, // set once the kill has paid out score and embers
      flash: 0, // white hit-flash timer
      burn: 0, // burn damage per second
      burnTime: 0,
      slow: 0,
      state: {},
      spawnAnim: 0.35,
    };
  }

  spawnAtEdge(kind, wave, rng = Math.random) {
    const edge = Math.floor(rng() * 4);
    const m = 30;
    let x;
    let y;
    if (edge === 0) { x = m + rng() * (WORLD.width - 2 * m); y = m; }
    else if (edge === 1) { x = m + rng() * (WORLD.width - 2 * m); y = WORLD.height - m; }
    else if (edge === 2) { x = m; y = m + rng() * (WORLD.height - 2 * m); }
    else { x = WORLD.width - m; y = m + rng() * (WORLD.height - 2 * m); }
    this.spawn(kind, x, y, wave);
  }

  get boss() {
    return this.list.find((e) => ENEMY_TYPES[e.kind].boss);
  }

  get aliveCount() {
    return this.list.length + this.portals.length;
  }

  // Damage an enemy; returns true only on the killing blow, so a corpse
  // hit by a second bolt in the same frame pays out just once.
  hurt(enemy, amount, crit) {
    if (enemy.dead) return false;
    enemy.hp -= amount;
    enemy.flash = 0.12;
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.dead = true;
      return true;
    }
    return false;
  }

  ignite(enemy, burnDps, seconds) {
    enemy.burn = Math.max(enemy.burn, burnDps);
    enemy.burnTime = Math.max(enemy.burnTime, seconds);
  }

  // events: { onShoot(x, y, angle, speed, damage), onSplit(x, y), onBossDeath }
  update(dt, player, events) {
    for (let i = this.portals.length - 1; i >= 0; i--) {
      const p = this.portals[i];
      p.timer -= dt;
      if (p.timer <= 0) {
        this.list.push(this._make(p.kind, p.x, p.y, p.wave));
        this.portals.splice(i, 1);
      }
    }

    for (const e of this.list) {
      e.flash = Math.max(0, e.flash - dt);
      e.spawnAnim = Math.max(0, e.spawnAnim - dt);
      if (e.burnTime > 0) {
        e.burnTime -= dt;
        e.hp -= e.burn * dt;
        // Burn deaths pay out at reap time (see game.js), not here.
        if (e.hp <= 0) { e.hp = 0; e.dead = true; }
      }
      if (e.dead) continue;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d;
      const uy = dy / d;
      const def = ENEMY_TYPES[e.kind];
      const st = e.state;

      switch (e.kind) {
        case 'wisp':
        case 'wisplet':
        case 'brute': {
          // Straight chase, with a little wobble so the swarm feels alive.
          const wobble = e.kind === 'brute' ? 0 : Math.sin(performance.now() / 300 + e.id) * 0.25;
          const px = -uy * wobble;
          const py = ux * wobble;
          e.vx = (ux + px) * e.speed;
          e.vy = (uy + py) * e.speed;
          break;
        }
        case 'splitter': {
          e.vx = ux * e.speed;
          e.vy = uy * e.speed;
          break;
        }
        case 'spitter': {
          // Keep a preferred distance, then shoot.
          const want = def.preferRange;
          const dir = d > want + 40 ? 1 : d < want - 60 ? -1 : 0;
          e.vx = ux * e.speed * dir + -uy * Math.sin(performance.now() / 700 + e.id) * 40;
          e.vy = uy * e.speed * dir + ux * Math.sin(performance.now() / 700 + e.id) * 40;
          st.shootCd = (st.shootCd ?? 1.2) - dt;
          if (st.shootCd <= 0 && d < def.shootRange) {
            st.shootCd = def.shootCooldown;
            events.onShoot(e.x, e.y, Math.atan2(dy, dx), 240, e.damage);
          }
          break;
        }
        case 'dasher': {
          st.cd = (st.cd ?? 1.0) - dt;
          if (st.dashing > 0) {
            st.dashing -= dt;
            e.vx = st.dashX * def.dashSpeed;
            e.vy = st.dashY * def.dashSpeed;
          } else if (st.telegraph > 0) {
            st.telegraph -= dt;
            e.vx = 0;
            e.vy = 0;
            if (st.telegraph <= 0) {
              st.dashing = def.dashTime;
              st.dashX = ux;
              st.dashY = uy;
            }
          } else {
            e.vx = ux * e.speed;
            e.vy = uy * e.speed;
            if (st.cd <= 0 && d < 340 && d > 60) {
              st.telegraph = def.dashTelegraph;
              st.cd = def.dashCooldown;
            }
          }
          break;
        }
        case 'warden':
        case 'herald': {
          // Bosses drift toward the moth and fire radial bursts; the Herald
          // adds aimed spreads and a faster second phase under half health.
          const enraged = e.hp < e.maxHp * 0.5;
          const burstCd = def.burstCooldown * (enraged ? 0.7 : 1);
          const speed = e.speed * (enraged ? 1.25 : 1);
          e.vx = ux * speed;
          e.vy = uy * speed;
          st.burstCd = (st.burstCd ?? 2.0) - dt;
          if (st.burstCd <= 0) {
            st.burstCd = burstCd;
            const n = def.burstCount + (enraged ? 4 : 0);
            const offset = Math.random() * Math.PI * 2;
            for (let i = 0; i < n; i++) {
              events.onShoot(e.x, e.y, offset + (i / n) * Math.PI * 2, 200, e.damage * 0.6);
            }
            if (e.kind === 'herald') {
              const base = Math.atan2(dy, dx);
              for (const off of [-0.22, 0, 0.22]) {
                events.onShoot(e.x, e.y, base + off, 300, e.damage * 0.7);
              }
            }
          }
          st.summonCd = (st.summonCd ?? 3.0) - dt;
          if (st.summonCd <= 0) {
            st.summonCd = def.summonCooldown;
            events.onSummon(e.x, e.y, e.kind === 'herald' ? 3 : 2);
          }
          break;
        }
        default:
          e.vx = ux * e.speed;
          e.vy = uy * e.speed;
      }

      e.x = clamp(e.x + e.vx * dt, e.radius, WORLD.width - e.radius);
      e.y = clamp(e.y + e.vy * dt, e.radius, WORLD.height - e.radius);
    }
  }

  // Remove the dead; returns them so the game can pay out score and embers.
  // Splitters leave children behind through the callback.
  reap(onSplit) {
    const dead = [];
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (e.hp <= 0) {
        this.list.splice(i, 1);
        dead.push(e);
        if (e.kind === 'splitter' && onSplit) onSplit(e);
      }
    }
    return dead;
  }

  clear() {
    this.list.length = 0;
    this.portals.length = 0;
  }
}
