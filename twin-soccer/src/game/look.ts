import { hashStr } from "./rng";
import type { Look, Player } from "./types";

export const SKINS = ["#f0c9a4", "#e0aa7e", "#c98a5e", "#9c6039", "#6f4229"];
export const HAIR_COLORS = ["#1b1512", "#3a2a1c", "#6b4423", "#a9743d", "#d9b382", "#8d8d92"];
export const BOOTS = ["#ffffff", "#ff2d55", "#00e5ff", "#ffe600", "#a855f7", "#22c55e"];
export const HAIR_NAMES = ["Kısa", "Bantlı", "Afro", "Uzun", "Mohawk", "Topuz", "Kel"];
export const BEARD_NAMES = ["Yok", "Hafif", "Dolgun", "Sakal+Bıyık"];
export const BUILD_NAMES = ["İnce", "Normal", "İri"];

/** Oyuncu id'sinden deterministik görünüm — her maçta aynı yüz, aynı saç. */
export function lookOf(p: Player): Look {
  const h = hashStr(p.id);
  const h2 = hashStr(p.id + "x");
  return {
    skin: h % 5,
    hair: (h >>> 3) % 7,
    hairColor: (h >>> 7) % 6,
    beard: (h >>> 11) % 4,
    build: (h >>> 15) % 3,
    height: 0.94 + ((h2 % 100) / 100) * 0.13,
    boots: (h2 >>> 5) % 6,
  };
}

/** Boy/kilo türevi gövde ölçüleri (render tarafında kullanılır). */
export function bodyOf(l: Look): { w: number; legLen: number; shoulder: number } {
  const b = [0.92, 1, 1.11][l.build];
  return { w: b, legLen: 0.44 * l.height, shoulder: 0.2 * b * l.height };
}

export const HAIR_LONG = new Set([2, 3, 5]); // afro, uzun, topuz
