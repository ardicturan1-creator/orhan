/**
 * TWIN SOCCER — motor denge ölçüm aracı (headless, arayüz yok).
 *
 * Kullanım:
 *   npx tsx tools/sim.ts              → 20 CPU vs CPU maç + denge raporu
 *   npx tsx tools/sim.ts 40           → 40 maç
 *   npx tsx tools/sim.ts --season     → tam sezon (26 hafta + kupa) turu
 *   npx tsx tools/sim.ts --json       → makine okunur çıktı
 *
 * Ölçülen hedefler:
 *   - Maç başına ortalama gol ≈ 3-4
 *   - Şut başına isabet oranı ≈ %30-45, isabet başına gol ≈ %25-35
 *   - Güçlü (84) takım zayıfa (64) karşı çoğunlukla kazanmalı (ama hep değil)
 *   - Korner sayısı 0'a yakın olmamalı (savunma blokları çalışıyor mu?)
 *   - Maçlar "fulltime" fazına ulaşmalı, makul tick sayısında bitmeli
 */

import { initBrain, brainStatus } from "../src/game/brain";
import { generateWorld, autoLineup } from "../src/game/world";
import { MatchEngine, type TeamSetup } from "../src/game/engine";
import { newCareer, commitResult, userFixture, userCupTie } from "../src/game/career";
import { generateMarket } from "../src/game/career";
import type { Club, MatchSettings, MatchResult, Player, TeamTactic, World } from "../src/game/types";

interface Agg {
  matches: number; goals: number; shots: number; onTarget: number; corners: number;
  saves: number; ticks: number; fouls: number; tackles: number; passes: number;
  unfinished: number; goalsPerMatch: number;
}

const SETTINGS = (minutes: number, diff: number, realMinutes = 15): MatchSettings => ({
  minutes, realMinutes, difficulty: diff, sound: false, offside: true, autoSwitch: true,
  camera: "broadcast", assist: 0, quality: 0, haptics: false, commentary: false, faikMode: false,
});

function tacticFor(rating: number): TeamTactic {
  return {
    formation: rating >= 80 ? "f433" : rating >= 74 ? "f4231" : "f442",
    mentality: 50, pressing: 48, width: 50, lineHeight: 45, tempo: 50, passing: "mixed",
  };
}

function setup(world: World, club: Club, boost = 0, drain = 1): TeamSetup {
  const squad = Object.values(world.players).filter((p) => p.teamId === club.id);
  const lu = autoLineup(squad, tacticFor(club.rating).formation);
  const map = (ids: string[]): Player[] => ids.map((id) => world.players[id]).filter(Boolean);
  return {
    club, lineup: map(lu.lineup), subs: map(lu.subs),
    tactic: tacticFor(club.rating), boost, drain, homeAdv: 0,
  };
}

function playMatch(world: World, a: Club, b: Club, minutes: number, diff: number, realMinutes = Number(process.env.TS_REAL ?? 15)): { res: MatchResult; ticks: number } {
  const eng = new MatchEngine(setup(world, a), setup(world, b), SETTINGS(minutes, diff, realMinutes), false, () => { }, 424242 + (Number(process.env.TS_SEED ?? 0)));
  eng.userTeam = null;
  let ticks = 0;
  const guard = 60 * 60 * 30;
  while (eng.phase !== "fulltime" && eng.phase !== "pens" && ticks < guard) {
    if (eng.phase === "halftime") eng.resumeSecondHalf();
    eng.step();
    ticks++;
  }
  if (eng.phase !== "fulltime" && eng.phase !== "pens") eng.finishMatch();
  return { res: eng.getResult(), ticks };
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const season = args.includes("--season");
  const nArg = args.find((a) => /^\d+$/.test(a));
  const N = nArg ? parseInt(nArg, 10) : 20;

  const seed = 20260101;
  initBrain(seed);
  const world = generateWorld(seed);

  if (json) console.log(JSON.stringify({ brain: brainStatus() }));
  else console.log("TWIN SOCCER · MOTOR DENGE ARACI");
  console.log("Lua beyin:", brainStatus().lua ? "AKTİF" : "TS YEDEĞİ");

  /* ---------- 1) Güçlü (84) vs Zayıf (64) ---------- */
  const all = Object.values(world.clubs).sort((x, y) => y.rating - x.rating);
  const strong = all[0];
  const weak = all[all.length - 1];
  let strongWins = 0, draws = 0, weakWins = 0;
  const agg: Agg = {
    matches: 0, goals: 0, shots: 0, onTarget: 0, corners: 0, saves: 0, ticks: 0,
    fouls: 0, tackles: 0, passes: 0, unfinished: 0, goalsPerMatch: 0,
  };

  for (let i = 0; i < N; i++) {
    const pair: [Club, Club] = i % 2 === 0 ? [strong, weak] : [weak, strong];
    const { res, ticks } = playMatch(world, pair[0], pair[1], 90, 2);
    agg.matches++;
    agg.goals += res.hg + res.ag;
    agg.shots += res.stats.shots[0] + res.stats.shots[1];
    agg.onTarget += res.stats.onTarget[0] + res.stats.onTarget[1];
    agg.corners += res.stats.corners[0] + res.stats.corners[1];
    agg.saves += res.stats.saves[0] + res.stats.saves[1];
    agg.fouls += res.stats.fouls[0] + res.stats.fouls[1];
    agg.tackles += res.stats.tackles[0] + res.stats.tackles[1];
    agg.passes += res.stats.passes[0] + res.stats.passes[1];
    agg.ticks += ticks;
    if (res.pens) agg.unfinished++;
    if (res.hg > res.ag) { if (pair[0] === strong) strongWins++; else weakWins++; }
    else if (res.hg < res.ag) { if (pair[1] === strong) strongWins++; else weakWins++; }
    else draws++;
  }

  /* ---------- 2) Dengeli maçlar (gol üretimi) ---------- */
  const mid = all.filter((c) => c.rating >= 74 && c.rating <= 78);
  const agg2: Agg = { ...agg, matches: 0, goals: 0, shots: 0, onTarget: 0, corners: 0, saves: 0, ticks: 0, fouls: 0, tackles: 0, passes: 0, unfinished: 0 };
  for (let i = 0; i < N; i++) {
    const a = mid[i % mid.length];
    const b = mid[(i * 3 + 1) % mid.length];
    if (a.id === b.id) continue;
    const { res, ticks } = playMatch(world, a, b, 90, 2);
    agg2.matches++;
    agg2.goals += res.hg + res.ag;
    agg2.shots += res.stats.shots[0] + res.stats.shots[1];
    agg2.onTarget += res.stats.onTarget[0] + res.stats.onTarget[1];
    agg2.corners += res.stats.corners[0] + res.stats.corners[1];
    agg2.saves += res.stats.saves[0] + res.stats.saves[1];
    agg2.passes += res.stats.passes[0] + res.stats.passes[1];
    agg2.tackles += res.stats.tackles[0] + res.stats.tackles[1];
    agg2.ticks += ticks;
    if (res.pens) agg2.unfinished++;
  }

  const rep = (name: string, a: Agg): Record<string, number> => ({
    maç: a.matches,
    golMaç: +(a.goals / Math.max(1, a.matches)).toFixed(2),
    şutMaç: +(a.shots / Math.max(1, a.matches)).toFixed(1),
    isabetŞut: +((a.onTarget / Math.max(1, a.shots)) * 100).toFixed(1),
    golİsabet: +((a.goals / Math.max(1, a.onTarget)) * 100).toFixed(1),
    kornerMaç: +(a.corners / Math.max(1, a.matches)).toFixed(1),
    kurtarışMaç: +(a.saves / Math.max(1, a.matches)).toFixed(1),
    pasMaç: +(a.passes / Math.max(1, a.matches)).toFixed(0),
    müdahaleMaç: +(a.tackles / Math.max(1, a.matches)).toFixed(1),
    faulMaç: +(a.fouls / Math.max(1, a.matches)).toFixed(1),
    tickOrt: Math.round(a.ticks / Math.max(1, a.matches)),
    penaltı: a.unfinished,
  });

  if (json) {
    console.log(JSON.stringify({
      strongVsWeak: { strong: strong.name, weak: weak.name, strongWins, draws, weakWins },
      strongWeak: rep("sw", agg),
      balanced: rep("bal", agg2),
    }, null, 2));
  } else {
    console.log(`\n── GÜÇLÜ (${strong.rating}) vs ZAYIF (${weak.rating}) · ${agg.matches} maç ──`);
    console.log(`  Güçlü kazandı: ${strongWins} · Berabere: ${draws} · Zayıf kazandı: ${weakWins}`);
    console.log(`  Kazanma oranı: %${((strongWins / Math.max(1, agg.matches)) * 100).toFixed(0)}`);
    console.log(`  Gol/maç: ${(agg.goals / Math.max(1, agg.matches)).toFixed(2)} · Şut/maç: ${(agg.shots / Math.max(1, agg.matches)).toFixed(1)}`);
    console.log(`  İS/ŞUT: %${((agg.onTarget / Math.max(1, agg.shots)) * 100).toFixed(1)} · GOL/İS: %${((agg.goals / Math.max(1, agg.onTarget)) * 100).toFixed(1)}`);
    console.log(`  Korner/maç: ${(agg.corners / Math.max(1, agg.matches)).toFixed(1)} · Kurtarış/maç: ${(agg.saves / Math.max(1, agg.matches)).toFixed(1)}`);
    console.log(`  Ortalama tick: ${Math.round(agg.ticks / Math.max(1, agg.matches))} (90 dk gösterilen · 15 dk gerçek)`);
    console.log(`\n── DENGELİ MAÇLAR · ${agg2.matches} maç ──`);
    console.log(`  Gol/maç: ${(agg2.goals / Math.max(1, agg2.matches)).toFixed(2)}`);
    console.log(`  Şut/maç: ${(agg2.shots / Math.max(1, agg2.matches)).toFixed(1)} · Korner/maç: ${(agg2.corners / Math.max(1, agg2.matches)).toFixed(1)}`);
    console.log(`  İS/ŞUT: %${((agg2.onTarget / Math.max(1, agg2.shots)) * 100).toFixed(1)} · GOL/İS: %${((agg2.goals / Math.max(1, agg2.onTarget)) * 100).toFixed(1)}`);
  }

  /* ---------- 3) Tam sezon turu ---------- */
  if (season) {
    const w = generateWorld(seed + 7);
    const clubId = Object.values(w.clubs)[0].id;
    const career = newCareer(w, clubId, false, Object.values(w.clubs)[0].name + " Arena");
    career.market = generateMarket(w, clubId, 0);
    w.career = career;
    let played = 0;
    const t0 = Date.now();
    while (career.season === 1 && career.round <= 26 && Date.now() - t0 < 60000) {
      const tie = userCupTie(career);
      const fx = userFixture(career);
      if (!tie && !fx) break;
      const homeId = tie ? tie.homeId : fx!.homeId;
      const awayId = tie ? tie.awayId : fx!.awayId;
      const { res } = playMatch(w, w.clubs[homeId], w.clubs[awayId], 4, 2);
      res.userTeam = homeId === clubId ? 0 : 1;
      commitResult(w, career, res);
      played++;
    }
    console.log(`\n── SEZON SİMÜLASYONU ──`);
    console.log(`  Oynanan maç: ${played}`);
    console.log(`  Sezon: ${career.season} · Hafta: ${career.round}`);
    console.log(`  Altın: ${career.gold} · Elmas: ${career.diamonds} · Bütçe: ${career.budget}`);
    console.log(`  Kadro: ${Object.values(w.players).filter((p) => p.teamId === clubId).length} oyuncu`);
    console.log(`  Kupa durumu: ${career.cupStage} · Haber sayısı: ${career.news.length}`);
    console.log(`  Haber örneği: ${career.news[0]?.text ?? "—"}`);
  }
}

main();
