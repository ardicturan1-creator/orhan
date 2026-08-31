import { brainCommentary, brainMotm, brainOnBall, brainTactics, type TacticOut } from "./brain";
import { formationById, posFit } from "./formations";
import { angDiff, clamp, Rng } from "./rng";
import type {
  Ball, CardEntry, Club, GoalEntry, InputState, MatchResult, MatchSettings, MatchStats,
  MP, Phase, Player, PosCode, RestartKind, TeamTactic,
} from "./types";

export const PITCH = {
  L: 105, W: 68, HL: 52.5, HW: 34,
  GOAL_W: 7.32, GOAL_H: 2.44, PEN_D: 16.5, PEN_W: 40.32, SIX_D: 5.5, SIX_W: 18.32, CIRCLE: 9.15,
};

const G = 9.81;
const AIR = 0.55;          // yuvarlanan topun doğrusal sürüklenme katsayısı (1/s)
const AIR_Z = 0.12;        // havadaki yatay sürüklenme
const DT = 1 / 60;
/** Varsayılan: 90 maç dakikası 15 gerçek dakikada oynanır → 0.1 maç dk / gerçek sn. */
export const DEFAULT_MATCH_MINUTES = 90;
export const DEFAULT_REAL_MINUTES = 15;
/** 90 dakikalık bir maçta ortalama yükte harcanan kondisyon ölçeği (maç dakikası başına). */
const STAMINA_PER_MATCH_MIN = 0.85;

export type EventKind =
  | "kick" | "tackle" | "save" | "goal" | "whistle" | "foul" | "card" | "corner"
  | "offside" | "miss" | "sub" | "half" | "full" | "post" | "kickoff";

export interface EngineEvent { kind: EventKind; power?: number; text?: string }

export interface TeamSetup {
  club: Club;
  lineup: Player[];
  subs: Player[];
  tactic: TeamTactic;
  boost: number;
  drain: number;
  homeAdv: number;
}

interface TeamRT {
  club: Club;
  tactic: TeamTactic;
  tac: TacticOut;
  mps: MP[];
  bench: Player[];
  used: number;
  dir: 1 | -1;
  boost: number;
  drain: number;
  homeAdv: number;
  ratings: number;
}

export interface Restart {
  kind: RestartKind;
  team: 0 | 1;
  x: number; y: number;
  taker: MP | null;
  timer: number;
  manual: boolean;
}

const ATK: readonly PosCode[] = ["ST", "LW", "RW", "AM", "LM", "RM", "CM"];

function mkMP(p: Player, team: 0 | 1, idx: number, dir: 1 | -1, role: PosCode, boost: number): MP {
  const fit = posFit(p, role);
  const formMul = 0.9 + (p.form / 100) * 0.2;
  const e = (v: number) => clamp(v * fit * formMul + boost, 8, 108);
  return {
    p, team, idx, dir,
    x: 0, y: 0, vx: 0, vy: 0, fx: dir, fy: 0,
    stamina: clamp(p.fitness, 40, 100),
    baseFx: 0, baseFy: 0, role,
    eff: { pac: e(p.pac), sho: e(p.sho), pas: e(p.pas), def: e(p.def), phy: e(p.phy), gk: e(p.gk) },
    rating: 6.2,
    goals: 0, assists: 0, passes: 0, passOk: 0, shots: 0, onTarget: 0, tackles: 0,
    saves: 0, fouls: 0, yellow: 0, red: false, off: false,
    cool: { tackle: 0, shoot: 0, pass: 0, decide: 0, slide: 0, dive: 0 },
    slide: 0, slideVx: 0, slideVy: 0, dive: 0, diveVz: 0,
    celeb: 0, celebKind: 0, jump: 0, anim: 0, stride: 0.45, lean: 0,
    facing: dir > 0 ? 0 : Math.PI, booked: false,
    isGK: role === "GK", onPitch: true,
  };
}

export class MatchEngine {
  ball: Ball = {
    x: 0, y: 0, z: 0.11, vx: 0, vy: 0, vz: 0,
    owner: null, lastTouch: null, lastTouchTeam: 0, spin: 0,
    shotCounted: true, otDone: true, saveTried: true, shooter: null, assistCand: null,
    trail: [], rot: 0,
  };
  mps: MP[] = [];
  teams: [TeamRT, TeamRT];
  phase: Phase = "kickoff";
  /** Takım bazında tamamlanan pas sayısı (istatistik). */
  passOkTeam: [number, number] = [0, 0];
  /** Pasın gönderildiği oyuncu — topa koşar (takım başına). */
  receiver: (MP | null)[] = [null, null];
  clock = 0;
  half = 1;
  minutes: number;
  /** Bir gerçek saniyede geçen maç dakikası. */
  rate: number;
  /** Maçın gerçek süresi (saniye). */
  realSeconds: number;
  score: [number, number] = [0, 0];
  stats: MatchStats = {
    possession: [0, 0], shots: [0, 0], onTarget: [0, 0], passes: [0, 0], passAcc: [0, 0],
    corners: [0, 0], fouls: [0, 0], offside: [0, 0], tackles: [0, 0], saves: [0, 0],
  };
  goals: GoalEntry[] = [];
  cards: CardEntry[] = [];
  controlled: MP | null = null;
  userTeam: 0 | 1 | null = null;
  commentary = "";
  commTimer = 0;
  goalBanner: { scorer: string; assist: string; hg: number; ag: number; t: number } | null = null;
  restart: Restart | null = null;
  celebrator: MP | null = null;
  celebrateTimer = 0;
  confetti: { x: number; y: number; z: number; vx: number; vy: number; vz: number; c: string; a: number; r: number }[] = [];
  shake = 0;
  flash = 0;
  pens: [number, number] | null = null;
  cupMode: boolean;
  settings: MatchSettings;
  input: InputState = { jx: 0, jy: 0, sprint: false, shoot: 0, shootHeld: false, passTap: false, throughTap: false, switchTap: false, tackleTap: false };
  onEvent: (e: EngineEvent) => void;
  private rng: Rng;
  private tick = 0;
  private tacTimer = 0;
  private lastPasser: MP | null = null;
  private possFrames = [0, 0];
  private momentum = 0;
  private offsidePending: MP | null = null;
  private switchLock = 0;
  private deadGuard = 0;
  readonly assistMul: number;
  readonly diff: number;

  constructor(
    homeSetup: TeamSetup, awaySetup: TeamSetup,
    settings: MatchSettings, cupMode: boolean,
    onEvent: (e: EngineEvent) => void = () => { },
    seed = 12345,
  ) {
    this.settings = settings;
    this.minutes = settings.minutes > 0 ? settings.minutes : DEFAULT_MATCH_MINUTES;
    const realMin = settings.realMinutes > 0 ? settings.realMinutes : DEFAULT_REAL_MINUTES;
    this.realSeconds = realMin * 60;
    // maç saati gerçek zamandan hızlı akar: rate = maç dakikası / gerçek saniye
    this.rate = this.minutes / this.realSeconds;
    this.cupMode = cupMode;
    this.onEvent = onEvent;
    this.rng = new Rng(seed);
    this.assistMul = 1 - settings.assist * 0.32;
    this.diff = settings.difficulty;
    this.userTeam = null; // MatchScreen ayarlar

    this.teams = [
      this.buildTeam(homeSetup, 0, 1),
      this.buildTeam(awaySetup, 1, -1),
    ];
    this.teams[0].boost += homeSetup.homeAdv * 0.5;
    this.resetPositions(0);
    this.say("kickoff", this.teams[0].club.short);
  }

  private buildTeam(s: TeamSetup, team: 0 | 1, dir: 1 | -1): TeamRT {
    const form = formationById(s.tactic.formation);
    const mps: MP[] = [];
    s.lineup.forEach((p, i) => {
      const slot = form.slots[i] ?? form.slots[form.slots.length - 1];
      const mp = mkMP(p, team, i, dir, slot.role, s.boost);
      mp.baseFx = slot.fx;
      mp.baseFy = slot.fy;
      mps.push(mp);
    });
    this.mps.push(...mps);
    return {
      club: s.club, tactic: s.tactic, tac: {
        push: s.tactic.mentality, line: s.tactic.lineHeight, width: s.tactic.width,
        press: s.tactic.pressing, tempo: s.tactic.tempo, risk: 0,
      },
      mps, bench: [...s.subs], used: 0, dir, boost: s.boost, drain: s.drain, homeAdv: s.homeAdv,
      ratings: s.club.rating,
    };
  }

  /** dirAttack: 0 → ev sahibi başlar */
  resetPositions(kickTeam: 0 | 1): void {
    for (const t of this.teams) {
      for (const mp of t.mps) {
        const p = this.slotWorld(mp, 0.5, 0.5);
        mp.x = p.x;
        mp.y = p.y;
        mp.vx = 0; mp.vy = 0;
        mp.fx = t.dir; mp.fy = 0;
        mp.slide = 0; mp.dive = 0; mp.celeb = 0;
      }
    }
    this.ball.x = 0; this.ball.y = 0; this.ball.z = 0.11;
    this.ball.vx = 0; this.ball.vy = 0; this.ball.vz = 0;
    this.ball.owner = null;
    this.ball.lastTouch = null;
    this.ball.trail = [];
    this.phase = "dead";
    this.setRestart("kickoff", kickTeam as 0 | 1, 0, 0);
  }

  /* ------------------------------------------------------------------ */
  /*  KOORDİNAT YARDIMCILARI                                            */
  /* ------------------------------------------------------------------ */

  private slotWorld(mp: MP, ballProg: number, ballYn: number): { x: number; y: number } {
    const t = this.teams[mp.team];
    const tac = t.tac;
    const push = t.tac.push / 100;
    const line = t.tac.line / 100;
    const width = tac.width / 100;
    // blok topun ilerleyişine göre kayar
    let fx = mp.baseFx + (ballProg - 0.5) * 0.30 + (push - 0.5) * 0.14 + (line - 0.5) * 0.10;
    if (mp.isGK) fx = 0.035;
    fx = clamp(fx, 0.04, 0.94);
    let fy = 0.5 + (mp.baseFy - 0.5) * (0.62 + width * 0.52) + (ballYn - 0.5) * 0.30;
    fy = clamp(fy, 0.04, 0.96);
    /* KRİTİK: yuva, takımın KENDİ kalesinden hücum yönüne doğru ölçülür.
       Eski formül (-dir*HL + fx*L) yalnızca dir=+1 için doğruydu; dir=-1 takımının
       tüm oyuncuları saha dışına (x>52) düşüp kendi kale çizgisine yapışıyordu. */
    const x = t.dir * (fx - 0.5) * PITCH.L;
    const y = (fy - 0.5) * PITCH.W * t.dir;
    return { x, y };
  }

  /** topun, takımın kendi kalesinden ilerleme oranı (0..1) */
  private progress(team: 0 | 1): number {
    const t = this.teams[team];
    return clamp((this.ball.x * t.dir + PITCH.HL) / PITCH.L, 0, 1);
  }
  private ballYn(team: 0 | 1): number {
    const t = this.teams[team];
    return clamp((this.ball.y * t.dir + PITCH.HW) / PITCH.W, 0, 1);
  }
  private goalX(team: 0 | 1): number { return this.teams[team].dir * PITCH.HL; }
  private ownGoalX(team: 0 | 1): number { return -this.teams[team].dir * PITCH.HL; }

  /* ------------------------------------------------------------------ */
  /*  ANA DÖNGÜ                                                          */
  /* ------------------------------------------------------------------ */

  step(): void {
    this.tick++;
    this.updatePhase();
    // Görsel efektler HER fazda söner — maç biterken gol atılırsa flaş ekranda kalıcı kalırdı.
    if (this.shake > 0) this.shake = Math.max(0, this.shake - DT * 2.4);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - DT * 1.6);
    if (this.commTimer > 0) this.commTimer -= DT;
    if (this.phase === "halftime" || this.phase === "fulltime" || this.phase === "pens") return;
    this.clock += DT * this.rate;

    if (this.phase === "goal") {
      this.updateCelebration(DT);
      this.updateConfetti(DT);
      return;
    }

    // taktik beyni ~2 Hz
    this.tacTimer -= DT;
    if (this.tacTimer <= 0) {
      this.tacTimer = 0.5;
      this.updateTactics();
    }

    this.updatePlayers(DT);
    this.updateBall(DT);
    this.gkLogic(DT);
    this.updateCooldowns(DT);
    this.updateDead(DT);
    this.updateConfetti(DT);
    this.updateStats(DT);
    if (this.switchLock > 0) this.switchLock -= DT;
  }

  /** DURUM BAZLI faz geçişi — kenar tetiklemeli DEĞİL (a) kuralı) */
  private updatePhase(): void {
    if (this.phase === "play" || this.phase === "kickoff" || this.phase === "dead") {
      const end = this.half === 1 ? this.minutes / 2 : this.minutes;
      if (this.half === 1 && this.clock >= end) {
        this.phase = "halftime";
        this.say("halftime");
        this.onEvent({ kind: "whistle" });
        this.onEvent({ kind: "half", text: "İlk yarı bitti" });
      } else if (this.half === 2 && this.clock >= end) {
        this.finishMatch();
      }
    }
    // sonsuz döngü güvenliği — gerçek süreye göre ölçeklenir (uzatmalara yer bırakır)
    if (this.tick > this.realSeconds * 60 * 1.7) this.finishMatch();
  }

  private finishMatch(): void {
    if (this.phase === "fulltime") return;
    this.phase = "fulltime";
    this.say("fulltime");
    this.onEvent({ kind: "whistle" });
    this.onEvent({ kind: "full", text: "Maç sonu" });
    if (this.cupMode && this.score[0] === this.score[1]) this.runShootout();
  }

  resumeSecondHalf(): void {
    if (this.phase !== "halftime") return;
    this.half = 2;
    this.clock = this.minutes / 2;
    this.phase = "dead";
    this.setRestart("kickoff", 1, 0, 0);
    for (const t of this.teams) for (const mp of t.mps) mp.stamina = clamp(mp.stamina + 14, 0, 100);
    this.onEvent({ kind: "kickoff" });
  }

  private runShootout(): void {
    this.phase = "pens";
    this.say("pens");
    let h = 0, a = 0;
    const gk0 = this.teams[0].mps[0], gk1 = this.teams[1].mps[0];
    for (let i = 0; i < 5; i++) {
      if (this.penKick(this.teams[0], gk1)) h++;
      if (this.penKick(this.teams[1], gk0)) a++;
    }
    while (h === a) {
      if (this.penKick(this.teams[0], gk1)) h++;
      if (this.penKick(this.teams[1], gk0)) a++;
    }
    this.pens = [h, a];
  }

  private penKick(t: TeamRT, oppGk: MP): boolean {
    const shooter = t.mps.filter((m) => !m.isGK).sort((x, y) => y.eff.sho - x.eff.sho)[0];
    if (!shooter) return false;
    const att = shooter.eff.sho / 110 + 0.35;
    const def = oppGk.eff.gk / 190;
    return this.rng.next() < clamp(att - def, 0.25, 0.86);
  }

  /* ------------------------------------------------------------------ */
  /*  TAKTİK BEYNİ                                                       */
  /* ------------------------------------------------------------------ */

  private updateTactics(): void {
    for (let i = 0; i < 2; i++) {
      const t = this.teams[i];
      const diff = this.score[i] - this.score[1 - i];
      const minNorm = (this.clock / this.minutes) * 90;
      const tired = 1 - t.mps.reduce((s, m) => s + m.stamina, 0) / (t.mps.length * 100);
      const oppStrong = clamp(this.teams[1 - i].ratings / 90, 0, 1);
      t.tac = brainTactics({
        diff, min: minNorm, press: t.tactic.pressing, oppStrong, tired,
        mentality: t.tactic.mentality,
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  OYUNCU GÜNCELLEME                                                  */
  /* ------------------------------------------------------------------ */

  private updatePlayers(dt: number): void {
    const owner = this.ball.owner;
    const pressers = this.computePressers();

    for (const mp of this.mps) {
      if (!mp.onPitch) continue;
      if (mp.slide > 0) { this.updateSlide(mp, dt); continue; }
      if (mp.celeb > 0) { this.updateCelebRun(mp, dt); continue; }

      let tx = mp.x, ty = mp.y;
      let sprint = false;

      const isUser = this.userTeam !== null && mp.team === this.userTeam && this.controlled === mp;

      if (mp.isGK) {
        const g = this.gkTarget(mp);
        tx = g.x; ty = g.y;
      } else if (this.phase === "dead" && !(isUser && this.restart?.manual)) {
        const st = this.shapeTarget(mp);
        tx = st.x; ty = st.y;
      } else if (isUser) {
        const mv = this.userMove(mp);
        tx = mp.x + mv.x * 10; ty = mp.y + mv.y * 10;
        sprint = mv.sprint;
      } else if (owner === mp) {
        const d = this.aiOnBall(mp);
        tx = mp.x + d.x * 10; ty = mp.y + d.y * 10;
        sprint = d.sprint;
      } else if (!owner && this.receiver[mp.team] === mp) {
        // pasın gönderildiği oyuncu topun ÖNÜNÜ keser
        const ip = this.interceptTarget(mp);
        tx = ip.x; ty = ip.y;
        sprint = true;
      } else if (pressers.has(mp)) {
        // baskı / serbest topa koşu: kesişim noktasına
        // Baskıda topun bulunduğu yere değil, top taşıyanın GİDECEĞİ yere koşulur
        // (gerçek savunmacılar gibi önünü keser) → ikili mücadele ve müdahale doğar.
        const ip = owner
          ? { x: owner.x + owner.vx * 0.55 + this.ball.vx * 0.1, y: owner.y + owner.vy * 0.55 + this.ball.vy * 0.1 }
          : this.interceptTarget(mp);
        tx = ip.x; ty = ip.y;
        sprint = true;
      } else {
        const st = this.shapeTarget(mp);
        tx = st.x; ty = st.y;
        const d = Math.hypot(tx - mp.x, ty - mp.y);
        sprint = d > 12;
      }

      this.moveToward(mp, tx, ty, dt, sprint);
    }
  }

  private computePressers(): Set<MP> {
    const out = new Set<MP>();
    if (this.phase !== "play") return out;
    const owner = this.ball.owner;
    if (!owner) {
      // serbest top: her iki takımdan en yakın 2 oyuncu topa gider
      for (const t of this.teams) {
        const cs = t.mps.filter((m) => m.onPitch && !m.isGK)
          .sort((a, b) => this.md(a, this.ball) - this.md(b, this.ball));
        if (cs[0]) out.add(cs[0]);
        if (cs[1] && this.md(cs[1], this.ball) < 9) out.add(cs[1]);
      }
      return out;
    }
    const defTeam = 1 - owner.team;
    const t = this.teams[defTeam];
    const n = 2 + Math.round((t.tac.press / 100) * 2);
    const cands = t.mps.filter((m) => m.onPitch && !m.isGK)
      .sort((a, b) => this.md(a, owner) - this.md(b, owner));
    for (let i = 0; i < Math.min(n, cands.length); i++) out.add(cands[i]);
    return out;
  }

  /** Serbest topun t saniye sonraki yaklaşık konumu (yuvarlanma sürtünmesiyle). */
  private ballAt(t: number): { x: number; y: number } {
    const b = this.ball;
    const f = (1 - Math.exp(-AIR * t)) / AIR;
    return { x: b.x + b.vx * f, y: b.y + b.vy * f };
  }

  /** Oyuncunun topu kesebileceği en erken nokta (gerçek koşucular gibi önünü keser). */
  private interceptTarget(mp: MP): { x: number; y: number } {
    const spd = 3.45 + (mp.eff.pac / 108) * 3.15;
    for (let t = 0.12; t <= 2.4; t += 0.12) {
      const p = this.ballAt(t);
      if (Math.hypot(p.x - mp.x, p.y - mp.y) <= spd * t + 0.7) return p;
    }
    return this.ballAt(2.4);
  }

  private md(a: MP, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private shapeTarget(mp: MP): { x: number; y: number } {
    const t = this.teams[mp.team];
    const bp = this.progress(mp.team);
    const byn = this.ballYn(mp.team);
    const base = this.slotWorld(mp, bp, byn);
    const owner = this.ball.owner;
    const attacking = owner ? owner.team === mp.team : this.ball.lastTouchTeam === mp.team;
    let x = base.x + (attacking ? 4.5 : -3.2) * t.dir;
    let y = base.y;

    // hücum koşuları
    if (attacking && owner && ATK.includes(mp.role) && !mp.isGK) {
      const d = this.md(mp, owner);
      if (d < 32) {
        const push = t.tac.push / 100;
        if (mp.role === "ST") {
          x = owner.x + t.dir * (12 + push * 10);
          y = owner.y + (mp.y > owner.y ? 5 : -5);
        } else if (mp.role === "LW" || mp.role === "RW" || mp.role === "LM" || mp.role === "RM") {
          x = owner.x + t.dir * (10 + push * 8);
          y = owner.y * 0.35 + mp.y * 0.65 + (mp.role.endsWith("W") ? (mp.y > 0 ? 4 : -4) : 0);
        } else if (d < 20) {
          x = owner.x + t.dir * (8 + push * 6);
          y = owner.y + (mp.y > owner.y ? 8 : -8);
        }
      }
    }
    // ofsayt hattını aşma
    if (this.settings.offside && attacking && !mp.isGK) {
      const line = this.offsideLine(mp.team);
      if (mp.x * t.dir > line * t.dir) x = line - t.dir * 1.2;
    }
    x = clamp(x, -PITCH.HL + 0.8, PITCH.HL - 0.8);
    y = clamp(y, -PITCH.HW + 0.8, PITCH.HW - 0.8);
    return { x, y };
  }

  /** Takımın hücum yönünde ofsayt çizgisi (dünya x koordinatı). */
  private offsideLine(team: 0 | 1): number {
    const t = this.teams[team];
    const opp = this.teams[1 - team];
    // rakipleri kendi kalelerine yakınlığa göre sırala; 2. sıradaki = son savunmacı
    // (kaleye EN YAKIN olanlar önce; [0] genelde kaleci, [1] son savunmacı)
    const sorted = opp.mps.filter((m) => m.onPitch)
      .sort((a, b) => Math.abs(a.x - this.goalX(team)) - Math.abs(b.x - this.goalX(team)));
    const secondLast = sorted[1] ?? sorted[0];
    const line = secondLast ? secondLast.x : this.goalX(team);
    // ofsayt çizgisi topun konumundan da geride olamaz
    const a = line * t.dir;
    const b = this.ball.x * t.dir;
    return Math.max(a, b) * t.dir;
  }

  private userMove(mp: MP): { x: number; y: number; sprint: boolean } {
    const j = this.input;
    let mx = j.jx, my = j.jy;
    // "behind" kamerasında hücum yönüne göre ek dönüşüm
    if (this.settings.camera === "behind") {
      const dir = this.teams[mp.team].dir;
      const nx = mx * dir, ny = my * dir;
      mx = nx; my = ny;
    }
    const mag = Math.hypot(mx, my);
    if (mag > 1) { mx /= mag; my /= mag; }
    const autoSprint = this.settings.assist >= 2 && mag > 0.85;
    return { x: mx, y: my, sprint: j.sprint || autoSprint };
  }

  /**
   * Doğal oyuncu hareketi:
   *  - yürüme/koşma hızları arası yumuşak geçiş, dururken atalet (ağırlık hissi)
   *  - yön anında değil sınırlı dönüş hızıyla değişir (robotik snap yok)
   *  - dönüş ve ivmeye bağlı gövde eğimi (lean)
   *  - koşu döngüsü gerçek kat edilen mesafeyle senkron (kayma/adım uyumsuzluğu yok)
   */
  private moveToward(mp: MP, tx: number, ty: number, dt: number, sprint: boolean): void {
    const dx = tx - mp.x, dy = ty - mp.y;
    const d = Math.hypot(dx, dy) || 1;
    const stamMul = 1 - (1 - mp.stamina / 100) * 0.38;
    const maxSpd = (3.45 + (mp.eff.pac / 108) * 3.15) * stamMul * (sprint ? 1.18 : 0.92);
    const want = Math.min(d * 3.1, maxSpd);
    const nx = (dx / d) * want, ny = (dy / d) * want;
    const acc = 9.2 + mp.eff.pac * 0.05;
    const dec = acc * 0.5;                        // yavaşlamak hızlanmaktan zor → ağırlık
    const dvx = nx - mp.vx, dvy = ny - mp.vy;
    const lim = (Math.abs(dvx) + Math.abs(dvy) > 0 ? Math.hypot(dvx, dvy) : 1);
    const scale = Math.min(1, (acc * dt) / lim);
    const easing = Math.hypot(nx, ny) < 0.25 ? dec / acc : 1;
    mp.vx += dvx * scale * easing;
    mp.vy += dvy * scale * easing;
    if (Math.hypot(nx, ny) < 0.2) {
      const fr = Math.exp(-3.4 * dt);
      mp.vx *= fr; mp.vy *= fr;
    }
    mp.x += mp.vx * dt;
    mp.y += mp.vy * dt;
    const sp = Math.hypot(mp.vx, mp.vy);

    if (sp > 0.4) {
      const target = Math.atan2(mp.vy, mp.vx);
      const diff = angDiff(mp.facing, target);
      const rate = 5.0 + mp.eff.pac * 0.04;       // rad/s dönüş hızı
      const step = clamp(diff, -rate * dt, rate * dt);
      mp.facing += step;
      const targetLean = clamp(-diff * 0.7 + (sp / maxSpd - 1) * 0.12, -0.7, 0.7);
      mp.lean += (targetLean - mp.lean) * (1 - Math.exp(-7 * dt));
      mp.fx = Math.cos(mp.facing);
      mp.fy = Math.sin(mp.facing);
    } else {
      mp.lean += (0 - mp.lean) * (1 - Math.exp(-5 * dt));
    }
    mp.stride = 0.40 + clamp(sp / 6.8, 0, 1) * 0.52;
    mp.anim += (sp / Math.max(0.28, mp.stride)) * dt * 3.2;

    // Kondisyon MAÇ dakikasına göre erir → maçın gerçek süresi (5/10/15/20 dk) dengeyi bozmaz.
    const load = (sp / 7) * (sprint ? 1.5 : 1) * this.teams[mp.team].drain;
    mp.stamina = clamp(mp.stamina - load * (dt * this.rate) * STAMINA_PER_MATCH_MIN, 0, 100);
    mp.x = clamp(mp.x, -PITCH.HL - 2, PITCH.HL + 2);
    mp.y = clamp(mp.y, -PITCH.HW - 2, PITCH.HW + 2);
  }

  /* ------------------------------------------------------------------ */
  /*  TOP FİZİĞİ                                                          */
  /* ------------------------------------------------------------------ */

  private updateBall(dt: number): void {
    const b = this.ball;
    if (this.phase === "dead") {
      // duran top: yerinde tutulur (atıcı yerleştirilir)
      const r = this.restart;
      if (r) {
        b.x = r.x; b.y = r.y; b.z = r.kind === "throwin" ? 1.6 : 0.11;
        b.vx = 0; b.vy = 0; b.vz = 0;
        if (r.taker && this.md(r.taker, b) > 1.4) {
          this.moveToward(r.taker, r.x - Math.sign(r.x - r.taker.x) * 0.6, r.y, dt, true);
        }
      }
      return;
    }

    if (b.owner) {
      const o = b.owner;
      const ahead = 0.62 + Math.hypot(o.vx, o.vy) * 0.055;
      b.x = o.x + o.fx * ahead;
      b.y = o.y + o.fy * ahead;
      b.z = 0.11 + Math.abs(Math.sin(o.anim * 3)) * 0.05;
      b.vx = o.vx; b.vy = o.vy; b.vz = 0;
      b.rot += Math.hypot(o.vx, o.vy) * dt * 2.2;
      b.lastTouch = o; b.lastTouchTeam = o.team;
      this.tryTackles();
      // topu taşıyan oyuncu saha dışına taşırsa oyun durur
      if (Math.abs(b.y) > PITCH.HW + 0.25 || Math.abs(b.x) > PITCH.HL + 0.25) {
        this.outOfPlay(b.x, b.y);
      }
      return;
    }

    const px = b.x, py = b.y;
    // havada mı?
    if (b.z > 0.13 || b.vz > 0.02) {
      b.vz -= G * dt;
      b.vx -= b.vx * AIR_Z * dt;
      b.vy -= b.vy * AIR_Z * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      if (b.z <= 0.11) {
        b.z = 0.11;
        b.vz = -b.vz * 0.52;
        b.vx *= 0.86; b.vy *= 0.86;
        if (Math.abs(b.vz) < 0.5) b.vz = 0;
      }
    } else {
      b.z = 0.11;
      const k = Math.exp(-AIR * dt);
      b.vx *= k; b.vy *= k;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (Math.hypot(b.vx, b.vy) < 0.12) { b.vx = 0; b.vy = 0; }
    }
    b.rot += Math.hypot(b.vx, b.vy) * dt * 1.7;
    if (b.trail.length > 26) b.trail.shift();
    b.trail.push({ x: b.x, y: b.y, z: b.z, a: 1 });

    // gol / aut kontrolü (segment kesişimi — tünelleme engellenir)
    const gx = PITCH.HL;
    if ((px < gx && b.x >= gx) || (px > -gx && b.x <= -gx)) {
      const side = b.x >= gx ? 1 : -1;
      const t = side === 1 ? Math.abs((gx - px) / ((b.x - px) || 1)) : Math.abs((-gx - px) / ((b.x - px) || 1));
      const cy = py + (b.y - py) * t;
      const cz = b.z;
      if (Math.abs(cy) < PITCH.GOAL_W / 2 && cz < PITCH.GOAL_H) {
        const scorer = (side === 1 ? 0 : 1) as 0 | 1;
        const conceding = (1 - scorer) as 0 | 1;
        if (!b.otDone) { this.stats.onTarget[b.lastTouchTeam]++; b.otDone = true; b.shotCounted = true;  }
        if (this.tryGoalLineSave(conceding, side, cy, cz)) return;
        this.onGoal(scorer);
        return;
      }
    }
    if (Math.abs(b.x) > PITCH.HL + 0.35 || Math.abs(b.y) > PITCH.HW + 0.35) {
      this.outOfPlay(px, py);
      return;
    }
    // direkler
    if (Math.abs(b.x) > PITCH.HL - 0.2 && Math.abs(b.x) < PITCH.HL + 0.35 && Math.abs(b.y) > PITCH.GOAL_W / 2 - 0.2 && Math.abs(b.y) < PITCH.GOAL_W / 2 + 0.2 && b.z < PITCH.GOAL_H) {
      b.vx = -b.vx * 0.6;
            this.onEvent({ kind: "post" });
      this.say("near");
    }

    this.tryPickup();
    this.checkShotBlocks();
  }

  private tryPickup(): void {
    const b = this.ball;
    if (b.owner) return;
    if (this.phase !== "play") return;
    let best: MP | null = null;
    let bestD = 99;
    for (const mp of this.mps) {
      if (!mp.onPitch) continue;
      if (mp.cool.pass > 0 || mp.slide > 0) continue;
      const d = this.md(mp, b);
      if (d < bestD) { bestD = d; best = mp; }
    }
    if (!best) return;
    const speed = Math.hypot(b.vx, b.vy);
    let reach = best.isGK ? 1.75 : 1.28;
    if (b.z > 1.4) reach *= 0.45;
    if (speed > 15) reach *= 0.72;   // hızlı topa uzanmak zordur
    if (bestD > reach) return;
    // ofsayt kontrolü
    if (this.settings.offside && this.offsidePending === best && this.lastPasser && this.lastPasser.team === best.team) {
      this.stats.offside[best.team]++;
      this.say("offside");
      this.onEvent({ kind: "offside" });
      this.offsidePending = null;
      this.setRestart("freekick", (1 - best.team) as 0 | 1, best.x, best.y);
      return;
    }
    const controlBase = best.isGK ? 0.9 : 0.62;
    const skill = best.isGK ? best.eff.gk : best.eff.pas;
    // Top hızı arttıkça kontrol OLASILIĞI çok hızlı düşer: sert bir şut, yolundaki
    // savunmacı tarafından "yakalanamaz" (eskiden %50'ye varan şansla duruyordu).
    const spen = Math.pow(clamp(speed / 17, 0, 2.4), 1.7) * 0.62;
    let prob = controlBase + skill * 0.0032 - spen;
    if (this.userTeam !== null && best.team === this.userTeam) prob += this.settings.assist * 0.06;
    prob = clamp(prob, 0.06, 0.97);
    if (this.rng.next() < prob) {
      // pas TAMAMLANDI (gerçek varış bazlı pas isabeti istatistiği)
      const passer = this.lastPasser;
      if (passer && passer !== best && passer.team === best.team) { passer.passOk++; this.passOkTeam[best.team]++; this.lastPasser = null; }
      this.takeBall(best);
    } else {
      // kötü ilk dokunuş: top sekmeye devam
      best.cool.pass = 0.22;
      b.vx += (this.rng.next() - 0.5) * 5.5;
      b.vy += (this.rng.next() - 0.5) * 5.5;
    }
  }

  /**
   * Kale çizgisinde kurtarış denemesi. Şut başına yalnızca bir kez (b kuralı).
   * Kurtarılırsa top fiziksel olarak çelinir/kucaklanır ve `true` döner.
   */
  private tryGoalLineSave(conceding: 0 | 1, side: number, cy: number, cz: number): boolean {
    const b = this.ball;
    const gk = this.teams[conceding].mps[0];
    if (!gk || !gk.isGK || !gk.onPitch) return false;
    // NOT: `saveTried` burada KAPI DEĞİLDİR — top kale çizgisini yalnızca bir kez
    // geçebilir, dolayısıyla çift kurtarış riski yoktur. (Eskiden bu bayrak yüzünden
    // paslardan/sekmelerden gelen gollerde kaleci hiç devreye girmiyordu.)
    b.saveTried = true;
    const speed = Math.hypot(b.vx, b.vy, b.vz);
    // uzanması gereken mesafe: yanal + dikey
    const reachDist = Math.hypot(cy - gk.y, Math.max(0, cz - 0.95) * 1.25);
    let save = 0.455 + gk.eff.gk * 0.0032 - speed * 0.0068 - reachDist * 0.15;
    if (this.userTeam !== null && conceding === this.userTeam) save += this.diff * 0.022;
    else save -= this.diff * 0.014;
    save = clamp(save, 0.04, 0.93);
    gk.dive = 0.55;
    gk.diveVz = clamp(cz, 0.2, 2.2);
    if (this.rng.next() >= save) return false;

    this.stats.saves[conceding]++;
    gk.saves++;
    gk.rating += 0.26;
    gk.y += clamp(cy - gk.y, -2.4, 2.4) * 0.55;
    b.lastTouch = gk;
    b.lastTouchTeam = conceding;
    b.shooter = null;
    b.shotCounted = true;
    b.x = side * (PITCH.HL - 0.32);
    b.y = cy;
    b.z = Math.max(0.11, cz);
    const catchIt = speed < 15 && Math.abs(cy - gk.y) < 1.4 && cz < 2.0;
    if (catchIt) {
      b.vx = 0; b.vy = 0; b.vz = 0;
      this.takeBall(gk);
      gk.cool.pass = 0.9;
    } else if (this.rng.next() < 0.30) {
      // kornere çeldi
      b.vx = side * 5.5;
      b.vy = (cy >= 0 ? 1 : -1) * 7;
      b.vz = 2.4;
    } else {
      // sahaya çeldi (ribaunt)
      const away = -side;
      b.vx = away * speed * 0.30;
      b.vy = (this.rng.next() - 0.5) * speed * 0.34;
      b.vz = 2.6;
    }
    this.onEvent({ kind: "save" });
    this.say("shotSaved", gk.p.name);
    this.shake = Math.max(this.shake, 0.4);
    return true;
  }

  takeBall(mp: MP): void {
    const b = this.ball;
    if (b.owner === mp) return;
    this.receiver[0] = null;
    this.receiver[1] = null;
    b.owner = mp;
    b.lastTouch = mp;
    b.lastTouchTeam = mp.team;
    b.shotCounted = true;
    b.saveTried = true;
    b.shooter = null;
    this.offsidePending = null;
    if (mp.team !== this.lastPasser?.team) this.lastPasser = null;
    // otomatik oyuncu değişimi
    if (this.userTeam !== null && mp.team === this.userTeam && this.settings.autoSwitch && this.controlled !== mp && this.switchLock <= 0) {
      if (!mp.isGK) this.controlled = mp;
    }
  }

  private checkShotBlocks(): void {
    const b = this.ball;
    if (!b.shooter || b.shotCounted) return;
    const speed = Math.hypot(b.vx, b.vy);
    if (speed < 9) return;
    const shooter = b.shooter;
    for (const mp of this.mps) {
      if (!mp.onPitch || mp.team === shooter.team || mp.isGK) continue;
      // şut hattı üzerinde mi?
      const dx = b.x - mp.x, dy = b.y - mp.y;
      const len = Math.hypot(b.vx, b.vy) || 1;
      const ux = b.vx / len, uy = b.vy / len;
      const along = dx * ux + dy * uy;
      if (along < -0.6 || along > 3.2) continue;
      const perp = Math.abs(dx * -uy + dy * ux);
      if (perp > 1.15) continue;
      if (b.z > 2.0) continue;
      // HER KARE değil, savunmacı başına EN FAZLA yarım saniyede bir blok denemesi.
      // (Eskiden 60Hz'de her kare zar atılıyordu; bir şut pratikte hep bloklanıyordu.)
      if (mp.cool.tackle > 0) continue;
      mp.cool.tackle = 0.5;
      const p = clamp(0.12 + mp.eff.def * 0.0022 + mp.eff.phy * 0.0011 - speed * 0.004, 0.03, 0.42);
      if (this.rng.next() < p) {
        // blok: top seker — savunmacı topu kendi kalesinden UZAĞA çevirir
        const away = this.teams[mp.team].dir;
        const ang = Math.atan2((this.rng.next() - 0.5) * 2.6, away) + (this.rng.next() - 0.5) * 1.1;
        const ns = speed * (0.26 + this.rng.next() * 0.3);
        b.vx = Math.cos(ang) * ns;
        b.vy = Math.sin(ang) * ns;
        b.vz = 2 + this.rng.next() * 3;
                b.shotCounted = true;
        b.saveTried = true;
        this.onEvent({ kind: "tackle", power: 0.6 });
        return;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  MÜDAHALELER                                                        */
  /* ------------------------------------------------------------------ */

  private tryTackles(): void {
    const o = this.ball.owner;
    if (!o || this.phase !== "play") return;
    const b = this.ball;
    for (const mp of this.mps) {
      if (!mp.onPitch || mp.team === o.team || mp.isGK) continue;
      if (mp.cool.tackle > 0) continue;
      const d = this.md(mp, o);
      if (d > 2.25) continue;
      mp.cool.tackle = 0.55;
      const userTackle = this.userTeam !== null && mp.team === this.userTeam;
      let p = 0.28 + (mp.eff.def - o.eff.pas) * 0.0035 + (mp.eff.phy - o.eff.phy) * 0.0012;
      if (userTackle) p += this.settings.assist * 0.05 + (this.diff <= 1 ? 0.05 : 0);
      p = clamp(p, 0.08, 0.8);
      const ownerTeam = o.team;      // (d) kuralı: referansı sabitle
      const ownerName = o.p.name;
      if (this.rng.next() < p) {
        // Kazanılan topu savunmacı kendi hücum yönüne doğru dürter (kendi kalesine değil).
        const upfield = this.teams[mp.team].dir;
        const ang = Math.atan2((this.rng.next() - 0.5) * 3.0, upfield) + (this.rng.next() - 0.5) * 0.8;
        b.owner = null;
        b.vx = Math.cos(ang) * (4 + this.rng.next() * 4);
        b.vy = Math.sin(ang) * (4 + this.rng.next() * 4);
        b.vz = 0.6;
        b.lastTouch = mp;
        b.lastTouchTeam = mp.team;
        b.shotCounted = true;
        b.otDone = false;
        b.saveTried = true;
        this.lastPasser = null;
        mp.tackles++;
        this.stats.tackles[mp.team]++;
        mp.rating += 0.08;
        this.takeBall(mp);
        this.onEvent({ kind: "tackle", power: 0.8 });
        this.say("tackle", mp.p.name);
        break;
      }
      // faul
      const foulP = 0.155 + (mp.slide > 0 ? 0.16 : 0);
      if (this.rng.next() < foulP) {
        this.commitFoul(mp, o, ownerTeam, ownerName);
        break;
      }
    }
  }

  private commitFoul(off: MP, victim: MP, victimTeam: 0 | 1, victimName: string): void {
    off.fouls++;
    this.stats.fouls[off.team]++;
    off.rating -= 0.1;
    this.say("foul");
    this.onEvent({ kind: "foul" });
    void victimName;
    // kart
    const inBox = this.inPenaltyBox(victim.x, victim.y, victimTeam);
    const cardP = 0.2 + (off.slide > 0 ? 0.14 : 0) + (inBox ? 0.12 : 0);
    if (this.rng.next() < cardP) {
      if (off.yellow >= 1 || this.rng.next() < 0.06) {
        off.red = true;
        off.onPitch = false;
        off.rating -= 1.0;
        // atılan oyuncu kullanıcı kontrolündeyse kontrolü devret
        if (this.userTeam !== null && this.controlled === off) this.switchPlayer();
        this.cards.push({ minute: Math.ceil(this.clock), name: off.p.name, team: off.team, kind: "R" });
        this.say("red", off.p.name);
        this.onEvent({ kind: "card", text: "red" });
      } else {
        off.yellow++;
        off.rating -= 0.3;
        this.cards.push({ minute: Math.ceil(this.clock), name: off.p.name, team: off.team, kind: "Y" });
        this.say("yellow", off.p.name);
        this.onEvent({ kind: "card", text: "yellow" });
      }
    }
    if (inBox) {
      // penaltı noktası: HÜCUM edilen kalenin 11 m önünde
      const spotX = this.goalX(victimTeam) - this.teams[victimTeam].dir * 11;
      this.setRestart("penalty", victimTeam, spotX, 0);
    } else {
      this.setRestart("freekick", victimTeam, victim.x, victim.y);
    }
  }

  private inPenaltyBox(x: number, y: number, defTeam: 0 | 1): boolean {
    const gx = this.ownGoalX(defTeam);
    const dir = this.teams[defTeam].dir;
    const rel = (x - gx) * dir;
    return rel > 0 && rel < PITCH.PEN_D && Math.abs(y) < PITCH.PEN_W / 2;
  }

  /* ------------------------------------------------------------------ */
  /*  KALECİ                                                             */
  /* ------------------------------------------------------------------ */

  private gkTarget(mp: MP): { x: number; y: number } {
    const t = this.teams[mp.team];
    const b = this.ball;
    const gx = this.ownGoalX(mp.team);
    // şut geliyor mu?
    const towardGoal = (b.vx * t.dir) < -1.5;
    const distToGoal = Math.abs(b.x - gx);
    if (!b.owner && towardGoal && distToGoal < 42) {
      const pred = this.predictAtGoal(mp.team);
      if (pred) {
        return { x: gx + t.dir * 0.7, y: clamp(pred.y, -PITCH.GOAL_W / 2 - 0.7, PITCH.GOAL_W / 2 + 0.7) };
      }
    }
    // topa göre açısal pozisyon
    const ang = Math.atan2(b.y - 0, b.x - gx);
    const out = clamp(2.2 + (distToGoal < 22 ? 2.6 : 0.4), 1.4, 6.5);
    let y = Math.sin(ang) * out * 2.6;
    y = clamp(y, -PITCH.GOAL_W / 2 - 1.6, PITCH.GOAL_W / 2 + 1.6);
    let x = gx + t.dir * out;
    // topu elinde tutan kaleci: hücum yönünde biraz açılır
    if (b.owner === mp) { x = gx + t.dir * 4.5; y = 0; }
    // kendi ceza sahasında serbest top: çık ve kap
    if (!b.owner && Math.abs(b.x - gx) < 15 && Math.abs(b.y) < 18 && Math.hypot(b.vx, b.vy) < 6) {
      x = b.x; y = b.y;
    }
    return { x, y };
  }

  /** Topun kendi kale çizgisini hangi y/z ile geçeceğini kestirir. */
  private predictAtGoal(team: 0 | 1): { y: number; z: number; t: number } | null {
    const b = this.ball;
    const gx = this.ownGoalX(team);
    const dir = this.teams[team].dir;
    const vx = b.vx, vy = b.vy;
    if (Math.sign(vx) !== Math.sign(-dir) || Math.abs(vx) < 0.5) return null;
    const t = (gx - b.x) / vx;
    if (t < 0 || t > 2.4) return null;
    const y = b.y + vy * t;
    // yerçekimi + sekme yaklaşımı (basit)
    let z = b.z + b.vz * t - 0.5 * G * t * t;
    while (z < 0.11) z = 0.11 + (0.11 - z) * 0.52;
    return { y, z, t };
  }

  private gkLogic(dt: number): void {
    if (this.phase !== "play") return;
    const b = this.ball;
    for (let i = 0; i < 2; i++) {
      const ti = i as 0 | 1;
      const gk = this.teams[i].mps[0];
      if (!gk || !gk.isGK || !gk.onPitch) continue;
      if (b.owner) {
        // dağıtım
        if (b.owner === gk && gk.cool.pass <= 0) {
          gk.cool.pass = 1.1;
          const mates = this.teams[i].mps.filter((m) => m.onPitch && m !== gk);
          const long = this.teams[i].tactic.passing === "long";
          let target = mates.filter((m) => !m.isGK)
            .sort((a, c) => (long ? -Math.abs(a.x - gk.x) : Math.abs(a.x - gk.x) - Math.abs(c.x - gk.x)))[0];
          if (!target) target = mates[0];
          if (target) this.doPass(gk, target, true);
        }
        continue;
      }
      const speed = Math.hypot(b.vx, b.vy);
      const d = this.md(gk, b);
      const pred = this.predictAtGoal(ti);
      const onTarget = !!pred && Math.abs(pred.y) < PITCH.GOAL_W / 2 + 0.12 && pred.z < PITCH.GOAL_H + 0.12;

      /* --- 1) REFLEKS DALIŞI (görsel) ---
         Şut kaleye gidiyorsa kaleci topun yanına gelmeyi beklemez, önceden uzanır.
         Kurtarış KARARI kale çizgisinde verilir (bkz. updateBall) — burada yalnızca
         dalış animasyonu tetiklenir, hiçbir istatistik işlenmez. */
      if (onTarget && pred && pred.t <= 0.42 && !b.owner && gk.dive <= 0 && gk.cool.dive <= 0) {
        gk.cool.dive = 0.6;
        gk.dive = 0.5;
        gk.diveVz = clamp(pred.z, 0.2, 2.2);
        // dalış yönü: tahmini varış noktasına doğru yanal sıçrama
        gk.vy += clamp(pred.y - gk.y, -3.2, 3.2) * 1.35;
      }

      /* --- 2) TOPU SAHİPLENME (ortalar, geri paslar, boş toplar) --- */
      let reach = 1.95;
      if (speed > 14) reach *= 0.62;
      if (speed > 22) reach *= 0.86;
      if (b.z > 2.4) reach *= 0.5;
      if (d > reach || b.z > 2.7) continue;
      if (b.saveTried) continue;
      b.saveTried = true;
      const spread = Math.hypot(pred ? pred.y - gk.y : b.y - gk.y, b.z - 0.8);
      let control = 1.22 - speed / 38 + gk.eff.gk * 0.0022 - clamp(spread, 0, 4) * 0.085;
      if (this.userTeam !== null && i === this.userTeam) control += this.diff * 0.02;
      else control -= this.diff * 0.012;
      control = clamp(control, 0.1, 0.95);
      if (onTarget && !b.otDone) {
        this.stats.onTarget[b.lastTouchTeam]++;
        b.otDone = true;
        b.shotCounted = true;
      }
      gk.dive = 0.45;
      gk.diveVz = clamp(b.z, 0.2, 2.2);
      if (this.rng.next() < control) {
        this.stats.saves[ti]++;
        gk.saves++;
        gk.rating += 0.18;
        this.takeBall(gk);
        gk.cool.pass = 0.9;
        this.onEvent({ kind: "save" });
      }
    }
    void dt;
  }

  /* ------------------------------------------------------------------ */
  /*  TOPA SAHİP YAPAY ZEKÂ                                              */
  /* ------------------------------------------------------------------ */

  private aiOnBall(mp: MP): { x: number; y: number; sprint: boolean } {
    const t = this.teams[mp.team];
    const b = this.ball;
    const gx = this.goalX(mp.team);
    const dist = Math.hypot(gx - mp.x, mp.y);
    const pressure = this.pressureOn(mp);
    const inBox = this.inPenaltyBox(mp.x, mp.y, (1 - mp.team) as 0 | 1);
    const ownThird = this.progress(mp.team) < 0.34;
    const passes = this.evaluatePasses(mp);
    const bestPass = passes.length ? passes[0].score : 0;
    const mustRisk = t.tac.risk >= 1 ? 1 : 0;

    // --- ORTA (kanattan ceza sahasına) ---
    // Kanatta, final üçte birde ve ceza sahasında hedef varsa orta açılır.
    if (mp.cool.decide <= 0 && !inBox && Math.abs(mp.y) > 17 && dist < 34 && mp.cool.pass <= 0) {
      const box = t.mps.filter((m) => m.onPitch && m !== mp && !m.isGK
        && Math.abs(m.x - gx) < 17 && Math.abs(m.y) < 15);
      if (box.length && this.rng.next() < 0.55) {
        this.doCross(mp, box);
        return { x: mp.fx, y: mp.fy, sprint: false };
      }
    }

    if (mp.cool.decide <= 0) {
      // Gerçek oyuncular topu 0.5-1 sn taşır. Eskiden 0.16 sn'de karar veriliyordu:
      // top sürekli sektiği için ikili mücadele, müdahale ve faul neredeyse hiç oluşmuyordu.
      mp.cool.decide = 0.62 + this.rng.next() * 0.55;
      const dec = brainOnBall({
        dist, pressure, inBox: inBox ? 1 : 0, central: Math.abs(mp.y) < 16 ? 1 : 0,
        ownThird: ownThird ? 1 : 0, shoot: mp.eff.sho / 108, passBest: bestPass,
        dribble: (mp.eff.pac + mp.eff.pas) / 216, mustRisk,
      });
            switch (dec.act) {
        case "shoot":
          if (mp.cool.shoot <= 0) { this.doShoot(mp, dec.power); return { x: mp.fx, y: mp.fy, sprint: false }; }
          break;
        case "clear":
          this.doClear(mp);
          return { x: mp.fx, y: mp.fy, sprint: false };
        case "pass": {
          const target = passes.length ? passes[0].target : null;
          if (target && mp.cool.pass <= 0) {
            this.doPass(mp, target, dist > 26 && t.tactic.passing === "long");
            return { x: mp.fx, y: mp.fy, sprint: false };
          }
          break;
        }
        default:
          break;
      }
    }
    // dribbling / ilerleme
    let tx: number, ty: number;
    if (pressure > 0.55 && mp.eff.def > 60) {
      // sırtını dönüp topu koru
      tx = mp.x - t.dir * 2;
      ty = mp.y + (mp.y > 0 ? -3 : 3);
    } else {
      const goalAng = Math.atan2(0 - mp.y, gx - mp.x);
      const wob = Math.sin(this.tick * 0.03 + mp.idx) * 0.5;
      tx = mp.x + Math.cos(goalAng + wob * 0.5) * 12;
      ty = mp.y + Math.sin(goalAng + wob * 0.5) * 12;
      const best = passes[0];
      if (best && best.target.y !== mp.y) {
        ty += (best.target.y - mp.y) * 0.12;
      }
    }
    void b;
    return { x: (tx - mp.x) / 10, y: (ty - mp.y) / 10, sprint: pressure < 0.4 };
  }

  private pressureOn(mp: MP): number {
    let p = 0;
    for (const o of this.mps) {
      if (!o.onPitch || o.team === mp.team) continue;
      const d = this.md(o, mp);
      if (d < 6) p += (6 - d) / 6;
    }
    return clamp(p / 2.4, 0, 1);
  }

  private evaluatePasses(): { target: MP; score: number }[];
  private evaluatePasses(mp: MP): { target: MP; score: number }[];
  private evaluatePasses(mp?: MP): { target: MP; score: number }[] {
    if (!mp) return [];
    const t = this.teams[mp.team];
    const out: { target: MP; score: number }[] = [];
    for (const m of t.mps) {
      if (m === mp || !m.onPitch || m.isGK) continue;
      const d = this.md(m, mp);
      if (d < 4 || d > 46) continue;
      const forward = (m.x - mp.x) * t.dir;
      // pas hattı riski
      let risk = 0;
      for (const o of this.mps) {
        if (!o.onPitch || o.team === mp.team) continue;
        const ax = m.x - mp.x, ay = m.y - mp.y;
        const len = Math.hypot(ax, ay) || 1;
        const ux = ax / len, uy = ay / len;
        const dx = o.x - mp.x, dy = o.y - mp.y;
        const along = dx * ux + dy * uy;
        if (along < 0 || along > len) continue;
        const perp = Math.abs(dx * -uy + dy * ux);
        if (perp < 2.2) risk += (2.2 - perp) / 2.2;
      }
      const openness = clamp(1 - risk * 0.32, 0, 1);
      // İleri oynama belirgin biçimde ödüllendirilir; sürekli yan/geri pas kısırdöngüsü
      // takımların hiç final üçte bire girememesine yol açıyordu.
      let score = 18 + forward * 1.18 - d * 0.20 + openness * 30;
      if (forward < -5) score -= 15;
      if (m.role === "ST" || m.role === "LW" || m.role === "RW") score += 8;
      if (this.progress(mp.team) > 0.62 && forward > 4) score += 10;
      // ceza sahasına yapılan pas
      if (this.inPenaltyBox(m.x, m.y, (1 - mp.team) as 0 | 1)) score += 16;
      if (t.tactic.passing === "short" && d > 24) score -= 12;
      if (t.tactic.passing === "long" && d < 14) score -= 8;
      // ofsayt riski
      if (this.settings.offside && forward > 2) {
        const line = this.offsideLine(mp.team);
        if (m.x * t.dir > line * t.dir) score -= 22;
      }
      out.push({ target: m, score: clamp(score, 0, 100) });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }

  /* ------------------------------------------------------------------ */
  /*  AKSİYONLAR                                                          */
  /* ------------------------------------------------------------------ */

  doPass(mp: MP, target: MP, lofted = false): void {
    const b = this.ball;
    if (b.owner !== mp) return;
    const d = this.md(mp, target);
    const err = (1 - mp.eff.pas / 130) * 0.36 * this.assistMul + this.pressureOn(mp) * 0.20;
    const ang = Math.atan2(target.y - mp.y, target.x - mp.x) + (this.rng.next() - 0.5) * 2 * err;
    /* Pas hızı sürtünmeye göre hesaplanır: yuvarlanan top v0/AIR metre sonra durur.
       Eski sabit (7.5 + 0.66d) kısa paslarda topu hedefin 15-25 m ötesine taşıyor,
       bu da sürekli aut/korner üretiyordu. Artık top alıcıya ~5 m/s ile ulaşır. */
    const arrive = lofted ? 6.2 : 4.8;
    const spd = clamp(arrive + d * AIR + (lofted ? 2.2 : 0), 6, 30);
    b.owner = null;
    b.lastTouch = mp;
    b.lastTouchTeam = mp.team;
    b.vx = Math.cos(ang) * spd;
    b.vy = Math.sin(ang) * spd;
    b.vz = lofted ? clamp(d * 0.14, 1.2, 6.5) : 0;
    b.z = Math.max(b.z, 0.11);
    b.shotCounted = true;
    b.otDone = false;
    b.saveTried = true;
    b.shooter = null;
    (b as unknown as {k?:string; px?:number; py?:number; tx?:number; ty?:number; kr?:string}).k = "pass";
    mp.passes++;
    this.stats.passes[mp.team]++;
    mp.cool.pass = 0.5;
    mp.cool.decide = 0.55;
    this.lastPasser = mp;
    this.receiver[mp.team] = target;
    // alıcıya yönlendir + ofsayt bayrağı
    const lead = clamp(d * 0.10, 0.6, 4);
    target.vx = Math.cos(ang) * lead * 1.6;
    target.vy = Math.sin(ang) * lead * 1.6;
    if (this.settings.offside) {
      const line = this.offsideLine(mp.team);
      if (target.x * this.teams[mp.team].dir > line * this.teams[mp.team].dir + 0.4) {
        this.offsidePending = target;
      }
    }
    this.onEvent({ kind: "kick", power: 0.35 });
  }

  doShoot(mp: MP, power = 0.8): void {
    const b = this.ball;
    if (b.owner !== mp) return;
    const t = this.teams[mp.team];
    const gx = this.goalX(mp.team);
    const d = Math.hypot(gx - mp.x, mp.y);
    // nişan: kaleciden uzak köşe (assist=2)
    const gk = this.teams[1 - mp.team].mps[0];
    let aimY: number;
    if (this.settings.assist >= 2 && gk) {
      aimY = gk.y > 0 ? -PITCH.GOAL_W / 2 + 0.85 : PITCH.GOAL_W / 2 - 0.85;
    } else {
      // Direğin dibini değil, kalenin içini nişanlar — yetenek arttıkça köşeye yaklaşır.
      const edge = 0.30 + (mp.eff.sho / 108) * 0.38 + this.rng.next() * 0.14;
      aimY = (this.rng.next() < 0.5 ? -1 : 1) * (PITCH.GOAL_W / 2) * clamp(edge, 0.15, 0.80);
    }
    const aimZ = 0.35 + this.rng.next() * 1.25;
    const err = (1 - mp.eff.sho / 150) * 0.225 * this.assistMul + this.pressureOn(mp) * 0.10 + (1 - power) * 0.05 + d * 0.0036;
    const ang = Math.atan2(aimY - mp.y, gx - mp.x) + (this.rng.next() - 0.5) * 2 * err;
    const spd = clamp(19 + power * 15 + mp.eff.sho * 0.05, 18, 34);
    b.owner = null;
    b.lastTouch = mp;
    b.lastTouchTeam = mp.team;
    b.vx = Math.cos(ang) * spd;
    b.vy = Math.sin(ang) * spd;
    const tt = clamp(Math.abs((gx - mp.x) / (b.vx || 1)), 0.12, 1.6);
    b.vz = clamp((aimZ - 0.11) / tt + 0.5 * G * tt, 0.4, 11);
    b.z = Math.max(b.z, 0.14);
    b.shotCounted = false;   // (b) kuralı: şut başına bir kez sayılabilir
    b.otDone = false;
    b.saveTried = false;
    b.shooter = mp;
    b.assistCand = this.lastPasser && this.lastPasser.team === mp.team && this.lastPasser !== mp ? this.lastPasser : null;
    mp.shots++;
    this.stats.shots[mp.team]++;
    mp.cool.shoot = 0.95;
    mp.cool.pass = 0.4;
    mp.cool.decide = 0.35;
    this.lastPasser = null;
    this.onEvent({ kind: "kick", power: 0.9 + power * 0.4 });
    this.momentum = clamp(this.momentum + (mp.team === 0 ? 1 : -1) * 0.2, -1, 1);
    void t;
  }

  /** Kanattan ceza sahasına yükseltilmiş orta. */
  doCross(mp: MP, box: MP[]): void {
    const b = this.ball;
    if (b.owner !== mp) return;
    const t = this.teams[mp.team];
    const gx = this.goalX(mp.team);
    // hedef: ceza noktası civarı, en iyi kafa oyuncusunun biraz önü
    const best = box.sort((a, c) => c.eff.phy - a.eff.phy)[0];
    const aimX = gx - t.dir * (7 + this.rng.next() * 6);
    const aimY = best.y * 0.7 + (this.rng.next() - 0.5) * 6;
    const dx = aimX - mp.x, dy = aimY - mp.y;
    const d = Math.hypot(dx, dy) || 1;
    const err = (1 - mp.eff.pas / 130) * 0.30 * this.assistMul + this.pressureOn(mp) * 0.18;
    const ang = Math.atan2(dy, dx) + (this.rng.next() - 0.5) * 2 * err;
    const spd = clamp(7.0 + d * 0.62, 9, 26);
    b.owner = null;
    b.lastTouch = mp;
    b.lastTouchTeam = mp.team;
    b.vx = Math.cos(ang) * spd;
    b.vy = Math.sin(ang) * spd;
    b.vz = clamp(d * 0.20, 2.4, 7.5);
    b.z = Math.max(b.z, 0.2);
    b.shotCounted = true;
    b.otDone = false;
    b.saveTried = false;
    b.shooter = null;
    mp.passes++;
    this.stats.passes[mp.team]++;
    mp.cool.pass = 0.7;
    mp.cool.decide = 0.7;
    this.lastPasser = mp;
    this.receiver[mp.team] = best;
    this.onEvent({ kind: "kick", power: 0.7 });
  }

  doClear(mp: MP): void {
    const b = this.ball;
    if (b.owner !== mp) return;
    const t = this.teams[mp.team];
    // Uzaklaştırma ileriye doğrudur; aşırı yanal açı topu sürekli aut/korner yapıyordu.
    const ang = Math.atan2((this.rng.next() - 0.5) * 1.05, t.dir) + (this.rng.next() - 0.5) * 0.22;
    b.owner = null;
    b.lastTouch = mp;
    b.lastTouchTeam = mp.team;
    b.vx = Math.cos(ang) * 19;
    b.vy = Math.sin(ang) * 13;
    b.vz = 5.2;
    b.z = 0.2;
    b.shotCounted = true;   // pas/uzaklaştırmada "şut" sayılmaz
    b.otDone = false;
    b.saveTried = true;
    b.shooter = null;
    mp.cool.pass = 0.35;
    this.lastPasser = null;
    this.onEvent({ kind: "kick", power: 1 });
  }

  userPass(lofted = false): void {
    const mp = this.controlled;
    if (!mp || this.ball.owner !== mp) return;
    const passes = this.evaluatePasses(mp);
    const dirx = Math.abs(this.input.jx) + Math.abs(this.input.jy) > 0.25 ? Math.atan2(this.input.jy, this.input.jx) : null;
    let pick = passes[0];
    if (dirx !== null && passes.length) {
      // joystick yönüne en yakın iyi aday
      let bestScore = -1;
      for (const c of passes) {
        const a = Math.atan2(c.target.y - mp.y, c.target.x - mp.x);
        let dd = Math.abs(a - dirx);
        if (dd > Math.PI) dd = Math.PI * 2 - dd;
        const sc = c.score - dd * 24;
        if (sc > bestScore) { bestScore = sc; pick = c; }
      }
    }
    if (pick) {
      this.doPass(mp, pick.target, lofted || this.md(mp, pick.target) > 30);
      return;
    }
    // uygun pas adayı yoksa topu uzaklaştır (topu taşıyan oyuncu kilitlenmesin)
    this.doClear(mp);
  }

  userShoot(power: number): void {
    const mp = this.controlled;
    if (!mp) return;
    if (this.ball.owner === mp) this.doShoot(mp, clamp(power, 0.35, 1));
  }

  userTackle(): void {
    const mp = this.controlled;
    if (!mp || mp.cool.slide > 0 || mp.slide > 0) return;
    const b = this.ball;
    const o = b.owner;
    if (o && o.team !== mp.team && this.md(mp, o) < 3.2) {
      mp.slide = 0.55;
      const a = Math.atan2(o.y - mp.y, o.x - mp.x);
      mp.slideVx = Math.cos(a) * 7.4;
      mp.slideVy = Math.sin(a) * 7.4;
      mp.cool.slide = 1.1;
      this.tryTackles();
    } else if (!o) {
      const a = Math.atan2(b.y - mp.y, b.x - mp.x);
      mp.slide = 0.45;
      mp.slideVx = Math.cos(a) * 7.4;
      mp.slideVy = Math.sin(a) * 7.4;
      mp.cool.slide = 1.0;
    }
  }

  private updateSlide(mp: MP, dt: number): void {
    mp.slide -= dt;
    mp.x = clamp(mp.x + mp.slideVx * dt, -PITCH.HL - 1.5, PITCH.HL + 1.5);
    mp.y = clamp(mp.y + mp.slideVy * dt, -PITCH.HW - 1.5, PITCH.HW + 1.5);
    mp.slideVx *= 0.955;
    mp.slideVy *= 0.955;
    mp.vx = mp.slideVx; mp.vy = mp.slideVy;
    mp.anim += dt * 8;
    const b = this.ball;
    const o = b.owner;
    if (o && o.team !== mp.team && this.md(mp, o) < 1.5) this.tryTackles();
    else if (!o && this.md(mp, b) < 1.2 && b.z < 1) this.tryPickup();
  }

  switchPlayer(): void {
    if (this.userTeam === null) return;
    const t = this.teams[this.userTeam];
    const b = this.ball;
    const cands = t.mps.filter((m) => m.onPitch && !m.isGK && m !== this.controlled);
    if (!cands.length) return;
    const ref = b.owner && b.owner.team === this.userTeam ? b.owner : b;
    const next = cands.sort((a, c) => this.md(a, ref) - this.md(c, ref))[0];
    this.controlled = next;
    this.switchLock = 0.55;
  }

  /* ------------------------------------------------------------------ */
  /*  GOL / KUTLAMA                                                      */
  /* ------------------------------------------------------------------ */

  private onGoal(team: 0 | 1): void {
    const b = this.ball;
    const scorer = b.shooter ?? b.lastTouch;
    this.score[team]++;
    const assist = b.assistCand && b.assistCand.team === team && b.assistCand !== scorer ? b.assistCand : null;
    const entry: GoalEntry = {
      minute: Math.max(1, Math.ceil(this.clock)),
      scorer: scorer ? scorer.p.name : "?",
      assist: assist ? assist.p.name : "",
      team,
    };
    this.goals.push(entry);
    if (scorer) {
      // MP sayaçları burada; dünya (kariyer) istatistikleri commitResult'ta işlenir → çift sayım olmaz
      scorer.goals++;
      scorer.rating += 1.15;
    }
    if (assist) { assist.assists++; assist.rating += 0.6; }
    // Gol her zaman isabetlidir; kaleci menziline hiç girmemiş şutlar da sayılmalı.
    if (!b.otDone) { this.stats.onTarget[team]++; b.otDone = true; b.shotCounted = true; }
    // Duran toptan/sekmeden gelen gollerde "şut" sayacı da işlensin (İS > ŞUT olmasın).
    if (!b.shooter) this.stats.shots[team]++;
    this.phase = "goal";
    this.goalBanner = { scorer: entry.scorer, assist: entry.assist, hg: this.score[0], ag: this.score[1], t: 0 };
    this.celebrator = scorer;
    this.celebrateTimer = 3.6;
    this.shake = 1;
    this.flash = 1;
    this.say("goal", entry.scorer, this.teams[team].club.short);
    this.onEvent({ kind: "goal", text: entry.scorer });
    this.spawnConfetti(team);
    // kutlama koreografisi (render değil, motor yönetir)
    if (scorer) {
      scorer.celeb = 3.6;
      scorer.celebKind = Math.abs(hashIdx(scorer.p.id)) % 5;
      const mates = this.teams[team].mps.filter((m) => m.onPitch && m !== scorer);
      mates.forEach((m, i) => {
        m.celeb = 3.6;
        m.celebKind = (i + 1) % 5;
      });
      this.teams[1 - team].mps.forEach((m) => { m.celeb = 0; });
    }
    this.ball.owner = null;
    this.ball.vx = 0; this.ball.vy = 0; this.ball.vz = 0;
  }

  private updateCelebration(dt: number): void {
    this.celebrateTimer -= dt;
    const scorer = this.celebrator;
    if (scorer) {
      // köşe bayrağına doğru koş
      const cx = Math.sign(scorer.x || 1) * (PITCH.HL - 3);
      const cy = Math.sign(scorer.y || 1) * (PITCH.HW - 3);
      this.moveToward(scorer, cx, cy, dt, true);
    }
    const team = scorer ? scorer.team : 0;
    this.teams[team].mps.filter((m) => m.onPitch && m !== scorer && m.celeb > 0).forEach((m, i) => {
      m.celeb -= dt;
      // golcü etrafında dairesel konumlanma
      const a = (i / 9) * Math.PI * 2 + this.celebrateTimer;
      const tx = (scorer ? scorer.x : 0) + Math.cos(a) * 4.2;
      const ty = (scorer ? scorer.y : 0) + Math.sin(a) * 4.2;
      this.moveToward(m, tx, ty, dt, false);
    });
    // rakip orta sahaya döner
    this.teams[1 - team].mps.forEach((m) => {
      if (!m.onPitch) return;
      this.moveToward(m, m.x * 0.55, m.y * 0.55, dt, false);
    });
    if (this.celebrateTimer <= 0) {
      this.celebrator = null;
      this.goalBanner = null;
      for (const m of this.mps) m.celeb = 0;
      this.phase = "dead";
      this.setRestart("kickoff", (1 - team) as 0 | 1, 0, 0);
    }
  }

  private updateCelebRun(mp: MP, dt: number): void {
    void dt;
    void mp;
  }

  private spawnConfetti(team: 0 | 1): void {
    const kit = this.teams[team].club.kit;
    const cols = [kit.primary, kit.secondary, "#ffffff", kit.shorts];
    const src = this.celebrator ?? { x: 0, y: 0 };
    this.confetti = [];
    for (let i = 0; i < 70; i++) {
      const a = this.rng.next() * Math.PI * 2;
      this.confetti.push({
        x: src.x, y: src.y, z: 1.2 + this.rng.next() * 2,
        vx: Math.cos(a) * (2 + this.rng.next() * 7),
        vy: Math.sin(a) * (2 + this.rng.next() * 7),
        vz: 4 + this.rng.next() * 7,
        c: cols[i % cols.length], a: 1, r: this.rng.next() * Math.PI,
      });
    }
  }

  private updateConfetti(dt: number): void {
    if (!this.confetti.length) return;
    for (const c of this.confetti) {
      c.vz -= G * dt * 0.55;
      c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      c.vx *= 0.985; c.vy *= 0.985;
      c.r += dt * 6;
      if (c.z < 0.05) { c.z = 0.05; c.vz = 0; c.a -= dt * 0.5; }
    }
    this.confetti = this.confetti.filter((c) => c.a > 0.02);
  }

  /* ------------------------------------------------------------------ */
  /*  DURAN TOP                                                          */
  /* ------------------------------------------------------------------ */

  private outOfPlay(px: number, py: number): void {
    const b = this.ball;
    const lastTeam = b.lastTouchTeam;
    if (Math.abs(b.y) > PITCH.HW) {
      const side = b.y > 0 ? 1 : -1;
      this.setRestart("throwin", (1 - lastTeam) as 0 | 1, clamp(b.x, -PITCH.HL + 2, PITCH.HL - 2), side * (PITCH.HW - 0.4));
      return;
    }
    // kale çizgisi
    const sideX = b.x > 0 ? 1 : -1;
    const defTeam = this.teams[0].dir === sideX ? 1 : 0;  // o kaleye hücum eden takım değil → savunan
    const attackingTeam = (1 - defTeam) as 0 | 1;
    void px; void py; void attackingTeam;
    if (lastTeam === attackingTeam) {
      // son dokunan hücum eden takım → kale vuruşu
      this.setRestart("goalkick", defTeam, sideX * (PITCH.HL - 5.5), clamp(b.y, -12, 12));
    } else {
      // korner
      this.stats.corners[attackingTeam]++;
      this.say("corner");
      this.onEvent({ kind: "corner" });
      this.setRestart("corner", attackingTeam, sideX * (PITCH.HL - 0.4), b.y > 0 ? PITCH.HW - 0.4 : -(PITCH.HW - 0.4));
    }
  }

  setRestart(kind: RestartKind, team: 0 | 1, x: number, y: number): void {
    this.phase = "dead";
    this.ball.owner = null;
    this.ball.vx = 0; this.ball.vy = 0; this.ball.vz = 0;
    this.ball.x = x; this.ball.y = y;
    this.ball.z = kind === "throwin" ? 1.6 : 0.11;
    this.ball.shotCounted = true;
    this.ball.otDone = false;
    this.ball.saveTried = true;
    this.ball.shooter = null;
    this.lastPasser = null;
    this.offsidePending = null;
    this.receiver[0] = null;
    this.receiver[1] = null;
    const t = this.teams[team];
    let taker: MP | null = null;
    if (kind === "penalty") {
      taker = t.mps.filter((m) => m.onPitch && !m.isGK).sort((a, b) => b.eff.sho - a.eff.sho)[0] ?? null;
    } else if (kind === "goalkick") {
      taker = t.mps[0] ?? null;
    } else if (kind === "kickoff") {
      taker = t.mps.filter((m) => m.onPitch && !m.isGK).sort((a, b) => Math.abs(a.y) - Math.abs(b.y))[0] ?? null;
    } else {
      taker = t.mps.filter((m) => m.onPitch && !m.isGK)
        .sort((a, b) => this.md(a, { x, y }) - this.md(b, { x, y }))[0] ?? null;
    }
    const manual = this.userTeam !== null && team === this.userTeam && kind !== "kickoff";
    this.restart = { kind, team, x, y, taker, timer: manual ? 6 : 1.15, manual };
    this.deadGuard = 0;
  }

  private updateDead(dt: number): void {
    const r = this.restart;
    if (!r) return;
    r.timer -= dt;
    this.deadGuard += dt;
    const force = r.timer <= 0 || this.deadGuard > 7;
    if (force) this.executeRestart();
  }

  executeRestart(): void {
    const r = this.restart;
    if (!r) return;
    this.restart = null;
    this.phase = "play";
    const t = this.teams[r.team];
    const taker = r.taker ?? t.mps.filter((m) => m.onPitch)[0];
    if (!taker) return;
    // atıcıyı topun başına getir
    taker.x = r.x - t.dir * 0.9;
    taker.y = r.y;
    this.ball.x = r.x; this.ball.y = r.y;
    this.takeBall(taker);
    this.ball.lastTouch = taker;
    this.ball.lastTouchTeam = r.team;

    switch (r.kind) {
      case "kickoff": {
        const mate = t.mps.filter((m) => m.onPitch && m !== taker && !m.isGK)
          .sort((a, b) => this.md(a, taker) - this.md(b, taker))[0];
        if (mate) this.doPass(taker, mate, false);
        this.onEvent({ kind: "kickoff" });
        break;
      }
      case "throwin": {
        const mates = this.evaluatePasses(taker);
        const mate = mates[0]?.target ?? t.mps[3];
        if (mate) this.doPass(taker, mate, true);
        break;
      }
      case "goalkick": {
        const mates = this.evaluatePasses(taker);
        const long = t.tactic.passing === "long";
        const mate = long ? mates[mates.length - 1]?.target : mates[0]?.target;
        if (mate) this.doPass(taker, mate, long);
        else this.doClear(taker);
        break;
      }
      case "corner": {
        const box = t.mps.filter((m) => m.onPitch && !m.isGK && Math.abs(m.x - this.goalX(r.team)) < 22 && Math.abs(m.y) < 20);
        const target = box.sort((a, b) => b.eff.phy - a.eff.phy)[0] ?? t.mps[9];
        if (target) this.doPass(taker, target, true);
        else this.doClear(taker);
        break;
      }
      case "freekick": {
        const gx = this.goalX(r.team);
        const dGoal = Math.hypot(gx - r.x, r.y);
        if (dGoal < 26 && Math.abs(r.y) < 22) this.doShoot(taker, 0.85);
        else {
          const mates = this.evaluatePasses(taker);
          if (mates[0]) this.doPass(taker, mates[0].target, dGoal > 30);
          else this.doClear(taker);
        }
        break;
      }
      case "penalty": {
        this.doShoot(taker, 0.92);
        break;
      }
      default:
        break;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  DEĞİŞİKLİK / İSTATİSTİK                                             */
  /* ------------------------------------------------------------------ */

  substitute(team: 0 | 1, outId: string, inId: string): boolean {
    const t = this.teams[team];
    if (t.used >= 3) return false;
    const out = t.mps.find((m) => m.p.id === outId && m.onPitch);
    if (!out) return false;
    const inPlayer = t.bench.find((p) => p.id === inId);
    if (!inPlayer) return false;
    t.bench = t.bench.filter((p) => p.id !== inId);
    const form = formationById(t.tactic.formation);
    const slot = form.slots[out.idx] ?? form.slots[0];
    const nm = mkMP(inPlayer, team, out.idx, t.dir, slot.role, t.boost);
    nm.baseFx = out.baseFx; nm.baseFy = out.baseFy;
    nm.x = out.x; nm.y = out.y;
    t.mps[out.idx] = nm;
    out.onPitch = false;
    out.off = true;
    if (this.ball.owner === out) this.ball.owner = null;
    this.mps = this.mps.filter((m) => m !== out);
    this.mps.push(nm);
    if (this.controlled === out) this.controlled = nm;
    t.used++;
    this.onEvent({ kind: "sub", text: inPlayer.name });
    return true;
  }

  private updateCooldowns(dt: number): void {
    for (const mp of this.mps) {
      mp.cool.tackle = Math.max(0, mp.cool.tackle - dt);
      mp.cool.shoot = Math.max(0, mp.cool.shoot - dt);
      mp.cool.pass = Math.max(0, mp.cool.pass - dt);
      mp.cool.decide = Math.max(0, mp.cool.decide - dt);
      mp.cool.slide = Math.max(0, mp.cool.slide - dt);
      mp.cool.dive = Math.max(0, mp.cool.dive - dt);
      if (mp.dive > 0) mp.dive -= dt;
      if (mp.slide < 0) mp.slide = 0;
      if (mp.jump > 0) mp.jump -= dt;
    }
    // CPU otomatik değişiklik
    const minNorm = (this.clock / this.minutes) * 90;
    for (let i = 0; i < 2; i++) {
      const ti = i as 0 | 1;
      if (this.userTeam === ti) continue;
      const t = this.teams[i];
      if (t.used >= 3 || t.bench.length === 0) continue;
      if (minNorm < 55) continue;
      const tired = t.mps.filter((m) => m.onPitch && !m.isGK).sort((a, b) => a.stamina - b.stamina)[0];
      if (tired && this.rng.next() < 0.05) {
        if (cpuSubCheck(minNorm, tired.stamina, this.diff) && tired.stamina < 58) {
          // pozisyon uyumlu yedek tercih edilir (kaleciyi sahaya sürme hatası olmasın)
          const inP = t.bench.find((x) => x.pos === tired.p.pos)
            ?? t.bench.find((x) => (tired.p.pos === "GK" ? true : x.pos !== "GK"));
          if (inP) this.substitute(ti, tired.p.id, inP.id);
        }
      }
    }
  }

  private updateStats(dt: number): void {
    void dt;
    const b = this.ball;
    const holder = b.owner ? b.owner.team : b.lastTouchTeam;
    this.possFrames[holder]++;
    const total = this.possFrames[0] + this.possFrames[1];
    if (total > 30) {
      this.stats.possession[0] = Math.round((this.possFrames[0] / total) * 100);
      this.stats.possession[1] = 100 - this.stats.possession[0];
    }
    for (let i = 0; i < 2; i++) {
      this.stats.passAcc[i] = this.stats.passes[i] > 0
        ? Math.round((this.passOkTeam[i] / this.stats.passes[i]) * 100)
        : 0;
    }
  }

  private say(kind: string, name = "", team = ""): void {
    if (!this.settings.commentary) return;
    this.commentary = brainCommentary(kind, name, team);
    this.commTimer = 4;
  }

  /* ------------------------------------------------------------------ */
  /*  SONUÇ                                                              */
  /* ------------------------------------------------------------------ */

  get minutesLeft(): number { return Math.max(0, this.minutes - this.clock); }

  motm(): { id: string; name: string; score: number; rating: number } {
    let best = { id: "", name: "", score: -1, rating: 6 };
    for (const mp of this.mps) {
      const rating = clamp(6.2 + mp.rating - 6.2 + mp.goals * 0.35, 3, 10);
      const score = brainMotm(rating, mp.goals, mp.assists, mp.passes, mp.tackles, mp.saves);
      if (score > best.score) best = { id: mp.p.id, name: mp.p.name, score, rating: +rating.toFixed(1) };
    }
    return best;
  }

  performans(): { name: string; team: 0 | 1; rating: number; goals: number; assists: number; pos: PosCode; motm: boolean }[] {
    const m = this.motm();
    return this.mps.map((mp) => ({
      name: mp.p.name, team: mp.team,
      rating: +clamp(6.2 + mp.rating - 6.2 + mp.goals * 0.35, 3, 10).toFixed(1),
      goals: mp.goals, assists: mp.assists, pos: mp.role,
      motm: mp.p.id === m.id,
    })).sort((a, b) => b.rating - a.rating).slice(0, 14);
  }

  getResult(): MatchResult {
    return {
      homeId: this.teams[0].club.id,
      awayId: this.teams[1].club.id,
      hg: this.score[0], ag: this.score[1],
      stats: {
        possession: [...this.stats.possession] as number[],
        shots: [...this.stats.shots], onTarget: [...this.stats.onTarget],
        passes: [...this.stats.passes], passAcc: [...this.stats.passAcc],
        corners: [...this.stats.corners], fouls: [...this.stats.fouls],
        offside: [...this.stats.offside], tackles: [...this.stats.tackles],
        saves: [...this.stats.saves],
      },
      goals: [...this.goals],
      cards: [...this.cards],
      motm: this.motm().id,
      pens: this.pens ? [...this.pens] as [number, number] : null,
      userTeam: this.userTeam,
    };
  }

  /** Arka planda maç sonuna kadar hızlı simülasyon (güvenlik freniyle). */
  simulateToEnd(maxSeconds = 4): void {
    const guard = performance.now() + maxSeconds * 1000;
    let safety = 0;
    while (this.phase !== "fulltime" && this.phase !== "pens" && safety < 400000) {
      if (this.phase === "halftime") this.resumeSecondHalf();
      // her adımda iki fizik adımı → headless simülasyon ~2x hızlı
      this.step();
      this.step();
      safety += 2;
      if (performance.now() > guard) break;
    }
    if (this.phase !== "fulltime" && this.phase !== "pens") this.finishMatch();
  }

  get momentumLevel(): number { return this.momentum; }
}

function hashIdx(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h;
}

function cpuSubCheck(minute: number, stamina: number, diff: number): boolean {
  if (minute < 55) return false;
  let thr = 58 - diff * 2;
  if (minute > 78) thr += 8;
  return stamina < thr;
}
