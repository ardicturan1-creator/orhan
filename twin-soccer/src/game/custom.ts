import type { KitPattern, Region } from "./types";

/** Kendi takımını kurma ekranı için sabitler ve taslak (draft) modeli. */

export interface Draft {
  name: string;
  short: string;
  city: string;
  leagueId: string;
  primary: string;
  secondary: string;
  shorts: string;
  pattern: KitPattern;
  gkPrimary: string;
  gkSecondary: string;
  crest: number;
  rating: number;      // başlangıç kadro gücü
}

export const PALETTE: { name: string; hex: string }[] = [
  { name: "Kırmızı", hex: "#dc2626" }, { name: "Bordo", hex: "#7f1d1d" },
  { name: "Turuncu", hex: "#f97316" }, { name: "Amber", hex: "#f59e0b" },
  { name: "Sarı", hex: "#facc15" }, { name: "Limon", hex: "#a3e635" },
  { name: "Yeşil", hex: "#16a34a" }, { name: "Koyu Yeşil", hex: "#065f46" },
  { name: "Turkuaz", hex: "#06b6d4" }, { name: "Gök", hex: "#0ea5e9" },
  { name: "Mavi", hex: "#1d4ed8" }, { name: "Lacivert", hex: "#172554" },
  { name: "Mor", hex: "#7c3aed" }, { name: "Erguvan", hex: "#a21caf" },
  { name: "Pembe", hex: "#ec4899" }, { name: "Beyaz", hex: "#f5f7fa" },
  { name: "Gri", hex: "#64748b" }, { name: "Siyah", hex: "#111827" },
];

export const PATTERNS: { id: KitPattern; label: string; icon: string }[] = [
  { id: "plain", label: "Düz", icon: "▬" },
  { id: "stripes", label: "Çizgili", icon: "▤" },
  { id: "halves", label: "Yarım", icon: "◫" },
  { id: "sash", label: "Kuşak", icon: "⟋" },
  { id: "hoops", label: "Halka", icon: "≣" },
  { id: "third", label: "Üçlü", icon: "◧" },
];

export const CREST_NAMES = ["Kalkan", "Yuvarlak", "Bayrak", "Baklava", "Altıgen"];

export const START_LEVELS = [
  { label: "Zor Mücadele", rating: 66, desc: "Düşük bütçe, genç kadro" },
  { label: "Dengeli Başlangıç", rating: 72, desc: "Ortalama bütçe ve kadro" },
  { label: "Güçlü Proje", rating: 78, desc: "Yüksek bütçe, iddialı kadro" },
  { label: "Elit Kulüp", rating: 83, desc: "Dev bütçe, yıldız kadro" },
];

export function emptyDraft(): Draft {
  return {
    name: "",
    short: "",
    city: "",
    leagueId: "lig_bymel",
    primary: "#1d4ed8",
    secondary: "#facc15",
    shorts: "#172554",
    pattern: "plain",
    gkPrimary: "#22d3ee",
    gkSecondary: "#111827",
    crest: 0,
    rating: 72,
  };
}

/** İsimden otomatik kısaltma üretir (ilk 3 büyük harf / baş harfler). */
export function autoShort(name: string): string {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return "";
  const parts = clean.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 3).toLocaleUpperCase("tr-TR");
  return parts.slice(0, 3).map((p) => p[0]).join("").toLocaleUpperCase("tr-TR");
}

/** Kontrast metin rengi (arma/forma üzerinde okunabilirlik için). */
export function contrastOn(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number): number => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? "#0b1220" : "#ffffff";
}

export const LEAGUE_REGION: Record<string, Region> = {
  lig_bymel: "tr",
  lig_adria: "eu",
  lig_atl: "lat",
  lig_desert: "af",
};
