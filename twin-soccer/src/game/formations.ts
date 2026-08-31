import type { Formation, Player, PosCode } from "./types";

/** 6 formasyon. fx: kendi kaleden (0) hücum kaleye (1), fy: sol kanattan (0) sağa (1). */
export const FORMATIONS: Formation[] = [
  {
    id: "f442", name: "4-4-2 Klasik",
    slots: [
      { role: "GK", fx: 0.035, fy: 0.5 },
      { role: "LB", fx: 0.22, fy: 0.13 },
      { role: "CB", fx: 0.175, fy: 0.37 },
      { role: "CB", fx: 0.175, fy: 0.63 },
      { role: "RB", fx: 0.22, fy: 0.87 },
      { role: "LM", fx: 0.46, fy: 0.12 },
      { role: "CM", fx: 0.42, fy: 0.39 },
      { role: "CM", fx: 0.42, fy: 0.61 },
      { role: "RM", fx: 0.46, fy: 0.88 },
      { role: "ST", fx: 0.72, fy: 0.4 },
      { role: "ST", fx: 0.72, fy: 0.6 },
    ],
  },
  {
    id: "f433", name: "4-3-3 Saldırı",
    slots: [
      { role: "GK", fx: 0.035, fy: 0.5 },
      { role: "LB", fx: 0.24, fy: 0.11 },
      { role: "CB", fx: 0.17, fy: 0.37 },
      { role: "CB", fx: 0.17, fy: 0.63 },
      { role: "RB", fx: 0.24, fy: 0.89 },
      { role: "DM", fx: 0.33, fy: 0.5 },
      { role: "CM", fx: 0.47, fy: 0.33 },
      { role: "CM", fx: 0.47, fy: 0.67 },
      { role: "LW", fx: 0.7, fy: 0.15 },
      { role: "ST", fx: 0.77, fy: 0.5 },
      { role: "RW", fx: 0.7, fy: 0.85 },
    ],
  },
  {
    id: "f4231", name: "4-2-3-1 Kontrol",
    slots: [
      { role: "GK", fx: 0.035, fy: 0.5 },
      { role: "LB", fx: 0.23, fy: 0.12 },
      { role: "CB", fx: 0.165, fy: 0.37 },
      { role: "CB", fx: 0.165, fy: 0.63 },
      { role: "RB", fx: 0.23, fy: 0.88 },
      { role: "DM", fx: 0.3, fy: 0.38 },
      { role: "DM", fx: 0.3, fy: 0.62 },
      { role: "LM", fx: 0.55, fy: 0.13 },
      { role: "AM", fx: 0.55, fy: 0.5 },
      { role: "RM", fx: 0.55, fy: 0.87 },
      { role: "ST", fx: 0.78, fy: 0.5 },
    ],
  },
  {
    id: "f352", name: "3-5-2 Orta Alan",
    slots: [
      { role: "GK", fx: 0.035, fy: 0.5 },
      { role: "CB", fx: 0.16, fy: 0.28 },
      { role: "CB", fx: 0.145, fy: 0.5 },
      { role: "CB", fx: 0.16, fy: 0.72 },
      { role: "LM", fx: 0.44, fy: 0.1 },
      { role: "CM", fx: 0.44, fy: 0.36 },
      { role: "DM", fx: 0.32, fy: 0.5 },
      { role: "CM", fx: 0.44, fy: 0.64 },
      { role: "RM", fx: 0.44, fy: 0.9 },
      { role: "ST", fx: 0.75, fy: 0.38 },
      { role: "ST", fx: 0.75, fy: 0.62 },
    ],
  },
  {
    id: "f532", name: "5-3-2 Otobüs",
    slots: [
      { role: "GK", fx: 0.035, fy: 0.5 },
      { role: "LB", fx: 0.25, fy: 0.09 },
      { role: "CB", fx: 0.145, fy: 0.3 },
      { role: "CB", fx: 0.125, fy: 0.5 },
      { role: "CB", fx: 0.145, fy: 0.7 },
      { role: "RB", fx: 0.25, fy: 0.91 },
      { role: "CM", fx: 0.45, fy: 0.28 },
      { role: "DM", fx: 0.35, fy: 0.5 },
      { role: "CM", fx: 0.45, fy: 0.72 },
      { role: "ST", fx: 0.74, fy: 0.4 },
      { role: "ST", fx: 0.74, fy: 0.6 },
    ],
  },
  {
    id: "f343", name: "3-4-3 Çılgın",
    slots: [
      { role: "GK", fx: 0.035, fy: 0.5 },
      { role: "CB", fx: 0.155, fy: 0.29 },
      { role: "CB", fx: 0.14, fy: 0.5 },
      { role: "CB", fx: 0.155, fy: 0.71 },
      { role: "LM", fx: 0.45, fy: 0.1 },
      { role: "CM", fx: 0.41, fy: 0.35 },
      { role: "CM", fx: 0.41, fy: 0.65 },
      { role: "RM", fx: 0.45, fy: 0.9 },
      { role: "LW", fx: 0.72, fy: 0.17 },
      { role: "ST", fx: 0.79, fy: 0.5 },
      { role: "RW", fx: 0.72, fy: 0.83 },
    ],
  },
];

export function formationById(id: string): Formation {
  return FORMATIONS.find((f) => f.id === id) ?? FORMATIONS[0];
}

const W: Record<PosCode, [number, number, number, number, number, number]> = {
  //              pac   sho   pas   def   phy   gk
  GK: [0.03, 0.0, 0.03, 0.1, 0.06, 0.78],
  CB: [0.13, 0.03, 0.08, 0.55, 0.21, 0.0],
  LB: [0.25, 0.05, 0.17, 0.38, 0.15, 0.0],
  RB: [0.25, 0.05, 0.17, 0.38, 0.15, 0.0],
  DM: [0.11, 0.1, 0.26, 0.34, 0.19, 0.0],
  CM: [0.14, 0.19, 0.36, 0.17, 0.14, 0.0],
  AM: [0.18, 0.28, 0.34, 0.13, 0.07, 0.0],
  LM: [0.27, 0.19, 0.28, 0.13, 0.13, 0.0],
  RM: [0.27, 0.19, 0.28, 0.13, 0.13, 0.0],
  LW: [0.32, 0.26, 0.24, 0.08, 0.1, 0.0],
  RW: [0.32, 0.26, 0.24, 0.08, 0.1, 0.0],
  ST: [0.24, 0.42, 0.12, 0.06, 0.16, 0.0],
};

/** Pozisyon bazlı ağırlıklı ortalama → genel reyting (OVR). */
export function overall(p: Player): number {
  const w = W[p.pos];
  const v = p.pac * w[0] + p.sho * w[1] + p.pas * w[2] + p.def * w[3] + p.phy * w[4] + p.gk * w[5];
  return Math.round(v);
}

/** Oyuncunun oynadığı pozisyon ile slot rolü arasındaki uyum (0.5-1). */
const FIT: Record<PosCode, Partial<Record<PosCode, number>>> = {
  GK: { GK: 1 },
  CB: { CB: 1, DM: 0.86, LB: 0.78, RB: 0.78, CM: 0.7 },
  LB: { LB: 1, RB: 0.92, LM: 0.87, CB: 0.82, DM: 0.8, LW: 0.8 },
  RB: { RB: 1, LB: 0.92, RM: 0.87, CB: 0.82, DM: 0.8, RW: 0.8 },
  DM: { DM: 1, CM: 0.95, CB: 0.87, AM: 0.85, LB: 0.8, RB: 0.8 },
  CM: { CM: 1, DM: 0.92, AM: 0.92, LM: 0.86, RM: 0.86 },
  AM: { AM: 1, CM: 0.92, ST: 0.88, LW: 0.86, RW: 0.86, LM: 0.84, RM: 0.84 },
  LM: { LM: 1, RM: 0.9, LW: 0.9, LB: 0.86, CM: 0.84, AM: 0.82 },
  RM: { RM: 1, LM: 0.9, RW: 0.9, RB: 0.86, CM: 0.84, AM: 0.82 },
  LW: { LW: 1, RW: 0.9, ST: 0.88, LM: 0.86, AM: 0.86 },
  RW: { RW: 1, LW: 0.9, ST: 0.88, RM: 0.86, AM: 0.86 },
  ST: { ST: 1, LW: 0.88, RW: 0.88, AM: 0.87, CM: 0.76 },
};

export function posFit(p: Player, role: PosCode): number {
  if (p.pos === role) return 1;
  const m = FIT[p.pos][role];
  if (m !== undefined) return m;
  // Kaleriler hariç makul bir taban ceza
  if (role === "GK" || p.pos === "GK") return 0.42;
  return 0.68;
}

/** Slot için oyuncunun "etkin gücü": OVR * uyum. */
export function slotPower(p: Player, role: PosCode): number {
  return overall(p) * posFit(p, role);
}

export const ATTACK_ROLES: readonly PosCode[] = ["ST", "LW", "RW", "AM", "LM", "RM", "CM"];
