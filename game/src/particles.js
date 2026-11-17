// MOTHFLAME — particles, floating combat text and screen shake.
// All the juice lives here: ember bursts, dash trails, hit sparks, drifting
// motes in the background, and the numbers that pop off a foe when it burns.
// Glow is drawn from pre-rendered radial sprites, never shadowBlur per frame,
// so a busy fight stays fast.

import { WORLD } from './config.js';

const glowCache = new Map();

// A soft radial glow sprite, cached per colour and size.
export function glowSprite(color, size = 64) {
  const key = `${color}|${size}`;
  let sprite = glowCache.get(key);
  if (sprite) return sprite;
  sprite = document.createElement('canvas');
  sprite.width = size;
  sprite.height = size;
  const g = sprite.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 0.9;
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  glowCache.set(key, sprite);
  return sprite;
}

export function drawGlow(ctx, x, y, radius, color, alpha = 1) {
  const sprite = glowSprite(color);
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

export class Particles {
  constructor() {
    this.list = [];
    this.texts = [];
    this.motes = [];
    this.trauma = 0;
    for (let i = 0; i < 70; i++) {
      this.motes.push({
        x: Math.random() * WORLD.width,
        y: Math.random() * WORLD.height,
        r: 1 + Math.random() * 2.2,
        drift: 6 + Math.random() * 14,
        sway: Math.random() * Math.PI * 2,
        warm: Math.random() < 0.5,
      });
    }
  }

  burst(x, y, color, count = 12, speed = 180, life = 0.6, size = 3) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.9);
      this.list.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 30,
        life: life * (0.6 + Math.random() * 0.8),
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.9),
        color,
        drag: 2.2,
        gravity: 60,
      });
    }
    if (this.list.length > 500) this.list.splice(0, this.list.length - 500);
  }

  trail(x, y, color, size = 4) {
    this.list.push({
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 20,
      vy: -20 - Math.random() * 30,
      life: 0.45, maxLife: 0.45, size, color, drag: 0.5, gravity: -40,
    });
  }

  ring(x, y, color, maxRadius = 60) {
    this.list.push({
      x, y, vx: 0, vy: 0, life: 0.4, maxLife: 0.4,
      size: 2, color, drag: 0, gravity: 0, ring: true, maxRadius,
    });
  }

  addText(x, y, text, color = '#ffd166', size = 16) {
    this.texts.push({ x, y, text, color, size, life: 0.9, maxLife: 0.9 });
    if (this.texts.length > 40) this.texts.shift();
  }

  addTrauma(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  shakeOffset() {
    const s = this.trauma * this.trauma * 14;
    return {
      x: (Math.random() - 0.5) * 2 * s,
      y: (Math.random() - 0.5) * 2 * s,
    };
  }

  update(dt) {
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      const drag = Math.max(0, 1 - p.drag * dt);
      p.vx *= drag;
      p.vy = p.vy * drag + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (const m of this.motes) {
      m.y -= m.drift * dt;
      m.sway += dt * 0.6;
      m.x += Math.sin(m.sway) * 8 * dt;
      if (m.y < -6) {
        m.y = WORLD.height + 6;
        m.x = Math.random() * WORLD.width;
      }
    }
  }

  drawMotes(ctx) {
    for (const m of this.motes) {
      ctx.globalAlpha = m.warm ? 0.5 : 0.3;
      ctx.fillStyle = m.warm ? '#ffb347' : '#8b7bd8';
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  draw(ctx) {
    for (const p of this.list) {
      const t = p.life / p.maxLife;
      if (p.ring) {
        ctx.globalAlpha = t;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * t + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.maxRadius * (1 - t) + 6, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * t), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      const a = Math.min(1, (t.life / t.maxLife) * 2);
      ctx.globalAlpha = a;
      ctx.font = `700 ${t.size}px "Trebuchet MS", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.list.length = 0;
    this.texts.length = 0;
    this.trauma = 0;
  }
}
