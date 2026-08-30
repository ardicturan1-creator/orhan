import type { Club, League } from "../types";

/* ============================================================
 *  BYMEL SOCCER — Kurgusal lig ve kulüp veri tabanı
 *  Tüm isimler kurgusaldır, gerçek kulüplerle ilgisi yoktur.
 * ============================================================ */

export const LEAGUES: League[] = [
  { id: "sl", name: "BYMEL Süper Lig", country: "Türkiye", flag: "🇹🇷", region: "tr", tier: 1 },
  { id: "ap", name: "Adria Premier", country: "Avrupa", flag: "🇪🇺", region: "eu", tier: 1 },
  { id: "ca", name: "Copa Atlántika", country: "Latin", flag: "🌎", region: "lat", tier: 1 },
  { id: "dy", name: "Çöl Yıldızları", country: "Doğu", flag: "🌍", region: "af", tier: 2 },
];

type ClubTuple = [string, string, string, number, string, string, string, Club["kit"]["pattern"]];

const SL: ClubTuple[] = [
  ["Anadolu Yıldızı", "ADY", "Ankara", 84, "#e11d48", "#ffffff", "#ffffff", "stripes"],
  ["Ege Fırtınası", "EGF", "İzmir", 82, "#1d4ed8", "#ffffff", "#1e3a8a", "plain"],
  ["Karadeniz Dalgası", "KDD", "Trabzon", 80, "#7f1d3a", "#7dd3fc", "#111827", "plain"],
  ["Marmara Birliği", "MRB", "İstanbul", 79, "#facc15", "#0a1f44", "#0a1f44", "plain"],
  ["Toros Kaplanları", "TRK", "Mersin", 77, "#f97316", "#0f172a", "#0f172a", "stripes"],
  ["Kapadokya SK", "KAP", "Nevşehir", 75, "#f8fafc", "#7c3aed", "#4c1d95", "sash"],
  ["Fırat Gücü", "FRG", "Elazığ", 74, "#22c55e", "#052e16", "#052e16", "plain"],
  ["Trakya Şimşekleri", "TRŞ", "Edirne", 72, "#38bdf8", "#f8fafc", "#0c4a6e", "hoops"],
  ["Akdeniz Aslanları", "AKA", "Antalya", 71, "#dc2626", "#fde047", "#1f2937", "halves"],
  ["Konya Ovası SK", "KON", "Konya", 70, "#a3e635", "#1a2e05", "#1a2e05", "stripes"],
  ["Van Gölü SK", "VAN", "Van", 68, "#0ea5e9", "#ffffff", "#075985", "plain"],
  ["Başkent Gençlik", "BSK", "Eskişehir", 67, "#f43f5e", "#1f2937", "#1f2937", "plain"],
  ["Çoruh Vadisi SK", "CRH", "Artvin", 65, "#14b8a6", "#0f172a", "#0f172a", "stripes"],
  ["Kızılırmak SK", "KZL", "Samsun", 64, "#b91c1c", "#facc15", "#7f1d1d", "hoops"],
];

const AP: ClubTuple[] = [
  ["Vesper United", "VSP", "Trieste", 83, "#0f172a", "#e2e8f0", "#e2e8f0", "sash"],
  ["Belmar City", "BLM", "Ljubljana", 81, "#4f46e5", "#f8fafc", "#312e81", "plain"],
  ["Krystal SK", "KRY", "Kraków", 80, "#f5f5f5", "#0891b2", "#0891b2", "stripes"],
  ["Wolfen 04", "WLF", "Graz", 78, "#334155", "#f8fafc", "#0f172a", "plain"],
  ["Danubia SK", "DAN", "Bratislava", 77, "#eab308", "#1c1917", "#1c1917", "halves"],
  ["Silverpark FC", "SIL", "Zagreb", 75, "#cbd5e1", "#1e293b", "#1e293b", "hoops"],
  ["Nova Stella", "NVS", "Split", 74, "#0284c7", "#fbbf24", "#0c4a6e", "plain"],
  ["Falcon Bay FC", "FBY", "Koper", 72, "#16a34a", "#ffffff", "#14532d", "stripes"],
  ["Ironfield United", "IRN", "Sarajevo", 71, "#f97316", "#111827", "#111827", "hoops"],
  ["Monte Verde CF", "MTV", "Podgorica", 69, "#84cc16", "#f7fee7", "#3f6212", "plain"],
  ["Eastvale FC", "EAV", "Pécs", 67, "#be123c", "#fff1f2", "#4c0519", "sash"],
  ["Lakeshore FC", "LKS", "Balaton", 66, "#06b6d4", "#0f172a", "#0f172a", "stripes"],
  ["Zeleni Vrh", "ZLV", "Maribor", 65, "#22c55e", "#f8fafc", "#166534", "plain"],
  ["Portside Athletic", "PRT", "Rijeka", 64, "#ef4444", "#1e293b", "#1e293b", "halves"],
];

const CA: ClubTuple[] = [
  ["Atlético Solano", "SOL", "Rosario", 83, "#dc2626", "#f8fafc", "#0f172a", "stripes"],
  ["Deportivo Cielo", "CIE", "Mendoza", 81, "#2563eb", "#f8fafc", "#1e3a8a", "plain"],
  ["Costa Dorada FC", "CDO", "Valparaíso", 79, "#f59e0b", "#1f2937", "#1f2937", "hoops"],
  ["Verde Selva SC", "VER", "Manaus", 77, "#16a34a", "#fefce8", "#14532d", "plain"],
  ["Ciclón Tropical", "CIC", "Barranquilla", 76, "#06b6d4", "#fde047", "#0e7490", "halves"],
  ["Real Albor", "ALB", "Sevilla", 75, "#f8fafc", "#7c3aed", "#4c1d95", "sash"],
  ["Club Andino", "AND", "Mendoza", 73, "#e2e8f0", "#0f766e", "#134e4a", "stripes"],
  ["Rayo Azul", "RAZ", "Guadalajara", 72, "#3b82f6", "#facc15", "#1e40af", "plain"],
  ["Tango City FC", "TAN", "Buenos Aires", 70, "#be123c", "#0f172a", "#0f172a", "hoops"],
  ["Los Volcanes", "VOL", "Quito", 69, "#f97316", "#0f172a", "#7c2d12", "plain"],
  ["Pampa Stars", "PMP", "Bahía Blanca", 67, "#a3e635", "#1a2e05", "#365314", "stripes"],
  ["Isla Blanca SC", "ISB", "Punta del Este", 65, "#f8fafc", "#0ea5e9", "#0369a1", "sash"],
];

const DY: ClubTuple[] = [
  ["Al Sahra SK", "SAH", "Riyadh", 78, "#0f766e", "#f8fafc", "#134e4a", "plain"],
  ["Qasr Falcons", "QSR", "Doha", 76, "#7c3aed", "#fbbf24", "#4c1d95", "sash"],
  ["Oasis SC", "OAS", "Dubai", 74, "#f59e0b", "#0f172a", "#78350f", "stripes"],
  ["Dune City FC", "DUN", "Abu Dhabi", 72, "#eab308", "#1c1917", "#1c1917", "plain"],
  ["Nur City FC", "NUR", "Sharjah", 71, "#f8fafc", "#16a34a", "#14532d", "halves"],
  ["Sable Lions", "SBL", "Dakar", 70, "#16a34a", "#facc15", "#14532d", "plain"],
  ["Ksar United", "KSR", "Marrakech", 68, "#dc2626", "#0f172a", "#7f1d1d", "stripes"],
  ["Palm Bay SC", "PLB", "Jeddah", 67, "#0ea5e9", "#f8fafc", "#075985", "hoops"],
  ["Atlas Bulls", "ATB", "Casablanca", 66, "#b91c1c", "#f8fafc", "#450a0a", "plain"],
  ["Karawan SK", "KRW", "Tunus", 65, "#e2e8f0", "#dc2626", "#7f1d1d", "sash"],
  ["Sina SK", "SNA", "Kahire", 64, "#f59e0b", "#0f172a", "#facc15", "stripes"],
  ["Bahr SK", "BAH", "Manama", 63, "#94a3b8", "#0f172a", "#1e293b", "halves"],
];

const ALL: ClubTuple[][] = [SL, AP, CA, DY];

/** Kaleci forma renkleri — sahada rakip renklerinden ayrışsın diye canlı tonlar */
const GK_KITS = ["#22d3ee", "#a3e635", "#fb923c", "#e879f9", "#facc15", "#f87171", "#38bdf8"];

function buildClubs(): Club[] {
  const out: Club[] = [];
  LEAGUES.forEach((lg, li) => {
    ALL[li].forEach((c, i) => {
      out.push({
        id: `${lg.id}_${i + 1}`,
        name: c[0],
        short: c[1],
        city: c[2],
        leagueId: lg.id,
        rating: c[3],
        kit: { primary: c[4], secondary: c[5], shorts: c[6], pattern: c[7] },
        gkKit: { primary: GK_KITS[(li * 7 + i) % GK_KITS.length], secondary: "#0b1220" },
        budget: Math.round((30 + (c[3] - 60) * 26) * 100),
        crest: (li * 13 + i * 5 + c[0].length) % 5,
      });
    });
  });
  return out;
}

export const CLUBS: Club[] = buildClubs();
export const CLUB_MAP: Record<string, Club> = Object.fromEntries(CLUBS.map((c) => [c.id, c]));
export const clubsOfLeague = (leagueId: string) => CLUBS.filter((c) => c.leagueId === leagueId);

export const LEAGUE_MAP: Record<string, League> = Object.fromEntries(
  LEAGUES.map((l) => [l.id, l])
);
