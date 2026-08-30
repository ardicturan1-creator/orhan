import type { Formation, PosCode } from "./types";

/* Formasyonlar: fx = kendi kalesinden mesafe (0..1), fy = sol kanattan (0..1) */

const F = (id: string, name: string, slots: [PosCode, number, number][]): Formation => ({
  id,
  name,
  slots: slots.map(([role, fx, fy]) => ({ role, fx, fy })),
});

export const FORMATIONS: Formation[] = [
  F("442", "4-4-2", [
    ["GK", 0.035, 0.5],
    ["LB", 0.2, 0.13], ["CB", 0.15, 0.37], ["CB", 0.15, 0.63], ["RB", 0.2, 0.87],
    ["LM", 0.48, 0.12], ["CM", 0.42, 0.38], ["CM", 0.42, 0.62], ["RM", 0.48, 0.88],
    ["ST", 0.72, 0.4], ["ST", 0.72, 0.6],
  ]),
  F("433", "4-3-3", [
    ["GK", 0.035, 0.5],
    ["LB", 0.22, 0.12], ["CB", 0.15, 0.36], ["CB", 0.15, 0.64], ["RB", 0.22, 0.88],
    ["DM", 0.36, 0.5], ["CM", 0.46, 0.3], ["CM", 0.46, 0.7],
    ["LW", 0.68, 0.14], ["ST", 0.76, 0.5], ["RW", 0.68, 0.86],
  ]),
  F("4231", "4-2-3-1", [
    ["GK", 0.035, 0.5],
    ["LB", 0.22, 0.12], ["CB", 0.15, 0.36], ["CB", 0.15, 0.64], ["RB", 0.22, 0.88],
    ["DM", 0.34, 0.38], ["DM", 0.34, 0.62],
    ["LM", 0.6, 0.14], ["AM", 0.6, 0.5], ["RM", 0.6, 0.86],
    ["ST", 0.78, 0.5],
  ]),
  F("352", "3-5-2", [
    ["GK", 0.035, 0.5],
    ["CB", 0.15, 0.28], ["CB", 0.13, 0.5], ["CB", 0.15, 0.72],
    ["LM", 0.48, 0.09], ["CM", 0.4, 0.32], ["DM", 0.33, 0.5], ["CM", 0.4, 0.68], ["RM", 0.48, 0.91],
    ["ST", 0.73, 0.4], ["ST", 0.73, 0.6],
  ]),
  F("532", "5-3-2", [
    ["GK", 0.035, 0.5],
    ["LB", 0.24, 0.1], ["CB", 0.13, 0.3], ["CB", 0.11, 0.5], ["CB", 0.13, 0.7], ["RB", 0.24, 0.9],
    ["CM", 0.4, 0.3], ["DM", 0.34, 0.5], ["CM", 0.4, 0.7],
    ["ST", 0.7, 0.4], ["ST", 0.7, 0.6],
  ]),
  F("343", "3-4-3", [
    ["GK", 0.035, 0.5],
    ["CB", 0.16, 0.28], ["CB", 0.13, 0.5], ["CB", 0.16, 0.72],
    ["LM", 0.5, 0.1], ["CM", 0.42, 0.36], ["CM", 0.42, 0.64], ["RM", 0.5, 0.9],
    ["LW", 0.72, 0.2], ["ST", 0.78, 0.5], ["RW", 0.72, 0.8],
  ]),
];

export const FORMATION_MAP: Record<string, Formation> = Object.fromEntries(
  FORMATIONS.map((f) => [f.id, f])
);

/* Pozisyon ağırlıkları ile genel (OVR) hesabı */
const W: Record<PosCode, [number, number, number, number, number, number]> = {
  //       pac  sho  pas  def  phy  gk
  GK: [0.05, 0.05, 0.1, 0.1, 0.1, 0.6],
  CB: [0.13, 0.03, 0.11, 0.38, 0.3, 0.05],
  LB: [0.22, 0.06, 0.16, 0.3, 0.16, 0.05],
  RB: [0.22, 0.06, 0.16, 0.3, 0.16, 0.05],
  DM: [0.12, 0.09, 0.22, 0.29, 0.22, 0.05],
  CM: [0.15, 0.15, 0.3, 0.16, 0.18, 0.05],
  AM: [0.19, 0.22, 0.28, 0.07, 0.14, 0.05],
  LM: [0.24, 0.15, 0.24, 0.11, 0.14, 0.05],
  RM: [0.24, 0.15, 0.24, 0.11, 0.14, 0.05],
  LW: [0.28, 0.24, 0.2, 0.06, 0.11, 0.05],
  RW: [0.28, 0.24, 0.2, 0.06, 0.11, 0.05],
  ST: [0.23, 0.36, 0.13, 0.05, 0.2, 0.05],
};

export function overall(p: { pos: PosCode; pac: number; sho: number; pas: number; def: number; phy: number; gk: number }): number {
  const w = W[p.pos];
  const raw = p.pac * w[0] + p.sho * w[1] + p.pas * w[2] + p.def * w[3] + p.phy * w[4] + p.gk * w[5];
  return Math.round(raw / (w[0] + w[1] + w[2] + w[3] + w[4] + w[5]));
}

/* İki pozisyon arasındaki uyum (0..1) */
const GROUP: Record<string, string[]> = {
  GK: ["GK"],
  DEF: ["CB", "LB", "RB"],
  MID: ["DM", "CM", "AM", "LM", "RM"],
  ATT: ["LW", "RW", "ST"],
};
export function posFit(a: PosCode, b: PosCode): number {
  if (a === b) return 1;
  const ga = Object.keys(GROUP).find((k) => GROUP[k].includes(a))!;
  const gb = Object.keys(GROUP).find((k) => GROUP[k].includes(b))!;
  if (ga === gb) return 0.88;
  if ((ga === "DEF" && gb === "MID") || (ga === "MID" && gb === "DEF")) return 0.68;
  if ((ga === "MID" && gb === "ATT") || (ga === "ATT" && gb === "MID")) return 0.7;
  return 0.45;
}

export function attrAtPos(p: { pos: PosCode; pac: number; sho: number; pas: number; def: number; phy: number; gk: number }, target: PosCode) {
  const fit = posFit(p.pos, target);
  const o = overall({ ...p, pos: target });
  return { eff: Math.round(o * (0.55 + 0.45 * fit)), fit };
}
