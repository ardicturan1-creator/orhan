import { LuaRuntime } from "../lua/lua";
import { LUA_GAME_BRAIN } from "../lua/scripts";

/* ============================================================
 *  Lua oyun beyni köprüsü — her çağrı Lua'da çalışır,
 *  beklenmedik bir hata olursa TS yedeği devreye girer.
 * ============================================================ */

let rt: LuaRuntime | null = null;
let brainOK = false;

export function initBrain(): boolean {
  if (rt) return brainOK;
  try {
    rt = new LuaRuntime();
    rt.setRandomSeed(Date.now() % 1000000 + 7);
    rt.run(LUA_GAME_BRAIN);
    brainOK = true;
  } catch (e) {
    console.warn("[BYMEL] Lua beyin başlatılamadı:", e);
    brainOK = false;
    rt = null;
  }
  return brainOK;
}
export const brainActive = () => brainOK;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export interface TacticCtx {
  min: number;
  scoreDiff: number;
  ratingDiff: number;
  stamina: number;
  mentality: number;
  pressing: number;
  tempo: number;
  width: number;
  line: number;
}
export interface TacticOut {
  press: number;
  line: number;
  width: number;
  tempo: number;
  push: number;
  risk: number;
}

export function tactics(c: TacticCtx): TacticOut {
  try {
    return rt!.call("tactics", c) as TacticOut;
  } catch {
    const press = clamp(38 + c.pressing * 0.5, 10, 100);
    const line = clamp(30 + c.line * 0.45, 5, 95);
    const tempo = clamp(40 + c.tempo * 0.5, 10, 100);
    let push = (c.mentality - 50) * 0.22;
    if (c.scoreDiff < 0) push = 10 + -c.scoreDiff * 4;
    else if (c.scoreDiff > 0 && c.min > 70) push -= 14;
    return { press, line, width: clamp(40 + c.width * 0.4, 10, 95), tempo, push: clamp(push, -22, 34), risk: c.scoreDiff < 0 ? 0.7 : 0.35 };
  }
}

export function marketValue(ovr: number, age: number, pos: string): number {
  try {
    return rt!.call("market_value", ovr, age, pos) as number;
  } catch {
    const peak = age <= 20 ? 1.35 : age <= 24 ? 1.55 : age <= 28 ? 1.4 : age <= 31 ? 1 : age <= 33 ? 0.6 : 0.28;
    return Math.floor(Math.pow(ovr / 60, 5.4) * 900 * peak);
  }
}

export function simMatch(hr: number, ar: number, homeAdv = 1): { hg: number; ag: number } {
  try {
    return rt!.call("sim_match", hr, ar, homeAdv) as { hg: number; ag: number };
  } catch {
    const d = (hr - ar) / 11;
    const p = (l: number) => {
      let k = 0;
      let p2 = 1;
      const L = Math.exp(-l);
      do {
        k++;
        p2 *= Math.random();
      } while (p2 > L);
      return Math.min(7, k - 1);
    };
    return { hg: p(clamp(1.35 + d * 0.85, 0.25, 4.2)), ag: p(clamp(1.12 - d * 0.85, 0.18, 3.8)) };
  }
}

export function onballDecision(c: {
  dist: number;
  pressure: number;
  open: number;
  sho: number;
  pas: number;
  pac: number;
  space: number;
  mateAhead: number;
  passOptions: number;
  inBox: boolean;
}): string {
  try {
    return rt!.call("onball_decision", c) as string;
  } catch {
    const shoot = c.dist < 32 ? (32 - c.dist) * 2.3 + (c.sho - 62) * 0.55 - c.pressure * 22 : -25;
    const pass = 22 + (c.pas - 62) * 0.5 + c.open * 24 - c.pressure * 14;
    return shoot > pass ? "shoot" : "pass";
  }
}

export function commentary(kind: string, name = ""): string {
  try {
    return rt!.call("commentary", kind, name) as string;
  } catch {
    return name ? `${name}!` : "";
  }
}

export function trainingGain(age: number, ovr: number, minutes: number): number {
  try {
    return rt!.call("training_gain", age, ovr, minutes) as number;
  } catch {
    const base = age <= 19 ? 1.5 : age <= 22 ? 1.15 : age <= 26 ? 0.7 : age <= 30 ? 0.35 : 0.08;
    return base * (0.35 + minutes / 90);
  }
}

export function prizeMoney(pos: number, size: number): number {
  try {
    return rt!.call("prize_money", pos, size) as number;
  } catch {
    return Math.max(1500, 18000 - pos * 1200);
  }
}

export function cpuSub(min: number, stamina: number, diff: number): boolean {
  try {
    return rt!.call("cpu_sub", min, stamina, diff) as boolean;
  } catch {
    return min > 60 && stamina < 62;
  }
}

export function motmScore(goals: number, assists: number, rating: number, tackles: number, passes: number): number {
  try {
    return rt!.call("motm_score", goals, assists, rating, tackles, passes) as number;
  } catch {
    return goals * 3.1 + assists * 1.9 + (rating - 6) * 2.2 + tackles * 0.22 + passes * 0.012;
  }
}
