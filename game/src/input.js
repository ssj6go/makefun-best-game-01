// MOTHFLAME — keyboard and mouse state.
// The game reads this every fixed step; menus read the same keys for their
// shortcuts. Mouse coordinates are mapped into the logical 1280x720 frame,
// whatever size the canvas is drawn at on screen.

import { WORLD } from './config.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.mouse = { x: WORLD.width / 2, y: WORLD.height / 2 - 100, down: false };
    this.onFirstGesture = null;
    this._gestureFired = false;

    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedKeys.add(e.code);
      this._gesture();
      // Keep the page from scrolling on game keys.
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * WORLD.width;
      this.mouse.y = ((e.clientY - rect.top) / rect.height) * WORLD.height;
    };
    this._onMouseDown = (e) => {
      if (e.button === 0) this.mouse.down = true;
      this._gesture();
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) this.mouse.down = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouse.down = false;
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
  }

  _gesture() {
    if (!this._gestureFired && this.onFirstGesture) {
      this._gestureFired = true;
      this.onFirstGesture();
    }
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // True only on the step the key went down; cleared by endStep().
  wasPressed(code) {
    return this.pressedKeys.has(code);
  }

  // Movement axes from WASD or arrows, normalised.
  moveAxes() {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }

  get firing() {
    return this.mouse.down || this.isDown('KeyJ');
  }

  get dashPressed() {
    return this.wasPressed('Space') || this.wasPressed('ShiftLeft') || this.wasPressed('ShiftRight');
  }

  endStep() {
    this.pressedKeys.clear();
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('blur', this._onBlur);
  }
}
