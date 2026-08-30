/* ============================================================
 *  BYMEL SOCCER — Prosedürel ses motoru (WebAudio)
 *  Tüm sesler kod ile üretilir, harici dosya yoktur.
 * ============================================================ */

export class SFX {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  enabled = true;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  unlock() {
    this.ensure();
  }

  private noiseBuffer(dur: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.2;
    }
    return buf;
  }

  play(name: string) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    switch (name) {
      case "kick":
      case "tackle": {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(name === "kick" ? 180 : 110, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.12);
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        osc.connect(g).connect(this.master);
        osc.start(t);
        osc.stop(t + 0.16);
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer(0.08);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.22, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        src.connect(ng).connect(this.master);
        src.start(t);
        break;
      }
      case "whistle": {
        for (let i = 0; i < 2; i++) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          const lfo = ctx.createOscillator();
          const lg = ctx.createGain();
          lfo.frequency.value = 22;
          lg.gain.value = 130;
          lfo.connect(lg).connect(osc.frequency);
          osc.type = "square";
          osc.frequency.value = 2350;
          const st = t + i * 0.19;
          g.gain.setValueAtTime(0.0001, st);
          g.gain.linearRampToValueAtTime(0.16, st + 0.02);
          g.gain.setValueAtTime(0.16, st + (i === 0 ? 0.11 : 0.28));
          g.gain.exponentialRampToValueAtTime(0.0001, st + (i === 0 ? 0.13 : 0.32));
          osc.connect(g).connect(this.master);
          osc.start(st);
          lfo.start(st);
          osc.stop(st + 0.34);
          lfo.stop(st + 0.34);
        }
        break;
      }
      case "goal": {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer(3.2);
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.setValueAtTime(400, t);
        f.frequency.linearRampToValueAtTime(1100, t + 0.5);
        f.Q.value = 0.7;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.05, t);
        g.gain.linearRampToValueAtTime(0.5, t + 0.35);
        g.gain.linearRampToValueAtTime(0.28, t + 2.2);
        g.gain.exponentialRampToValueAtTime(0.001, t + 3.2);
        src.connect(f).connect(g).connect(this.master);
        src.start(t);
        // tezahürat
        const osc = ctx.createOscillator();
        const og = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(330, t + 0.4);
        osc.frequency.linearRampToValueAtTime(262, t + 1.6);
        og.gain.setValueAtTime(0.0001, t);
        og.gain.linearRampToValueAtTime(0.09, t + 0.5);
        og.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
        osc.connect(og).connect(this.master);
        osc.start(t);
        osc.stop(t + 1.9);
        break;
      }
      case "save":
      case "miss": {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer(1.1);
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.setValueAtTime(300, t);
        f.frequency.linearRampToValueAtTime(800, t + 0.5);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.02, t);
        g.gain.linearRampToValueAtTime(0.28, t + 0.25);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
        src.connect(f).connect(g).connect(this.master);
        src.start(t);
        break;
      }
      case "switch":
      case "ui": {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(name === "ui" ? 660 : 440, t);
        g.gain.setValueAtTime(0.14, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        osc.connect(g).connect(this.master);
        osc.start(t);
        osc.stop(t + 0.1);
        break;
      }
      default:
        break;
    }
  }

  startAmbience() {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx || !this.master || this.ambience) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(4);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 520;
    f.Q.value = 0.5;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    src.connect(f).connect(gain).connect(this.master);
    src.start();
    this.ambience = { src, gain };
  }

  setIntensity(v: number) {
    if (this.ambience && this.ctx) {
      this.ambience.gain.gain.setTargetAtTime(0.04 + v * 0.14, this.ctx.currentTime, 0.6);
    }
  }

  stopAmbience() {
    if (this.ambience) {
      try {
        this.ambience.src.stop();
      } catch {
        /* yoksay */
      }
      this.ambience = null;
    }
  }
}

export const sfx = new SFX();
