import { CLUBS, CLUB_MAP } from "./data/clubs";
import { FIRST, LAST } from "./data/names";
import { FORMATION_MAP, overall } from "./formations";
import { marketValue, initBrain } from "./brain";

// Lua beynini dünya üretilmeden önce başlat
initBrain();
import { RNG, clamp } from "./rng";
import type { Player, PosCode, Club } from "./types";

/* ============================================================
 *  Dünya üretimi — kurgusal oyuncu havuzu
 * ============================================================ */

const SQUAD_TEMPLATE: PosCode[] = [
  "GK", "GK",
  "CB", "CB", "CB", "CB",
  "LB", "LB", "RB", "RB",
  "DM", "DM", "CM", "CM", "CM",
  "AM", "LM", "RM",
  "LW", "RW", "ST", "ST", "ST",
];

const ATTR_PROFILE: Record<PosCode, [number, number, number, number, number, number]> = {
  //      pac   sho   pas   def   phy   gk
  GK: [-18, -25, -14, -14, -6, 5],
  CB: [-5, -26, -10, 6, 4, -60],
  LB: [5, -19, 0, 3, -3, -60],
  RB: [5, -19, 0, 3, -3, -60],
  DM: [-4, -11, 2, 4, 2, -60],
  CM: [-1, -4, 4, -4, -3, -60],
  AM: [1, 2, 4, -24, -7, -60],
  LM: [4, -5, 3, -12, -5, -60],
  RM: [4, -5, 3, -12, -5, -60],
  LW: [6, 2, 0, -26, -8, -60],
  RW: [6, 2, 0, -26, -8, -60],
  ST: [4, 7, -8, -32, 1, -60],
};

const regionOf = (c: Club) => c.leagueId;

function makePlayer(rng: RNG, club: Club, pos: PosCode, targetOvr: number, idx: number): Player {
  const region = regionOf(club);
  const foreignChance = 0.28;
  const pool = rng.chance(foreignChance) ? rng.pick(["tr", "eu", "lat", "af"] as const) : region === "sl" ? "tr" : region === "ap" ? "eu" : region === "ca" ? "lat" : "af";
  const first = rng.pick(FIRST[pool]);
  const last = rng.pick(LAST[pool]);
  const nat = pool === "tr" ? "🇹🇷" : pool === "eu" ? "🇪🇺" : pool === "lat" ? "🌎" : "🌍";

  const ageRoll = rng.next();
  const age = ageRoll < 0.12 ? rng.int(17, 20) : ageRoll < 0.72 ? rng.int(21, 28) : ageRoll < 0.92 ? rng.int(29, 32) : rng.int(33, 36);

  const prof = ATTR_PROFILE[pos];
  const noise = () => Math.round(rng.gauss(0, 3.2));
  const mk = (delta: number) => clamp(Math.round(targetOvr + delta + noise()), 28, 99);
  const p: Player = {
    id: `p_${club.id}_${idx}`,
    name: `${first} ${last}`,
    num: 0,
    pos,
    age,
    nat,
    teamId: club.id,
    pac: mk(prof[0]),
    sho: mk(prof[1]),
    pas: mk(prof[2]),
    def: mk(prof[3]),
    phy: mk(prof[4]),
    gk: pos === "GK" ? mk(prof[5]) : rng.int(12, 28),
    value: 0,
    wage: 0,
    morale: rng.int(62, 88),
    injury: 0,
    contract: rng.int(1, 4),
    release: 0,
    form: rng.int(45, 75),
    fitness: rng.int(88, 100),
    stats: { apps: 0, goals: 0, assists: 0, yellow: 0, red: 0, cs: 0, ratingSum: 0, mom: 0 },
  };
  p.gk = pos === "GK" ? p.gk : clamp(Math.round(p.gk * 0.3), 8, 30);
  const ovr = overall(p);
  p.value = marketValue(ovr, age, pos);
  p.wage = Math.max(1, Math.round(p.value * 0.028 + 1));
  p.release = Math.round(p.value * (1.9 + rng.next() * 0.9));
  return p;
}

export interface World {
  seed: number;
  players: Record<string, Player>;
}

export function generateWorld(seed = 20260214): World {
  const rng = new RNG(seed);
  const players: Record<string, Player> = {};
  const numbers: Record<string, Set<number>> = {};
  for (const club of CLUBS) {
    numbers[club.id] = new Set();
    SQUAD_TEMPLATE.forEach((pos, i) => {
      const isStarter = i < 11;
      const spread = isStarter ? rng.range(-2, 4) : -rng.range(3, 11);
      const target = clamp(club.rating + spread, 40, 94);
      const p = makePlayer(rng, club, pos, target, i);
      // forma numarası
      let num = pos === "GK" ? (i === 0 ? 1 : 12) : rng.int(2, 34);
      let guard = 0;
      while (numbers[club.id].has(num) && guard++ < 60) num = rng.int(2, 40);
      numbers[club.id].add(num);
      p.num = num;
      players[p.id] = p;
    });
  }
  return { seed, players };
}

export const playersOf = (w: World, clubId: string) =>
  Object.values(w.players).filter((p) => p.teamId === clubId);

export const sortedByOvr = (w: World, clubId: string) =>
  playersOf(w, clubId).sort((a, b) => overall(b) - overall(a));

/* Otomatik en iyi 11 */
export function autoLineup(w: World, clubId: string, formationId: string): { lineup: string[]; subs: string[] } {
  const form = FORMATION_MAP[formationId] ?? FORMATION_MAP["442"];
  const squad = playersOf(w, clubId);
  const used = new Set<string>();
  const lineup: string[] = [];
  for (const slot of form.slots) {
    let best: Player | null = null;
    let bestScore = -1;
    for (const p of squad) {
      if (used.has(p.id)) continue;
      const fit = p.pos === slot.role ? 1 : p.pos === "GK" || slot.role === "GK" ? 0.1 : 0.72;
      const score = overall(p) * fit + (p.pos === slot.role ? 12 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) {
      used.add(best.id);
      lineup.push(best.id);
    }
  }
  const subs = squad
    .filter((p) => !used.has(p.id))
    .sort((a, b) => overall(b) - overall(a))
    .slice(0, 7)
    .map((p) => p.id);
  return { lineup, subs };
}

export function clubRating(w: World, clubId: string): number {
  const { lineup } = autoLineup(w, clubId, "442");
  if (!lineup.length) return CLUB_MAP[clubId]?.rating ?? 70;
  const xs = lineup.map((id) => overall(w.players[id]));
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/* ---------------------- Kayıt / Yükleme ---------------------- */
const SAVE_KEY = "twin_soccer_save_v2";

const PKEY: (keyof Player)[] = [
  "id", "name", "num", "pos", "age", "pac", "sho", "pas", "def", "phy", "gk",
  "teamId", "nat", "value", "wage", "morale", "injury",
  "contract", "release", "form", "fitness",
];

export function encodeWorld(w: World) {
  return {
    seed: w.seed,
    p: Object.values(w.players).map((p) => {
      const arr: any[] = PKEY.map((k) => (p as any)[k]);
      arr.push(
        p.stats.apps, p.stats.goals, p.stats.assists, p.stats.yellow, p.stats.red,
        p.stats.cs, p.stats.ratingSum, p.stats.mom
      );
      return arr;
    }),
  };
}

export function decodeWorld(d: any): World {
  const players: Record<string, Player> = {};
  for (const a of d.p) {
    const p: any = {};
    PKEY.forEach((k, i) => (p[k] = a[i]));
    const n = PKEY.length;
    p.contract = p.contract ?? 2;
    p.release = p.release ?? 0;
    p.form = p.form ?? 60;
    p.fitness = p.fitness ?? 100;
    p.stats = {
      apps: a[n] ?? 0, goals: a[n + 1] ?? 0, assists: a[n + 2] ?? 0, yellow: a[n + 3] ?? 0,
      red: a[n + 4] ?? 0, cs: a[n + 5] ?? 0, ratingSum: a[n + 6] ?? 0, mom: a[n + 7] ?? 0,
    };
    players[p.id] = p as Player;
  }
  return { seed: d.seed ?? 20260214, players };
}

export function saveToStorage(data: unknown) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadFromStorage<T>(): T | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearStorage() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* yoksay */
  }
}

export const fmtMoney = (k: number) => {
  if (Math.abs(k) >= 1000) return `€${(k / 1000).toFixed(k % 1000 === 0 ? 0 : 1)}M`;
  return `€${Math.round(k)}K`;
};
export const ovrOf = (p: Player) => overall(p);
export { CLUBS, CLUB_MAP };
