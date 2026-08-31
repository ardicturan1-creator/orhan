import React from "react";
import { Boot, RotateWarning, useIsPortrait } from "./Boot";
import { MatchScreen } from "./MatchScreen";
import { HomeScreen, TeamSelectScreen, SquadScreen, TacticsScreen, LeagueScreen, StatsScreen, SettingsScreen, type AppCtx } from "./screens";
import { TransferScreen, ContractsScreen, StadiumScreen, ManagerScreen, ShopScreen } from "./screens2";
import { CreateTeamScreen } from "./CreateTeam";
import { Bar, Btn, Crest, Empty, cx } from "./ui";
import { autoLineup, createCustomClub, generateWorld, loadWorld, saveWorld, clearSave, clubPower } from "../game/world";
import { newCareer, userFixture, userCupTie, commitResult, reautoLineup, squadOf } from "../game/career";
import { bonusesOf, matchReward, addManagerXp, bumpObjective } from "../game/economy";
import { MatchEngine, type TeamSetup } from "../game/engine";
import { setAudioEnabled, sfxGoal, sfxKick, sfxSave, sfxSub, sfxUi, sfxWhistle, sfxMiss, startAmbience, stopAmbience, setAmbienceLevel, vibrate } from "../game/audio";
import type { CameraId, MatchResult, MatchSettings, Screen, World } from "../game/types";

const DEFAULT_SETTINGS: MatchSettings = {
  minutes: 90, realMinutes: 15, difficulty: 1, sound: true, offside: true, autoSwitch: true,
  camera: "broadcast", assist: 1, quality: 1, haptics: true, commentary: true, faikMode: false,
};

const RAIL: { id: Screen; icon: string; label: string }[] = [
  { id: "home", icon: "🏠", label: "MENÜ" },
  { id: "squad", icon: "👥", label: "KADRO" },
  { id: "tactics", icon: "🧠", label: "TAKTİK" },
  { id: "transfers", icon: "🔁", label: "TRANS." },
  { id: "contracts", icon: "📝", label: "SÖZ." },
  { id: "table", icon: "🏆", label: "LİG" },
  { id: "stats", icon: "📊", label: "İST." },
  { id: "stadium", icon: "🏟️", label: "STAD." },
  { id: "manager", icon: "🧑‍💼", label: "MENAJ." },
  { id: "shop", icon: "🛒", label: "MAĞ." },
  { id: "settings", icon: "⚙️", label: "AYAR" },
];

export function App(): React.JSX.Element {
  const [booted, setBooted] = React.useState(false);
  const portrait = useIsPortrait();
  const [world, setWorld] = React.useState<World | null>(null);
  const [screen, setScreen] = React.useState<Screen>("home");
  const [settings, setSettings] = React.useState<MatchSettings>(() => {
    try {
      const raw = localStorage.getItem("twin_soccer_settings");
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { /* yoksay */ }
    return DEFAULT_SETTINGS;
  });
  const [toast, setToast] = React.useState("");
  const [eng, setEng] = React.useState<MatchEngine | null>(null);
  const [matchMeta, setMatchMeta] = React.useState<{ homeId: string; awayId: string; cupMode: boolean; userTeam: 0 | 1 } | null>(null);
  const [frozen, setFrozen] = React.useState(false);
  const [reward, setReward] = React.useState<{ lines: string[]; title: string } | null>(null);
  const [, force] = React.useState(0);
  const simRef = React.useRef<number | null>(null);

  /* ---------------- başlatma: kayıt şifreli okunur (şifre sorulmaz) ---------------- */
  React.useEffect(() => {
    const w = loadWorld();
    if (w) { setWorld(w); setScreen(w.career ? "home" : "teamselect"); }
    else setWorld(generateWorld(Math.floor(Math.random() * 1e9) + 7));
    setAudioEnabled(settings.sound);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    try { localStorage.setItem("twin_soccer_settings", JSON.stringify(settings)); } catch { /* yoksay */ }
    setAudioEnabled(settings.sound);
  }, [settings]);

  React.useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const commit = React.useCallback((): void => {
    force((v) => v + 1);
    if (world) saveWorld(world);
  }, [world]);

  // kariyer yoksa her zaman kulüp seçimine dön (render aşamasında setState yapmamak için effect)
  React.useEffect(() => {
    if (!world?.career && booted && screen !== "teamselect" && screen !== "settings" && screen !== "stats" && screen !== "createteam") {
      setScreen("teamselect");
    }
  }, [world?.career, screen, booted]);

  React.useEffect(() => {
    return () => { if (simRef.current) window.clearTimeout(simRef.current); stopAmbience(); };
  }, []);

  const nav = (s: Screen): void => {
    setScreen(s);
    sfxUi(560, 0.05);
    if (s !== "match" && eng) { stopAmbience(); setEng(null); setMatchMeta(null); }
  };

  const ctx: AppCtx = {
    world: world!, career: world?.career ?? null, screen, settings, setSettings,
    commit, nav, toast: (m) => setToast(m),
    startCareer: (clubId, quick) => {
      if (!world) return;
      const c = newCareer(world, clubId, quick, world.clubs[clubId].name + " Arena");
      world.career = c;
      saveWorld(world);
      force((v) => v + 1);
      setScreen("home");
      setToast(quick ? "Hızlı maç hazırlanıyor!" : "Kariyer başladı — hedef şampiyonluk!");
      sfxWhistle();
      if (quick) window.setTimeout(() => { startMatch(); window.setTimeout(() => simMatch(), 350); }, 250);
    },
    resetSave: () => {
      clearSave();
      const w = generateWorld(Math.floor(Math.random() * 1e9) + 11);
      setWorld(w);
      setScreen("teamselect");
      setToast("Kayıt silindi — yeni dünyalar üretildi");
    },
    playMatch: (sim: boolean) => {
      startMatch();
      if (sim) window.setTimeout(() => simMatch(), 260);
    },
  };

  if (!booted) {
    return <Boot onStart={() => { setBooted(true); sfxUi(880); }} />;
  }
  if (!world) {
    return <div className="w-full h-full flex items-center justify-center text-emerald-300">Dünya üretiliyor…</div>;
  }
  if (portrait) {
    return <RotateWarning />;
  }

  /* ---------------- MAÇ KURULUMU ---------------- */
  const startMatch = (): void => {
    const c = world.career;
    if (!c) return;
    if (c.lineup.length < 11 || c.lineup.some((id) => !world.players[id] || world.players[id].injury > 0)) {
      reautoLineup(world, c);
    }
    // GÜVENCE: ilk 11 mutlaka 11 kişi (eksik kalırsa motor formasyonu kayardı)
    if (c.lineup.length < 11) {
      const sq = squadOf(world, c.clubId).filter((p) => p.injury === 0);
      for (const p of sq) {
        if (c.lineup.length >= 11) break;
        if (!c.lineup.includes(p.id)) c.lineup.push(p.id);
      }
      saveWorld(world);
    }
    const tie = userCupTie(c);
    const fx = userFixture(c);
    let homeId: string, awayId: string;
    if (tie) {
      homeId = tie.homeId;
      awayId = tie.awayId;
    } else if (fx) {
      homeId = fx.homeId;
      awayId = fx.awayId;
    } else {
      setToast("Bu hafta maçın yok — sezon tamamlandı.");
      return;
    }
    const userTeam: 0 | 1 = homeId === c.clubId ? 0 : 1;
    const b = bonusesOf(c);

    const oppId = userTeam === 0 ? awayId : homeId;
    const oppClub = world.clubs[oppId];
    const oppSquad = squadOf(world, oppId);
    const oppForm = oppClub.rating >= 80 ? "f433" : oppClub.rating >= 75 ? "f4231" : "f442";
    const oppLU = autoLineup(oppSquad, oppForm);
    const diffBoost = (settings.difficulty - 2) * 1.4;

    const userSetup: TeamSetup = {
      club: world.clubs[c.clubId],
      lineup: c.lineup.map((id) => world.players[id]).filter(Boolean),
      subs: c.subs.map((id) => world.players[id]).filter(Boolean),
      tactic: c.tactic,
      boost: b.teamBoost + (userTeam === 0 ? b.homeAdv : 0),
      drain: b.staminaDrain,
      homeAdv: userTeam === 0 ? b.homeAdv : 0,
    };
    const oppSetup: TeamSetup = {
      club: oppClub,
      lineup: oppLU.lineup.map((id) => world.players[id]).filter(Boolean),
      subs: oppLU.subs.map((id) => world.players[id]).filter(Boolean),
      tactic: {
        formation: oppForm,
        mentality: clampN(46 + (oppClub.rating - clubPower(world, c.clubId, c.lineup)) * 0.55 + 12, 25, 80),
        pressing: clampN(40 + (oppClub.rating - 70) * 1.2, 25, 85),
        width: 50, lineHeight: 48, tempo: 52,
        passing: oppClub.rating > 78 ? "short" : "mixed",
      },
      boost: 0.4 + diffBoost + (userTeam === 1 ? 0.14 : 0),
      drain: 1,
      homeAdv: userTeam === 1 ? 0.14 : 0,
    };

    const engine = new MatchEngine(
      userTeam === 0 ? userSetup : oppSetup,
      userTeam === 0 ? oppSetup : userSetup,
      settings, !!tie,
      (e) => {
        switch (e.kind) {
          case "kick": sfxKick(e.power ?? 0.6); break;
          case "tackle": sfxKick(0.45); if (settings.haptics) vibrate(12); break;
          case "save": sfxSave(); break;
          case "miss": sfxMiss(); break;
          case "goal": sfxGoal(); if (settings.haptics) vibrate(30); break;
          case "whistle": sfxWhistle(e.kind === "whistle"); break;
          case "card": sfxWhistle(false); break;
          case "sub": sfxSub(); break;
          default: break;
        }
      },
      Math.floor(Math.random() * 1e9),
    );
    engine.userTeam = userTeam;
    engine.controlled = engine.teams[userTeam].mps.filter((m) => !m.isGK)[6] ?? engine.teams[userTeam].mps[0];
    setEng(engine);
    setMatchMeta({ homeId, awayId, cupMode: !!tie, userTeam });
    setScreen("match");
    startAmbience();
    sfxWhistle();
  };

  const finishMatch = (r: MatchResult): void => {
    const c = world.career;
    if (!c || !matchMeta) { nav("home"); return; }
    const isHomeUser = matchMeta.userTeam === 0;
    const my = isHomeUser ? r.hg : r.ag;
    const opp = isHomeUser ? r.ag : r.hg;
    const res: "W" | "D" | "L" = my > opp ? "W" : my === opp ? "D" : "L";
    const rw = matchReward(c, res, my, opp, matchMeta.cupMode);
    c.budget += rw.income;
    c.gold += rw.gold;
    c.diamonds += rw.diamonds;
    if (matchMeta.cupMode && res === "W") c.diamonds += 1;
    addManagerXp(c, rw.xp);
    bumpObjective(c, "upgrade", 0);
    commitResult(world, c, r);
    saveWorld(world);
    stopAmbience();
    setFrozen(false);
    setEng(null);
    setMatchMeta(null);
    setReward({
      title: res === "W" ? "GALİBİYET! 🎉" : res === "D" ? "BERABERLİK ➖" : "MAĞLUBİYET ❌",
      lines: rw.lines,
    });
    setScreen("home");
    force((v) => v + 1);
  };

  const simMatch = (): void => {
    if (!eng) return;
    setFrozen(true);
    const chunk = (): void => {
      const t0 = performance.now();
      while (eng.phase !== "fulltime" && eng.phase !== "pens" && performance.now() - t0 < 80) {
        if (eng.phase === "halftime") eng.resumeSecondHalf();
        eng.step();
        eng.step();
      }
      if (eng.phase === "fulltime" || eng.phase === "pens") {
        setFrozen(false);
        return;
      }
      setAmbienceLevel(0.4);
      simRef.current = window.setTimeout(chunk, 0);
    };
    chunk();
  };

  /* ---------------- KENDİ TAKIMINI KUR ---------------- */
  if (screen === "createteam") {
    return (
      <CreateTeamScreen
        world={world}
        onCancel={() => nav("teamselect")}
        onDone={(draft) => {
          const club = createCustomClub(world, { ...draft, name: draft.name.trim() || "Takımım" });
          saveWorld(world);
          force((v) => v + 1);
          setScreen("teamselect");
          setToast(`${club.name} kuruldu! Artık bu takımla oynuyorsun.`);
          sfxWhistle();
          // isim girildikten sonra doğrudan bu takımla kariyer başlar
          window.setTimeout(() => ctx.startCareer(club.id, false), 420);
        }}
      />
    );
  }

  const club = world.career ? world.clubs[world.career.clubId] : null;

  /* ---------------- render ---------------- */
  if (screen === "match" && eng && matchMeta) {
    return (
      <>
        <MatchScreen
          eng={eng}
          home={world.clubs[matchMeta.homeId]}
          away={world.clubs[matchMeta.awayId]}
          settings={settings}
          levels={{
            stands: world.career?.stadium.levels.stands ?? 2,
            pitch: world.career?.stadium.levels.pitch ?? 2,
            lights: world.career?.stadium.levels.lights ?? 1,
            screen: world.career?.stadium.levels.screen ?? 1,
          }}
          cupMode={matchMeta.cupMode}
          frozen={frozen}
          onCamera={(c: CameraId) => setSettings((s) => ({ ...s, camera: c }))}
          onFinish={finishMatch}
          onExit={() => { setFrozen(true); simMatch(); }}
          onSim={simMatch}
        />
        {frozen && (
          <div className="fixed inset-0 z-[60] bg-black/70 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-[13px] font-black txt-neon mb-2">MAÇ SİMÜLE EDİLİYOR…</div>
            <div className="w-[220px]"><Bar v={70} color="emerald" h={6} /></div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="w-full h-full flex app-bg overflow-hidden">
      {/* sol rota */}
      <div className="w-[60px] shrink-0 flex flex-col items-stretch py-1 gap-px bg-gradient-to-b from-black/85 via-black/60 to-black/85 scan shadow-[inset_-1px_0_0_rgba(120,170,220,0.12)]">
        {RAIL.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => nav(r.id)}
            className={cx("rail-item w-full", screen === r.id && "rail-item-on")}
          >
            <span className="text-[15px] leading-none">{r.icon}</span>
            <span>{r.label}</span>
          </button>
        ))}
        <div className="mt-auto mx-auto text-[7px] text-slate-700 rotate-180 tracking-[0.3em]" style={{ writingMode: "vertical-rl" }}>
          BYMEL SOFTWARE
        </div>
      </div>

      {/* içerik */}
      <div className="flex-1 min-w-0 flex flex-col relative">
        {club && world.career && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 shrink-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent shadow-[inset_0_-1px_0_rgba(120,170,220,0.14)]">
            <Crest club={club} size={24} />
            <span className="text-[12px] font-black tracking-tight truncate">{club.name}</span>
            <span className="tag bg-white/8 text-slate-400">S{world.career.season} · H{world.career.round}</span>
            <div className="ml-auto flex items-center gap-1">
              <span className="chip !text-[9px] text-emerald-300 border-emerald-400/30">💶 {(world.career.budget / 1000).toFixed(1)}Mn</span>
              <span className="chip !text-[9px] text-amber-300 border-amber-400/30">🪙 {world.career.gold.toLocaleString("tr-TR")}</span>
              <span className="chip !text-[9px] text-cyan-300 border-cyan-400/30">💎 {world.career.diamonds}</span>
            </div>
          </div>
        )}
        <div className="flex-1 min-h-0 relative">
          {screen === "home" && <HomeScreen ctx={ctx} />}
          {screen === "teamselect" && <TeamSelectScreen ctx={ctx} />}
          {screen === "squad" && (world.career ? <SquadScreen ctx={ctx} /> : <Empty text="Önce bir kulüp seç" />)}
          {screen === "tactics" && (world.career ? <TacticsScreen ctx={ctx} /> : <Empty text="Önce bir kulüp seç" />)}
          {screen === "transfers" && (world.career ? <TransferScreen ctx={ctx} /> : <Empty text="Önce bir kulüp seç" />)}
          {screen === "contracts" && (world.career ? <ContractsScreen ctx={ctx} /> : <Empty text="Önce bir kulüp seç" />)}
          {screen === "table" && (world.career ? <LeagueScreen ctx={ctx} /> : <Empty text="Önce bir kulüp seç" />)}
          {screen === "stats" && <StatsScreen ctx={ctx} />}
          {screen === "stadium" && (world.career ? <StadiumScreen ctx={ctx} /> : <Empty text="Önce bir kulüp seç" />)}
          {screen === "manager" && (world.career ? <ManagerScreen ctx={ctx} /> : <Empty text="Önce bir kulüp seç" />)}
          {screen === "shop" && (world.career ? <ShopScreen ctx={ctx} /> : <Empty text="Önce bir kulüp seç" />)}
          {screen === "settings" && <SettingsScreen ctx={ctx} />}

          {world.career && screen !== "match" && (
            <div className="absolute right-2 bottom-2">
              <Btn variant="primary" shine onClick={startMatch}>⚽ MAÇA ÇIK</Btn>
            </div>
          )}
        </div>
      </div>

      {reward && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-3" onClick={() => setReward(null)}>
          <div className="panel-hi !rounded-2xl p-4 min-w-[300px] anim-pop" onClick={(e) => e.stopPropagation()}>
            <div className="text-[16px] font-black txt-neon text-center mb-2">{reward.title}</div>
            <div className="space-y-0.5 mb-3">
              {reward.lines.map((l, i) => (
                <div key={i} className="text-[10px] text-slate-300">{l}</div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Btn variant="dark" onClick={() => setReward(null)}>Kapat</Btn>
              <Btn variant="primary" onClick={() => { setReward(null); nav("home"); }}>Devam</Btn>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-3 z-[70] anim-up">
          <div className="panel-hi !rounded-xl px-3 py-1.5 text-[10px] font-bold">{toast}</div>
        </div>
      )}
    </div>
  );
}

function clampN(v: number, a: number, b: number): number { return v < a ? a : v > b ? b : v; }
