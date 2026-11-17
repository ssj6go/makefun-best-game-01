// MOTHFLAME — projectiles: the moth's flame bolts and the Gloom's orbs.
// Bullets only move and die here; what they hit is the game state's job, so
// this file stays small and the collision rules stay in one place (game.js).

import { WORLD } from './config.js';

export class Bullets {
  constructor() {
    this.player = [];
    this.enemy = [];
  }

  firePlayer(x, y, angle, opts) {
    this.player.push({
      x, y,
      vx: Math.cos(angle) * opts.speed,
      vy: Math.sin(angle) * opts.speed,
      damage: opts.damage,
      radius: opts.radius,
      life: opts.life,
      pierce: opts.pierce,
      crit: opts.crit,
      burn: opts.burn,
      hit: new Set(),
    });
    if (this.player.length > 400) this.player.splice(0, this.player.length - 400);
  }

  fireEnemy(x, y, angle, speed, damage, radius = 7) {
    this.enemy.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage,
      radius,
      life: 6,
    });
    if (this.enemy.length > 300) this.enemy.splice(0, this.enemy.length - 300);
  }

  update(dt) {
    for (let i = this.player.length - 1; i >= 0; i--) {
      const b = this.player[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (
        b.life <= 0 ||
        b.x < -20 || b.x > WORLD.width + 20 ||
        b.y < -20 || b.y > WORLD.height + 20
      ) {
        this.player.splice(i, 1);
      }
    }
    for (let i = this.enemy.length - 1; i >= 0; i--) {
      const b = this.enemy[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (
        b.life <= 0 ||
        b.x < -30 || b.x > WORLD.width + 30 ||
        b.y < -30 || b.y > WORLD.height + 30
      ) {
        this.enemy.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    for (const b of this.player) {
      // A flame bolt reads as a streak along its flight, with a bright head.
      const speed = Math.hypot(b.vx, b.vy) || 1;
      const tx = b.x - (b.vx / speed) * 26;
      const ty = b.y - (b.vy / speed) * 26;
      const grad = ctx.createLinearGradient(tx, ty, b.x, b.y);
      grad.addColorStop(0, 'rgba(255,140,60,0)');
      grad.addColorStop(0.55, 'rgba(255,180,80,0.75)');
      grad.addColorStop(1, '#fff3c4');
      ctx.strokeStyle = grad;
      ctx.lineWidth = b.radius * 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = b.crit ? '#ffffff' : '#ffe9a8';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of this.enemy) {
      const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 2.2);
      grad.addColorStop(0, '#f0abfc');
      grad.addColorStop(0.45, '#a855f7');
      grad.addColorStop(1, 'rgba(88,28,135,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e9d5ff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  clear() {
    this.player.length = 0;
    this.enemy.length = 0;
  }
}
