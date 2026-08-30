import { clamp } from "./rng";
import type {
  Career,
  ManagerSkill,
  ManagerState,
  MatchResult,
  Objective,
  StadiumPart,
  StadiumState,
} from "./types";

/* ============================================================
 *  TWIN SOCCER — Elmas / Altın ekonomisi
 *  · Altın  (🪙) : kulüp geliştirme para birimi (stadyum, menajer)
 *  · Elmas  (💎) : nadir premium para birimi (paketler, hızlandırma)
 *  · Bütçe  (€)  : transfer ve maaş ekonomisi
 * ============================================================ */

export const MAX_LEVEL = 8;

export interface PartInfo {
  id: StadiumPart;
  name: string;
  icon: string;
  desc: string;
  effect: (lv: number) => string;
}

export const STADIUM_PARTS: PartInfo[] = [
  {
    id: "stands",
    name: "Tribünler",
    icon: "🏟️",
    desc: "Kapasiteyi ve maç günü gelirini artırır.",
    effect: (lv) => `Kapasite ${capacityOf(lv).toLocaleString("tr-TR")} · Maç geliri +%${(lv - 1) * 18}`,
  },
  {
    id: "pitch",
    name: "Saha Zemini",
    icon: "🌱",
    desc: "Kondisyon kaybını ve sakatlık riskini düşürür.",
    effect: (lv) => `Kondisyon kaybı -%${(lv - 1) * 6} · Sakatlık -%${(lv - 1) * 7}`,
  },
  {
    id: "lights",
    name: "Işıklandırma",
    icon: "💡",
    desc: "Atmosferi güçlendirir, ev sahibi avantajı verir.",
    effect: (lv) => `Ev sahibi avantajı +${((lv - 1) * 1.4).toFixed(1)} · Gece maçı görselliği`,
  },
  {
    id: "screen",
    name: "Dev Ekran",
    icon: "📺",
    desc: "Sponsor geliri ve taraftar morali sağlar.",
    effect: (lv) => `Sponsor +${(lv - 1) * 120} altın/maç · Moral +${(lv - 1) * 2}`,
  },
  {
    id: "academy",
    name: "Altyapı",
    icon: "🎓",
    desc: "Genç oyuncu üretir ve gelişimi hızlandırır.",
    effect: (lv) => `Genç yetenek kalitesi +${(lv - 1) * 3} · Gelişim +%${(lv - 1) * 8}`,
  },
  {
    id: "medical",
    name: "Sağlık Merkezi",
    icon: "⚕️",
    desc: "Sakatlıkları hızlı iyileştirir, kondisyonu toparlar.",
    effect: (lv) => `İyileşme +%${(lv - 1) * 14} · Maç arası kondisyon +${(lv - 1) * 4}`,
  },
];

export const PART_MAP: Record<StadiumPart, PartInfo> = Object.fromEntries(
  STADIUM_PARTS.map((p) => [p.id, p])
) as Record<StadiumPart, PartInfo>;

export const capacityOf = (lv: number) => 8000 + (lv - 1) * 9000;

/** Bir sonraki seviyenin altın maliyeti */
export const upgradeGold = (lv: number) => Math.round(900 * Math.pow(1.72, lv - 1));
/** 6. seviyeden itibaren elmas da gerekir */
export const upgradeDiamonds = (lv: number) => (lv >= 5 ? (lv - 4) * 6 : 0);

export function newStadium(clubName: string): StadiumState {
  return {
    name: `${clubName} Arena`,
    levels: { stands: 2, pitch: 2, lights: 1, screen: 1, academy: 1, medical: 1 },
    theme: 0,
  };
}

export function stadiumLevel(s: StadiumState): number {
  const vals = Object.values(s.levels);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function stadiumCapacity(s: StadiumState): number {
  return capacityOf(s.levels.stands);
}

export function upgradeStadium(c: Career, part: StadiumPart): { ok: boolean; msg: string } {
  const lv = c.stadium.levels[part];
  if (lv >= MAX_LEVEL) return { ok: false, msg: "Bu bölüm zaten maksimum seviyede." };
  const g = upgradeGold(lv);
  const d = upgradeDiamonds(lv);
  if (c.gold < g) return { ok: false, msg: `Yetersiz altın (${g} gerekli).` };
  if (c.diamonds < d) return { ok: false, msg: `Yetersiz elmas (${d} gerekli).` };
  c.gold -= g;
  c.diamonds -= d;
  c.stadium.levels[part] = lv + 1;
  addXp(c, 40);
  c.news.unshift({ t: c.round, text: `🏗️ ${PART_MAP[part].name} ${lv + 1}. seviyeye yükseltildi.` });
  return { ok: true, msg: `${PART_MAP[part].name} → Sv.${lv + 1}` };
}

/* ---------------------- Menajer ---------------------- */

export interface SkillInfo {
  id: ManagerSkill;
  name: string;
  icon: string;
  desc: string;
  effect: (lv: number) => string;
}

export const MANAGER_SKILLS: SkillInfo[] = [
  { id: "training", name: "Antrenman", icon: "🏋️", desc: "Oyuncu gelişim hızı.", effect: (l) => `Gelişim +%${l * 9}` },
  { id: "tactics", name: "Taktik", icon: "🧠", desc: "Takım organizasyonu ve maç içi uyum.", effect: (l) => `Takım gücü +${(l * 0.6).toFixed(1)}` },
  { id: "negotiation", name: "Pazarlık", icon: "🤝", desc: "Transfer ve maaş görüşmeleri.", effect: (l) => `Transfer bedeli -%${l * 3} · Maaş -%${l * 2}` },
  { id: "motivation", name: "Motivasyon", icon: "🔥", desc: "Moral ve maç içi kondisyon.", effect: (l) => `Moral +${l * 3} · Kondisyon +%${l * 2}` },
  { id: "scouting", name: "Gözlemcilik", icon: "🔎", desc: "Transfer listesinin kalitesi.", effect: (l) => `Piyasa kalitesi +${l * 2}` },
  { id: "youth", name: "Genç Yetenek", icon: "🌱", desc: "Altyapıdan çıkan oyuncular.", effect: (l) => `Altyapı kalitesi +${l * 2}` },
];

export const SKILL_MAP: Record<ManagerSkill, SkillInfo> = Object.fromEntries(
  MANAGER_SKILLS.map((s) => [s.id, s])
) as Record<ManagerSkill, SkillInfo>;

export const MAX_SKILL = 10;

export function newManager(name = "Menajer"): ManagerState {
  return {
    name,
    level: 1,
    xp: 0,
    points: 2,
    skills: { training: 0, tactics: 0, negotiation: 0, motivation: 0, scouting: 0, youth: 0 },
    avatar: 0,
    reputation: 35,
  };
}

export const xpForLevel = (lv: number) => Math.round(320 * Math.pow(1.35, lv - 1));

/** XP ekler, seviye atladıysa ödül verir. Yeni seviye sayısını döner. */
export function addXp(c: Career, amount: number): number {
  const m = c.manager;
  m.xp += Math.max(0, Math.round(amount));
  let ups = 0;
  let guard = 0;
  while (m.xp >= xpForLevel(m.level) && guard++ < 40) {
    m.xp -= xpForLevel(m.level);
    m.level++;
    m.points++;
    m.reputation = clamp(m.reputation + 2, 0, 100);
    c.diamonds += 5;
    c.gold += 400;
    ups++;
    c.news.unshift({ t: c.round, text: `⭐ Menajer seviyesi ${m.level}! +1 yetenek puanı, +5 elmas, +400 altın.` });
  }
  return ups;
}

/** Elmasla yetenek puanı satın alma maliyeti */
export const skillPointDiamonds = 25;

export function spendSkillPoint(c: Career, skill: ManagerSkill): { ok: boolean; msg: string } {
  const m = c.manager;
  if (m.skills[skill] >= MAX_SKILL) return { ok: false, msg: "Bu yetenek maksimumda." };
  if (m.points <= 0) return { ok: false, msg: "Yetenek puanın yok." };
  m.points--;
  m.skills[skill]++;
  return { ok: true, msg: `${SKILL_MAP[skill].name} → ${m.skills[skill]}` };
}

export function buySkillPoint(c: Career): { ok: boolean; msg: string } {
  if (c.diamonds < skillPointDiamonds) return { ok: false, msg: `${skillPointDiamonds} elmas gerekli.` };
  c.diamonds -= skillPointDiamonds;
  c.manager.points++;
  return { ok: true, msg: "+1 yetenek puanı" };
}

/* ---------------------- Türetilmiş bonuslar ---------------------- */

export interface Bonuses {
  /** Maç içi takım gücü katkısı (OVR puanı) */
  teamBoost: number;
  /** Ev sahibi avantajı çarpanı */
  homeAdv: number;
  /** Kondisyon kaybı çarpanı (düşük iyi) */
  staminaDrain: number;
  /** Gelişim çarpanı */
  growth: number;
  /** Transfer bedeli çarpanı */
  transferCost: number;
  /** Maaş çarpanı */
  wageCost: number;
  /** Maç başına altın geliri */
  goldPerMatch: number;
  /** Moral kazancı */
  morale: number;
  /** Sakatlık iyileşme çarpanı */
  healing: number;
  /** Piyasa kalitesi katkısı */
  scoutQuality: number;
}

export function bonusesOf(c: Career | null): Bonuses {
  if (!c) {
    return {
      teamBoost: 0, homeAdv: 1, staminaDrain: 1, growth: 1, transferCost: 1,
      wageCost: 1, goldPerMatch: 0, morale: 0, healing: 1, scoutQuality: 0,
    };
  }
  const st = c.stadium.levels;
  const sk = c.manager.skills;
  return {
    teamBoost: sk.tactics * 0.6,
    homeAdv: 1 + (st.lights - 1) * 0.014 + (st.stands - 1) * 0.01,
    staminaDrain: clamp(1 - (st.pitch - 1) * 0.06 - sk.motivation * 0.02, 0.45, 1),
    growth: 1 + sk.training * 0.09 + (st.academy - 1) * 0.08,
    transferCost: clamp(1 - sk.negotiation * 0.03, 0.7, 1),
    wageCost: clamp(1 - sk.negotiation * 0.02, 0.8, 1),
    goldPerMatch: (st.screen - 1) * 120 + (st.stands - 1) * 60,
    morale: sk.motivation * 3 + (st.screen - 1) * 2,
    healing: 1 + (st.medical - 1) * 0.14,
    scoutQuality: sk.scouting * 2 + sk.youth * 1,
  };
}

/* ---------------------- Maç ödülleri ---------------------- */

export interface Reward {
  gold: number;
  diamonds: number;
  xp: number;
  money: number;
  lines: string[];
}

export function matchReward(c: Career, res: MatchResult, isCup: boolean): Reward {
  const userHome = res.homeClubId === c.clubId;
  const gf = userHome ? res.hg : res.ag;
  const ga = userHome ? res.ag : res.hg;
  const won = gf > ga || (!!res.pens && (userHome ? res.pens[0] > res.pens[1] : res.pens[1] > res.pens[0]));
  const drew = gf === ga && !res.pens;
  const b = bonusesOf(c);
  const lines: string[] = [];

  let gold = 220 + Math.round(b.goldPerMatch);
  lines.push(`Maç günü geliri +${220 + Math.round(b.goldPerMatch)} 🪙`);
  if (won) {
    gold += 380;
    lines.push("Galibiyet primi +380 🪙");
  } else if (drew) {
    gold += 140;
    lines.push("Beraberlik primi +140 🪙");
  }
  gold += gf * 60;
  if (gf > 0) lines.push(`Gol primi +${gf * 60} 🪙`);
  if (ga === 0) {
    gold += 200;
    lines.push("Gol yememe primi +200 🪙");
  }
  if (isCup) {
    gold = Math.round(gold * 1.35);
    lines.push("Kupa maçı ×1.35");
  }

  let diamonds = 0;
  if (won && gf - ga >= 3) {
    diamonds += 2;
    lines.push("Farklı galibiyet +2 💎");
  }
  if (won && c.streak + 1 >= 3 && (c.streak + 1) % 3 === 0) {
    diamonds += 3;
    lines.push(`${c.streak + 1} maçlık seri +3 💎`);
  }
  if (isCup && won) {
    diamonds += 1;
    lines.push("Kupa turu +1 💎");
  }

  const xp = 55 + (won ? 45 : drew ? 20 : 8) + gf * 8;
  const money = (userHome ? 420 : 130) * (1 + (c.stadium.levels.stands - 1) * 0.18) + (won ? 900 : drew ? 300 : 0);

  return { gold, diamonds, xp, money: Math.round(money), lines };
}

/** Ödülü kariyere işler. */
export function applyReward(c: Career, r: Reward) {
  c.gold += r.gold;
  c.diamonds += r.diamonds;
  c.budget += r.money;
  addXp(c, r.xp);
}

/* ---------------------- Görevler ---------------------- */

const OBJECTIVE_POOL: Omit<Objective, "progress" | "claimed">[] = [
  { id: "win3", text: "3 lig maçı kazan", goal: 3, gold: 900, diamonds: 4 },
  { id: "score8", text: "Toplam 8 gol at", goal: 8, gold: 800, diamonds: 3 },
  { id: "clean3", text: "3 maçta kaleni gole kapat", goal: 3, gold: 1000, diamonds: 5 },
  { id: "play5", text: "5 resmi maç oyna", goal: 5, gold: 600, diamonds: 2 },
  { id: "buy1", text: "1 transfer yap", goal: 1, gold: 500, diamonds: 2 },
  { id: "upgrade2", text: "2 stadyum yükseltmesi yap", goal: 2, gold: 1200, diamonds: 6 },
];

export function newObjectives(): Objective[] {
  return OBJECTIVE_POOL.map((o) => ({ ...o, progress: 0, claimed: false }));
}

export function bumpObjective(c: Career, id: string, amount = 1) {
  const o = c.objectives.find((x) => x.id === id);
  if (!o || o.claimed) return;
  o.progress = Math.min(o.goal, o.progress + amount);
}

export function claimObjective(c: Career, id: string): { ok: boolean; msg: string } {
  const o = c.objectives.find((x) => x.id === id);
  if (!o) return { ok: false, msg: "Görev bulunamadı." };
  if (o.claimed) return { ok: false, msg: "Ödül zaten alındı." };
  if (o.progress < o.goal) return { ok: false, msg: "Görev tamamlanmadı." };
  o.claimed = true;
  c.gold += o.gold;
  c.diamonds += o.diamonds;
  addXp(c, 80);
  return { ok: true, msg: `+${o.gold} 🪙  +${o.diamonds} 💎` };
}

/* ---------------------- Mağaza ---------------------- */

export interface ShopItem {
  id: string;
  name: string;
  desc: string;
  icon: string;
  costGold?: number;
  costDiamonds?: number;
  kind: "convert" | "boost" | "pack";
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: "g2m_s", name: "Bütçe Takviyesi", desc: "1.500 altın → €2.5M transfer bütçesi", icon: "💶", costGold: 1500, kind: "convert" },
  { id: "g2m_l", name: "Büyük Bütçe", desc: "5.000 altın → €10M transfer bütçesi", icon: "🏦", costGold: 5000, kind: "convert" },
  { id: "d2g", name: "Altın Kasası", desc: "20 elmas → 4.000 altın", icon: "🪙", costDiamonds: 20, kind: "convert" },
  { id: "heal", name: "Tam Tedavi", desc: "Tüm sakatlıkları anında iyileştir", icon: "⚕️", costDiamonds: 12, kind: "boost" },
  { id: "morale", name: "Takım Kampı", desc: "Tüm kadronun moralini +25 yükselt", icon: "🔥", costGold: 1200, kind: "boost" },
  { id: "fitness", name: "Kondisyon Kampı", desc: "Kadronun kondisyonunu tam doldur", icon: "💪", costGold: 900, kind: "boost" },
  { id: "scout", name: "Gözlemci Raporu", desc: "Transfer listesini yenile, kalite artsın", icon: "🔎", costGold: 700, kind: "pack" },
  { id: "skill", name: "Yetenek Puanı", desc: "Menajerine +1 yetenek puanı", icon: "🧠", costDiamonds: skillPointDiamonds, kind: "boost" },
];

export function canAfford(c: Career, item: ShopItem): boolean {
  if (item.costGold && c.gold < item.costGold) return false;
  if (item.costDiamonds && c.diamonds < item.costDiamonds) return false;
  return true;
}

export function payFor(c: Career, item: ShopItem) {
  if (item.costGold) c.gold -= item.costGold;
  if (item.costDiamonds) c.diamonds -= item.costDiamonds;
}
