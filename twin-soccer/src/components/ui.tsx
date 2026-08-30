import type { CSSProperties, ReactNode } from "react";
import type { Club } from "../game/types";
import { crestMotif, crestShape, crestStars, crestOutline, monogram } from "../game/crest";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

/* ============================ BUTON ============================ */
export function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  className,
  disabled,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "dark" | "danger" | "gold" | "diamond";
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const base =
    "btn-press no-select relative inline-flex items-center justify-center gap-2 rounded-xl font-black tracking-wide overflow-hidden";
  const variants = {
    primary: "bg-gradient-to-b from-emerald-300 to-emerald-600 text-emerald-950 glow-green",
    gold: "bg-gradient-to-b from-amber-200 to-amber-500 text-amber-950 glow-gold",
    diamond: "bg-gradient-to-b from-cyan-200 to-sky-500 text-sky-950",
    dark: "bg-white/7 text-white border border-white/12",
    ghost: "bg-transparent text-white/70 border border-white/10",
    danger: "bg-gradient-to-b from-rose-500 to-rose-700 text-white",
  } as const;
  const sizes = {
    xs: "px-2.5 py-1.5 text-[10px]",
    sm: "px-3 py-2 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3.5 text-base",
  } as const;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={style}
      className={cx(base, variants[variant], sizes[size], disabled && "opacity-40 grayscale", className)}
    >
      {children}
    </button>
  );
}

/* ============================ BAŞLIK ============================ */
export function Header({
  title,
  sub,
  onBack,
  right,
}: {
  title: string;
  sub?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/8 bg-[#070d12]/90 px-4 py-2.5 backdrop-blur-md">
      {onBack && (
        <button
          onClick={onBack}
          className="btn-press grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/8 text-white/80"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-black uppercase tracking-wide">{title}</div>
        {sub && <div className="truncate text-[10px] text-white/45">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function Card({
  children,
  className,
  hi,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  hi?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cx(hi ? "panel-hi" : "panel", "rounded-2xl p-3", onClick && "btn-press cursor-pointer", className)}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">{children}</div>
      {right}
    </div>
  );
}

/* ============================ ARMA ============================ */
export function Crest({ club, size = 40 }: { club: Club; size?: number }) {
  const shape = crestShape(club);
  const id = `cr_${club.id}`;
  const k = club.kit;
  const motif = crestMotif(club);
  const stars = crestStars(club);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
      <defs>
        <clipPath id={`${id}_c`}>
          <path d={crestOutline(shape)} />
        </clipPath>
        <linearGradient id={`${id}_g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id}_c)`}>
        <rect x="0" y="0" width="100" height="100" fill={k.primary} />
        {motif === 0 && <rect x="0" y="0" width="50" height="100" fill={k.secondary} />}
        {motif === 1 && (
          <>
            <rect x="18" y="0" width="12" height="100" fill={k.secondary} />
            <rect x="44" y="0" width="12" height="100" fill={k.secondary} />
            <rect x="70" y="0" width="12" height="100" fill={k.secondary} />
          </>
        )}
        {motif === 2 && <path d="M0 72 L100 20 L100 44 L0 96 Z" fill={k.secondary} />}
        {motif === 3 && (
          <>
            <rect x="0" y="26" width="100" height="12" fill={k.secondary} />
            <rect x="0" y="56" width="100" height="12" fill={k.secondary} />
          </>
        )}
        {motif === 4 && <circle cx="50" cy="52" r="30" fill={k.secondary} />}
        <rect x="0" y="0" width="100" height="100" fill={`url(#${id}_g)`} />
      </g>
      <path d={crestOutline(shape)} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="3.5" />
      <path d={crestOutline(shape)} fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="1.4" />
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fontSize="34"
        fontWeight="900"
        fill="#fff"
        stroke="rgba(0,0,0,0.45)"
        strokeWidth="1"
        fontFamily="system-ui, sans-serif"
      >
        {monogram(club)}
      </text>
      {stars > 0 && (
        <g fill="#fbbf24">
          {Array.from({ length: stars }).map((_, i) => (
            <circle key={i} cx={50 + (i - (stars - 1) / 2) * 13} cy={18} r="3.6" />
          ))}
        </g>
      )}
    </svg>
  );
}

export function KitIcon({ club, size = 34 }: { club: Club; size?: number }) {
  const k = club.kit;
  const id = `k_${club.id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0">
      <defs>
        <clipPath id={`${id}_c`}>
          <path d="M13 5 L20 3 L27 5 L36 10 L32 17 L29 15 L29 35 L11 35 L11 15 L8 17 L4 10 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}_c)`}>
        <rect x="0" y="0" width="40" height="40" fill={k.primary} />
        {k.pattern === "stripes" && (
          <>
            <rect x="10" y="0" width="4" height="40" fill={k.secondary} />
            <rect x="18" y="0" width="4" height="40" fill={k.secondary} />
            <rect x="26" y="0" width="4" height="40" fill={k.secondary} />
          </>
        )}
        {k.pattern === "halves" && <rect x="20" y="0" width="20" height="40" fill={k.secondary} />}
        {k.pattern === "sash" && <path d="M0 30 L40 6 L40 14 L0 38 Z" fill={k.secondary} />}
        {k.pattern === "hoops" && (
          <>
            <rect x="0" y="10" width="40" height="4" fill={k.secondary} />
            <rect x="0" y="20" width="40" height="4" fill={k.secondary} />
            <rect x="0" y="30" width="40" height="4" fill={k.secondary} />
          </>
        )}
      </g>
      <path
        d="M13 5 L20 3 L27 5 L36 10 L32 17 L29 15 L29 35 L11 35 L11 15 L8 17 L4 10 Z"
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="1.2"
      />
    </svg>
  );
}

/* ============================ ROZETLER ============================ */
export const ovrColor = (v: number) =>
  v >= 85 ? "#22c55e" : v >= 78 ? "#84cc16" : v >= 70 ? "#eab308" : v >= 62 ? "#f97316" : "#f43f5e";

export function OvrBadge({ value, size = 34, pos }: { value: number; size?: number; pos?: string }) {
  return (
    <div
      className="relative grid shrink-0 place-items-center rounded-lg font-black tabnum"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(155deg, ${ovrColor(value)}, rgba(0,0,0,0.45))`,
        color: "#fff",
        fontSize: size * 0.4,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.28)",
      }}
    >
      {value}
      {pos && (
        <span
          className="absolute -bottom-1 rounded bg-black/70 px-1 font-black text-white/80"
          style={{ fontSize: Math.max(7, size * 0.24) }}
        >
          {pos}
        </span>
      )}
    </div>
  );
}

export function Bar({
  value,
  color = "#37f28b",
  height = 6,
  track = "rgba(255,255,255,0.1)",
}: {
  value: number;
  color?: string;
  height?: number;
  track?: string;
}) {
  return (
    <div className="w-full overflow-hidden rounded-full" style={{ height, background: track }}>
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </div>
  );
}

/* ============================ PARA BİRİMLERİ ============================ */
export const money = (k: number) => {
  const v = Math.round(k);
  if (Math.abs(v) >= 1000) return `€${(v / 1000).toFixed(Math.abs(v) % 1000 === 0 ? 0 : 1)}M`;
  return `€${v}K`;
};

export const compact = (n: number) => {
  const v = Math.round(n);
  if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (Math.abs(v) >= 10000) return `${Math.round(v / 1000)}K`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
};

export function Coin({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  return (
    <div
      className={cx(
        "flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-400/12 font-black text-amber-200 tabnum",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-sm"
      )}
    >
      <span>🪙</span>
      {compact(value)}
    </div>
  );
}

export function Gem({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  return (
    <div
      className={cx(
        "flex items-center gap-1 rounded-full border border-cyan-300/25 bg-cyan-400/12 font-black text-cyan-200 tabnum",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-sm"
      )}
    >
      <span>💎</span>
      {compact(value)}
    </div>
  );
}

export function Cash({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  return (
    <div
      className={cx(
        "flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-400/12 font-black text-emerald-200 tabnum",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-sm"
      )}
    >
      <span>💶</span>
      {money(value)}
    </div>
  );
}

/* ============================ SEKMELER ============================ */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="no-select flex gap-1 overflow-x-auto rounded-xl bg-white/6 p-1 scroll-x">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            "btn-press flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-black",
            active === t.id ? "bg-gradient-to-b from-emerald-300 to-emerald-500 text-emerald-950" : "text-white/55"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={cx(
        "btn-press h-7 w-12 shrink-0 rounded-full p-0.5 transition-colors",
        on ? "bg-emerald-400" : "bg-white/15"
      )}
    >
      <div className={cx("h-6 w-6 rounded-full bg-white shadow transition-transform", on && "translate-x-5")} />
    </button>
  );
}

/* ============================ MODAL ============================ */
export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-3 anim-fade" onClick={onClose}>
      <div
        className={cx(
          "panel flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl anim-pop",
          wide ? "max-w-3xl" : "max-w-md"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
          <div className="text-xs font-black uppercase tracking-wider">{title}</div>
          <button onClick={onClose} className="btn-press grid h-7 w-7 place-items-center rounded-lg bg-white/8 text-xs">
            ✕
          </button>
        </div>
        <div className="scroll-y flex-1 p-3">{children}</div>
      </div>
    </div>
  );
}

export function StatRow({
  label,
  home,
  away,
  fmt,
}: {
  label: string;
  home: number;
  away: number;
  fmt?: (n: number) => string;
}) {
  const total = home + away || 1;
  const f = fmt ?? ((n: number) => String(n));
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
        <span className="tabnum">{f(home)}</span>
        <span className="text-white/45">{label}</span>
        <span className="tabnum">{f(away)}</span>
      </div>
      <div className="flex h-1.5 gap-0.5">
        <div className="rounded-l-full bg-emerald-400 transition-all" style={{ width: `${(home / total) * 100}%` }} />
        <div className="rounded-r-full bg-sky-400 transition-all" style={{ width: `${(away / total) * 100}%` }} />
      </div>
    </div>
  );
}

/** Seviye göstergesi (stadyum / yetenek) */
export function LevelDots({ level, max = 8, color = "#37f28b" }: { level: number; max?: number; color?: string }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className="h-1.5 flex-1 rounded-full"
          style={{ background: i < level ? color : "rgba(255,255,255,0.12)" }}
        />
      ))}
    </div>
  );
}
