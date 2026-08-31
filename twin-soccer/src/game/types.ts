/** TWIN SOCCER — ortak tip tanımları (birebir spesifikasyon alanları). */

export type PosCode = "GK" | "CB" | "LB" | "RB" | "DM" | "CM" | "AM" | "LM" | "RM" | "LW" | "RW" | "ST";
export const POS_ALL: readonly PosCode[] = [
  "GK", "CB", "LB", "RB", "DM", "CM", "AM", "LM", "RM", "LW", "RW", "ST",
];
export const POS_SHORT: Record<PosCode, string> = {
  GK: "KL", CB: "SO", LB: "LS", RB: "RS", DM: "DÖ", CM: "OS", AM: "OH", LM: "SL", RM: "SR", LW: "SG", RW: "SĞ", ST: "SF",
};
export const POS_LONG: Record<PosCode, string> = {
  GK: "Kaleci", CB: "Stoper", LB: "Sol Bek", RB: "Sağ Bek", DM: "Ön Libero", CM: "Orta Saha",
  AM: "Ofansif Orta Saha", LM: "Sol Orta Saha", RM: "Sağ Orta Saha", LW: "Sol Kanat", RW: "Sağ Kanat", ST: "Santrfor",
};

export interface PlayerStats {
  apps: number; goals: number; assists: number; yellow: number; red: number;
  cs: number; ratingSum: number; mom: number;
}

export interface Player {
  id: string; name: string; num: number; pos: PosCode; age: number; nat: string; teamId: string;
  value: number;      // bin €
  wage: number;       // haftalık bin €
  morale: number;     // 40-100
  injury: number;     // kaçıracak hafta
  contract: number;   // kalan yıl
  release: number;    // serbest kalma bedeli (bin €)
  form: number;       // 0-100
  fitness: number;    // 0-100
  pac: number; sho: number; pas: number; def: number; phy: number; gk: number; // 20-99
  stats: PlayerStats;
}

export interface Look {
  skin: number; hair: number; hairColor: number; beard: number;
  build: number; height: number; boots: number;
}

export type KitPattern = "plain" | "stripes" | "halves" | "sash" | "hoops" | "third";
export interface Kit { primary: string; secondary: string; shorts: string; pattern: KitPattern; }

export interface Club {
  id: string; name: string; short: string; city: string; leagueId: string;
  rating: number; kit: Kit; gkKit: Kit; budget: number; crest: number;
}

export type Region = "tr" | "eu" | "lat" | "af";
export interface League { id: string; name: string; country: string; flag: string; region: Region; tier: number; }

export interface FormationSlot { role: PosCode; fx: number; fy: number; }
export interface Formation { id: string; name: string; slots: FormationSlot[]; }

export interface TeamTactic {
  formation: string;
  mentality: number;  // 0-100
  pressing: number;   // 0-100
  width: number;      // 0-100
  lineHeight: number; // 0-100
  tempo: number;      // 0-100
  passing: "short" | "mixed" | "long";
}

export type CameraId = "broadcast" | "tele" | "action" | "behind" | "sky";
export const CAMERAS: readonly CameraId[] = ["broadcast", "tele", "action", "behind", "sky"];
export const CAMERA_NAME: Record<CameraId, string> = {
  broadcast: "Yayın", tele: "Tele", action: "Aksiyon", behind: "Oyuncu Arkası", sky: "Kule",
};

export interface MatchSettings {
  /** Maçta GÖSTERİLEN süre (dakika) — gerçekçilik için 90. */
  minutes: number;
  /** Maçın GERÇEK süresi (dakika) — saat bu sürede 0'dan `minutes`'a akar. */
  realMinutes: number;
  difficulty: number; // 0-4
  sound: boolean;
  offside: boolean;
  autoSwitch: boolean;
  camera: CameraId;
  assist: number;     // 0-2
  quality: number;    // 0-2
  haptics: boolean;
  commentary: boolean;
  faikMode: boolean;
}

export interface MatchStats {
  possession: number[];
  shots: number[];
  onTarget: number[];
  passes: number[];
  passAcc: number[];
  corners: number[];
  fouls: number[];
  offside: number[];
  tackles: number[];
  saves: number[];
}

export interface GoalEntry { minute: number; scorer: string; assist: string; team: 0 | 1; pens?: boolean; ownGoal?: boolean; }

export interface CardEntry { minute: number; name: string; team: 0 | 1; kind: "Y" | "R"; }

export interface MatchResult {
  homeId: string; awayId: string; hg: number; ag: number;
  stats: MatchStats; goals: GoalEntry[]; cards: CardEntry[]; motm: string;
  pens: [number, number] | null;
  userTeam: 0 | 1 | null;
}

export interface StadiumState {
  name: string;
  levels: { stands: number; pitch: number; lights: number; screen: number; academy: number; medical: number };
  theme: string;
}

export interface ManagerState {
  name: string; level: number; xp: number; points: number;
  skills: { training: number; tactics: number; negotiation: number; motivation: number; scouting: number; youth: number };
  reputation: number;
}

export interface Bonuses {
  teamBoost: number; homeAdv: number; staminaDrain: number; growth: number;
  transferCost: number; wageCost: number; goldPerMatch: number; morale: number;
  healing: number; scoutQuality: number;
}

export interface Wallet { budget: number; gold: number; diamonds: number; }

export type ObjectiveKind = "wins" | "goals" | "cleanSheets" | "matches" | "transfer" | "upgrade";

export interface Objective {
  id: string; kind: ObjectiveKind; label: string; target: number; prog: number;
  gold: number; diamonds: number; claimed: boolean;
}

export type CupStage = "none" | "r16" | "qf" | "sf" | "final" | "won" | "out";

export interface CupTie { homeId: string; awayId: string; hg: number | null; ag: number | null; stage: CupStage; }

export interface Fixture { round: number; homeId: string; awayId: string; hg: number | null; ag: number | null; }

export interface TableRow {
  clubId: string; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number;
}

export interface NewsItem { season: number; round: number; icon: string; text: string; hi?: boolean; }

export interface MarketPlayer { player: Player; price: number; clubName: string; free: boolean; }

export interface Career extends Wallet {
  clubId: string; season: number; round: number;
  lineup: string[]; subs: string[];
  formation: string;
  tactic: TeamTactic;
  training: Record<string, string>;
  fixtures: Fixture[];
  cup: CupTie[];
  cupStage: CupStage;
  trophies: number;
  history: { season: number; pos: number; pts: number; champion: boolean; cup: string }[];
  news: NewsItem[];
  market: MarketPlayer[];
  stadium: StadiumState;
  manager: ManagerState;
  objectives: Objective[];
  streak: number;
  played: number;
  quickMode: boolean;
}

export type Screen =
  | "boot" | "home" | "teamselect" | "createteam" | "squad" | "tactics" | "transfers" | "table" | "fixtures"
  | "match" | "postmatch" | "settings" | "stats" | "stadium" | "manager" | "shop"
  | "contracts" | "penalties";

export interface World {
  v: number;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  leagues: League[];
  career: Career | null;
  seed: number;
}

/** Maç motoru oyuncusu — fizik + animasyon durumuyla. */
export interface MP {
  p: Player;
  team: 0 | 1;
  idx: number;
  dir: number;        // hücum yönü: +1 / -1
  x: number; y: number;
  vx: number; vy: number;
  fx: number; fy: number;      // baktığı yön (birim)
  stamina: number;
  baseFx: number; baseFy: number; // formasyon yuvası (kendi kalesi 0, hücum kalesi 1)
  role: PosCode;
  eff: { pac: number; sho: number; pas: number; def: number; phy: number; gk: number };
  rating: number;
  goals: number; assists: number; passes: number; passOk: number; shots: number;
  onTarget: number; tackles: number; saves: number; fouls: number; yellow: number; red: boolean;
  off: boolean;
  cool: { tackle: number; shoot: number; pass: number; decide: number; slide: number; dive: number };
  slide: number; slideVx: number; slideVy: number;
  dive: number; diveVz: number;
  celeb: number; celebKind: number;
  jump: number;
  anim: number;      // koşu döngüsü fazı
  stride: number;    // adım uzunluğu (hareket doğallığı için)
  lean: number;      // dönüşe/durmaya bağlı gövde eğimi (-1..1)
  facing: number;    // baktığı yön (radyan) — yumuşak döner
  booked: boolean;
  isGK: boolean;
  onPitch: boolean;
}

export interface Ball {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  owner: MP | null;
  lastTouch: MP | null;
  lastTouchTeam: 0 | 1;
  spin: number;
  shotCounted: boolean;
  /** Bu top hareketi için 'isabetli şut' zaten sayıldı mı? */
  otDone: boolean;
  saveTried: boolean;
  shooter: MP | null;
  assistCand: MP | null;
  trail: { x: number; y: number; z: number; a: number }[];
  rot: number;
}

export type Phase = "kickoff" | "play" | "dead" | "goal" | "halftime" | "fulltime" | "pens";

export type RestartKind =
  | "kickoff" | "throwin" | "goalkick" | "corner" | "freekick" | "penalty" | "none";

export interface InputState {
  jx: number; jy: number;   // joystick (-1..1)
  sprint: boolean;
  shoot: number;            // 0..1 şut gücü
  shootHeld: boolean;
  passTap: boolean;
  throughTap: boolean;
  switchTap: boolean;
  tackleTap: boolean;
}

export interface HudSnapshot {
  clock: number; phase: Phase; hg: number; ag: number;
  controlled: { name: string; num: number; stamina: number; pos: PosCode } | null;
  commentary: string;
  goalBanner: { show: boolean; scorer: string; hg: number; ag: number } | null;
  restart: RestartKind;
  userTeam: 0 | 1 | null;
  momentum: number;
}
