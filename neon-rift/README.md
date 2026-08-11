# Neon Rift — Bymel Software v1.4.0

Neon Rift, Android için hazırlanmış Three.js tabanlı 3D arena-survivor oyunudur. Oyuncu hareket ederken en yakın hedefe otomatik ateş eder; Dash, Nova, Rift Overdrive ve koşu içi yükseltmelerle giderek zorlaşan dalgalarda ilerler.

## v1.4.0 ile değişenler

- **Anti-kurcalama (anti-tamper) kontrolü kaldırıldı**: imza sabitleme, asset SHA-256 doğrulaması,
  debugger algılama ve Play kurulum kontrolü artık yok (`docs/ANTI_CRACKING.md`)
- **Google AdMob** entegrasyonu (gerçek kimlikler; test kimliği kullanılmıyor)
- Oyuncu öldüğünde bölüm sonu geçiş reklamı (30 sn en kısa bekleme ile)
- Mağazada **5 ödüllü reklam → 200 elmas**; ödül yalnızca reklam tamamlanırsa verilir
- Google Play Billing ile gerçek para satın alma akışı korundu; sunucu doğrulaması artık
  yalnızca `PURCHASE_VERIFY_URL` tanımlıysa zorunlu
- `minSdk` 23'e yükseltildi, AndroidX açıldı, versionCode `15`

## v1.3.0 ile eklenenler

- BYMEL COMMANDER'a can %13 altında devreye giren zorlu **4. faz (Öfke)**: dönen mermi sarmalı, sık dash zinciri, hızlı muhafız çağırma ve kırmızı öfke görünümü
- Commander can/hasarı artırıldı; boss savaşı daha zorlayıcı
- Titan ve Commander modellerine omuz dikeni ve sırt çıkıntısı eklendi
- Oyuncu gemisine vizör camı ve kuyruk kanadı eklendi

## v1.2.0 ile eklenenler

- Android uygulama kimliği (Play paket adı): `com.bymel.neonrift`
- Güvenli kayıt konumu: `Android/data/com.bymel.neonrift/files/NeonRift/neonrift_secure_save_v2.dat`
- Android Keystore ile AES-GCM şifreli kayıt
- Eski `localStorage` kaydını otomatik taşıma
- R8 küçültme ve release'te WebView debug kapatma
- Rift Titan yenildikten sonra gelen üç fazlı **BYMEL COMMANDER** bossu
- Commander minyon çağırma, bariyer, fan/radyal saldırı ve son faz dash desenleri
- Elit düşmanlar, Splitter düşmanı, dalga modları, iyileştirme düşüşleri ve Rift Overdrive
- Yeni koşu yükseltmeleri: Faz Delici, Hiper İletken, Saha Onarımı ve Rift Reaktörü
- Kalıcı Reaktör Senkronu gelişimi, kariyer kayıtları ve başarılar
- Geliştirilmiş oyuncu, Titan, Commander ve standart düşman modelleri
- Commander ilk zaferinde `Command Protocol` kaplaması ve 15 elmas

## Kontroller

- Sol joystick: hareket
- Sağ büyük düğme: Dash
- Sağ küçük düğme: Nova
- Ateş: en yakın hedefe otomatik
- Masaüstü test: WASD/ok tuşları, `Space` Dash, `E` Nova, `Esc` duraklat

## Proje yapısı

- `game/`: çevrimdışı HTML/CSS/JavaScript/Three.js oyun içeriği
- `android/`: Android WebView kabuğu, güvenli kayıt, AdMob reklamları ve Google Play Billing
- `tests/`: çekirdek ekonomi/kayıt testleri ve kaynak tutarlılık kontrolleri
- `docs/`: Play Console, anti-cracking ve cihaz test notları

## Test

```bash
npm test
npm run check
```

## Android debug derlemesi

Gerekenler: JDK 17, Android SDK 36 ve Gradle dağıtımına/dependency depolarına ağ erişimi.

```bash
cd android
./gradlew assembleDebug
```

Debug çıktısı `android/app/build/outputs/apk/debug/app-debug.apk` altında oluşur.

## Release AAB derlemesi

1. Yayın keystore ortam değişkenlerini `android/signing.env.example` biçiminde tanımlayın:

```bash
export BYMEL_KEYSTORE_FILE=/absolute/path/to/bymel-release.jks
export BYMEL_KEYSTORE_PASSWORD=...
export BYMEL_KEY_ALIAS=bymel
export BYMEL_KEY_PASSWORD=...
```

2. AAB üretin:

```bash
cd android
./gradlew clean bundleRelease
```

Çıktı: `android/app/build/outputs/bundle/release/app-release.aab`

Reklam birimleri `android/gradle.properties` içinde gerçek değerlerle tanımlıdır; test kimliği
kullanılmaz. İsteğe bağlı `PURCHASE_VERIFY_URL` ayarı için `docs/ANTI_CRACKING.md` dosyasına bakın.

GitHub Actions üzerinden imzalı AAB üretmek için `.github/workflows/android-release.yml`
iş akışı hazırdır; gerekli depo sırları iş akışı dosyasının başında listelenmiştir.

## Satın alma doğrulama isteği

Ürün kimlikleri önceki Play Console ürünleriyle uyumluluk için küçük harfli tutulmuştur. Uygulama paketi de küçük harfli `com.bymel.neonrift` değeridir; Java kaynak paketi ise `com.bymel.Neonrift` olarak kalır.

```json
{
  "packageName": "com.bymel.neonrift",
  "productId": "com.bymel.neonrift.gems_80",
  "purchaseToken": "google-play-token"
}
```

Sunucu; paket, ürün, satın alma durumu ve daha önce teslim edilmemiş token koşullarını birlikte doğrulamalıdır. Servis hesabı anahtarı APK/AAB içine konulmamalıdır.

## Sınırlar

İstemci tarafı korumalar kırılmayı zorlaştırır ancak hiçbir çevrimdışı istemci yüzde yüz kırılamaz değildir. Rekabetçi skorlar, ekonomi ve gerçek para teslimatı için sunucu otoritesi kullanılmalıdır.
