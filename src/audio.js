// audio.js — procedural WebAudio only: no sound files, no network.
export function createAudio() {
  return { ctx: null, muted: false, waveTimer: 0 };
}

function ctx(a) {
  if (!a.ctx) {
    try { a.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (a.ctx && a.ctx.state === 'suspended') a.ctx.resume();
  return a.ctx;
}

function tone(a, freq, dur, type, vol, when = 0, slide = 0) {
  const c = ctx(a); if (!c || a.muted) return;
  const t = c.currentTime + when;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

export function sfxSplash(a) { tone(a, 500, 0.25, 'sine', 0.12, 0, -300); tone(a, 900, 0.15, 'triangle', 0.06, 0.05, -400); }
// Footstep: a soft low thud; alt flips the pitch slightly (left / right foot).
export function sfxStep(a, alt) { tone(a, alt ? 95 : 80, 0.09, 'sine', 0.05, 0, -25); }
// Hurt: a low thud + a falling tone, like being hit by a monster.
export function sfxHurt(a) { tone(a, 140, 0.25, 'sawtooth', 0.12, 0, -70); tone(a, 90, 0.2, 'sine', 0.1, 0.02, -30); }
// Slash: a fast falling sawtooth swing; the pitch differs a little per weapon
// (sword low/heavy, knife high/short, wood dull, torch a whoosh, rod default).
const SLASH_TONE = {
  pedang: [320, 0.18, 'sawtooth', -220], pisau: [700, 0.1, 'sawtooth', -400],
  kayu: [180, 0.14, 'triangle', -80], obor: [500, 0.16, 'sawtooth', -300],
};
export function sfxSlash(a, weapon) {
  const [f, d, t, s] = SLASH_TONE[weapon] || [600, 0.12, 'sawtooth', -350];
  tone(a, f, d, t, 0.1, 0, s);
}
// Bite: two fast high beeps, like an alarm — reel in NOW.
export function sfxBite(a) { tone(a, 1200, 0.08, 'square', 0.08); tone(a, 1500, 0.08, 'square', 0.08, 0.1); }
export function sfxCoin(a) { tone(a, 880, 0.12, 'square', 0.07); tone(a, 1320, 0.2, 'square', 0.07, 0.09); }
export function sfxCatch(a) { tone(a, 523, 0.12, 'triangle', 0.12); tone(a, 659, 0.12, 'triangle', 0.12, 0.1); tone(a, 784, 0.25, 'triangle', 0.12, 0.2); }
export function sfxFail(a) { tone(a, 220, 0.25, 'sawtooth', 0.08, 0, -80); }
export function sfxTalk(a) { tone(a, 660, 0.08, 'sine', 0.08); tone(a, 520, 0.08, 'sine', 0.06, 0.08); }
export function sfxSleep(a) { tone(a, 392, 0.3, 'sine', 0.08); tone(a, 330, 0.3, 'sine', 0.08, 0.25); tone(a, 262, 0.5, 'sine', 0.08, 0.5); }
export function sfxFanfare(a) {
  [523, 659, 784, 1047, 1319].forEach((f, i) => tone(a, f, 0.22, 'triangle', 0.12, i * 0.12));
  tone(a, 1568, 0.5, 'triangle', 0.12, 0.62);
}

export function updateAmbient(a, dt) {
  a.waveTimer -= dt;
  if (a.waveTimer <= 0) { a.waveTimer = 2.5 + Math.random() * 2; tone(a, 180, 1.2, 'sine', 0.02, 0, 60); }
}
