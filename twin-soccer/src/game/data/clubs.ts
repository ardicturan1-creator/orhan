import type { Club, Kit, KitPattern, League } from "../types";

/**
 * 4 kurgusal lig, 52 kurgusal kulüp.
 * İsimler gerçek bir kulübe ait DEĞİLDİR; yalnızca gerçekçi bir dünya kurmak için
 * yaygın futbol adlandırma kalıpları (spor / FK / SC / CF / United) kullanılmıştır.
 */

export const LEAGUES: League[] = [
  { id: "lig_bymel", name: "Anadolu Süper Lig", country: "Türkiye", flag: "🇹🇷", region: "tr", tier: 1 },
  { id: "lig_adria", name: "Adria Premier League", country: "Adria Birliği", flag: "🇪🇺", region: "eu", tier: 1 },
  { id: "lig_atl", name: "Liga Atlántika", country: "Atlántika", flag: "🌎", region: "lat", tier: 1 },
  { id: "lig_desert", name: "Sahra Ligi", country: "Kum Federasyonu", flag: "🌍", region: "af", tier: 1 },
];

type Raw = [string, string, string, string, number, string, string, string, KitPattern, string, string];

const RAW: Record<string, Raw[]> = {
  lig_bymel: [
    ["karakoy", "Karaköyspor", "KRK", "Karaköy", 84, "#f4f6f8", "#0d2a52", "#0d2a52", "stripes", "#ffd23f", "#1b1b1b"],
    ["golcuk", "Gölcük SK", "GLC", "Gölcük", 82, "#1d4ed8", "#ffffff", "#ffffff", "plain", "#ff7a00", "#111827"],
    ["menekse", "Menekşesaray FK", "MNK", "Menekşesaray", 81, "#7c3aed", "#facc15", "#3b0764", "sash", "#22d3ee", "#0f172a"],
    ["tuzla", "Tuzlaspor 1923", "TZL", "Tuzla", 80, "#0ea5e9", "#083344", "#083344", "halves", "#f472b6", "#111827"],
    ["bozok", "Bozokspor", "BZK", "Bozok", 79, "#b91c1c", "#fde047", "#111827", "plain", "#22c55e", "#0f172a"],
    ["cedille", "Çedille 1924", "ÇED", "Çedilleşehir", 78, "#f8f8f8", "#111827", "#111827", "stripes", "#f97316", "#000000"],
    ["iyciler", "İyicilerspor", "İYC", "İyiköy", 77, "#15803d", "#ffffff", "#14532d", "hoops", "#eab308", "#0b1220"],
    ["palandoken", "Palandökenspor", "PLD", "Palandöken", 76, "#0369a1", "#e0f2fe", "#075985", "plain", "#dc2626", "#0f172a"],
    ["manolya", "Manolyaspor", "MNL", "Manolya", 75, "#ec4899", "#ffffff", "#831843", "sash", "#84cc16", "#111827"],
    ["sisli", "Şişlihane FK", "ŞSH", "Şişlihane", 74, "#111827", "#f97316", "#111827", "halves", "#38bdf8", "#000000"],
    ["toros", "Torosspor", "TRS", "Toroslar", 73, "#f59e0b", "#7c2d12", "#7c2d12", "hoops", "#a3e635", "#1c1917"],
    ["ayvalik", "Ayvalık Belediyespor", "AYV", "Ayvalık", 72, "#14b8a6", "#f0fdfa", "#134e4a", "plain", "#f43f5e", "#0f172a"],
    ["dikmen", "Dikmenspor", "DKM", "Dikmen", 71, "#475569", "#f1f5f9", "#1e293b", "third", "#fb923c", "#020617"],
    ["kartal", "Kartalkaya 1905", "KTK", "Kartalkaya", 70, "#dc2626", "#000000", "#000000", "stripes", "#facc15", "#0a0a0a"],
  ],
  lig_adria: [
    ["vellmar", "Vellmar United", "VEL", "Vellmar", 83, "#be123c", "#fde68a", "#1f2937", "plain", "#22d3ee", "#0f172a"],
    ["nordvik", "Nordvik IF", "NRV", "Nordvik", 82, "#1e3a8a", "#fbbf24", "#fbbf24", "hoops", "#f87171", "#0b1220"],
    ["portofino", "Portofino Calcio", "PRT", "Portofino", 81, "#0f766e", "#ffffff", "#134e4a", "sash", "#fbbf24", "#0f172a"],
    ["brixen", "Brixen 04", "BRX", "Brixen", 80, "#f5f5f5", "#7c3aed", "#312e81", "stripes", "#a3e635", "#111827"],
    ["lorrach", "Lörrach Kickers", "LRK", "Lörrach", 79, "#ea580c", "#0c4a6e", "#0c4a6e", "halves", "#38bdf8", "#1c1917"],
    ["zagorsk", "Zagorsk Dinamo", "ZGD", "Zagorsk", 78, "#1d4ed8", "#dc2626", "#1e3a8a", "plain", "#facc15", "#0f172a"],
    ["marseille", "Marselhaven FC", "MRH", "Marselhaven", 77, "#0284c7", "#e2e8f0", "#075985", "hoops", "#f43f5e", "#082f49"],
    ["krakowia", "KS Krakowia", "KKW", "Krakowia", 76, "#b91c1c", "#ffffff", "#7f1d1d", "stripes", "#a3e635", "#111827"],
    ["aalst", "Aalst Vooruit", "AAL", "Aalst", 75, "#facc15", "#1e293b", "#1e293b", "sash", "#f472b6", "#0f172a"],
    ["troodos", "Troodos FC", "TRD", "Troodos", 74, "#7c3aed", "#f5d0fe", "#4c1d95", "plain", "#34d399", "#1e1b4b"],
    ["ostend", "Ostend FC", "OST", "Ostend", 73, "#0369a1", "#f0f9ff", "#0c4a6e", "third", "#fb923c", "#082f49"],
    ["bratislava", "Sokol Bratislava", "SKB", "Bratislava", 72, "#166534", "#fde047", "#14532d", "hoops", "#f87171", "#052e16"],
    ["liege", "Royal Liège FC", "RLG", "Liège", 71, "#dc2626", "#1e40af", "#1e40af", "halves", "#a5f3fc", "#111827"],
    ["vantaa", "Vantaa IF", "VTN", "Vantaa", 70, "#0f172a", "#38bdf8", "#334155", "stripes", "#e879f9", "#020617"],
  ],
  lig_atl: [
    ["valdemia", "Club Valdemia", "VLD", "Valdemia", 81, "#059669", "#fde68a", "#065f46", "sash", "#f43f5e", "#022c22"],
    ["cordoba", "CD Córdoba", "CDB", "Córdoba", 80, "#7dd3fc", "#0c4a6e", "#0c4a6e", "plain", "#facc15", "#082f49"],
    ["maresia", "Maresia FC", "MRS", "Maresia", 79, "#facc15", "#0f172a", "#0f172a", "hoops", "#22d3ee", "#1c1917"],
    ["quillota", "Deportivo Quillota", "QLT", "Quillota", 78, "#be185d", "#fce7f3", "#831843", "stripes", "#a3e635", "#500724"],
    ["tupamba", "Tupamba FC", "TPB", "Tupamba", 77, "#16a34a", "#ffffff", "#15803d", "plain", "#fb7185", "#052e16"],
    ["sabaneta", "Real Sabaneta", "SBN", "Sabaneta", 76, "#2563eb", "#f8fafc", "#1e3a8a", "halves", "#f59e0b", "#172554"],
    ["puntaalta", "Punta Alta CF", "PNA", "Punta Alta", 75, "#f97316", "#1c1917", "#1c1917", "third", "#38bdf8", "#292524"],
    ["catamarca", "Deportivo Catamarca", "CTM", "Catamarca", 74, "#eab308", "#7c2d12", "#7c2d12", "hoops", "#22c55e", "#1c1917"],
    ["iguazu", "Iguaçu EC", "IGU", "Iguaçu", 73, "#15803d", "#fef08a", "#166534", "sash", "#f472b6", "#14532d"],
    ["monteverde", "Monteverde SC", "MTV", "Monteverde", 72, "#4338ca", "#e0e7ff", "#312e81", "plain", "#fbbf24", "#1e1b4b"],
    ["tierrafirme", "CD Tierra Firme", "TRF", "Tierra Firme", 71, "#dc2626", "#fca5a5", "#7f1d1d", "stripes", "#67e8f9", "#450a0a"],
    ["costadelsol", "CF Costa del Sol", "CDS", "Costa del Sol", 70, "#0891b2", "#ecfeff", "#164e63", "halves", "#fda4af", "#083344"],
  ],
  lig_desert: [
    ["sahra", "Sahra SC", "SHR", "Sahra", 80, "#f59e0b", "#1f2937", "#1f2937", "sash", "#22d3ee", "#111827"],
    ["nubia", "Nubia FC", "NUB", "Nubia", 79, "#7f1d1d", "#fca5a5", "#450a0a", "plain", "#fde047", "#1c1917"],
    ["kalahari", "Kalahari United", "KLH", "Kalahari", 78, "#b45309", "#fef3c7", "#78350f", "hoops", "#4ade80", "#1c1917"],
    ["zamzam", "Zamzam SC", "ZMZ", "Zamzam", 77, "#0d9488", "#fef08a", "#134e4a", "stripes", "#f472b6", "#042f2e"],
    ["ouarzazate", "Ouarzazate FC", "OUZ", "Ouarzazate", 76, "#c2410c", "#ffedd5", "#7c2d12", "halves", "#38bdf8", "#1c1917"],
    ["tamanrasset", "Tamanrasset SC", "TMN", "Tamanrasset", 75, "#065f46", "#f0fdfa", "#064e3b", "plain", "#facc15", "#022c22"],
    ["garamantes", "Garamantes FC", "GRM", "Garamentes", 74, "#7e22ce", "#f5f3ff", "#581c87", "sash", "#a3e635", "#2e1065"],
    ["danakil", "Danakil FC", "DNK", "Danakil", 73, "#e5e5e5", "#737373", "#404040", "stripes", "#f43f5e", "#171717"],
    ["tibesti", "Tibesti SC", "TBS", "Tibesti", 72, "#a16207", "#fef9c3", "#713f12", "hoops", "#60a5fa", "#1c1917"],
    ["chinguetti", "Chinguetti FC", "CHG", "Chinguetti", 71, "#0369a1", "#e0f2fe", "#075985", "plain", "#fb923c", "#082f49"],
    ["zagora", "Zagora FC", "ZGA", "Zagora", 70, "#1e1b4b", "#c7d2fe", "#312e81", "halves", "#facc15", "#0f0a2e"],
    ["siwa", "Siwa Oasis FC", "SIW", "Siwa", 69, "#4d7c0f", "#ecfccb", "#365314", "third", "#f87171", "#1a2e05"],
  ],
};

function mkKit(primary: string, secondary: string, shorts: string, pattern: KitPattern): Kit {
  return { primary, secondary, shorts, pattern };
}

export const CLUBS: Record<string, Club> = {};
export const CLUB_LIST: Club[] = [];

for (const lg of LEAGUES) {
  for (const r of RAW[lg.id]) {
    const [id, name, short, city, rating, p1, p2, shorts, pattern, gk1, gk2] = r;
    const c: Club = {
      id, name, short, city, leagueId: lg.id, rating,
      kit: mkKit(p1, p2, shorts, pattern),
      gkKit: mkKit(gk1, gk2, "#111827", "plain"),
      // Bütçe güce orantılı: 63 → ~6M, 84 → ~62M (bin €)
      budget: Math.round((Math.pow(rating / 63, 4.1) * 5200 + 900) / 50) * 50,
      crest: (rating + id.length) % 5,
    };
    CLUBS[id] = c;
    CLUB_LIST.push(c);
  }
}

export function clubsOf(leagueId: string): Club[] {
  return CLUB_LIST.filter((c) => c.leagueId === leagueId);
}
