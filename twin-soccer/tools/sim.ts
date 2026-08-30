/* Motor dengesi ölçüm aracı: kullanıcısız (CPU vs CPU) maçlar oynatır. */
import { MatchEngine, emptyInput, type TeamInfo } from "../src/game/engine";
import { generateWorld, autoLineup } from "../src/game/world";
import { CLUB_MAP } from "../src/game/data/clubs";
import { overall } from "../src/game/formations";
import { defaultTactic } from "../src/game/career";
import { initBrain } from "../src/game/brain";

initBrain();
const world = generateWorld(20260214);

function team(clubId: string, form: string, isUser: boolean): TeamInfo {
  const a = autoLineup(world, clubId, form);
  return {
    clubId, name: CLUB_MAP[clubId].name, short: CLUB_MAP[clubId].short,
    tactic: { ...defaultTactic(form), mentality: 58 },
    lineup: a.lineup, subs: a.subs,
    rating: a.lineup.reduce((s, id) => s + overall(world.players[id]), 0) / a.lineup.length,
    aiSkill: 0.66, isUser, formation: form,
  };
}

const N = Number(process.argv[2] ?? 8);
const A = process.argv[3] ?? "sl_1";
const B = process.argv[4] ?? "sl_5";
let goals = 0, shots = 0, onT = 0, saves = 0, corners = 0, fouls = 0;
let boxTotal = 0, thirdTotal = 0, turnTotal = 0;
const scores: string[] = [];
for (let m = 0; m < N; m++) {
  const e = new MatchEngine(team(A, "442", false), team(B, "433", false), world.players, {
    minutes: 4, difficulty: 2, offside: true, seed: 1000 + m * 77, assist: 1,
  });
  let guard = 0;
  const phaseT: Record<string, number> = {};
  let inBox = false;
  let boxEntries = 0;
  let inThird = false;
  let thirdEntries = 0;
  let turnovers = 0;
  let lastOwner: 0 | 1 | null = null;
  while (e.phase !== "fulltime" && guard++ < 200000) {
    phaseT[e.phase] = (phaseT[e.phase] ?? 0) + 1;
    e.update(1 / 60, emptyInput());
    if (e.phase === "halftime") e.resumeSecondHalf();
    const bx = e.ball.x;
    const nowBox = bx < 16.5 || bx > 105 - 16.5;
    if (nowBox && !inBox) boxEntries++;
    inBox = nowBox;
    const nowThird = bx < 35 || bx > 70;
    if (nowThird && !inThird) thirdEntries++;
    inThird = nowThird;
    const own = e.ball.owner ? e.ball.owner.team : null;
    if (own !== null && lastOwner !== null && own !== lastOwner) turnovers++;
    if (own !== null) lastOwner = own;
  }
  boxTotal += boxEntries;
  thirdTotal += thirdEntries;
  turnTotal += turnovers;
  console.error(
    `#${m} ${e.score[0]}-${e.score[1]} sut:${e.stats.shots[0]}/${e.stats.shots[1]} ` +
    `isb:${e.stats.onTarget[0]}/${e.stats.onTarget[1]} kor:${e.stats.corners[0]}/${e.stats.corners[1]} ` +
    `fal:${e.stats.fouls[0]}/${e.stats.fouls[1]} ofs:${e.stats.offside[0]}/${e.stats.offside[1]} ` +
    `poz:${e.possessionPct[0]} ticks:${guard} play:${phaseT.play ?? 0} dead:${phaseT.dead ?? 0}`
  );
  goals += e.score[0] + e.score[1];
  shots += e.stats.shots[0] + e.stats.shots[1];
  onT += e.stats.onTarget[0] + e.stats.onTarget[1];
  saves += e.stats.saves[0] + e.stats.saves[1];
  corners += e.stats.corners[0] + e.stats.corners[1];
  fouls += e.stats.fouls[0] + e.stats.fouls[1];
  scores.push(`${e.score[0]}-${e.score[1]}`);
}
console.log(JSON.stringify({
  matches: N, scores,
  perMatch: {
    goals: +(goals / N).toFixed(2), shots: +(shots / N).toFixed(1),
    onTarget: +(onT / N).toFixed(1), saves: +(saves / N).toFixed(1),
    corners: +(corners / N).toFixed(1), fouls: +(fouls / N).toFixed(1),
    boxEntries: +(boxTotal / N).toFixed(1), thirdEntries: +(thirdTotal / N).toFixed(1),
    turnovers: +(turnTotal / N).toFixed(1),
  },
}, null, 2));
