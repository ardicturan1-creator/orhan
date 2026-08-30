/* ============================================================
 *  TWIN SOCCER — Ortak tip tanımları
 *  Katmanlı mimari: data -> engine -> sim -> render
 * ============================================================ */

export type PosCode =
  | "GK"
  | "CB"
  | "LB"
  | "RB"
  | "DM"
  | "CM"
  | "AM"
  | "LM"
  | "RM"
  | "LW"
  | "RW"
  | "ST";

export interface Attr {
  pac: number; // hız
  sho: number; // şut
  pas: number; // pas
  def: number; // savunma
  phy: number; // fizik
  gk: number; // kalecilik
}

export interface PlayerStats {
  apps: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  cs: number; // clean sheet
  ratingSum: number;
  mom: number;
}

/** Görsel kimlik — yüz, saç, ten, vücut. Oyuncu id'sinden türetilir. */
export interface Look {
  skin: number; // 0..4 ten tonu
  hair: number; // 0..6 saç modeli
  hairColor: number; // 0..5
  beard: number; // 0..3
  build: number; // 0..2 (ince / normal / iri)
  height: number; // 0.92..1.08 çarpanı
  boots: number; // 0..5 krampon rengi
}

export interface Player extends Attr {
  id: string;
  name: string;
  num: number;
  pos: PosCode;
  age: number;
  nat: string; // bayrak emoji
  teamId: string;
  value: number;
  wage: number; // haftalık, bin €
  morale: number; // 40..100
  injury: number; // maç kaçıracak hafta sayısı
  /** Sözleşmenin bitmesine kalan sezon sayısı */
  contract: number;
  /** Serbest kalma bedeli (bin €), 0 = yok */
  release: number;
  /** Son 5 maç form puanı 0..100 */
  form: number;
  /** Kondisyon 0..100 — maçlar arası toparlanır */
  fitness: number;
  stats: PlayerStats;
}

export interface Kit {
  primary: string;
  secondary: string;
  shorts: string;
  pattern: "plain" | "stripes" | "halves" | "sash" | "hoops" | "third";
}

export interface Club {
  id: string;
  name: string;
  short: string;
  city: string;
  leagueId: string;
  rating: number;
  kit: Kit;
  gkKit: { primary: string; secondary: string };
  budget: number;
  /** Arma stili tohumu */
  crest: number;
}

export interface League {
  id: string;
  name: string;
  country: string;
  flag: string;
  region: "tr" | "eu" | "lat" | "af";
  tier: number;
}

export interface FormationSlot {
  role: PosCode;
  fx: number; // 0..1 (kendi kalesinden)
  fy: number; // 0..1 (sol kanattan)
}

export interface Formation {
  id: string;
  name: string;
  slots: FormationSlot[];
}

export interface TableRow {
  clubId: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
  form: ("W" | "D" | "L")[];
}

export interface Fixture {
  round: number;
  home: string;
  away: string;
  hg: number | null;
  ag: number | null;
  comp: "league" | "cup";
  cupRound?: number;
}

export interface TeamTactic {
  formation: string;
  mentality: number; // 0 (çok defansif) .. 100 (çok hücumcu)
  pressing: number; // 0..100
  width: number; // 0..100
  lineHeight: number; // 0..100
  tempo: number; // 0..100
  passing: "short" | "mixed" | "long";
}

export interface MatchTeamConfig {
  clubId: string;
  lineup: string[]; // 11 oyuncu id'si (GK dahil)
  tactic: TeamTactic;
  subs: string[];
}

export interface DifficultyLevel {
  id: number;
  name: string;
  ai: number; // CPU yetenek çarpanı 0..1
}

/** Maç kamerası — FIFA benzeri perspektif açıları */
export type CameraId = "broadcast" | "tele" | "action" | "behind" | "sky";

export interface MatchSettings {
  minutes: number; // gerçek dakika
  difficulty: number;
  sound: boolean;
  offside: boolean;
  autoSwitch: boolean;
  /** Kamera açısı */
  camera: CameraId;
  /** Oynanış yardımı 0 (manuel) .. 2 (tam yardım) */
  assist: number;
  /** Grafik kalitesi 0 düşük · 1 orta · 2 yüksek */
  quality: number;
  /** Titreşim geri bildirimi */
  haptics: boolean;
  /** Spiker altyazısı */
  commentary: boolean;
  /** Sakat Faik Modu — halısaha zemini + özel doku */
  faikMode: boolean;
}

export interface MatchResult {
  homeClubId: string;
  awayClubId: string;
  hg: number;
  ag: number;
  pens?: [number, number];
  stats: MatchStats;
  scorers: { clubId: string; playerId: string; minute: number }[];
  ratings: Record<string, number>;
  motm: string | null;
  cards: { playerId: string; type: "y" | "r"; minute: number }[];
}

export interface MatchStats {
  possession: [number, number];
  shots: [number, number];
  onTarget: [number, number];
  passes: [number, number];
  passAcc: [number, number];
  corners: [number, number];
  fouls: [number, number];
  offside: [number, number];
  tackles: [number, number];
  saves: [number, number];
}

export interface Commentary {
  text: string;
  t: number; // dakika
  kind:
    | "info"
    | "goal"
    | "chance"
    | "foul"
    | "card"
    | "save"
    | "miss"
    | "tackle"
    | "kickoff"
    | "half"
    | "full"
    | "corner";
}

export interface World {
  seed: number;
  players: Record<string, Player>;
}

export interface CupTie {
  home: string;
  away: string;
  hg: number | null;
  ag: number | null;
  pens?: [number, number];
}

export interface CupRoundInfo {
  name: string;
  ties: CupTie[];
  done: boolean;
}

/* ---------------- Stadyum ---------------- */

export type StadiumPart = "stands" | "pitch" | "lights" | "screen" | "academy" | "medical";

export interface StadiumState {
  name: string;
  /** Her bölüm 1..8 arası seviyeli */
  levels: Record<StadiumPart, number>;
  /** Koltuk rengi teması */
  theme: number;
}

/* ---------------- Menajer ---------------- */

export type ManagerSkill = "training" | "tactics" | "negotiation" | "motivation" | "scouting" | "youth";

export interface ManagerState {
  name: string;
  level: number;
  xp: number;
  /** Harcanmamış yetenek puanı */
  points: number;
  skills: Record<ManagerSkill, number>;
  avatar: number;
  reputation: number; // 0..100
}

/* ---------------- Ekonomi ---------------- */

export interface Wallet {
  /** Transfer bütçesi, bin € */
  budget: number;
  /** Altın — kulüp geliştirme para birimi */
  gold: number;
  /** Elmas — nadir premium para birimi */
  diamonds: number;
}

export interface Objective {
  id: string;
  text: string;
  goal: number;
  progress: number;
  gold: number;
  diamonds: number;
  claimed: boolean;
}

export interface Career extends Wallet {
  clubId: string;
  season: number;
  round: number;
  lineup: string[];
  subs: string[];
  formation: string;
  tactic: TeamTactic;
  training: Record<string, string>;
  fixtures: Fixture[];
  cup: CupRoundInfo[];
  cupStage: number;
  trophies: string[];
  history: { season: number; pos: number; pts: number }[];
  news: { t: number; text: string }[];
  market: string[];
  wageBudget: number;
  stadium: StadiumState;
  manager: ManagerState;
  objectives: Objective[];
  /** Üst üste kazanılan maç sayısı */
  streak: number;
  /** Toplam oynanan maç */
  played: number;
}

export type Screen =
  | "boot"
  | "home"
  | "teamselect"
  | "squad"
  | "tactics"
  | "transfers"
  | "table"
  | "fixtures"
  | "match"
  | "postmatch"
  | "settings"
  | "stats"
  | "stadium"
  | "manager"
  | "shop"
  | "contracts"
  | "penalties";
