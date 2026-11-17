// MOTHFLAME — boot and the fixed-step loop.
// The simulation runs at a fixed 60 Hz with an accumulator, so the game
// plays the same on any display; rendering follows every animation frame.
// ?shot=<scene>&seed=<n> stages a deterministic screenshot scene instead
// of the title screen.

import { Game } from './game.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = 1280;
canvas.height = 720;

const game = new Game(canvas);
window.__mothflame = game;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') || 1);

const STEP = 1 / 60;
let last = performance.now();
let acc = 0;

function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    game.update(STEP);
    acc -= STEP;
    steps += 1;
  }
  if (steps === 5) acc = 0;
  game.draw();
  requestAnimationFrame(frame);
}

if (shot) {
  // Screenshot mode: stage the scene once, then keep rendering it.
  setupShot(game, shot, seed);
  requestAnimationFrame(frame);
} else {
  requestAnimationFrame(frame);
}
