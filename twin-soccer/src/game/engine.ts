import type { Commentary, MatchStats, Player, PosCode, TeamTactic } from "./types";
import { FORMATION_MAP, overall } from "./formations";
import { commentary as luaCommentary, onballDecision, tactics as luaTactics } from "./brain";
import { RNG, clamp, dist } from "./rng";

/* ============================================================
 *  BYMEL SOCCER — Maç Motoru
 *  Sabit adımlı fizik (60Hz) + pozisyonel yapay zekâ
 * ============================================================ */

export const PITCH = {
  L: 105,
  W: 68,
  GOAL_W: 7.32,
  GOAL_H: 2.44,
  PEN_D: 16.5,
  PEN_W: 40.32,
  SIX_D: 5.5,
  SIX_W: 18.32,
  CIRCLE: 9.15,
};

export interface MP {
  id: string;
  ref: Player;
  team: 0 | 1;
  role: PosCode;
  fx: number;
  fy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  stamina: number;
  cooldown: number;
  tackleCd: number;
  slide: number;
  stagger: number;
  gk: boolean;
  eff: { pac: number; sho: number; pas: number; def: number; phy: number; gk: number };
  rating: number;
  goals: number;
  assists: number;
  tackles: number;
  passes: number;
  passesOk: number;
  shots: number;
  yellow: number;
  red: boolean;
  onPitch: boolean;
  minutes: number;
  anim: number;
  celebrate: number;
  dive: number;
  decT: number;
}

export interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  owner: MP | null;
  lastTouch: MP | null;
  lastTouchTeam: 0 | 1 | null;
  spin: number;
  /** Bu şut isabetli olarak sayıldı mı? */
  shotCounted: boolean;
  /** Bu şut için kaleci kurtarış denemesi yapıldı mı? */
  saveTried: boolean;
}

export interface MatchInput {
  mx: number;
  my: number;
  sprint: boolean;
  pass: boolean;
  shootRelease: boolean;
  shootPower: number;
  through: boolean;
  switchP: boolean;
  slide: boolean;
  aimX: number;
  aimY: number;
}

export const emptyInput = (): MatchInput => ({
  mx: 0, my: 0, sprint: false, pass: false, shootRelease: false, shootPower: 0,
  through: false, switchP: false, slide: false, aimX: 0, aimY: 0,
});

type RestartType = "kickoff" | "throwin" | "goalkick" | "corner" | "freekick" | "penalty" | "goal";

interface Restart {
  type: RestartType;
  x: number;
  y: number;
  team: 0 | 1;
  timer: number;
  taker: MP | null;
}

export interface TeamInfo {
  clubId: string;
  name: string;
  short: string;
  tactic: TeamTactic;
  lineup: string[];
  subs: string[];
  rating: number;
  aiSkill: number;
  isUser: boolean;
  formation: string;
  subsUsed?: number;
}

const FIXED = 1 / 60;

export class MatchEngine {
  teams: [TeamInfo, TeamInfo];
  players: MP[] = [];
  ball: Ball;
  clock = 0;
  addedTime = 0;
  half: 1 | 2 = 1;
  phase: "kickoff" | "play" | "dead" | "goal" | "halftime" | "fulltime" | "pens" = "kickoff";
  restart: Restart | null = null;
  score: [number, number] = [0, 0];
  stats: MatchStats = blankStats();
  events: Commentary[] = [];
  scorers: { clubId: string; playerId: string; minute: number }[] = [];
  cards: { playerId: string; type: "y" | "r"; minute: number }[] = [];
  dir: [number, number] = [1, -1];
  controlled: MP | null = null;
  cam = { x: PITCH.L / 2, y: PITCH.W / 2, zoom: 1 };
  fx = { flash: 0, shake: 0, goalTeam: -1 };
  possFrames: [number, number] = [1, 1];
  clockScale = 1;
  offsideOn = true;
  paused = false;
  pens: [number, number] = [0, 0];
  pensLog: string[] = [];
  freeKicks: [number, number] = [0, 0];
  /** Oynanış yardımı seviyesi (kontrolleri kolaylaştırır, CPU gücünü değiştirmez) */
  assist = 1;
  boost: [number, number] = [0, 0];
  drain: [number, number] = [1, 1];
  /** Son gol atan — kutlama koreografisi için */
  celebrator: MP | null = null;
  private celebrateTimer = 0;
  private rng: RNG;
  private acc = 0;
  private input: MatchInput = emptyInput();
  private offsideFlags = new Set<string>();
  private lastPasser: MP | null = null;
  private passTarget: MP | null = null;
  private tact: [{ push: number; press: number; line: number; width: number; tempo: number; risk: number }, { push: number; press: number; line: number; width: number; tempo: number; risk: number }] = [
    { push: 0, press: 50, line: 50, width: 50, tempo: 50, risk: 0.3 },
    { push: 0, press: 50, line: 50, width: 50, tempo: 50, risk: 0.3 },
  ];
  private staminaAvg: [number, number] = [80, 80];
  public onSound: (s: string) => void = () => {};
  public onEvent: () => void = () => {};

  constructor(
    home: TeamInfo,
    away: TeamInfo,
    private playersDb: Record<string, Player>,
    opts: {
      minutes: number;
      difficulty: number;
      offside: boolean;
      seed?: number;
      cup?: boolean;
      /** 0 manuel · 1 yarı otomatik · 2 tam yardım (yalnızca kullanıcı kontrolünü kolaylaştırır) */
      assist?: number;
      /** Menajer/tesis kaynaklı takım gücü katkısı [ev, deplasman] */
      boost?: [number, number];
      /** Kondisyon tüketim çarpanı [ev, deplasman] */
      drain?: [number, number];
    }
  ) {
    this.teams = [home, away];
    this.assist = clamp(opts.assist ?? 1, 0, 2);
    this.boost = opts.boost ?? [0, 0];
    this.drain = opts.drain ?? [1, 1];
    this.rng = new RNG(opts.seed ?? Math.floor(Math.random() * 1e9));
    this.clockScale = 90 / (opts.minutes * 60);
    this.offsideOn = opts.offside;
    this.ball = {
      x: PITCH.L / 2, y: PITCH.W / 2, z: 0, vx: 0, vy: 0, vz: 0,
      owner: null, lastTouch: null, lastTouchTeam: null, spin: 0,
      shotCounted: true, saveTried: true,
    };
    this.buildTeams();
    this.addedTime = this.rng.int(1, 3);
    this.setupKickoff(0);
    this.pushEvent("kickoff", "");
  }

  /* --------------------------- kurulum --------------------------- */
  private buildTeams() {
    this.players = [];
    for (const t of [0, 1] as const) {
      const info = this.teams[t];
      const form = FORMATION_MAP[info.formation] ?? FORMATION_MAP["442"];
      info.lineup.forEach((pid, i) => {
        const ref = this.playersDb[pid];
        if (!ref) return;
        const slot = form.slots[i] ?? form.slots[form.slots.length - 1];
        const eff = effAttrs(ref, slot.role, this.boost[t]);
        this.players.push({
          id: ref.id,
          ref,
          team: t,
          role: slot.role,
          fx: slot.fx,
          fy: slot.fy,
          x: 0, y: 0, vx: 0, vy: 0,
          facing: t === 0 ? 0 : Math.PI,
          stamina: clamp(ref.fitness ?? 100, 55, 100),
          cooldown: 0, tackleCd: 0, slide: 0, stagger: 0,
          gk: slot.role === "GK",
          eff,
          rating: 6.5, goals: 0, assists: 0, tackles: 0, passes: 0, passesOk: 0, shots: 0,
          yellow: 0, red: false, onPitch: true, minutes: 0, anim: 0, celebrate: 0, dive: 0,
          decT: this.rng.next() * 0.4,
        });
      });
    }
  }

  private slotPos(mp: MP): { x: number; y: number } {
    const d = this.dir[mp.team];
    const fx = d === 1 ? mp.fx : 1 - mp.fx;
    const fy = d === 1 ? mp.fy : 1 - mp.fy;
    return { x: fx * PITCH.L, y: fy * PITCH.W };
  }

  setupKickoff(team: 0 | 1) {
    this.phase = "kickoff";
    this.ball.owner = null;
    this.ball.vx = this.ball.vy = this.ball.vz = 0;
    this.ball.x = PITCH.L / 2;
    this.ball.y = PITCH.W / 2;
    this.ball.z = 0;
    for (const mp of this.players) {
      const s = this.slotPos(mp);
      const d = this.dir[mp.team];
      mp.x = s.x - d * 1.5;
      mp.y = s.y;
      mp.vx = mp.vy = 0;
      mp.facing = d === 1 ? 0 : Math.PI;
    }
    const taker = this.players
      .filter((p) => p.team === team && !p.gk)
      .sort((a, b) => Math.abs(b.fx - 0.5) - Math.abs(a.fx - 0.5))[0];
    if (taker) {
      taker.x = PITCH.L / 2 - this.dir[team] * 1.2;
      taker.y = PITCH.W / 2;
    }
    this.restart = { type: "kickoff", x: PITCH.L / 2, y: PITCH.W / 2, team, timer: 1.4, taker: taker ?? null };
    if (this.teams[team].isUser) this.controlled = taker ?? null;
  }

  /* --------------------------- döngü --------------------------- */
  update(dt: number, input: MatchInput) {
    if (this.paused) return;
    this.input = input;
    this.acc = Math.min(dt, 0.1);
    let guard = 0;
    while (this.acc >= FIXED && guard++ < 6) {
      this.tick(FIXED);
      this.acc -= FIXED;
    }
    // kenar tetiklemeleri tek seferlik
    input.pass = false;
    input.shootRelease = false;
    input.through = false;
    input.switchP = false;
    input.slide = false;
  }

  private tick(dt: number) {
    this.fx.flash = Math.max(0, this.fx.flash - dt);
    this.fx.shake = Math.max(0, this.fx.shake - dt * 2);
    this.updateTactics(dt);

    if (this.phase === "play" || this.phase === "kickoff" || this.phase === "dead") {
      this.clock += dt * this.clockScale;
      // Devre/maç sonu eşik kontrolü kenar tetiklemeli olmamalı: top oyun dışındayken
      // eşik geçilirse maç asla bitmez. Bu yüzden durum bazlı kontrol ediyoruz.
      if (this.half === 1 && this.clock >= 45 + this.addedTime) {
        this.halfTime();
      } else if (this.half === 2 && this.clock >= 90 + this.addedTime) {
        this.fullTime();
      }
    }

    if (this.phase === "goal") {
      this.restart!.timer -= dt;
      this.celebrate(dt);
      if (this.restart!.timer <= 0) {
        const conceded = this.restart!.team;
        this.celebrator = null;
        for (const m of this.players) m.celebrate = 0;
        this.setupKickoff(conceded);
      }
      return;
    }

    // devre arası / maç sonu: duran top ve oyuncu güncellemesi durur
    if (this.phase === "halftime" || this.phase === "fulltime") return;

    if (this.restart) {
      this.restart.timer -= dt;
      const isUserTeam = this.teams[this.restart.team].isUser;
      const autoAt = this.restart.type === "kickoff" ? 0 : isUserTeam ? -5.5 : 0;
      if (this.restart.timer <= autoAt) {
        this.executeRestart(isUserTeam ? undefined : "auto");
      }
    }

    this.updatePlayers(dt);
    this.updateBall(dt);
    this.updatePossession(dt);
    if (this.phase === "play") this.checkBounds();
    this.updateCamera(dt);
  }

  private celebrate(dt: number) {
    this.celebrateTimer += dt;
    const hero = this.celebrator;
    for (const mp of this.players) {
      if (!mp.onPitch) continue;
      mp.anim += dt * 9;
      if (hero && mp === hero) {
        // gol atan köşe direğine doğru koşar
        mp.celebrate = Math.max(0, mp.celebrate - dt * 0.35);
        const d = this.dir[mp.team];
        const tx = d === 1 ? PITCH.L - 6 : 6;
        const ty = mp.y < PITCH.W / 2 ? 5 : PITCH.W - 5;
        this.movePlayer(mp, tx, ty, dt, true);
        mp.facing = Math.atan2(ty - mp.y, tx - mp.x);
      } else if (hero && mp.team === hero.team) {
        // takım arkadaşları kutlamaya katılır
        mp.celebrate = Math.max(0, mp.celebrate - dt * 0.5);
        const ang = (hashOf(mp.id) % 360) * (Math.PI / 180);
        this.movePlayer(mp, hero.x + Math.cos(ang) * 3.4, hero.y + Math.sin(ang) * 3.4, dt, true);
      } else {
        // rakipler orta sahaya döner
        mp.celebrate = 0;
        const s2 = this.slotPos(mp);
        this.movePlayer(mp, s2.x, s2.y, dt, false);
      }
    }
  }

  private halfTime() {
    this.phase = "halftime";
    this.dir = [this.dir[1], this.dir[0]];
    this.pushEvent("half", "");
    for (const mp of this.players) {
      mp.stamina = clamp(mp.stamina + 12, 0, 100);
      mp.minutes = 45;
    }
    this.addedTime = 0;
    this.onEvent();
  }

  resumeSecondHalf() {
    this.half = 2;
    this.clock = 45;
    this.addedTime = this.rng.int(1, 4);
    this.setupKickoff(this.lastKickoffTeam === 0 ? 1 : 0);
    this.phase = "kickoff";
    this.onEvent();
  }
  private lastKickoffTeam: 0 | 1 = 0;

  private fullTime() {
    this.phase = "fulltime";
    this.pushEvent("full", "");
    for (const mp of this.players) mp.minutes = 90;
    this.onEvent();
  }

  /* --------------------------- taktik (Lua) --------------------------- */
  private tacticTimer = 0;
  private updateTactics(dt: number) {
    this.tacticTimer -= dt;
    if (this.tacticTimer > 0) return;
    this.tacticTimer = 0.75;
    for (const t of [0, 1] as const) {
      const info = this.teams[t];
      if (!info.isUser) {
        const diff = this.score[t] - this.score[1 - t];
        const out = luaTactics({
          min: this.clock,
          scoreDiff: diff,
          ratingDiff: info.rating - this.teams[1 - t].rating,
          stamina: this.staminaAvg[t],
          mentality: info.tactic.mentality,
          pressing: info.tactic.pressing,
          tempo: info.tactic.tempo,
          width: info.tactic.width,
          line: info.tactic.lineHeight,
        });
        this.tact[t] = out;
      } else {
        this.tact[t] = {
          push: (info.tactic.mentality - 50) * 0.24,
          press: 30 + info.tactic.pressing * 0.6,
          line: info.tactic.lineHeight,
          width: info.tactic.width,
          tempo: info.tactic.tempo,
          risk: info.tactic.mentality > 65 ? 0.6 : 0.3,
        };
      }
      let s = 0;
      let n = 0;
      for (const mp of this.players) if (mp.team === t && mp.onPitch) { s += mp.stamina; n++; }
      if (n) this.staminaAvg[t] = s / n;
    }
  }

  /* --------------------------- oyuncular --------------------------- */
  private updatePlayers(dt: number) {
    const inPlay = this.phase === "play" || this.phase === "kickoff" || this.phase === "dead";
    if (!inPlay && this.phase !== "goal") return;

    const owner = this.ball.owner;
    const pressers = this.computePressers();

    for (const mp of this.players) {
      if (!mp.onPitch) continue;
      mp.cooldown = Math.max(0, mp.cooldown - dt);
      mp.tackleCd = Math.max(0, mp.tackleCd - dt);
      mp.stagger = Math.max(0, mp.stagger - dt);
      mp.dive = Math.max(0, mp.dive - dt);
      if (mp.slide > 0) mp.slide = Math.max(0, mp.slide - dt);

      if (mp.gk) {
        this.gkLogic(mp, dt);
      } else {
        let tx: number;
        let ty: number;
        let sprint = false;
        const isUser = this.teams[mp.team].isUser && this.controlled === mp;

        if (isUser && this.phase !== "goal") {
          const inp = this.input;
          const mag = Math.hypot(inp.mx, inp.my);
          if (mag > 0.08) {
            const spd = this.maxSpeed(mp, inp.sprint);
            tx = mp.x + (inp.mx / mag) * spd * 0.35;
            ty = mp.y + (inp.my / mag) * spd * 0.35;
            sprint = inp.sprint;
            mp.facing = Math.atan2(inp.my, inp.mx);
          } else {
            tx = mp.x;
            ty = mp.y;
          }
          if (this.restart && this.restart.team === mp.team && this.restart.taker === mp) {
            // duran top nişan alması serbest
          }
        } else if (owner === mp) {
          const t = this.dribbleTarget(mp);
          tx = t.x;
          ty = t.y;
          sprint = t.sprint;
          mp.facing = Math.atan2(t.y - mp.y, t.x - mp.x);
          this.cpuOnBall(mp, dt);
        } else {
          const t = this.offBallTarget(mp, pressers);
          tx = t.x;
          ty = t.y;
          sprint = t.sprint;
        }

        this.movePlayer(mp, tx, ty, dt, sprint);
        if (mp.onPitch) mp.minutes += dt * this.clockScale / 60;
      }
      mp.anim += dt * (2 + Math.hypot(mp.vx, mp.vy));
    }

    this.separate();
    this.autoSwitch();
    this.userActions();
  }

  private maxSpeed(mp: MP, sprint: boolean) {
    const st = 0.62 + (mp.stamina / 100) * 0.38;
    let v = (3.6 + mp.eff.pac * 0.045) * st;
    if (sprint) v *= 1.14;
    if (mp.slide > 0) v = 9.5;
    if (mp.stagger > 0) v *= 0.35;
    if (!this.teams[mp.team].isUser) v *= 0.955 + this.teams[mp.team].aiSkill * 0.075;
    else if (this.controlled === mp) v *= 1 + this.assist * 0.025;
    return v;
  }

  private movePlayer(mp: MP, tx: number, ty: number, dt: number, sprint: boolean) {
    if (mp.stagger > 0) {
      mp.vx *= Math.pow(0.02, dt);
      mp.vy *= Math.pow(0.02, dt);
    } else {
      const maxV = this.maxSpeed(mp, sprint);
      const dx = tx - mp.x;
      const dy = ty - mp.y;
      const d = Math.hypot(dx, dy);
      let wantVx = 0;
      let wantVy = 0;
      if (d > 0.05) {
        const s = Math.min(maxV, d * 4.5);
        wantVx = (dx / d) * s;
        wantVy = (dy / d) * s;
      }
      const k = 1 - Math.pow(0.0006, dt);
      mp.vx += (wantVx - mp.vx) * k;
      mp.vy += (wantVy - mp.vy) * k;
    }
    mp.x = clamp(mp.x + mp.vx * dt, -1.5, PITCH.L + 1.5);
    mp.y = clamp(mp.y + mp.vy * dt, -1.5, PITCH.W + 1.5);
    if (Math.hypot(mp.vx, mp.vy) > 0.6 && mp.stagger <= 0) mp.facing = Math.atan2(mp.vy, mp.vx);
    // stamina
    const effort = Math.hypot(mp.vx, mp.vy) / 8;
    const drain = this.drain[mp.team] ?? 1;
    mp.stamina = clamp(mp.stamina - dt * (0.32 + effort * (sprint ? 1.5 : 0.75)) * drain, 0, 100);
  }

  private separate() {
    const list = this.players.filter((p) => p.onPitch);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        const min = 0.85;
        if (d2 < min * min && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = (min - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
  }

  private chaser: [MP | null, MP | null] = [null, null];

  private computePressers(): Map<number, MP[]> {
    const out = new Map<number, MP[]>();
    // her takımda topa en yakın oyuncu (serbest toplar için)
    for (const t of [0, 1] as const) {
      const px = this.ball.x + this.ball.vx * 0.32;
      const py = this.ball.y + this.ball.vy * 0.32;
      let best: MP | null = null;
      let bd = 1e9;
      for (const p of this.players) {
        if (p.team !== t || !p.onPitch || p.gk) continue;
        const d = dist(p.x, p.y, px, py);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      this.chaser[t] = best;
    }
    for (const t of [0, 1] as const) {
      const defending = this.possTeam() !== t;
      if (!defending) {
        out.set(t, []);
        continue;
      }
      const t2 = this.tact[t];
      const count = 1 + (t2.press > 55 ? 1 : 0) + (t2.press > 80 ? 1 : 0);
      const sorted = this.players
        .filter((p) => p.team === t && p.onPitch && !p.gk)
        .sort((a, b) => dist(a.x, a.y, this.ball.x, this.ball.y) - dist(b.x, b.y, this.ball.x, this.ball.y));
      out.set(t, sorted.slice(0, count));
    }
    return out;
  }

  private possTeam(): 0 | 1 | null {
    if (this.ball.owner) return this.ball.owner.team;
    if (this.ball.lastTouchTeam != null) return this.ball.lastTouchTeam;
    return null;
  }

  private offBallTarget(mp: MP, pressers: Map<number, MP[]>): { x: number; y: number; sprint: boolean } {
    // duran top atıcısı topun başına gider
    if (this.restart && this.restart.taker === mp) {
      const dd = this.dir[mp.team];
      return {
        x: this.restart.x - dd * 0.95,
        y: clamp(this.restart.y, 0.5, PITCH.W - 0.5),
        sprint: dist(mp.x, mp.y, this.restart.x, this.restart.y) > 6,
      };
    }
    const shape = this.shapeTarget(mp);
    const teamHasBall = this.possTeam() === mp.team;
    const d = this.dir[mp.team];
    const t = this.tact[mp.team];

    // serbest top: en yakın oyuncu topun önünü keser
    if (!this.ball.owner && this.chaser[mp.team] === mp && !mp.gk) {
      return {
        x: clamp(this.ball.x + this.ball.vx * 0.3, 1, PITCH.L - 1),
        y: clamp(this.ball.y + this.ball.vy * 0.3, 1, PITCH.W - 1),
        sprint: true,
      };
    }

    if (!teamHasBall) {
      const list = pressers.get(mp.team) ?? [];
      if (list[0] === mp) {
        // topa baskı: topun biraz önünü kes
        const lead = 0.28;
        return { x: this.ball.x + this.ball.vx * lead, y: this.ball.y + this.ball.vy * lead, sprint: true };
      }
      if (list[1] === mp) {
        const gx = d === 1 ? 0 : PITCH.L;
        const mx = (this.ball.x + gx) / 2;
        const my = (this.ball.y + PITCH.W / 2) / 2;
        return { x: mx, y: my, sprint: true };
      }
      // adam markajı
      const opp = this.nearestOpponent(mp, 12);
      if (opp) {
        return {
          x: opp.x - d * 1.6,
          y: opp.y + (PITCH.W / 2 - opp.y) * 0.06,
          sprint: dist(mp.x, mp.y, opp.x, opp.y) > 5,
        };
      }
      return { x: shape.x, y: shape.y, sprint: dist(mp.x, mp.y, shape.x, shape.y) > 6 };
    }

    // hücumda
    const owner = this.ball.owner;
    if (owner && owner !== mp) {
      const dd = dist(mp.x, mp.y, owner.x, owner.y);
      const runner =
        mp.role === "ST" || mp.role === "LW" || mp.role === "RW" || mp.role === "AM" ||
        mp.role === "LM" || mp.role === "RM" || (mp.role === "CM" && t.push > 6);
      if (dd < 30 && runner) {
        const goalX = d === 1 ? PITCH.L : 0;
        const runX = clamp(mp.x + d * 12, 4, PITCH.L - 4);
        const lane = Math.abs(mp.y - owner.y) < 26;
        if (lane) {
          // kanatlar içe kat eder, forvetler derinlik arar
          const wide = mp.role === "LW" || mp.role === "RW" || mp.role === "LM" || mp.role === "RM";
          const targetY = wide
            ? PITCH.W / 2 + (mp.y < PITCH.W / 2 ? -1 : 1) * 12
            : clamp(mp.y + (mp.y < PITCH.W / 2 ? 3 : -3), 6, PITCH.W - 6);
          void goalX;
          return { x: runX, y: clamp(targetY, 3, PITCH.W - 3), sprint: true };
        }
      }
      // pas seçeneği ol: topa yakın ama boş alanda dur
      const angleToGoal = d === 1 ? 1 : -1;
      const supportX = clamp(owner.x + angleToGoal * 9, 6, PITCH.L - 6);
      if (dd < 16 && mp.role !== "CB" && mp.role !== "GK") {
        return {
          x: supportX,
          y: clamp(mp.y + (mp.y < owner.y ? -5 : 5), 4, PITCH.W - 4),
          sprint: false,
        };
      }
    }
    return { x: shape.x, y: shape.y, sprint: dist(mp.x, mp.y, shape.x, shape.y) > 8 };
  }

  private shapeTarget(mp: MP): { x: number; y: number } {
    const base = this.slotPos(mp);
    const d = this.dir[mp.team];
    const t = this.tact[mp.team];
    const hasBall = this.possTeam() === mp.team;
    const bx = (this.ball.x - PITCH.L / 2) / (PITCH.L / 2);
    const by = (this.ball.y - PITCH.W / 2) / (PITCH.W / 2);
    let x = base.x + bx * 8.5 + (hasBall ? t.push : -t.push * 0.55);
    let y = base.y + by * 6.5;
    y = PITCH.W / 2 + (y - PITCH.W / 2) * (0.78 + t.width / 260);
    if (!hasBall) x -= d * (t.line * 0.1);
    // ofsayt çizgisini aşma
    if (hasBall) {
      const defs = this.players
        .filter((p) => p.team !== mp.team && p.onPitch)
        .map((p) => (d === 1 ? p.x : PITCH.L - p.x))
        .sort((a, b) => b - a);
      const line = defs[1] ?? PITCH.L;
      const myX = d === 1 ? x : PITCH.L - x;
      if (myX > line - 0.6) {
        const clamped = d === 1 ? Math.max(0, line - 1.2) : Math.min(PITCH.L, PITCH.L - (line - 1.2));
        x = clamped;
      }
    }
    return { x: clamp(x, 1.5, PITCH.L - 1.5), y: clamp(y, 1.5, PITCH.W - 1.5) };
  }

  private nearestOpponent(mp: MP, maxD: number): MP | null {
    let best: MP | null = null;
    let bd = maxD;
    for (const p of this.players) {
      if (p.team === mp.team || !p.onPitch || p.gk) continue;
      const d = dist(mp.x, mp.y, p.x, p.y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  /* --------------------------- top sürme & CPU karar --------------------------- */
  private dribbleTarget(mp: MP): { x: number; y: number; sprint: boolean } {
    const d = this.dir[mp.team];
    const goalX = d === 1 ? PITCH.L : 0;
    const goalY = PITCH.W / 2;
    // rakiplerden kaçın
    let ax = goalX - mp.x;
    let ay = goalY - mp.y;
    const n = Math.hypot(ax, ay) || 1;
    ax /= n;
    ay /= n;
    for (const p of this.players) {
      if (p.team === mp.team || !p.onPitch) continue;
      const dx = mp.x - p.x;
      const dy = mp.y - p.y;
      const dd = Math.hypot(dx, dy);
      if (dd < 7 && dd > 0.001) {
        const w = (7 - dd) / 7;
        ax += (dx / dd) * w * 1.5;
        ay += (dy / dd) * w * 1.5;
      }
    }
    const m2 = Math.hypot(ax, ay) || 1;
    return { x: mp.x + (ax / m2) * 14, y: clamp(mp.y + (ay / m2) * 14, 2, PITCH.W - 2), sprint: true };
  }

  private cpuOnBall(mp: MP, dt: number) {
    if (this.teams[mp.team].isUser && this.controlled === mp) return;
    mp.decT -= dt;
    if (mp.decT > 0) return;
    const skill = this.teams[mp.team].aiSkill;
    mp.decT = (0.42 - skill * 0.18) + this.rng.next() * 0.18;

    const d = this.dir[mp.team];
    const goalX = d === 1 ? PITCH.L : 0;
    const gd = dist(mp.x, mp.y, goalX, PITCH.W / 2);
    const pressure = this.pressureOn(mp);
    const open = this.bestPassOption(mp);
    const inBox = d === 1 ? mp.x > PITCH.L - PITCH.PEN_D - 2 : mp.x < PITCH.PEN_D + 2;

    const dec = onballDecision({
      dist: gd,
      pressure,
      open: open ? open.score / 100 : 0.1,
      sho: mp.eff.sho,
      pas: mp.eff.pas,
      pac: mp.eff.pac,
      space: clamp(1 - pressure, 0, 1),
      mateAhead: open ? 1 : 0,
      passOptions: open ? 2 : 0,
      inBox,
    });

    if (dec === "shoot" && gd < 34) {
      this.doShoot(mp, clamp(0.55 + gd / 60, 0.4, 1));
    } else if (dec === "pass" && open) {
      this.doPass(mp, open.target, false);
    } else if (dec === "clear") {
      this.clearBall(mp);
    }
    // "dribble" → hedef zaten top sürme yönü
  }

  private pressureOn(mp: MP): number {
    let p = 0;
    for (const o of this.players) {
      if (o.team === mp.team || !o.onPitch) continue;
      const d = dist(mp.x, mp.y, o.x, o.y);
      if (d < 6) p += (6 - d) / 6;
    }
    return clamp(p / 2, 0, 1);
  }

  private bestPassOption(mp: MP): { target: MP; score: number } | null {
    const d = this.dir[mp.team];
    let best: MP | null = null;
    let bestScore = 0;
    for (const t of this.players) {
      if (t.team !== mp.team || t === mp || !t.onPitch) continue;
      if (t.gk && dist(t.x, t.y, mp.x, mp.y) > 45) continue;
      const dd = dist(mp.x, mp.y, t.x, t.y);
      if (dd < 4 || dd > 42) continue;
      const forward = (t.x - mp.x) * d;
      const openness = 1 - clamp(this.pressureOn(t) / 1.2, 0, 1);
      const laneRisk = this.laneRisk(mp, t);
      const score = clamp(38 + forward * 2.1 + openness * 30 - laneRisk * 48 - dd * 0.3, 0, 100);
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best ? { target: best, score: bestScore } : null;
  }

  private laneRisk(from: MP, to: MP): number {
    let risk = 0;
    for (const o of this.players) {
      if (o.team === from.team || !o.onPitch) continue;
      const t = clamp(((o.x - from.x) * (to.x - from.x) + (o.y - from.y) * (to.y - from.y)) / ((to.x - from.x) ** 2 + (to.y - from.y) ** 2 || 1), 0, 1);
      const px = from.x + t * (to.x - from.x);
      const py = from.y + t * (to.y - from.y);
      const dd = dist(o.x, o.y, px, py);
      if (dd < 2.6) risk += (2.6 - dd) / 2.6;
    }
    return clamp(risk, 0, 1);
  }

  /* --------------------------- top --------------------------- */
  private updateBall(dt: number) {
    const b = this.ball;
    if (this.phase === "goal") return;
    if (b.owner) {
      const o = b.owner;
      if (!o.onPitch) b.owner = null;
      else {
        const helped = this.teams[o.team].isUser && this.controlled === o ? this.assist : 0;
        const dribble = 0.62 + Math.hypot(o.vx, o.vy) * (0.055 - helped * 0.008);
        const tx = o.x + Math.cos(o.facing) * dribble;
        const ty = o.y + Math.sin(o.facing) * dribble;
        b.x += (tx - b.x) * Math.min(1, dt * 16);
        b.y += (ty - b.y) * Math.min(1, dt * 16);
        b.z = 0;
        b.vx = o.vx;
        b.vy = o.vy;
        b.vz = 0;
      }
    } else if (this.restart && this.restart.type !== "kickoff") {
      b.x = this.restart.x;
      b.y = this.restart.y;
      b.z = 0;
      b.vx = b.vy = b.vz = 0;
      return; // duran topta müdahale yok
    } else {
      const air = b.z > 0.06;
      const drag = air ? 0.9 : 0.55;
      const f = Math.pow(drag, dt);
      b.vx *= f;
      b.vy *= f;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (air) {
        b.vz -= 9.81 * dt;
        b.z += b.vz * dt;
        if (b.z <= 0) {
          b.z = 0;
          if (b.vz < -1.2) {
            b.vz = -b.vz * 0.52;
            b.vx *= 0.82;
            b.vy *= 0.82;
          } else b.vz = 0;
        }
      } else if (b.vz > 0) {
        b.z += b.vz * dt;
      }
      if (b.z <= 0 && Math.abs(b.vz) < 0.3) b.vz = 0;
    }

    this.shotBlocks(dt);
    this.ballContest(dt);
  }

  /** Savunmacı blokları — ribaunt ve korner üretir. */
  private shotBlocks(dt: number) {
    const b = this.ball;
    if (b.owner) return;
    const speed = Math.hypot(b.vx, b.vy);
    if (speed < 11 || b.z > 1.7) return;
    const team = b.lastTouchTeam;
    if (team == null) return;
    const px = b.x - b.vx * dt;
    const py = b.y - b.vy * dt;
    const sx = b.x - px;
    const sy = b.y - py;
    const len2 = sx * sx + sy * sy || 1;
    for (const o of this.players) {
      if (!o.onPitch || o.team === team || o.gk || o.cooldown > 0) continue;
      const t = clamp(((o.x - px) * sx + (o.y - py) * sy) / len2, 0, 1);
      const cx = px + t * sx;
      const cy = py + t * sy;
      if (dist(o.x, o.y, cx, cy) > 1.05) continue;
      const chance = clamp(0.2 + o.eff.def * 0.0032, 0.1, 0.55);
      if (this.rng.next() > chance) continue;
      const ang = Math.atan2(b.vy, b.vx) + this.rng.gauss(0, 1.15);
      const sp = speed * (0.3 + this.rng.next() * 0.45);
      b.x = cx;
      b.y = cy;
      b.vx = Math.cos(ang) * sp;
      b.vy = Math.sin(ang) * sp;
      b.vz = 1.8;
      b.z = Math.max(b.z, 0.35);
      b.lastTouch = o;
      b.lastTouchTeam = o.team;
      b.shotCounted = true; // bloklanan şut isabetli sayılmaz
      b.saveTried = true;
      o.cooldown = 0.28;
      o.rating += 0.05;
      this.onSound("tackle");
      return;
    }
  }

  private ballContest(dt: number) {
    const b = this.ball;
    if (b.owner) {
      // kayarak/normal müdahale — başarılı müdahalede top sahipsiz kalır,
      // bu yüzden sahibi başta yakalayıp döngüyü orada bitiriyoruz.
      const owner = b.owner;
      for (const o of this.players) {
        if (o.team === owner.team || !o.onPitch || o.gk) continue;
        const dd = dist(o.x, o.y, owner.x, owner.y);
        const sliding = o.slide > 0;
        const reach = sliding ? 2.1 : 1.15;
        if (dd < reach && o.tackleCd <= 0) {
          this.attemptTackle(o, owner, sliding);
          if (b.owner !== owner) return; // top el değiştirdi
        }
      }
      return;
    }
    if (b.z > 1.9) return;
    let best: MP | null = null;
    let bestScore = -1;
    for (const p of this.players) {
      if (!p.onPitch || p.cooldown > 0 || p.stagger > 0.35) continue;
      const dd = dist(p.x, p.y, b.x, b.y);
      const ballSpeed = Math.hypot(b.vx, b.vy);
      // Kaleci hızlı topu otomatik kucaklayamaz — yoksa her şut sönümlenir.
      const reach = p.gk ? (ballSpeed > 14 ? 1.25 : 1.85) : 1.0 + Math.hypot(p.vx, p.vy) * 0.06;
      if (dd > reach) continue;
      const speed = ballSpeed;
      const control = p.gk
        ? clamp(1.05 - speed / 32 + p.eff.gk * 0.002, 0.15, 1)
        : clamp(0.35 + (p.eff.pas + p.eff.phy) / 400 - speed / 45, 0.12, 0.98);
      const score = control * 100 - dd * 10 + (p.gk ? 30 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) {
      const speed = Math.hypot(b.vx, b.vy);
      const helped = this.teams[best.team].isUser ? this.assist * 0.14 : 0;
      const control = best.gk
        ? clamp(1.05 - speed / 32 + best.eff.gk * 0.002, 0.15, 1)
        : clamp(0.35 + (best.eff.pas + best.eff.phy) / 400 - speed / 45 + helped, 0.12, 0.99);
      if (this.rng.next() < control || speed < 6) {
        this.gainPossession(best);
      } else {
        // top kontrolden sekti
        b.vx += this.rng.gauss(0, 3);
        b.vy += this.rng.gauss(0, 3);
        best.cooldown = 0.25;
      }
    }
    void dt;
  }

  private gainPossession(p: MP) {
    const b = this.ball;
    // ofsayt kontrolü
    if (this.offsideOn && this.offsideFlags.has(p.id) && this.phase === "play") {
      this.offsideFlags.clear();
      this.stats.offside[p.team]++;
      this.pushEvent("foul", "");
      this.setRestart("freekick", b.x, b.y, (1 - p.team) as 0 | 1);
      this.onSound("whistle");
      return;
    }
    b.owner = p;
    b.lastTouch = p;
    b.lastTouchTeam = p.team;
    b.vx = b.vy = b.vz = 0;
    b.z = 0;
    p.passes;
    this.offsideFlags.clear();
    if (this.lastPasser && this.lastPasser.team === p.team && this.passTarget === p) {
      this.lastPasser.passesOk++;
      if (this.lastPasser.id !== p.id) this.lastPasser.rating += 0.05;
      if (dist(p.x, p.y, this.dir[p.team] === 1 ? PITCH.L : 0, PITCH.W / 2) < 30) {
        // asist adayı
        (p as any).__assistFrom = this.lastPasser.id;
      }
    }
    this.lastPasser = null;
    this.passTarget = null;
    if (this.teams[p.team].isUser && !p.gk) this.controlled = p;
  }

  /* --------------------------- aksiyonlar --------------------------- */
  private userActions() {
    const inp = this.input;
    const user = this.teams.findIndex((t) => t.isUser) as 0 | 1;
    const cp = this.controlled;
    if (cp && cp.team === user) {
      const weHaveBall = this.ball.owner === cp;
      if (this.restart && this.restart.team === user && this.restart.taker === cp) {
        if (inp.pass) this.executeRestart("pass");
        else if (inp.shootRelease) this.executeRestart("shoot");
        else if (inp.through) this.executeRestart("cross");
        return;
      }
      if (weHaveBall) {
        if (inp.pass) this.doPass(cp, this.pickUserPass(cp, inp, false), false);
        else if (inp.through) this.doPass(cp, this.pickUserPass(cp, inp, true), true);
        else if (inp.shootRelease) this.doShoot(cp, clamp(0.35 + inp.shootPower * 0.75, 0.3, 1));
      } else {
        if (inp.pass) this.userTackle(cp, false);
        else if (inp.slide) this.userTackle(cp, true);
        else if (inp.switchP) this.switchControl();
      }
    } else if (inp.switchP) {
      this.switchControl();
    }
  }

  private pickUserPass(cp: MP, inp: MatchInput, through: boolean): MP | null {
    let ax = inp.mx;
    let ay = inp.my;
    if (Math.hypot(ax, ay) < 0.15) {
      ax = Math.cos(cp.facing);
      ay = Math.sin(cp.facing);
    }
    const d = this.dir[cp.team];
    let best: MP | null = null;
    let bestScore = -1e9;
    for (const t of this.players) {
      if (t.team !== cp.team || t === cp || !t.onPitch) continue;
      const dx = t.x - cp.x;
      const dy = t.y - cp.y;
      const dd = Math.hypot(dx, dy) || 1;
      if (dd < 2 || dd > (through ? 60 : 40)) continue;
      const dot = (dx / dd) * ax + (dy / dd) * ay;
      const fwd = (dx / dd) * d;
      const score = dot * 100 + fwd * 18 - dd * (through ? 0.3 : 1.1) - this.laneRisk(cp, t) * 40;
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  }

  doPass(from: MP, to: MP | null, lofted: boolean) {
    const b = this.ball;
    if (b.owner !== from) return;
    from.passes++;
    from.rating += 0.02;
    const skill = this.teams[from.team].isUser ? 1 : this.teams[from.team].aiSkill;
    let tx: number;
    let ty: number;
    if (to) {
      const lead = lofted ? 0.55 : 0.32;
      tx = to.x + to.vx * lead;
      ty = to.y + to.vy * lead;
      if (lofted) {
        const d = this.dir[from.team];
        tx += d * 6;
      }
    } else {
      tx = from.x + Math.cos(from.facing) * 18;
      ty = from.y + Math.sin(from.facing) * 18;
    }
    const dd = dist(from.x, from.y, tx, ty);
    let ang = Math.atan2(ty - from.y, tx - from.x);
    const pressure = this.pressureOn(from);
    const userAssist = this.teams[from.team].isUser && this.controlled === from ? this.assist : 0;
    const assistMul = 1 - userAssist * 0.32; // yardım açık: pas daha isabetli
    const err =
      (1 - from.eff.pas / 105) * 0.055 * (1 + pressure * 1.6) * (lofted ? 1.5 : 1) * (1.35 - skill * 0.35) * assistMul;
    ang += this.rng.gauss(0, err);
    const speed = clamp(dd * (lofted ? 0.85 : 1.25) + 4, 8, lofted ? 22 : 26);
    b.owner = null;
    b.lastTouch = from;
    b.lastTouchTeam = from.team;
    b.x = from.x + Math.cos(ang) * 0.5;
    b.y = from.y + Math.sin(ang) * 0.5;
    b.vx = Math.cos(ang) * speed;
    b.vy = Math.sin(ang) * speed;
    if (lofted) {
      b.vz = clamp(3.2 + dd * 0.09, 3, 8.5);
      b.z = 0.2;
    } else {
      b.vz = dd > 20 ? 1.6 : 0.35;
      b.z = 0.1;
    }
    b.shotCounted = true;
    b.saveTried = true;
    from.cooldown = 0.32;
    from.facing = ang;
    this.lastPasser = from;
    this.passTarget = to;
    this.stats.passes[from.team]++;
    if (to) this.markOffside(to);
    this.onSound("kick");
  }

  private markOffside(to: MP) {
    if (!this.offsideOn) return;
    const d = this.dir[to.team];
    const defs = this.players
      .filter((p) => p.team !== to.team && p.onPitch)
      .map((p) => (d === 1 ? p.x : PITCH.L - p.x))
      .sort((a, b) => b - a);
    const line = defs[1] ?? PITCH.L;
    const myX = d === 1 ? to.x : PITCH.L - to.x;
    const ballX = d === 1 ? this.ball.x : PITCH.L - this.ball.x;
    if (myX > line + 0.4 && myX > ballX && myX > PITCH.L / 2) this.offsideFlags.add(to.id);
  }

  doShoot(from: MP, power: number) {
    const b = this.ball;
    if (b.owner !== from) return;
    const d = this.dir[from.team];
    const goalX = d === 1 ? PITCH.L : 0;
    const gd = dist(from.x, from.y, goalX, PITCH.W / 2);
    from.shots++;
    from.rating += 0.06;
    this.stats.shots[from.team]++;
    const inp = this.input;
    const isUser = this.teams[from.team].isUser && this.controlled === from;
    const userAssist = isUser ? this.assist : 0;
    let aim = 0;
    if (isUser && (Math.abs(inp.aimX) + Math.abs(inp.aimY)) > 0.1) {
      aim = clamp(inp.aimY, -1, 1) * 0.75;
    } else if (userAssist > 0) {
      // nişan yardımı: kalecinin uzak kaldığı köşeye yönlendir
      const gk = this.players.find((q) => q.gk && q.team !== from.team && q.onPitch);
      const side = gk ? (gk.y > PITCH.W / 2 ? -1 : 1) : this.rng.next() < 0.5 ? -1 : 1;
      aim = side * (0.72 + this.rng.next() * 0.2);
    } else {
      aim = clamp(this.rng.gauss(0, 1.15), -1.6, 1.6);
    }
    const targetY = PITCH.W / 2 + aim * 3.1;
    let ang = Math.atan2(targetY - from.y, goalX - from.x);
    const pressure = this.pressureOn(from);
    const err =
      (1 - from.eff.sho / 108) * 0.068 * (1 + pressure * 1.35) * (0.6 + power * 0.8) * (1 + gd * 0.013) *
      (1 - userAssist * 0.3);
    ang += this.rng.gauss(0, err);
    const speed = 19 + power * 14;
    b.owner = null;
    b.lastTouch = from;
    b.lastTouchTeam = from.team;
    b.x = from.x + Math.cos(ang) * 0.6;
    b.y = from.y + Math.sin(ang) * 0.6;
    b.vx = Math.cos(ang) * speed;
    b.vy = Math.sin(ang) * speed;
    b.vz = clamp(0.7 + power * 2.6 - gd * 0.02, 0.1, 4.4);
    b.z = 0.15;
    b.shotCounted = false;
    b.saveTried = false;
    from.cooldown = 0.5;
    from.facing = ang;
    this.onSound("kick");
    if (gd < 22) this.pushEvent("chance", from.ref.name);
  }

  private clearBall(from: MP) {
    const b = this.ball;
    if (b.owner !== from) return;
    const d = this.dir[from.team];
    const ang = Math.atan2(this.rng.gauss(0, 12), d);
    b.owner = null;
    b.lastTouch = from;
    b.lastTouchTeam = from.team;
    b.vx = Math.cos(ang) * 22;
    b.vy = Math.sin(ang) * 16;
    b.vz = 6;
    b.z = 0.2;
    b.shotCounted = true;
    b.saveTried = true;
    from.cooldown = 0.4;
    this.onSound("kick");
  }

  private userTackle(cp: MP, slide: boolean) {
    const b = this.ball;
    const target = b.owner && b.owner.team !== cp.team ? b.owner : this.nearestOpponent(cp, slide ? 4 : 2.4);
    if (!target) {
      if (slide) cp.slide = 0.6;
      return;
    }
    if (slide) cp.slide = 0.6;
    this.attemptTackle(cp, target, slide);
  }

  private attemptTackle(def: MP, owner: MP, sliding: boolean) {
    def.tackleCd = sliding ? 1.35 : 0.95;
    const dd = dist(def.x, def.y, owner.x, owner.y);
    const userHelp = this.teams[def.team].isUser && this.controlled === def ? this.assist * 0.05 : 0;
    const base = 0.26 + (def.eff.def + def.eff.phy) / 440 - (owner.eff.pac + owner.eff.phy) / 440;
    const p = clamp(base + (sliding ? 0.16 : 0) + (dd < 0.9 ? 0.14 : 0) + userHelp, 0.1, 0.92);
    if (this.rng.next() < p) {
      // top kazanılır
      def.tackles++;
      def.rating += 0.12;
      this.stats.tackles[def.team]++;
      const b = this.ball;
      b.owner = null;
      b.lastTouch = def;
      b.lastTouchTeam = def.team;
      const ang = Math.atan2(this.rng.gauss(0, 4), def.team === 0 ? 1 : -1);
      b.vx = Math.cos(ang) * 5;
      b.vy = Math.sin(ang) * 5;
      b.vz = 0.4;
      owner.cooldown = 0.45;
      owner.stagger = 0.25;
      def.cooldown = 0.12;
      this.pushEvent("tackle", def.ref.name);
      this.onSound("tackle");
    } else {
      const foulP = sliding ? 0.42 : 0.2;
      if (this.rng.next() < foulP) {
        this.commitFoul(def, owner);
      } else {
        def.stagger = 0.35;
      }
    }
  }

  private commitFoul(def: MP, victim: MP) {
    const b = this.ball;
    b.owner = null;
    b.vx = b.vy = 0;
    b.lastTouch = def;
    b.lastTouchTeam = def.team;
    this.stats.fouls[def.team]++;
    def.stagger = 0.8;
    def.rating -= 0.08;
    this.pushEvent("foul", def.ref.name);
    this.onSound("whistle");
    // kart
    const cardRoll = this.rng.next();
    if (cardRoll < 0.1) {
      def.yellow++;
      this.cards.push({ playerId: def.id, type: "y", minute: Math.floor(this.clock) });
      def.rating -= 0.3;
      if (def.yellow >= 2) {
        def.red = true;
        def.onPitch = false;
        this.cards.push({ playerId: def.id, type: "r", minute: Math.floor(this.clock) });
        this.pushEvent("card", def.ref.name);
      }
    } else if (cardRoll < 0.13) {
      def.red = true;
      def.onPitch = false;
      this.cards.push({ playerId: def.id, type: "r", minute: Math.floor(this.clock) });
      this.pushEvent("card", def.ref.name);
    }
    // ceza sahası → penaltı
    const d = this.dir[victim.team];
    const inBox = d === 1 ? victim.x > PITCH.L - PITCH.PEN_D : victim.x < PITCH.PEN_D;
    const yOk = Math.abs(victim.y - PITCH.W / 2) < PITCH.PEN_W / 2;
    if (inBox && yOk && def.team !== victim.team) {
      this.setRestart("penalty", d === 1 ? PITCH.L - 11 : 11, PITCH.W / 2 + this.rng.gauss(0, 1.5), victim.team);
    } else {
      this.setRestart("freekick", victim.x, victim.y, victim.team);
    }
  }

  /* --------------------------- kaleci --------------------------- */
  private gkLogic(gk: MP, dt: number) {
    const d = this.dir[gk.team];
    const goalX = d === 1 ? 0 : PITCH.L;
    const b = this.ball;
    const shotIncoming =
      b.owner === null &&
      ((d === 1 && b.vx < -3) || (d === 1 ? false : b.vx > 3)) &&
      ((d === 1 && b.x < 38) || (d === 1 ? false : b.x > PITCH.L - 38));

    let tx: number;
    let ty: number;
    if (shotIncoming) {
      const t = d === 1 ? (goalX - b.x) / (b.vx || -1) : (goalX - b.x) / (b.vx || 1);
      if (t > 0 && t < 2.2) {
        ty = clamp(b.y + b.vy * t, PITCH.W / 2 - 5, PITCH.W / 2 + 5);
        tx = goalX + d * 1.1;
        const reach = dist(gk.x, gk.y, tx, ty);
        if (reach < 3.9 && b.z < 2.6 && gk.dive <= 0) {
          this.trySave(gk, t);
        }
      } else {
        tx = goalX + d * 1.4;
        ty = PITCH.W / 2 + (b.y - PITCH.W / 2) * 0.42;
      }
    } else if (b.owner === gk) {
      gk.cooldown -= dt;
      tx = goalX + d * 3;
      ty = clamp(b.y, PITCH.W / 2 - 8, PITCH.W / 2 + 8);
      if (gk.cooldown <= 0) {
        const opt = this.bestPassOption(gk);
        if (opt && dist(gk.x, gk.y, opt.target.x, opt.target.y) < 40) this.doPass(gk, opt.target, false);
        else {
          const d2 = this.dir[gk.team];
          const target = this.players
            .filter((p) => p.team === gk.team && p.onPitch && !p.gk && (p.x - gk.x) * d2 > 20)
            .sort((a, b2) => dist(a.x, a.y, gk.x, gk.y) - dist(b2.x, b2.y, gk.x, gk.y))[0];
          if (target) this.doPass(gk, target, true);
        }
      }
      this.movePlayer(gk, tx, ty, dt, false);
      return;
    } else {
      // kaleyi aç, çıkış yap
      const ballDist = dist(b.x, b.y, goalX, PITCH.W / 2);
      const inBox = d === 1 ? b.x < PITCH.PEN_D + 4 : b.x > PITCH.L - PITCH.PEN_D - 4;
      const free = b.owner === null;
      if (inBox && free && ballDist < 15 && b.z < 1.6) {
        tx = b.x;
        ty = b.y;
      } else {
        tx = goalX + d * clamp(1.2 + (ballDist < 40 ? 2.2 : 0), 1.2, 8);
        ty = PITCH.W / 2 + (b.y - PITCH.W / 2) * (ballDist < 40 ? 0.42 : 0.25);
        ty = clamp(ty, PITCH.W / 2 - 6.5, PITCH.W / 2 + 6.5);
      }
    }
    this.movePlayer(gk, tx, ty, dt, true);
    if (gk.onPitch) gk.minutes += dt * this.clockScale / 60;
  }

  private trySave(gk: MP, t: number) {
    const b = this.ball;
    // topun kale çizgisini geçeceği nokta — gerçekten isabetli mi?
    const yAt = b.y + b.vy * t;
    const zAt = b.z + b.vz * t - 4.905 * t * t;
    const onTarget =
      Math.abs(yAt - PITCH.W / 2) < PITCH.GOAL_W / 2 + 0.35 && zAt < PITCH.GOAL_H + 0.25 && zAt > -0.6;
    if (!onTarget) return; // auta giden topa kaleci uzanmaz

    // isabetli şut yalnızca bir kez sayılır
    if (!b.shotCounted) {
      this.stats.onTarget[(1 - gk.team) as 0 | 1]++;
      b.shotCounted = true;
    }
    // her şut için tek kurtarış denemesi
    if (b.saveTried) return;
    b.saveTried = true;

    const speed = Math.hypot(b.vx, b.vy);
    const placement = Math.abs(b.y + b.vy * t - gk.y);
    const p = clamp(0.5 + gk.eff.gk * 0.0055 - speed * 0.0102 - placement * 0.128 - b.z * 0.05, 0.08, 0.9);
    gk.dive = 0.45;
    if (this.rng.next() >= p) return;

    this.stats.saves[gk.team]++;
    gk.rating += 0.2;
    this.pushEvent("save", gk.ref.name);
    this.onSound("save");
    if (this.rng.next() < 0.45 && speed < 24) {
      // topu kucakladı
      this.gainPossession(gk);
      gk.cooldown = 1.0;
      return;
    }
    b.lastTouch = gk;
    b.lastTouchTeam = gk.team;
    gk.cooldown = 0.4;
    const d = this.dir[gk.team];
    const outDir = d === 1 ? -1 : 1; // kendi kale çizgisine doğru
    if (this.rng.next() < 0.45) {
      // kornere çelme
      b.vx = outDir * (7 + this.rng.next() * 6);
      b.vy = (b.y > PITCH.W / 2 ? 1 : -1) * (4 + this.rng.next() * 6);
      b.vz = 2.6;
      b.z = 0.6;
    } else {
      // sahaya sekme
      b.vx = -b.vx * 0.35 + this.rng.gauss(0, 4);
      b.vy = b.vy * 0.3 + this.rng.gauss(0, 6);
      b.vz = 3.2;
      b.z = 0.6;
    }
  }

  /* --------------------------- sınırlar & duran toplar --------------------------- */
  private checkBounds() {
    const b = this.ball;
    if (b.owner) {
      const o = b.owner;
      if (o.x < 0.2 || o.x > PITCH.L - 0.2 || o.y < 0.2 || o.y > PITCH.W - 0.2) {
        o.x = clamp(o.x, 0.4, PITCH.L - 0.4);
        o.y = clamp(o.y, 0.4, PITCH.W - 0.4);
      }
      return;
    }
    // gol (hangi takım hangi kaleye hücum ediyor?)
    const leftScorer = this.dir[0] === -1 ? 0 : 1;
    if (b.x <= 0.12 && Math.abs(b.y - PITCH.W / 2) < PITCH.GOAL_W / 2 && b.z < PITCH.GOAL_H) {
      this.goalScored(leftScorer);
      return;
    }
    if (b.x >= PITCH.L - 0.12 && Math.abs(b.y - PITCH.W / 2) < PITCH.GOAL_W / 2 && b.z < PITCH.GOAL_H) {
      this.goalScored((1 - leftScorer) as 0 | 1);
      return;
    }
    // taç
    if (b.y < 0.1 || b.y > PITCH.W - 0.1) {
      const team = (b.lastTouchTeam === 0 ? 1 : 0) as 0 | 1;
      this.setRestart("throwin", clamp(b.x, 2, PITCH.L - 2), b.y < 0.1 ? 0.4 : PITCH.W - 0.4, team);
      return;
    }
    // kale çizgisi
    if (b.x < 0.1 || b.x > PITCH.L - 0.1) {
      const lastTeam = b.lastTouchTeam ?? 0;
      const leftDefender = this.dir[0] === 1 ? 0 : 1;
      const defending = b.x < 0.1 ? leftDefender : ((1 - leftDefender) as 0 | 1);
      if (lastTeam === defending) {
        const team = (1 - defending) as 0 | 1;
        this.stats.corners[team]++;
        const y = b.y < PITCH.W / 2 ? 0.5 : PITCH.W - 0.5;
        this.setRestart("corner", b.x < 0.1 ? 0.6 : PITCH.L - 0.6, y, team);
      } else {
        this.setRestart("goalkick", b.x < 0.1 ? 5.5 : PITCH.L - 5.5, PITCH.W / 2 + this.rng.gauss(0, 6), defending as 0 | 1);
      }
    }
  }

  private goalScored(scoringTeam: 0 | 1) {
    this.score[scoringTeam]++;
    const scorer = this.ball.lastTouch;
    if (!this.ball.shotCounted) {
      this.stats.onTarget[scoringTeam]++;
      this.ball.shotCounted = true;
    }
    this.fx.flash = 1;
    this.fx.shake = 1;
    this.fx.goalTeam = scoringTeam;
    this.phase = "goal";
    this.onSound("goal");
    const minute = Math.floor(this.clock);
    if (scorer) {
      scorer.goals++;
      scorer.rating += 1.15;
      scorer.celebrate = 3.2;
      this.celebrator = scorer;
      this.celebrateTimer = 0;
      for (const m of this.players) if (m.team === scorer.team && m !== scorer) m.celebrate = 2.4;
      this.scorers.push({ clubId: this.teams[scorer.team].clubId, playerId: scorer.id, minute });
      const assistFrom = (scorer as any).__assistFrom;
      if (assistFrom) {
        const a = this.players.find((p) => p.id === assistFrom);
        if (a && a.team === scorer.team) {
          a.assists++;
          a.rating += 0.5;
        }
        (scorer as any).__assistFrom = null;
      }
      this.pushEvent("goal", scorer.ref.name);
    } else {
      this.pushEvent("goal", "");
    }
    const conceding = (1 - scoringTeam) as 0 | 1;
    for (const gk of this.players) if (gk.gk && gk.team === conceding) gk.rating -= 0.4;
    this.restart = { type: "goal", x: PITCH.L / 2, y: PITCH.W / 2, team: conceding, timer: 3.2, taker: null };
    this.onEvent();
  }

  private pickTaker(r: Restart): MP | null {
    const takers = this.players
      .filter((p) => p.team === r.team && p.onPitch && !p.red)
      .sort((a, b) => dist(a.x, a.y, r.x, r.y) - dist(b.x, b.y, r.x, r.y));
    if (r.type === "goalkick") return this.players.find((p) => p.team === r.team && p.gk && p.onPitch) ?? takers[0] ?? null;
    if (r.type === "corner")
      return this.players.filter((p) => p.team === r.team && !p.gk).sort((a, b) => b.eff.pas - a.eff.pas)[0] ?? takers[0] ?? null;
    if (r.type === "penalty")
      return this.players.filter((p) => p.team === r.team && !p.gk).sort((a, b) => b.eff.sho - a.eff.sho)[0] ?? takers[0] ?? null;
    return takers.find((p) => !p.gk) ?? takers[0] ?? null;
  }

  private setRestart(type: RestartType, x: number, y: number, team: 0 | 1) {
    if (this.phase === "goal") return;
    this.phase = "dead";
    this.restart = { type, x, y, team, timer: type === "penalty" ? 2.4 : 1.5, taker: null };
    this.restart.taker = this.pickTaker(this.restart);
    if (this.teams[team].isUser && this.restart.taker) this.controlled = this.restart.taker;
    const b = this.ball;
    b.owner = null;
    b.vx = b.vy = b.vz = 0;
    b.z = 0;
    b.x = x;
    b.y = y;
    this.offsideFlags.clear();
    this.lastPasser = null;
    this.onEvent();
  }

  private executeRestart(mode?: "pass" | "shoot" | "cross" | "auto") {
    const r = this.restart;
    if (!r) return;
    const taker = r.taker ?? this.pickTaker(r);
    if (!taker) return;
    taker.x = r.x - (r.type === "throwin" ? 0 : 0.6);
    taker.y = r.y;
    const d = this.dir[r.team];
    const goalX = d === 1 ? PITCH.L : 0;
    this.phase = "play";
    this.restart = null;

    switch (r.type) {
      case "kickoff": {
        this.lastKickoffTeam = r.team;
        const mate = this.players
          .filter((p) => p.team === r.team && p !== taker && !p.gk)
          .sort((a, b) => dist(a.x, a.y, taker.x, taker.y) - dist(b.x, b.y, taker.x, taker.y))[0];
        this.ball.owner = taker;
        this.doPass(taker, mate ?? null, false);
        break;
      }
      case "throwin": {
        this.ball.owner = taker;
        const bestOpt = this.bestPassOption(taker);
        const fallback = this.pickUserPass(taker, emptyInput(), false);
        this.doPass(taker, bestOpt ? bestOpt.target : fallback, false);
        break;
      }
      case "goalkick": {
        this.ball.owner = taker;
        const near = this.players
          .filter((p) => p.team === r.team && !p.gk)
          .sort((a, b) => dist(a.x, a.y, taker.x, taker.y) - dist(b.x, b.y, taker.x, taker.y))[0];
        this.doPass(taker, near ?? null, dist(near?.x ?? 0, near?.y ?? 0, taker.x, taker.y) > 30);
        break;
      }
      case "corner": {
        this.ball.owner = taker;
        const box = this.players
          .filter((p) => p.team === r.team && !p.gk && p !== taker)
          .sort((a, b) => dist(a.x, a.y, goalX === PITCH.L ? PITCH.L - 8 : 8, PITCH.W / 2) - dist(b.x, b.y, goalX === PITCH.L ? PITCH.L - 8 : 8, PITCH.W / 2))[0];
        this.doPass(taker, box ?? null, true);
        break;
      }
      case "freekick": {
        this.ball.owner = taker;
        const gd = dist(taker.x, taker.y, goalX, PITCH.W / 2);
        const isUser = this.teams[r.team].isUser;
        if (gd < 28 && (mode === "shoot" || (!isUser && this.rng.next() < 0.7))) {
          this.doShoot(taker, 0.85);
        } else if (mode === "cross" || (!isUser && gd > 32)) {
          const box = this.players
            .filter((p) => p.team === r.team && !p.gk && p !== taker)
            .sort((a, b) => dist(a.x, a.y, goalX === PITCH.L ? PITCH.L - 9 : 9, PITCH.W / 2) - dist(b.x, b.y, goalX === PITCH.L ? PITCH.L - 9 : 9, PITCH.W / 2))[0];
          this.doPass(taker, box ?? null, true);
        } else {
          const opt = this.bestPassOption(taker);
          this.doPass(taker, opt?.target ?? null, false);
        }
        break;
      }
      case "penalty": {
        this.ball.owner = taker;
        this.doShoot(taker, 0.9);
        break;
      }
      default:
        break;
    }
    if (this.teams[r.team].isUser) this.controlled = taker;
  }

  /* --------------------------- kamera & kontroller --------------------------- */
  private updateCamera(dt: number) {
    const b = this.ball;
    const tx = clamp(b.x + b.vx * 0.35, 12, PITCH.L - 12);
    const ty = clamp(b.y + b.vy * 0.35, 10, PITCH.W - 10);
    const k = 1 - Math.pow(0.02, dt);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
  }

  autoSwitch() {
    const user = this.teams.findIndex((t) => t.isUser);
    if (user < 0) return;
    const b = this.ball;
    if (b.owner && b.owner.team === user && !b.owner.gk) {
      this.controlled = b.owner;
      return;
    }
    const cur = this.controlled;
    if (cur && cur.onPitch && !cur.gk) {
      const dCur = dist(cur.x, cur.y, b.x, b.y);
      let best: MP | null = null;
      let bd = dCur * 0.72;
      for (const p of this.players) {
        if (p.team !== user || !p.onPitch || p.gk || p.red) continue;
        const d = dist(p.x, p.y, b.x, b.y);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      if (best) this.controlled = best;
    } else {
      let best: MP | null = null;
      let bd = 1e9;
      for (const p of this.players) {
        if (p.team !== user || !p.onPitch || p.gk || p.red) continue;
        const d = dist(p.x, p.y, b.x + b.vx * 0.3, b.y + b.vy * 0.3);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      this.controlled = best;
    }
  }

  switchControl() {
    const user = this.teams.findIndex((t) => t.isUser) as 0 | 1;
    const list = this.players
      .filter((p) => p.team === user && p.onPitch && !p.gk && !p.red && p !== this.controlled)
      .sort((a, b) => dist(a.x, a.y, this.ball.x, this.ball.y) - dist(b.x, b.y, this.ball.x, this.ball.y));
    if (list.length) {
      this.controlled = list[0];
      this.onSound("switch");
    }
  }

  substitute(outId: string, inId: string) {
    const out = this.players.find((p) => p.id === outId);
    if (!out || !out.onPitch) return false;
    const inRef = this.playersDb[inId];
    if (!inRef) return false;
    out.onPitch = false;
    const idx = this.players.indexOf(out);
    const slotFx = out.fx;
    const slotFy = out.fy;
    const role = out.role;
    const isGK = out.gk;
    const eff = effAttrs(inRef, role, this.boost[out.team]);
    const sub: MP = {
      id: inRef.id,
      ref: inRef,
      team: out.team,
      role,
      fx: slotFx,
      fy: slotFy,
      x: out.x,
      y: out.y,
      vx: 0,
      vy: 0,
      facing: out.facing,
      stamina: 100,
      cooldown: 0,
      tackleCd: 0,
      slide: 0,
      stagger: 0,
      gk: isGK,
      eff,
      rating: 6.5,
      goals: 0,
      assists: 0,
      tackles: 0,
      passes: 0,
      passesOk: 0,
      shots: 0,
      yellow: 0,
      red: false,
      onPitch: true,
      minutes: 0,
      anim: 0,
      celebrate: 0,
      dive: 0,
      decT: 0,
    };
    this.players[idx] = sub;
    this.pushEvent("info", `${inRef.name} oyuna girdi (${out.ref.name})`);
    return true;
  }

  cpuSubstitutions() {
    for (const t of [0, 1] as const) {
      const info = this.teams[t];
      if (info.isUser) continue;
      if ((info.subsUsed ?? 0) >= 3) continue;
      const onPitch = this.players.filter((p) => p.team === t && p.onPitch);
      const benchIds = info.subs.filter((id) => !this.players.some((p) => p.id === id));
      if (!benchIds.length) continue;
      const tired = onPitch
        .filter((p) => !p.gk && p.stamina < 58 && this.clock > 58)
        .sort((a, b) => a.stamina - b.stamina);
      if (tired.length) {
        const inId = benchIds[0];
        this.substitute(tired[0].id, inId);
        info.subs = info.subs.filter((id) => id !== inId);
        info.subsUsed = (info.subsUsed ?? 0) + 1;
      }
    }
  }

  private updatePossession(dt: number) {
    const t = this.possTeam();
    if (t != null) this.possFrames[t] += dt;
  }

  private pushEvent(kind: Commentary["kind"], name: string) {
    const text = kind === "info" || kind === "half" || kind === "full" ? name : luaCommentary(kind, name);
    const label =
      kind === "half" ? "İlk yarı sona erdi." :
      kind === "full" ? "Maç sona erdi!" : text;
    this.events.push({ text: label, t: Math.floor(this.clock), kind });
    if (this.events.length > 40) this.events.shift();
    this.onEvent();
  }

  /* --------------------------- sonuç --------------------------- */
  get possessionPct(): [number, number] {
    const total = this.possFrames[0] + this.possFrames[1];
    return [Math.round((this.possFrames[0] / total) * 100), 100 - Math.round((this.possFrames[0] / total) * 100)];
  }

  finish(): void {
    for (const mp of this.players) {
      if (!mp.onPitch) continue;
      mp.rating = clamp(mp.rating, 4.0, 10.0);
    }
  }

  ratings(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const mp of this.players) out[mp.id] = Math.round(clamp(mp.rating, 4, 10) * 10) / 10;
    return out;
  }

  /** Uzatma dahil dakika */
  get displayClock() {
    return Math.min(this.clock, this.half === 1 ? 45 : 90);
  }
}

function effAttrs(p: Player, role: PosCode, boost = 0) {
  const fit = role === p.pos ? 1 : role === "GK" || p.pos === "GK" ? 0.5 : 0.86;
  const formMul = 0.96 + (p.form ?? 60) / 1500;
  const f = (v: number) => clamp((v * (0.6 + 0.4 * fit) + boost) * formMul, 20, 99);
  return {
    pac: f(p.pac),
    sho: f(p.sho),
    pas: f(p.pas),
    def: f(p.def),
    phy: f(p.phy),
    gk: role === "GK" ? clamp(p.gk, 20, 99) : f(p.gk),
  };
}

function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function blankStats(): MatchStats {
  const z = () => [0, 0] as [number, number];
  return {
    possession: [50, 50],
    shots: z(),
    onTarget: z(),
    passes: z(),
    passAcc: [0, 0],
    corners: z(),
    fouls: z(),
    offside: z(),
    tackles: z(),
    saves: z(),
  };
}

export const ovrOfPlayer = overall;
