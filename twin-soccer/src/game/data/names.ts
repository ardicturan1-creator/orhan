/* Kurgusal oyuncu isim havuzları (bölgeye göre) */

export const NATS: Record<string, string> = {
  tr: "🇹🇷",
  eu: "🇪🇺",
  lat: "🌎",
  af: "🌍",
};

export const FIRST: Record<string, string[]> = {
  tr: [
    "Barış", "Emre", "Kerem", "Arda", "Yusuf", "Mert", "Cengiz", "Serkan", "Onur", "Tolga",
    "Uğur", "Hakan", "Burak", "Cem", "Deniz", "Efe", "Furkan", "Gökhan", "İsmail", "Kaan",
    "Levent", "Murat", "Necip", "Ozan", "Rıdvan", "Sinan", "Taha", "Umut", "Volkan", "Yunus",
    "Alper", "Batuhan", "Doruk", "Ege", "Halil", "İbrahim", "Kadir", "Mert", "Selçuk", "Taner",
  ],
  eu: [
    "Milan", "Luka", "Andrej", "Nikola", "Ivan", "Marko", "Jaka", "Tomas", "Petr", "Stefan",
    "Dario", "Filip", "Goran", "Jakub", "Luka", "Mateo", "Nino", "Ondrej", "Pavel", "Roko",
    "Simon", "Tadej", "Vasil", "Zoran", "Bogdan", "Emil", "Erik", "Filip", "Gregor", "Jan",
  ],
  lat: [
    "Mateo", "Thiago", "Santiago", "Lautaro", "Emiliano", "Joaquín", "Bruno", "Diego", "Enzo",
    "Facundo", "Gonzalo", "Ignacio", "Julián", "Kevin", "Lucas", "Matías", "Nicolás", "Óscar",
    "Pablo", "Ramiro", "Sebastián", "Tomás", "Valentín", "Álvaro", "Federico", "Gabriel",
    "Hernán", "Iván", "Jesús", "Marcos",
  ],
  af: [
    "Youssef", "Karim", "Omar", "Hassan", "Ali", "Ziad", "Amine", "Bilal", "Cheikh", "Diomandé",
    "Émile", "Firas", "Hamza", "Ismail", "Jamal", "Khalid", "Mansour", "Nabil", "Ousmane",
    "Rachid", "Sami", "Tariq", "Walid", "Yasin", "Zied", "Fodé", "Moussa", "Sadio", "Idrissa",
    "Bakary",
  ],
};

export const LAST: Record<string, string[]> = {
  tr: [
    "Yıldırım", "Demirkol", "Akbay", "Çetin", "Korkmaz", "Şahin", "Aydın", "Bozkurt", "Doğanay",
    "Erbay", "Fırat", "Gümüş", "Hakyemez", "İlhan", "Kabak", "Lüleci", "Mengi", "Nalbant",
    "Orhan", "Özkan", "Poyraz", "Rüzgar", "Soylu", "Tanrıverdi", "Uçar", "Varol", "Yalçın",
    "Zorlu", "Ateş", "Bulut", "Ceyhan", "Duman", "Ege", "Gedik", "Horoz", "Işık",
  ],
  eu: [
    "Novak", "Vidmar", "Kovač", "Horvat", "Zajc", "Bilic", "Perišić", "Šimić", "Vrba", "Zlatar",
    "Kranjc", "Babić", "Marić", "Radić", "Tomić", "Vuković", "Weiss", "Müller", "Steiner",
    "Berger", "Hoffmann", "Keller", "Wagner", "Adler", "Fischer", "Gruber", "Holzer", "Keller",
    "Lindner", "Maier",
  ],
  lat: [
    "Aguirre", "Barreto", "Cabrera", "Duarte", "Escobar", "Ferreira", "Gutiérrez", "Herrera",
    "Ibáñez", "Jiménez", "Ledesma", "Montiel", "Navarro", "Ocampo", "Palacios", "Quiroga",
    "Ramírez", "Salazar", "Tobías", "Ureña", "Villalba", "Zárate", "Bustos", "Córdoba",
    "Domínguez", "Echeverría", "Figueroa", "Godoy", "Lozano", "Maldonado",
  ],
  af: [
    "Al-Farsi", "Benali", "Chakla", "Diarra", "El Amrani", "Farouk", "Ghali", "Haddad",
    "Idrissi", "Jaziri", "Khalil", "Lahmar", "Mansouri", "Nasser", "Ouahbi", "Rahimi", "Said",
    "Tahiri", "Yamani", "Zerouali", "Bamba", "Camara", "Diallo", "Fofana", "Keita", "Koné",
    "Mané", "Ndiaye", "Sarr", "Touré",
  ],
};

/* Yorumcu replikleri */
export const COMMENTARY = {
  kickoff: [
    "Maç başladı! {home} - {away} karşılaşması yöneticiyi bekliyor.",
    "Hakem düdüğü çaldı, {home} sahaya çok iyi başladı.",
    "Stadyum dolu! {home} ile {away} arasındaki kritik maç başlıyor.",
  ],
  goal: [
    "GOOOL! {player} ağları havalandırdı!",
    "Muhteşem bir gol! {player} adını skora yazdırdı!",
    "İnanılmaz! {player} kaleciyi çaresiz bıraktı!",
    "{player} bitirdi! Taraftar ayakta!",
    "Skor değişti! {player} soğukkanlı bir bitiş yaptı.",
  ],
  save: [
    "Kaleci harika kurtardı!",
    "Muhteşem bir refleks! Gol olmadı.",
    "Elinin ucuyla çeldi, kaleci dev gibi!",
  ],
  miss: [
    "Az farkla auta gitti, kaçırdı!",
    "Büyük fırsat! Bu gol olmalıydı.",
    "Kaleyi bulamadı, tribünler ayaklandı.",
  ],
  foul: [
    "Sert müdahale! Hakem faul düdüğü çaldı.",
    "Orta sahada faul, oyun durdu.",
  ],
  corner: ["Korner!"], goalkick: ["Kale vuruşu."], throwin: ["Taç atışı."],
  half: ["İlk yarı sona erdi."], full: ["Maç sona erdi!"],
};
