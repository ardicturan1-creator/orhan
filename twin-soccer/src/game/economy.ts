import { clamp } from "./rng";
import type { Bonuses, Career, ManagerState, Objective, StadiumState } from "./types";

/** Üç para birimli ekonomi: 💶 bütçe (bin €), 🪙 altın, 💎 elmas. */

export type SectionId = keyof StadiumState["levels"];

export interface SectionDef {
  id: SectionId; name: string; icon: string; desc: string;
}

export const SECTIONS: SectionDef[] = [
  { id: "stands", name: "Tribünler", icon: "🏟️", desc: "Kapasite ve maç günü geliri" },
  { id: "pitch", name: "Saha Zemini", icon: "🌱", desc: "Oyuncu verimi, sakatlık riski" },
  { id: "lights", name: "Işıklandırma", icon: "💡", desc: "Ev sahibi avantajı" },
  { id: "screen", name: "Dev Ekran", icon: "📺", desc: "Maç başı altın geliri" },
  { id: "academy", name: "Altyapı", icon: "🎓", desc: "Genç yetenek kalitesi ve gelişim" },
  { id: "medical", name: "Sağlık Merkezi", icon: "⚕️", desc: "Sakatlık iyileşme hızı, kondisyon" },
];

export const MAX_LEVEL = 8;

export function upgradeCost(section: SectionId, level: number): { gold: number; diamonds: number } {
  const base: Record<SectionId, number> = { stands: 1050, pitch: 900, lights: 860, screen: 780, academy: 940, medical: 820 };
  const gold = Math.round(base[section] * Math.pow(1.72, level - 1));
  const diamonds = level >= 5 ? (level - 4) * 6 : 0;
  return { gold, diamonds };
}

export function capacity(st: StadiumState): number {
  return 4200 + st.levels.stands * 2600;
}

export function sectionEffect(sec: SectionId, lv: number): string {
  switch (sec) {
    case "stands": return `Kapasite ${capacity({ name: "", levels: { stands: lv, pitch: 1, lights: 1, screen: 1, academy: 1, medical: 1 }, theme: "" }).toLocaleString("tr-TR")} · Maç geliri +%${lv * 9}`;
    case "pitch": return `Oyuncu verimi +%${(lv * 0.5).toFixed(1)} · Sakatlık riski -%${lv * 5}`;
    case "lights": return `Ev sahibi avantajı +%${lv * 4} (3B sahada ışık kuleleri büyür)`;
    case "screen": return `Maç başı altın +%${lv * 11} · Seviye ≥2 → sahada canlı skor panosu`;
    case "academy": return `Altyapı çıkış kalitesi +${lv * 2} · Gelişim +%${lv * 7}`;
    case "medical": return `İyileşme hızı +%${lv * 15} · Kondisyon kaybı -%${lv * 4}`;
  }
}

/* ----------------------------- MENAJER ----------------------------- */

export function xpForLevel(lv: number): number {
  return Math.round(320 * Math.pow(1.35, lv - 1));
}

export const SKILL_DEFS: { id: keyof ManagerState["skills"]; name: string; icon: string; desc: string }[] = [
  { id: "training", name: "Antrenman", icon: "🏋️", desc: "Oyuncu gelişim hızı ve kondisyon dayanıklılığı" },
  { id: "tactics", name: "Taktik", icon: "🧠", desc: "Takımın maç içi genel verimi" },
  { id: "negotiation", name: "Pazarlık", icon: "🤝", desc: "Transfer/maaş maliyetlerini düşürür" },
  { id: "motivation", name: "Motivasyon", icon: "🔥", desc: "Moral ve altın geliri" },
  { id: "scouting", name: "Gözlemcilik", icon: "🔎", desc: "Piyasa listesi kalitesi" },
  { id: "youth", name: "Genç Yetenek", icon: "🌱", desc: "Altyapıdan gelen oyuncuların seviyesi" },
];

export function bonusesOf(career: Career | null): Bonuses {
  if (!career) {
    return { teamBoost: 0, homeAdv: 0, staminaDrain: 1, growth: 1, transferCost: 1, wageCost: 1, goldPerMatch: 1, morale: 0, healing: 0, scoutQuality: 0 };
  }
  const s = career.manager.skills;
  const st = career.stadium.levels;
  return {
    teamBoost: +(s.training * 0.14 + s.tactics * 0.11 + s.motivation * 0.07 + st.pitch * 0.055 + career.manager.reputation * 0.02).toFixed(2),
    homeAdv: +(st.lights * 0.05 + st.stands * 0.014).toFixed(2),
    staminaDrain: +clamp(1 - s.training * 0.018 - st.medical * 0.014, 0.7, 1).toFixed(3),
    growth: +(1 + s.training * 0.05 + s.youth * 0.03 + st.academy * 0.035).toFixed(3),
    transferCost: +clamp(1 - s.negotiation * 0.028, 0.72, 1).toFixed(3),
    wageCost: +clamp(1 - s.negotiation * 0.022, 0.78, 1).toFixed(3),
    goldPerMatch: +(1 + s.motivation * 0.05 + st.screen * 0.055).toFixed(3),
    morale: +(s.motivation * 0.85).toFixed(2),
    healing: +(st.medical * 0.16).toFixed(2),
    scoutQuality: +(s.scouting * 0.09).toFixed(2),
  };
}

export function addManagerXp(career: Career, xp: number): number {
  let gained = 0;
  career.manager.xp += Math.round(xp);
  while (career.manager.xp >= xpForLevel(career.manager.level)) {
    career.manager.xp -= xpForLevel(career.manager.level);
    career.manager.level++;
    career.manager.points += 1;
    career.diamonds += 5;
    career.gold += 400;
    gained++;
  }
  career.manager.reputation = clamp(career.manager.level * 3 + career.trophies * 6, 0, 100);
  return gained;
}

/* ----------------------------- GÖREVLER ----------------------------- */

export function objectivesForSeason(): Objective[] {
  return [
    { id: "o_wins", kind: "wins", label: "3 lig maçı kazan", target: 3, prog: 0, gold: 700, diamonds: 2, claimed: false },
    { id: "o_goals", kind: "goals", label: "8 gol at", target: 8, prog: 0, gold: 650, diamonds: 2, claimed: false },
    { id: "o_cs", kind: "cleanSheets", label: "3 maçta kaleni kapat", target: 3, prog: 0, gold: 700, diamonds: 2, claimed: false },
    { id: "o_matches", kind: "matches", label: "5 maç oyna", target: 5, prog: 0, gold: 400, diamonds: 1, claimed: false },
    { id: "o_transfer", kind: "transfer", label: "1 transfer yap", target: 1, prog: 0, gold: 500, diamonds: 1, claimed: false },
    { id: "o_upgrade", kind: "upgrade", label: "2 stadyum yükseltmesi yap", target: 2, prog: 0, gold: 600, diamonds: 2, claimed: false },
  ];
}

export function bumpObjective(career: Career, kind: Objective["kind"], amount = 1): void {
  for (const o of career.objectives) {
    if (o.kind === kind && !o.claimed && o.prog < o.target) {
      o.prog = Math.min(o.target, o.prog + amount);
      if (o.prog >= o.target) {
        career.news.unshift({
          season: career.season, round: career.round, icon: "🎯",
          text: `Görev tamamlandı: ${o.label} → +${o.gold}🪙 +${o.diamonds}💎 (mağazadan al)`,
          hi: true,
        });
      }
    }
  }
}

export function claimObjective(career: Career, id: string): boolean {
  const o = career.objectives.find((x) => x.id === id);
  if (!o || o.claimed || o.prog < o.target) return false;
  o.claimed = true;
  career.gold += o.gold;
  career.diamonds += o.diamonds;
  addManagerXp(career, 40);
  return true;
}

/* ----------------------------- MAÇ ÖDÜLÜ ----------------------------- */

export interface RewardOut {
  income: number;   // bütçeye (bin €)
  gold: number;
  diamonds: number;
  xp: number;
  lines: string[];
}

export function matchReward(
  career: Career, res: "W" | "D" | "L", goalsFor: number, goalsAgainst: number, isCup: boolean,
): RewardOut {
  const b = bonusesOf(career);
  const cap = capacity(career.stadium);
  const gate = Math.round((cap / 1000) * (res === "W" ? 46 : res === "D" ? 33 : 24) * (1 + career.stadium.levels.stands * 0.02));
  let gold = Math.round((80 + cap / 900) * b.goldPerMatch);
  if (res === "W") gold += 150;
  else if (res === "D") gold += 55;
  gold += goalsFor * 22;
  if (goalsAgainst === 0) gold += 90;
  if (isCup) { gold = Math.round(gold * 1.35); }

  const diamonds = res === "W" ? (goalsAgainst === 0 ? 3 : 2) : 0;
  const xp = 55 + (res === "W" ? 45 : res === "D" ? 18 : 0) + goalsFor * 8;
  const lines = [
    `Maç günü geliri: 💶 ${(gate / 1000).toFixed(1)} Mn`,
    `Prim: 🪙 ${gold} · 💎 ${diamonds}`,
    `Menajer XP: +${xp}`,
  ];
  return { income: gate, gold, diamonds, xp, lines };
}

/* ----------------------------- MAĞAZA ----------------------------- */

export type ShopId = "gold_to_cash" | "cash_to_gold" | "gem_to_gold" | "gold_to_gem" | "heal" | "morale" | "fitness" | "scout" | "skillpoint";

export interface ShopItem {
  id: ShopId; name: string; icon: string; desc: string;
  costGold: number; costDiamonds: number; costCash: number;
}

export const SHOP: ShopItem[] = [
  { id: "gold_to_cash", name: "Altın → Bütçe", icon: "💱", desc: "1.000 🪙 → 💶 2.5 Mn transfer bütçesi", costGold: 1000, costDiamonds: 0, costCash: 0 },
  { id: "cash_to_gold", name: "Bütçe → Altın", icon: "🔄", desc: "💶 5 Mn → 700 🪙 kulüp geliştirme parası", costGold: 0, costDiamonds: 0, costCash: 5000 },
  { id: "gem_to_gold", name: "Elmas → Altın", icon: "💠", desc: "1 💎 → 260 🪙", costGold: 0, costDiamonds: 1, costCash: 0 },
  { id: "gold_to_gem", name: "Altın → Elmas", icon: "✨", desc: "1.600 🪙 → 1 💎", costGold: 1600, costDiamonds: 0, costCash: 0 },
  { id: "heal", name: "Tam Tedavi", icon: "🏥", desc: "Tüm sakatlıkları anında sıfırla", costGold: 750, costDiamonds: 0, costCash: 0 },
  { id: "morale", name: "Takım Kampı", icon: "🏕️", desc: "Tüm kadronun moralini +25 artırır", costGold: 600, costDiamonds: 0, costCash: 0 },
  { id: "fitness", name: "Kondisyon Kampı", icon: "💪", desc: "Tüm kadro kondisyonu 100", costGold: 600, costDiamonds: 0, costCash: 0 },
  { id: "scout", name: "Gözlemci Raporu", icon: "🔎", desc: "Transfer piyasasını yeni isimlerle doldur", costGold: 450, costDiamonds: 0, costCash: 0 },
  { id: "skillpoint", name: "Yetenek Puanı", icon: "⭐", desc: "25 💎 → 1 menajer yetenek puanı", costGold: 0, costDiamonds: 25, costCash: 0 },
];
