import { brainCpuSub, brainMarketValue, brainPrizeMoney, brainSimMatch, brainTrainingGain } from "./brain";
import { clubsOf, LEAGUES } from "./data/clubs";
import { POOLS, natsFor } from "./data/names";

/** Ligdeki kulüp id'lerini KAYITLI dünyadan okur (kullanıcı takımı değişmiş olabilir). */
export function leagueClubIds(world: World, leagueId: string): string[] {
  const ids = Object.values(world.clubs).filter((c) => c.leagueId === leagueId).map((c) => c.id);
  if (ids.length >= 6) return ids;
  return clubsOf(leagueId).map((c) => c.id);
}
import { formationById, overall } from "./formations";
import { bonusesOf, addManagerXp, bumpObjective, objectivesForSeason } from "./economy";
import { Rng, clamp, hashStr } from "./rng";
import type {
  Career, CupTie, CupStage, Fixture, MarketPlayer, MatchResult, Player, PosCode,
  TableRow, TeamTactic, World,
} from "./types";

/* ------------------------------ YARDIMCILAR ------------------------------ */

export function defaultTactic(formation = "f442"): TeamTactic {
  return { formation, mentality: 50, pressing: 48, width: 50, lineHeight: 45, tempo: 50, passing: "mixed" };
}

export function news(career: Career, icon: string, text: string, hi = false): void {
  career.news.unshift({ season: career.season, round: career.round, icon, text, hi });
  if (career.news.length > 60) career.news.length = 60;
}

export function squadOf(world: World, clubId: string): Player[] {
  return Object.values(world.players).filter((p) => p.teamId === clubId);
}

/* ------------------------------ FİKSTÜR ------------------------------ */

/** Round-robin (rotasyon yöntemi) — deterministik seed ile çift devre. */
const BYE = "__BYE__";

/** Round-robin (rotasyon). Tek sayıda takım varsa "bye" ile tamamlanır — bozulma olmaz. */
export function generateFixtures(clubIds: string[], seed: number): Fixture[] {
  const rng = new Rng(seed);
  const teams = rng.shuffle([...clubIds].filter((id) => !!id && id !== BYE));
  if (teams.length < 2) return [];
  const arr = teams.length % 2 === 1 ? [...teams, BYE] : [...teams];
  const n = arr.length;
  const out: Fixture[] = [];
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      pairs.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop()!);
  }
  const push = (h: string, a: string, round: number): void => {
    if (h === BYE || a === BYE) return;
    out.push({ round, homeId: h, awayId: a, hg: null, ag: null });
  };
  rounds.forEach((pairs, r) => { for (const [h, a] of pairs) push(h, a, r + 1); });
  rounds.forEach((pairs, r) => { for (const [h, a] of pairs) push(a, h, r + n); });
  return out;
}

export const CUP_WEEKS: Record<Exclude<CupStage, "none" | "won" | "out">, number> = {
  r16: 5, qf: 12, sf: 19, final: 24,
};
export const LEAGUE_ROUNDS = 26;

export function generateCup(world: World, seed: number): CupTie[] {
  const rng = new Rng(seed ^ 0x5f3a);
  const local = leagueClubIds(world, "lig_bymel");
  const foreign = [...world.clubs !== undefined ? Object.values(world.clubs) : []]
    .filter((c) => c.leagueId !== "lig_bymel")
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 2)
    .map((c) => c.id);
  const field = rng.shuffle([...local, ...foreign]);
  const ties: CupTie[] = [];
  for (let i = 0; i + 1 < field.length; i += 2) {
    ties.push({ homeId: field[i], awayId: field[i + 1], hg: null, ag: null, stage: "r16" });
  }
  return ties;
}

export function leagueTable(world: World, leagueId: string, fixtures: Fixture[]): TableRow[] {
  const rows: Record<string, TableRow> = {};
  for (const c of Object.values(world.clubs)) {
    if (c.leagueId !== leagueId) continue;
    rows[c.id] = { clubId: c.id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  }
  for (const f of fixtures) {
    if (f.hg === null || f.ag === null) continue;
    const h = rows[f.homeId];
    const a = rows[f.awayId];
    if (!h || !a) continue;
    h.p++; a.p++;
    h.gf += f.hg; h.ga += f.ag; a.gf += f.ag; a.ga += f.hg;
    if (f.hg > f.ag) { h.w++; h.pts += 3; a.l++; }
    else if (f.hg < f.ag) { a.w++; a.pts += 3; h.l++; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
  }
  return Object.values(rows).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.clubId.localeCompare(y.clubId));
}

export function userFixture(career: Career): Fixture | null {
  return career.fixtures.find((f) => f.round === career.round && (f.homeId === career.clubId || f.awayId === career.clubId)) ?? null;
}

export function userCupTie(career: Career): CupTie | null {
  const wk = (Object.keys(CUP_WEEKS) as Exclude<CupStage, "none" | "won" | "out">[])
    .find((s) => CUP_WEEKS[s] === career.round);
  if (!wk) return null;
  return career.cup.find((t) => t.stage === wk && t.hg === null && (t.homeId === career.clubId || t.awayId === career.clubId)) ?? null;
}

export function isCupWeek(round: number): boolean {
  return (Object.values(CUP_WEEKS) as number[]).includes(round);
}

/* ------------------------------ KARİYER KURULUMU ------------------------------ */

export function newCareer(world: World, clubId: string, quickMode = false, clubName = ""): Career {
  const club = world.clubs[clubId];
  const squad = squadOf(world, clubId);
  const lineupInfo = autoPick(squad, "f442");
  const career: Career = {
    clubId, season: 1, round: 1,
    budget: quickMode ? Math.round(club.budget * 1.5) : club.budget,
    gold: quickMode ? 2500 : 1200,
    diamonds: quickMode ? 30 : 12,
    lineup: lineupInfo.lineup, subs: lineupInfo.subs,
    formation: "f442",
    tactic: defaultTactic("f442"),
    training: {},
    fixtures: generateFixtures(leagueClubIds(world, "lig_bymel"), hashStr(clubId) ^ 0x1234),
    cup: generateCup(world, hashStr(clubId)),
    cupStage: "r16",
    trophies: 0,
    history: [],
    news: [],
    market: generateMarket(world, clubId, 0),
    stadium: {
      name: clubName || club.name + " Arena",
      levels: { stands: 2, pitch: 2, lights: 1, screen: 1, academy: 1, medical: 1 },
      theme: "modern",
    },
    manager: {
      name: "Menajer", level: 1, xp: 0, points: 3,
      skills: { training: 1, tactics: 1, negotiation: 1, motivation: 1, scouting: 1, youth: 1 },
      reputation: 3,
    },
    objectives: objectivesForSeason(),
    streak: 0, played: 0, quickMode,
  };
  news(career, "📋", `${club.name} teknik direktörü oldunuz. Hedef: BYMEL Süper Lig şampiyonluğu!`, true);
  news(career, "🏟️", "Stadyum geliştirmeleri menajer ve ekonomi panelinden yapılabilir.");
  return career;
}

function autoPick(squad: Player[], formationId: string): { lineup: string[]; subs: string[] } {
  const form = formationById(formationId);
  const pool = squad.filter((p) => p.injury === 0);
  const fit = (p: Player, role: PosCode) => overall(p) * (p.pos === role ? 1 : 0.86);
  const taken = new Set<string>();
  const lineup: string[] = new Array(11).fill("");
  const gkSlot = form.slots.findIndex((s) => s.role === "GK");
  const gk = pool.filter((p) => p.pos === "GK").sort((a, b) => overall(b) - overall(a))[0];
  if (gk && gkSlot >= 0) { lineup[gkSlot] = gk.id; taken.add(gk.id); }
  const rest = form.slots.map((s, i) => ({ i, s })).filter((o) => o.s.role !== "GK").sort((a, b) => a.s.fx - b.s.fx);
  for (const { i, s } of rest) {
    let best: Player | null = null;
    let bs = -1;
    for (const p of pool) {
      if (taken.has(p.id)) continue;
      const v = fit(p, s.role);
      if (v > bs) { bs = v; best = p; }
    }
    if (best) { lineup[i] = best.id; taken.add(best.id); }
  }
  const bench = pool.filter((p) => !taken.has(p.id)).sort((a, b) => overall(b) - overall(a));
  const gkBench = bench.find((p) => p.pos === "GK");
  const subs: string[] = [];
  if (gkBench) subs.push(gkBench.id);
  for (const p of bench) {
    if (subs.length >= 7) break;
    if (gkBench && p.id === gkBench.id) continue;
    subs.push(p.id);
  }
  return { lineup: lineup.filter(Boolean), subs };
}

/** Formasyon değiştiğinde kadroyu yeniden dizer (world.autoLineup ile aynı işi görür). */
export function reautoLineup(world: World, career: Career): void {
  const squad = squadOf(world, career.clubId);
  const info = autoPick(squad, career.formation);
  career.lineup = info.lineup;
  career.subs = info.subs;
}

/* ------------------------------ PİYASA ------------------------------ */

export function generateMarket(world: World, excludeClubId: string, quality: number): MarketPlayer[] {
  const rng = new Rng((hashStr(excludeClubId) ^ (Date.now() & 0xffff)) + Math.floor(Math.random() * 100000) + quality * 7919);
  const pool = Object.values(world.players).filter((p) => p.teamId !== excludeClubId);
  const target = 26 + Math.floor(quality * 6);
  const out: MarketPlayer[] = [];
  const shuffled = rng.shuffle([...pool]);
  for (const p of shuffled) {
    if (out.length >= target) break;
    const club = world.clubs[p.teamId];
    const free = p.contract <= 0;
    const askBase = brainMarketValue(overall(p), p.age, p.pos);
    out.push({
      player: { ...p },
      price: free ? 0 : Math.round((askBase * (1.25 + rng.f() * 0.5)) / 50) * 50,
      clubName: club ? club.name : "—",
      free,
    });
  }
  return out.sort((a, b) => overall(b.player) - overall(a.player));
}

export function askingPrice(_world: World, p: Player, negotiation: number): number {
  const formMul = 1 + (p.form - 50) / 160;
  const base = brainMarketValue(overall(p), p.age, p.pos) * clamp(formMul, 0.85, 1.2);
  const ageBoost = p.age <= 23 ? 1.12 : 1;
  return Math.round((base * ageBoost * clamp(1.32 - negotiation * 0.028, 0.9, 1.32)) / 50) * 50;
}

export function buyPlayer(world: World, career: Career, marketIdx: number): { ok: boolean; msg: string } {
  const item = career.market[marketIdx];
  if (!item) return { ok: false, msg: "Oyuncu bulunamadı." };
  const b = bonusesOf(career);
  const target = world.players[item.player.id];
  if (!target) return { ok: false, msg: "Oyuncu artık mevcut değil." };
  if (squadOf(world, career.clubId).length >= 30) return { ok: false, msg: "Kadro dolu (max 30)." };
  const price = item.free ? 0 : Math.round(item.price * b.transferCost);
  if (price > career.budget) return { ok: false, msg: "Bütçe yetersiz." };
  career.budget -= price;
  target.teamId = career.clubId;
  target.contract = item.free ? rngInt(2, 4) : target.contract || 3;
  target.morale = clamp(target.morale + 10, 40, 100);
  career.market.splice(marketIdx, 1);
  bumpObjective(career, "transfer", 1);
  addManagerXp(career, 25);
  news(career, "✍️", `${target.name} (${target.pos}, ${overall(target)}) ${price > 0 ? `💶 ${(price / 1000).toFixed(1)} Mn bonservisle` : "bonservissiz"} kadroya katıldı.`, true);
  return { ok: true, msg: `${target.name} transfer edildi!` };
}

export function sellPlayer(world: World, career: Career, playerId: string): { ok: boolean; msg: string } {
  const p = world.players[playerId];
  if (!p || p.teamId !== career.clubId) return { ok: false, msg: "Oyuncu kadronuzda değil." };
  const squad = squadOf(world, career.clubId);
  if (squad.length <= 16) return { ok: false, msg: "Kadroda en az 16 oyuncu olmalı." };
  if (career.lineup.includes(playerId) || career.subs.includes(playerId)) {
    reautoLineupAfterRemoval(world, career, playerId);
  }
  const b = bonusesOf(career);
  const fee = Math.round(askingPrice(world, p, career.manager.skills.negotiation) * 0.92 * b.transferCost);
  career.budget += fee;
  const rng = new Rng(hashStr(playerId));
  const others = Object.values(world.clubs).filter((c) => c.id !== career.clubId);
  p.teamId = rng.pick(others).id;
  career.gold += 60;
  news(career, "💸", `${p.name} ${fee > 0 ? `💶 ${(fee / 1000).toFixed(1)} Mn karşılığında` : ""} satıldı.`);
  return { ok: true, msg: `${p.name} satıldı: +€${(fee / 1000).toFixed(1)} Mn` };
}

function reautoLineupAfterRemoval(world: World, career: Career, removedId: string): void {
  career.lineup = career.lineup.filter((id) => id !== removedId);
  career.subs = career.subs.filter((id) => id !== removedId);
  const squad = squadOf(world, career.clubId);
  while (career.lineup.length < 11) {
    const cand = squad.find((p) => !career.lineup.includes(p.id) && !career.subs.includes(p.id) && p.injury === 0);
    if (!cand) break;
    career.lineup.push(cand.id);
  }
  while (career.subs.length < 7) {
    const cand = squad.find((p) => !career.lineup.includes(p.id) && !career.subs.includes(p.id) && p.injury === 0);
    if (!cand) break;
    career.subs.push(cand.id);
  }
}

/* ------------------------------ SÖZLEŞME ------------------------------ */

export interface Demand { wage: number; years: number; accept: number; release: number; }

export function contractDemand(career: Career, p: Player): Demand {
  const b = bonusesOf(career);
  const ovr = overall(p);
  const base = brainMarketValue(ovr, p.age, p.pos);
  let want = base * 0.0055 + 3;
  want *= 1 + (p.form - 50) / 220;
  want *= clamp(1 - career.manager.skills.negotiation * 0.026, 0.74, 1);
  if (p.age > 31) want *= 0.78;
  if (p.age < 24) want *= 1.12;
  if (p.contract <= 1) want *= 1.18;
  const wage = Math.round(clamp(want, 2, 900));
  const years = p.age > 32 ? rngInt(1, 2) : p.age > 28 ? rngInt(2, 3) : rngInt(3, 5);
  let accept = 0.42 + career.manager.skills.negotiation * 0.035 + (p.morale - 60) / 400;
  accept = clamp(accept, 0.08, 0.95);
  return { wage, years, accept: +accept.toFixed(2), release: Math.round(base * (1.6 + b.scoutQuality * 0.1)) };
}

export function renewContract(_world: World, career: Career, p: Player, wage: number, years: number): { ok: boolean; msg: string } {
  const d = contractDemand(career, p);
  const ratio = wage / Math.max(1, d.wage);
  let chance = d.accept + (ratio - 1) * 1.35;
  chance = clamp(chance, 0.03, 0.99);
  if (Math.random() < chance) {
    p.wage = Math.round(wage);
    p.contract = years;
    p.morale = clamp(p.morale + 12, 40, 100);
    addManagerXp(career, 18);
    news(career, "📝", `${p.name} ${years} yıllık yeni sözleşme imzaladı (haftalık 💶 ${(p.wage / 1000).toFixed(2)} Mn).`);
    return { ok: true, msg: `${p.name} imzaladı! (%${Math.round(chance * 100)} şansla kabul)` };
  }
  p.morale = clamp(p.morale - 4, 40, 100);
  return { ok: false, msg: `${p.name} teklifi reddetti. (%${Math.round(chance * 100)} kabul şansı)` };
}

function rngInt(a: number, b: number): number {
  return a + Math.floor(Math.random() * (b - a + 1));
}

/* ------------------------------ MAÇ İŞLEME ------------------------------ */

export function simulateOthers(world: World, career: Career): void {
  const cupWeek = isCupWeek(career.round);
  // Kupa haftalarında lig oynanmaz: hafta tamamen kupaya ayrılır.
  // (Kullanıcının lig maçı otomatik simüle edilip oyuncu etkisi kaybolmasın.)
  if (!cupWeek) {
    for (const f of career.fixtures) {
      if (f.round !== career.round || f.hg !== null) continue;
      if (f.homeId === career.clubId || f.awayId === career.clubId) continue;
      const hr = world.clubs[f.homeId]?.rating ?? 70;
      const ar = world.clubs[f.awayId]?.rating ?? 70;
      const r = brainSimMatch(hr, ar, 0.16);
      f.hg = r.h; f.ag = r.a;
    }
  } else {
    for (const t of career.cup) {
      if (t.hg !== null) continue;
      if (t.homeId === career.clubId || t.awayId === career.clubId) continue;
      const hr = world.clubs[t.homeId]?.rating ?? 70;
      const ar = world.clubs[t.awayId]?.rating ?? 70;
      const r = brainSimMatch(hr, ar, 0.1);
      t.hg = r.h; t.ag = r.a;
    }
  }
}

export function resolveCupRound(career: Career): void {
  const stages: Exclude<CupStage, "none" | "won" | "out">[] = ["r16", "qf", "sf", "final"];
  const curIdx = stages.findIndex((s) => career.cup.some((t) => t.stage === s && t.hg === null));
  const stage = curIdx >= 0 ? stages[curIdx] : null;
  if (!stage) return;
  const ties = career.cup.filter((t) => t.stage === stage);
  if (ties.some((t) => t.hg === null)) return;
  const winners: string[] = [];
  let userOut = false;
  for (const t of ties) {
    const hg = t.hg ?? 0;
    const ag = t.ag ?? 0;
    let w: string;
    if (hg > ag) w = t.homeId;
    else if (ag > hg) w = t.awayId;
    else w = Math.random() < 0.5 ? t.homeId : t.awayId; // penaltı simülasyonu
    winners.push(w);
    if ((t.homeId === career.clubId || t.awayId === career.clubId) && w !== career.clubId) userOut = true;
  }
  if (stage === "final") {
    const champ = winners[0];
    career.cupStage = champ === career.clubId ? "won" : "out";
    if (champ === career.clubId) {
      career.trophies++;
      career.gold += 1400;
      career.diamonds += 12;
      addManagerXp(career, 260);
      news(career, "🏆", "KUPA ŞAMPİYONU! Kupayı müzeye taşıdık. +1400🪙 +12💎", true);
    } else {
      news(career, "🏁", "Kupa finalinde kaybettik. Gelecek sezon tekrar deneyeceğiz.");
    }
    return;
  }
  const next = stages[stages.indexOf(stage) + 1];
  const rng = new Rng(hashStr(stage + career.season + winners.join("")) + Math.floor(Math.random() * 999));
  const shuffled = rng.shuffle([...winners]);
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    career.cup.push({ homeId: shuffled[i], awayId: shuffled[i + 1], hg: null, ag: null, stage: next });
  }
  if (userOut) {
    career.cupStage = "out";
    news(career, "😭", "Kupadan elendik. Ligye odaklanıyoruz.");
  } else {
    career.cupStage = next;
    news(career, "🎯", `Kupada ${next === "qf" ? "çeyrek finale" : next === "sf" ? "yarı finale" : "finale"} yükseldik!`, true);
  }
}

export function commitResult(world: World, career: Career, res: MatchResult): void {
  const cupTie = userCupTie(career);
  const cupMatch = !!cupTie;
  const homeIsUser = res.homeId === career.clubId;
  const my = homeIsUser ? res.hg : res.ag;
  const opp = homeIsUser ? res.ag : res.hg;

  // sonuç kaydı
  if (cupTie) {
    cupTie.hg = res.hg;
    cupTie.ag = res.ag;
    if (res.pens) {
      // penaltı sonucunu uzatma skoru olarak işleriz, kazananı belirler
      if (res.pens[0] !== res.pens[1]) {
        const userWon = (homeIsUser ? res.pens[0] > res.pens[1] : res.pens[1] > res.pens[0]);
        if (homeIsUser) { cupTie.hg = userWon ? (res.hg + 1) : res.hg; cupTie.ag = userWon ? res.ag : (res.ag + 1); }
        else { cupTie.hg = userWon ? res.hg : (res.hg + 1); cupTie.ag = userWon ? (res.ag + 1) : res.ag; }
      }
    }
  } else {
    const fx = career.fixtures.find((f) => f.round === career.round && (f.homeId === res.homeId && f.awayId === res.awayId));
    if (fx) { fx.hg = res.hg; fx.ag = res.ag; }
  }

  simulateOthers(world, career);
  if (cupMatch) resolveCupRound(career);

  // oyuncu istatistikleri
  const squad = squadOf(world, career.clubId);
  const inMatch = new Set([...career.lineup, ...career.subs]);
  const goalsByUser = res.goals.filter((g) => g.team === res.userTeam);
  void goalsByUser;
  const won = my > opp;
  for (const p of squad) {
    const played = inMatch.has(p.id);
    if (played) {
      p.stats.apps++;
      // reyting artık gerçek maç verisinden (gol/asist/kart/sonuç) hesaplanır
      const myGoals = res.goals.filter((g) => g.team === res.userTeam && g.scorer === p.name).length;
      const myAssists = res.goals.filter((g) => g.team === res.userTeam && g.assist === p.name).length;
      const myCards = res.cards.filter((cc) => cc.team === res.userTeam && cc.name === p.name);
      const base = opp === 0 ? 6.6 : won ? 6.9 : 6.3;
      p.stats.ratingSum += clamp(
        base + myGoals * 0.95 + myAssists * 0.5 - myCards.length * 0.35 + (p.pos === "GK" && opp === 0 ? 0.5 : 0),
        4, 10,
      );
      p.fitness = clamp(p.fitness - 8 + Math.random() * 6, 30, 100);
    } else {
      p.fitness = clamp(p.fitness + 6, 30, 100);
    }
    if (p.injury > 0) p.injury--;
    // form/moral kayması
    p.form = clamp(p.form + (played ? (won ? 3.5 : my === opp ? 0.6 : -2.6) : -0.4), 20, 100);
    p.morale = clamp(p.morale + (won ? 2.2 : my === opp ? 0.2 : -2.4) + bonusesOf(career).morale * 0.2, 40, 100);
    // sakatlık riski
    const risk = 0.016 * (1 - career.stadium.levels.medical * 0.055) * (played ? 1 : 0.25);
    if (Math.random() < risk) {
      p.injury = rngInt(1, 3);
      if (p.injury > 0) news(career, "🚑", `${p.name} sakatlandı — ${p.injury} hafta yok.`);
    }
    // antrenman gelişimi
    if (played) {
      const focus = career.training[p.id] as keyof Player | undefined;
      const gain = brainTrainingGain(p.age, overall(p), 90) * bonusesOf(career).growth;
      if (gain > 0.35) {
        const key: keyof Player = focus && focus !== "stats" ? focus : pickAttr(p);
        const before = overall(p);
        (p as unknown as Record<string, number>)[key as string] = clamp(
          ((p as unknown as Record<string, number>)[key as string] as number) + gain, 12, 99,
        );
        if (overall(p) > before) {
          p.value = Math.round(brainMarketValue(overall(p), p.age, p.pos) / 10) * 10;
        }
      }
    }
  }
  // gol/asil kayıtları (isim bazlı eşleme)
  for (const g of res.goals) {
    if (g.team !== res.userTeam) continue;
    const scorer = squad.find((p) => p.name === g.scorer);
    if (scorer) scorer.stats.goals++;
    const ast = squad.find((p) => p.name === g.assist);
    if (ast) ast.stats.assists++;
  }
  for (const c of res.cards) {
    if (c.team !== res.userTeam) continue;
    const p = squad.find((x) => x.name === c.name);
    if (!p) continue;
    if (c.kind === "Y") p.stats.yellow++;
    else { p.stats.red++; p.injury = Math.max(p.injury, 1); }
  }
  // kalesini gole kapama
  if (opp === 0) {
    const gkId = career.lineup[0];
    const gk = gkId ? world.players[gkId] : null;
    if (gk) { gk.stats.cs++; gk.stats.ratingSum += 0.6; }
  }

  // haftalık maaşlar
  const wageBill = squad.reduce((t, p) => t + p.wage, 0) * bonusesOf(career).wageCost;
  career.budget = Math.round(career.budget - wageBill);

  career.played++;
  bumpObjective(career, "matches", 1);
  bumpObjective(career, "goals", my);
  if (opp === 0) bumpObjective(career, "cleanSheets", 1);
  if (my > opp) {
    career.streak++;
    bumpObjective(career, "wins", 1);
    if (career.streak % 3 === 0) { career.diamonds += 3; news(career, "🔥", `${career.streak} maçlık galibiyet serisi! +3💎`); }
  } else {
    career.streak = 0;
  }

  // kulüp silinmiş olabilir (kendi takımın bir kulübün yerini aldı) → null güvenliği
  const hc = world.clubs[res.homeId];
  const ac = world.clubs[res.awayId];
  const summary = hc && ac ? `${hc.short} ${res.hg}-${res.ag} ${ac.short}` : `${res.hg}-${res.ag}`;
  news(career, my > opp ? "✅" : my === opp ? "➖" : "❌", `${cupMatch ? "Kupa" : "Lig"}: ${summary}`);

  career.round++;
  if (career.round > LEAGUE_ROUNDS) endSeason(world, career);
}

function pickAttr(p: Player): keyof Player {
  const keys: (keyof Player)[] = ["pac", "sho", "pas", "def", "phy"];
  if (p.pos === "GK") return "gk";
  const w: Record<string, number> = { ST: 1, LW: 1, RW: 1, AM: 1, CM: 1, DM: 1, CB: 1, LB: 1, RB: 1, LM: 1, RM: 1, GK: 0 };
  void w;
  return keys[Math.floor(Math.random() * keys.length)];
}

/* ------------------------------ SEZON SONU ------------------------------ */

export function endSeason(world: World, career: Career): void {
  const table = leagueTable(world, "lig_bymel", career.fixtures);
  const pos = table.findIndex((r) => r.clubId === career.clubId) + 1;
  const row = table[pos - 1];
  const prize = brainPrizeMoney(Math.max(1, pos), 14);
  career.budget += prize;
  career.gold += 800;
  career.diamonds += 10;
  const champion = pos === 1;
  if (champion) {
    career.trophies++;
    career.gold += 1600;
    career.diamonds += 15;
    addManagerXp(career, 420);
    news(career, "🏆", `SEZON ${career.season} ŞAMPİYONU! Lig kupası bizim. +1600🪙 +15💎`, true);
  } else {
    addManagerXp(career, 220);
    news(career, "📊", `Sezon ${career.season} tamamlandı. Lig sırası: ${pos}. Prim: 💶 ${(prize / 1000).toFixed(1)} Mn`);
  }
  career.history.push({ season: career.season, pos, pts: row ? row.pts : 0, champion, cup: career.cupStage === "won" ? "Kupa 🏆" : career.cupStage });

  // yaşlandırma / gelişim / gerileme
  const retireIds: string[] = [];
  for (const p of Object.values(world.players)) {
    p.age++;
    if (p.age <= 24) {
      const g = 1.6 + Math.random() * 2.4;
      bump(p, pickAttr(p), g * (1 + career.stadium.levels.academy * 0.05));
    } else if (p.age >= 31) {
      bump(p, "pac", -(0.8 + Math.random() * 1.6));
      bump(p, "phy", -(0.4 + Math.random() * 1.0));
    }
    // ID bazlı toplanır (aynı isimli oyuncular karışmasın)
    if (p.age >= 36 || (p.age >= 33 && p.age < 36 && Math.random() < 0.25)) retireIds.push(p.id);
    p.contract = Math.max(0, p.contract - 1);
    p.value = Math.round(brainMarketValue(overall(p), p.age, p.pos) / 10) * 10;
    p.form = 50; p.fitness = 100; p.injury = 0;
    p.stats = { apps: 0, goals: 0, assists: 0, yellow: 0, red: 0, cs: 0, ratingSum: 0, mom: 0 };
  }
  // emeklilik: kullanıcı kulübünden silinir, diğer kulüpler "regen" ile kadrosunu korur
  const myClub = career.clubId;
  for (const id of retireIds) {
    const p = world.players[id];
    if (!p) continue;
    if (p.teamId === myClub) {
      delete world.players[id];
      news(career, "👋", `${p.name} (${p.age}) futbolu bıraktı.`);
    } else {
      regenPlayer(world, p);
    }
  }
  // altyapıdan genç oyuncular
  const youthN = clamp(1 + Math.floor(career.stadium.levels.academy / 3), 1, 3);
  for (let i = 0; i < youthN; i++) graduateYouth(world, career);

  // yeni sezon
  career.season++;
  career.round = 1;
  career.fixtures = generateFixtures(leagueClubIds(world, "lig_bymel"), hashStr(career.clubId) + career.season * 977);
  career.cup = generateCup(world, hashStr(career.clubId) + career.season * 3313);
  career.cupStage = "r16";
  career.objectives = objectivesForSeason();
  career.market = generateMarket(world, career.clubId, career.manager.skills.scouting);
  career.streak = 0;
  reautoLineup(world, career);
  news(career, "🎊", `Sezon ${career.season} başlıyor! Yeni fikstür ve kupa kurası hazır.`, true);
}

function bump(p: Player, key: string, amount: number): void {
  const rec = p as unknown as Record<string, number>;
  rec[key] = clamp(Math.round((rec[key] + amount) * 10) / 10, 12, 99);
}

/**
 * Emekli olan oyuncunun yerine kulübe genç bir "regen" oyuncu üretilir.
 * Böylece yapay zekâ kulüpleri sezonlar ilerledikçe kadrosuz kalmaz.
 */
function regenPlayer(world: World, p: Player): void {
  const cl = world.clubs[p.teamId];
  const base = cl ? cl.rating : 68;
  const f = 0.615 + ((base - 46) / 44) * 0.44;
  const prof: Record<string, number> = { pac: 62, sho: 50, pas: 58, def: 54, phy: 56, gk: 60 };
  const region = LEAGUES.find((l) => l.id === cl?.leagueId)?.region ?? "eu";
  const pool = POOLS[region];
  p.name = pool.first[Math.floor(Math.random() * pool.first.length)] + " " +
    pool.last[Math.floor(Math.random() * pool.last.length)];
  p.nat = natsFor(region)[Math.floor(Math.random() * natsFor(region).length)];
  p.age = 18 + Math.floor(Math.random() * 3);
  p.num = 2 + Math.floor(Math.random() * 38);
  for (const k of Object.keys(prof)) {
    (p as unknown as Record<string, number>)[k] =
      clamp(Math.round(prof[k] * f + (Math.random() * 12 - 6)), 12, 99);
  }
  if (p.pos !== "GK") p.gk = clamp(Math.round(8 + Math.random() * 14), 5, 26);
  p.contract = 2 + Math.floor(Math.random() * 3);
  p.morale = 62 + Math.floor(Math.random() * 22);
  p.form = 45 + Math.floor(Math.random() * 20);
  p.fitness = 100;
  p.injury = 0;
  p.release = Math.round((p.value * 1.8) / 50) * 50;
  p.value = Math.round(brainMarketValue(overall(p), p.age, p.pos) / 10) * 10;
  p.wage = Math.round(clamp(p.value * 0.0042 + 1.5, 2, 420));
  p.stats = { apps: 0, goals: 0, assists: 0, yellow: 0, red: 0, cs: 0, ratingSum: 0, mom: 0 };
}

export function graduateYouth(world: World, career: Career): Player | null {
  const club = world.clubs[career.clubId];
  const rng = new Rng(hashStr("youth" + career.season + career.played + Math.random()));
  const pos = rng.pick(["CB", "LB", "RB", "DM", "CM", "AM", "LW", "RW", "ST", "GK"] as PosCode[]);
  const target = clamp(club.rating - 6 + career.stadium.levels.academy * 1.4 + career.manager.skills.youth * 1.1 + rng.gauss(0, 2), 46, 88);
  const id = "y" + Math.floor(Math.random() * 1e9).toString(36);
  const nat = rng.pick(["🇹🇷", "🇹🇷", "🇹🇷", "🇪🇺", "🌎", "🌍"]);
  const p: Player = {
    id, name: "Altyapı " + rng.int(10, 99) + " " + rng.pick(["Efe", "Kaan", "Tuna", "Arda", "Berk", "Mert", "Sinan", "Deniz"]),
    num: rng.int(30, 48), pos, age: rng.int(17, 19), nat, teamId: career.clubId,
    value: 300, wage: 3, morale: 82, injury: 0, contract: 3, release: 800,
    form: 55, fitness: 100,
    pac: 55, sho: 45, pas: 52, def: 48, phy: 52, gk: pos === "GK" ? 52 : 12,
    stats: { apps: 0, goals: 0, assists: 0, yellow: 0, red: 0, cs: 0, ratingSum: 0, mom: 0 },
  };
  const f = target / 60;
  const prof: Record<string, number> = { pac: 62, sho: 50, pas: 58, def: 54, phy: 56, gk: 55 };
  for (const k of Object.keys(prof)) {
    (p as unknown as Record<string, number>)[k] = clamp(Math.round(prof[k] * f + rng.gauss(0, 4)), 20, 99);
  }
  p.value = Math.round(brainMarketValue(overall(p), p.age, p.pos) / 10) * 10;
  p.wage = Math.max(2, Math.round(p.value * 0.003 + 1));
  world.players[id] = p;
  news(career, "🌱", `Altyapıdan ${p.name} (${p.pos}, OVR ${overall(p)}) A takıma çıkarıldı.`);
  return p;
}

/* ------------------------------ CPU DEĞİŞİKLİK KARARI ------------------------------ */

export function cpuShouldSub(minute: number, stamina: number, diff: number): boolean {
  return brainCpuSub(minute, stamina, diff);
}

/* ------------------------------ SERİLEŞTİRME ------------------------------ */

export function serializeCareer(c: Career): unknown {
  return {
    clubId: c.clubId, season: c.season, round: c.round, budget: c.budget, gold: c.gold,
    diamonds: c.diamonds, lineup: c.lineup, subs: c.subs, formation: c.formation,
    tactic: c.tactic, training: c.training, fixtures: c.fixtures, cup: c.cup,
    cupStage: c.cupStage, trophies: c.trophies, history: c.history, news: c.news,
    market: c.market, stadium: c.stadium, manager: c.manager, objectives: c.objectives,
    streak: c.streak, played: c.played, quickMode: c.quickMode,
  };
}

export function deserializeCareer(d: unknown, players: Record<string, Player>): Career {
  const o = d as Record<string, unknown>;
  const c = { ...o } as unknown as Career;
  // lineup/subs içindeki oyuncular artık yoksa temizle
  const valid = (id: string) => !!players[id];
  c.lineup = (c.lineup ?? []).filter(valid);
  c.subs = (c.subs ?? []).filter(valid);
  c.market = (c.market ?? []).filter((m) => !!m && !!m.player);
  c.objectives = c.objectives?.length ? c.objectives : objectivesForSeason();
  c.news = c.news ?? [];
  c.training = c.training ?? {};
  c.history = c.history ?? [];
  c.fixtures = c.fixtures ?? [];
  c.cup = c.cup ?? [];
  if (!c.stadium) {
    c.stadium = { name: "Arena", levels: { stands: 2, pitch: 2, lights: 1, screen: 1, academy: 1, medical: 1 }, theme: "modern" };
  }
  if (!c.manager) {
    c.manager = { name: "Menajer", level: 1, xp: 0, points: 0, skills: { training: 1, tactics: 1, negotiation: 1, motivation: 1, scouting: 1, youth: 1 }, reputation: 3 };
  }
  if (!c.tactic) c.tactic = defaultTactic(c.formation || "f442");
  return c;
}

export function leaguesOf(world: World) {
  return LEAGUES.map((l) => ({
    ...l,
    clubs: Object.values(world.clubs).filter((c) => c.leagueId === l.id).sort((a, b) => b.rating - a.rating),
  }));
}
