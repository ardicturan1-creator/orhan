import React from "react";
import { crestSvg } from "../game/crest";
import { overall } from "../game/formations";
import type { Club, Player } from "../game/types";

export const cx = (...a: (string | false | null | undefined)[]): string => a.filter(Boolean).join(" ");

/* ------------------------------ Buton ------------------------------ */

type BtnVariant = "primary" | "gold" | "diamond" | "dark" | "ghost" | "danger";
export function Btn({
  children, onClick, variant = "dark", className = "", disabled, shine, size = "md", title,
}: {
  children: React.ReactNode; onClick?: () => void; variant?: BtnVariant; className?: string;
  disabled?: boolean; shine?: boolean; size?: "sm" | "md" | "lg"; title?: string;
}): React.JSX.Element {
  const sz = size === "sm" ? "text-[10px] px-2.5 py-1.5" : size === "lg" ? "text-sm px-5 py-2.5" : "";
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={() => { if (!disabled) onClick?.(); }}
      className={cx("btn", `btn-${variant}`, shine && "shine", sz, className)}
    >
      {children}
    </button>
  );
}

/* ------------------------------ Kart / Panel ------------------------------ */

export function Panel({
  children, hi, gold, className = "", onClick,
}: { children: React.ReactNode; hi?: boolean; gold?: boolean; className?: string; onClick?: () => void }): React.JSX.Element {
  return (
    <div
      onClick={onClick}
      className={cx(hi ? "panel-hi" : gold ? "panel-gold" : "panel", className, onClick && "cursor-pointer active:scale-[0.99] transition-transform")}
    >
      {children}
    </div>
  );
}

export function Header({
  title, sub, right, onBack,
}: { title: string; sub?: string; right?: React.ReactNode; onBack?: () => void }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 px-2 pt-1.5 pb-1.5 shrink-0">
      {onBack && (
        <button onClick={onBack} className="btn btn-ghost !px-2.5 !py-1.5 text-[11px]" type="button">←</button>
      )}
      <div className="min-w-0 flex items-center gap-2">
        <span className="w-[3px] h-[26px] bg-gradient-to-b from-emerald-300 to-emerald-700 shadow-[0_0_10px_rgba(43,245,160,0.8)]" />
        <div className="min-w-0">
          <div className="text-[16px] tsx-title txt-neon">{title}</div>
          {sub && <div className="tsx-kicker mt-[3px] truncate">{sub}</div>}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-1.5">{right}</div>
    </div>
  );
}

/* ------------------------------ Rozetler ------------------------------ */

export function OvrBadge({ v, size = "md", pos }: { v: number; size?: "sm" | "md" | "lg"; pos?: string }): React.JSX.Element {
  const c = v >= 84 ? "from-cyan-200 via-emerald-300 to-emerald-600 text-emerald-950"
    : v >= 78 ? "from-emerald-200 to-emerald-600 text-emerald-950"
      : v >= 70 ? "from-lime-200 to-lime-600 text-lime-950"
        : v >= 62 ? "from-amber-200 to-amber-600 text-amber-950"
          : "from-slate-300 to-slate-500 text-slate-900";
  const s = size === "sm" ? "w-[26px] h-[30px] text-[11px]" : size === "lg" ? "w-[42px] h-[48px] text-[19px]" : "w-[32px] h-[37px] text-[13px]";
  return (
    <div className={cx("ovr bg-gradient-to-b shrink-0", c, s)}>
      <span className="leading-none">{v}</span>
      {pos && <span className="text-[6.5px] font-black opacity-70 tracking-widest mt-[1px]">{pos}</span>}
    </div>
  );
}

export function Coin({ v }: { v: number }): React.JSX.Element {
  return <span className="chip !text-[10px] text-amber-300 border-amber-400/30 bg-amber-400/10">🪙 {v.toLocaleString("tr-TR")}</span>;
}
export function Gem({ v }: { v: number }): React.JSX.Element {
  return <span className="chip !text-[10px] text-cyan-300 border-cyan-400/30 bg-cyan-400/10">💎 {v}</span>;
}
export function Cash({ v }: { v: number }): React.JSX.Element {
  return <span className="chip !text-[10px] text-emerald-300 border-emerald-400/30 bg-emerald-400/10">💶 {(v / 1000).toFixed(1)} Mn</span>;
}

/* ------------------------------ Arma ------------------------------ */

export function Crest({ club, size = 34 }: { club: Club; size?: number }): React.JSX.Element {
  const svg = React.useMemo(() => crestSvg(club, size), [club, size]);
  return (
    <div
      className="shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/* ------------------------------ Çubuklar ------------------------------ */

export function Bar({
  v, max = 100, color = "emerald", h = 4, label,
}: { v: number; max?: number; color?: string; h?: number; label?: string }): React.JSX.Element {
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  const grad: Record<string, string> = {
    emerald: "from-emerald-400 to-emerald-600",
    amber: "from-amber-300 to-amber-600",
    rose: "from-rose-400 to-rose-600",
    sky: "from-sky-300 to-sky-600",
    violet: "from-violet-300 to-violet-600",
  };
  return (
    <div className="w-full">
      <div className="bg-white/8 overflow-hidden skew-x-[-18deg]" style={{ height: h }}>
        <div className={cx("h-full bg-gradient-to-r transition-all duration-300", grad[color] ?? grad.emerald)} style={{ width: `${pct}%` }} />
      </div>
      {label && <div className="text-[8px] text-slate-400 mt-0.5">{label}</div>}
    </div>
  );
}

export function AttrBar({ label, v }: { label: string; v: number }): React.JSX.Element {
  const color = v >= 85 ? "emerald" : v >= 72 ? "sky" : v >= 58 ? "amber" : "rose";
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] w-6 text-slate-400 font-bold">{label}</span>
      <div className="flex-1"><Bar v={v} color={color} h={5} /></div>
      <span className="text-[10px] font-black w-6 text-right tabular-nums">{v}</span>
    </div>
  );
}

/* ------------------------------ Oyuncu satırı ------------------------------ */

export function PlayerRow({
  p, right, onClick, active, sub,
}: { p: Player; right?: React.ReactNode; onClick?: () => void; active?: boolean; sub?: boolean }): React.JSX.Element {
  const ovr = overall(p);
  return (
    <div
      onClick={onClick}
      className={cx(
        "flex items-center gap-2 px-2 py-1.5 mb-1 pcard transition-all",
        onClick && "cursor-pointer lift",
        active && "pcard-hi",
      )}
    >
      <OvrBadge v={ovr} size="sm" pos={p.pos} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-bold truncate">{p.name}</span>
          <span className="text-[10px]">{p.nat}</span>
          {p.injury > 0 && <span className="tag bg-rose-500/20 text-rose-300">🚑{p.injury}</span>}
          {p.contract <= 1 && <span className="tag bg-amber-500/20 text-amber-300">ACİL</span>}
          {sub && <span className="tag bg-white/10 text-slate-300">YEDEK</span>}
        </div>
        <div className="flex items-center gap-2 text-[8px] text-slate-400">
          <span>{p.age} yaş</span>
          <span>💰 {(p.value / 1000).toFixed(1)}Mn</span>
          <span>Form {Math.round(p.form)}</span>
        </div>
      </div>
      {right}
    </div>
  );
}

/* ----------------============== Sheet ----------------============== */

export function Sheet({
  open, onClose, title, children, footer,
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }): React.JSX.Element | null {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx("relative panel-hi w-full sm:w-auto sm:min-w-[460px] max-h-[92%] overflow-hidden anim-pop m-1")}>
        <div className="flex items-center gap-2 px-3 py-2 hair">
          <div className="text-[13px] font-black txt-neon">{title}</div>
          <button onClick={onClose} type="button" className="ml-auto btn btn-ghost !px-2 !py-1 text-[11px]">✕</button>
        </div>
        <div className="p-3 overflow-y-auto sc max-h-[62vh]">{children}</div>
        {footer && <div className="p-2 hair flex items-center gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------ Sekme ------------------------------ */

export function Tabs<T extends string>({
  tabs, value, onChange, size = "md",
}: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void; size?: "sm" | "md" }): React.JSX.Element {
  return (
    <div className="flex gap-0.5 overflow-x-auto sc bg-black/40 shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cx(
            "relative font-black uppercase tracking-wider whitespace-nowrap transition-all",
            size === "sm" ? "px-2.5 py-1.5 text-[9px]" : "px-3.5 py-2 text-[10px]",
            value === t.id
              ? "text-white bg-gradient-to-b from-emerald-400/20 to-transparent after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:bg-gradient-to-r after:from-emerald-300 after:to-emerald-600 after:shadow-[0_0_10px_rgba(43,245,160,0.9)]"
              : "text-slate-500 hover:text-slate-300",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function StatRow({ l, a, b, hi }: { l: string; a: number | string; b: number | string; hi?: boolean }): React.JSX.Element {
  const na = typeof a === "number" ? a : 0;
  const nb = typeof b === "number" ? b : 0;
  const tot = na + nb || 1;
  return (
    <div className={cx("flex items-center gap-2 py-1", hi && "text-emerald-300 font-bold")}>
      <span className="w-9 text-right text-[11px] font-black tabular-nums">{a}</span>
      <div className="flex-1">
        <div className="text-[9px] text-slate-400 text-center leading-none">{l}</div>
        <div className="flex h-1 gap-0.5 mt-0.5">
          <div className="flex-1 bg-white/5 rounded-l-full overflow-hidden flex justify-end">
            <div className="h-full bg-emerald-400/70" style={{ width: `${(na / tot) * 100}%` }} />
          </div>
          <div className="flex-1 bg-white/5 rounded-r-full overflow-hidden">
            <div className="h-full bg-sky-400/70" style={{ width: `${(nb / tot) * 100}%` }} />
          </div>
        </div>
      </div>
      <span className="w-9 text-[11px] font-black tabular-nums">{b}</span>
    </div>
  );
}

export function Empty({ text }: { text: string }): React.JSX.Element {
  return <div className="text-center text-[10px] text-slate-500 py-6">{text}</div>;
}
