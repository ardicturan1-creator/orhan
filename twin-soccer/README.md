# ⚽ TWIN SOCCER — BYMEL SOFTWARE

Tarayıcıda ve **Android'de** çalışan, tek dosyalık (offline) yatay mobil futbol oyunu.
Gerçek 3B perspektif render motoru, 60 Hz sabit adım fizik, 3B humanoid oyuncu iskeleti,
pozisyonel yapay zekâ, Lua tabanlı taktik beyni, üç para birimli ekonomi ve 26 haftalık
kariyer modu — hepsi **sıfırdan yazılmış** kod; hazır oyun motoru veya 3B kütüphane yok.

> Tüm kulüp, lig ve oyuncu adları **kurgusaldır**. Hiçbir gerçek kulüp, oyuncu, marka,
> logo, forma, font veya arayüz varlığı kopyalanmamıştır.

---

## Hızlı başlangıç

```bash
npm install
npm run dev          # geliştirme sunucusu
npm run build        # TEK DOSYA: dist/index.html
npm run typecheck    # tsc --noEmit (hatasız olmalı)
npm test             # şifreli kayıt sistemi testleri
npm run sim -- 12    # motor denge ölçümü (12 maç)
npm run shots        # Playwright ile görsel doğrulama (tools/shots/)
```

`npm run build` çıktısı **tek bir `dist/index.html`** dosyasıdır (JS + CSS + gömülü
görseller). Telefona kopyalayıp internetsiz açabilirsiniz.

### APK

```bash
npm run sync:android   # web derlemesi + Capacitor senkronizasyonu
npm run apk            # android/app/build/outputs/apk/debug/app-debug.apk
```

APK ayrıca her `push`'ta **GitHub Actions** ile derlenir
(`.github/workflows/android.yml`) ve *Releases* sayfasına yüklenir:

| Dosya | Açıklama |
|---|---|
| `TwinSoccer-release.apk` | Normal kurulum (imzalı) |
| `TwinSoccer-debug.apk` | Sorun giderme sürümü |

- **Paket:** `com.bymel.twinsoccer` · **minSdk 22 (Android 5.1)** · **targetSdk 34**
- Tek **evrensel** APK — ABI ayrımı yok, her işlemci mimarisinde çalışır.
- Yatay kilit, sürükleyici tam ekran, çentik desteği, ekranı açık tutma.

---

## Bu sürümde neler değişti

### 1. Şifreli kayıt — artık şifre SORULMUYOR
Eski sürüm açılışta PIN soruyordu. Artık kayıt, kullanıcıdan hiçbir şey istemeden
**cihazda şifreli saklanır**:

- Cihaza özel 256 bitlik gizli anahtar ilk açılışta `crypto.getRandomValues` ile üretilir.
- Anahtar + uygulama "pepper"ı yüksek turlu karıştırıcıdan geçirilerek `encKey` ve
  `macKey` türetilir.
- Veri **ChaCha20** (RFC 8439 çekirdeği, saf TypeScript) ile şifrelenir; her kayıt için
  rastgele 96 bit nonce kullanılır.
- 128 bitlik anahtarlanmış bütünlük etiketi ile kurcalama tespit edilir.
- Biçim: `TS3.<base64(nonce‖tag‖ciphertext)>`. Eski `TS2.` ve düz JSON kayıtları okunur.
- Ayarlar → **Şifreli Kayıt Kasası**: durum, kasa parmak izi, şifreli **yedek al** /
  **yedekten dön**.

`npm test` bu sistemi doğrular (tur döngüsü, nonce rastgeleliği, kurcalama reddi,
Türkçe/emoji karakterler, 500 KB performansı).

### 2. Maç süresi: sahada 15 dakika, saatte 90 dakika
- `MatchSettings.minutes` = **gösterilen** süre (90).
- `MatchSettings.realMinutes` = **gerçek** süre (varsayılan 15; ayarlardan 5/8/12/15/20).
- Motor `rate = minutes / (realMinutes × 60)` ile saati hızlandırır (varsayılan 6×).
- Kondisyon artık **maç dakikasına** göre erir; gerçek süreyi değiştirmek dengeyi bozmaz.

### 3. Sakat Faik Modu
Ayarların en altındaki amber "ÖZEL" kartından açılır. Açıkken çim yerine **gömülü
fotoğraf dokusu** perspektif-doğru şekilde sahaya döşenir, saha çevresine 3B tel kafes
çizilir, gökyüzü halısaha tonlarına döner ve HUD'da rozet belirir. Doku uygulamaya
gömülüdür (internet gerekmez); oyuncu isterse kendi görselini yükleyebilir.

### 4. Grafikler
- **3B humanoid oyuncu:** iskelet yerel gövde uzayında kurulur, yalpa/yunuslama/sapma ile
  döndürülür, her eklem ayrı yansıtılır. Yakın/uzak taraf derinliğe göre sıralanır.
- **Doğal hareket:** gerçek yürüyüş döngüsü (salınım/basış ayrı), leğen kemiğinde çift
  frekanslı iniş-çıkış ve yanal ağırlık aktarımı, kalça ↔ omuz karşıt dönüşü, kollarda
  ileri kinematik (aşırı gerilme yok), faz boyunca değişen dirsek bükülmesi, topa bakan
  baş, ivmeye göre gövde eğimi, dururken nefes mikro hareketi.
- **Stadyum:** çatılı çok katmanlı tribünler, köşe projektörleri ve gökyüzü hüzmesi,
  saha çevresinde **3B LED reklam panoları** (aynalanmayan yazı), köşe bayrakları,
  dev skor ekranı, stadyum tabanı.
- **Saha:** 18 şeritli biçme deseni + çapraz ikinci desen, çim filamentleri, kale önü
  aşınma bölgeleri, projektör ışık havuzları, kenar karartması, perspektifte doğru
  kalınlıkta çizgiler.
- **Kamera:** yayın kamerası artık tribünün üstünde — hiçbir tribün sahayı kapatmaz.
- **Gölgeler:** yumuşak, yükseklikle büyüyüp soluklaşan radyal gölgeler.

### 5. Arayüz
Modern konsol futbol oyunlarının arayüz *dili* (köşesi kırpılmış paneller, çok koyu
zemin, elektrik yeşili vurgu, sıkı büyük tipografi, altı çizgili sekmeler, altıgen OVR
rozetleri, eğik güç çubukları) — **hiçbir markaya ait varlık kopyalanmadan** sıfırdan
CSS ile kuruldu (`src/index.css`).

### 6. Motor ve mekanik düzeltmeleri (gerçek hatalar)

| # | Hata | Etki | Çözüm |
|---|---|---|---|
| 1 | `slotWorld` formasyon yuvası yalnızca `dir=+1` için doğruydu | `dir=−1` takımının **11 oyuncusu da** saha dışına düşüp kendi kale çizgisine yapışıyordu | `x = dir·(fx−0.5)·L` |
| 2 | Ofsayt çizgisi rakipleri **ters** sıralıyordu | Son savunmacı yerine en ileri rakip alınıyordu | Kaleye en yakın sıralama |
| 3 | Pas hızı sürtünmeden bağımsızdı | Kısa paslar hedefi 15–25 m aşıyor, sürekli aut/korner oluyordu | `v₀ = varış + d·AIR` |
| 4 | Şut blokları **her karede** zar atıyordu | 60 Hz'de bir şut pratikte hep bloklanıyordu | Savunmacı başına 0.5 sn'de bir deneme |
| 5 | Hızlı topu yoldaki savunmacı %50 şansla durduruyordu | Şutların çoğu kaleye ulaşamıyordu | Kontrol olasılığı hızla üstel düşüyor |
| 6 | Kaleci yalnızca topun 1 m yakınına gelirse devreye giriyordu | Maç başına 0.5 kurtarış, 20+ gol | Kurtarış kararı **kale çizgisinde**; refleks dalışı önceden |
| 7 | `saveTried` bayrağı kurtarışı kilitliyordu | Pas/sekmeden gelen gollerde kaleci hiç oynamıyordu | Kale çizgisi kontrolü bayraktan bağımsız |
| 8 | İsabetli şut sayacı gollerin yarısını atlıyordu | `GOL/İSABET` %200 görünüyordu | Ayrı `otDone` bayrağı; gol daima isabetli |
| 9 | Top taşıyan 0.16 sn'de karar veriyordu | İkili mücadele/faul neredeyse hiç yoktu | 0.6–1.2 sn taşıma süresi |
| 10 | Pas alıcısı topa koşmuyordu | Pas isabeti %24 | Alıcı ve baskı yapanlar **kesişim noktasına** koşar |
| 11 | Müdahale/blok sekmeleri rastgele yöne gidiyordu | Savunmacı topu kendi kalesine çeliyordu | Sekme kendi hücum yönüne yönlendirildi |
| 12 | `faikCanvas` tek önbellek paylaşıyordu | Görsel geç yüklenirse fotoğraf **hiç** görünmüyordu | Ayrı önbellekler, kaynak karşılaştırması |
| 13 | Kollar ters kinematikte aşırı geriliyordu | Koşan oyuncular "T pozu" veriyordu | İleri kinematik + ayak hedefi erişime kırpılıyor |

Yeni mekanik: **kanattan ortalar** (`doCross`) — final üçte birde, kanatta, ceza sahasında
hedef varsa yükseltilmiş orta açılır.

#### Denge (CPU vs CPU, 90 dk gösterilen / 15 dk gerçek)

| Ölçüt | Önce | Sonra | Gerçek futbol |
|---|---|---|---|
| Gol / maç | 21.8 | **2.5 – 3.2** | ~2.7 |
| Şut / maç | 74.8 | **23 – 27** | ~25 |
| İsabet / şut | %16.8 | **%37 – 47** | ~%33 |
| Gol / isabet | %173 (bozuk) | **%25 – 30** | ~%30 |
| Pas isabeti | %24 | **%73 – 76** | ~%80 |
| Güçlü (84) vs zayıf (69) | %50 kazanma | **%100 kazanma** | baskın |

`npm run sim -- 14` ile doğrulanabilir.

---

## Mimari

```
src/
  assets/faik.ts        → Sakat Faik Modu dokusu (base64 gömülü)
  game/
    types.ts            → ortak arayüzler (Player, Club, Career, MP, Ball…)
    rng.ts              → mulberry32 deterministik RNG + yardımcılar
    crypto.ts           → ChaCha20 şifreli kayıt kasası (şifre sormaz)
    formations.ts       → 6 formasyon + pozisyon ağırlıklı OVR + posFit
    look.ts             → id'den deterministik yüz/saç/ten/vücut
    crest.ts            → id'den prosedürel SVG arma
    data/clubs.ts       → 4 kurgusal lig, 52 gerçekçi adlı kurgusal kulüp
    data/names.ts       → bölgeye göre isim havuzları + spiker replikleri
    world.ts            → dünya üretimi, kadro, autoLineup, şifreli kayıt/yükleme
    audio.ts            → WebAudio ile prosedürel ses (dosya yok)
    brain.ts            → Lua → TS köprüsü + TS yedeği
    economy.ts          → bütçe/altın/elmas, stadyum, menajer, görevler, mağaza
    career.ts           → sezon/fikstür/kupa/transfer/sözleşme/altyapı
    engine.ts           → 60 Hz sabit adım maç motoru (fizik + pozisyonel YZ)
    render3d.ts         → pinhole kamera projeksiyonlu 3B render motoru
  lua/                  → bağımsız Lua yorumlayıcı + oyun beyni betiği
  components/           → Boot, MatchScreen, ekranlar, tasarım sistemi
tools/
  sim.ts                → headless denge ölçüm aracı
  crypto.test.ts        → şifreli kayıt testleri
  shoot.mjs / closeup.mjs → Playwright görsel doğrulama
  make-icons.py         → Android simgesi üreteci (saf Python PNG)
android/                → Capacitor Android projesi
```

### 3B render motoru

Kuş bakışı değil, gerçek pinhole kamera projeksiyonu:

```
fwd   = normalize(camTgt − camPos)
right = normalize(fwd × (0,0,1))
up    = right × fwd
cz < 0.6 → çizme ;  focal = H/2 / tan(fov/2)
sx = W/2 + cx·focal/cz ;  sy = H/2 − cy·focal/cz
```

5 kamera preset'i: `broadcast`, `tele`, `action`, `behind` (oyuncu arkası), `sky`.

### Kontroller

| Eylem | Dokunmatik | Klavye |
|---|---|---|
| Hareket | Sol yarıda sürükle | WASD / Ok tuşları |
| Koşu | ⚡ (basılı tut) | Shift |
| Pas | KAP | J |
| Ara pas | ARA | L |
| Şut / kayarak müdahale | Kırmızı (bas-tut) | K |
| Oyuncu değiştir | 🔄 | Boşluk |
| Kamera / Duraklat | 🎥 / ⏸ | C / P |

---

© **BYMEL SOFTWARE** · Tüm kulüp, oyuncu ve lig adları tamamen kurgusaldır.
