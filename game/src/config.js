// MOTHFLAME — tuning, palette and content tables.
// Every number the game balances on lives here, so tuning never means hunting
// through the simulation. Nothing in this file touches the DOM or the canvas.

// The playfield is one fixed logical frame, 1280 by 720, scaled by CSS to fit
// the window. The whole arena is always visible: the judge, and the player,
// see the entire game at a glance.
export const WORLD = { width: 1280, height: 720 };

// Palette: a deep indigo night, warm amber flame, and a cool teal for the
// things the player wants (embers, pickups, the level-up glow).
export const PALETTE = {
  sky: '#0d0a1f',
  skyDeep: '#070512',
  ground: '#14102b',
  groundLine: '#1e1840',
  lanternGlow: '#ffb347',
  flame: '#ff9a3d',
  flameHot: '#ffd166',
  flameDeep: '#f43f5e',
  ember: '#5eead4',
  emberDim: '#2dd4bf',
  text: '#f5eedd',
  textDim: '#b8aed6',
  danger: '#fb7185',
  gloom: '#2a1b3d',
  gloomEdge: '#4c2a6b',
  hp: '#ff9a3d',
  xp: '#5eead4',
  card: '#1b1436',
  cardEdge: '#6d5ba8',
};

// A small seeded generator (mulberry32) so the screenshot scenes and the wave
// director can replay the same fight twice.
export function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

// ---------------------------------------------------------------- player ---

export const PLAYER_BASE = {
  radius: 16,
  speed: 268,
  maxHp: 100,
  fireRate: 3.4, // shots per second
  bulletDamage: 12,
  bulletSpeed: 640,
  bulletRadius: 5,
  bulletLife: 0.9, // seconds before a flame bolt fades
  projectiles: 1,
  pierce: 0,
  critChance: 0.05,
  critMult: 2,
  magnet: 95,
  dashSpeed: 900,
  dashTime: 0.16,
  dashCooldown: 2.4,
  invulnTime: 0.6, // brief grace after taking a hit
};

// XP needed to go from level n to n+1.
export function xpForLevel(level) {
  return 6 + (level - 1) * 5 + (level - 1) * (level - 1);
}

// ---------------------------------------------------------------- enemies --

export const ENEMY_TYPES = {
  wisp: {
    name: 'Wisp',
    hp: 18, speed: 122, radius: 13, damage: 10, xp: 1, score: 50,
    color: '#8b7bd8', eye: '#ffd166',
  },
  wisplet: {
    name: 'Wisplet',
    hp: 8, speed: 178, radius: 9, damage: 6, xp: 1, score: 25,
    color: '#a78bfa', eye: '#ffe9a8',
  },
  spitter: {
    name: 'Spitter',
    hp: 32, speed: 86, radius: 15, damage: 8, xp: 2, score: 100,
    color: '#c084fc', eye: '#f0abfc',
    shootCooldown: 2.2, shootRange: 460, preferRange: 270,
  },
  brute: {
    name: 'Brute',
    hp: 130, speed: 58, radius: 26, damage: 22, xp: 4, score: 200,
    color: '#7c5cd6', eye: '#fb7185',
  },
  splitter: {
    name: 'Splitter',
    hp: 48, speed: 96, radius: 18, damage: 12, xp: 3, score: 150,
    color: '#6d28d9', eye: '#fda4af',
    children: 3,
  },
  dasher: {
    name: 'Dasher',
    hp: 28, speed: 104, radius: 14, damage: 14, xp: 2, score: 125,
    color: '#9333ea', eye: '#fde68a',
    dashTelegraph: 0.55, dashSpeed: 540, dashTime: 0.34, dashCooldown: 2.6,
  },
  warden: {
    name: 'Hollow Warden',
    hp: 950, speed: 56, radius: 46, damage: 25, xp: 25, score: 1500,
    color: '#5b21b6', eye: '#fb7185', boss: true,
    burstCooldown: 3.0, burstCount: 8, summonCooldown: 6.0,
  },
  herald: {
    name: 'The Gloom Herald',
    hp: 1900, speed: 66, radius: 54, damage: 30, xp: 50, score: 5000,
    color: '#4c1d95', eye: '#f43f5e', boss: true,
    burstCooldown: 2.5, burstCount: 12, summonCooldown: 5.0,
  },
};

// Enemy strength grows a little every wave, so later waves stay dangerous
// even with a levelled-up moth.
export function waveHpScale(wave) {
  return 1 + (wave - 1) * 0.09;
}
export function waveSpeedScale(wave) {
  return Math.min(1.35, 1 + (wave - 1) * 0.02);
}

// ----------------------------------------------------------------- waves ---

// Each wave lists what trickles in. Boss waves name the boss; the director
// adds a slow trickle of wisps beside it so the arena never feels empty.
export const WAVES = [
  { composition: { wisp: 8 } },
  { composition: { wisp: 12, spitter: 2 } },
  { composition: { wisp: 10, spitter: 4, splitter: 2 } },
  { composition: { wisp: 14, spitter: 4, dasher: 3, brute: 1 } },
  { boss: 'warden', composition: { wisp: 6 } },
  { composition: { wisp: 16, spitter: 6, splitter: 4, brute: 2 } },
  { composition: { wisp: 18, dasher: 6, spitter: 4, splitter: 2, brute: 3 } },
  { composition: { wisp: 20, spitter: 8, dasher: 6, brute: 4 } },
  { composition: { wisp: 24, dasher: 8, spitter: 6, splitter: 4, brute: 4 } },
  { boss: 'herald', composition: { wisp: 8, dasher: 2 } },
];

export const TOTAL_WAVES = WAVES.length;
export const WAVE_BREATHER = 3.0; // seconds between waves
export const WAVE_CLEAR_BONUS = 100; // times the wave number

// -------------------------------------------------------------- upgrades ---

// One upgrade per level-up choice. max is how many times it can stack;
// weight tilts how often it is offered.
export const UPGRADES = [
  {
    id: 'damage', name: 'Kindled Shot', max: 5, weight: 10,
    icon: '✦',
    blurb: '+25% flame damage.',
    apply: (s) => { s.damage *= 1.25; },
  },
  {
    id: 'firerate', name: 'Rapid Wings', max: 5, weight: 10,
    icon: '≋',
    blurb: '+20% fire rate.',
    apply: (s) => { s.fireRate *= 1.2; },
  },
  {
    id: 'multishot', name: 'Twin Flames', max: 3, weight: 7,
    icon: '❖',
    blurb: '+1 flame bolt per shot.',
    apply: (s) => { s.projectiles += 1; },
  },
  {
    id: 'pierce', name: 'Piercing Light', max: 3, weight: 7,
    icon: '➶',
    blurb: 'Bolts pierce +1 foe.',
    apply: (s) => { s.pierce += 1; },
  },
  {
    id: 'speed', name: 'Swift Flight', max: 4, weight: 8,
    icon: '➤',
    blurb: '+12% flight speed.',
    apply: (s) => { s.speed *= 1.12; },
  },
  {
    id: 'vitality', name: 'Warm Heart', max: 5, weight: 9,
    icon: '♥',
    blurb: '+25 max health, heal 25.',
    apply: (s, p) => { s.maxHp += 25; p.heal(25); },
  },
  {
    id: 'magnet', name: 'Ember Magnet', max: 3, weight: 7,
    icon: '◎',
    blurb: '+60% ember pickup radius.',
    apply: (s) => { s.magnet *= 1.6; },
  },
  {
    id: 'dash', name: 'Quick Dash', max: 3, weight: 7,
    icon: '↯',
    blurb: 'Dash recharges 30% faster.',
    apply: (s) => { s.dashCooldown *= 0.7; },
  },
  {
    id: 'crit', name: 'Critical Spark', max: 4, weight: 8,
    icon: '✧',
    blurb: '+12% critical chance (double damage).',
    apply: (s) => { s.critChance += 0.12; },
  },
  {
    id: 'rich', name: 'Rich Embers', max: 3, weight: 6,
    icon: '⬢',
    blurb: 'Embers are worth +30% XP.',
    apply: (s) => { s.xpMult *= 1.3; },
  },
  {
    id: 'velocity', name: 'Long Flame', max: 3, weight: 6,
    icon: '➔',
    blurb: '+25% bolt speed and range.',
    apply: (s) => { s.bulletSpeed *= 1.25; s.bulletLife *= 1.25; },
  },
  {
    id: 'halo', name: 'Thorn Halo', max: 3, weight: 6,
    icon: '◉',
    blurb: 'A burning halo sears nearby foes.',
    apply: (s) => { s.halo += 1; },
  },
  {
    id: 'bulwark', name: 'Bulwark', max: 2, weight: 5,
    icon: '⬣',
    blurb: 'A ward blocks one hit every 18 seconds.',
    apply: (s) => { s.ward = 18; },
  },
  {
    id: 'ignite', name: 'Searing Rounds', max: 3, weight: 6,
    icon: '♨',
    blurb: 'Bolts ignite foes, burning them over time.',
    apply: (s) => { s.burn += 1; },
  },
];

// Combo: kills chained inside the window raise the score multiplier.
export const COMBO_WINDOW = 3.0;
export const COMBO_STEP = 0.1;
export const COMBO_MAX_MULT = 3.0;
