/** Deterministik RNG + küçük matematik yardımcıları. Hiçbir harici bağımlılık yok. */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private r: () => number;
  constructor(seed: number) {
    this.r = mulberry32(seed);
  }
  next(): number {
    return this.r();
  }
  /** [0,1) */
  f(): number {
    return this.r();
  }
  /** [a,b) */
  range(a: number, b: number): number {
    return a + (b - a) * this.r();
  }
  /** [a,b] tam sayı */
  int(a: number, b: number): number {
    return Math.floor(a + (b - a + 1) * this.r());
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.r() * arr.length) % arr.length];
  }
  chance(p: number): boolean {
    return this.r() < p;
  }
  /** Box-Muller gauss */
  gauss(mu = 0, sd = 1): number {
    const u = Math.max(1e-9, this.r());
    const v = this.r();
    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.r() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }
}

/** Karakter dizisinden deterministik 32-bit hash. */
export function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const inv = (a: number, b: number, v: number): number => (b === a ? 0 : (v - a) / (b - a));
export const dist = (x1: number, y1: number, x2: number, y2: number): number =>
  Math.hypot(x2 - x1, y2 - y1);
export const dist2 = (x1: number, y1: number, x2: number, y2: number): number => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
};
export const smooth = (cur: number, tgt: number, dt: number, rate: number): number =>
  cur + (tgt - cur) * (1 - Math.exp(-rate * dt));
/** Açı farkını [-PI,PI] aralığına indirger. */
export const angDiff = (a: number, b: number): number => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
export const fmtMoney = (k: number): string => {
  const v = Math.round(k);
  if (Math.abs(v) >= 1000000) return (v / 1000000).toFixed(2) + " Mr";
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(v >= 100000 ? 0 : 1) + " Mn";
  return String(v);
};
