# Nöbet Hattı — BYMEL SOFTWARE — Teslimat Rehberi

## Önce dürüst bir kapsam notu

"Aşırı gelişmiş, her şey" istendi; elimden geleni yaptım ama bazı şeyler tek bir
mesajda gerçekçi biçimde teslim edilemez, onları burada açıkça belirtiyorum ki
beklenti netleşsin:

- **3D karakter modelleri**: Gerçek, heykellenmiş/rig'li insan modelleri
  (Blender/Maya çıktısı, animasyonlu iskelet) üretemem — bunlar bir 3D sanatçı
  ve modelleme yazılımı gerektirir. Oyunda kutu/primitif parçalardan oluşan
  ama yürüyüş animasyonlu, takım rengine göre boyanmış düşük-poligon karakterler
  var. Gerçek modellere geçmek istersen Mixamo (ücretsiz rigli karakter +
  animasyon) veya Sketchfab'dan CC0 modelleri `GLTFLoader` ile projeye
  eklenebilir — istersen bir sonraki adımda bu entegrasyonu da yaparım.
- **Sesler**: Lisanslı/kayıtlı ses dosyası ekleyemem (telif ve dosya boyutu
  nedeniyle). Bunun yerine Web Audio API ile **anda üretilen (prosedürel)**
  silah sesi, adım sesi, patlama ve arayüz sesleri var — dosya gerektirmez,
  offline çalışır, ama stüdyo kalitesinde değildir.
- **Reklam servisi**: `ardicturan1@gmail.com` hesabına gerçekten bağlı,
  para kazandıran bir reklam entegrasyonu **kuramam** — bu, o hesapla AdMob'a
  girip uygulama kaydı oluşturmanı ve oradan sana özel App ID / Ad Unit ID
  almanı gerektirir (bu adımı senin adına yapamam, hesap kimlik doğrulaması
  gerektirir). Kodun içine `ADMOB_CONFIG` adlı bir yapı bıraktım; kendi
  ID'lerini oraya yapıştırman yeterli. Aşağıda adımlar var.
- **APK dosyasının kendisi**: Bu ortamda internet erişimi ve Android SDK
  olmadığı için gerçek bir `.apk` derleyip sana veremiyorum. Onun yerine
  APK'ya dönüştürülmeye hazır tam bir proje iskeleti verdim; aşağıdaki
  adımları kendi bilgisayarında (Android Studio ile) izleyerek 15-20
  dakikada gerçek APK'yı üretebilirsin.

Bunların dışında istenen her şey (5v5 bot maçı, saldıran/savunan, 2 bölge,
3 rota, 6 silah kategorisi, 2 görev cihazı türü, satın alma ekonomisi,
zorluk seviyeli bot yapay zekası, dokunmatik kontroller, ayarlanabilir
HUD, ayarlar menüsü, mini harita, hasar yönü göstergesi, açılış ekranında
BYMEL SOFTWARE logosu) tek `index.html` dosyasında çalışır durumda.

## Dosyalar
- `index.html` — oyunun tamamı (tek dosya, Three.js kullanır)
- `icon.svg` — uygulama ikonu (512x512, Android ikon üretici için kaynak)
- `package.json`, `capacitor.config.json` — APK sarmalama iskeleti

## 1) Hemen tarayıcıda test et
`index.html` dosyasını bir telefon veya bilgisayarda tarayıcıyla aç (internet
gerekir, çünkü Three.js kütüphanesi şu an CDN'den yükleniyor). Splash
ekranında BYMEL SOFTWARE logosu, ardından ana menü açılmalı.

## 2) Tamamen offline çalışması için (APK için zorunlu)
Oyun "internet gerektirmesin" şartını karşılıyor, ama Three.js şu an
`cdnjs.cloudflare.com` üzerinden yükleniyor — bunu yerelleştirmen gerekir:
1. https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
   dosyasını indirip `www/libs/three.min.js` olarak kaydet.
2. `index.html` içinde şu satırı:
   `<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>`
   şununla değiştir: `<script src="libs/three.min.js"></script>`

## 3) Android APK'ya dönüştürme (Capacitor ile)
Bilgisayarında Node.js ve Android Studio kurulu olmalı.
```
mkdir nobet-hatti && cd nobet-hatti
# bu klasöre package.json ve capacitor.config.json dosyalarını kopyala
npm install
mkdir www
# index.html (ve yerelleştirdiysen libs/three.min.js) dosyasını www/ içine kopyala
npx cap add android
npx cap sync android
npx cap open android
```
Android Studio açıldığında `Build > Build Bundle(s) / APK(s) > Build APK(s)`
ile APK üretilir. İmzalı bir yayın APK'sı için `Build > Generate Signed Bundle / APK`
yolunu izle.

### Uygulama ikonunu ayarlama
`icon.svg` dosyasını 512x512 PNG'ye çevir (herhangi bir SVG->PNG aracıyla),
sonra Android Studio'da sağ tık `res` klasörü → `New > Image Asset` ile
Android ikon setini otomatik oluştur.

## 4) Gerçek reklam servisi (AdMob) bağlama
1. https://admob.google.com adresine `ardicturan1@gmail.com` ile giriş yap,
   yeni bir uygulama kaydı oluştur (Android, "Nöbet Hattı").
2. AdMob sana bir **App ID** ve banner/interstitial için **Ad Unit ID**'leri
   verecek.
3. `index.html` içinde en üstteki `ADMOB_CONFIG` nesnesine bu değerleri yapıştır.
4. `npm install @capacitor-community/admob` ile eklentiyi projeye ekle.
5. `AdManager.init()`, `AdManager.showBanner()` ve
   `AdManager.showInterstitial()` fonksiyonlarının içindeki yer tutucu
   kodları, eklentinin `AdMob.initialize(...)`, `AdMob.showBanner(...)`,
   `AdMob.showInterstitial(...)` çağrılarıyla değiştir (fonksiyon isimleri
   ve çağrı yerleri zaten hazır, sadece içini doldurman yeterli).

Bu adımlar tamamlanmadan reklamlar sadece ekranın altında "yer tutucu"
bir bant olarak görünür, gerçek reklam veya gelir üretmez.

## Sıradaki adım önerisi
İstersen bir sonraki mesajda: (a) botlara Mixamo tabanlı gerçek rig'li
karakter modelleri, (b) küçük boyutlu gerçek ses dosyaları, veya
(c) AdMob eklentisinin kod entegrasyonunu adım adım ekleyebilirim.
