import { useMemo, useState } from "react";
import { CLUBS, CLUB_MAP, LEAGUES, clubsOfLeague } from "../game/data/clubs";
import { FORMATIONS, FORMATION_MAP, overall, attrAtPos } from "../game/formations";
import { CUP_AFTER_ROUND, leagueTable, nextMatch } from "../game/career";
import { bonusesOf, claimObjective, stadiumCapacity, xpForLevel } from "../game/economy";
import { autoLineup } from "../game/world";
import { lookOf } from "../game/look";
import {
  Bar, Btn, Card, Crest, Header, KitIcon, LevelDots, OvrBadge,
  SectionTitle, Sheet, Tabs, Toggle, cx, money,
} from "./ui";
import { TacticPanel } from "./MatchScreen";
import { DIFFICULTIES } from "./MatchScreen";
import { CAMERA_LABELS } from "../game/render3d";
import type { CameraId, Career, MatchSettings, Player, Screen, TeamTactic, World } from "../game/types";

export interface ScreenProps {
  world: World;
  career: Career | null;
  settings: MatchSettings;
  defaultTab?: string;
  go: (s: Screen) => void;
  setCareer: (c: Career | null) => void;
  setWorld: (w: World) => void;
  setSettings: (s: MatchSettings) => void;
  startCareer: (clubId: string) => void;
  startQuick: (homeId: string, awayId: string) => void;
  playMatch: () => void;
  simulateMatch: () => void;
  toast: (t: string) => void;
  resetAll: () => void;
}

/* ============================ ORTAK PARÇALAR ============================ */

export function Page({ children, title, sub, onBack, right }: {
  children: React.ReactNode;
  title: string;
  sub?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <Header title={title} sub={sub} onBack={onBack} right={right} />
      <div className="scroll-y flex-1 p-3">{children}</div>
    </div>
  );
}

function FaceChip({ player, size = 34 }: { player: Player; size?: number }) {
  const l = lookOf(player);
  const skin = ["#f6d5b8", "#eec092", "#d69f6e", "#a9713f", "#6f4523"][l.skin];
  const hair = ["#1b1410", "#2f2016", "#573520", "#8b5a2b", "#c9a227", "#9aa0a6"][l.hairColor];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0">
      <circle cx="20" cy="20" r="19" fill="rgba(255,255,255,0.06)" />
      <circle cx="20" cy="22" r="12" fill={skin} />
      {l.hair !== 5 && (
        <path
          d={l.hair === 2 ? "M6 20 A14 14 0 0 1 34 20 A14 11 0 0 0 6 20 Z" : "M8 20 A12 12 0 0 1 32 20 L32 17 A12 10 0 0 0 8 17 Z"}
          fill={hair}
        />
      )}
      <circle cx="16" cy="21" r="1.6" fill="#141010" />
      <circle cx="24" cy="21" r="1.6" fill="#141010" />
      {l.beard > 1 && <path d="M11 25 A9 8 0 0 0 29 25 A9 11 0 0 1 11 25 Z" fill={hair} opacity="0.75" />}
      <path d="M16 27 Q20 30 24 27" stroke="#8c4a44" strokeWidth="1.2" fill="none" />
    </svg>
  );
}
export { FaceChip };

/* ============================ ANA MENÜ ============================ */
export function HomeScreen(p: ScreenProps) {
  const { career, world } = p;
  if (!career) return <NoCareer {...p} />;
  const club = CLUB_MAP[career.clubId];
  const table = leagueTable(career);
  const pos = table.findIndex((t) => t.clubId === career.clubId) + 1;
  const squad = Object.values(world.players).filter((x) => x.teamId === career.clubId);
  const avg = squad.length ? Math.round(squad.slice(0, 11).reduce((s, x) => s + overall(x), 0) / Math.min(11, squad.length)) : 0;
  const nm = nextMatch(world, career);
  const bon = bonusesOf(career);
  const lineup = career.lineup.map((id) => world.players[id]).filter(Boolean);
  const teamOvr = lineup.length ? Math.round(lineup.reduce((s, x) => s + overall(x), 0) / lineup.length + bon.teamBoost) : avg;
  const done = career.objectives.filter((o) => o.progress >= o.goal && !o.claimed).length;

  return (
    <div className="scroll-y h-full p-3">
      {/* kulüp başlığı */}
      <div className="panel-hi mb-3 overflow-hidden rounded-2xl">
        <div
          className="relative flex items-center gap-3 p-3"
          style={{ background: `linear-gradient(100deg, ${club.kit.primary}30, transparent 65%)` }}
        >
          <Crest club={club} size={56} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-black leading-tight">{club.name}</div>
            <div className="text-[11px] text-white/50">
              {club.city} · {career.season}. Sezon · {career.round + 1}. Hafta
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] font-black text-emerald-300">
                {pos}. SIRA
              </span>
              <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] font-black">GÜÇ {teamOvr}</span>
              <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] font-black text-amber-200">
                🏆 {career.trophies.length}
              </span>
              {career.streak > 1 && (
                <span className="rounded-md bg-orange-400/15 px-1.5 py-0.5 text-[10px] font-black text-orange-300">
                  🔥 {career.streak} SERİ
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {/* sonraki maç */}
        <div className="md:col-span-2">
          <Card className="mb-3">
            <SectionTitle right={<span className="text-[10px] font-bold text-emerald-300">{nm?.label ?? "Sezon sonu"}</span>}>
              SONRAKİ MAÇ
            </SectionTitle>
            {nm ? (
              <>
                <div className="flex items-center justify-between gap-2 py-1">
                  <TeamMini clubId={nm.home} you={nm.home === career.clubId} />
                  <div className="text-center">
                    <div className="text-2xl font-black text-white/25">VS</div>
                    <div className="text-[9px] font-black text-white/40">{nm.kind === "cup" ? "KUPA" : "LİG"}</div>
                  </div>
                  <TeamMini clubId={nm.away} you={nm.away === career.clubId} right />
                </div>
                <div className="mt-3 flex gap-2">
                  <Btn variant="primary" size="lg" className="flex-1 shine" onClick={p.playMatch}>
                    ⚽ MAÇA ÇIK
                  </Btn>
                  <Btn variant="dark" onClick={() => p.go("tactics")}>📋</Btn>
                  <Btn variant="dark" onClick={p.simulateMatch}>⏩</Btn>
                </div>
              </>
            ) : (
              <div className="py-3 text-center">
                <div className="text-sm font-bold">Sezon tamamlandı</div>
                <Btn variant="primary" className="mt-2 w-full" onClick={p.simulateMatch}>
                  Sezonu Kapat
                </Btn>
              </div>
            )}
          </Card>

          {/* hızlı erişim */}
          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {([
              ["squad", "👥", "Kadro"],
              ["tactics", "📋", "Taktik"],
              ["transfers", "💰", "Transfer"],
              ["contracts", "📄", "Sözleşme"],
              ["stadium", "🏟️", "Stadyum"],
              ["manager", "🧠", "Menajer"],
            ] as [Screen, string, string][]).map(([id, icon, label]) => (
              <button
                key={id}
                onClick={() => p.go(id)}
                className="btn-press panel rounded-xl py-2.5 text-center"
              >
                <div className="text-xl leading-none">{icon}</div>
                <div className="mt-1 text-[10px] font-bold text-white/60">{label}</div>
              </button>
            ))}
          </div>

          {/* haberler */}
          <Card>
            <SectionTitle>KULÜP HABERLERİ</SectionTitle>
            <div className="space-y-1.5">
              {career.news.slice(0, 6).map((n, i) => (
                <div key={i} className="flex gap-2 rounded-lg bg-white/4 px-2 py-1.5 text-[11px] leading-snug">
                  <span className="shrink-0 text-white/30">•</span>
                  <span className="text-white/75">{n.text}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* sağ sütun */}
        <div className="space-y-3">
          <Card hi={done > 0}>
            <SectionTitle right={done > 0 ? <span className="anim-pulse text-[10px] font-black text-amber-300">{done} ÖDÜL HAZIR</span> : undefined}>
              SEZON GÖREVLERİ
            </SectionTitle>
            <div className="space-y-2">
              {career.objectives.slice(0, 4).map((o) => {
                const ready = o.progress >= o.goal && !o.claimed;
                return (
                  <div key={o.id} className="rounded-lg bg-white/4 p-2">
                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                      <span className={cx("font-bold", o.claimed && "text-white/30 line-through")}>{o.text}</span>
                      <span className="tabnum shrink-0 text-white/45">{o.progress}/{o.goal}</span>
                    </div>
                    <Bar value={(o.progress / o.goal) * 100} height={4} color={ready ? "#fbbf24" : "#37f28b"} />
                    <div className="mt-1.5 flex items-center justify-between">
                      <div className="flex gap-1 text-[10px] font-black">
                        <span className="text-amber-300">🪙{o.gold}</span>
                        <span className="text-cyan-300">💎{o.diamonds}</span>
                      </div>
                      {ready && (
                        <Btn
                          size="xs"
                          variant="gold"
                          onClick={() => {
                            const r = claimObjective(career, o.id);
                            p.toast(r.msg);
                            p.setCareer({ ...career });
                          }}
                        >
                          ÖDÜL AL
                        </Btn>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <SectionTitle right={<button onClick={() => p.go("table")} className="text-[10px] font-bold text-emerald-300">TÜMÜ →</button>}>
              PUAN DURUMU
            </SectionTitle>
            {table.slice(0, 5).map((r, i) => (
              <div
                key={r.clubId}
                className={cx(
                  "flex items-center gap-2 rounded-lg px-1.5 py-1 text-[11px]",
                  r.clubId === career.clubId && "bg-emerald-400/15"
                )}
              >
                <span className="w-4 tabnum text-white/35">{i + 1}</span>
                <Crest club={CLUB_MAP[r.clubId]} size={16} />
                <span className="flex-1 truncate font-bold">{CLUB_MAP[r.clubId].short}</span>
                <span className="tabnum text-white/40">{r.p}</span>
                <span className="tabnum w-6 text-right font-black text-emerald-300">{r.pts}</span>
              </div>
            ))}
          </Card>

          <Card>
            <SectionTitle>MENAJER</SectionTitle>
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-400/30 to-sky-400/10 text-lg">
                🧠
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black">Seviye {career.manager.level}</div>
                <Bar value={(career.manager.xp / xpForLevel(career.manager.level)) * 100} height={4} />
              </div>
              {career.manager.points > 0 && (
                <span className="anim-pulse rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black text-amber-300">
                  +{career.manager.points}
                </span>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
              <div className="rounded-lg bg-white/5 p-1.5">
                <div className="text-white/40">Stadyum</div>
                <div className="font-black text-emerald-300">{stadiumCapacity(career.stadium).toLocaleString("tr-TR")} kişi</div>
              </div>
              <div className="rounded-lg bg-white/5 p-1.5">
                <div className="text-white/40">Kadro</div>
                <div className="font-black text-emerald-300">{squad.length} oyuncu</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TeamMini({ clubId, you, right }: { clubId: string; you?: boolean; right?: boolean }) {
  const c = CLUB_MAP[clubId];
  return (
    <div className={cx("flex flex-1 items-center gap-2", right && "flex-row-reverse text-right")}>
      <Crest club={c} size={42} />
      <div className="min-w-0">
        <div className="truncate text-xs font-black leading-tight">{c.name}</div>
        <div className="text-[10px] text-white/40">{you ? "SEN" : `Güç ${c.rating}`}</div>
      </div>
    </div>
  );
}

function NoCareer(p: ScreenProps) {
  return (
    <div className="pitch-bg grid h-full place-items-center p-6 text-center">
      <div>
        <div className="mb-2 text-5xl">⚽</div>
        <h1 className="text-2xl font-black tracking-tight">
          TWIN <span className="text-emerald-400">SOCCER</span>
        </h1>
        <p className="mt-2 max-w-sm text-xs text-white/45">
          Bir kulüp seç, kadronu kur, stadyumunu büyüt ve şampiyonluğa uzan.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Btn variant="primary" size="lg" className="shine" onClick={() => p.go("teamselect")}>
            KARİYERE BAŞLA
          </Btn>
          <Btn variant="dark" onClick={() => p.go("settings")}>
            Ayarlar
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ============================ TAKIM SEÇİMİ ============================ */
export function TeamSelectScreen(p: ScreenProps) {
  const [league, setLeague] = useState("sl");
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<"career" | "quick">("career");
  const [opp, setOpp] = useState<string | null>(null);
  const clubs = clubsOfLeague(league);
  const selected = sel ? CLUB_MAP[sel] : null;

  return (
    <Page
      title={mode === "career" ? "Kulüp Seç" : "Hazır Maç"}
      sub={mode === "career" ? "Kariyerine başlayacağın takım" : "İki takım seç ve hemen oyna"}
      onBack={() => p.go("home")}
      right={
        <div className="flex gap-1">
          {(["career", "quick"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setSel(null);
                setOpp(null);
              }}
              className={cx(
                "btn-press rounded-lg px-2.5 py-1.5 text-[10px] font-black",
                mode === m ? "bg-emerald-400 text-emerald-950" : "bg-white/8 text-white/55"
              )}
            >
              {m === "career" ? "KARİYER" : "HIZLI"}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-3 flex gap-1.5 scroll-x">
        {LEAGUES.map((l) => (
          <button
            key={l.id}
            onClick={() => setLeague(l.id)}
            className={cx(
              "btn-press shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-black",
              league === l.id ? "bg-emerald-400 text-emerald-950" : "bg-white/6 text-white/55"
            )}
          >
            {l.flag} {l.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {clubs.map((c) => {
          const active = sel === c.id;
          const isOpp = opp === c.id;
          return (
            <button
              key={c.id}
              onClick={() => {
                if (mode === "quick" && sel && sel !== c.id) setOpp(c.id);
                else {
                  setSel(c.id);
                  setOpp(null);
                }
              }}
              className={cx(
                "btn-press flex items-center gap-2 rounded-xl p-2 text-left",
                active ? "panel-hi" : isOpp ? "bg-sky-400/15 ring-1 ring-sky-400/40" : "panel"
              )}
            >
              <Crest club={c} size={38} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-black leading-tight">{c.name}</div>
                <div className="text-[9px] text-white/40">{c.city}</div>
                <div className="mt-1 flex items-center gap-1">
                  <Bar value={(c.rating - 55) * 2.4} height={3} />
                  <span className="tabnum text-[9px] font-black text-emerald-300">{c.rating}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="sticky bottom-0 mt-3 pt-2">
          <Card hi className="flex items-center gap-3">
            <Crest club={selected} size={44} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black">{selected.name}</div>
              <div className="text-[10px] text-white/45">
                Bütçe {money(Math.round(selected.budget * 0.35))} · Güç {selected.rating}
                {mode === "quick" && opp ? ` · Rakip: ${CLUB_MAP[opp].short}` : ""}
              </div>
            </div>
            {mode === "career" ? (
              <Btn variant="primary" onClick={() => p.startCareer(selected.id)}>
                BAŞLA
              </Btn>
            ) : (
              <Btn
                variant="primary"
                disabled={!opp}
                onClick={() => opp && p.startQuick(selected.id, opp)}
              >
                {opp ? "MAÇA ÇIK" : "RAKİP SEÇ"}
              </Btn>
            )}
          </Card>
        </div>
      )}
    </Page>
  );
}

/* ============================ KADRO ============================ */
export function SquadScreen(p: ScreenProps) {
  const { career, world } = p;
  const [sel, setSel] = useState<string | null>(null);
  const [swap, setSwap] = useState<string | null>(null);
  const [tab, setTab] = useState<"pitch" | "list">("pitch");
  if (!career) return null;
  const form = FORMATION_MAP[career.formation] ?? FORMATION_MAP["442"];
  const squad = Object.values(world.players).filter((x) => x.teamId === career.clubId);
  const bench = squad.filter((x) => !career.lineup.includes(x.id));

  const doSwap = (a: string, b: string) => {
    const lineup = [...career.lineup];
    const ia = lineup.indexOf(a);
    const ib = lineup.indexOf(b);
    if (ia >= 0 && ib >= 0) {
      [lineup[ia], lineup[ib]] = [lineup[ib], lineup[ia]];
    } else if (ia >= 0) {
      lineup[ia] = b;
    } else if (ib >= 0) {
      lineup[ib] = a;
    }
    p.setCareer({ ...career, lineup, subs: squad.filter((x) => !lineup.includes(x.id)).slice(0, 7).map((x) => x.id) });
    setSwap(null);
  };

  return (
    <Page
      title="Kadro"
      sub={`${form.name} · ${squad.length} oyuncu`}
      onBack={() => p.go("home")}
      right={
        <div className="flex gap-1">
          <Btn
            size="xs"
            variant="dark"
            onClick={() => {
              const a = autoLineup(world, career.clubId, career.formation);
              p.setCareer({ ...career, lineup: a.lineup, subs: a.subs });
              p.toast("En iyi 11 dizildi");
            }}
          >
            ⚡ OTO
          </Btn>
          <Tabs
            tabs={[{ id: "pitch" as const, label: "SAHA" }, { id: "list" as const, label: "LİSTE" }]}
            active={tab}
            onChange={setTab}
          />
        </div>
      }
    >
      {tab === "pitch" ? (
        <div className="grid gap-3 md:grid-cols-[1.5fr_1fr]">
          <FormationPitch
            career={career}
            world={world}
            swap={swap}
            onPick={(id) => {
              if (swap && swap !== id) doSwap(swap, id);
              else setSwap(swap === id ? null : id);
            }}
            onDetail={(id) => setSel(id)}
          />
          <Card>
            <SectionTitle right={swap ? <span className="text-[10px] font-black text-amber-300">DEĞİŞTİRİLECEK SEÇİLDİ</span> : undefined}>
              YEDEKLER
            </SectionTitle>
            <div className="scroll-y max-h-[46vh] space-y-1">
              {bench.map((x) => (
                <PlayerRow
                  key={x.id}
                  player={x}
                  onClick={() => (swap ? doSwap(swap, x.id) : setSel(x.id))}
                  active={swap === x.id}
                />
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {squad
            .slice()
            .sort((a, b) => overall(b) - overall(a))
            .map((x) => (
              <PlayerRow key={x.id} player={x} onClick={() => setSel(x.id)} inXI={career.lineup.includes(x.id)} />
            ))}
        </div>
      )}

      <Sheet open={!!sel} onClose={() => setSel(null)} title="Oyuncu Kartı">
        {sel && world.players[sel] && (
          <PlayerDetail
            player={world.players[sel]}
            career={career}
            onTrain={(k) => {
              const training = { ...career.training };
              if (training[sel] === k) delete training[sel];
              else training[sel] = k;
              p.setCareer({ ...career, training });
              p.toast(training[sel] ? "İdman odağı ayarlandı" : "İdman odağı kaldırıldı");
            }}
            onClose={() => setSel(null)}
          />
        )}
      </Sheet>
    </Page>
  );
}

export function PlayerRow({
  player,
  onClick,
  active,
  inXI,
  right,
}: {
  player: Player;
  onClick?: () => void;
  active?: boolean;
  inXI?: boolean;
  right?: React.ReactNode;
}) {
  const inj = player.injury > 0;
  return (
    <button
      onClick={onClick}
      className={cx(
        "btn-press flex w-full items-center gap-2 rounded-xl p-2 text-left",
        active ? "panel-hi" : "bg-white/4 hover:bg-white/7"
      )}
    >
      <OvrBadge value={overall(player)} size={32} pos={player.pos} />
      <FaceChip player={player} size={28} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-[11px] font-black">{player.name}</span>
          {inXI && <span className="rounded bg-emerald-400/20 px-1 text-[8px] font-black text-emerald-300">11</span>}
          {inj && <span className="text-[9px]">🚑</span>}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="text-[9px] text-white/35">{player.age}y</span>
          <div className="w-10">
            <Bar value={player.fitness} height={3} color={player.fitness > 70 ? "#37f28b" : "#f59e0b"} />
          </div>
          <span className="text-[9px] text-white/35">{player.nat}</span>
          <span className="text-[9px] font-bold text-white/45">{money(player.value)}</span>
        </div>
      </div>
      {right}
    </button>
  );
}

function FormationPitch({
  career,
  world,
  swap,
  onPick,
  onDetail,
}: {
  career: Career;
  world: World;
  swap: string | null;
  onPick: (id: string) => void;
  onDetail: (id: string) => void;
}) {
  const form = FORMATION_MAP[career.formation] ?? FORMATION_MAP["442"];
  return (
    <div
      className="relative mx-auto aspect-[16/10] w-full overflow-hidden rounded-2xl border border-emerald-400/15"
      style={{
        maxWidth: "calc((100dvh - 150px) * 1.6)",
        background: "repeating-linear-gradient(90deg, #17703c 0 7%, #1d8347 7% 14%)",
      }}
    >
      {/* çizgiler */}
      <div className="pointer-events-none absolute inset-3 rounded-sm border-2 border-white/35" />
      <div className="pointer-events-none absolute inset-y-3 left-1/2 w-0.5 -translate-x-1/2 bg-white/35" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[26%] w-[16%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/35" />
      <div className="pointer-events-none absolute left-3 top-1/2 h-[52%] w-[15%] -translate-y-1/2 border-2 border-white/35" />
      <div className="pointer-events-none absolute right-3 top-1/2 h-[52%] w-[15%] -translate-y-1/2 border-2 border-white/35" />

      {form.slots.map((slot, i) => {
        const id = career.lineup[i];
        const pl = id ? world.players[id] : null;
        if (!pl) return null;
        const active = swap === id;
        return (
          <button
            key={id ?? i}
            onClick={() => onPick(id)}
            onDoubleClick={() => onDetail(id)}
            className={cx(
              "btn-press absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center",
              active && "z-10 scale-110"
            )}
            style={{ left: `${8 + slot.fx * 84}%`, top: `${8 + slot.fy * 84}%` }}
          >
            <div
              className={cx(
                "grid h-8 w-8 place-items-center rounded-full text-[11px] font-black shadow-lg",
                active ? "bg-amber-300 text-amber-950 ring-2 ring-white" : "bg-[#08130d] text-white ring-1 ring-white/50"
              )}
            >
              {pl.num}
            </div>
            <div className="mt-0.5 max-w-[70px] truncate rounded bg-black/60 px-1 text-[8px] font-bold">
              {pl.name.split(" ").slice(-1)[0]}
            </div>
            <div className="text-[8px] font-black text-emerald-300">{overall(pl)}</div>
          </button>
        );
      })}
    </div>
  );
}

function PlayerDetail({
  player,
  career,
  onTrain,
  onClose,
}: {
  player: Player;
  career: Career;
  onTrain: (k: string) => void;
  onClose: () => void;
}) {
  const attrs: [string, keyof Player][] = [
    ["Hız", "pac"],
    ["Şut", "sho"],
    ["Pas", "pas"],
    ["Savunma", "def"],
    ["Fizik", "phy"],
    ["Kalecilik", "gk"],
  ];
  const focus = career.training[player.id];
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <OvrBadge value={overall(player)} size={54} pos={player.pos} />
        <FaceChip player={player} size={48} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-black">{player.name}</div>
          <div className="text-[11px] text-white/45">
            {player.nat} · {player.age} yaş · #{player.num} · {money(player.value)}
          </div>
          <div className="mt-1 flex flex-wrap gap-1 text-[9px] font-black">
            <span className="rounded bg-white/8 px-1.5 py-0.5">Maaş {money(player.wage)}/hf</span>
            <span className={cx("rounded px-1.5 py-0.5", player.contract <= 1 ? "bg-rose-500/20 text-rose-300" : "bg-white/8")}>
              Sözleşme {player.contract} yıl
            </span>
            {player.injury > 0 && <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-rose-300">🚑 {player.injury} hafta</span>}
          </div>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-[10px]">
        {[
          ["Moral", player.morale, "#37f28b"],
          ["Form", player.form, "#38bdf8"],
          ["Kondisyon", player.fitness, "#fbbf24"],
        ].map(([l, v, c]) => (
          <div key={String(l)} className="rounded-xl bg-white/5 p-2">
            <div className="text-white/40">{l}</div>
            <div className="my-1 text-sm font-black tabnum">{Math.round(Number(v))}</div>
            <Bar value={Number(v)} height={3} color={String(c)} />
          </div>
        ))}
      </div>

      <SectionTitle>ÖZELLİKLER</SectionTitle>
      <div className="mb-3 space-y-1.5">
        {attrs.map(([label, key]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-16 text-[10px] font-bold text-white/50">{label}</span>
            <div className="flex-1">
              <Bar value={Number(player[key])} height={5} />
            </div>
            <span className="w-6 text-right text-[11px] font-black tabnum">{Number(player[key])}</span>
            {key !== "gk" && (
              <button
                onClick={() => onTrain(String(key))}
                className={cx(
                  "btn-press rounded-md px-1.5 py-0.5 text-[9px] font-black",
                  focus === key ? "bg-emerald-400 text-emerald-950" : "bg-white/8 text-white/45"
                )}
              >
                İDMAN
              </button>
            )}
          </div>
        ))}
      </div>

      <SectionTitle>SEZON İSTATİSTİĞİ</SectionTitle>
      <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
        {[
          ["Maç", player.stats.apps],
          ["Gol", player.stats.goals],
          ["Asist", player.stats.assists],
          ["Ort.", player.stats.apps ? (player.stats.ratingSum / player.stats.apps).toFixed(1) : "-"],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-xl bg-white/5 p-2">
            <div className="text-white/40">{l}</div>
            <div className="text-sm font-black tabnum">{v}</div>
          </div>
        ))}
      </div>
      <Btn variant="dark" className="mt-3 w-full" onClick={onClose}>
        Kapat
      </Btn>
    </div>
  );
}

/* ============================ TAKTİK ============================ */
export function TacticsScreen(p: ScreenProps) {
  const { career, world } = p;
  const [t, setT] = useState<TeamTactic>(career?.tactic ?? ({} as TeamTactic));
  if (!career) return null;
  const presets: { name: string; icon: string; v: Partial<TeamTactic> }[] = [
    { name: "Otobüs", icon: "🚌", v: { mentality: 18, pressing: 30, lineHeight: 22, width: 38, tempo: 35, passing: "long" } },
    { name: "Dengeli", icon: "⚖️", v: { mentality: 52, pressing: 52, lineHeight: 50, width: 52, tempo: 55, passing: "mixed" } },
    { name: "Tiki-Taka", icon: "🎯", v: { mentality: 68, pressing: 78, lineHeight: 72, width: 66, tempo: 62, passing: "short" } },
    { name: "Full Baskı", icon: "🔥", v: { mentality: 88, pressing: 92, lineHeight: 84, width: 74, tempo: 82, passing: "mixed" } },
  ];
  return (
    <Page title="Taktik" sub="Formasyon ve oyun planı" onBack={() => p.go("home")}>
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <SectionTitle>FORMASYON</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {FORMATIONS.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  const a = autoLineup(world, career.clubId, f.id);
                  setT({ ...t, formation: f.id });
                  p.setCareer({ ...career, formation: f.id, tactic: { ...t, formation: f.id }, lineup: a.lineup, subs: a.subs });
                  p.toast(`${f.name} uygulandı`);
                }}
                className={cx(
                  "btn-press rounded-xl py-2.5 text-center text-xs font-black",
                  career.formation === f.id ? "bg-gradient-to-b from-emerald-300 to-emerald-500 text-emerald-950" : "bg-white/6 text-white/60"
                )}
              >
                {f.name}
              </button>
            ))}
          </div>
          <SectionTitle>HAZIR PLANLAR</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((pr) => (
              <button
                key={pr.name}
                onClick={() => {
                  const nt = { ...t, ...pr.v } as TeamTactic;
                  setT(nt);
                  p.setCareer({ ...career, tactic: nt });
                  p.toast(`${pr.name} planı yüklendi`);
                }}
                className="btn-press rounded-xl bg-white/6 px-2 py-2 text-left"
              >
                <div className="text-sm">{pr.icon}</div>
                <div className="text-[11px] font-black">{pr.name}</div>
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <SectionTitle>İNCE AYAR</SectionTitle>
          <TacticPanel
            tactic={t}
            onChange={(nt) => {
              setT(nt);
              p.setCareer({ ...career, tactic: nt });
            }}
          />
        </Card>
      </div>
    </Page>
  );
}

/* ============================ LİG ============================ */
export function LeagueScreen(p: ScreenProps) {
  const { career } = p;
  const [tab, setTab] = useState<"table" | "fixtures" | "cup" | "news">(
    p.defaultTab === "fixtures" ? "fixtures" : "table"
  );
  if (!career) return null;
  const table = leagueTable(career);
  return (
    <Page title="Lig & Kupa" sub={`${career.season}. Sezon`} onBack={() => p.go("home")}>
      <div className="mb-3">
        <Tabs
          tabs={[
            { id: "table" as const, label: "PUAN DURUMU" },
            { id: "fixtures" as const, label: "FİKSTÜR" },
            { id: "cup" as const, label: "KUPA" },
            { id: "news" as const, label: "HABERLER" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "table" && (
        <Card>
          <div className="mb-1 flex items-center gap-2 px-1 text-[9px] font-black text-white/35">
            <span className="w-5">#</span>
            <span className="flex-1">TAKIM</span>
            <span className="w-6 text-center">O</span>
            <span className="w-6 text-center">G</span>
            <span className="w-6 text-center">B</span>
            <span className="w-6 text-center">M</span>
            <span className="w-8 text-center">AV</span>
            <span className="w-7 text-center">P</span>
          </div>
          {table.map((r, i) => (
            <div
              key={r.clubId}
              className={cx(
                "flex items-center gap-2 rounded-lg px-1 py-1.5 text-[11px]",
                r.clubId === career.clubId ? "bg-emerald-400/15" : i % 2 ? "bg-white/[0.03]" : ""
              )}
            >
              <span className={cx("w-5 tabnum font-black", i === 0 ? "text-amber-300" : i < 3 ? "text-emerald-300" : "text-white/35")}>
                {i + 1}
              </span>
              <Crest club={CLUB_MAP[r.clubId]} size={18} />
              <span className="flex-1 truncate font-bold">{CLUB_MAP[r.clubId].name}</span>
              <span className="w-6 text-center tabnum text-white/50">{r.p}</span>
              <span className="w-6 text-center tabnum text-white/50">{r.w}</span>
              <span className="w-6 text-center tabnum text-white/50">{r.d}</span>
              <span className="w-6 text-center tabnum text-white/50">{r.l}</span>
              <span className="w-8 text-center tabnum text-white/50">{r.gf - r.ga > 0 ? "+" : ""}{r.gf - r.ga}</span>
              <span className="w-7 text-center tabnum font-black text-emerald-300">{r.pts}</span>
            </div>
          ))}
        </Card>
      )}

      {tab === "fixtures" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 26 }).map((_, round) => {
            const fx = career.fixtures.filter((f) => f.round === round);
            if (!fx.length) return null;
            const mine = fx.find((f) => f.home === career.clubId || f.away === career.clubId);
            return (
              <Card key={round} className={cx(round === career.round && "panel-hi")}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-black text-white/40">{round + 1}. HAFTA</span>
                  {round === career.round && <span className="text-[9px] font-black text-emerald-300">SIRADAKİ</span>}
                </div>
                {mine && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <Crest club={CLUB_MAP[mine.home]} size={18} />
                    <span className="flex-1 truncate font-bold">{CLUB_MAP[mine.home].short}</span>
                    <span className="tabnum rounded bg-black/40 px-2 py-0.5 font-black">
                      {mine.hg === null ? "-" : `${mine.hg} : ${mine.ag}`}
                    </span>
                    <span className="flex-1 truncate text-right font-bold">{CLUB_MAP[mine.away].short}</span>
                    <Crest club={CLUB_MAP[mine.away]} size={18} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {tab === "cup" && (
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
          {career.cup.map((stage, i) => (
            <Card key={i} className={cx(i === career.cupStage && "panel-hi")}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-black">{stage.name}</span>
                <span className="text-[9px] text-white/35">{CUP_AFTER_ROUND[i]}. hafta</span>
              </div>
              {stage.ties.length === 0 && <div className="text-[10px] text-white/30">Kura bekleniyor</div>}
              {stage.ties.map((t, j) => (
                <div
                  key={j}
                  className={cx(
                    "mb-1 flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[10px]",
                    t.home === career.clubId || t.away === career.clubId ? "bg-emerald-400/12" : "bg-white/4"
                  )}
                >
                  <span className="flex-1 truncate font-bold">{CLUB_MAP[t.home]?.short}</span>
                  <span className="tabnum font-black">{t.hg === null ? "-" : `${t.hg}:${t.ag}`}</span>
                  <span className="flex-1 truncate text-right font-bold">{CLUB_MAP[t.away]?.short}</span>
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}

      {tab === "news" && (
        <Card>
          <div className="space-y-1.5">
            {career.news.map((n, i) => (
              <div key={i} className="rounded-lg bg-white/4 px-2 py-1.5 text-[11px] text-white/75">
                {n.text}
              </div>
            ))}
          </div>
        </Card>
      )}
    </Page>
  );
}

/* ============================ İSTATİSTİK ============================ */
export function StatsScreen(p: ScreenProps) {
  const [league, setLeague] = useState("sl");
  const pool = useMemo(
    () => Object.values(p.world.players).filter((x) => CLUB_MAP[x.teamId]?.leagueId === league),
    [p.world, league]
  );
  const scorers = pool.slice().sort((a, b) => b.stats.goals - a.stats.goals).slice(0, 12);
  const assists = pool.slice().sort((a, b) => b.stats.assists - a.stats.assists).slice(0, 12);
  const rated = pool
    .filter((x) => x.stats.apps > 0)
    .sort((a, b) => b.stats.ratingSum / b.stats.apps - a.stats.ratingSum / a.stats.apps)
    .slice(0, 12);

  const List = ({ title, arr, val }: { title: string; arr: Player[]; val: (x: Player) => string }) => (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      {arr.map((x, i) => (
        <div key={x.id} className="flex items-center gap-2 rounded-lg px-1 py-1 text-[11px]">
          <span className="w-4 tabnum text-white/30">{i + 1}</span>
          <FaceChip player={x} size={22} />
          <span className="min-w-0 flex-1 truncate font-bold">{x.name}</span>
          <span className="truncate text-[9px] text-white/35">{CLUB_MAP[x.teamId]?.short}</span>
          <span className="w-8 text-right font-black tabnum text-emerald-300">{val(x)}</span>
        </div>
      ))}
    </Card>
  );

  return (
    <Page title="İstatistikler" onBack={() => p.go("home")}>
      <div className="mb-3 flex gap-1.5 scroll-x">
        {LEAGUES.map((l) => (
          <button
            key={l.id}
            onClick={() => setLeague(l.id)}
            className={cx(
              "btn-press shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-black",
              league === l.id ? "bg-emerald-400 text-emerald-950" : "bg-white/6 text-white/55"
            )}
          >
            {l.flag} {l.name}
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <List title="GOL KRALLIĞI" arr={scorers} val={(x) => String(x.stats.goals)} />
        <List title="ASİST KRALI" arr={assists} val={(x) => String(x.stats.assists)} />
        <List title="EN YÜKSEK REYTİNG" arr={rated} val={(x) => (x.stats.ratingSum / x.stats.apps).toFixed(1)} />
      </div>
    </Page>
  );
}

/* ============================ AYARLAR ============================ */
export function SettingsScreen(p: ScreenProps) {
  const s = p.settings;
  const set = (patch: Partial<MatchSettings>) => p.setSettings({ ...s, ...patch });
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <Page title="Ayarlar" sub="Oyun, grafik ve kontrol tercihleri" onBack={() => p.go("home")}>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-3">
          <Card>
            <SectionTitle>MAÇ SÜRESİ (gerçek süre)</SectionTitle>
            <div className="flex gap-2">
              {[3, 4, 6, 8, 10].map((m) => (
                <button
                  key={m}
                  onClick={() => set({ minutes: m })}
                  className={cx(
                    "btn-press flex-1 rounded-xl py-2 text-xs font-black",
                    s.minutes === m ? "bg-emerald-400 text-emerald-950" : "bg-white/6 text-white/55"
                  )}
                >
                  {m} dk
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle>ZORLUK</SectionTitle>
            <div className="flex gap-1.5">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  onClick={() => set({ difficulty: d.id })}
                  className={cx(
                    "btn-press flex-1 rounded-xl py-2 text-[10px] font-black",
                    s.difficulty === d.id ? "bg-emerald-400 text-emerald-950" : "bg-white/6 text-white/55"
                  )}
                >
                  {d.name}
                </button>
              ))}
            </div>
            <div className="mt-2 text-[10px] text-white/35">
              Zorluk yalnızca rakip yapay zekânın gücünü değiştirir.
            </div>
          </Card>

          <Card>
            <SectionTitle>OYNANIŞ YARDIMI</SectionTitle>
            <div className="flex gap-1.5">
              {["Manuel", "Yarı Otomatik", "Tam Yardım"].map((name, i) => (
                <button
                  key={name}
                  onClick={() => set({ assist: i })}
                  className={cx(
                    "btn-press flex-1 rounded-xl py-2 text-[10px] font-black",
                    s.assist === i ? "bg-emerald-400 text-emerald-950" : "bg-white/6 text-white/55"
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="mt-2 text-[10px] leading-relaxed text-white/35">
              Pas ve şut nişanı, ilk dokunuş ve top koruma yardımı. Rakibin gücünü <b>değiştirmez</b> —
              sadece kontrolü kolaylaştırır.
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          <Card>
            <SectionTitle>KAMERA AÇISI</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {CAMERA_LABELS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => set({ camera: c.id as CameraId })}
                  className={cx(
                    "btn-press rounded-xl p-2 text-left",
                    s.camera === c.id ? "panel-hi" : "bg-white/6"
                  )}
                >
                  <div className="text-[11px] font-black">{c.name}</div>
                  <div className="text-[9px] text-white/40">{c.desc}</div>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle>GRAFİK KALİTESİ</SectionTitle>
            <div className="flex gap-1.5">
              {["Düşük", "Orta", "Yüksek"].map((name, i) => (
                <button
                  key={name}
                  onClick={() => set({ quality: i })}
                  className={cx(
                    "btn-press flex-1 rounded-xl py-2 text-[10px] font-black",
                    s.quality === i ? "bg-emerald-400 text-emerald-950" : "bg-white/6 text-white/55"
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            {[
              ["Ses efektleri", "sound"],
              ["Ofsayt kuralı", "offside"],
              ["Otomatik oyuncu değişimi", "autoSwitch"],
              ["Spiker altyazısı", "commentary"],
              ["Titreşim", "haptics"],
            ].map(([label, key]) => (
              <div key={key} className="flex items-center justify-between py-1.5">
                <span className="text-[11px] font-bold">{label}</span>
                <Toggle
                  on={Boolean(s[key as keyof MatchSettings])}
                  onChange={(v) => set({ [key]: v } as Partial<MatchSettings>)}
                />
              </div>
            ))}
          </Card>
        </div>
      </div>

      {/* ---------- SAKAT FAİK MODU (en altta) ---------- */}
      <div className="mt-3">
        <div
          className={cx(
            "overflow-hidden rounded-2xl border p-3 transition-all",
            s.faikMode
              ? "border-amber-300/50 bg-gradient-to-br from-amber-400/15 to-emerald-500/10 glow-gold"
              : "border-white/10 bg-white/4"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-black/40 text-xl">🥅</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-wide">SAKAT FAİK MODU</span>
                <span className="rounded bg-amber-400/25 px-1.5 py-0.5 text-[9px] font-black text-amber-200">ÖZEL</span>
              </div>
              <div className="mt-0.5 text-[10px] leading-relaxed text-white/50">
                Açtığında maçlar <b>halısaha</b> temelinde oynanır: çim yerine efsanevi Faik dokusu,
                saha çevresinde tel kafes ve halısaha atmosferi.
              </div>
            </div>
            <Toggle
              on={s.faikMode}
              onChange={(v) => {
                set({ faikMode: v });
                p.toast(v ? "Sakat Faik Modu açıldı 🥅" : "Sakat Faik Modu kapatıldı");
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Card>
          <SectionTitle>MOTOR</SectionTitle>
          <div className="text-[10px] leading-relaxed text-white/50">
            60Hz sabit adım fizik · perspektif 3B render · pozisyonel yapay zekâ · prosedürel ses.
            <br />
            Taktik, piyasa değerlemesi, simülasyon ve spiker replikleri{" "}
            <b className="text-emerald-300">Lua</b> betikleriyle çalışır.
          </div>
          <div className="mt-2 text-[10px] text-white/25">
            TWIN SOCCER · BYMEL SOFTWARE · {CLUBS.length} kulüp · {Object.keys(p.world.players).length} oyuncu
          </div>
        </Card>
        <Card>
          <SectionTitle>KAYIT</SectionTitle>
          {!confirmReset ? (
            <Btn variant="danger" className="w-full" onClick={() => setConfirmReset(true)}>
              Tüm Kaydı Sil
            </Btn>
          ) : (
            <div className="flex gap-2">
              <Btn variant="danger" className="flex-1" onClick={p.resetAll}>
                Evet, sil
              </Btn>
              <Btn variant="dark" className="flex-1" onClick={() => setConfirmReset(false)}>
                Vazgeç
              </Btn>
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}

export { attrAtPos, KitIcon, LevelDots };
