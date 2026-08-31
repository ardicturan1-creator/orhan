import { LuaRuntime, LuaTable, type LuaVal } from "../lua/lua";
import { LUA_GAME_BRAIN } from "../lua/scripts";

/** Lua brain köprüsü — her çağrı try/catch içinde; Lua patlarsa TS yedeği devreye girer. */

let rt: LuaRuntime | null = null;
let luaOk = false;
let calls = 0;
let errors = 0;

export function initBrain(seed = 987654321): void {
  try {
    rt = new LuaRuntime();
    rt.setRandomSeed(seed);
    rt.run(LUA_GAME_BRAIN, "brain");
    luaOk = true;
  } catch (e) {
    rt = null;
    luaOk = false;
    errors++;
    console.warn("[brain] Lua kurulamadı, TS yedeği aktif:", (e as Error).message);
  }
}

export function brainStatus(): { lua: boolean; calls: number; errors: number } {
  return { lua: luaOk, calls, errors };
}

function tab(v: LuaVal): LuaTable | null {
  return v instanceof LuaTable ? v : null;
}
function numField(t: LuaTable | null, k: string, d = 0): number {
  if (!t) return d;
  const v = t.get(k);
  return typeof v === "number" ? v : d;
}
function strField(t: LuaTable | null, k: string, d = ""): string {
  if (!t) return d;
  const v = t.get(k);
  return typeof v === "string" ? v : d;
}

const cl = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/* --------------------------------------------------------------- */

export interface TacticContext {
  diff: number; min: number; press: number; oppStrong: number; tired: number; mentality: number;
}
export interface TacticOut {
  push: number; line: number; width: number; press: number; tempo: number; risk: number;
}

export function brainTactics(c: TacticContext): TacticOut {
  calls++;
  if (rt && luaOk) {
    try {
      const r = rt.call("tactics", LuaTable.fromPairs(c as unknown as Record<string, unknown>));
      const t = tab(r);
      if (t) {
        return {
          push: numField(t, "push", 50), line: numField(t, "line", 38),
          width: numField(t, "width", 52), press: numField(t, "press", 50),
          tempo: numField(t, "tempo", 50), risk: numField(t, "risk", 0),
        };
      }
    } catch (e) { errors++; if (errors < 4) console.warn("[brain] tactics", (e as Error).message); }
  }
  // --- TS yedeği ---
  let push = c.mentality, line = 38, press = c.press, tempo = 50, risk = 0;
  if (c.diff < 0) { push += 9 + -c.diff * 4; line += 10; tempo += 9; risk = 1; }
  else if (c.diff > 0) { push -= 6 + c.diff * 2.2; line -= 7; }
  if (c.min > 70 && c.diff > 0) { push -= 7; line -= 6; press -= 7; }
  if (c.min > 55 && c.diff === 0) { push += 13; line += 8; tempo += 11; press += 10; risk = 2; }
  if (c.oppStrong > 0.55) { push -= 5; line -= 3; }
  if (c.tired > 0.55) { press -= 12 * c.tired; tempo -= 6 * c.tired; }
  return {
    push: cl(push, 8, 96), line: cl(line, 16, 84), width: 52,
    press: cl(press, 8, 96), tempo: cl(tempo, 26, 94), risk,
  };
}

export function brainMarketValue(ovr: number, age: number, pos: string): number {
  calls++;
  if (rt && luaOk) {
    try {
      const r = rt.call("market_value", ovr, age, pos);
      if (typeof r === "number" && Number.isFinite(r)) return r;
    } catch (e) { errors++; }
  }
  const ageMul = age <= 20 ? 1.26 : age <= 23 ? 1.16 : age <= 27 ? 1 : age <= 30 ? 0.74 : age <= 32 ? 0.46 : 0.21;
  const posMul = pos === "ST" || pos === "LW" || pos === "RW" ? 1.22 : pos === "AM" ? 1.15 : pos === "CM" ? 1.06 : pos === "GK" ? 0.8 : 0.97;
  return Math.max(45, 4200 * Math.pow(ovr / 60, 6.15) * ageMul * posMul);
}

export function brainSimMatch(hr: number, ar: number, homeAdv: number): { h: number; a: number } {
  calls++;
  if (rt && luaOk) {
    try {
      const r = tab(rt.call("sim_match", hr, ar, homeAdv));
      if (r) return { h: numField(r, "h", 0), a: numField(r, "a", 0) };
    } catch (e) { errors++; }
  }
  const pois = (lam: number): number => {
    const L = Math.exp(-lam);
    let k = 0, p = 1;
    for (;;) {
      k++; p *= Math.random();
      if (p <= L || k > 11) return p <= L ? k - 1 : 11;
    }
  };
  const d = (hr - ar) / 20;
  return { h: pois(cl(1.34 + d * 0.95 + homeAdv * 0.26, 0.18, 4.6)), a: pois(cl(1.16 - d * 0.85 + homeAdv * 0.05, 0.16, 4.4)) };
}

export interface OnBallContext {
  dist: number; pressure: number; inBox: number; central: number; ownThird: number;
  shoot: number; passBest: number; dribble: number; mustRisk: number;
}
export type OnBallAction = "shoot" | "pass" | "dribble" | "clear";

export function brainOnBall(c: OnBallContext): { act: OnBallAction; power: number } {
  calls++;
  if (rt && luaOk) {
    try {
      const r = tab(rt.call("onball_decision", LuaTable.fromPairs(c as unknown as Record<string, unknown>)));
      if (r) {
        const a = strField(r, "act", "pass");
        return { act: (["shoot", "pass", "dribble", "clear"].includes(a) ? a : "pass") as OnBallAction, power: cl(numField(r, "power", 0.62), 0.2, 1) };
      }
    } catch (e) { errors++; }
  }
  let shoot = 0;
  if (c.dist < 30) { const n = 30 - c.dist; shoot = n * n * 0.09; }
  if (c.inBox) shoot += 42;
  if (c.central) shoot += 10;
  shoot += c.shoot * 24 - c.pressure * 34;
  const pass = c.passBest + 10 - c.pressure * 12;
  const dribble = 12 + c.dribble * 36 - c.pressure * 34;
  let clear = 3;
  if (c.ownThird && c.pressure > 0.55) clear += 24 + c.pressure * 42;
  if (c.dist > 55 && c.pressure > 0.45) clear += 12;
  if (c.mustRisk) shoot += 12;
  let act: OnBallAction = "pass", best = pass;
  if (shoot > best) { best = shoot; act = "shoot"; }
  if (dribble > best) { best = dribble; act = "dribble"; }
  if (clear > best) { best = clear; act = "clear"; }
  const power = act === "shoot" ? cl(0.58 + (1 - cl(c.dist / 34, 0, 1)) * 0.42, 0.5, 1) : act === "clear" ? 1 : cl(0.4 + c.pressure * 0.3, 0.35, 0.95);
  return { act, power };
}

export function brainCommentary(kind: string, name: string, team: string): string {
  calls++;
  if (rt && luaOk) {
    try {
      const r = rt.call("commentary", kind, name, team);
      if (typeof r === "string" && r.length > 1) return r;
    } catch (e) { errors++; }
  }
  const pool: Record<string, string[]> = {
    goal: ["GOOOL! " + name + " ağları havalandırıyor!", "İnanılmaz! " + name + " bitirdi işi!"],
    shotWide: [name + " vurdu... az farkla auta gitti!", "Dışarı! Pozisyon çok netti."],
    shotSaved: ["Muhteşem kurtarış! " + name + " boş gole bakıyor.", "Kaleci uçtu ve topu çeldi!"],
    kickoff: ["Ve maç başlıyor!", "İlk düdük çaldı!"],
    fulltime: ["Ve maç bitiyor!", "Son düdük!"],
  };
  const arr = pool[kind] ?? ["..."];
  return arr[Math.floor(Math.random() * arr.length)];
}

export function brainTrainingGain(age: number, ovr: number, minutes: number): number {
  calls++;
  if (rt && luaOk) {
    try {
      const r = rt.call("training_gain", age, ovr, minutes);
      if (typeof r === "number" && Number.isFinite(r)) return r;
    } catch (e) { errors++; }
  }
  const ageF = age <= 19 ? 1.55 : age <= 22 ? 1.3 : age <= 25 ? 1 : age <= 28 ? 0.55 : age <= 31 ? 0.24 : 0.06;
  const pot = cl((94 - ovr) / 34, 0.05, 1);
  return cl(ageF * pot * (minutes / 90) * 2.35, 0, 6);
}

export function brainPrizeMoney(pos: number, size: number): number {
  calls++;
  if (rt && luaOk) {
    try {
      const r = rt.call("prize_money", pos, size);
      if (typeof r === "number" && Number.isFinite(r)) return r;
    } catch (e) { errors++; }
  }
  return Math.floor(((3200 + size * 210) * Math.pow(1.34, cl(size - pos, 0, size))) / 50) * 50;
}

export function brainCpuSub(minute: number, stamina: number, diff: number): boolean {
  calls++;
  if (rt && luaOk) {
    try {
      const r = rt.call("cpu_sub", minute, stamina, diff);
      if (typeof r === "boolean") return r;
    } catch (e) { errors++; }
  }
  if (minute < 55) return false;
  let thr = 58 - diff * 2;
  if (minute > 78) thr += 8;
  return stamina < thr;
}

export function brainMotm(
  rating: number, goals: number, assists: number, passes: number, tackles: number, saves: number,
): number {
  calls++;
  if (rt && luaOk) {
    try {
      const r = rt.call("motm_score", rating, goals, assists, passes, tackles, saves);
      if (typeof r === "number" && Number.isFinite(r)) return r;
    } catch (e) { errors++; }
  }
  return rating * 1.15 + goals * 22 + assists * 12 + passes * 0.16 + tackles * 0.5 + saves * 3.2;
}
