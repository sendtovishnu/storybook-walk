// src/audio.js — tiny WebAudio ambience: a soft chord pad per mood and a chime for hotspots. No assets.
let ctx = null, master = null, padGain = null, padNodes = [], muted = false;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

const CHORDS = {
  dawn:  [261.6, 329.6, 392.0, 523.3],
  day:   [293.7, 370.0, 440.0, 587.3],
  dusk:  [246.9, 311.1, 370.0, 493.9],
  night: [220.0, 261.6, 329.6, 440.0],
};

export function startPad(time) {
  try {
    if (!ensure()) return;
    stopPad();
    const g = ctx.createGain(); g.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 820;
    g.connect(lp); lp.connect(master);
    (CHORDS[time] || CHORDS.day).forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i % 2 ? 'sine' : 'triangle'; o.frequency.value = f / 2;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + i * 0.03;
      const lg = ctx.createGain(); lg.gain.value = 2.5; lfo.connect(lg); lg.connect(o.detune);
      const og = ctx.createGain(); og.gain.value = 0.11; o.connect(og); og.connect(g);
      o.start(); lfo.start(); padNodes.push(o, lfo);
    });
    g.gain.linearRampToValueAtTime(1, ctx.currentTime + 3.5);
    padGain = g;
  } catch (e) { /* audio is a garnish */ }
}

export function stopPad() {
  try {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (padGain) { padGain.gain.cancelScheduledValues(t); padGain.gain.setValueAtTime(padGain.gain.value, t); padGain.gain.linearRampToValueAtTime(0, t + 1.2); }
    padNodes.forEach((n) => { try { n.stop(t + 1.4); } catch (e) {} });
    padNodes = []; padGain = null;
  } catch (e) {}
}

export function chime() {
  try {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const f = [523.3, 659.3, 784.0, 1046.5][Math.floor(Math.random() * 4)];
    [f, f * 2].forEach((freq, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(i ? 0.06 : 0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 1.4);
    });
  } catch (e) {}
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.1);
  return muted;
}
