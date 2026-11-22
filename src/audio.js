// All sound is synthesized live with the Web Audio API (no audio files).
let ctx = null, master = null, sfxGain = null, crowdGain = null, noiseBuf = null, crowdFilter = null;
let muted = false;
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.8; sfxGain.connect(comp);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); let b = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 3; }
  // crowd ambience: looped filtered noise with slow swell
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  crowdFilter = ctx.createBiquadFilter(); crowdFilter.type = 'bandpass'; crowdFilter.frequency.value = 700; crowdFilter.Q.value = 0.6;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
  crowdGain = ctx.createGain(); crowdGain.gain.value = 0.0;
  src.connect(crowdFilter); crowdFilter.connect(lp); lp.connect(crowdGain); crowdGain.connect(comp); src.start();
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05); }
export function isMuted() { return muted; }
export function crowdLevel(v) { if (ctx) crowdGain.gain.setTargetAtTime(v * 0.22, ctx.currentTime, 0.4); }

function tone(freq, t, dur, type = 'sine', gain = 0.2, slide = 0, attack = 0.005) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + dur + 0.03);
  return o;
}
function noise(t, dur, freq, gain = 0.2, type = 'highpass', q = 0.7, attack = 0.002) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 1;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = freq; fl.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(sfxGain); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  return fl;
}
const go = (fn) => (...a) => { if (!ctx || muted) return; fn(ctx.currentTime, ...a); };
export const sfx = {
  click: go(t => { tone(900, t, 0.05, 'triangle', 0.12); }),
  bump: go(t => { noise(t, 0.09, 500, 0.5, 'lowpass', 1); tone(150, t, 0.12, 'sine', 0.35, 90); }),
  set: go(t => { noise(t, 0.06, 900, 0.3, 'bandpass', 1.5); tone(260, t, 0.08, 'sine', 0.15, 200); }),
  spike: go((t, power = 1) => {
    noise(t, 0.16, 1800, 0.8 * power, 'highpass', 0.5); noise(t, 0.2, 300, 0.7 * power, 'lowpass', 1);
    tone(110, t, 0.25, 'sine', 0.5 * power, 50);
  }),
  tip: go(t => { noise(t, 0.05, 1200, 0.25, 'bandpass', 2); }),
  serve: go(t => { noise(t, 0.1, 1200, 0.5, 'highpass'); tone(170, t, 0.15, 'sine', 0.35, 100); }),
  floor: go(t => { noise(t, 0.12, 400, 0.6, 'lowpass', 1); tone(90, t, 0.18, 'sine', 0.5, 50); }),
  net: go(t => { noise(t, 0.35, 900, 0.35, 'bandpass', 0.8, 0.02); }),
  block: go(t => { noise(t, 0.12, 900, 0.7, 'bandpass', 1); tone(140, t, 0.15, 'square', 0.15, 80); }),
  whoosh: go(t => { const f = noise(t, 0.3, 400, 0.25, 'bandpass', 2, 0.1); f.frequency.exponentialRampToValueAtTime(2500, t + 0.3); }),
  squeak: go(t => { tone(2200 + Math.random() * 600, t, 0.07, 'sine', 0.05, 2600); }),
  whistle: go((t, long = false) => {
    const o = tone(2850, t, long ? 0.7 : 0.35, 'sine', 0.22, 0, 0.02);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 28; lg.gain.value = 90;
    lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + (long ? 0.75 : 0.4));
    noise(t, long ? 0.7 : 0.35, 3000, 0.05, 'bandpass', 3, 0.02);
  }),
  cheer: go((t, amt = 1) => {
    const f = noise(t, 1.8 * amt + 0.6, 900, 0.45 * amt, 'bandpass', 0.5, 0.25);
    f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1300, t + 0.5);
    for (let i = 0; i < 26 * amt; i++) noise(t + 0.1 + Math.random() * 1.6 * amt, 0.03, 1800 + Math.random() * 1500, 0.12, 'bandpass', 2); // claps
  }),
  groan: go(t => { const f = noise(t, 1.1, 600, 0.3, 'bandpass', 1.2, 0.15); f.frequency.exponentialRampToValueAtTime(220, t + 1.0); }),
  perfect: go(t => { [880, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.05, 0.25, 'triangle', 0.12)); }),
  coin: go(t => { tone(1320, t, 0.08, 'square', 0.08); tone(1760, t + 0.07, 0.15, 'square', 0.08); }),
  buzzer: go(t => { tone(196, t, 0.9, 'sawtooth', 0.15); tone(200, t, 0.9, 'square', 0.08); }),
  fanfare: go(t => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, t + i * 0.12, 0.3, 'triangle', 0.16)); }),
  lose: go(t => { [392, 349, 311, 262].forEach((f, i) => tone(f, t + i * 0.18, 0.35, 'triangle', 0.14)); }),
  // zombie bits: kid-friendly cartoon noises
  moan: go((t, pitch = 1) => {
    const o = tone(110 * pitch, t, 0.9, 'sawtooth', 0.07, 80 * pitch, 0.15);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5; lg.gain.value = 9; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + 0.95);
    const f = noise(t, 0.9, 500 * pitch, 0.12, 'bandpass', 3, 0.2); f.frequency.exponentialRampToValueAtTime(300 * pitch, t + 0.9);
  }),
  bonk: go(t => { tone(520, t, 0.12, 'square', 0.12, 180); noise(t, 0.08, 1500, 0.3, 'bandpass', 1.5); }),
  poof: go(t => { const f = noise(t, 0.45, 300, 0.45, 'bandpass', 0.8, 0.01); f.frequency.exponentialRampToValueAtTime(3200, t + 0.4); [784, 988, 1319].forEach((q, i) => tone(q, t + 0.05 + i * 0.05, 0.18, 'triangle', 0.08)); }),
  rise: go(t => { const f = noise(t, 0.6, 120, 0.35, 'lowpass', 2, 0.1); f.frequency.exponentialRampToValueAtTime(600, t + 0.6); }),
  hurt: go(t => { tone(220, t, 0.5, 'sawtooth', 0.18, 70); noise(t, 0.4, 200, 0.5, 'lowpass', 1); }),
  power: go(t => { [523, 784, 1047, 1568].forEach((f, i) => tone(f, t + i * 0.06, 0.3, 'triangle', 0.13)); }),
  freeze: go(t => { for (let i = 0; i < 8; i++) tone(1800 + i * 260, t + i * 0.03, 0.25, 'sine', 0.05); }),
  wave: go(t => { [392, 523, 659].forEach((f, i) => tone(f, t + i * 0.1, 0.35, 'triangle', 0.14)); }),
  tick: go(t => { tone(1500, t, 0.03, 'square', 0.05); }),
};
