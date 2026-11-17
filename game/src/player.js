// MOTHFLAME — Ember, the moth of living flame.
// Movement, dash, shooting and growth live here. The stats object is what
// upgrades mutate; base values come from config, and the moth's level is
// tracked beside the XP bar the HUD reads.

import { WORLD, PLAYER_BASE, xpForLevel, clamp } from './config.js';

export class Player {
  constructor() {
    this.x = WORLD.width / 2;
    this.y = WORLD.height / 2;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 2; // facing: toward the mouse
    this.wingPhase = 0;
    this.stats = {
      speed: PLAYER_BASE.speed,
      maxHp: PLAYER_BASE.maxHp,
      fireRate: PLAYER_BASE.fireRate,
      damage: PLAYER_BASE.bulletDamage,
      bulletSpeed: PLAYER_BASE.bulletSpeed,
      bulletLife: PLAYER_BASE.bulletLife,
      projectiles: PLAYER_BASE.projectiles,
      pierce: PLAYER_BASE.pierce,
      critChance: PLAYER_BASE.critChance,
      magnet: PLAYER_BASE.magnet,
      dashCooldown: PLAYER_BASE.dashCooldown,
      xpMult: 1,
      halo: 0,
      ward: 0,
      burn: 0,
    };
    this.hp = this.stats.maxHp;
    this.level = 1;
    this.xp = 0;
    this.xpNext = xpForLevel(1);
    this.fireTimer = 0;
    this.dashTimer = 0; // time left in the dash itself
    this.dashCd = 0; // time until the next dash is ready
    this.dashDirX = 1;
    this.dashDirY = 0;
    this.invuln = 0;
    this.wardCd = 0; // ward recharge
    this.wardReady = false;
    this.haloTimer = 0;
    this.dead = false;
  }

  get radius() {
    return PLAYER_BASE.radius;
  }

  get dashReady() {
    return this.dashCd <= 0;
  }

  heal(amount) {
    this.hp = Math.min(this.stats.maxHp, this.hp + amount);
  }

  // Returns true if the hit landed (false when invulnerable or warded).
  takeDamage(amount) {
    if (this.invuln > 0 || this.dashTimer > 0 || this.dead) return false;
    if (this.wardReady) {
      this.wardReady = false;
      this.wardCd = this.stats.ward;
      this.invuln = 0.8;
      return 'ward';
    }
    this.hp -= amount;
    this.invuln = PLAYER_BASE.invulnTime;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
    return true;
  }

  // Returns the number of levels gained.
  gainXp(amount) {
    this.xp += amount * this.stats.xpMult;
    let gained = 0;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level += 1;
      this.xpNext = xpForLevel(this.level);
      gained += 1;
    }
    return gained;
  }

  startDash(dx, dy) {
    if (!this.dashReady || this.dead) return false;
    const len = Math.hypot(dx, dy) || 1;
    this.dashDirX = dx / len;
    this.dashDirY = dy / len;
    this.dashTimer = PLAYER_BASE.dashTime;
    this.dashCd = this.stats.dashCooldown;
    return true;
  }

  update(dt, input, fire) {
    if (this.dead) return;
    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.fireTimer = Math.max(0, this.fireTimer - dt);
    if (this.wardCd > 0) {
      this.wardCd -= dt;
      if (this.wardCd <= 0 && this.stats.ward > 0) this.wardReady = true;
    }

    // Face the mouse; the wings beat faster while moving.
    this.angle = Math.atan2(input.mouse.y - this.y, input.mouse.x - this.x);
    const axes = input.moveAxes();
    const moving = axes.x !== 0 || axes.y !== 0;
    this.wingPhase += dt * (moving ? 22 : 11);

    if (input.dashPressed) {
      const dx = moving ? axes.x : Math.cos(this.angle);
      const dy = moving ? axes.y : Math.sin(this.angle);
      if (this.startDash(dx, dy)) fire('dash');
    }

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.vx = this.dashDirX * PLAYER_BASE.dashSpeed;
      this.vy = this.dashDirY * PLAYER_BASE.dashSpeed;
    } else {
      const targetVx = axes.x * this.stats.speed;
      const targetVy = axes.y * this.stats.speed;
      const blend = Math.min(1, dt * 12);
      this.vx += (targetVx - this.vx) * blend;
      this.vy += (targetVy - this.vy) * blend;
    }
    this.x = clamp(this.x + this.vx * dt, 24, WORLD.width - 24);
    this.y = clamp(this.y + this.vy * dt, 24, WORLD.height - 24);

    // Hold to shoot: a spread of flame bolts toward the cursor.
    if (input.firing && this.fireTimer <= 0) {
      this.fireTimer = 1 / this.stats.fireRate;
      fire('shoot');
    }
  }

  // The angles of one volley: the centre bolt plus a symmetric spread.
  volleyAngles() {
    const n = this.stats.projectiles;
    const spread = 0.14;
    const angles = [];
    for (let i = 0; i < n; i++) {
      angles.push(this.angle + (i - (n - 1) / 2) * spread);
    }
    return angles;
  }
}
