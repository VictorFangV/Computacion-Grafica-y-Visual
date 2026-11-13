let ctx = null;

export function initAudio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
}

function tone({ type = 'sine', f0, f1 = f0, dur = 0.15, vol = 0.2, delay = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + dur);
}

function noise({ dur = 0.15, vol = 0.3, cut = 2000 }) {
  if (!ctx) return;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start();
}

export const sfx = {
  pistol() { noise({ dur: 0.12, vol: 0.35, cut: 3000 }); tone({ type: 'square', f0: 320, f1: 60, dur: 0.1, vol: 0.12 }); },
  shotgun() { noise({ dur: 0.4, vol: 0.55, cut: 1400 }); tone({ type: 'sawtooth', f0: 150, f1: 35, dur: 0.3, vol: 0.2 }); },
  empty() { tone({ type: 'square', f0: 900, f1: 700, dur: 0.04, vol: 0.1 }); },
  hit() { tone({ type: 'sawtooth', f0: 220, f1: 80, dur: 0.12, vol: 0.15 }); },
  kill() { tone({ type: 'sine', f0: 140, f1: 35, dur: 0.45, vol: 0.3 }); noise({ dur: 0.2, vol: 0.2, cut: 600 }); },
  pickup() { tone({ f0: 520, dur: 0.1, vol: 0.15 }); tone({ f0: 780, dur: 0.14, vol: 0.15, delay: 0.09 }); },
  groan() { tone({ type: 'sawtooth', f0: 95, f1: 55, dur: 0.6, vol: 0.12 }); },
  gameover() { tone({ type: 'sawtooth', f0: 220, f1: 35, dur: 1.2, vol: 0.3 }); },
  win() { [440, 554, 659, 880].forEach((f, i) => tone({ f0: f, dur: 0.25, vol: 0.18, delay: i * 0.14 })); },
};
