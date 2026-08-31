import { initBrain, brainMarketValue } from "./brain";
import { CLUB_LIST, LEAGUES } from "./data/clubs";
import { POOLS, natsFor } from "./data/names";
import { formationById, overall, slotPower } from "./formations";
import { Rng, clamp, hashStr } from "./rng";
import type { Career, Club, Player, PosCode, World } from "./types";
import { newCareer, serializeCareer, deserializeCareer } from "./career";
import { encryptText, decryptText } from "./crypto";
import { LEAGUES as LG, clubsOf } from "./data/clubs";
import type { Draft } from "./custom";

export const SAVE_KEY = "twin_soccer_save_v2";
export const SAVE_VERSION = 2;

/** 23 kişilik şablon kadro sırası. */
const SQUAD_TEMPLATE: PosCode[] = [
  "GK", "GK",
  "CB", "CB", "CB", "CB",
  "LB", "LB", "RB", "RB",
  "DM", "DM", "CM", "CM", "CM",
  "AM", "LM", "RM", "LW", "RW",
  "ST", "ST", "ST",
];

const PROFILE: Record<PosCode, { pac: number; sho: number; pas: number; def: number; phy: number; gk: number; sd: number }> = {
  GK: { pac: 50, sho: 28, pas: 44, def: 34, phy: 56, gk: 68, sd: 6 },
  CB: { pac: 58, sho: 32, pas: 52, def: 68, phy: 68, gk: 14, sd: 7 },
  LB: { pac: 66, sho: 44, pas: 60, def: 60, phy: 60, gk: 12, sd: 6 },
  RB: { pac: 66, sho: 44, pas: 60, def: 60, phy: 60, gk: 12, sd: 6 },
  DM: { pac: 60, sho: 50, pas: 64, def: 64, phy: 64, gk: 12, sd: 6 },
  CM: { pac: 63, sho: 56, pas: 68, def: 56, phy: 60, gk: 12, sd: 6 },
  AM: { pac: 68, sho: 66, pas: 70, def: 44, phy: 52, gk: 12, sd: 6 },
  LM: { pac: 70, sho: 56, pas: 64, def: 50, phy: 56, gk: 12, sd: 6 },
  RM: { pac: 70, sho: 56, pas: 64, def: 50, phy: 56, gk: 12, sd: 6 },
  LW: { pac: 74, sho: 66, pas: 64, def: 38, phy: 50, gk: 12, sd: 6 },
  RW: { pac: 74, sho: 66, pas: 64, def: 38, phy: 50, gk: 12, sd: 6 },
  ST: { pac: 70, sho: 74, pas: 54, def: 34, phy: 64, gk: 12, sd: 6 },
};

const WKEYS: Record<PosCode, [keyof Player, number][]> = {
  GK: [["gk", 1]],
  CB: [["def", 0.55], ["phy", 0.21], ["pac", 0.13]],
  LB: [["pac", 0.25], ["def", 0.38], ["pas", 0.17]],
  RB: [["pac", 0.25], ["def", 0.38], ["pas", 0.17]],
  DM: [["def", 0.34], ["pas", 0.26], ["phy", 0.19]],
  CM: [["pas", 0.36], ["sho", 0.19], ["pac", 0.14]],
  AM: [["pas", 0.34], ["sho", 0.28], ["pac", 0.18]],
  LM: [["pac", 0.27], ["pas", 0.28], ["sho", 0.19]],
  RM: [["pac", 0.27], ["pas", 0.28], ["sho", 0.19]],
  LW: [["pac", 0.32], ["sho", 0.26], ["pas", 0.24]],
  RW: [["pac", 0.32], ["sho", 0.26], ["pas", 0.24]],
  ST: [["sho", 0.42], ["pac", 0.24], ["phy", 0.16]],
};

let idSeq = 1;

function pickName(rng: Rng, region: "tr" | "eu" | "lat" | "af"): { name: string; nat: string } {
  const pool = POOLS[region];
  const nat = rng.pick(natsFor(region));
  return { name: rng.pick(pool.first) + " " + rng.pick(pool.last), nat };
}

function makePlayer(
  rng: Rng, clubId: string, region: "tr" | "eu" | "lat" | "af",
  pos: PosCode, targetOvr: number, num: number,
): Player {
  const prof = PROFILE[pos];
  const f = 0.615 + ((targetOvr - 62) / 22) * 0.44;
  const a = {
    pac: clamp(prof.pac * f + rng.gauss(0, prof.sd), 20, 99),
    sho: clamp(prof.sho * f + rng.gauss(0, prof.sd), 12, 99),
    pas: clamp(prof.pas * f + rng.gauss(0, prof.sd), 20, 99),
    def: clamp(prof.def * f + rng.gauss(0, prof.sd), 12, 99),
    phy: clamp(prof.phy * f + rng.gauss(0, prof.sd), 24, 99),
    gk: pos === "GK" ? clamp(prof.gk * f + rng.gauss(0, 5), 30, 99) : clamp(8 + rng.f() * 16, 5, 26),
  };
  const p: Player = {
    id: "p" + (idSeq++).toString(36) + Math.floor(rng.f() * 1296).toString(36),
    name: "", num, pos,
    age: 0, nat: "", teamId: clubId,
    value: 0, wage: 0, morale: 0, injury: 0, contract: 0, release: 0,
    form: 50, fitness: 100,
    pac: Math.round(a.pac), sho: Math.round(a.sho), pas: Math.round(a.pas),
    def: Math.round(a.def), phy: Math.round(a.phy), gk: Math.round(a.gk),
    stats: { apps: 0, goals: 0, assists: 0, yellow: 0, red: 0, cs: 0, ratingSum: 0, mom: 0 },
  };
  // yaş: ağırlıklı 21-28
  const r = rng.f();
  p.age = r < 0.08 ? rng.int(17, 19) : r < 0.16 ? rng.int(19, 21) : r < 0.78 ? rng.int(21, 28) : r < 0.92 ? rng.int(28, 32) : rng.int(32, 36);
  // hedef OVR'a doğru ince ayar
  let delta = targetOvr - overall(p);
  if (Math.abs(delta) > 0.5) {
    for (const [k, w] of WKEYS[pos]) {
      const add = delta * w * 1.55;
      (p as unknown as Record<string, number>)[k as string] = clamp(
        Math.round(((p as unknown as Record<string, number>)[k as string] as number) + add), 12, 99,
      );
    }
    delta = targetOvr - overall(p);
    if (Math.abs(delta) > 1) {
      const k0 = WKEYS[pos][0][0] as string;
      (p as unknown as Record<string, number>)[k0] = clamp(
        Math.round(((p as unknown as Record<string, number>)[k0] as number) + delta), 12, 99,
      );
    }
  }
  const foreign = rng.chance(0.28);
  const reg = foreign ? rng.pick(["tr", "eu", "lat", "af"] as const) : region;
  const n = pickName(rng, reg);
  p.name = n.name;
  p.nat = n.nat;
  p.value = Math.round(brainMarketValue(overall(p), p.age, p.pos) / 10) * 10;
  p.wage = Math.round(clamp(p.value * 0.0042 + 1.5, 2, 420));
  p.release = Math.round((p.value * (1.55 + rng.f() * 0.8)) / 50) * 50;
  p.contract = rng.int(1, 5);
  p.morale = rng.int(58, 88);
  p.form = rng.int(42, 66);
  p.fitness = rng.int(88, 100);
  p.injury = 0;
  return p;
}

/** Bir kulüp için 23 kişik kadro: ilk 11-15 kulüp gücüne yakın, gerisi daha düşük. */
function makeSquad(rng: Rng, club: Club, region: "tr" | "eu" | "lat" | "af"): Player[] {
  const out: Player[] = [];
  const usedNum = new Set<number>();
  SQUAD_TEMPLATE.forEach((pos, i) => {
    let tier: number;
    if (i < 11) tier = 0;
    else if (i < 15) tier = 3.6;
    else tier = 8.4;
    const target = clamp(club.rating + rng.gauss(0, 1.5) - tier, 46, 94);
    let num = 0;
    for (let t = 0; t < 40; t++) {
      const cand = pos === "GK" ? rng.int(1, 13) : rng.int(2, 40);
      if (!usedNum.has(cand)) { num = cand; usedNum.add(cand); break; }
    }
    if (!num) num = 40 + i;
    out.push(makePlayer(rng, club.id, region, pos, target, num));
  });
  return out;
}

export function generateWorld(seed = Date.now() & 0x7fffffff): World {
  initBrain(seed);
  idSeq = 1;
  const rng = new Rng(seed);
  const players: Record<string, Player> = {};
  const clubs: Record<string, Club> = {};
  for (const c of CLUB_LIST) {
    const lg = LEAGUES.find((l) => l.id === c.leagueId)!;
    const squad = makeSquad(rng, c, lg.region);
    for (const p of squad) players[p.id] = p;
    clubs[c.id] = { ...c };
  }
  return { v: SAVE_VERSION, clubs, players, leagues: LEAGUES, career: null, seed };
}

/** Formasyon slotlarına en uygun 11'i dizer, en iyi 7'sini yedek yapar. */
export function autoLineup(players: Player[], formationId: string): { lineup: string[]; subs: string[] } {
  const form = formationById(formationId);
  const avail = players.filter((p) => p.injury === 0);
  const pool = avail.length >= 11 ? avail : players.slice();
  const taken = new Set<string>();
  const lineup: string[] = [];

  // 1) kaleciyi garantile
  const gk = pool.filter((p) => p.pos === "GK").sort((a, b) => slotPower(b, "GK") - slotPower(a, "GK"))[0];
  const gkSlot = form.slots.findIndex((s) => s.role === "GK");
  if (gk && gkSlot >= 0) { lineup[gkSlot] = gk.id; taken.add(gk.id); }

  // 2) slotları en yüksek uyumlu oyuncuyla doldur (greedy, açıkta kalanlar için)
  const order = form.slots.map((s, i) => ({ i, s })).filter((o) => o.s.role !== "GK");
  // savunma→orta→hücum sırasıyla doldurmak daha dengeli ilk 11 üretir
  order.sort((a, b) => (a.s.fx === b.s.fx ? 0 : a.s.fx - b.s.fx));
  const free = pool.filter((p) => p.pos !== "GK").sort((x, y) => overall(y) - overall(x));
  for (const { i, s } of order) {
    let best: Player | null = null;
    let bestScore = -1;
    for (const p of free) {
      if (taken.has(p.id)) continue;
      const sc = slotPower(p, s.role) * (p.pos === s.role ? 1.06 : 1);
      if (sc > bestScore) { bestScore = sc; best = p; }
    }
    if (best) { lineup[i] = best.id; taken.add(best.id); }
  }
  // GÜVENCE: 11 slotun tamamı dolu olmalı (dolu kalmazsa formasyon indeksleri kayardı)
  const all = players.slice();
  for (let i = 0; i < 11; i++) {
    if (lineup[i]) continue;
    const fb = all.find((p) => !taken.has(p.id));
    if (fb) { lineup[i] = fb.id; taken.add(fb.id); }
  }

  const rest = all.filter((p) => !taken.has(p.id)).sort((a, b) => overall(b) - overall(a));
  const benchGk = rest.find((p) => p.pos === "GK");
  const subs: string[] = [];
  if (benchGk) subs.push(benchGk.id);
  for (const p of rest) {
    if (subs.length >= 7) break;
    if (p.id === benchGk?.id) continue;
    subs.push(p.id);
  }
  return { lineup: lineup.filter(Boolean), subs };
}

export function squadOf(world: World, clubId: string): Player[] {
  return Object.values(world.players).filter((p) => p.teamId === clubId);
}

export function clubPower(world: World, clubId: string, lineup: string[] | null): number {
  const c = world.clubs[clubId];
  if (!c) return 60;
  if (lineup && lineup.length === 11) {
    let s = 0;
    lineup.forEach((id, i) => {
      const p = world.players[id];
      if (!p) return;
      s += slotPower(p, formationById("f442").slots[i]?.role ?? p.pos);
    });
    return Math.round(s / 11);
  }
  const sq = squadOf(world, clubId).sort((a, b) => overall(b) - overall(a)).slice(0, 11);
  return Math.round(sq.reduce((t, p) => t + overall(p), 0) / Math.max(1, sq.length));
}

/* ------------------------- KAYIT / YÜKLEME ------------------------- */

const PKEY: (keyof Player | keyof Player["stats"])[] = [
  "id", "name", "num", "pos", "age", "nat", "teamId", "value", "wage", "morale",
  "injury", "contract", "release", "form", "fitness", "pac", "sho", "pas", "def", "phy", "gk",
  "apps", "goals", "assists", "yellow", "red", "cs", "ratingSum", "mom",
];

function packPlayer(p: Player): unknown[] {
  const out: unknown[] = [];
  for (const k of PKEY) {
    if (k in p.stats) out.push(p.stats[k as keyof Player["stats"]]);
    else out.push(p[k as keyof Player]);
  }
  return out;
}

function unpackPlayer(a: unknown[]): Player {
  const p: Player = {
    id: String(a[0]), name: String(a[1]), num: a[2] as number, pos: a[3] as PosCode,
    age: a[4] as number, nat: String(a[5]), teamId: String(a[6]), value: a[7] as number,
    wage: a[8] as number, morale: a[9] as number, injury: a[10] as number,
    contract: a[11] as number, release: a[12] as number, form: a[13] as number,
    fitness: a[14] as number, pac: a[15] as number, sho: a[16] as number, pas: a[17] as number,
    def: a[18] as number, phy: a[19] as number, gk: a[20] as number,
    stats: { apps: 0, goals: 0, assists: 0, yellow: 0, red: 0, cs: 0, ratingSum: 0, mom: 0 },
  };
  p.stats.apps = a[21] as number; p.stats.goals = a[22] as number;
  p.stats.assists = a[23] as number; p.stats.yellow = a[24] as number;
  p.stats.red = a[25] as number; p.stats.cs = a[26] as number;
  p.stats.ratingSum = a[27] as number; p.stats.mom = a[28] as number;
  return p;
}

export function saveWorld(world: World): boolean {
  try {
    const payload = {
      v: SAVE_VERSION,
      seed: world.seed,
      clubs: Object.values(world.clubs),
      players: Object.values(world.players).map(packPlayer),
      career: world.career ? serializeCareer(world.career) : null,
    };
    // ŞİFRELİ KAYIT: PIN varsa oturum anahtarıyla, yoksa düz metin (geriye uyumlu) saklanır
    localStorage.setItem(SAVE_KEY, encryptText(JSON.stringify(payload)));
    return true;
  } catch (e) {
    console.warn("[save] başarısız", e);
    return false;
  }
}

export function loadWorld(): World | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const txt = decryptText(raw);
    if (!txt) return null; // PIN yanlış ya da veri bozuk
    const d = JSON.parse(txt) as {
      v: number; seed: number; clubs: Club[]; players: unknown[][]; career: unknown | null;
    };
    if (d.v !== SAVE_VERSION) return null;
    initBrain(d.seed || 1);
    const players: Record<string, Player> = {};
    for (const arr of d.players) {
      const p = unpackPlayer(arr);
      players[p.id] = p;
    }
    const clubs: Record<string, Club> = {};
    for (const c of d.clubs ?? []) clubs[c.id] = c;
    // Her lig beklenen takım sayısına tamamlanır/indirgenir.
    // (Kullanıcı takımı bir kulübün yerini aldığında silinen kulüp geri eklenmesin,
    //  aksi halde lig 15 takımlı kalıp round-robin bozulurdu.)
    for (const lg of LG) {
      const have = Object.values(clubs).filter((c) => c.leagueId === lg.id);
      const want = clubsOf(lg.id).length;
      if (have.length > want) {
        [...have].sort((a, b) => a.rating - b.rating).slice(0, have.length - want)
          .forEach((c) => delete clubs[c.id]);
      } else if (have.length < want) {
        for (const c of clubsOf(lg.id)) if (!clubs[c.id]) clubs[c.id] = { ...c };
      }
    }
    const world: World = {
      v: SAVE_VERSION, clubs, players, leagues: LEAGUES, seed: d.seed,
      career: d.career ? deserializeCareer(d.career, players) : null,
    };
    return world;
  } catch (e) {
    console.warn("[load] başarısız", e);
    return null;
  }
}

export function clearSave(): void {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* yoksay */ }
}

export function hasSave(): boolean {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export { newCareer };

export function defaultTactic(formation = "f442"): Career["tactic"] {
  return { formation, mentality: 50, pressing: 48, width: 50, lineHeight: 45, tempo: 50, passing: "mixed" };
}

/**
 * Kullanıcının kurduğu takımı dünyaya ekler.
 * Aynı ligdeki en zayıf kulüp yerini bırakır (oyuncuları diğer kulüplere dağıtılır,
 * böylece oyuncu evreni küçülmez) ve yeni kulüp için 23 kişilik kadro üretilir.
 */
export function createCustomClub(world: World, draft: Draft): Club {
  const leagueId = draft.leagueId || "lig_bymel";
  const rng = new Rng((hashStr(draft.name + draft.city + Date.now()) ^ 0x7f4a7) >>> 0);
  const inLeague = Object.values(world.clubs).filter((c) => c.leagueId === leagueId);
  const victim = [...inLeague].sort((a, b) => a.rating - b.rating)[0];
  if (victim) {
    const others = Object.values(world.clubs).filter((c) => c.id !== victim.id);
    for (const p of Object.values(world.players)) {
      if (p.teamId === victim.id) p.teamId = rng.pick(others).id;
    }
    delete world.clubs[victim.id];
  }
  const id = "my_" + Math.floor(rng.next() * 1e9).toString(36);
  const club: Club = {
    id,
    name: (draft.name.trim() || "Takımım").slice(0, 26),
    short: (draft.short || draft.name.slice(0, 3)).toLocaleUpperCase("tr-TR").slice(0, 4),
    city: (draft.city.trim() || "—").slice(0, 20),
    leagueId,
    rating: draft.rating,
    kit: { primary: draft.primary, secondary: draft.secondary, shorts: draft.shorts, pattern: draft.pattern },
    gkKit: { primary: draft.gkPrimary, secondary: draft.gkSecondary, shorts: "#111827", pattern: "plain" },
    budget: Math.round((Math.pow(draft.rating / 63, 4.1) * 5200 + 900) / 50) * 50,
    crest: ((draft.crest % 5) + 5) % 5,
  };
  world.clubs[id] = club;
  const lg = LG.find((l) => l.id === leagueId);
  const squad = makeSquad(rng, club, lg ? lg.region : "tr");
  for (const p of squad) world.players[p.id] = p;
  return club;
}

/** Kayıtlı dünyada kullanıcıya ait (kendi kurduğu) kulüp var mı? */
export function customClubOf(world: World): Club | null {
  for (const c of Object.values(world.clubs)) if (c.id.startsWith("my_")) return c;
  return null;
}

/**
 * Kadro ÖNİZLEMESİ — dünyayı değiştirmez, yalnızca 23 örnek oyuncu üretir.
 * (Kurulum ekranında gerçek dünya üzerinde işlem yapılmaz; oyuncuların kulüpleri bozulmaz.)
 */
export function previewSquad(rating: number, leagueId: string, seed = Date.now()): Player[] {
  const region = LG.find((l) => l.id === leagueId)?.region ?? "tr";
  const club: Club = {
    id: "preview", name: "Önizleme", short: "PRW", city: "—", leagueId,
    rating: clamp(rating, 55, 90),
    kit: { primary: "#f5f7fa", secondary: "#111827", shorts: "#111827", pattern: "plain" },
    gkKit: { primary: "#22d3ee", secondary: "#111827", shorts: "#111827", pattern: "plain" },
    budget: 0, crest: 0,
  };
  return makeSquad(new Rng((hashStr(String(seed)) ^ 0x51ed2b) >>> 0), club, region);
}
