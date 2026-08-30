import { useCallback, useEffect, useRef, useState } from "react";
import { MatchEngine, emptyInput, type MatchInput, type TeamInfo } from "../game/engine";
import { Renderer3D, CAMERA_LABELS } from "../game/render3d";
import { sfx } from "../game/audio";
import { CLUB_MAP } from "../game/data/clubs";
import { overall } from "../game/formations";
import { motmScore } from "../game/brain";
import { bonusesOf } from "../game/economy";
import type { CameraId, Career, MatchResult, MatchSettings, Player, TeamTactic, World } from "../game/types";
import { Bar, Btn, Card, Crest, OvrBadge, SectionTitle, Sheet, StatRow, cx, money } from "./ui";

export const DIFFICULTIES = [
  { id: 0, name: "Amatör", ai: 0.34 },
  { id: 1, name: "Kolay", ai: 0.5 },
  { id: 2, name: "Normal", ai: 0.66 },
  { id: 3, name: "Zor", ai: 0.82 },
  { id: 4, name: "Efsane", ai: 0.96 },
];

export interface TeamSetup {
  clubId: string;
  lineup: string[];
  subs: string[];
  tactic: TeamTactic;
  isUser: boolean;
}

interface Props {
  world: World;
  home: TeamSetup;
  away: TeamSetup;
  settings: MatchSettings;
  competition: string;
  cup: boolean;
  career: Career | null;
  onFinish: (r: MatchResult) => void;
  onQuit: () => void;
}

interface Hud {
  hg: number;
  ag: number;
  clock: number;
  phase: string;
  half: number;
  msg: string;
  poss: [number, number];
  stamina: number;
  ctrl: string;
  ctrlNum: number;
  restart: string;
}

const RESTART_LABEL: Record<string, string> = {
  kickoff: "BAŞLAMA VURUŞU",
  throwin: "TAÇ",
  corner: "KORNER",
  goalkick: "KALE VURUŞU",
  penalty: "PENALTI!",
  freekick: "SERBEST VURUŞ",
};

export default function MatchScreen({ world, home, away, settings, competition, cup, career, onFinish, onQuit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<MatchEngine | null>(null);
  const rendererRef = useRef<Renderer3D | null>(null);

  const joyRef = useRef({ active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 });
  const keysRef = useRef<Record<string, boolean>>({});
  const pressRef = useRef({ sprint: false, shoot: false, shootStart: 0 });
  const edgeRef = useRef({ pass: false, through: false, switchP: false, slide: false, shootRelease: false });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [camera, setCamera] = useState<CameraId>(settings.camera);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  const [hud, setHud] = useState<Hud>({
    hg: 0, ag: 0, clock: 0, phase: "kickoff", half: 1, msg: "Maç başlıyor",
    poss: [50, 50], stamina: 100, ctrl: "", ctrlNum: 0, restart: "",
  });
  const [paused, setPaused] = useState(false);
  const [menu, setMenu] = useState<null | "pause" | "subs" | "tactics" | "stats">(null);
  const [power, setPower] = useState(0);
  const [subsLeft, setSubsLeft] = useState(3);
  const [showHelp, setShowHelp] = useState(true);
  const [goalBanner, setGoalBanner] = useState<string | null>(null);
  const goalShown = useRef(false);
  const [finished, setFinished] = useState<MatchResult | null>(null);
  const [pens, setPens] = useState<[number, number] | null>(null);
  const [subSel, setSubSel] = useState<{ out?: string; in?: string }>({});

  const homeClub = CLUB_MAP[home.clubId];
  const awayClub = CLUB_MAP[away.clubId];
  const userSide: 0 | 1 = home.isUser ? 0 : 1;

  useEffect(() => {
    const t = setTimeout(() => setShowHelp(false), 9000);
    return () => clearTimeout(t);
  }, []);

  /* ------------------------- motor kurulumu ------------------------- */
  useEffect(() => {
    sfx.enabled = settings.sound;
    if (settings.sound) {
      sfx.unlock();
      sfx.startAmbience();
    }
    const bon = bonusesOf(career);
    const isUserHome = home.isUser;
    const mk = (s: TeamSetup): TeamInfo => ({
      clubId: s.clubId,
      name: CLUB_MAP[s.clubId].name,
      short: CLUB_MAP[s.clubId].short,
      tactic: s.tactic,
      lineup: s.lineup,
      subs: [...s.subs],
      rating:
        s.lineup.reduce((a, id) => a + (world.players[id] ? overall(world.players[id]) : 70), 0) /
        Math.max(1, s.lineup.length),
      aiSkill: DIFFICULTIES[settings.difficulty]?.ai ?? 0.66,
      isUser: s.isUser,
      formation: s.tactic.formation,
    });

    // menajer / tesis katkısı yalnızca kullanıcı takımına
    const boost: [number, number] = [0, 0];
    const drain: [number, number] = [1, 1];
    boost[userSide] = bon.teamBoost;
    drain[userSide] = bon.staminaDrain;
    // ev sahibi avantajı (stadyum ışık + tribün)
    if (isUserHome) boost[0] += (bon.homeAdv - 1) * 24;

    const engine = new MatchEngine(mk(home), mk(away), world.players, {
      minutes: settings.minutes,
      difficulty: settings.difficulty,
      offside: settings.offside,
      seed: Math.floor(Math.random() * 1e9),
      assist: settings.assist,
      boost,
      drain,
    });
    engineRef.current = engine;
    engine.onSound = (s) => sfx.play(s);
    engine.onEvent = () => {
      if (engine.phase === "halftime") {
        engine.paused = true;
        setMenu("pause");
      }
      if (engine.phase === "fulltime") {
        engine.paused = true;
        finishMatch();
      }
    };

    const canvas = canvasRef.current!;
    const renderer = new Renderer3D(canvas);
    rendererRef.current = renderer;

    const onResize = () => renderer.resize();
    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    let raf = 0;
    let last = performance.now();
    let hudAcc = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (!engine.paused) {
        engine.update(dt, buildInput());
        edgeRef.current.shootRelease = false;
        edgeRef.current.pass = false;
        edgeRef.current.through = false;
        edgeRef.current.switchP = false;
        edgeRef.current.slide = false;
        if (engine.clock > 55) engine.cpuSubstitutions();
        if (pressRef.current.shoot) {
          setPower(Math.min(1, (performance.now() - pressRef.current.shootStart) / 700));
        }
      }
      const st = settingsRef.current;
      renderer.draw(
        engine,
        {
          camera: cameraRef.current,
          quality: st.quality,
          showNames: true,
          faik: st.faikMode,
          userTeam: userSide,
          standsLevel: career?.stadium.levels.stands ?? 3,
          lightsLevel: career?.stadium.levels.lights ?? 2,
          screenLevel: career?.stadium.levels.screen ?? 1,
          radar: true,
        },
        engine.paused ? 0 : dt
      );
      hudAcc += dt;
      if (hudAcc > 0.12) {
        hudAcc = 0;
        const ev = engine.events[engine.events.length - 1];
        const ctrl = engine.controlled;
        setHud({
          hg: engine.score[0],
          ag: engine.score[1],
          clock: engine.displayClock,
          phase: engine.phase,
          half: engine.half,
          msg: ev && st.commentary ? ev.text : "",
          poss: engine.possessionPct,
          stamina: ctrl ? ctrl.stamina : 100,
          ctrl: ctrl ? ctrl.ref.name.split(" ").slice(-1)[0] : "",
          ctrlNum: ctrl ? ctrl.ref.num : 0,
          restart: engine.restart?.type ?? "",
        });
        sfx.setIntensity(Math.min(1, engine.clock / 90));
        if (engine.phase === "goal" && !goalShown.current) {
          goalShown.current = true;
          if (st.haptics && navigator.vibrate) navigator.vibrate([40, 60, 90]);
          const sc = engine.scorers[engine.scorers.length - 1];
          setGoalBanner(sc ? sc.playerId : "");
          setTimeout(() => {
            setGoalBanner(null);
            goalShown.current = false;
          }, 2800);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      sfx.stopAmbience();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------- girdi ------------------------- */
  const buildInput = useCallback((): MatchInput => {
    const j = joyRef.current;
    const R = 62;
    let jx = j.active ? j.dx / R : 0;
    let jy = j.active ? j.dy / R : 0;
    const k = keysRef.current;
    if (!j.active) {
      jx = (k["ArrowRight"] || k["d"] ? 1 : 0) - (k["ArrowLeft"] || k["a"] ? 1 : 0);
      jy = (k["ArrowDown"] || k["s"] ? 1 : 0) - (k["ArrowUp"] || k["w"] ? 1 : 0);
    }
    const m = Math.hypot(jx, jy);
    if (m > 1) {
      jx /= m;
      jy /= m;
    }
    const e = edgeRef.current;
    const st = settingsRef.current;
    const eng = engineRef.current;
    // Ekran yönünü saha eksenlerine çevir.
    // 3B kamerada dünya +y ekranda YUKARI düşer; bu yüzden dikey eksen terstir.
    let mx = jx;
    let my = -jy;
    const cam = cameraRef.current;
    if (eng && (cam === "behind" || cam === "sky")) {
      // arkadan görüşte ekranda yukarı = hücum yönü
      const attack = eng.dir[userSide] === 1 ? 1 : -1;
      mx = -jy * attack;
      my = -jx * attack;
    }
    // tam yardımda otomatik koşu
    const autoSprint = st.assist >= 2 && Math.hypot(jx, jy) > 0.85;
    return {
      mx,
      my,
      sprint: pressRef.current.sprint || !!k["Shift"] || autoSprint,
      pass: e.pass || !!k["j"],
      shootRelease: e.shootRelease || !!k["k"],
      shootPower: pressRef.current.shoot ? Math.min(1, (performance.now() - pressRef.current.shootStart) / 700) : 0.62,
      through: e.through || !!k["l"],
      switchP: e.switchP,
      slide: e.slide,
      aimX: 0,
      aimY: my,
    };
  }, [userSide]);

  useEffect(() => {
    const kd = (ev: KeyboardEvent) => {
      keysRef.current[ev.key] = true;
      if (ev.key === "k") {
        if (!pressRef.current.shoot) pressRef.current.shootStart = performance.now();
        pressRef.current.shoot = true;
      }
      if (ev.key === "j") edgeRef.current.pass = true;
      if (ev.key === "l") edgeRef.current.through = true;
      if (ev.key === " ") {
        edgeRef.current.switchP = true;
        ev.preventDefault();
      }
      if (ev.key === "c") cycleCamera();
      if (ev.key === "p") openPause();
    };
    const ku = (ev: KeyboardEvent) => {
      keysRef.current[ev.key] = false;
      if (ev.key === "k") {
        pressRef.current.shoot = false;
        edgeRef.current.shootRelease = true;
        setPower(0);
      }
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------- dokunmatik ------------------------- */
  const joyVisualRef = useRef<HTMLDivElement | null>(null);

  const placeJoy = () => {
    const j = joyRef.current;
    const el = joyVisualRef.current;
    if (!el) return;
    el.style.display = j.active ? "block" : "none";
    el.style.left = `${j.ox - 66}px`;
    el.style.top = `${j.oy - 66}px`;
    const knob = el.firstElementChild as HTMLElement | null;
    if (knob) knob.style.transform = `translate(${j.dx * 0.6}px, ${j.dy * 0.6}px)`;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.clientX > window.innerWidth * 0.5) return; // sağ yarı: aksiyon butonları
    if (e.clientY < window.innerHeight * 0.18) return; // üst HUD
    const j = joyRef.current;
    j.active = true;
    j.id = e.pointerId;
    j.ox = e.clientX;
    j.oy = e.clientY;
    j.dx = 0;
    j.dy = 0;
    placeJoy();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const j = joyRef.current;
    if (!j.active || j.id !== e.pointerId) return;
    j.dx = e.clientX - j.ox;
    j.dy = e.clientY - j.oy;
    const d = Math.hypot(j.dx, j.dy);
    if (d > 76) {
      j.ox = e.clientX - (j.dx / d) * 76;
      j.oy = e.clientY - (j.dy / d) * 76;
      j.dx = (j.dx / d) * 76;
      j.dy = (j.dy / d) * 76;
    }
    placeJoy();
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const j = joyRef.current;
    if (j.id !== e.pointerId) return;
    j.active = false;
    j.dx = 0;
    j.dy = 0;
    placeJoy();
  };

  const cycleCamera = () => {
    const idx = CAMERA_LABELS.findIndex((c) => c.id === cameraRef.current);
    const next = CAMERA_LABELS[(idx + 1) % CAMERA_LABELS.length].id as CameraId;
    setCamera(next);
    sfx.play("ui");
  };

  const openPause = () => {
    const e = engineRef.current;
    if (e) e.paused = true;
    setPaused(true);
    setMenu("pause");
    sfx.play("ui");
  };

  const defending = engineRef.current ? engineRef.current.ball.owner?.team !== userSide : true;

  /* ------------------------- aksiyon butonu ------------------------- */
  const ActionBtn = ({
    label, sub, onDown, onUp, size = 74, color, hold,
  }: {
    label: string;
    sub?: string;
    onDown: () => void;
    onUp?: () => void;
    size?: number;
    color: string;
    hold?: boolean;
  }) => (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDown();
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onUp?.();
      }}
      onPointerLeave={() => hold && onUp?.()}
      onContextMenu={(e) => e.preventDefault()}
      className="no-select grid place-items-center rounded-full font-black active:scale-90"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 34% 28%, ${color}, rgba(0,0,0,0.62))`,
        border: "2px solid rgba(255,255,255,0.38)",
        boxShadow: `0 8px 22px rgba(0,0,0,0.5), 0 0 18px -6px ${color}`,
        fontSize: size * 0.2,
        color: "#fff",
        textShadow: "0 1px 3px rgba(0,0,0,0.7)",
        transition: "transform .07s ease",
      }}
    >
      <span>{label}</span>
      {sub && <span className="text-[8px] font-bold opacity-70">{sub}</span>}
    </button>
  );

  /* ------------------------- maç sonu ------------------------- */
  const finishMatch = () => {
    const e = engineRef.current;
    if (!e) return;
    e.finish();
    const ratings = e.ratings();
    let motm: string | null = null;
    let bestScore = -1;
    for (const mp of e.players) {
      if (!mp.onPitch && mp.minutes < 10) continue;
      const s = motmScore(mp.goals, mp.assists, ratings[mp.id] ?? 6, mp.tackles, mp.passes);
      if (s > bestScore) {
        bestScore = s;
        motm = mp.id;
      }
    }
    const res: MatchResult = {
      homeClubId: home.clubId,
      awayClubId: away.clubId,
      hg: e.score[0],
      ag: e.score[1],
      stats: {
        ...e.stats,
        possession: e.possessionPct,
        passAcc: [
          Math.round((e.players.filter((x) => x.team === 0).reduce((a, x) => a + (x.passesOk / Math.max(1, x.passes)) * 100, 0) / 11) * 10) / 10,
          Math.round((e.players.filter((x) => x.team === 1).reduce((a, x) => a + (x.passesOk / Math.max(1, x.passes)) * 100, 0) / 11) * 10) / 10,
        ],
      },
      scorers: e.scorers,
      ratings,
      motm,
      cards: e.cards,
    };
    if (cup && res.hg === res.ag) {
      let a = 0;
      let b = 0;
      for (let i = 0; i < 5; i++) {
        if (Math.random() < 0.75) a++;
        if (Math.random() < 0.75) b++;
      }
      while (a === b) {
        if (Math.random() < 0.75) a++;
        if (Math.random() < 0.75) b++;
      }
      res.pens = [a, b];
      setPens([a, b]);
    }
    setFinished(res);
    setMenu(null);
  };

  const doSub = () => {
    const e = engineRef.current;
    if (!e || !subSel.out || !subSel.in || subsLeft <= 0) return;
    if (e.substitute(subSel.out, subSel.in)) {
      const t = e.teams[userSide];
      t.subs = t.subs.filter((id) => id !== subSel.in);
      setSubsLeft((n) => n - 1);
      setSubSel({});
      sfx.play("ui");
    }
  };

  const simulateRest = () => {
    const e = engineRef.current;
    if (!e) return;
    e.paused = false;
    setPaused(false);
    setMenu(null);
    let guard = 0;
    const started = performance.now();
    while (e.phase !== "fulltime" && guard++ < 60000) {
      e.paused = false;
      e.update(1 / 30, emptyInput());
      if (e.phase === "halftime") {
        e.paused = false;
        e.resumeSecondHalf();
      }
      if ((e.phase as string) === "fulltime") break;
      if (performance.now() - started > 4000) break; // güvenlik freni
    }
    finishMatch();
  };

  const onPitch = engineRef.current?.players.filter((x) => x.team === userSide && x.onPitch) ?? [];
  const bench = (engineRef.current?.teams[userSide].subs ?? []).map((id) => world.players[id]).filter(Boolean);
  const e0 = engineRef.current;
  const userScore = userSide === 0 ? hud.hg : hud.ag;
  const oppScore = userSide === 0 ? hud.ag : hud.hg;

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

      {/* --------- ÜST HUD (yayın skor bandı) --------- */}
      <div className="safe-t pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-2">
        <button
          onClick={openPause}
          className="btn-press pointer-events-auto grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/55 text-white backdrop-blur"
        >
          ⏸
        </button>

        <div className="hud-chip flex items-center gap-0 overflow-hidden rounded-xl">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5"
            style={{ background: `linear-gradient(90deg, ${homeClub.kit.primary}44, transparent)` }}
          >
            <Crest club={homeClub} size={18} />
            <span className="text-[11px] font-black">{homeClub.short}</span>
          </div>
          <div className="tabnum bg-black/45 px-2.5 py-1.5 text-base font-black text-emerald-300">
            {hud.hg}-{hud.ag}
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5"
            style={{ background: `linear-gradient(270deg, ${awayClub.kit.primary}44, transparent)` }}
          >
            <span className="text-[11px] font-black">{awayClub.short}</span>
            <Crest club={awayClub} size={18} />
          </div>
          <div className="border-l border-white/12 px-2 py-1.5 text-[11px] font-black tabnum text-white/85">
            {Math.floor(hud.clock)}'
            <span className="ml-1 text-[9px] text-white/40">{hud.half === 1 ? "1Y" : "2Y"}</span>
          </div>
        </div>

        <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
          <div className="hud-chip hidden rounded-xl px-2 py-1 text-[10px] font-bold text-white/70 sm:block">
            {competition}
          </div>
          <button
            onClick={cycleCamera}
            className="btn-press hud-chip grid h-9 min-w-9 place-items-center rounded-xl px-2 text-[9px] font-black text-white/80"
          >
            🎥
            <span className="text-[8px] text-emerald-300">
              {CAMERA_LABELS.find((c) => c.id === camera)?.name}
            </span>
          </button>
        </div>
      </div>

      {/* oyuncu bilgi kartı */}
      <div className="pointer-events-none absolute left-2 top-14 z-10 flex flex-col gap-1">
        <div className="hud-chip flex items-center gap-2 rounded-xl px-2 py-1">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-emerald-400 text-[9px] font-black text-emerald-950">
            {hud.ctrlNum}
          </span>
          <span className="text-[10px] font-black text-emerald-200">{hud.ctrl}</span>
        </div>
        <div className="w-24">
          <Bar
            value={hud.stamina}
            height={4}
            color={hud.stamina > 60 ? "#37f28b" : hud.stamina > 35 ? "#eab308" : "#f43f5e"}
          />
        </div>
        {hud.restart && hud.restart !== "goal" && (
          <div className="hud-chip rounded-lg px-2 py-0.5 text-[10px] font-black text-amber-300 anim-pulse">
            {RESTART_LABEL[hud.restart] ?? "SERBEST VURUŞ"}
          </div>
        )}
        {settings.faikMode && (
          <div className="hud-chip rounded-lg px-2 py-0.5 text-[9px] font-black text-amber-200">
            🥅 SAKAT FAİK MODU
          </div>
        )}
      </div>

      {/* kontrol rehberi */}
      {showHelp && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-30 flex justify-center px-4">
          <div className="hud-chip max-w-md rounded-2xl p-3 text-[11px] leading-relaxed anim-up">
            <div className="mb-1 text-center text-xs font-black text-emerald-300">KONTROLLER</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <div>👈 Sol yarıyı sürükle → <b>hareket</b></div>
              <div>🔴 <b>ŞUT</b> — basılı tut, bırak</div>
              <div>🟢 <b>PAS</b> · 🔵 <b>ARA PAS</b></div>
              <div>🟣 <b>⚡</b> koş · 🎥 kamera</div>
              <div className="col-span-2 text-white/55">
                Savunmada: PAS = top kap · ARA = kayarak müdahale · ŞUT = oyuncu değiştir
              </div>
            </div>
            <div className="pointer-events-auto mt-2 flex justify-center">
              <button
                onClick={() => setShowHelp(false)}
                className="btn-press rounded-xl bg-emerald-400 px-4 py-1.5 text-[11px] font-black text-emerald-950"
              >
                ANLADIM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* spiker */}
      {hud.msg && settings.commentary && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center px-4">
          <div className="hud-chip max-w-[70%] rounded-xl px-3 py-1 text-center text-[11px] font-semibold text-white/85">
            {hud.msg}
          </div>
        </div>
      )}

      {/* gol bannerı */}
      {goalBanner !== null && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <div className="anim-goal text-center">
            <div className="text-6xl font-black tracking-tighter text-emerald-300 drop-shadow-[0_6px_24px_rgba(0,0,0,0.9)] sm:text-8xl">
              GOOOL!
            </div>
            <div className="mt-1 text-xl font-black text-white drop-shadow-lg">
              {world.players[goalBanner]?.name ?? ""}
            </div>
            <div className="mt-1 text-sm font-black text-white/70 tabnum">
              {homeClub.short} {hud.hg} - {hud.ag} {awayClub.short}
            </div>
          </div>
        </div>
      )}

      {/* --------- dokunmatik alan / joystick --------- */}
      <div
        className="absolute inset-0 z-[5] touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          ref={joyVisualRef}
          className="pointer-events-none absolute h-33 w-33 rounded-full border-2 border-white/25 bg-white/5"
          style={{ display: "none", left: 0, top: 0, width: 132, height: 132 }}
        >
          <div className="absolute left-9 top-9 h-14 w-14 rounded-full border-2 border-white/55 bg-white/25 backdrop-blur-sm" />
        </div>
      </div>

      {/* --------- aksiyon butonları (sağ) --------- */}
      <div className="safe-b safe-r pointer-events-none absolute bottom-3 right-3 z-[6] flex items-end gap-2">
        <div className="pointer-events-auto flex flex-col items-center gap-2">
          <ActionBtn
            label={defending ? "KAY" : "ARA"}
            sub={defending ? "kayarak" : "ara pas"}
            size={56}
            color="#38bdf8"
            onDown={() => (edgeRef.current.slide = true)}
          />
          <ActionBtn
            label={defending ? "KAP" : "PAS"}
            size={74}
            color="#22c55e"
            onDown={() => (edgeRef.current.pass = true)}
          />
        </div>
        <div className="pointer-events-auto flex flex-col items-center gap-1.5">
          <ActionBtn
            label={defending ? "DEĞİŞ" : "ŞUT"}
            sub={defending ? "oyuncu" : "basılı tut"}
            size={92}
            color={power > 0.02 ? "#f97316" : "#f43f5e"}
            hold
            onDown={() => {
              if (defending) {
                edgeRef.current.switchP = true;
                return;
              }
              pressRef.current.shoot = true;
              pressRef.current.shootStart = performance.now();
            }}
            onUp={() => {
              if (pressRef.current.shoot) {
                pressRef.current.shoot = false;
                edgeRef.current.shootRelease = true;
                setPower(0);
              }
            }}
          />
          <div className="h-2 w-24 overflow-hidden rounded-full bg-black/55">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 transition-[width] duration-75"
              style={{ width: `${power * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* koş + oyuncu değiştir (sol alt) */}
      <div className="safe-b safe-l pointer-events-none absolute bottom-3 left-3 z-[6] flex items-end gap-2">
        <div className="pointer-events-auto">
          <ActionBtn
            label="⚡"
            sub="koş"
            size={64}
            color="#a855f7"
            hold
            onDown={() => (pressRef.current.sprint = true)}
            onUp={() => (pressRef.current.sprint = false)}
          />
        </div>
        <div className="pointer-events-auto">
          <ActionBtn
            label="⇄"
            sub="değiştir"
            size={48}
            color="#64748b"
            onDown={() => (edgeRef.current.switchP = true)}
          />
        </div>
      </div>

      {/* --------- Menüler --------- */}
      <Sheet open={menu === "pause"} onClose={() => setMenu(null)} title={paused ? "Mola" : "İlk Yarı Sonu"}>
        <div className="space-y-2">
          <div className="mb-3 grid grid-cols-3 items-center gap-2 text-center">
            <div className="rounded-xl bg-white/6 p-2">
              <Crest club={homeClub} size={26} />
              <div className="text-[10px] font-black">{homeClub.short}</div>
            </div>
            <div className="tabnum text-3xl font-black text-emerald-300">
              {hud.hg} - {hud.ag}
            </div>
            <div className="rounded-xl bg-white/6 p-2">
              <Crest club={awayClub} size={26} />
              <div className="text-[10px] font-black">{awayClub.short}</div>
            </div>
          </div>
          <Btn
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => {
              const e = engineRef.current;
              if (!e) return;
              if (e.phase === "halftime") {
                e.paused = false;
                e.resumeSecondHalf();
              } else {
                e.paused = false;
              }
              setPaused(false);
              setMenu(null);
              sfx.play("ui");
            }}
          >
            {hud.phase === "halftime" ? "▶ İkinci Yarıyı Başlat" : "▶ Devam Et"}
          </Btn>
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="dark" onClick={() => setMenu("tactics")}>📋 Taktik</Btn>
            <Btn variant="dark" onClick={() => setMenu("subs")}>🔄 Değişiklik ({subsLeft})</Btn>
            <Btn variant="dark" onClick={() => setMenu("stats")}>📊 İstatistik</Btn>
            <Btn variant="dark" onClick={simulateRest}>⏩ Simüle Et</Btn>
          </div>
          <div className="rounded-xl bg-white/5 p-2">
            <SectionTitle>KAMERA</SectionTitle>
            <div className="grid grid-cols-3 gap-1.5">
              {CAMERA_LABELS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCamera(c.id as CameraId)}
                  className={cx(
                    "btn-press rounded-lg py-1.5 text-[10px] font-black",
                    camera === c.id ? "bg-emerald-400 text-emerald-950" : "bg-white/8 text-white/55"
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <Btn variant="danger" className="w-full" onClick={onQuit}>
            Maçı Terk Et
          </Btn>
        </div>
      </Sheet>

      <Sheet open={menu === "subs"} onClose={() => setMenu("pause")} title={`Oyuncu Değişikliği (${subsLeft} hak)`} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <SectionTitle>SAHADAKİLER</SectionTitle>
            {onPitch.map((x) => (
              <button
                key={x.id}
                onClick={() => setSubSel((s) => ({ ...s, out: x.id }))}
                className={cx(
                  "btn-press mb-1 flex w-full items-center gap-2 rounded-xl p-2 text-left",
                  subSel.out === x.id ? "panel-hi" : "bg-white/5"
                )}
              >
                <OvrBadge value={overall(x.ref)} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-bold">
                    {x.ref.name} <span className="text-white/40">{x.ref.pos}</span>
                  </div>
                  <Bar value={x.stamina} height={3} color={x.stamina > 55 ? "#37f28b" : "#f59e0b"} />
                </div>
                <div className="tabnum text-[11px] font-black text-emerald-300">
                  {Math.round((engineRef.current?.ratings()[x.id] ?? 6) * 10) / 10}
                </div>
              </button>
            ))}
          </div>
          <div>
            <SectionTitle>YEDEKLER</SectionTitle>
            {bench.map((x) => (
              <button
                key={x.id}
                onClick={() => setSubSel((s) => ({ ...s, in: x.id }))}
                className={cx(
                  "btn-press mb-1 flex w-full items-center gap-2 rounded-xl p-2 text-left",
                  subSel.in === x.id ? "panel-hi" : "bg-white/5"
                )}
              >
                <OvrBadge value={overall(x)} size={30} />
                <div className="min-w-0 flex-1 truncate text-[11px] font-bold">
                  {x.name} <span className="text-white/40">{x.pos}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
        <Btn variant="primary" className="mt-3 w-full" disabled={!subSel.out || !subSel.in || subsLeft <= 0} onClick={doSub}>
          Değişikliği Uygula
        </Btn>
      </Sheet>

      <Sheet open={menu === "tactics"} onClose={() => setMenu("pause")} title="Taktik Ayarları">
        <TacticPanel
          tactic={e0?.teams[userSide].tactic ?? home.tactic}
          onChange={(t) => {
            const e = engineRef.current;
            if (e) e.teams[userSide].tactic = t;
          }}
        />
      </Sheet>

      <Sheet open={menu === "stats"} onClose={() => setMenu("pause")} title="Maç İstatistikleri">
        {e0 && <StatsPanel engine={e0} />}
      </Sheet>

      {/* --------- Maç sonu --------- */}
      {finished && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/85 p-3 anim-fade">
          <div className="panel scroll-y max-h-[94vh] w-full max-w-3xl rounded-2xl p-4 anim-pop">
            <div className="mb-3 text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                {competition} · MAÇ SONU
              </div>
              <div className="mt-2 flex items-center justify-center gap-4">
                <div className="flex flex-1 flex-col items-end gap-1">
                  <Crest club={homeClub} size={44} />
                  <div className="text-[11px] font-black">{homeClub.short}</div>
                </div>
                <div className="tabnum text-5xl font-black text-emerald-300">
                  {finished.hg} - {finished.ag}
                </div>
                <div className="flex flex-1 flex-col items-start gap-1">
                  <Crest club={awayClub} size={44} />
                  <div className="text-[11px] font-black">{awayClub.short}</div>
                </div>
              </div>
              {pens && <div className="mt-1 text-sm font-black text-amber-300">Penaltılar: {pens[0]} - {pens[1]}</div>}
              <div className="mt-1 text-xs font-black text-white/50">
                {userScore > oppScore ? "🏅 GALİBİYET" : userScore === oppScore ? "🤝 BERABERLİK" : "😞 MAĞLUBİYET"}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <SectionTitle>GOLLER</SectionTitle>
                {finished.scorers.length === 0 && <div className="text-[11px] text-white/40">Gol yok</div>}
                {finished.scorers.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 py-0.5 text-[11px]">
                    <span className="tabnum text-white/40">{s.minute}'</span>
                    <span className="flex-1 truncate font-bold">{world.players[s.playerId]?.name ?? "?"}</span>
                    <span className="text-white/35">{CLUB_MAP[s.clubId]?.short}</span>
                  </div>
                ))}
              </Card>
              <Card>
                <SectionTitle>İSTATİSTİK</SectionTitle>
                {e0 && <StatsPanel engine={e0} />}
              </Card>
              <Card>
                <SectionTitle>PERFORMANS</SectionTitle>
                <div className="scroll-y max-h-56">
                  {(e0?.players ?? [])
                    .filter((x) => x.minutes > 5 || x.goals > 0)
                    .sort((a, b) => (finished.ratings[b.id] ?? 0) - (finished.ratings[a.id] ?? 0))
                    .slice(0, 14)
                    .map((x) => (
                      <div key={x.id} className="flex items-center gap-2 py-0.5">
                        <span className="w-8 text-[9px] font-bold text-white/40">{x.ref.pos}</span>
                        <span className="flex-1 truncate text-[11px] font-semibold">
                          {x.ref.name} {x.id === finished.motm ? "⭐" : ""}
                        </span>
                        {x.goals > 0 && <span className="text-[9px]">⚽{x.goals}</span>}
                        {x.assists > 0 && <span className="text-[9px] text-emerald-300">🅰{x.assists}</span>}
                        <span className="tabnum text-[11px] font-black text-emerald-300">{finished.ratings[x.id]}</span>
                      </div>
                    ))}
                </div>
              </Card>
            </div>

            <Btn variant="primary" size="lg" className="mt-3 w-full" onClick={() => onFinish(finished)}>
              Devam Et →
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------- alt paneller ------------------------- */
function StatsPanel({ engine }: { engine: MatchEngine }) {
  const s = engine.stats;
  const p = engine.possessionPct;
  return (
    <div>
      <StatRow label="Topla oynama %" home={p[0]} away={p[1]} />
      <StatRow label="Şut" home={s.shots[0]} away={s.shots[1]} />
      <StatRow label="İsabetli şut" home={s.onTarget[0]} away={s.onTarget[1]} />
      <StatRow label="Pas" home={s.passes[0]} away={s.passes[1]} />
      <StatRow label="Korner" home={s.corners[0]} away={s.corners[1]} />
      <StatRow label="Faul" home={s.fouls[0]} away={s.fouls[1]} />
      <StatRow label="Kurtarış" home={s.saves[0]} away={s.saves[1]} />
      <StatRow label="Ofsayt" home={s.offside[0]} away={s.offside[1]} />
    </div>
  );
}

export function TacticPanel({ tactic, onChange }: { tactic: TeamTactic; onChange: (t: TeamTactic) => void }) {
  const slider = (label: string, key: keyof TeamTactic, min = 0, max = 100) => (
    <div className="mb-2.5">
      <div className="mb-0.5 flex justify-between text-[11px] font-bold">
        <span className="text-white/60">{label}</span>
        <span className="tabnum text-emerald-300">{String(tactic[key])}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={Number(tactic[key])}
        onChange={(e) => onChange({ ...tactic, [key]: Number(e.target.value) })}
        className="w-full"
      />
    </div>
  );
  return (
    <div>
      <div className="mb-3 flex gap-1.5">
        {(["Çok Defansif", "Dengeli", "Hücumcu"] as const).map((m, i) => (
          <button
            key={m}
            onClick={() => onChange({ ...tactic, mentality: 25 + i * 25 })}
            className={cx(
              "btn-press flex-1 rounded-xl px-2 py-2 text-[10px] font-black",
              Math.round(tactic.mentality / 25) === i + 1 ? "bg-emerald-400 text-emerald-950" : "bg-white/6 text-white/60"
            )}
          >
            {m}
          </button>
        ))}
      </div>
      {slider("Hücum", "mentality")}
      {slider("Pres", "pressing")}
      {slider("Savunma hattı", "lineHeight")}
      {slider("Genişlik", "width")}
      {slider("Tempo", "tempo")}
      <div className="mt-2 flex gap-1.5">
        {(["short", "mixed", "long"] as const).map((v) => (
          <button
            key={v}
            onClick={() => onChange({ ...tactic, passing: v })}
            className={cx(
              "btn-press flex-1 rounded-xl px-2 py-2 text-[10px] font-black",
              tactic.passing === v ? "bg-emerald-400 text-emerald-950" : "bg-white/6 text-white/60"
            )}
          >
            {v === "short" ? "Kısa pas" : v === "mixed" ? "Karışık" : "Uzun top"}
          </button>
        ))}
      </div>
      <div className="mt-3 text-[10px] text-white/35">
        Taktik değişiklikleri anında uygulanır. Formasyon kadro ekranından değiştirilir.
      </div>
    </div>
  );
}

export { money };
export type { Player };
