import { CLUBS, CLUB_MAP, clubsOfLeague } from "./data/clubs";
import { overall } from "./formations";
import { marketValue, prizeMoney, simMatch, trainingGain } from "./brain";
import { RNG, clamp } from "./rng";
import { autoLineup } from "./world";
import { addXp, bonusesOf, bumpObjective, newManager, newObjectives, newStadium } from "./economy";
import type {
  Career,
  CupRoundInfo,
  CupTie,
  Fixture,
  MatchResult,
  Player,
  TableRow,
  TeamTactic,
  World,
} from "./types";

export type { CupRoundInfo, CupTie };

/* ============================================================
 *  BYMEL SOCCER — Kariyer / sezon motoru
 * ============================================================ */

export const CUP_ROUND_NAMES = ["Son 16", "Çeyrek Final", "Yarı Final", "FİNAL"];
export const CUP_AFTER_ROUND = [5, 11, 17, 22];
export const LEAGUE_SIZE = 14;

export const defaultTactic = (formation = "442"): TeamTactic => ({
  formation,
  mentality: 55,
  pressing: 55,
  width: 50,
  lineHeight: 50,
  tempo: 55,
  passing: "mixed",
});

/* --------------------------- fikstür --------------------------- */
export function generateFixtures(clubIds: string[], seed = 7): Fixture[] {
  const rng = new RNG(seed);
  const ids = [...clubIds];
  // rastgele karıştır
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const n = ids.length;
  const rounds: [string, string][][] = [];
  const arr = [...ids];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    // rotasyon (ilk eleman sabit)
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop()!);
    arr.splice(0, arr.length, fixed, ...rest);
  }
  const fixtures: Fixture[] = [];
  rounds.forEach((pairs, r) => {
    pairs.forEach(([h, a]) => fixtures.push({ round: r, home: h, away: a, hg: null, ag: null, comp: "league" }));
  });
  rounds.forEach((pairs, r) => {
    pairs.forEach(([h, a]) => fixtures.push({ round: r + n - 1, home: a, away: h, hg: null, ag: null, comp: "league" }));
  });
  return fixtures;
}

export function generateCup(world: World, seed: number): CupRoundInfo[] {
  const rng = new RNG(seed + 999);
  const sl = clubsOfLeague("sl").map((c) => c.id);
  const others = CLUBS.filter((c) => c.leagueId !== "sl")
    .sort((a, b) => clubRatingOf(world, b.id) - clubRatingOf(world, a.id))
    .slice(0, 2)
    .map((c) => c.id);
  const pool = [...sl, ...others];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const first: CupTie[] = [];
  for (let i = 0; i < pool.length; i += 2) first.push({ home: pool[i], away: pool[i + 1], hg: null, ag: null });
  return [
    { name: CUP_ROUND_NAMES[0], ties: first, done: false },
    { name: CUP_ROUND_NAMES[1], ties: [], done: false },
    { name: CUP_ROUND_NAMES[2], ties: [], done: false },
    { name: CUP_ROUND_NAMES[3], ties: [], done: false },
  ];
}

function clubRatingOf(world: World, clubId: string) {
  const { lineup } = autoLineup(world, clubId, "442");
  if (!lineup.length) return CLUB_MAP[clubId]?.rating ?? 70;
  return lineup.reduce((a, id) => a + overall(world.players[id]), 0) / lineup.length;
}

/* --------------------------- kariyer kurulum --------------------------- */
export function newCareer(world: World, clubId: string, formation = "442"): Career {
  const { lineup, subs } = autoLineup(world, clubId, formation);
  const market = generateMarket(world, Date.now() % 100000);
  const club = CLUB_MAP[clubId];
  return {
    clubId,
    season: 1,
    round: 0,
    budget: Math.round(club.budget * 0.35),
    gold: 2200,
    diamonds: 30,
    stadium: newStadium(club.short),
    manager: newManager(),
    objectives: newObjectives(),
    streak: 0,
    played: 0,
    lineup,
    subs,
    formation,
    tactic: defaultTactic(formation),
    training: {},
    fixtures: generateFixtures(clubsOfLeague("sl").map((c) => c.id), 2026 + 1),
    cup: generateCup(world, 2026),
    cupStage: 0,
    trophies: [],
    history: [],
    news: [{ t: 1, text: `${CLUB_MAP[clubId].name} teknik direktörü olarak hoş geldin! Taraftar seni bekliyor.` }],
    market,
    wageBudget: 0,
  };
}

export function generateMarket(world: World, seed: number, quality = 0): string[] {
  const rng = new RNG(seed);
  let pool = Object.values(world.players).filter((p) => p.teamId !== "FREE" && p.teamId !== "RET");
  if (quality > 0) {
    // gözlemcilik arttıkça listeye daha kaliteli oyuncular düşer
    const sorted = pool.slice().sort((a, b) => overall(b) - overall(a));
    const cut = Math.max(60, Math.round(sorted.length * clamp(1 - quality / 45, 0.25, 1)));
    pool = sorted.slice(0, cut);
  }
  const picked: string[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (picked.length < 48 && guard++ < 2000) {
    const p = pool[Math.floor(rng.next() * pool.length)];
    if (!p || used.has(p.id)) continue;
    used.add(p.id);
    picked.push(p.id);
  }
  return picked;
}

/* --------------------------- puan durumu --------------------------- */
export function leagueTable(career: Career): TableRow[] {
  const map: Record<string, TableRow> = {};
  for (const c of clubsOfLeague("sl")) {
    map[c.id] = { clubId: c.id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] };
  }
  for (const f of career.fixtures) {
    if (f.hg === null || f.ag === null) continue;
    const h = map[f.home];
    const a = map[f.away];
    if (!h || !a) continue;
    h.p++; a.p++;
    h.gf += f.hg; h.ga += f.ag;
    a.gf += f.ag; a.ga += f.hg;
    if (f.hg > f.ag) { h.w++; h.pts += 3; a.l++; h.form.push("W"); a.form.push("L"); }
    else if (f.hg < f.ag) { a.w++; a.pts += 3; h.l++; a.form.push("W"); h.form.push("L"); }
    else { h.d++; a.d++; h.pts++; a.pts++; h.form.push("D"); a.form.push("D"); }
  }
  return Object.values(map)
    .map((r) => ({ ...r, form: r.form.slice(-5) }))
    .sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf || a.clubId.localeCompare(b.clubId));
}

export function userPosition(career: Career): number {
  const t = leagueTable(career);
  return t.findIndex((r) => r.clubId === career.clubId) + 1;
}

/* --------------------------- sonraki maç --------------------------- */
export interface NextMatch {
  kind: "league" | "cup";
  home: string;
  away: string;
  fixture?: Fixture;
  cupRound?: number;
  label: string;
}

export function nextMatch(_world: World, career: Career): NextMatch | null {
  // kupada oynanacak tur var mı?
  if (career.cupStage < 4) {
    const after = CUP_AFTER_ROUND[career.cupStage];
    if (career.round >= after) {
      const stage = career.cup[career.cupStage];
      if (stage && !stage.done) {
        const tie = stage.ties.find((t) => (t.home === career.clubId || t.away === career.clubId) && t.hg === null);
        if (tie) {
          return {
            kind: "cup",
            home: tie.home,
            away: tie.away,
            cupRound: career.cupStage,
            label: `BYMEL Kupası · ${stage.name}`,
          };
        }
      }
    }
  }
  if (career.round >= 26) return null;
  const fx = career.fixtures.find((f) => f.round === career.round && (f.home === career.clubId || f.away === career.clubId));
  if (!fx) return null;
  return {
    kind: "league",
    home: fx.home,
    away: fx.away,
    fixture: fx,
    label: `Süper Lig · ${career.round + 1}. Hafta`,
  };
}

/* --------------------------- maç sonrası --------------------------- */
export function simulateOthers(world: World, career: Career, opts = { league: true, cup: true }) {
  if (opts.league) {
    for (const f of career.fixtures) {
      if (f.round !== career.round || f.hg !== null) continue;
      if (f.home === career.clubId || f.away === career.clubId) continue;
      const hr = clubRatingOf(world, f.home);
      const ar = clubRatingOf(world, f.away);
      const r = simMatch(hr, ar, 1);
      f.hg = r.hg;
      f.ag = r.ag;
    }
  }
  if (opts.cup) {
    const stage = career.cup[career.cupStage];
    if (stage && !stage.done) {
      for (const tie of stage.ties) {
        if (tie.hg !== null) continue;
        if (tie.home === career.clubId || tie.away === career.clubId) continue;
        const r = simMatch(clubRatingOf(world, tie.home), clubRatingOf(world, tie.away), 1);
        tie.hg = r.hg;
        tie.ag = r.ag;
        if (tie.hg === tie.ag) tie.pens = pensOf(world, tie.home, tie.away);
      }
    }
  }
}

function pensOf(world: World, a: string, b: string): [number, number] {
  const ra = clubRatingOf(world, a);
  const rb = clubRatingOf(world, b);
  let x = 0;
  let y = 0;
  const rng = new RNG(Math.floor(Math.random() * 1e9));
  for (let i = 0; i < 5; i++) {
    if (rng.next() < 0.72 + (ra - rb) * 0.003) x++;
    if (rng.next() < 0.72 + (rb - ra) * 0.003) y++;
  }
  while (x === y) {
    if (rng.next() < 0.75) x++;
    if (rng.next() < 0.75) y++;
  }
  return [x, y];
}

export function finishCupStage(world: World, career: Career) {
  const stage = career.cup[career.cupStage];
  if (!stage || stage.done) return;
  // kullanıcı maçı sonucu işlendi mi? Kontrol et, eksikse simüle et
  for (const tie of stage.ties) {
    if (tie.hg === null) {
      const r = simMatch(clubRatingOf(world, tie.home), clubRatingOf(world, tie.away), 1);
      tie.hg = r.hg;
      tie.ag = r.ag;
      if (tie.hg === tie.ag) tie.pens = pensOf(world, tie.home, tie.away);
    }
  }
  stage.done = true;
  const winners = stage.ties.map((t) => {
    if (t.hg! > t.ag!) return t.home;
    if (t.ag! > t.hg!) return t.away;
    return (t.pens && t.pens[0] > t.pens[1]) ? t.home : t.away;
  });
  const loserIsUser = stage.ties.some(
    (t) => (t.home === career.clubId || t.away === career.clubId) &&
      !winners.includes(career.clubId)
  );
  if (winners.length > 1) {
    const next = career.cup[career.cupStage + 1];
    if (next) {
      next.ties = [];
      for (let i = 0; i < winners.length; i += 2) {
        next.ties.push({ home: winners[i], away: winners[i + 1], hg: null, ag: null });
      }
    }
  } else if (winners.length === 1 && winners[0] === career.clubId) {
    career.trophies.push(`BYMEL Kupası · ${career.season}. Sezon`);
    career.news.unshift({ t: career.round + 1, text: `🏆 KUPA KAZANILDI! ${CLUB_MAP[career.clubId].name} BYMEL Kupası'nın sahibi oldu!` });
    career.budget += 9000;
  }
  if (loserIsUser) {
    career.news.unshift({ t: career.round + 1, text: `Kupadan elendik. Gözler ligde.` });
  }
  career.cupStage++;
}

export function commitResult(world: World, career: Career, res: MatchResult) {
  const isUserHome = res.homeClubId === career.clubId;
  if (res.pens) {
    const tie = career.cup[career.cupStage]?.ties.find(
      (t) => t.home === res.homeClubId && t.away === res.awayClubId
    );
    if (tie) {
      tie.hg = res.hg;
      tie.ag = res.ag;
      tie.pens = res.pens;
    }
  } else if (nextMatch(world, career)?.kind === "cup") {
    const tie = career.cup[career.cupStage]?.ties.find(
      (t) => t.home === res.homeClubId && t.away === res.awayClubId
    );
    if (tie) {
      tie.hg = res.hg;
      tie.ag = res.ag;
      if (res.hg === res.ag) {
        const rng = new RNG(Math.floor(Math.random() * 1e9));
        let a = 0;
        let b = 0;
        for (let i = 0; i < 5; i++) {
          if (rng.next() < 0.75) a++;
          if (rng.next() < 0.75) b++;
        }
        while (a === b) {
          if (rng.next() < 0.75) a++;
          if (rng.next() < 0.75) b++;
        }
        tie.pens = [a, b];
      }
    }
  } else {
    const fx = career.fixtures.find(
      (f) => f.round === career.round && f.home === res.homeClubId && f.away === res.awayClubId
    );
    if (fx) {
      fx.hg = res.hg;
      fx.ag = res.ag;
    }
  }

  // oyuncu istatistikleri
  const bon = bonusesOf(career);
  const userGf = isUserHome ? res.hg : res.ag;
  const userGa = isUserHome ? res.ag : res.hg;
  for (const s of res.scorers) {
    const p = world.players[s.playerId];
    if (p) p.stats.goals++;
  }
  for (const [id, rating] of Object.entries(res.ratings)) {
    const p = world.players[id];
    if (!p) continue;
    p.stats.apps++;
    p.stats.ratingSum += rating;
    p.form = clamp(p.form * 0.65 + (rating - 4) * 16, 0, 100);
    const userMatch = p.teamId === career.clubId;
    if (userMatch) {
      p.morale = clamp(p.morale + (rating - 6.5) * 4 + bon.morale * 0.12, 20, 100);
      p.fitness = clamp(p.fitness - 26 * bon.staminaDrain + 6, 25, 100);
      // sakatlık riski — saha zemini ve sağlık merkezi azaltır
      if (Math.random() < 0.035 * bon.staminaDrain) {
        p.injury = 1 + Math.floor(Math.random() * 3);
        career.news.unshift({ t: career.round + 1, text: `🚑 ${p.name} sakatlandı (${p.injury} hafta).` });
      }
      // idman gelişimi
      const focus = career.training[p.id];
      const gain = trainingGain(p.age, overall(p), 90) * (rating / 6.5) * bon.growth;
      if (focus && Math.random() < 0.55) {
        const key = focus as "pac" | "sho" | "pas" | "def" | "phy";
        if (p[key] < 99) p[key] = clamp(p[key] + (Math.random() < gain / 2 ? 1 : 0), 20, 99);
        p.value = marketValue(overall(p), p.age, p.pos);
      }
    }
  }
  for (const c of res.cards) {
    const p = world.players[c.playerId];
    if (!p) continue;
    if (c.type === "y") p.stats.yellow++;
    else p.stats.red++;
  }
  // kadro dışı oyuncular dinlenir
  for (const p of Object.values(world.players)) {
    if (p.teamId !== career.clubId) continue;
    if (res.ratings[p.id] === undefined) p.fitness = clamp(p.fitness + 18 * bon.healing, 0, 100);
  }
  // maaşlar
  const squad = Object.values(world.players).filter((p) => p.teamId === career.clubId);
  const wages = squad.reduce((a, p) => a + p.wage, 0) * bon.wageCost;
  career.budget -= Math.round(wages / 8);
  career.budget = Math.round(career.budget);

  // seri, görevler ve menajer tecrübesi
  career.played++;
  const won = userGf > userGa;
  career.streak = won ? career.streak + 1 : 0;
  bumpObjective(career, "play5", 1);
  if (won) bumpObjective(career, "win3", 1);
  bumpObjective(career, "score8", userGf);
  if (userGa === 0) bumpObjective(career, "clean3", 1);
  addXp(career, 0);

  career.news.unshift({
    t: career.round + 1,
    text: `${CLUB_MAP[res.homeClubId].short} ${res.hg} - ${res.ag} ${CLUB_MAP[res.awayClubId].short}${
      res.pens ? ` (${res.pens[0]}-${res.pens[1]} pen)` : ""
    }`,
  });
  career.news = career.news.slice(0, 24);
}

export function advance(world: World, career: Career, played: "league" | "cup" | "none" = "none") {
  if (played === "cup") {
    simulateOthers(world, career, { league: false, cup: true });
    finishCupStage(world, career);
  } else if (played === "league") {
    simulateOthers(world, career, { league: true, cup: false });
    career.round++;
  }

  // kullanıcının yer almadığı / elendiği kupa turlarını otomatik ilerlet
  let guard = 0;
  while (guard++ < 5) {
    if (career.cupStage >= 4) break;
    const stage = career.cup[career.cupStage];
    if (!stage || stage.done) break;
    if (career.round < CUP_AFTER_ROUND[career.cupStage]) break;
    const userTie = stage.ties.find(
      (t) => (t.home === career.clubId || t.away === career.clubId) && t.hg === null
    );
    if (userTie) break;
    simulateOthers(world, career, { league: false, cup: true });
    finishCupStage(world, career);
  }

  // sakatlık sayaçları
  for (const p of Object.values(world.players)) {
    if (p.injury > 0) p.injury--;
  }
}

export function seasonEnded(career: Career) {
  return career.round >= 26 && career.cupStage >= 4;
}

export function endSeason(world: World, career: Career) {
  const table = leagueTable(career);
  const pos = table.findIndex((r) => r.clubId === career.clubId) + 1;
  const row = table[pos - 1];
  career.history.push({ season: career.season, pos, pts: row?.pts ?? 0 });
  const money = prizeMoney(pos, LEAGUE_SIZE);
  career.budget += money;
  if (pos === 1) {
    career.trophies.push(`BYMEL Süper Lig · ${career.season}. Sezon`);
    career.news.unshift({ t: 0, text: `🏆 ŞAMPİYON! ${CLUB_MAP[career.clubId].name} ligi kazandı!` });
  }
  // yaşlandırma & gelişim
  const all = Object.values(world.players);
  for (const p of all) {
    p.age++;
    if (p.age <= 24) {
      const bump = Math.random() < 0.6 ? 1 : 0;
      if (bump) {
        const keys: (keyof Player)[] = ["pac", "sho", "pas", "def", "phy"];
        const k = keys[Math.floor(Math.random() * keys.length)];
        (p as any)[k] = clamp((p as any)[k] + 1 + (Math.random() < 0.25 ? 1 : 0), 20, 99);
      }
    } else if (p.age >= 31) {
      const keys: (keyof Player)[] = ["pac", "phy"];
      const k = keys[Math.floor(Math.random() * keys.length)];
      (p as any)[k] = clamp((p as any)[k] - (1 + (Math.random() < 0.4 ? 1 : 0)), 20, 99);
    }
    p.value = marketValue(overall(p), p.age, p.pos);
    p.fitness = 100;
    p.form = clamp(p.form * 0.5 + 30, 0, 100);
    if (p.injury > 0) p.injury = Math.max(0, p.injury - 2);
    // sözleşme yılı işler
    if (p.teamId !== "FREE" && p.teamId !== "RET") {
      p.contract = Math.max(0, p.contract - 1);
      if (p.contract <= 0) {
        const wasUser = p.teamId === career.clubId;
        p.teamId = "FREE";
        if (wasUser) {
          career.news.unshift({ t: 0, text: `📄 ${p.name} sözleşmesi bitti ve serbest kaldı.` });
        }
      }
    }
    if (p.age > 36 || (p.age > 33 && Math.random() < 0.25)) {
      p.teamId = "RET";
    }
  }
  // altyapıdan çıkan gençler
  graduateYouth(world, career);
  // emekli olanları yenile
  for (const club of CLUBS) {
    let squad = Object.values(world.players).filter((p) => p.teamId === club.id);
    while (squad.length < 20) {
      const rng = new RNG(Math.floor(Math.random() * 1e9));
      const nid = `p_${club.id}_g${career.season}_${squad.length}_${Math.floor(Math.random() * 9999)}`;
      const posPool: Player["pos"][] = ["CB", "LB", "RB", "DM", "CM", "AM", "LM", "RM", "LW", "RW", "ST", "GK"];
      const np: Player = {
        id: nid,
        name: `${rng.pick(["Deniz", "Kaan", "Efe", "Onur", "Berk", "Yiğit", "Alp", "Cem"])} ${rng.pick(["Yılmaz", "Aksoy", "Bulut", "Kaya", "Duman", "Er", "Şen"])}`,
        num: 20 + squad.length,
        pos: posPool[Math.floor(rng.next() * posPool.length)],
        age: rng.int(17, 22),
        nat: "🇹🇷",
        teamId: club.id,
        pac: club.rating - rng.int(2, 12),
        sho: club.rating - rng.int(2, 12),
        pas: club.rating - rng.int(2, 12),
        def: club.rating - rng.int(2, 12),
        phy: club.rating - rng.int(2, 12),
        gk: club.rating - rng.int(2, 10),
        value: 0,
        wage: 0,
        morale: 70,
        injury: 0,
        contract: rng.int(2, 4),
        release: 0,
        form: 55,
        fitness: 100,
        stats: { apps: 0, goals: 0, assists: 0, yellow: 0, red: 0, cs: 0, ratingSum: 0, mom: 0 },
      };
      np.value = marketValue(overall(np), np.age, np.pos);
      np.wage = Math.max(1, Math.round(np.value * 0.028 + 1));
      world.players[nid] = np;
      squad = [...squad, np];
    }
  }
  // kademe kaybı: küme düşme yok ama bütçe yenilenir
  career.season++;
  career.round = 0;
  career.cupStage = 0;
  career.fixtures = generateFixtures(clubsOfLeague("sl").map((c) => c.id), 2026 + career.season);
  career.cup = generateCup(world, 2026 + career.season * 13);
  career.market = generateMarket(world, Date.now() % 100000 + career.season * 7, bonusesOf(career).scoutQuality);
  const auto = autoLineup(world, career.clubId, career.formation);
  career.lineup = auto.lineup;
  career.subs = auto.subs;
  career.budget += Math.round(CLUB_MAP[career.clubId].budget * 0.12);
  career.objectives = newObjectives();
  career.streak = 0;
  career.gold += 800;
  career.diamonds += 10;
  addXp(career, 260);
  career.news.unshift({
    t: 0,
    text: `${career.season}. sezon başladı! Transfer bütçen güncellendi. +800 🪙 +10 💎`,
  });
}

/* --------------------------- altyapı --------------------------- */
export function graduateYouth(world: World, career: Career) {
  const lvl = career.stadium.levels.academy;
  const bon = bonusesOf(career);
  const count = lvl >= 6 ? 3 : lvl >= 3 ? 2 : 1;
  const rng = new RNG(Math.floor(Math.random() * 1e9));
  const club = CLUB_MAP[career.clubId];
  const posPool: Player["pos"][] = ["CB", "LB", "RB", "DM", "CM", "AM", "LM", "RM", "LW", "RW", "ST", "GK"];
  for (let i = 0; i < count; i++) {
    const pos = rng.pick(posPool);
    const base = clamp(club.rating - 16 + lvl * 2.5 + bon.scoutQuality * 0.6 + rng.int(0, 6), 40, 82);
    const id = `y_${career.clubId}_${career.season}_${i}_${rng.int(1000, 9999)}`;
    const np: Player = {
      id,
      name: `${rng.pick(["Ali", "Mert", "Kerem", "Emir", "Arda", "Doruk", "Poyraz", "Tuna", "Bora", "Ege"])} ${rng.pick(["Yılmaz", "Aksoy", "Bulut", "Kaya", "Duman", "Erdem", "Şen", "Aydın"])}`,
      num: rng.int(30, 60),
      pos,
      age: rng.int(16, 18),
      nat: "🇹🇷",
      teamId: career.clubId,
      pac: Math.round(base + rng.int(-4, 6)),
      sho: Math.round(base + rng.int(-6, 5)),
      pas: Math.round(base + rng.int(-5, 5)),
      def: Math.round(base + rng.int(-6, 5)),
      phy: Math.round(base + rng.int(-7, 4)),
      gk: pos === "GK" ? Math.round(base + rng.int(-2, 6)) : rng.int(10, 26),
      value: 0,
      wage: 0,
      morale: 85,
      injury: 0,
      contract: 3,
      release: 0,
      form: 60,
      fitness: 100,
      stats: { apps: 0, goals: 0, assists: 0, yellow: 0, red: 0, cs: 0, ratingSum: 0, mom: 0 },
    };
    np.value = marketValue(overall(np), np.age, np.pos);
    np.wage = Math.max(1, Math.round(np.value * 0.02 + 1));
    world.players[id] = np;
    career.news.unshift({ t: 0, text: `🌱 Altyapıdan ${np.name} (${overall(np)} OVR, ${np.age}) A takıma yükseldi.` });
  }
}

/* --------------------------- sözleşmeler --------------------------- */
export interface ContractOffer {
  years: number;
  wage: number;
  signing: number;
  accept: number; // 0..1 kabul olasılığı
}

/** Oyuncunun yeni sözleşme talebini hesaplar. */
export function contractDemand(p: Player, career: Career, years: number): ContractOffer {
  const bon = bonusesOf(career);
  const ageMul = p.age <= 23 ? 0.85 : p.age <= 29 ? 1.15 : 0.8;
  const formMul = 0.9 + p.form / 250;
  const base = Math.max(2, Math.round(p.wage * 1.25 * ageMul * formMul * bon.wageCost));
  const signing = Math.round(base * years * 2.2);
  const moraleMul = clamp(0.55 + p.morale / 140 + career.manager.reputation / 260, 0.4, 1);
  return { years, wage: base, signing, accept: clamp(moraleMul, 0.15, 0.98) };
}

export function renewContract(
  world: World,
  career: Career,
  playerId: string,
  years: number,
  wageBoost = 0
): { ok: boolean; msg: string } {
  const p = world.players[playerId];
  if (!p) return { ok: false, msg: "Oyuncu bulunamadı." };
  if (p.teamId !== career.clubId) return { ok: false, msg: "Oyuncu kadroda değil." };
  const off = contractDemand(p, career, years);
  const wage = Math.round(off.wage * (1 + wageBoost));
  const cost = Math.round(off.signing * (1 + wageBoost * 0.5));
  if (career.budget < cost) return { ok: false, msg: `İmza bedeli için €${(cost / 1000).toFixed(1)}M gerekiyor.` };
  const chance = clamp(off.accept + wageBoost * 1.6 + career.manager.skills.negotiation * 0.04, 0.05, 0.99);
  if (Math.random() > chance) {
    p.morale = clamp(p.morale - 4, 20, 100);
    return { ok: false, msg: `${p.name} teklifi reddetti. Daha iyi şartlar sun.` };
  }
  career.budget -= cost;
  p.contract = years;
  p.wage = wage;
  p.morale = clamp(p.morale + 12, 20, 100);
  p.release = Math.round(p.value * 2.2);
  addXp(career, 30);
  career.news.unshift({ t: career.round, text: `✍️ ${p.name} ${years} yıllık yeni sözleşme imzaladı.` });
  return { ok: true, msg: `${p.name} ile ${years} yıllık anlaşma!` };
}

/** Sözleşmesi bitmek üzere olan kadro oyuncuları */
export function expiringPlayers(world: World, career: Career): Player[] {
  return Object.values(world.players)
    .filter((p) => p.teamId === career.clubId && p.contract <= 1)
    .sort((a, b) => a.contract - b.contract || overall(b) - overall(a));
}

/** Serbest oyuncular (bonservissiz) */
export function freeAgents(world: World): Player[] {
  return Object.values(world.players)
    .filter((p) => p.teamId === "FREE")
    .sort((a, b) => overall(b) - overall(a))
    .slice(0, 40);
}

export function signFreeAgent(world: World, career: Career, playerId: string, years = 2): { ok: boolean; msg: string } {
  const p = world.players[playerId];
  if (!p || p.teamId !== "FREE") return { ok: false, msg: "Bu oyuncu serbest değil." };
  const squad = Object.values(world.players).filter((x) => x.teamId === career.clubId);
  if (squad.length >= 26) return { ok: false, msg: "Kadro dolu (maks. 26)." };
  const off = contractDemand(p, career, years);
  if (career.budget < off.signing) return { ok: false, msg: `İmza bedeli €${(off.signing / 1000).toFixed(1)}M.` };
  career.budget -= off.signing;
  p.teamId = career.clubId;
  p.contract = years;
  p.wage = off.wage;
  p.morale = 80;
  addXp(career, 45);
  bumpObjective(career, "buy1", 1);
  career.news.unshift({ t: career.round, text: `🆓 ${p.name} bonservissiz olarak imzaladı.` });
  return { ok: true, msg: `${p.name} takıma katıldı!` };
}

/* --------------------------- transfer --------------------------- */
export function askingPrice(p: Player, career?: Career | null): number {
  const raw = p.value * (p.age < 25 ? 1.45 : 1.2) * (0.85 + p.form / 320);
  const mul = career ? bonusesOf(career).transferCost : 1;
  return Math.round(raw * mul);
}

export function sellPrice(p: Player): number {
  return Math.round(p.value * 0.75);
}

export function buyPlayer(world: World, career: Career, playerId: string): { ok: boolean; msg: string } {
  const p = world.players[playerId];
  if (!p) return { ok: false, msg: "Oyuncu bulunamadı." };
  const price = askingPrice(p, career);
  if (career.budget < price) return { ok: false, msg: "Bütçe yetersiz." };
  const squad = Object.values(world.players).filter((x) => x.teamId === career.clubId);
  if (squad.length >= 26) return { ok: false, msg: "Kadro dolu (max 26)." };
  career.budget -= price;
  p.teamId = career.clubId;
  p.morale = 80;
  p.contract = Math.max(2, Math.min(5, 5 - Math.floor((p.age - 20) / 6)));
  p.wage = Math.round(p.wage * (1 + (1 - bonusesOf(career).wageCost)));
  p.fitness = 100;
  addXp(career, 60);
  bumpObjective(career, "buy1", 1);
  career.market = career.market.filter((id) => id !== playerId);
  career.news.unshift({ t: career.round, text: `📥 ${p.name} (${overall(p)}) kadroya katıldı. Bedel: €${(price / 1000).toFixed(1)}M` });
  return { ok: true, msg: `${p.name} transfer edildi!` };
}

export function sellPlayer(world: World, career: Career, playerId: string): { ok: boolean; msg: string } {
  const p = world.players[playerId];
  if (!p || p.teamId !== career.clubId) return { ok: false, msg: "Oyuncu kadroda değil." };
  const squad = Object.values(world.players).filter((x) => x.teamId === career.clubId);
  if (squad.length <= 16) return { ok: false, msg: "Kadro çok küçük (min 16)." };
  if (career.lineup.includes(playerId) || career.subs.includes(playerId)) {
    return { ok: false, msg: "Önce kadrodan çıkar." };
  }
  career.budget += sellPrice(p);
  p.teamId = "FREE";
  career.news.unshift({ t: career.round, text: `📤 ${p.name} satıldı. Gelir: €${(sellPrice(p) / 1000).toFixed(1)}M` });
  return { ok: true, msg: `${p.name} satıldı.` };
}
