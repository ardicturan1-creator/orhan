/** WebAudio ile tamamen prosedürel ses üretimi — harici ses dosyası yok. */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambience: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
let enabled = true;

interface A { c: AudioContext; m: GainNode }

function ac(): A | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.65;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx && master ? { c: ctx, m: master } : null;
}

export function unlockAudio(): void {
  const a = ac();
  if (a && a.c.state === "suspended") void a.c.resume();
}

export function setAudioEnabled(v: boolean): void {
  enabled = v;
  if (master) master.gain.value = v ? 0.65 : 0;
  if (!v) stopAmbience();
}

export function setVolume(v: number): void {
  if (master) master.gain.value = v;
}

function noiseBuffer(c: AudioContext, dur: number): AudioBuffer {
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const b = c.createBuffer(1, len, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function env(g: GainNode, t: number, attack: number, decay: number, peak: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

/** Şut / müdahale: osilatör + gürültü patlaması */
export function sfxKick(power = 1): void {
  if (!enabled) return;
  const a = ac(); if (!a) return;
  const { c, m } = a;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(190 + 130 * power, t);
  o.frequency.exponentialRampToValueAtTime(52, t + 0.14);
  const g = c.createGain();
  env(g, t, 0.004, 0.16, 0.4 * power);
  o.connect(g).connect(m);
  o.start(t); o.stop(t + 0.24);

  const n = c.createBufferSource();
  n.buffer = noiseBuffer(c, 0.09);
  const ng = c.createGain();
  env(ng, t, 0.002, 0.08, 0.22 * power);
  const f = c.createBiquadFilter();
  f.type = "bandpass"; f.frequency.value = 1400; f.Q.value = 0.8;
  n.connect(f).connect(ng).connect(m);
  n.start(t);
}

/** Düdük: iki vuruşlu kare dalga + LFO */
export function sfxWhistle(long = false): void {
  if (!enabled) return;
  const a = ac(); if (!a) return;
  const { c, m } = a;
  const t = c.currentTime;
  const mk = (st: number, dur: number) => {
    const o = c.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(2350, st);
    const lfo = c.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 42;
    const lg = c.createGain();
    lg.gain.value = 130;
    lfo.connect(lg).connect(o.frequency);
    const g = c.createGain();
    env(g, st, 0.012, dur, 0.13);
    const f = c.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 2400; f.Q.value = 6;
    o.connect(f).connect(g).connect(m);
    o.start(st); o.stop(st + dur + 0.06);
    lfo.start(st); lfo.stop(st + dur + 0.06);
  };
  if (long) { mk(t, 0.34); mk(t + 0.4, 0.5); }
  else { mk(t, 0.16); mk(t + 0.22, 0.3); }
}

/** Gol: filtreli gürültü + tezahürat */
export function sfxGoal(): void {
  if (!enabled) return;
  const a = ac(); if (!a) return;
  const { c, m } = a;
  const t = c.currentTime;
  const n = c.createBufferSource();
  n.buffer = noiseBuffer(c, 3.2);
  const f = c.createBiquadFilter();
  f.type = "bandpass"; f.frequency.setValueAtTime(700, t);
  f.frequency.linearRampToValueAtTime(1500, t + 1.2);
  f.Q.value = 0.7;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3, t + 0.18);
  g.gain.setValueAtTime(0.3, t + 2.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
  n.connect(f).connect(g).connect(m);
  n.start(t);

  for (let i = 0; i < 6; i++) {
    const o = c.createOscillator();
    o.type = "sawtooth";
    const base = 170 + Math.random() * 220;
    o.frequency.setValueAtTime(base, t + 0.15 + i * 0.02);
    o.frequency.linearRampToValueAtTime(base * 1.25, t + 1.5);
    o.frequency.linearRampToValueAtTime(base * 0.8, t + 3.0);
    const og = c.createGain();
    env(og, t + 0.15, 0.3, 2.7, 0.05);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 1100;
    o.connect(lp).connect(og).connect(m);
    o.start(t + 0.15); o.stop(t + 3.2);
  }
}

/** Kurtarış / kaçırtma */
export function sfxSave(): void {
  if (!enabled) return;
  const a = ac(); if (!a) return;
  const { c, m } = a;
  const t = c.currentTime;
  const n = c.createBufferSource();
  n.buffer = noiseBuffer(c, 0.35);
  const f = c.createBiquadFilter();
  f.type = "bandpass"; f.frequency.setValueAtTime(2600, t);
  f.frequency.exponentialRampToValueAtTime(600, t + 0.3);
  f.Q.value = 2.2;
  const g = c.createGain();
  env(g, t, 0.005, 0.3, 0.3);
  n.connect(f).connect(g).connect(m);
  n.start(t);
}

export function sfxMiss(): void {
  if (!enabled) return;
  const a = ac(); if (!a) return;
  const { c, m } = a;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(600, t);
  o.frequency.exponentialRampToValueAtTime(180, t + 0.5);
  const g = c.createGain();
  env(g, t, 0.02, 0.5, 0.14);
  o.connect(g).connect(m);
  o.start(t); o.stop(t + 0.6);
}

/** Arayüz / oyuncu değişimi: üçgen dalga bip */
export function sfxUi(freq = 660, dur = 0.07): void {
  if (!enabled) return;
  const a = ac(); if (!a) return;
  const { c, m } = a;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(freq, t);
  const g = c.createGain();
  env(g, t, 0.005, dur, 0.13);
  o.connect(g).connect(m);
  o.start(t); o.stop(t + dur + 0.05);
}

export function sfxSub(): void {
  sfxUi(520, 0.08);
  setTimeout(() => sfxUi(780, 0.1), 90);
}

/** Sürekli stadyum ambiyansı — yoğunluk arttıkça ses yükselir (0..1) */
export function startAmbience(): void {
  if (!enabled) return;
  const a = ac(); if (!a) return;
  const { c, m } = a;
  if (ambience) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 3);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = "lowpass"; f.frequency.value = 480; f.Q.value = 0.6;
  const g = c.createGain();
  g.gain.value = 0.035;
  src.connect(f).connect(g).connect(m);
  src.start();
  ambience = { src, gain: g };
}

export function setAmbienceLevel(v: number): void {
  if (!ambience || !ctx) return;
  const target = 0.02 + Math.max(0, Math.min(1, v)) * 0.085;
  ambience.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.6);
}

export function stopAmbience(): void {
  if (!ambience) return;
  try {
    ambience.src.stop();
    ambience.src.disconnect();
    ambience.gain.disconnect();
  } catch { /* yoksay */ }
  ambience = null;
}

export function vibrate(ms: number): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
  } catch { /* yoksay */ }
}
