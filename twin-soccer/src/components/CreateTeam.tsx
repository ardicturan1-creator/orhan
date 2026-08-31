import React from "react";
import { Btn, Panel, Header, Crest, Tabs, cx } from "./ui";
import { CREST_NAMES, PALETTE, PATTERNS, START_LEVELS, autoShort, contrastOn, emptyDraft, type Draft } from "../game/custom";
import { LEAGUES } from "../game/data/clubs";
import { overall } from "../game/formations";
import { sfxUi } from "../game/audio";
import type { Club, Player, World } from "../game/types";

/** KENDİ TAKIMINI KUR ekranı — isim, şehir, forma, arma, başlangıç gücü ve kadro üretimi. */
export function CreateTeamScreen({
  world, onDone, onCancel,
}: { world: World; onDone: (draft: Draft) => void; onCancel: () => void }): React.JSX.Element {
  const [d, setD] = React.useState<Draft>(() => emptyDraft());
  const [squad, setSquad] = React.useState<Player[] | null>(null);
  const set = (p: Partial<Draft>): void => setD((x) => ({ ...x, ...p }));

  const nameOk = d.name.trim().length >= 2;
  const draft: Club = {
    id: "preview", name: d.name.trim() || "Takımım", short: d.short || autoShort(d.name || "TAK"),
    city: d.city.trim() || "—", leagueId: d.leagueId, rating: d.rating,
    kit: { primary: d.primary, secondary: d.secondary, shorts: d.shorts, pattern: d.pattern },
    gkKit: { primary: d.gkPrimary, secondary: d.gkSecondary, shorts: "#111827", pattern: "plain" },
    budget: 0, crest: d.crest,
  };

  return (
    <div className="flex flex-col h-full">
      <Header
        title="KENDİ TAKIMINI KUR"
        sub="İsim, forma ve başlangıç gücünü seç — bir kez kurunca bu takımla oynarsın"
        onBack={onCancel}
      />
      <div className="flex-1 overflow-y-auto sc px-2 pb-3 space-y-2">
        {/* kimlik */}
        <Panel hi className="p-2.5 shine">
          <div className="flex items-center gap-3">
            <Crest club={draft} size={58} />
            <div className="flex-1 space-y-1.5">
              <div>
                <div className="text-[8px] text-slate-400 font-black tracking-wider mb-0.5">TAKIM ADI</div>
                <input
                  className="w-full bg-black/35 rounded-lg px-2 py-1.5 text-[13px] font-black outline-none border border-white/10 focus:border-emerald-400/60"
                  placeholder="Örn. Yıldırımspor"
                  maxLength={26}
                  value={d.name}
                  onChange={(e) => set({ name: e.target.value, short: autoShort(e.target.value) })}
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <div className="text-[8px] text-slate-400 font-black tracking-wider mb-0.5">KISA KOD</div>
                  <input
                    className="w-full bg-black/35 rounded-lg px-2 py-1 text-[11px] font-black uppercase outline-none border border-white/10 focus:border-emerald-400/60"
                    maxLength={4}
                    value={d.short}
                    onChange={(e) => set({ short: e.target.value.toLocaleUpperCase("tr-TR") })}
                  />
                </div>
                <div>
                  <div className="text-[8px] text-slate-400 font-black tracking-wider mb-0.5">ŞEHİR</div>
                  <input
                    className="w-full bg-black/35 rounded-lg px-2 py-1 text-[11px] font-black outline-none border border-white/10 focus:border-emerald-400/60"
                    placeholder="Örn. İzmir"
                    maxLength={20}
                    value={d.city}
                    onChange={(e) => set({ city: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        </Panel>

        {/* forma tasarımı */}
        <Panel className="p-2.5">
          <div className="text-[9px] tracking-[0.22em] text-slate-400 mb-1.5">FORMA TASARIMI</div>
          <div className="flex gap-3">
            {/* forma önizleme */}
            <div className="shrink-0 w-[74px] flex flex-col items-center gap-1">
              <svg viewBox="0 0 100 100" className="w-full">
                <defs>
                  <clipPath id="jerseyClip">
                    <path d="M30,8 L44,3 Q50,10 56,3 L70,8 L88,22 L76,36 L72,30 L72,94 L28,94 L28,30 L24,36 L12,22 Z" />
                  </clipPath>
                </defs>
                <g clipPath="url(#jerseyClip)">
                  <rect x="0" y="0" width="100" height="100" fill={d.primary} />
                  {d.pattern === "stripes" && Array.from({ length: 6 }, (_, i) => (
                    <rect key={i} x={12 + i * 14} y="0" width="7" height="100" fill={d.secondary} />
                  ))}
                  {d.pattern === "halves" && <rect x="50" y="0" width="50" height="100" fill={d.secondary} />}
                  {d.pattern === "sash" && (
                    <g transform="rotate(-40 50 50)"><rect x="42" y="-30" width="16" height="160" fill={d.secondary} /></g>
                  )}
                  {d.pattern === "hoops" && Array.from({ length: 5 }, (_, i) => (
                    <rect key={i} x="0" y={10 + i * 18} width="100" height="8" fill={d.secondary} />
                  ))}
                  {d.pattern === "third" && <rect x="0" y="0" width="42" height="46" fill={d.secondary} />}
                </g>
                <path d="M30,8 L44,3 Q50,10 56,3 L70,8 L88,22 L76,36 L72,30 L72,94 L28,94 L28,30 L24,36 L12,22 Z"
                  fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
                <rect x="28" y="92" width="44" height="8" fill={d.shorts} />
                <text x="50" y="62" textAnchor="middle" fontSize="20" fontWeight="900"
                  fill={contrastOn(d.primary)} fontFamily="system-ui">{d.short || "TS"}</text>
              </svg>
              <div className="text-[7px] text-slate-500">FORMA</div>
            </div>

            <div className="flex-1 space-y-2">
              {([["primary", "Ana Renk"], ["secondary", "İkincil Renk"], ["shorts", "Şort"]] as const).map(([k, label]) => (
                <div key={k}>
                  <div className="text-[8px] text-slate-400 font-black tracking-wider mb-1">{label}</div>
                  <div className="grid grid-cols-9 gap-1">
                    {PALETTE.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        title={c.name}
                        onClick={() => { set({ [k]: c.hex } as Partial<Draft>); sfxUi(680, 0.04); }}
                        className={cx("h-5 rounded-md border transition-transform active:scale-90",
                          d[k] === c.hex ? "border-white ring-2 ring-emerald-400 scale-110" : "border-white/15")}
                        style={{ background: c.hex }}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <div className="text-[8px] text-slate-400 font-black tracking-wider mb-1">DESEN</div>
                <div className="grid grid-cols-6 gap-1">
                  {PATTERNS.map((pt) => (
                    <button key={pt.id} type="button" onClick={() => set({ pattern: pt.id })}
                      className={cx("rounded-lg py-1 border text-[8px] font-bold",
                        d.pattern === pt.id ? "bg-emerald-400/20 border-emerald-400/50 text-emerald-200" : "border-white/10 text-slate-400")}>
                      <div className="text-[12px] leading-none">{pt.icon}</div>
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Panel>

        {/* arma + lig + güç */}
        <div className="grid grid-cols-2 gap-2">
          <Panel className="p-2.5">
            <div className="text-[9px] tracking-[0.22em] text-slate-400 mb-1.5">ARMA ŞEKLİ</div>
            <div className="grid grid-cols-5 gap-1">
              {CREST_NAMES.map((n, i) => (
                <button key={n} type="button" onClick={() => set({ crest: i })}
                  className={cx("rounded-lg py-1 border text-[7px] font-bold",
                    d.crest === i ? "bg-emerald-400/20 border-emerald-400/50 text-emerald-200" : "border-white/10 text-slate-400")}>
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="text-[8px] text-slate-500 mt-1">{CREST_NAMES[d.crest]} · monogram {d.short || "TS"}</div>
          </Panel>
          <Panel className="p-2.5">
            <div className="text-[9px] tracking-[0.22em] text-slate-400 mb-1.5">BAŞLANGIÇ GÜCÜ</div>
            <div className="space-y-1">
              {START_LEVELS.map((l) => (
                <button key={l.label} type="button" onClick={() => set({ rating: l.rating })}
                  className={cx("w-full rounded-lg px-2 py-1 border text-left",
                    d.rating === l.rating ? "bg-emerald-400/15 border-emerald-400/50" : "border-white/10")}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black text-emerald-300 w-5">{l.rating}</span>
                    <span className={cx("text-[9px] font-bold", d.rating === l.rating ? "text-emerald-200" : "text-slate-300")}>{l.label}</span>
                  </div>
                  <div className="text-[7px] text-slate-500">{l.desc}</div>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        <Panel className="p-2.5">
          <div className="text-[9px] tracking-[0.22em] text-slate-400 mb-1.5">LİG</div>
          <Tabs value={d.leagueId} onChange={(v) => set({ leagueId: v })}
            tabs={LEAGUES.map((l) => ({ id: l.id, label: `${l.flag} ${l.name}` }))} />
        </Panel>

        {/* kadro önizleme */}
        {squad && (
          <Panel hi className="p-2.5 anim-pop">
            <div className="text-[9px] tracking-[0.22em] text-slate-400 mb-1.5">ÜRETİLEN KADRO (23)</div>
            <div className="grid grid-cols-4 gap-1 max-h-[168px] overflow-y-auto sc pr-1">
              {squad.map((p) => (
                <div key={p.id} className="rounded-lg bg-white/5 p-1 text-center">
                  <div className="text-[12px] font-black txt-neon leading-none">{overall(p)}</div>
                  <div className="text-[7px] font-bold truncate mt-0.5">{p.name.split(" ").slice(-1)[0]}</div>
                  <div className="text-[6px] text-slate-500">{p.pos} · {p.age}</div>
                </div>
              ))}
            </div>
            <Btn variant="primary" shine className="w-full mt-2" size="lg" disabled={!nameOk}
              onClick={() => onDone(d)}>
              ⚽ {d.name.trim().toUpperCase()} İLE OYNAMAYA BAŞLA
            </Btn>
          </Panel>
        )}

        {!squad && (
          <Btn variant="primary" shine size="lg" className="w-full" disabled={!nameOk}
            onClick={() => {
              sfxUi(900, 0.1);
              setSquad(world ? [] : []);
              // kadro önizlemesini üret (geçici kopya)
              // ÖNİZLEME dünyayı DEĞİŞTİRMEZ (eski kod oyuncuların kulüplerini bozuyordu)
              import("../game/world").then((m) => {
                setSquad(m.previewSquad(d.rating, d.leagueId));
              });
            }}>
            🎲 KADROYU ÜRET
          </Btn>
        )}
        {!nameOk && <div className="text-[9px] text-rose-400 text-center">Takım adı en az 2 karakter olmalı.</div>}
      </div>
    </div>
  );
}
