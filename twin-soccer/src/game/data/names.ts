import type { Region } from "../types";

/**
 * Bölgeye göre gerçekçi isim havuzları.
 * Yaygın gerçek isimlerden oluşan geniş havuzlar — belirli bir futbolcuya atıf yok,
 * ancak üretilen kombinasyonlar doğal ve inandırıcı görünür.
 */

const TR_FIRST = [
  "Alparslan", "Berk", "Bora", "Cengiz", "Çağlar", "Çetin", "Deniz", "Doruk",
  "Efe", "Emre", "Ercan", "Eren", "Faruk", "Ferdi", "Gökay", "Görkem",
  "Hakan", "Hüseyin", "İbrahim", "İsmail", "Kaan", "Kadir", "Kemal", "Kerem",
  "Koray", "Kutay", "Levent", "Mert", "Mesut", "Murat", "Musa", "Mustafa",
  "Nuri", "Okan", "Onur", "Orhan", "Osman", "Ömer", "Özgür", "Polat",
  "Rasim", "Salih", "Selim", "Serdar", "Serkan", "Sezgin", "Sinan", "Şener",
  "Tarık", "Tayfun", "Tolga", "Tuna", "Turan", "Uğur", "Umut", "Volkan",
  "Yalçın", "Yaşar", "Yiğit", "Yunus", "Arda", "Batuhan", "Cihan", "Erdem",
];
const TR_LAST = [
  "Acar", "Akarsu", "Akbaş", "Aksoy", "Akyüz", "Altıntaş", "Arslan", "Aydın",
  "Babacan", "Baştürk", "Baysal", "Bilgin", "Bölükbaşı", "Budak", "Bulut", "Çakır",
  "Çelebi", "Çetinkaya", "Çiftçi", "Dağlı", "Demir", "Denizci", "Duman", "Duran",
  "Dündar", "Eldem", "Erdem", "Ergün", "Ertuğrul", "Esmer", "Gezer", "Gümüş",
  "Gündoğdu", "Güneş", "Güven", "Hamzaoğlu", "Kandemir", "Karaca", "Karaman", "Kaya",
  "Kılıç", "Korkmaz", "Koyuncu", "Kurtuluş", "Kutlu", "Mıhçı", "Nakipoğlu", "Orhun",
  "Özdemir", "Özer", "Özkara", "Paksüt", "Sarıkaya", "Sazak", "Serbest", "Solmaz",
  "Şahin", "Taşdelen", "Tekeli", "Tüzün", "Uçar", "Uslu", "Yavuz", "Yıldırım",
];

const EU_FIRST = [
  "Aleksandar", "Andreas", "Anton", "Bastian", "Benjamin", "Bruno", "Carlo", "Christian",
  "Damir", "Dario", "David", "Dominik", "Erik", "Fabian", "Felix", "Filip",
  "Florian", "Gabriel", "Georg", "Henrik", "Jakub", "Jonas", "Jonathan", "Josef",
  "Julian", "Kasper", "Konrad", "Kristian", "Lars", "Leon", "Lorenzo", "Lukas",
  "Magnus", "Marcel", "Markus", "Mateo", "Matthias", "Milan", "Nathan", "Nicolas",
  "Oliver", "Oskar", "Patrik", "Pavel", "Petar", "Rafael", "Rasmus", "Roman",
  "Sebastian", "Simon", "Stefan", "Sven", "Theo", "Thomas", "Tobias", "Valentino",
  "Viktor", "Vincent", "Emil", "Malte", "Nils", "Ruben",
];
const EU_LAST = [
  "Almeida", "Bachmann", "Baranović", "Bauer", "Berg", "Bianchi", "Böhm", "Brandt",
  "Cvetković", "Dahl", "De Vries", "Dietrich", "Dvořák", "Eriksen", "Falk", "Ferrari",
  "Fischer", "Fossen", "Gruber", "Hansen", "Hartmann", "Hoffmann", "Horvat", "Huber",
  "Jansen", "Johansson", "Kaiser", "Keller", "Kovač", "Krüger", "Larsen", "Lindström",
  "Lorenz", "Mancini", "Marchetti", "Mayer", "Meijer", "Moreau", "Müller", "Nielsen",
  "Novak", "Obermayer", "Orsini", "Ostrowski", "Pedersen", "Petersen", "Reich", "Richter",
  "Rossi", "Roth", "Santoro", "Schneider", "Schröder", "Steiner", "Varga", "Vermeer",
  "Vogel", "Wagner", "Weber", "Winkler", "Zeman", "Brückner",
];

const LAT_FIRST = [
  "Alan", "Alexis", "Andrés", "Ángel", "Antonio", "Ariel", "Bruno", "Camilo",
  "Carlos", "César", "Cristian", "Damián", "Daniel", "Dario", "Diego", "Edgardo",
  "Emiliano", "Enzo", "Esteban", "Fabricio", "Federico", "Felipe", "Fernando", "Francisco",
  "Gabriel", "Gonzalo", "Héctor", "Hugo", "Ignacio", "Iván", "Javier", "Jerónimo",
  "Joaquín", "Jorge", "Juan", "Julián", "Leandro", "Lorenzo", "Lucas", "Luis",
  "Manuel", "Marcelo", "Marcos", "Mario", "Martín", "Mateo", "Matías", "Miguel",
  "Nicolás", "Óscar", "Pablo", "Rafael", "Ramiro", "Rodrigo", "Samuel", "Santiago",
  "Sebastián", "Thiago", "Tomás", "Valentín", "Vicente", "Facundo",
];
const LAT_LAST = [
  "Aguirre", "Alarcón", "Albornoza", "Amaya", "Arce", "Arriaga", "Barrios", "Benítez",
  "Bermúdez", "Bolaños", "Cabral", "Cáceres", "Caicedo", "Cárdenas", "Carvajal", "Casanova",
  "Ceballos", "Cordero", "Cuadrado", "Delgado", "Domínguez", "Duarte", "Escobar", "Espinosa",
  "Estévez", "Farías", "Fernández", "Ferrer", "Figueroa", "Flores", "Franco", "Gaitán",
  "Galindo", "Garzón", "Gómez", "Grisales", "Guzmán", "Henríquez", "Herrera", "Ibarra",
  "Jaramillo", "Lastra", "Ledesma", "Lozano", "Maldonado", "Marín", "Medina", "Miramón",
  "Montoya", "Moreira", "Murillo", "Noguera", "Ocampo", "Padilla", "Palacios", "Paredes",
  "Quiñónez", "Ramírez", "Rentería", "Rincón", "Roldán", "Salazar", "Salgado", "Sanabria",
  "Segura", "Serrano", "Solano", "Urrea", "Valdés", "Villalba", "Zamudio",
];

const AF_FIRST = [
  "Abdul", "Adama", "Ahmad", "Aïssa", "Akim", "Alhassan", "Amadou", "Amin",
  "Anis", "Ayoub", "Bachir", "Boubacar", "Brahim", "Chaker", "Cheick", "Dahirou",
  "Dembo", "Djibril", "Elias", "Emeka", "Essa", "Farid", "Fodé", "Ghali",
  "Habib", "Hamady", "Haroun", "Idrissa", "Ismaël", "Jama", "Kalidou", "Karim",
  "Kassim", "Khadim", "Larbi", "Madani", "Mahmoud", "Mamadou", "Marouane", "Medhi",
  "Moulaye", "Nabil", "Obinna", "Ousmane", "Rachid", "Sadibou", "Sahle", "Sékou",
  "Siddik", "Souleymane", "Tahar", "Tidiane", "Toufik", "Yacine", "Yaya", "Youssef",
  "Zakaria", "Zied", "Amine", "Hamidou",
];
const AF_LAST = [
  "Abubakar", "Achebe", "Adeyemi", "Afolabi", "Ahmed", "Aït-Bachir", "Amrani", "Badji",
  "Bagayoko", "Bakary", "Belkacem", "Bello", "Benali", "Bouazza", "Bouchaib", "Cissé",
  "Coulibaly", "Danjuma", "Diabaté", "Diakité", "Diallo", "Diarra", "Doumbia", "Eze",
  "Fofana", "Gueye", "Haidara", "Hamdani", "Iddrissu", "Jalloh", "Kanouté", "Keita",
  "Kolo", "Konaté", "Koroma", "Kossi", "Makena", "Mensah", "Merbah", "Moussa",
  "Mwangi", "Ndiaye", "Nkemdi", "Nwosu", "Okeke", "Onwudiwe", "Osei", "Ouattara",
  "Sarr", "Savané", "Sidibé", "Sissoko", "Sow", "Tchakala", "Touré", "Traoré",
  "Uche", "Wane", "Yattara", "Youssouf", "Zerhouni", "Zongo",
];

const NATS: Record<Region, string[]> = {
  tr: ["🇹🇷", "🇦🇿", "🇹🇷", "🇹🇷", "🇹🇷", "🇽🇰", "🇲🇰"],
  eu: ["🇩🇪", "🇮🇹", "🇫🇷", "🇪🇸", "🇳🇱", "🇵🇱", "🇸🇪", "🇩🇰", "🇧🇪", "🇦🇹", "🇨🇿", "🇭🇷", "🇷🇸", "🇵🇹", "🇨🇭"],
  lat: ["🇧🇷", "🇦🇷", "🇨🇴", "🇺🇾", "🇲🇽", "🇨🇱", "🇵🇪", "🇻🇪", "🇪🇨", "🇵🇾", "🇨🇷", "🇭🇳"],
  af: ["🇸🇳", "🇳🇬", "🇬🇭", "🇨🇮", "🇲🇦", "🇨🇲", "🇲🇱", "🇩🇿", "🇹🇳", "🇰🇪", "🇿🇦", "🇪🇬", "🇬🇦"],
};

export const POOLS: Record<Region, { first: string[]; last: string[] }> = {
  tr: { first: TR_FIRST, last: TR_LAST },
  eu: { first: EU_FIRST, last: EU_LAST },
  lat: { first: LAT_FIRST, last: LAT_LAST },
  af: { first: AF_FIRST, last: AF_LAST },
};

export function natsFor(region: Region): string[] {
  return NATS[region];
}

/** Spiker replikleri — %p oyuncu adı, %t takım kısaltması yer tutucusu. */
export const COMMENTARY = {
  kickoff: [
    "Ve hakem maçı başlatıyor! %t topu oyuna sokuyor.",
    "Saha hazır, tribünler dolu... maç başladı!",
    "İlk düdük çaldı, %t ile başlıyoruz.",
  ],
  shotWide: [
    "%p vurdu... az farkla auta gitti!",
    "Büyük şans! %p vuruşunu kaleyi bulamadı.",
    "Dışarı! %p çok üzgün, pozisyon netti.",
  ],
  shotSaved: [
    "Muhteşem kurtarış! %p boş gole bakıyor.",
    "Kaleci uçtu ve topu çeldi!",
    "Ne refleksti! %p şaşkın bakıyor.",
  ],
  goal: [
    "GOOOL! %p ağları havalandırıyor!",
    "İnanılmaz! %p bitirdi işi, %t deliriyor!",
    "GOL! %p köşeden fileleri buldu!",
  ],
  tackle: [
    "Temiz müdahale, top kazanıldı.",
    "Güzel top kapma, oyun devam ediyor.",
    "Defans ayakta, %p topu kazandı.",
  ],
  foul: [
    "Faul! Hakem düdüğü çaldırdı.",
    "Sert temas var, serbest vuruş.",
  ],
  yellow: [
    "Sarı kart! %p artık dikkatli olmalı.",
    "Hakem kart gösteriyor, %p kayıtlara geçti.",
  ],
  red: [
    "KIRMIZI KART! %p oyundan atıldı!",
    "Hakem kırmızıyı gösterdi, takım 10 kişide!",
  ],
  corner: [
    "Korner! Ceza sahasında tehlike bekliyor.",
    "Köşe vuruşu, orta sahaya yükleniyorlar.",
  ],
  offside: [
    "Ofsayt! Bayrak havada.",
    "Ofsayt bayrağı kalktı, gol sayılmaz.",
  ],
  halftime: [
    "İlk yarı sona erdi.",
    "Devre arası. Takımlar soyunma odasına gidiyor.",
  ],
  fulltime: [
    "Ve maç bitiyor! Hakem son düdüğü çalıyor.",
    "Maç sona erdi, tribünlerde alkış var.",
  ],
  pens: [
    "Penaltılar! Sinirler tırmanıyor.",
    "Kaleci ile gole buluşan arasında nefes kesen anlar.",
  ],
  chance: [
    "%p ceza sahasına giriyor, tehlike büyüyor!",
    "Güzel top, boş alan açıldı...",
    "Orta sahadan hızlı çıkış geliyor!",
  ],
  near: [
    "Direkten döndü! İnanılmaz pozisyon.",
    "Kalenin dibinden geçti!",
  ],
} as const;

export type CommentaryKind = keyof typeof COMMENTARY;
