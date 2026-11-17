// MOTHFLAME — sound, synthesised live with WebAudio.
// No audio files ship with the game: every effect is a small oscillator or
// noise burst shaped by envelopes, and the music is a slow detuned pad.
// The context is created on the first user gesture (a click or a key), which
// is also when browsers allow audio to start.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.musicNodes = [];
    this.lastShoot = 0;
  }

  // Call from a click or key handler. Safe to call repeatedly.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.master);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  // A short pitched blip: oscillator + pitch slide + gain envelope.
  blip({ type = 'sine', from = 440, to = 220, dur = 0.12, vol = 0.2, when = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // A burst of filtered noise: hits, dashes, explosions.
  noise({ dur = 0.15, vol = 0.25, freq = 1200, q = 1, when = 0, type = 'lowpass' }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  shoot() {
    if (!this.ctx) return;
    // Throttle: the fire rate can outpace pleasant sound.
    const now = this.ctx.currentTime;
    if (now - this.lastShoot < 0.05) return;
    this.lastShoot = now;
    this.blip({ type: 'square', from: 720, to: 340, dur: 0.07, vol: 0.06 });
  }

  hit() {
    this.noise({ dur: 0.06, vol: 0.1, freq: 2400, type: 'highpass' });
  }

  kill() {
    this.blip({ type: 'triangle', from: 520, to: 140, dur: 0.16, vol: 0.16 });
    this.noise({ dur: 0.12, vol: 0.12, freq: 900 });
  }

  pickup(combo) {
    const step = Math.min(combo, 12);
    const base = 660 * Math.pow(1.059, step);
    this.blip({ type: 'sine', from: base, to: base * 1.5, dur: 0.09, vol: 0.12 });
  }

  levelUp() {
    [523, 659, 784, 1047].forEach((f, i) => {
      this.blip({ type: 'triangle', from: f, to: f, dur: 0.22, vol: 0.14, when: i * 0.09 });
    });
  }

  dash() {
    this.noise({ dur: 0.18, vol: 0.16, freq: 3000, type: 'bandpass', q: 2 });
  }

  hurt() {
    this.blip({ type: 'sawtooth', from: 160, to: 55, dur: 0.22, vol: 0.22 });
    this.noise({ dur: 0.18, vol: 0.18, freq: 500 });
  }

  ward() {
    this.blip({ type: 'sine', from: 880, to: 1320, dur: 0.18, vol: 0.16 });
  }

  bossRoar() {
    this.blip({ type: 'sawtooth', from: 90, to: 45, dur: 0.7, vol: 0.25 });
    this.blip({ type: 'sawtooth', from: 95, to: 48, dur: 0.7, vol: 0.2, when: 0.05 });
    this.noise({ dur: 0.5, vol: 0.12, freq: 300 });
  }

  waveClear() {
    [392, 523, 659].forEach((f, i) => {
      this.blip({ type: 'triangle', from: f, to: f, dur: 0.18, vol: 0.12, when: i * 0.08 });
    });
  }

  victory() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => {
      this.blip({ type: 'triangle', from: f, to: f, dur: 0.28, vol: 0.15, when: i * 0.13 });
    });
  }

  defeat() {
    [392, 330, 262, 196].forEach((f, i) => {
      this.blip({ type: 'triangle', from: f, to: f * 0.94, dur: 0.34, vol: 0.15, when: i * 0.18 });
    });
  }

  click() {
    this.blip({ type: 'sine', from: 980, to: 760, dur: 0.06, vol: 0.1 });
  }

  // A slow ambient pad: two detuned triangles through a lowpass, gently
  // breathing via an LFO on the filter. Started once, runs until stopped.
  startMusic() {
    if (!this.ctx || this.musicNodes.length) return;
    const ctx = this.ctx;
    const pad = ctx.createGain();
    pad.gain.value = 0.05;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.6;
    pad.connect(filter);
    filter.connect(this.musicGain);
    const freqs = [110, 164.81, 220, 277.18];
    const oscs = freqs.map((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = (i % 2 === 0 ? 4 : -4);
      o.connect(pad);
      o.start();
      return o;
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    this.musicGain.gain.setTargetAtTime(0.5, ctx.currentTime, 2.0);
    this.musicNodes = [...oscs, lfo, pad, filter];
  }

  stopMusic() {
    if (!this.ctx) return;
    this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    const nodes = this.musicNodes;
    this.musicNodes = [];
    window.setTimeout(() => {
      nodes.forEach((n) => {
        try {
          if (n.stop) n.stop();
        } catch (e) { /* already stopped */ }
        try { n.disconnect(); } catch (e) { /* already gone */ }
      });
    }, 1500);
  }
}
