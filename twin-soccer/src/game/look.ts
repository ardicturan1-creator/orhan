import { hashStr } from "./rng";
import type { Look, Player } from "./types";

/* ============================================================
 *  TWIN SOCCER — Prosedürel oyuncu görünümü
 *  Oyuncu id'sinden deterministik yüz / saç / vücut üretir.
 * ============================================================ */

export const SKIN_TONES = ["#f6d5b8", "#eec092", "#d69f6e", "#a9713f", "#6f4523"];
export const SKIN_SHADE = ["#dcb595", "#d0a072", "#b57f4f", "#87552c", "#4f2f16"];
export const HAIR_COLORS = ["#1b1410", "#2f2016", "#573520", "#8b5a2b", "#c9a227", "#9aa0a6"];
export const BOOT_COLORS = ["#f8fafc", "#0f172a", "#f43f5e", "#22c55e", "#38bdf8", "#facc15"];

const cache = new Map<string, Look>();

/** Aynı oyuncu her zaman aynı görünür. */
export function lookOf(p: { id: string; age: number }): Look {
  const hit = cache.get(p.id);
  if (hit) return hit;
  const h = hashStr(p.id);
  const b = (shift: number, mod: number) => Math.floor(h / Math.pow(7, shift)) % mod;
  const look: Look = {
    skin: b(0, SKIN_TONES.length),
    hair: b(1, 7),
    hairColor: b(2, HAIR_COLORS.length),
    beard: p.age > 23 ? b(3, 4) : b(3, 2),
    build: b(4, 3),
    height: 0.93 + (b(5, 100) / 100) * 0.15,
    boots: b(6, BOOT_COLORS.length),
  };
  cache.set(p.id, look);
  return look;
}

/** Kaleci eldiveni / kaptan bandı gibi ek detaylar için yardımcı. */
export const isCaptain = (p: Player, squad: Player[]) =>
  squad.length > 0 && squad.slice().sort((a, b) => b.phy + b.pas - (a.phy + a.pas))[0]?.id === p.id;

/** Ten tonuna uygun gölge rengi */
export const shadeOf = (skin: number) => SKIN_SHADE[skin % SKIN_SHADE.length];
