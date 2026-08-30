import { hashStr } from "./rng";
import type { Club } from "./types";

/* ============================================================
 *  TWIN SOCCER — Prosedürel kulüp arması
 *  Kulüp renklerinden SVG path'leri üretir (DLS tarzı rozet).
 * ============================================================ */

export type CrestShape = "shield" | "round" | "flag" | "diamond" | "hex";

export const CREST_SHAPES: CrestShape[] = ["shield", "round", "flag", "diamond", "hex"];

export function crestShape(club: Club): CrestShape {
  return CREST_SHAPES[club.crest % CREST_SHAPES.length];
}

export function crestOutline(shape: CrestShape): string {
  switch (shape) {
    case "round":
      return "M50 4 A46 46 0 1 1 49.9 4 Z";
    case "flag":
      return "M10 6 L90 6 L90 76 L50 96 L10 76 Z";
    case "diamond":
      return "M50 3 L95 50 L50 97 L5 50 Z";
    case "hex":
      return "M50 4 L92 27 L92 73 L50 96 L8 73 L8 27 Z";
    default:
      return "M8 10 C8 8 10 6 12 6 L88 6 C90 6 92 8 92 10 L92 52 C92 76 72 90 50 97 C28 90 8 76 8 52 Z";
  }
}

/** Arma içi desen tipi */
export function crestMotif(club: Club): number {
  return hashStr(club.id + "motif") % 5;
}

/** Kulüp baş harfleri (monogram) */
export function monogram(club: Club): string {
  const parts = club.name.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Yıldız sayısı — kulüp gücüne göre 0..3 */
export const crestStars = (club: Club) => (club.rating >= 82 ? 3 : club.rating >= 76 ? 2 : club.rating >= 70 ? 1 : 0);
