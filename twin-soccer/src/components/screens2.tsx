import React from "react";
import { Btn, Bar, Panel, Header, Tabs, OvrBadge, PlayerRow, AttrBar, Sheet, Empty, Coin, Gem, Cash, cx } from "./ui";
import { Toggle } from "./screens";
import { overall } from "../game/formations";
import {
  buyPlayer, sellPlayer, generateMarket, contractDemand, renewContract, squadOf, news,
} from "../game/career";
import { SECTIONS, upgradeCost, MAX_LEVEL, capacity, sectionEffect, bonusesOf, addManagerXp, xpForLevel, SKILL_DEFS, SHOP, type ShopId } from "../game/economy";
import { POS_LONG, type Player, type PosCode } from "../game/types";
import { sfxUi, sfxSub } from "../game/audio";
import type { AppCtx } from "./screens";

/* =============================== TRANSFER =============================== */

export function TransferScreen({ ctx }: { ctx: AppCtx }): React.JSX.Element {
  const c = ctx.career!;
  const [tab, setTab] = React.useState<"market" | "free" | "sell">("market");
  const [posF, setPosF] = React.useState<"ALL" | PosCode>("ALL");
  const [sel, setSel] = React.useState<{ player: Player; price: number; clubName: string; free: boolean } | null>(null);
  const [, force] = React.useState(0);
  const bump = (): void => { force((v) => v + 1); ctx.commit(); };

  const market = c.market.filter((m) => posF === "ALL" || m.player.pos === posF);
  const squad = squadOf(ctx.world, c.clubId).sort((a, b) => overall(b) - overall(a));

  return (
    <div className="flex flex-col h-full">
      <Header
        title="TRANSFER MERKEZİ"
        sub={`${squad.length}/30 oyuncu · Bütçe 💶 ${(c.budget / 1000).toFixed(1)} Mn`}
        right={
          <Btn size="sm" variant="gold" onClick={() => {
            if (c.gold < 450) { ctx.toast("450 🪙 gerekli"); return; }
            c.gold -= 450;
            c.market = generateMarket(ctx.world, c.clubId, c.manager.skills.scouting);
            bump(); ctx.toast("Gözlemci raporu alındı — piyasa yenilendi");
          }}>🔎 Yenile (450🪙)</Btn>
        }
      />
      <div className="px-2 pb-1.5 flex items-center gap-2">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: "market" as const, label: "PİYASA" }, { id: "free" as const, label: "BONSERVİSSİZ" }, { id: "sell" as const, label: "SAT" }]} />
        <Tabs size="sm" value={posF} onChange={setPosF} tabs={[{ id: "ALL" as const, label: "TÜM" }, ...(["GK", "CB", "LB", "RB", "DM", "CM", "AM", "LW", "RW", "ST"] as PosCode[]).map((p) => ({ id: p, label: p }))]} />
      </div>
      <div className="flex-1 overflow-y-auto sc px-2 pb-3">
        <Panel className="p-1.5 space-y-0.5">
          {tab === "sell" ? (
            squad.length === 0 ? <Empty text="Kadro boş" /> : squad.map((p) => (
              <PlayerRow
                key={p.id} p={p} onClick={() => setSel({ player: p, price: 0, clubName: "Kadron", free: false })}
                right={<span className="text-[9px] text-emerald-300 font-bold">€~{(p.value / 1000).toFixed(1)}Mn</span>}
              />
            ))
          ) : market.length === 0 ? (
            <Empty text="Liste boş — gözlemci raporu al" />
          ) : market.filter((m) => tab === "free" ? m.free : !m.free).map((m) => (
            <PlayerRow
              key={m.player.id} p={m.player}
              onClick={() => setSel(m)}
              right={
                <span className="text-[9px] font-bold text-right">
                  {m.free ? <span className="tag bg-emerald-400/25 text-emerald-200">SERBEST</span> : <span className="text-amber-300">€{(m.price / 1000).toFixed(1)}Mn</span>}
                  <div className="text-[7px] text-slate-500">{m.clubName}</div>
                </span>
              }
            />
          ))}
        </Panel>
      </div>

      <Sheet
        open={!!sel} onClose={() => setSel(null)}
        title={sel ? `${sel.player.name} · ${POS_LONG[sel.player.pos]}` : ""}
        footer={sel && tab !== "sell" ? (
          <Btn variant="primary" onClick={() => {
            const idx = c.market.findIndex((m) => m.player.id === sel!.player.id);
            if (idx < 0) { ctx.toast("Oyuncu listede değil"); return; }
            const r = buyPlayer(ctx.world, c, idx);
            ctx.toast(r.msg);
            if (r.ok) { sfxSub(); setSel(null); }
            bump();
          }}>TEKLİF YAP / İMZALA</Btn>
        ) : sel ? (
          <Btn variant="danger" onClick={() => {
            const r = sellPlayer(ctx.world, c, sel!.player.id);
            ctx.toast(r.msg);
            setSel(null);
            bump();
          }}>OYUNCUYU SAT</Btn>
        ) : undefined}
      >
        {sel && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <OvrBadge v={overall(sel.player)} size="lg" />
              <div className="flex-1">
                <div className="text-[12px] font-black">{sel.player.name} {sel.player.nat}</div>
                <div className="text-[9px] text-slate-400">
                  {sel.player.age} yaş · {POS_LONG[sel.player.pos]} · {sel.clubName}
                </div>
                <div className="text-[9px] text-slate-500">
                  Değer 💶 {(sel.player.value / 1000).toFixed(1)} Mn · Maaş 💶 {(sel.player.wage / 1000).toFixed(2)} Mn/hafta
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {([["Form", sel.player.form, "emerald"], ["Moral", sel.player.morale, "violet"], ["Kondisyon", sel.player.fitness, "sky"]] as const).map(([l, v, cc]) => (
                <div key={l} className="panel !rounded-lg p-1.5">
                  <div className="text-[8px] text-slate-400">{l}</div>
                  <div className="text-[13px] font-black">{Math.round(v)}</div>
                  <Bar v={v} color={cc} h={3} />
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {([["HIZ", sel.player.pac], ["ŞUT", sel.player.sho], ["PAS", sel.player.pas], ["DEF", sel.player.def], ["FİZİK", sel.player.phy], ...(sel.player.pos === "GK" ? [["KALECİLİK", sel.player.gk] as [string, number]] : [])] as [string, number][]).map(([l, v]) => (
                <AttrBar key={l} label={l} v={v} />
              ))}
            </div>
            {tab !== "sell" && (
              <div className="text-[9px] text-slate-400 panel !rounded-lg p-2">
                {sel.free
                  ? "Sözleşmesi bitmiş — bonservis ödemeden imzalayabilirsin."
                  : `Beklenen bonservis 💶 ${(sel.price / 1000).toFixed(1)} Mn · Pazarlık bonusun -%${Math.round((1 - bonusesOf(c).transferCost) * 100)}`}
                <div className="text-[8px] text-slate-500 mt-0.5">Maaş bütçesi haftalık 💶 {(sel.player.wage / 1000).toFixed(2)} Mn olarak yansıtılır.</div>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

/* =============================== SÖZLEŞME =============================== */

export function ContractsScreen({ ctx }: { ctx: AppCtx }): React.JSX.Element {
  const c = ctx.career!;
  const squad = squadOf(ctx.world, c.clubId).sort((a, b) => a.contract - b.contract || overall(b) - overall(a));
  const [sel, setSel] = React.useState<Player | null>(null);
  const [years, setYears] = React.useState(3);
  const [mul, setMul] = React.useState(1);
  const [msg, setMsg] = React.useState("");
  const [, force] = React.useState(0);
  // talep bir kez hesaplanır (her render'da rastgele değişip titremesin)
  const [dem, setDem] = React.useState<ReturnType<typeof contractDemand> | null>(null);
  React.useEffect(() => { setDem(sel ? contractDemand(c, sel) : null); }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = dem;
  const wage = d ? Math.round(d.wage * mul) : 0;
  const accept = d ? Math.max(0.03, Math.min(0.99, d.accept + (mul - 1) * 1.35)) : 0;
  const urgent = squad.filter((p) => p.contract <= 1);

  return (
    <div className="flex flex-col h-full">
      <Header title="SÖZLEŞME YÖNETİMİ" sub={`${urgent.length} oyuncunun sözleşmesi ACİL · Haftalık maaş yükü 💶 ${(squad.reduce((t, p) => t + p.wage, 0) / 1000).toFixed(2)} Mn`} />
      <div className="flex-1 overflow-y-auto sc px-2 pb-3 space-y-2">
        {urgent.length > 0 && (
          <Panel gold className="p-2">
            <div className="text-[9px] text-amber-200 font-black tracking-wider mb-1">⚠️ ACİL — SÜRESİ BİTENLER</div>
            {urgent.map((p) => (
              <PlayerRow key={p.id} p={p} onClick={() => { setSel(p); setYears(3); setMul(1); setMsg(""); }} right={<span className="tag bg-amber-400/25 text-amber-200">{p.contract} yıl</span>} />
            ))}
          </Panel>
        )}
        <Panel className="p-1.5">
          <div className="text-[8px] font-black text-slate-500 px-1 py-0.5 tracking-wider">TÜM KADRO</div>
          {squad.map((p) => (
            <PlayerRow
              key={p.id} p={p}
              onClick={() => { setSel(p); setYears(3); setMul(1); setMsg(""); }}
              right={<span className="text-[9px] text-slate-400 font-bold w-14 text-right">{p.contract} yıl · 💶{p.wage}</span>}
            />
          ))}
        </Panel>
      </div>

      <Sheet
        open={!!sel} onClose={() => setSel(null)}
        title={sel ? `GÖRÜŞME · ${sel.name}` : ""}
        footer={
          <Btn variant="primary" onClick={() => {
            if (!sel) return;
            const r = renewContract(ctx.world, c, sel, wage, years);
            setMsg(r.msg);
            ctx.commit();
            force((v) => v + 1);
            if (r.ok) { sfxSub(); setTimeout(() => setSel(null), 900); }
          }}>TEKLİFİ SUN</Btn>
        }
      >
        {sel && d && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <OvrBadge v={overall(sel)} size="lg" />
              <div className="flex-1">
                <div className="text-[12px] font-black">{sel.name}</div>
                <div className="text-[9px] text-slate-400">{POS_LONG[sel.pos]} · {sel.age} yaş · OVR {overall(sel)}</div>
              </div>
            </div>
            <div className="panel !rounded-lg p-2 text-[9px] text-slate-300 space-y-0.5">
              <div>Talep edilen maaş: <span className="text-amber-300 font-bold">💶 {(d.wage / 1000).toFixed(2)} Mn/hafta</span></div>
              <div>Son sözleşme: {sel.contract} yıl · Mevcut maaş 💶 {(sel.wage / 1000).toFixed(2)} Mn</div>
              <div>Serbest kalma bedeli: 💶 {(d.release / 1000).toFixed(1)} Mn</div>
              <div>Pazarlık yeteneğin: {c.manager.skills.negotiation}/10 (−%{Math.round((1 - bonusesOf(c).wageCost) * 100)} maliyet)</div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-slate-300">Süre</span><span className="text-emerald-300">{years} yıl</span>
              </div>
              <input type="range" min={1} max={5} value={years} onChange={(e) => setYears(+e.target.value)} className="w-full" style={{ ["--p" as string]: `${((years - 1) / 4) * 100}%` }} />
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-slate-300">Maaş teklifi</span>
                <span className="text-amber-300">💶 {(wage / 1000).toFixed(2)} Mn</span>
              </div>
              <input type="range" min={0.7} max={1.6} step={0.05} value={mul} onChange={(e) => setMul(+e.target.value)} className="w-full" style={{ ["--p" as string]: `${((mul - 0.7) / 0.9) * 100}%` }} />
              <div className="text-[7px] text-slate-500">Talebin %{Math.round(mul * 100)}'i · Zam kabul şansını artırır</div>
            </div>
            <div className="panel-hi !rounded-lg p-2">
              <div className="flex justify-between text-[10px] font-black">
                <span className="text-slate-300">Kabul şansı</span>
                <span className={accept > 0.6 ? "text-emerald-300" : accept > 0.35 ? "text-amber-300" : "text-rose-400"}>%{Math.round(accept * 100)}</span>
              </div>
              <Bar v={accept * 100} color={accept > 0.6 ? "emerald" : accept > 0.35 ? "amber" : "rose"} h={5} />
            </div>
            {msg && <div className="text-[10px] font-bold text-emerald-300 panel !rounded-lg p-2">{msg}</div>}
          </div>
        )}
      </Sheet>
    </div>
  );
}

/* =============================== STADYUM =============================== */

function StadiumPreview({ levels, name }: { levels: Record<string, number>; name: string }): React.JSX.Element {
  const s = levels.stands;
  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-white/10" style={{ aspectRatio: "16/7", background: "linear-gradient(180deg,#0a1c2e,#0d2a1a)" }}>
      {/* ışık kuleleri */}
      {[8, 92].map((x, i) => (
        <div key={i}>
          <div className="absolute w-[2px] bg-slate-500" style={{ left: `${x}%`, bottom: `${30 + s * 4}%`, height: `${18 + levels.lights * 3}%` }} />
          <div className="absolute rounded-sm bg-amber-200/90 blur-[2px]" style={{ left: `${x - 3}%`, bottom: `${47 + s * 4 + levels.lights * 3}%`, width: "6%", height: 5 }} />
        </div>
      ))}
      {/* tribünler */}
      {[0, 1].map((k) => (
        <div key={k} className="absolute left-0 right-0 bg-gradient-to-b from-slate-500/70 to-slate-700/70"
          style={{ height: `${6 + s * 2.4}%`, [k === 0 ? "top" : "bottom"]: 0 } as React.CSSProperties}>
          <div className="w-full h-full" style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0 2px, transparent 2px 7px)" }} />
        </div>
      ))}
      {[0, 1].map((k) => (
        <div key={"s" + k} className="absolute top-0 bottom-0 bg-gradient-to-r from-slate-600/60 to-slate-800/60"
          style={{ width: `${4 + s * 1.6}%`, [k === 0 ? "left" : "right"]: 0 } as React.CSSProperties} />
      ))}
      {/* saha */}
      <div className="absolute rounded-sm border border-white/30 overflow-hidden"
        style={{ left: "14%", right: "14%", top: "26%", bottom: "26%", background: "repeating-linear-gradient(90deg,#1f7a3d 0 7%,#1a6b34 7% 14%)" }}>
        <div className="absolute inset-1 border border-white/40" />
        <div className="absolute left-1/2 top-1 bottom-1 w-px bg-white/40" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[18%] aspect-square rounded-full border border-white/40" />
        {levels.screen >= 2 && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[7px] font-black bg-black/70 text-emerald-300 px-1 rounded">📺 {name.slice(0, 12)}</div>
        )}
      </div>
    </div>
  );
}

export function StadiumScreen({ ctx }: { ctx: AppCtx }): React.JSX.Element {
  const c = ctx.career!;
  const [, force] = React.useState(0);
  return (
    <div className="flex flex-col h-full">
      <Header
        title="STADYUM GELİŞTİRME"
        sub={`${c.stadium.name} · Kapasite ${capacity(c.stadium).toLocaleString("tr-TR")}`}
        right={<><Coin v={c.gold} /><Gem v={c.diamonds} /></>}
      />
      <div className="flex-1 overflow-y-auto sc px-2 pb-3 space-y-2">
        <Panel className="p-2">
          <StadiumPreview levels={c.stadium.levels} name={c.stadium.name} />
          <input
            className="w-full mt-2 bg-black/30 rounded-lg px-2 py-1 text-[11px] font-bold border border-white/10 outline-none focus:border-emerald-400/50"
            value={c.stadium.name}
            onChange={(e) => { c.stadium.name = e.target.value; ctx.commit(); }}
            placeholder="Stadyum adı"
          />
        </Panel>

        <div className="grid grid-cols-2 gap-2">
          {SECTIONS.map((s) => {
            const lv = c.stadium.levels[s.id];
            const cost = upgradeCost(s.id, lv);
            const max = lv >= MAX_LEVEL;
            const can = !max && c.gold >= cost.gold && c.diamonds >= cost.diamonds;
            return (
              <Panel key={s.id} className="p-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[17px]">{s.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-black truncate">{s.name}</div>
                    <div className="text-[7px] text-slate-500 truncate">{s.desc}</div>
                  </div>
                  <span className="tag bg-emerald-400/20 text-emerald-300">Lv{lv}</span>
                </div>
                <div className="flex gap-0.5 mt-1.5">
                  {Array.from({ length: MAX_LEVEL }, (_, i) => (
                    <div key={i} className={cx("flex-1 h-1.5 rounded-full", i < lv ? "bg-emerald-400" : "bg-white/10")} />
                  ))}
                </div>
                <div className="text-[8px] text-slate-400 mt-1.5 leading-snug">
                  <div className="text-emerald-300 font-bold">{sectionEffect(s.id, lv)}</div>
                  {!max && <div className="text-slate-500 mt-0.5">→ {sectionEffect(s.id, lv + 1)}</div>}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  {max ? (
                    <span className="tag bg-amber-400/25 text-amber-200">MAKS SEVİYE</span>
                  ) : (
                    <>
                      <Btn size="sm" variant={can ? "primary" : "dark"} disabled={!can} onClick={() => {
                        c.gold -= cost.gold;
                        c.diamonds -= cost.diamonds;
                        c.stadium.levels[s.id] = lv + 1;
                        news(c, s.icon, `${s.name} seviye ${lv + 1}'e yükseltildi. ${sectionEffect(s.id, lv + 1)}`, true);
                        sfxUi(900);
                        ctx.commit();
                        force((v) => v + 1);
                      }}>
                        YÜKSELT
                      </Btn>
                      <span className="text-[8px] font-bold">
                        {cost.gold > 0 && <span className="text-amber-300">🪙{cost.gold.toLocaleString("tr-TR")} </span>}
                        {cost.diamonds > 0 && <span className="text-cyan-300">💎{cost.diamonds}</span>}
                      </span>
                    </>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>

        <Panel className="p-2.5">
          <div className="text-[9px] tracking-[0.2em] text-slate-400 mb-1">AKTİF TESİS BONUSLARI</div>
          <div className="text-[9px] text-slate-300 space-y-0.5">
            {SECTIONS.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="w-4">{s.icon}</span>
                <span className="flex-1 text-slate-400">{s.name}</span>
                <span className="text-emerald-300 font-bold">Lv{c.stadium.levels[s.id]}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* =============================== MENAJER =============================== */

export function ManagerScreen({ ctx }: { ctx: AppCtx }): React.JSX.Element {
  const c = ctx.career!;
  const b = bonusesOf(c);
  const need = xpForLevel(c.manager.level);
  const [, force] = React.useState(0);
  return (
    <div className="flex flex-col h-full">
      <Header title="MENAJER GELİŞİMİ" sub={`Seviye ${c.manager.level} · İtibar ${c.manager.reputation}`} right={<Gem v={c.diamonds} />} />
      <div className="flex-1 overflow-y-auto sc px-2 pb-3 space-y-2">
        <Panel hi className="p-2.5 shine">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-violet-400 to-violet-700 flex items-center justify-center text-[22px]">🧑‍💼</div>
            <div className="flex-1">
              <input
                className="bg-transparent text-[13px] font-black outline-none border-b border-transparent focus:border-emerald-400/50 w-full"
                value={c.manager.name}
                onChange={(e) => { c.manager.name = e.target.value; ctx.commit(); }}
              />
              <div className="text-[9px] text-slate-400 mt-0.5">Seviye {c.manager.level} · XP {c.manager.xp}/{need}</div>
              <div className="mt-1"><Bar v={(c.manager.xp / need) * 100} color="violet" h={5} /></div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-slate-400">Puan</div>
              <div className="text-[20px] font-black txt-neon">{c.manager.points}</div>
            </div>
          </div>
          <div className="text-[8px] text-slate-500 mt-1.5">
            Her seviye: +1 yetenek puanı · +5 💎 · +400 🪙 · Sezon sonu XP: şampiyonluk 420, normal 220
          </div>
        </Panel>

        <Panel className="p-2.5">
          <div className="text-[9px] tracking-[0.2em] text-slate-400 mb-1.5">AKTİF BONUSLAR</div>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              ["Takım verimi", `+${b.teamBoost}`, "emerald"],
              ["Ev avantajı", `+%${Math.round(b.homeAdv * 100)}`, "sky"],
              ["Kondisyon kaybı", `−%${Math.round((1 - b.staminaDrain) * 100)}`, "amber"],
              ["Gelişim", `×${b.growth}`, "violet"],
              ["Transfer maliyeti", `−%${Math.round((1 - b.transferCost) * 100)}`, "emerald"],
              ["Maaş maliyeti", `−%${Math.round((1 - b.wageCost) * 100)}`, "emerald"],
              ["Maç altını", `×${b.goldPerMatch}`, "amber"],
              ["Moral", `+${b.morale}`, "violet"],
              ["İyileşme", `+${b.healing}`, "rose"],
              ["Gözlemci", `+${b.scoutQuality}`, "sky"],
            ] as const).map(([l, v]) => (
              <div key={l} className="flex items-center justify-between panel !rounded-lg px-2 py-1">
                <span className="text-[9px] text-slate-400">{l}</span>
                <span className="text-[10px] font-black text-emerald-300">{v}</span>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid grid-cols-3 gap-2">
          {SKILL_DEFS.map((s) => {
            const lv = c.manager.skills[s.id];
            const can = c.manager.points > 0 && lv < 10;
            return (
              <Panel key={s.id} className="p-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[16px]">{s.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black truncate">{s.name}</div>
                    <div className="text-[7px] text-slate-500 leading-tight">{s.desc}</div>
                  </div>
                </div>
                <div className="flex gap-0.5 mt-1.5">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} className={cx("flex-1 h-1.5 rounded-full", i < lv ? "bg-violet-400" : "bg-white/10")} />
                  ))}
                </div>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-[10px] font-black text-violet-300">{lv}/10</span>
                  <Btn size="sm" variant={can ? "diamond" : "dark"} disabled={!can} className="ml-auto !px-2"
                    onClick={() => {
                      c.manager.points--;
                      c.manager.skills[s.id]++;
                      addManagerXp(c, 10);
                      sfxUi(820);
                      ctx.commit();
                      force((v) => v + 1);
                    }}>+1</Btn>
                </div>
              </Panel>
            );
          })}
        </div>

        <Panel className="p-2.5">
          <div className="text-[9px] tracking-[0.2em] text-slate-400 mb-1">KARİYER GEÇMİŞİ</div>
          {c.history.length === 0 && <div className="text-[9px] text-slate-500">Henüz tamamlanmış sezon yok</div>}
          {c.history.map((h) => (
            <div key={h.season} className="flex items-center gap-2 text-[10px] py-0.5">
              <span className="text-slate-500 w-10">Sezon {h.season}</span>
              <span className={cx("font-black", h.pos === 1 ? "text-amber-300" : "text-slate-300")}>{h.pos}. {h.champion ? "🏆" : ""}</span>
              <span className="text-slate-500">{h.pts} p</span>
              <span className="ml-auto text-[9px] text-slate-400">{h.cup}</span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

/* =============================== MAĞAZA =============================== */

export function ShopScreen({ ctx }: { ctx: AppCtx }): React.JSX.Element {
  const c = ctx.career!;
  const [, force] = React.useState(0);
  const apply = (id: ShopId): void => {
    const it = SHOP.find((s) => s.id === id)!;
    if (it.costGold > c.gold) { ctx.toast("Yetersiz altın 🪙"); return; }
    if (it.costDiamonds > c.diamonds) { ctx.toast("Yetersiz elmas 💎"); return; }
    if (it.costCash > c.budget) { ctx.toast("Yetersiz bütçe 💶"); return; }
    c.gold -= it.costGold;
    c.diamonds -= it.costDiamonds;
    c.budget -= it.costCash;
    switch (id) {
      case "gold_to_cash": c.budget += 2500; break;
      case "cash_to_gold": c.gold += 700; break;
      case "gem_to_gold": c.gold += 260; break;
      case "gold_to_gem": c.diamonds += 1; break;
      case "heal": squadOf(ctx.world, c.clubId).forEach((p) => { p.injury = 0; }); break;
      case "morale": squadOf(ctx.world, c.clubId).forEach((p) => { p.morale = Math.min(100, p.morale + 25); }); break;
      case "fitness": squadOf(ctx.world, c.clubId).forEach((p) => { p.fitness = 100; }); break;
      case "scout": c.market = generateMarket(ctx.world, c.clubId, c.manager.skills.scouting); break;
      case "skillpoint": c.manager.points += 1; break;
    }
    news(c, "🛒", `Mağaza: ${it.name} alındı.`);
    sfxUi(900);
    ctx.toast(`${it.name} → tamamlandı`);
    ctx.commit();
    force((v) => v + 1);
  };
  return (
    <div className="flex flex-col h-full">
      <Header title="MAĞAZA" sub="Üç para birimli kulüp ekonomisi" right={<><Cash v={c.budget} /><Coin v={c.gold} /><Gem v={c.diamonds} /></>} />
      <div className="flex-1 overflow-y-auto sc px-2 pb-3 space-y-2">
        <Panel hi className="p-2.5">
          <div className="text-[10px] font-black txt-neon mb-1">EKONOMİ SİSTEMİ</div>
          <div className="text-[9px] text-slate-400 leading-relaxed">
            <div>💶 <b>Bütçe</b> — transfer ve maaş ekonomisi. Maç günü geliri, sezon primi, satışlar.</div>
            <div>🪙 <b>Altın</b> — kulüp geliştirme. Maç geliri + galibiyet/gol/gol yememe primleri + görevler.</div>
            <div>💎 <b>Elmas</b> — nadir. Farklı galibiyet +2, her 3 maçlık seri +3, kupa turu +1, seviye atlamada +5.</div>
          </div>
        </Panel>
        <div className="grid grid-cols-3 gap-2">
          {SHOP.map((s) => {
            const can = c.gold >= s.costGold && c.diamonds >= s.costDiamonds && c.budget >= s.costCash;
            return (
              <Panel key={s.id} className="p-2 flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-[17px]">{s.icon}</span>
                  <div className="text-[10px] font-black leading-tight">{s.name}</div>
                </div>
                <div className="text-[8px] text-slate-500 mt-1 leading-snug flex-1">{s.desc}</div>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-[9px] font-bold">
                    {s.costGold > 0 && <span className="text-amber-300">🪙{s.costGold} </span>}
                    {s.costDiamonds > 0 && <span className="text-cyan-300">💎{s.costDiamonds} </span>}
                    {s.costCash > 0 && <span className="text-emerald-300">💶{(s.costCash / 1000).toFixed(1)}Mn</span>}
                  </span>
                  <Btn size="sm" variant={can ? "primary" : "dark"} disabled={!can} className="ml-auto !px-2" onClick={() => apply(s.id)}>AL</Btn>
                </div>
              </Panel>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* =============================== GÖREV / DİĞER =============================== */

export function SimpleToggleDemo(): React.JSX.Element {
  const [v, setV] = React.useState(true);
  return <Toggle v={v} on={() => setV(!v)} />;
}
