// MOTHFLAME — everything drawn on the canvas.
// The background is a night garden around the last lantern; the HUD is drawn
// in-canvas so it appears in screenshots exactly as the player sees it.
// Menus (title, level-up, pause, end) are DOM overlays styled in style.css.

import { WORLD, PALETTE, ENEMY_TYPES } from './config.js';
import { drawGlow } from './particles.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.time = 0;
  }

  drawBackground(lanternPulse) {
    const { ctx } = this;
    const { width: W, height: H } = WORLD;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, PALETTE.skyDeep);
    sky.addColorStop(0.55, PALETTE.sky);
    sky.addColorStop(1, '#120d2a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Garden floor: concentric rings around the lantern, fading outward.
    ctx.strokeStyle = PALETTE.groundLine;
    ctx.lineWidth = 2;
    const cx = W / 2;
    const cy = H / 2;
    for (let r = 90; r <= 720; r += 90) {
      ctx.globalAlpha = Math.max(0.08, 0.5 - r / 900);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Faint standing stones around the ring.
    ctx.fillStyle = '#1a1433';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.26;
      const r = 300;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.72;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 2);
      roundRect(ctx, -7, -16, 14, 32, 6);
      ctx.fill();
      ctx.restore();
    }

    // The lantern at the garden's heart, breathing with the moth's light.
    const pulse = 0.85 + 0.15 * Math.sin(lanternPulse);
    drawGlow(ctx, cx, cy, 150 * pulse, '#ffb347', 0.5 * pulse);
    ctx.fillStyle = '#241a3d';
    roundRect(ctx, cx - 16, cy - 26, 32, 52, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    roundRect(ctx, cx - 10, cy - 18, 20, 26, 5);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(cx, cy - 5, 5 + 2 * Math.sin(lanternPulse * 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#241a3d';
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy - 26);
    ctx.lineTo(cx, cy - 40);
    ctx.lineTo(cx + 20, cy - 26);
    ctx.closePath();
    ctx.fill();
  }

  drawVignette() {
    const { ctx } = this;
    const { width: W, height: H } = WORLD;
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.85);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(4,2,12,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  drawGems(gems) {
    const { ctx } = this;
    for (const g of gems) {
      const bob = Math.sin(g.bob) * 2;
      drawGlow(ctx, g.x, g.y + bob, 14, '#5eead4', 0.7);
      ctx.fillStyle = '#a7f3d0';
      ctx.save();
      ctx.translate(g.x, g.y + bob);
      ctx.rotate(g.bob);
      ctx.fillRect(-3.5, -3.5, 7, 7);
      ctx.restore();
    }
  }

  drawPlayer(player, time) {
    const { ctx } = this;
    if (player.dead) return;
    const flicker = player.invuln > 0 && Math.floor(time * 18) % 2 === 0;
    ctx.save();
    ctx.translate(player.x, player.y);
    if (flicker) ctx.globalAlpha = 0.4;

    // The moth's own light: it shrinks as health falls.
    const healthFrac = player.hp / player.stats.maxHp;
    const lightR = 70 + healthFrac * 90;
    drawGlow(ctx, 0, 0, lightR, '#ffb347', 0.55);

    // Ward ring.
    if (player.wardReady) {
      ctx.strokeStyle = '#5eead4';
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 26 + Math.sin(time * 4) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = flicker ? 0.4 : 1;
    }

    // Thorn halo.
    if (player.stats.halo > 0) {
      ctx.strokeStyle = 'rgba(255,154,61,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 58 + player.stats.halo * 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Bank into the flight direction.
    const bank = Math.max(-0.3, Math.min(0.3, player.vx * 0.0006));
    ctx.rotate(bank);

    // Wings: two beating flame wings.
    const flap = Math.sin(player.wingPhase);
    const wingSpread = 0.5 + flap * 0.45;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.rotate(-wingSpread * 0.5);
      const wing = ctx.createLinearGradient(0, 0, 34, 0);
      wing.addColorStop(0, '#ff9a3d');
      wing.addColorStop(0.6, '#ffb347');
      wing.addColorStop(1, '#ffd166');
      ctx.fillStyle = wing;
      ctx.beginPath();
      ctx.moveTo(2, -4);
      ctx.quadraticCurveTo(30, -20 - flap * 6, 38, -4);
      ctx.quadraticCurveTo(30, 12, 4, 8);
      ctx.closePath();
      ctx.fill();
      // Wing spots.
      ctx.fillStyle = 'rgba(122,28,58,0.55)';
      ctx.beginPath();
      ctx.arc(24, -4, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Body.
    ctx.fillStyle = '#3b1d4e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(0, -7, 5, 0, Math.PI * 2);
    ctx.fill();
    // Antennae.
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 1.5;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 3, -11);
      ctx.quadraticCurveTo(side * 9, -20, side * 6, -26);
      ctx.stroke();
      ctx.fillStyle = '#ff9a3d';
      ctx.beginPath();
      ctx.arc(side * 6, -26, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Aim tick toward the cursor while firing.
    if (player.firing) {
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);
      ctx.fillStyle = 'rgba(255,209,102,0.8)';
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.lineTo(34, -4);
      ctx.lineTo(34, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawEnemies(enemies, time) {
    const { ctx } = this;
    for (const p of enemies.portals) {
      const t = 1 - p.timer / 0.6;
      ctx.strokeStyle = '#a855f7';
      ctx.globalAlpha = 0.3 + t * 0.6;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26 * (1 - t) + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const e of enemies.list) {
      const def = ENEMY_TYPES[e.kind];
      const grow = 1 - e.spawnAnim / 0.35;
      const r = e.radius * (0.5 + 0.5 * grow);
      ctx.save();
      ctx.translate(e.x, e.y);

      // Telegraph: dashers flash before they lunge.
      if (e.state.telegraph > 0) {
        ctx.strokeStyle = 'rgba(251,113,133,0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, r + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Gloom body: a dark orb with a violet rim.
      const body = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      body.addColorStop(0, def.color);
      body.addColorStop(1, '#160b26');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Burn: orange flicker on the rim.
      if (e.burnTime > 0) {
        ctx.strokeStyle = '#fb923c';
        ctx.globalAlpha = 0.6 + Math.sin(time * 20) * 0.3;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Eyes: two glowing dots that track the moth.
      const look = Math.atan2(e.vy, e.vx);
      const ex = Math.cos(look) * r * 0.25;
      const ey = Math.sin(look) * r * 0.25;
      ctx.fillStyle = def.eye;
      const eyeR = Math.max(2.5, r * 0.16);
      ctx.beginPath();
      ctx.arc(ex - r * 0.3, ey - r * 0.15, eyeR, 0, Math.PI * 2);
      ctx.arc(ex + r * 0.3, ey - r * 0.15, eyeR, 0, Math.PI * 2);
      ctx.fill();

      // Boss crown: spikes around the rim.
      if (def.boss) {
        ctx.fillStyle = def.color;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + time * 0.3;
          ctx.save();
          ctx.rotate(a);
          ctx.beginPath();
          ctx.moveTo(r - 2, -5);
          ctx.lineTo(r + 12, 0);
          ctx.lineTo(r - 2, 5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // Hit flash.
      if (e.flash > 0) {
        ctx.globalAlpha = Math.min(0.55, e.flash * 4);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Health bar over hurt foes (not for full-health wisps).
      if (e.hp < e.maxHp && !def.boss) {
        const w = r * 2;
        ctx.fillStyle = 'rgba(10,6,24,0.8)';
        ctx.fillRect(-w / 2, -r - 12, w, 5);
        ctx.fillStyle = '#fb7185';
        ctx.fillRect(-w / 2, -r - 12, w * (e.hp / e.maxHp), 5);
      }
      ctx.restore();
    }
  }

  drawHUD(game) {
    const { ctx } = this;
    const p = game.player;
    ctx.textBaseline = 'alphabetic';

    // Top-left: health bar + level badge.
    ctx.fillStyle = 'rgba(10,6,24,0.72)';
    roundRect(ctx, 18, 16, 250, 46, 10);
    ctx.fill();
    ctx.fillStyle = '#f5eedd';
    ctx.font = '700 15px "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`LV ${p.level}`, 30, 38);
    ctx.fillStyle = '#2a1b3d';
    roundRect(ctx, 78, 24, 172, 14, 7);
    ctx.fill();
    const hpFrac = p.hp / p.stats.maxHp;
    ctx.fillStyle = hpFrac > 0.3 ? '#ff9a3d' : '#f43f5e';
    if (hpFrac > 0) {
      roundRect(ctx, 78, 24, 172 * hpFrac, 14, 7);
      ctx.fill();
    }
    ctx.fillStyle = '#f5eedd';
    ctx.font = '700 12px "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(p.hp)} / ${p.stats.maxHp}`, 164, 35);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '12px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillText(`WAVE ${game.waves.wave} / 10`, 30, 56);

    // Top-centre: wave progress + boss bar.
    const boss = game.enemies.boss;
    if (boss) {
      const bw = 420;
      const bx = (WORLD.width - bw) / 2;
      ctx.fillStyle = 'rgba(10,6,24,0.72)';
      roundRect(ctx, bx - 8, 14, bw + 16, 40, 10);
      ctx.fill();
      ctx.fillStyle = '#f5eedd';
      ctx.font = '700 14px "Trebuchet MS", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ENEMY_TYPES[boss.kind].name.toUpperCase(), WORLD.width / 2, 32);
      ctx.fillStyle = '#2a1b3d';
      roundRect(ctx, bx, 38, bw, 10, 5);
      ctx.fill();
      ctx.fillStyle = '#c084fc';
      roundRect(ctx, bx, 38, bw * (boss.hp / boss.maxHp), 10, 5);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(10,6,24,0.72)';
      roundRect(ctx, WORLD.width / 2 - 90, 16, 180, 34, 10);
      ctx.fill();
      ctx.fillStyle = '#f5eedd';
      ctx.font = '700 15px "Trebuchet MS", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        game.waves.active ? `FOES LEFT: ${game.waves.remaining}` : 'THE NIGHT STIRS…',
        WORLD.width / 2,
        38,
      );
    }

    // Top-right: score + combo.
    ctx.fillStyle = 'rgba(10,6,24,0.72)';
    roundRect(ctx, WORLD.width - 268, 16, 250, 46, 10);
    ctx.fill();
    ctx.fillStyle = '#f5eedd';
    ctx.font = '700 20px "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${game.score.toLocaleString('en-US')}`, WORLD.width - 30, 40);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '12px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillText('SCORE', WORLD.width - 30, 56);
    if (game.combo.count >= 2) {
      ctx.fillStyle = '#ffd166';
      ctx.font = '700 15px "Trebuchet MS", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`COMBO x${game.combo.mult.toFixed(1)}`, WORLD.width - 256, 40);
      ctx.fillStyle = '#2a1b3d';
      roundRect(ctx, WORLD.width - 256, 46, 90, 6, 3);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      roundRect(ctx, WORLD.width - 256, 46, 90 * (game.combo.timer / 3), 6, 3);
      ctx.fill();
    }

    // Bottom: XP bar across the width.
    const xpFrac = p.xp / p.xpNext;
    ctx.fillStyle = 'rgba(10,6,24,0.72)';
    ctx.fillRect(0, WORLD.height - 22, WORLD.width, 22);
    ctx.fillStyle = '#2dd4bf';
    ctx.fillRect(0, WORLD.height - 22, WORLD.width * xpFrac, 22);
    ctx.font = '700 12px "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(6,20,16,0.9)';
    ctx.lineWidth = 3;
    ctx.strokeText(`EMBER ${Math.floor(p.xp)} / ${p.xpNext} — NEXT FLAME`, WORLD.width / 2, WORLD.height - 7);
    ctx.fillStyle = '#e6fffa';
    ctx.fillText(`EMBER ${Math.floor(p.xp)} / ${p.xpNext} — NEXT FLAME`, WORLD.width / 2, WORLD.height - 7);

    // Bottom-left: dash cooldown pip: label above, bar below.
    const dashFrac = 1 - p.dashCd / p.stats.dashCooldown;
    ctx.fillStyle = 'rgba(10,6,24,0.72)';
    roundRect(ctx, 18, WORLD.height - 66, 132, 34, 10);
    ctx.fill();
    ctx.fillStyle = p.dashReady ? '#5eead4' : PALETTE.textDim;
    ctx.font = '700 12px "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(p.dashReady ? 'DASH READY [SPACE]' : 'DASH…', 28, WORLD.height - 50);
    ctx.fillStyle = '#2a1b3d';
    roundRect(ctx, 28, WORLD.height - 44, 112, 7, 3);
    ctx.fill();
    ctx.fillStyle = '#5eead4';
    roundRect(ctx, 28, WORLD.height - 44, 112 * dashFrac, 7, 3);
    ctx.fill();

    // Bottom-right: mute + pause hints.
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '12px "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('P pause · M mute · SPACE dash', WORLD.width - 18, WORLD.height - 32);
  }

  drawBanner(banner) {
    if (!banner || banner.timer <= 0) return;
    const { ctx } = this;
    const t = banner.timer / banner.duration;
    const alpha = t > 0.85 ? (1 - t) / 0.15 : t < 0.25 ? t / 0.25 : 1;
    const scale = 1 + (1 - Math.min(1, (banner.duration - banner.timer) * 4)) * 0.15;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.translate(WORLD.width / 2, 150);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.fillStyle = banner.color || '#ffd166';
    ctx.font = '700 44px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillText(banner.title, 0, 0);
    if (banner.sub) {
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = '16px "Trebuchet MS", system-ui, sans-serif';
      ctx.fillText(banner.sub, 0, 30);
    }
    ctx.restore();
  }
}
