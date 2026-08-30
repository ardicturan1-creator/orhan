# TWIN SOCCER

BYMEL SOFTWARE tarafından geliştirilen, tarayıcıda çalışan yatay (landscape) mobil futbol
oyunu. Kariyer modu, 3B perspektif maç motoru, stadyum ve menajer geliştirme, transfer &
sözleşme yönetimi ve elmas/altın ekonomisi içerir.

## Çalıştırma

```bash
npm install
npm run dev        # geliştirme sunucusu
npm run build      # dist/index.html (tek dosya, offline çalışır)
npm run typecheck  # TypeScript denetimi
npm run sim        # motor denge ölçümü (CPU vs CPU maçlar)
```

`npm run build` çıktısı **tek bir HTML dosyasıdır** (`dist/index.html`); tüm JS, CSS ve
görseller içine gömülüdür. Doğrudan telefona atıp açabilirsin.

## Açılış akışı

1. **BYMEL SOFTWARE** logosu — 2 saniye
2. **TWIN SOCCER** logosu — 2 saniye
3. "Dokun ve başla" — tam ekran ve yatay yönlendirme istenir, ses açılır

Cihaz dikeyken "Telefonu yatay çevir" uyarısı gösterilir.

## Mimari

```
src/
  assets/faik.ts        Sakat Faik Modu saha dokusu (gömülü base64)
  game/
    types.ts            Ortak tip tanımları
    rng.ts              Deterministik RNG (mulberry32)
    data/               Kurgusal lig, kulüp ve isim veritabanı
    formations.ts       Formasyonlar ve OVR hesabı
    world.ts            Dünya üretimi, kadro dizilimi, kayıt/yükleme
    engine.ts           60Hz sabit adım maç motoru (fizik + pozisyonel YZ)
    render3d.ts         Perspektif 3B render motoru (pinhole kamera)
    look.ts / crest.ts  Prosedürel oyuncu görünümü ve kulüp arması
    career.ts           Sezon, fikstür, kupa, transfer, sözleşme
    economy.ts          Altın/elmas ekonomisi, stadyum, menajer, görevler
    brain.ts + lua/     Lua betikleriyle çalışan taktik/karar/spiker beyni
    audio.ts            Prosedürel ses efektleri
  components/
    Boot.tsx            Açılış ekranları ve yön kilidi
    MatchScreen.tsx     Maç HUD'u, dokunmatik kontroller, kamera anahtarı
    screens.tsx         Menü, kadro, taktik, lig, istatistik, ayarlar
    screens2.tsx        Transfer, sözleşme, stadyum, menajer, mağaza
    ui.tsx              Tasarım sistemi bileşenleri
```

## Maç motoru

- 60Hz sabit adım fizik; top yüksekliği (z ekseni), sekme ve hava sürtünmesi
- Pozisyonel yapay zekâ: şekil koruma, pres, adam markajı, hücum koşuları
- Duran toplar: başlama, taç, korner, kale vuruşu, serbest vuruş, penaltı
- Ofsayt, faul, sarı/kırmızı kart, kaleci refleksleri, savunma blokları
- Oyuncu değişikliği, kondisyon, moral ve form etkileri

### Render

`render3d.ts` gerçek bir pinhole kamera projeksiyonu kullanır (kuş bakışı değil):

| Kamera | Açıklama |
|---|---|
| Yayın | Klasik TV kamerası, uzun kenarın dışında |
| Tele | Yakın plan yayın kamerası |
| Aksiyon | Alçak ve dinamik takip |
| Oyuncu Arkası | FIFA tarzı arkadan görüş |
| Kule | Yüksek taktik açısı |

Oyuncular eklemli çizilir: bacak/kol koşu döngüsü, forma deseni, sırt numarası,
prosedürel yüz (ten, saç, sakal), krampon rengi, kaleci eldiveni. Gol sonrası
koreografi (köşe bayrağına koşu, takım arkadaşlarının katılması), konfeti, kamera
sarsıntısı ve stadyum ışıkları desteklenir.

## Ekonomi

| Birim | Kazanım | Harcama |
|---|---|---|
| 💶 Bütçe | Maç geliri, sezon primi, oyuncu satışı | Transfer, imza bedeli, maaş |
| 🪙 Altın | Maç günü geliri, galibiyet/gol primi, görevler | Stadyum yükseltmeleri, mağaza |
| 💎 Elmas | Farklı galibiyet, galibiyet serisi, kupa turu, seviye atlama | Üst seviye yükseltmeler, yetenek puanı |

- **Stadyum:** tribün, saha zemini, ışıklandırma, dev ekran, altyapı, sağlık merkezi
  (her biri 8 seviye). Yükseltmeler sahada da görünür — tribünler büyür, ışıklar artar.
- **Menajer:** seviye/XP, yetenek ağacı (antrenman, taktik, pazarlık, motivasyon,
  gözlemcilik, genç yetenek). Bonuslar maç motoruna doğrudan yansır.
- **Sözleşmeler:** süre, maaş, imza bedeli, kabul olasılığı; süresi biten oyuncular
  bonservissiz kalır.

## Sakat Faik Modu

Ayarlar ekranının en altındaki anahtarla açılır. Açıkken maçlar halısaha temelinde
oynanır: çim yerine özel doku, saha çevresinde tel kafes ve halısaha atmosferi.

## Oynanış yardımı

Ayarlardaki **Oynanış Yardımı** (Manuel / Yarı Otomatik / Tam Yardım) yalnızca kontrolü
kolaylaştırır — pas ve şut nişanı, ilk dokunuş, top koruma ve otomatik koşu. Rakip yapay
zekânın gücünü **değiştirmez**; onu **Zorluk** ayarı belirler.
