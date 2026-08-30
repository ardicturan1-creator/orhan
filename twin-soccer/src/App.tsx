import { useCallback, useEffect, useState } from "react";
import MatchScreen, { DIFFICULTIES, type TeamSetup } from "./components/MatchScreen";
import { OrientationGate, Splash, StartGate } from "./components/Boot";
import {
  HomeScreen, LeagueScreen, SettingsScreen, SquadScreen, StatsScreen,
  TacticsScreen, TeamSelectScreen, type ScreenProps,
} from "./components/screens";
import { ContractsScreen, ManagerScreen, ShopScreen, StadiumScreen, TransferScreen } from "./components/screens2";
import { CLUB_MAP, clubsOfLeague } from "./game/data/clubs";
import { FORMATIONS, overall } from "./game/formations";
import {
  advance, commitResult, defaultTactic, endSeason, leagueTable, newCareer, nextMatch, seasonEnded,
} from "./game/career";
import { applyReward, matchReward, xpForLevel, type Reward } from "./game/economy";
import { simMatch, initBrain } from "./game/brain";
import {
  autoLineup, clearStorage, decodeWorld, encodeWorld, generateWorld, loadFromStorage, saveToStorage,
} from "./game/world";
import { sfx } from "./game/audio";
import { Bar, Btn, Card, Coin, Crest, Gem, Header, SectionTitle, cx, compact, money } from "./components/ui";
import type { Career, MatchResult, MatchSettings, Screen, World } from "./game/types";

interface SaveData {
  v: number;
  world: ReturnType<typeof encodeWorld>;
  career: Career | null;
  settings: MatchSettings;
}

interface MatchSetup {
  home: TeamSetup;
  away: TeamSetup;
  competition: string;
  cup: boolean;
  kind: "quick" | "league" | "cup";
}

const DEFAULT_SETTINGS: MatchSettings = {
  minutes: 4,
  difficulty: 2,
  sound: true,
  offside: true,
  autoSwitch: true,
  camera: "broadcast",
  assist: 1,
  quality: 2,
  haptics: true,
  commentary: true,
  faikMode: false,
};

function cpuFormation(clubId: string) {
  const idx = Math.abs(clubId.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % FORMATIONS.length;
  return FORMATIONS[idx].id;
}

const NAV: { id: Screen; icon: string; label: string }[] = [
  { id: "home", icon: "🏠", label: "Menü" },
  { id: "fixtures", icon: "🏆", label: "Lig" },
  { id: "squad", icon: "👥", label: "Kadro" },
  { id: "tactics", icon: "📋", label: "Taktik" },
  { id: "transfers", icon: "💰", label: "Transfer" },
  { id: "contracts", icon: "📄", label: "Sözleşme" },
  { id: "stadium", icon: "🏟️", label: "Stadyum" },
  { id: "manager", icon: "🧠", label: "Menajer" },
  { id: "shop", icon: "🛒", label: "Mağaza" },
  { id: "stats", icon: "📊", label: "İstatistik" },
  { id: "settings", icon: "⚙️", label: "Ayarlar" },
];

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const [booted, setBooted] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [world, setWorld] = useState<World>(() => generateWorld(20260214));
  const [career, setCareer] = useState<Career | null>(null);
  const [settings, setSettings] = useState<MatchSettings>(DEFAULT_SETTINGS);
  const [match, setMatch] = useState<MatchSetup | null>(null);
  const [lastResult, setLastResult] = useState<MatchResult | null>(null);
  const [lastReward, setLastReward] = useState<Reward | null>(null);
  const [seasonSummary, setSeasonSummary] = useState<null | { pos: number; pts: number; money: number; trophy: boolean }>(null);
  const [toast, setToast] = useState("");

  /* ---------------- kayıt / yükleme ---------------- */
  useEffect(() => {
    const s = loadFromStorage<SaveData>();
    if (s && s.world) {
      try {
        setWorld(decodeWorld(s.world));
        setCareer(s.career ?? null);
        setSettings({ ...DEFAULT_SETTINGS, ...(s.settings ?? {}) });
      } catch {
        /* bozuk kayıt yok sayılır */
      }
    }
  }, []);

  useEffect(() => {
    if (!booted) return;
    saveToStorage({ v: 2, world: encodeWorld(world), career, settings } satisfies SaveData);
  }, [world, career, settings, booted]);

  const go = useCallback((s: Screen) => {
    setScreen(s);
    sfx.play("ui");
  }, []);

  const showToast = useCallback((t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(""), 1900);
  }, []);

  /* ---------------- kariyer / maç kurulumları ---------------- */
  const startCareer = (clubId: string) => {
    const c = newCareer(world, clubId);
    setCareer(c);
    go("home");
    showToast(`${CLUB_MAP[clubId].name} teknik direktörüsün!`);
  };

  const buildSetup = (
    homeId: string, awayId: string, userClubId: string,
    comp: string, cup: boolean, kind: MatchSetup["kind"]
  ): MatchSetup => {
    const mk = (clubId: string, isUser: boolean): TeamSetup => {
      if (isUser && career) {
        return { clubId, lineup: career.lineup, subs: career.subs, tactic: { ...career.tactic }, isUser: true };
      }
      const form = cpuFormation(clubId);
      const a = autoLineup(world, clubId, form);
      return {
        clubId,
        lineup: a.lineup,
        subs: a.subs,
        tactic: { ...defaultTactic(form), mentality: 50 + Math.round(Math.random() * 20) },
        isUser: false,
      };
    };
    return { home: mk(homeId, homeId === userClubId), away: mk(awayId, awayId === userClubId), competition: comp, cup, kind };
  };

  const startQuick = (homeId: string, awayId: string) => {
    setMatch(buildSetup(homeId, awayId, homeId, "Hazır Maç", false, "quick"));
    go("match");
  };

  const startCareerMatch = () => {
    if (!career) return;
    const nm = nextMatch(world, career);
    if (!nm) return;
    setMatch(buildSetup(nm.home, nm.away, career.clubId, nm.label, nm.kind === "cup", nm.kind));
    go("match");
  };

  const simulateUserMatch = () => {
    if (!career) return;
    const nm = nextMatch(world, career);
    if (!nm) {
      // sezon sonu
      checkSeasonEnd();
      setCareer({ ...career });
      return;
    }
    const hr = CLUB_MAP[nm.home].rating;
    const ar = CLUB_MAP[nm.away].rating;
    const r = simMatch(hr, ar, nm.home === career.clubId ? 1 : 0.85);
    const res: MatchResult = {
      homeClubId: nm.home,
      awayClubId: nm.away,
      hg: r.hg,
      ag: r.ag,
      stats: {
        possession: [50, 50], shots: [r.hg * 3, r.ag * 3], onTarget: [r.hg, r.ag], passes: [380, 360],
        passAcc: [80, 79], corners: [4, 3], fouls: [11, 12], offside: [2, 1], tackles: [14, 15], saves: [r.ag, r.hg],
      },
      scorers: [],
      ratings: Object.fromEntries(career.lineup.map((id) => [id, 6.2 + Math.random() * 1.2])),
      motm: null,
      cards: [],
    };
    if (nm.kind === "cup" && res.hg === res.ag) {
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
    }
    completeMatch(res, nm.kind);
  };

  const completeMatch = (res: MatchResult, kind: "league" | "cup") => {
    if (!career) return;
    const reward = matchReward(career, res, kind === "cup");
    commitResult(world, career, res);
    applyReward(career, reward);
    advance(world, career, kind);
    checkSeasonEnd();
    setLastResult(res);
    setLastReward(reward);
    setCareer({ ...career });
    setWorld({ ...world });
    setMatch(null);
    go("postmatch");
  };

  const checkSeasonEnd = () => {
    if (!career) return;
    if (seasonEnded(career)) {
      const table = leagueTable(career);
      const pos = table.findIndex((t) => t.clubId === career.clubId) + 1;
      const row = table[pos - 1];
      const before = career.budget;
      endSeason(world, career);
      setSeasonSummary({ pos, pts: row?.pts ?? 0, money: career.budget - before, trophy: pos === 1 });
    }
  };

  const onMatchFinish = (res: MatchResult) => {
    if (career && match && match.kind !== "quick") {
      completeMatch(res, match.kind);
    } else {
      setLastResult(res);
      setLastReward(null);
      setMatch(null);
      go("postmatch");
    }
  };

  /* ---------------- ekran yönlendirme ---------------- */
  const props: ScreenProps = {
    world,
    career,
    settings,
    defaultTab: screen === "fixtures" ? "fixtures" : undefined,
    go,
    setCareer: (c) => setCareer(c && { ...c }),
    setWorld: (w) => setWorld({ ...w }),
    setSettings,
    startCareer,
    startQuick,
    playMatch: startCareerMatch,
    simulateMatch: simulateUserMatch,
    toast: showToast,
    resetAll: () => {
      clearStorage();
      setCareer(null);
      setWorld(generateWorld(Date.now() % 100000));
      go("home");
      showToast("Kayıt silindi");
    },
  };

  const content = (() => {
    switch (screen) {
      case "teamselect": return <TeamSelectScreen {...props} />;
      case "squad": return <SquadScreen {...props} />;
      case "tactics": return <TacticsScreen {...props} />;
      case "transfers": return <TransferScreen {...props} />;
      case "contracts": return <ContractsScreen {...props} />;
      case "stadium": return <StadiumScreen {...props} />;
      case "manager": return <ManagerScreen {...props} />;
      case "shop": return <ShopScreen {...props} />;
      case "table":
      case "fixtures": return <LeagueScreen {...props} />;
      case "stats": return <StatsScreen {...props} />;
      case "settings": return <SettingsScreen {...props} />;
      case "postmatch":
        return (
          <PostMatch
            result={lastResult}
            reward={lastReward}
            career={career}
            world={world}
            onDone={() => go("home")}
          />
        );
      default: return <HomeScreen {...props} />;
    }
  })();

  /* ---------------- açılış ---------------- */
  if (!splashDone) return <Splash onDone={() => setSplashDone(true)} />;

  if (!booted) {
    return (
      <StartGate
        subtitle={`${clubsOfLeague("sl").length * 4} kulüp · ${Object.keys(world.players).length} oyuncu`}
        onStart={() => {
          initBrain();
          sfx.enabled = settings.sound;
          sfx.unlock();
          setBooted(true);
        }}
      />
    );
  }

  const showRail = career && screen !== "match" && screen !== "teamselect";

  return (
    <div className="app-bg fixed inset-0 flex overflow-hidden">
      <OrientationGate />

      {/* ---------- sol navigasyon ---------- */}
      {showRail && (
        <div className="rail safe-l safe-t safe-b flex w-[58px] shrink-0 flex-col items-center py-1.5">
          <div className="mb-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-400/30 to-emerald-700/10 text-sm">
            ⚽
          </div>
          <div className="scroll-y flex w-full flex-1 flex-col items-center gap-0.5">
            {NAV.map((n) => {
              const active = screen === n.id || (n.id === "fixtures" && screen === "table");
              return (
                <button
                  key={n.id}
                  onClick={() => go(n.id)}
                  className={cx(
                    "btn-press relative w-[50px] shrink-0 rounded-lg py-1 text-center",
                    active ? "bg-emerald-400/18" : ""
                  )}
                >
                  {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-emerald-400" />}
                  <div className="text-[15px] leading-none">{n.icon}</div>
                  <div className={cx("text-[7px] font-black leading-tight", active ? "text-emerald-300" : "text-white/40")}>
                    {n.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------- içerik ---------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {showRail && career && <TopBar career={career} onShop={() => go("shop")} />}
        <div className="min-h-0 flex-1">{content}</div>
      </div>

      {/* ---------- bildirim ---------- */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
          <div className="glass rounded-xl px-4 py-2 text-xs font-black text-emerald-200 anim-up">{toast}</div>
        </div>
      )}

      {/* ---------- sezon özeti ---------- */}
      {seasonSummary && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/85 p-6 anim-fade">
          <Card hi className="w-full max-w-sm text-center anim-pop">
            <div className="text-5xl">{seasonSummary.trophy ? "🏆" : "🏁"}</div>
            <div className="mt-2 text-lg font-black">{seasonSummary.trophy ? "ŞAMPİYON!" : "SEZON BİTTİ"}</div>
            <div className="mt-1 text-[11px] text-white/50">
              {career ? career.season - 1 : ""}. sezon · {seasonSummary.pos}. sıra · {seasonSummary.pts} puan
            </div>
            <div className="my-3 rounded-xl bg-white/5 p-3 text-sm font-black text-emerald-300">
              Prim: {money(seasonSummary.money)}
            </div>
            <Btn
              variant="primary"
              className="w-full"
              onClick={() => {
                setSeasonSummary(null);
                go("home");
              }}
            >
              Yeni Sezona Geç
            </Btn>
          </Card>
        </div>
      )}

      {/* ---------- maç ---------- */}
      {match && (
        <MatchScreen
          world={world}
          home={match.home}
          away={match.away}
          settings={settings}
          competition={match.competition}
          cup={match.cup}
          career={match.kind === "quick" ? null : career}
          onFinish={onMatchFinish}
          onQuit={() => {
            setMatch(null);
            go("home");
          }}
        />
      )}
    </div>
  );
}

/* ============================ ÜST BAR ============================ */
function TopBar({ career, onShop }: { career: Career; onShop: () => void }) {
  const club = CLUB_MAP[career.clubId];
  return (
    <div className="safe-t safe-r flex shrink-0 items-center gap-2 border-b border-white/8 bg-[#070d12]/80 px-2.5 py-1 backdrop-blur">
      <Crest club={club} size={22} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-black leading-none">{club.name}</div>
        <div className="text-[8px] text-white/35">
          {career.season}. Sezon · {career.round + 1}. Hafta · Sv.{career.manager.level}
        </div>
      </div>
      <button onClick={onShop} className="btn-press flex items-center gap-1.5">
        <span className="flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-400/12 px-2 py-0.5 text-[10px] font-black text-emerald-200 tabnum">
          💶 {money(career.budget)}
        </span>
        <span className="flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-400/12 px-2 py-0.5 text-[10px] font-black text-amber-200 tabnum">
          🪙 {compact(career.gold)}
        </span>
        <span className="flex items-center gap-1 rounded-full border border-cyan-300/25 bg-cyan-400/12 px-2 py-0.5 text-[10px] font-black text-cyan-200 tabnum">
          💎 {compact(career.diamonds)}
        </span>
        <span className="grid h-5 w-5 place-items-center rounded-md bg-white/10 text-[10px]">＋</span>
      </button>
    </div>
  );
}

/* ============================ MAÇ SONRASI ============================ */
function PostMatch({
  result,
  reward,
  career,
  world,
  onDone,
}: {
  result: MatchResult | null;
  reward: Reward | null;
  career: Career | null;
  world: World;
  onDone: () => void;
}) {
  if (!result) {
    return (
      <div className="flex h-full flex-col">
        <Header title="Maç" onBack={onDone} />
        <div className="p-6 text-center text-sm text-white/50">Sonuç bulunamadı.</div>
      </div>
    );
  }
  const h = CLUB_MAP[result.homeClubId];
  const a = CLUB_MAP[result.awayClubId];
  const userHome = career ? result.homeClubId === career.clubId : true;
  const userGoals = userHome ? result.hg : result.ag;
  const oppGoals = userHome ? result.ag : result.hg;
  const verdict = userGoals > oppGoals ? "KAZANDIN!" : userGoals === oppGoals ? "BERABERE" : "KAYBETTİN";
  const table = career ? leagueTable(career) : [];
  const pos = table.findIndex((t) => t.clubId === career?.clubId) + 1;
  const motm = result.motm ? world.players[result.motm] : null;

  return (
    <div className="flex h-full flex-col">
      <Header title="Maç Sonucu" sub={career ? `${career.season}. Sezon` : "Hazır Maç"} onBack={onDone} />
      <div className="scroll-y flex-1 p-3">
        <div className="grid gap-3 md:grid-cols-3">
          <Card hi className="md:col-span-2">
            <div
              className={cx(
                "text-center text-lg font-black",
                verdict === "KAZANDIN!" ? "text-emerald-300" : verdict === "BERABERE" ? "text-amber-300" : "text-rose-400"
              )}
            >
              {verdict}
            </div>
            <div className="mt-2 flex items-center justify-center gap-4">
              <div className="flex flex-1 flex-col items-end gap-1">
                <Crest club={h} size={40} />
                <div className="text-[11px] font-black">{h.short}</div>
              </div>
              <div className="tabnum text-4xl font-black">
                {result.hg} - {result.ag}
              </div>
              <div className="flex flex-1 flex-col items-start gap-1">
                <Crest club={a} size={40} />
                <div className="text-[11px] font-black">{a.short}</div>
              </div>
            </div>
            {result.pens && (
              <div className="mt-1 text-center text-[11px] font-black text-amber-300">
                Penaltılar: {result.pens[0]} - {result.pens[1]}
              </div>
            )}
            {motm && (
              <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-white/5 p-2">
                <span className="text-[10px] text-white/40">MAÇIN ADAMI</span>
                <span className="text-sm font-black">{motm.name}</span>
                <span className="text-[11px] font-black text-emerald-300">{overall(motm)}</span>
              </div>
            )}
            {result.scorers.length > 0 && (
              <div className="mt-3">
                <SectionTitle>GOLLER</SectionTitle>
                <div className="grid gap-1 sm:grid-cols-2">
                  {result.scorers.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-white/4 px-2 py-1 text-[11px]">
                      <span className="tabnum text-white/40">{s.minute}'</span>
                      <span className="flex-1 truncate font-bold">{world.players[s.playerId]?.name ?? "?"}</span>
                      <span className="text-white/35">{CLUB_MAP[s.clubId]?.short}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <div className="space-y-3">
            {reward && career && (
              <Card>
                <SectionTitle>KAZANIMLAR</SectionTitle>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <Coin value={reward.gold} size="md" />
                  {reward.diamonds > 0 && <Gem value={reward.diamonds} size="md" />}
                  <div className="flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-400/12 px-3 py-1 text-sm font-black text-emerald-200">
                    💶 {money(reward.money)}
                  </div>
                </div>
                <div className="space-y-0.5">
                  {reward.lines.map((l, i) => (
                    <div key={i} className="rounded bg-white/4 px-2 py-1 text-[10px] text-white/60">{l}</div>
                  ))}
                </div>
                <div className="mt-2">
                  <div className="mb-1 flex justify-between text-[10px] font-bold text-white/45">
                    <span>MENAJER SV.{career.manager.level}</span>
                    <span className="tabnum">+{reward.xp} XP</span>
                  </div>
                  <Bar value={(career.manager.xp / xpForLevel(career.manager.level)) * 100} height={5} />
                </div>
              </Card>
            )}

            {career && (
              <Card>
                <SectionTitle right={<span className="text-[10px] font-black text-emerald-300">{pos}. sıra</span>}>
                  PUAN DURUMU
                </SectionTitle>
                {table.slice(0, 6).map((r, i) => (
                  <div
                    key={r.clubId}
                    className={cx(
                      "flex items-center gap-2 rounded-lg px-1 py-1 text-[11px]",
                      r.clubId === career.clubId && "bg-emerald-400/15"
                    )}
                  >
                    <span className="w-4 tabnum text-white/35">{i + 1}</span>
                    <Crest club={CLUB_MAP[r.clubId]} size={16} />
                    <span className="flex-1 truncate font-bold">{CLUB_MAP[r.clubId].short}</span>
                    <span className="tabnum font-black text-emerald-300">{r.pts}</span>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </div>

        <Btn variant="primary" size="lg" className="mt-3 w-full" onClick={onDone}>
          Devam Et →
        </Btn>
      </div>
    </div>
  );
}

export { DIFFICULTIES };
