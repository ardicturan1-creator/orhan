import React from "react";
import { Btn, Bar, Crest, Panel, Header, Tabs, OvrBadge, PlayerRow, AttrBar, Sheet, Empty, Coin, Gem, Cash, cx } from "./ui";
import { FAIK_NAME, FAIK_STORAGE_KEY } from "../assets/faik";
import { vaultFingerprint } from "../game/crypto";
import { SAVE_KEY } from "../game/world";
import { FORMATIONS, formationById, overall, posFit } from "../game/formations";
import { LEAGUES } from "../game/data/clubs";
import { leagueTable, userFixture, userCupTie, isCupWeek, reautoLineup, squadOf } from "../game/career";
import { bonusesOf, claimObjective, capacity, sectionEffect } from "../game/economy";
import { brainStatus } from "../game/brain";
import { POS_LONG, type CameraId, type Career, type MatchSettings, type Player, type PosCode, type Screen, type World } from "../game/types";
import { CAMERAS, CAMERA_NAME } from "../game/types";
import { sfxUi } from "../game/audio";

export interface AppCtx {
  world: World;
  career: Career | null;
  screen: Screen;
  settings: MatchSettings;
  setSettings: (s: MatchSettings) => void;
  commit: () => void;
  nav: (s: Screen) => void;
  toast: (m: string) => void;
  startCareer: (clubId: string, quick: boolean) => void;
  resetSave: () => void;
  /** Maçı kurar ve başlatır. sim=true → maç arka planda simüle edilir. */
  playMatch: (sim: boolean) => void;
}

/* =============================== ANA MENÜ =============================== */

export function HomeScreen({ ctx }: { ctx: AppCtx }): React.JSX.Element {
  const c = ctx.career;
  if (!c) return <Empty text="Kariyer bulunamadı" />;
  const club = ctx.world.clubs[c.clubId];
  const table = leagueTable(ctx.world, "lig_bymel", c.fixtures);
  const pos = table.findIndex((r) => r.clubId === c.clubId) + 1;
  const row = table[pos - 1];
  const fx = userFixture(c);
  const tie = userCupTie(c);
  const opponent = tie
    ? ctx.world.clubs[tie.homeId === c.clubId ? tie.awayId : tie.homeId]
    : fx ? ctx.world.clubs[fx.homeId === c.clubId ? fx.awayId : fx.homeId] : null;
  const b = bonusesOf(c);
  const readyObjectives = c.objectives.filter((o) => !o.claimed && o.prog >= o.target);

  return (
    <div className="flex flex-col h-full">
      <Header title={club.name} sub={`Sezon ${c.season} · Hafta ${c.round} · ${c.stadium.name}`} />
      <div className="flex-1 overflow-y-auto sc px-2 pb-3 space-y-2">
        {/* kulüp kartı */}
        <Panel hi className="p-2.5 shine">
          <div className="flex items-center gap-3">
            <Crest club={club} size={46} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-black truncate">{club.name}</span>
                <span className="tag bg-emerald-400/20 text-emerald-300">{club.rating}</span>
                {c.trophies > 0 && <span className="tag bg-amber-400/20 text-amber-300">🏆 {c.trophies}</span>}
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">
                {club.city} · {LEAGUES.find((l) => l.id === club.leagueId)?.name}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] text-slate-400">Lig sırası</span>
                <span className="text-[13px] font-black txt-neon">{pos || "-"}</span>
                <span className="text-[9px] text-slate-500">({row ? `${row.pts} p` : "0 p"})</span>
                {c.streak > 1 && <span className="tag bg-rose-400/20 text-rose-300">🔥 {c.streak} seri</span>}
              </div>
            </div>
            <div className="flex flex-col gap-1 items-end">
              <Cash v={c.budget} />
              <div className="flex gap-1"><Coin v={c.gold} /><Gem v={c.diamonds} /></div>
            </div>
          </div>
        </Panel>

        {/* sonraki maç */}
        <Panel className="p-2.5">
          <div className="text-[9px] tracking-[0.24em] text-slate-400 mb-1.5">
            {tie ? "SONRAKİ KUPA MAÇI" : fx ? "SONRAKİ LİG MAÇI" : "SEZON TAMAMLANDI"}
          </div>
          {opponent ? (
            <div className="flex items-center gap-2">
              <Crest club={ctx.world.clubs[c.clubId]} size={30} />
              <div className="text-[11px] font-black">{ctx.world.clubs[c.clubId].short}</div>
              <div className="text-[9px] text-slate-500">vs</div>
              <Crest club={opponent} size={30} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-black truncate">{opponent.name}</div>
                <div className="text-[8px] text-slate-500">
                  {tie ? "Kupa" : fx?.homeId === c.clubId ? "Ev sahibi" : "Deplasman"} · Güç {opponent.rating} · {tie ? "Tek maç" : "Lig"}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-slate-400">Sezon tamamlandı — sezon özeti için Lig & Kupa ekranına git.</div>
          )}
          <div className="flex gap-1.5 mt-2">
            <Btn variant="primary" shine className="flex-1" onClick={() => ctx.playMatch(false)}>⚽ MAÇA ÇIK</Btn>
            <Btn variant="dark" onClick={() => ctx.nav("tactics")}>🧠 Taktik</Btn>
            <Btn variant="gold" onClick={() => ctx.playMatch(true)}>⏩ Simüle</Btn>
          </div>
        </Panel>

        {/* hızlı erişim */}
        <div className="grid grid-cols-6 gap-1.5">
          {([
            ["squad", "Kadro", "👥"], ["tactics", "Taktik", "🧠"], ["transfers", "Transfer", "🔁"],
            ["contracts", "Sözleşme", "📝"], ["stadium", "Stadyum", "🏟️"], ["manager", "Menajer", "🧑‍💼"],
          ] as const).map(([s, l, i]) => (
            <Panel key={s} className="p-1.5 text-center !rounded-xl" onClick={() => { sfxUi(700); ctx.nav(s as Screen); }}>
              <div className="text-[18px] leading-none">{i}</div>
              <div className="text-[8px] font-bold text-slate-400 mt-1">{l}</div>
            </Panel>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* görevler */}
          <Panel className="p-2.5">
            <div className="text-[9px] tracking-[0.2em] text-slate-400 mb-1.5">SEZON GÖREVLERİ</div>
            {readyObjectives.length > 0 && (
              <div className="mb-1.5 text-[9px] text-amber-300 font-bold anim-glow">
                {readyObjectives.length} görev ödül almaya hazır!
              </div>
            )}
            <div className="space-y-1.5">
              {c.objectives.map((o) => (
                <div key={o.id}>
                  <div className="flex items-center gap-1 text-[9px]">
                    <span className={cx("flex-1 truncate", o.claimed ? "text-slate-600 line-through" : o.prog >= o.target ? "text-amber-300 font-bold" : "text-slate-300")}>
                      🎯 {o.label}
                    </span>
                    <span className="text-slate-500 tabular-nums">{o.prog}/{o.target}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex-1"><Bar v={(o.prog / o.target) * 100} color={o.prog >= o.target ? "amber" : "emerald"} h={3} /></div>
                    {o.prog >= o.target && !o.claimed && (
                      <button type="button" onClick={() => { claimObjective(c, o.id); ctx.commit(); sfxUi(880); }} className="tag bg-amber-400/25 text-amber-200">AL</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* mini puan durumu */}
          <Panel className="p-2.5">
            <div className="tsx-kicker mb-1.5">{LEAGUES.find((l) => l.id === club.leagueId)?.name ?? "LİG"}</div>
            <div className="space-y-0.5">
              {table.slice(0, 8).map((r, i) => (
                <div key={r.clubId} className={cx("flex items-center gap-1.5 text-[9px]", r.clubId === c.clubId && "text-emerald-300 font-black")}>
                  <span className="w-3 text-slate-500 tabular-nums">{i + 1}</span>
                  <span className="flex-1 truncate">{ctx.world.clubs[r.clubId].short}</span>
                  <span className="w-4 text-right tabular-nums text-slate-400">{r.p}</span>
                  <span className="w-5 text-right tabular-nums font-bold">{r.pts}</span>
                </div>
              ))}
            </div>
            <Btn variant="ghost" size="sm" className="w-full mt-1.5" onClick={() => ctx.nav("table")}>Tümü →</Btn>
          </Panel>
        </div>

        {/* menajer özeti */}
        <Panel className="p-2.5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-b from-violet-400 to-violet-700 flex items-center justify-center text-[15px]">🧑‍💼</div>
            <div className="flex-1">
              <div className="text-[11px] font-black">Menajer · Seviye {c.manager.level}</div>
              <div className="mt-0.5"><Bar v={(c.manager.xp / (320 * Math.pow(1.35, c.manager.level - 1))) * 100} color="violet" h={4} /></div>
              <div className="text-[8px] text-slate-500 mt-0.5">
                XP {c.manager.xp} · Yetenek puanı {c.manager.points} · Takım bonusu +{b.teamBoost}
              </div>
            </div>
            <Btn variant="dark" size="sm" onClick={() => ctx.nav("manager")}>Detay</Btn>
          </div>
        </Panel>

        {/* haberler */}
        <Panel className="p-2.5">
          <div className="text-[9px] tracking-[0.2em] text-slate-400 mb-1.5">KULÜP HABERLERİ</div>
          <div className="space-y-1 max-h-[150px] overflow-y-auto sc pr-1">
            {c.news.length === 0 && <div className="text-[9px] text-slate-500">Haber yok</div>}
            {c.news.slice(0, 14).map((n, i) => (
              <div key={i} className={cx("flex gap-1.5 text-[9px] leading-snug", n.hi ? "text-emerald-200" : "text-slate-400")}>
                <span>{n.icon}</span>
                <span className="flex-1">{n.text}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* =============================== KULÜP SEÇİMİ =============================== */

export function TeamSelectScreen({ ctx }: { ctx: AppCtx }): React.JSX.Element {
  const [lg, setLg] = React.useState(LEAGUES[0].id);
  const [sel, setSel] = React.useState<string | null>(null);
  const [quick, setQuick] = React.useState(false);
  const clubs = Object.values(ctx.world.clubs).filter((c) => c.leagueId === lg).sort((a, b) => b.rating - a.rating);
  const club = sel ? ctx.world.clubs[sel] : null;
  const squad = club ? squadOf(ctx.world, club.id).sort((a, b) => overall(b) - overall(a)) : [];
  return (
    <div className="flex flex-col h-full">
      <Header title="KULÜP SEÇ" sub="Hazır takımlardan seç YA DA kendi takımını kur" />
      <div className="px-2 pb-1.5">
        <div
          onClick={() => ctx.nav("createteam")}
          className="panel-gold shine !rounded-xl p-2 flex items-center gap-2.5 cursor-pointer active:scale-[0.99] transition-transform anim-glow"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-amber-300 to-amber-600 flex items-center justify-center text-[20px] shrink-0">🛠️</div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-black text-amber-200">KENDİ TAKIMINI KUR</div>
            <div className="text-[8px] text-amber-100/70 leading-snug">
              Takım adını gir, formanı tasarla, başlangıç gücünü seç — bir kez kurunca o takımla oynarsın.
            </div>
          </div>
          <span className="text-amber-300 text-[16px]">›</span>
        </div>
      </div>
      <div className="px-2 pb-1.5 flex items-center gap-2">
        <Tabs
          value={lg}
          onChange={setLg}
          tabs={LEAGUES.map((l) => ({ id: l.id, label: `${l.flag} ${l.name}` }))}
        />
        <div className="ml-auto flex gap-1">
          <button type="button" onClick={() => setQuick(false)} className={cx("tag", !quick ? "bg-emerald-400/25 text-emerald-200" : "bg-white/5 text-slate-400")}>KARİYER</button>
          <button type="button" onClick={() => setQuick(true)} className={cx("tag", quick ? "bg-amber-400/25 text-amber-200" : "bg-white/5 text-slate-400")}>HIZLI MAÇ</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto sc px-2 pb-3 grid grid-cols-3 gap-2">
        {clubs.map((c) => (
          <Panel key={c.id} hi={sel === c.id} className="p-2 !rounded-xl" onClick={() => { setSel(c.id); sfxUi(660); }}>
            <div className="flex items-center gap-2">
              <Crest club={c} size={30} />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black truncate">{c.name}</div>
                <div className="text-[8px] text-slate-500 truncate">{c.city}</div>
              </div>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="text-[9px] font-black text-emerald-300">{c.rating}</span>
              <div className="flex-1"><Bar v={(c.rating - 60) / 25 * 100} h={3} /></div>
            </div>
          </Panel>
        ))}
      </div>
      {club && (
        <div className="p-2 panel-hi !rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Crest club={club} size={34} />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-black truncate">{club.name}</div>
              <div className="text-[8px] text-slate-400">
                Güç {club.rating} · Bütçe 💶 {(club.budget / 1000).toFixed(1)} Mn · En iyi: {squad[0] ? `${squad[0].name} (${overall(squad[0])})` : "—"}
              </div>
            </div>
            <Btn variant="primary" shine onClick={() => ctx.startCareer(club.id, quick)}>BAŞLA</Btn>
          </div>
          <div className="flex gap-1 mt-1.5 overflow-x-auto sc">
            {squad.slice(0, 8).map((p) => (
              <div key={p.id} className="shrink-0 w-[62px] p-1 rounded-lg bg-white/5 text-center">
                <OvrBadge v={overall(p)} size="sm" />
                <div className="text-[7px] font-bold truncate mt-0.5">{p.name.split(" ")[1] ?? p.name}</div>
                <div className="text-[7px] text-slate-500">{p.pos}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* =============================== KADRO =============================== */

export function SquadScreen({ ctx }: { ctx: AppCtx }): React.JSX.Element {
  const c = ctx.career!;
  const [view, setView] = React.useState<"pitch" | "list">("pitch");
  const [sel, setSel] = React.useState<Player | null>(null);
  const [swap, setSwap] = React.useState<string | null>(null);
  const squad = squadOf(ctx.world, c.clubId);
  const form = formationById(c.formation);
  const byId = (id: string): Player | undefined => ctx.world.players[id];

  const doSwap = (id: string): void => {
    if (!swap) { setSwap(id); return; }
    if (swap === id) { setSwap(null); return; }
    const inLineupA = c.lineup.indexOf(swap);
    const inLineupB = c.lineup.indexOf(id);
    if (inLineupA >= 0 && inLineupB >= 0) {
      const t = c.lineup[inLineupA];
      c.lineup[inLineupA] = c.lineup[inLineupB];
      c.lineup[inLineupB] = t;
    } else if (inLineupA >= 0 && inLineupB < 0) {
      c.lineup[inLineupA] = id;
    } else if (inLineupB >= 0 && inLineupA < 0) {
      c.lineup[inLineupB] = swap;
    }
    setSwap(null);
    ctx.commit();
    sfxUi(760);
  };

  return (
    <div className="flex flex-col h-full">
      <Header
        title="KADRO"
        sub={`${squad.length} oyuncu · ${form.name} · Kadro değeri 💶 ${(squad.reduce((t, p) => t + p.value, 0) / 1000).toFixed(1)} Mn`}
        right={
          <>
            <Tabs value={view} onChange={setView} size="sm" tabs={[{ id: "pitch" as const, label: "SAHA" }, { id: "list" as const, label: "LİSTE" }]} />
            <Btn size="sm" variant="dark" onClick={() => { reautoLineup(ctx.world, c); ctx.commit(); sfxUi(820); }}>OTO-DİZ</Btn>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto sc px-2 pb-3">
        {view === "pitch" ? (
          <Panel className="p-2 relative">
            <div
              className="relative w-full rounded-xl overflow-hidden"
              style={{ aspectRatio: "16/9", background: "linear-gradient(180deg,#1a6b34,#155c2d)" }}
            >
              <div className="absolute inset-2 rounded border border-white/40" />
              <div className="absolute left-1/2 top-2 bottom-2 w-px bg-white/40" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[16%] aspect-square rounded-full border border-white/40" />
              {form.slots.map((s, i) => {
                const p = byId(c.lineup[i] ?? "");
                if (!p) return null;
                const inj = p.injury > 0;
                const fit = posFit(p, s.role);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setSel(p); doSwap(p.id); }}
                    className={cx(
                      "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 transition-transform active:scale-95",
                      swap === p.id && "scale-110",
                    )}
                    style={{ left: `${s.fx * 100}%`, top: `${s.fy * 100}%` }}
                  >
                    <div className={cx(
                      "w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black shadow-lg border-2",
                      inj ? "bg-rose-900/80 border-rose-400 text-rose-200" : "bg-black/55 border-white/70 text-white",
                    )}>
                      {overall(p)}
                    </div>
                    <div className="text-[7px] font-bold text-white bg-black/55 rounded px-1 max-w-[54px] truncate">
                      {p.name.split(" ").slice(-1)[0]}
                    </div>
                    <div className={cx("text-[6px] font-bold", fit >= 1 ? "text-emerald-300" : fit >= 0.85 ? "text-amber-300" : "text-rose-300")}>
                      {s.role}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <div className="text-[9px] text-slate-400">YEDEKLER</div>
              <div className="flex gap-1 flex-wrap">
                {c.subs.map((id) => {
                  const p = byId(id);
                  if (!p) return null;
                  return (
                    <button key={id} type="button" onClick={() => { setSel(p); doSwap(id); }}
                      className={cx("tag bg-white/5 text-slate-300", swap === id && "bg-emerald-400/25 text-emerald-200")}>
                      {p.pos} {overall(p)} {p.name.split(" ").slice(-1)[0]}
                    </button>
                  );
                })}
              </div>
            </div>
            {swap && <div className="text-[9px] text-amber-300 mt-1">Takas için ikinci oyuncuya dokun · iptal: aynı oyuncuya dokun</div>}
          </Panel>
        ) : (
          <Panel className="p-1.5">
            {["GK", "CB", "LB", "RB", "DM", "CM", "AM", "LM", "RM", "LW", "RW", "ST"].map((pos) => {
              const list = squad.filter((p) => p.pos === pos).sort((a, b) => overall(b) - overall(a));
              if (!list.length) return null;
              return (
                <div key={pos} className="mb-1">
                  <div className="text-[8px] font-black text-slate-500 px-1 py-0.5 tracking-wider">{POS_LONG[pos as PosCode]} ({list.length})</div>
                  {list.map((p) => (
                    <PlayerRow
                      key={p.id}
                      p={p}
                      active={c.lineup.includes(p.id)}
                      sub={!c.lineup.includes(p.id) && c.subs.includes(p.id)}
                      onClick={() => setSel(p)}
                      right={<span className="text-[8px] text-slate-500">{c.lineup.includes(p.id) ? "İLK 11" : c.subs.includes(p.id) ? "YEDEK" : "—"}{p.injury > 0 ? " 🚑" : ""}</span>}
                    />
                  ))}
                </div>
              );
            })}
          </Panel>
        )}
      </div>

      <Sheet open={!!sel} onClose={() => { setSel(null); setSwap(null); }} title={sel ? `${sel.name} · ${POS_LONG[sel.pos]}` : ""}>
        {sel && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <OvrBadge v={overall(sel)} size="lg" />
              <div className="flex-1">
                <div className="text-[12px] font-black">{sel.name} {sel.nat}</div>
                <div className="text-[9px] text-slate-400">
                  #{sel.num} · {sel.age} yaş · {POS_LONG[sel.pos]} · Sözleşme {sel.contract} yıl
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                  Değer 💶 {(sel.value / 1000).toFixed(1)} Mn · Maaş 💶 {(sel.wage / 1000).toFixed(2)} Mn/hafta · Serbest {sel.release > 0 ? `💶 ${(sel.release / 1000).toFixed(1)} Mn` : "—"}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([["Form", sel.form, "emerald"], ["Moral", sel.morale, "violet"], ["Kondisyon", sel.fitness, "sky"]] as const).map(([l, v, c2]) => (
                <div key={l} className="panel !rounded-lg p-1.5">
                  <div className="text-[8px] text-slate-400">{l}</div>
                  <div className="text-[13px] font-black">{Math.round(v)}</div>
                  <Bar v={v} color={c2} h={3} />
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <div className="text-[9px] font-black text-slate-400 tracking-wider">ÖZELLİKLER</div>
              {([["HIZ", sel.pac], ["ŞUT", sel.sho], ["PAS", sel.pas], ["DEF", sel.def], ["FİZİK", sel.phy], ...(sel.pos === "GK" ? [["KALECİLİK", sel.gk] as [string, number]] : [])] as [string, number][]).map(([l, v]) => (
                <AttrBar key={l} label={l} v={v} />
              ))}
            </div>
            <div>
              <div className="text-[9px] font-black text-slate-400 tracking-wider mb-1">İDMAN ODAĞI</div>
              <div className="grid grid-cols-3 gap-1">
                {(["pac", "sho", "pas", "def", "phy", "gk"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      if (c.training[sel.id] === k) delete c.training[sel.id];
                      else c.training[sel.id] = k;
                      ctx.commit();
                    }}
                    className={cx("rounded-lg py-1 text-[9px] font-bold border", c.training[sel.id] === k ? "bg-emerald-400/20 border-emerald-400/50 text-emerald-200" : "border-white/10 text-slate-400")}
                  >
                    {k === "pac" ? "HIZ" : k === "sho" ? "ŞUT" : k === "pas" ? "PAS" : k === "def" ? "DEF" : k === "phy" ? "FİZİK" : "KALECİ"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {([["Maç", sel.stats.apps], ["Gol", sel.stats.goals], ["Asist", sel.stats.assists], ["MOTM", sel.stats.mom]] as const).map(([l, v]) => (
                <div key={l} className="panel !rounded-lg p-1.5 text-center">
                  <div className="text-[8px] text-slate-400">{l}</div>
                  <div className="text-[13px] font-black">{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/* =============================== TAKTİK =============================== */

const PLANS = [
  { id: "bus", name: "Otobüs", icon: "🚌", desc: "5-3-2 · derin savunma, az risk", f: "f532", m: 22, p: 34, lh: 26, w: 38, t: 34, ps: "long" as const },
  { id: "bal", name: "Dengeli", icon: "⚖️", desc: "4-4-2 · dengeli blok", f: "f442", m: 50, p: 48, lh: 45, w: 50, t: 50, ps: "mixed" as const },
  { id: "tiki", name: "Tiki-Taka", icon: "🎯", desc: "4-2-3-1 · kısa pas, yüksek temp", f: "f4231", m: 58, p: 58, lh: 62, w: 62, t: 72, ps: "short" as const },
  { id: "press", name: "Full Baskı", icon: "🔥", desc: "4-3-3 · agresif pres, geniş", f: "f433", m: 74, p: 84, lh: 72, w: 74, t: 78, ps: "mixed" as const },
];

export function TacticsScreen({ ctx }: { ctx: AppCtx }): React.JSX.Element {
  const c = ctx.career!;
  const t = c.tactic;
  const [, force] = React.useState(0);
  const bump = (): void => { force((v) => v + 1); ctx.commit(); };
  return (
    <div className="flex flex-col h-full">
      <Header title="TAKTİK" sub={`${formationById(t.formation).name} · ${PLANS.find((p) => p.f === t.formation && p.m === t.mentality)?.name ?? "Özel"}`} />
      <div className="flex-1 overflow-y-auto sc px-2 pb-3 space-y-2">
        <Panel className="p-2">
          <div className="text-[9px] tracking-[0.2em] text-slate-400 mb-1.5">FORMASYON</div>
          <div className="grid grid-cols-6 gap-1.5">
            {FORMATIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => { t.formation = f.id; c.formation = f.id; reautoLineup(ctx.world, c); bump(); sfxUi(700); }}
                className={cx("rounded-lg py-1.5 text-[9px] font-bold border", t.formation === f.id ? "bg-emerald-400/20 border-emerald-400/50 text-emerald-200" : "border-white/10 text-slate-400")}
              >
                {f.name.split(" ")[0]}
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="p-2">
          <div className="text-[9px] tracking-[0.2em] text-slate-400 mb-1.5">HAZIR PLAN</div>
          <div className="grid grid-cols-4 gap-1.5">
            {PLANS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  t.formation = p.f; c.formation = p.f; t.mentality = p.m; t.pressing = p.p;
                  t.lineHeight = p.lh; t.width = p.w; t.tempo = p.t; t.passing = p.ps;
                  reautoLineup(ctx.world, c); bump(); sfxUi(740);
                }}
                className="panel !rounded-xl p-1.5 text-center hover:bg-white/5"
              >
                <div className="text-[17px] leading-none">{p.icon}</div>
                <div className="text-[9px] font-black mt-1">{p.name}</div>
                <div className="text-[7px] text-slate-500 leading-tight mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="p-2.5 space-y-2">
          <div className="text-[9px] tracking-[0.2em] text-slate-400">İNCE AYAR</div>
          {([
            ["mentality", "Hücum", "Düşük → Yüksek risk"],
            ["pressing", "Pres", "Topa baskı yoğunluğu"],
            ["lineHeight", "Savunma Hattı", "Derin → Yüksek hat"],
            ["width", "Genişlik", "Dar → Geniş blok"],
            ["tempo", "Tempo", "Yavaş → Hızlı oyun"],
          ] as const).map(([k, label, hint]) => (
            <div key={k}>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-bold text-slate-300">{label}</span>
                <span className="text-[10px] font-black text-emerald-300 tabular-nums">{Math.round(t[k])}</span>
              </div>
              <input
                type="range" min={0} max={100} value={t[k]}
                onChange={(e) => { t[k] = +e.target.value; bump(); }}
                className="w-full"
                style={{ ["--p" as string]: `${t[k]}%` }}
              />
              <div className="text-[7px] text-slate-500 -mt-1">{hint}</div>
            </div>
          ))}
          <div>
            <div className="text-[10px] font-bold text-slate-300 mb-1">Pas Stili</div>
            <div className="grid grid-cols-3 gap-1.5">
              {(["short", "mixed", "long"] as const).map((v) => (
                <button key={v} type="button" onClick={() => { t.passing = v; bump(); }}
                  className={cx("rounded-lg py-1.5 text-[9px] font-bold border", t.passing === v ? "bg-emerald-400/20 border-emerald-400/50 text-emerald-200" : "border-white/10 text-slate-400")}>
                  {v === "short" ? "Kısa Pas" : v === "mixed" ? "Karışık" : "Uzun Top"}
                </button>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* =============================== LİG & KUPA =============================== */

export function LeagueScreen({ ctx }: { ctx: AppCtx }): React.JSX.Element {
  const c = ctx.career!;
  const [tab, setTab] = React.useState<"table" | "fixtures" | "cup" | "news">("table");
  const [lgId, setLgId] = React.useState("lig_bymel");
  const table = leagueTable(ctx.world, lgId, c.fixtures);
  return (
    <div className="flex flex-col h-full">
      <Header title="LİG & KUPA" sub={`Sezon ${c.season} · Hafta ${c.round}`} />
      <div className="px-2 pb-1.5 flex items-center gap-2">
        <Tabs
          value={tab} onChange={setTab}
          tabs={[{ id: "table" as const, label: "Puan Durumu" }, { id: "fixtures" as const, label: "Fikstür" }, { id: "cup" as const, label: "Kupa" }, { id: "news" as const, label: "Haberler" }]}
        />
        {tab === "table" && (
          <Tabs size="sm" value={lgId} onChange={setLgId} tabs={LEAGUES.map((l) => ({ id: l.id, label: l.flag }))} />
        )}
      </div>
      <div className="flex-1 overflow-y-auto sc px-2 pb-3">
        {tab === "table" && (
          <Panel className="p-2">
            <div className="grid grid-cols-[18px_1fr_22px_22px_22px_26px_28px] text-[8px] text-slate-500 font-black px-1 pb-1 border-b border-white/10">
              <span>#</span><span>Takım</span><span className="text-center">O</span><span className="text-center">G</span><span className="text-center">B</span><span className="text-center">M</span><span className="text-right">P</span>
            </div>
            {table.map((r, i) => {
              const cl = ctx.world.clubs[r.clubId];
              return (
                <div key={r.clubId} className={cx(
                  "grid grid-cols-[18px_1fr_22px_22px_22px_26px_28px] items-center text-[10px] px-1 py-1 rounded-md",
                  r.clubId === c.clubId && "bg-emerald-400/15 font-black text-emerald-200",
                  i < 3 && r.clubId !== c.clubId && "bg-amber-400/5",
                )}>
                  <span className="text-slate-500 tabular-nums text-[9px]">{i + 1}</span>
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Crest club={cl} size={16} />
                    <span className="truncate">{cl.name}</span>
                  </span>
                  <span className="text-center tabular-nums text-slate-400">{r.p}</span>
                  <span className="text-center tabular-nums text-slate-400">{r.w}</span>
                  <span className="text-center tabular-nums text-slate-400">{r.d}</span>
                  <span className="text-center tabular-nums text-slate-400">{r.l}</span>
                  <span className="text-right tabular-nums font-black">{r.pts}</span>
                </div>
              );
            })}
          </Panel>
        )}
        {tab === "fixtures" && (
          <Panel className="p-2 space-y-1">
            {Array.from({ length: 26 }, (_, i) => i + 1).map((r) => {
              const fx = c.fixtures.filter((f) => f.round === r);
              const mine = fx.find((f) => f.homeId === c.clubId || f.awayId === c.clubId);
              return (
                <div key={r} className={cx("rounded-lg p-1.5", mine ? "bg-emerald-400/10 border border-emerald-400/20" : "bg-white/4")}>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-500 w-8">H{r}</span>
                    {isCupWeek(r) && <span className="tag bg-amber-400/20 text-amber-300">KUPA</span>}
                    {mine ? (
                      <span className="text-[10px] font-bold">
                        {ctx.world.clubs[mine.homeId].short} <span className="tabular-nums text-emerald-300">{mine.hg ?? "-"}</span>
                        <span className="text-slate-500"> - </span>
                        <span className="tabular-nums text-emerald-300">{mine.ag ?? "-"}</span> {ctx.world.clubs[mine.awayId].short}
                      </span>
                    ) : <span className="text-[9px] text-slate-500">Lig maçı (simüle)</span>}
                  </div>
                </div>
              );
            })}
          </Panel>
        )}
        {tab === "cup" && (
          <Panel className="p-2 space-y-1">
            <div className="text-[9px] text-slate-400">Durum: {
              c.cupStage === "won" ? "🏆 Şampiyon" : c.cupStage === "out" ? "Elendik" :
                c.cupStage === "r16" ? "Son 16" : c.cupStage === "qf" ? "Çeyrek Final" : c.cupStage === "sf" ? "Yarı Final" : c.cupStage === "final" ? "FİNAL" : "—"
            }</div>
            {c.cup.filter((t) => t.hg !== null || t.homeId === c.clubId || t.awayId === c.clubId).map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] px-1.5 py-1 rounded-md bg-white/5">
                <span className="tag bg-white/10 text-slate-300 w-9 text-center">{t.stage === "r16" ? "S16" : t.stage === "qf" ? "ÇF" : t.stage === "sf" ? "YF" : "FN"}</span>
                <span className="flex-1 truncate">{ctx.world.clubs[t.homeId]?.short ?? "?"} vs {ctx.world.clubs[t.awayId]?.short ?? "?"}</span>
                <span className="tabular-nums font-bold">{t.hg ?? "-"} - {t.ag ?? "-"}</span>
              </div>
            ))}
          </Panel>
        )}
        {tab === "news" && (
          <Panel className="p-2 space-y-1">
            {c.news.map((n, i) => (
              <div key={i} className={cx("text-[10px] leading-snug px-1.5 py-1 rounded-md", n.hi ? "bg-emerald-400/10 text-emerald-200" : "text-slate-400")}>
                <span className="text-slate-500">S{n.season}·H{n.round} </span>{n.icon} {n.text}
              </div>
            ))}
          </Panel>
        )}
      </div>
    </div>
  );
}

/* =============================== İSTATİSTİKLER =============================== */

export function StatsScreen({ ctx }: { ctx: AppCtx }): React.JSX.Element {
  const [lgId, setLgId] = React.useState("lig_bymel");
  const [mode, setMode] = React.useState<"goals" | "assists" | "rating">("goals");
  const ids = Object.values(ctx.world.clubs).filter((c) => c.leagueId === lgId).map((c) => c.id);
  const list = Object.values(ctx.world.players)
    .filter((p) => ids.includes(p.teamId) && p.stats.apps > 0)
    .sort((a, b) => mode === "goals" ? b.stats.goals - a.stats.goals : mode === "assists" ? b.stats.assists - a.stats.assists : (b.stats.ratingSum / Math.max(1, b.stats.apps)) - (a.stats.ratingSum / Math.max(1, a.stats.apps)))
    .slice(0, 20);
  return (
    <div className="flex flex-col h-full">
      <Header title="İSTATİSTİKLER" sub="Lig bazlı sezon performansı" />
      <div className="px-2 pb-1.5 flex items-center gap-2">
        <Tabs size="sm" value={lgId} onChange={setLgId} tabs={LEAGUES.map((l) => ({ id: l.id, label: `${l.flag} ${l.name.split(" ")[0]}` }))} />
        <Tabs size="sm" value={mode} onChange={setMode} tabs={[{ id: "goals" as const, label: "⚽ Gol" }, { id: "assists" as const, label: "🅰 Asist" }, { id: "rating" as const, label: "⭐ Reyting" }]} />
      </div>
      <div className="flex-1 overflow-y-auto sc px-2 pb-3">
        <Panel className="p-2 space-y-0.5">
          {list.length === 0 && <Empty text="Bu ligde henüz maç oynanmadı" />}
          {list.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 px-1.5 py-1 rounded-md bg-white/5">
              <span className="text-[9px] w-4 text-slate-500 tabular-nums">{i + 1}</span>
              <OvrBadge v={overall(p)} size="sm" />
              <span className="text-[10px] flex-1 truncate">{p.nat} {p.name}</span>
              <span className="text-[8px] text-slate-500">{ctx.world.clubs[p.teamId]?.short}</span>
              <span className="text-[11px] font-black text-emerald-300 w-8 text-right tabular-nums">
                {mode === "goals" ? p.stats.goals : mode === "assists" ? p.stats.assists : (p.stats.ratingSum / Math.max(1, p.stats.apps)).toFixed(2)}
              </span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

/* =============================== AYARLAR =============================== */

export function SettingsScreen({ ctx }: { ctx: AppCtx }): React.JSX.Element {
  const s = ctx.settings;
  const set = (p: Partial<MatchSettings>): void => ctx.setSettings({ ...s, ...p });
  const st = brainStatus();
  const [confirm, setConfirm] = React.useState(0);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const upload = (f: File | null): void => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        localStorage.setItem(FAIK_STORAGE_KEY, String(r.result));
        ctx.toast(`${FAIK_NAME} dokusu yüklendi!`);
        ctx.commit();
      } catch {
        ctx.toast("Görsel çok büyük — daha küçük bir dosya seç.");
      }
    };
    r.readAsDataURL(f);
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="AYARLAR" sub="Maç, oynanış, grafik ve ses" />
      <div className="flex-1 overflow-y-auto sc px-2 pb-3 space-y-2">
        <Panel className="p-2.5">
          <div className="text-[9px] tracking-[0.2em] text-slate-400 mb-1.5">MAÇ</div>
          <Row label="Gerçek Maç Süresi">
            <div className="flex gap-1">
              {[5, 8, 12, 15, 20].map((m) => (
                <button key={m} type="button" onClick={() => set({ realMinutes: m })}
                  className={cx("tag", s.realMinutes === m ? "bg-emerald-400/25 text-emerald-200" : "bg-white/5 text-slate-400")}>{m} dk</button>
              ))}
            </div>
          </Row>
          <div className="text-[8px] text-slate-500 -mt-0.5 mb-1">
            Maç saati her zaman <b className="text-slate-300">90'</b> gösterir; sahada geçen gerçek süre
            <b className="text-emerald-300"> {s.realMinutes} dakikadır</b> (saat {(90 / s.realMinutes).toFixed(1)}× hızlı akar).
          </div>
          <Row label="Zorluk">
            <div className="flex gap-1">
              {["Ç.Kolay", "Kolay", "Normal", "Zor", "Efsane"].map((d, i) => (
                <button key={d} type="button" onClick={() => set({ difficulty: i })} className={cx("tag", s.difficulty === i ? "bg-emerald-400/25 text-emerald-200" : "bg-white/5 text-slate-400")}>{d}</button>
              ))}
            </div>
          </Row>
        </Panel>

        <SaveVaultPanel ctx={ctx} />

        <Panel className="p-2.5">
          <div className="text-[9px] tracking-[0.2em] text-slate-400 mb-1.5">OYNANIŞ YARDIMI ({s.assist}/2)</div>
          <div className="flex gap-1.5">
            {[
              ["Kapalı", "Tam manuel — hata payı yüksek"],
              ["Orta", "Pas nişanı ve top kontrolü desteği"],
              ["Yüksek", "Otomatik köşe nişanı + otomatik sprint"],
            ].map(([t, d], i) => (
              <button key={t} type="button" onClick={() => set({ assist: i })}
                className={cx("flex-1 rounded-xl p-1.5 border text-left", s.assist === i ? "bg-emerald-400/15 border-emerald-400/50" : "border-white/10")}>
                <div className={cx("text-[10px] font-black", s.assist === i ? "text-emerald-200" : "text-slate-300")}>{t}</div>
                <div className="text-[7px] text-slate-500 leading-tight mt-0.5">{d}</div>
              </button>
            ))}
          </div>
          <div className="text-[7px] text-slate-500 mt-1">Yardım yalnızca SENİN takımına uygulanır — rakip gücü değişmez.</div>
        </Panel>

        <Panel className="p-2.5">
          <div className="text-[9px] tracking-[0.2em] text-slate-400 mb-1.5">KAMERA AÇISI</div>
          <div className="grid grid-cols-5 gap-1.5">
            {CAMERAS.map((c: CameraId) => (
              <button key={c} type="button" onClick={() => set({ camera: c })}
                className={cx("rounded-xl p-1.5 border text-center", s.camera === c ? "bg-emerald-400/15 border-emerald-400/50" : "border-white/10")}>
                <div className="text-[14px] leading-none">{c === "broadcast" ? "📺" : c === "tele" ? "🔭" : c === "action" ? "🏃" : c === "behind" ? "🎮" : "🛰️"}</div>
                <div className={cx("text-[8px] font-black mt-1", s.camera === c ? "text-emerald-200" : "text-slate-400")}>{CAMERA_NAME[c]}</div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="p-2.5">
          <div className="text-[9px] tracking-[0.2em] text-slate-400 mb-1.5">GRAFİK & SES</div>
          <Row label="Grafik Kalitesi">
            <div className="flex gap-1">
              {["Düşük", "Orta", "Yüksek"].map((q, i) => (
                <button key={q} type="button" onClick={() => set({ quality: i })} className={cx("tag", s.quality === i ? "bg-emerald-400/25 text-emerald-200" : "bg-white/5 text-slate-400")}>{q}</button>
              ))}
            </div>
          </Row>
          {([
            ["sound", "🔊 Ses Efektleri"],
            ["commentary", "🎙️ Spiker"],
            ["offside", "🚩 Ofsayt"],
            ["autoSwitch", "🔄 Otomatik Oyuncu Değişimi"],
            ["haptics", "📳 Titreşim"],
          ] as const).map(([k, label]) => (
            <Row key={k} label={label}>
              <Toggle v={s[k]} on={() => set({ [k]: !s[k] } as Partial<MatchSettings>)} />
            </Row>
          ))}
        </Panel>

        {/* SAKAT FAİK MODU */}
        <Panel gold className="p-2.5 anim-glow">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="tag bg-amber-400/30 text-amber-100 border border-amber-300/50">ÖZEL</span>
            <span className="text-[12px] font-black text-amber-200">🥅 SAKAT FAİK MODU</span>
            <div className="ml-auto"><Toggle v={s.faikMode} on={() => { set({ faikMode: !s.faikMode }); sfxUi(s.faikMode ? 420 : 900); }} gold /></div>
          </div>
          <p className="text-[9px] text-amber-100/80 leading-relaxed">
            Açtığında maçlar halısaha temelinde oynanır: çim yerine efsanevi {FAIK_NAME} dokusu,
            saha çevresinde tel kafes ve halısaha atmosferi.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => upload(e.target.files?.[0] ?? null)}
            />
            <Btn variant="gold" size="sm" onClick={() => fileRef.current?.click()}>📤 Doku Yükle</Btn>
            <Btn variant="ghost" size="sm" onClick={() => {
              try { localStorage.removeItem(FAIK_STORAGE_KEY); ctx.toast("Doku sıfırlandı (prosedürel halısaha dokusu kullanılır)"); } catch { /* yoksay */ }
            }}>Sıfırla</Btn>
            <span className="text-[7px] text-amber-200/60">Doku kalıcı olarak tarayıcı belleğine gömülür · offline çalışır</span>
          </div>
        </Panel>

        <Panel className="p-2.5">
          <div className="text-[9px] tracking-[0.2em] text-slate-400 mb-1">MOTOR BİLGİSİ</div>
          <div className="text-[9px] text-slate-400 leading-relaxed space-y-0.5">
            <div>3B motor: pinhole kamera projeksiyonu · 5 kamera · ressam algoritması</div>
            <div>Fizik: 60Hz sabit adım · saha 105×68 m · gerçek yerçekimi</div>
            <div>Beyin: kendi Lua yorumlayıcın → <span className={st.lua ? "text-emerald-300" : "text-rose-300"}>{st.lua ? "AKTİF" : "TS YEDEĞİ"}</span> ({st.calls} çağrı)</div>
            <div>Ses: WebAudio prosedürel · dosya yok</div>
            <div>Kayıt: ChaCha20 şifreli · bütünlük etiketli · anahtar kasası {vaultFingerprint()}</div>
          </div>
        </Panel>

        <Panel className="p-2.5">
          <div className="text-[9px] tracking-[0.2em] text-slate-400 mb-1.5">KAYIT</div>
          {confirm === 0 && <Btn variant="danger" size="sm" onClick={() => setConfirm(1)}>🗑 Kaydı Sıfırla</Btn>}
          {confirm === 1 && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-rose-300">Emin misin? Tüm kariyer silinir.</span>
              <Btn variant="danger" size="sm" onClick={() => setConfirm(2)}>Evet, devam</Btn>
              <Btn variant="ghost" size="sm" onClick={() => setConfirm(0)}>Vazgeç</Btn>
            </div>
          )}
          {confirm === 2 && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-rose-400 font-bold">SON ONAY — geri alınamaz!</span>
              <Btn variant="danger" size="sm" onClick={() => { setConfirm(0); ctx.resetSave(); }}>SİL</Btn>
              <Btn variant="ghost" size="sm" onClick={() => setConfirm(0)}>Vazgeç</Btn>
            </div>
          )}
        </Panel>

        {ctx.career && (
          <Panel className="p-2.5">
            <div className="text-[9px] tracking-[0.2em] text-slate-400 mb-1">STADYUM ÖZETİ</div>
            <div className="text-[9px] text-slate-400">
              {ctx.career.stadium.name} · Kapasite {capacity(ctx.career.stadium).toLocaleString("tr-TR")} · Tribün lv{ctx.career.stadium.levels.stands}
            </div>
            <div className="text-[8px] text-slate-500">{sectionEffect("stands", ctx.career.stadium.levels.stands)}</div>
          </Panel>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ŞİFRELİ KAYIT KASASI                                               */
/* ------------------------------------------------------------------ */

/**
 * Kayıt her zaman şifreli tutulur ve oyuncuya ŞİFRE SORULMAZ.
 * Anahtar cihazda üretilir; bu panel yalnızca durumu gösterir ve
 * yedek al / yedekten dön işlemlerini sunar.
 */
function SaveVaultPanel({ ctx }: { ctx: AppCtx }): React.JSX.Element {
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = React.useState(false);

  const exportSave = (): void => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { ctx.toast("Henüz kayıt yok."); return; }
      const blob = new Blob([raw], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `twin-soccer-yedek-${new Date().toISOString().slice(0, 10)}.tssave`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      ctx.toast("Şifreli yedek indirildi.");
    } catch {
      ctx.toast("Yedek alınamadı.");
    }
  };

  const importSave = (f: File | null): void => {
    if (!f) return;
    setBusy(true);
    const r = new FileReader();
    r.onload = () => {
      try {
        localStorage.setItem(SAVE_KEY, String(r.result));
        ctx.toast("Yedek yüklendi — oyun yeniden başlatılıyor…");
        window.setTimeout(() => window.location.reload(), 700);
      } catch {
        ctx.toast("Yedek okunamadı.");
        setBusy(false);
      }
    };
    r.onerror = () => { ctx.toast("Yedek okunamadı."); setBusy(false); };
    r.readAsText(f);
  };

  return (
    <Panel className="p-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[16px]">🔐</span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-black">ŞİFRELİ KAYIT · AKTİF</div>
          <div className="text-[8px] text-slate-500 leading-snug">
            Kariyerin cihazda <b className="text-emerald-300">ChaCha20</b> ile şifrelenip bütünlük
            etiketiyle saklanır. Şifre sorulmaz — anahtar cihazında üretilir ve orada kalır.
          </div>
        </div>
        <span className="chip !text-[8px] text-emerald-300 border-emerald-400/30">KASA {vaultFingerprint()}</span>
      </div>
      <div className="flex gap-1.5 mt-2 items-center">
        <input ref={fileRef} type="file" accept=".tssave,text/plain" className="hidden"
          onChange={(e) => importSave(e.target.files?.[0] ?? null)} />
        <Btn size="sm" variant="dark" onClick={exportSave}>⬇ Yedek Al</Btn>
        <Btn size="sm" variant="ghost" disabled={busy} onClick={() => fileRef.current?.click()}>⬆ Yedekten Dön</Btn>
        <span className="text-[7px] text-slate-600">Yedek dosyası da şifrelidir; yalnızca bu cihazda açılır.</span>
      </div>
    </Panel>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-[10px] text-slate-300 font-bold flex-1">{label}</span>
      {children}
    </div>
  );
}

export function Toggle({ v, on, gold }: { v: boolean; on: () => void; gold?: boolean }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={on}
      className={cx(
        "w-[38px] h-[20px] rounded-full relative transition-colors",
        v ? (gold ? "bg-amber-400" : "bg-emerald-400") : "bg-white/15",
      )}
    >
      <span className={cx(
        "absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white transition-all shadow",
        v ? "left-[20px]" : "left-[2px]",
      )} />
    </button>
  );
}
