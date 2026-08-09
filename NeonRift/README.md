# Neon Rift — Bymel Software v1.2.0

Neon Rift, Android için hazırlanmış Three.js tabanlı 3D arena-survivor oyunudur. Oyuncu hareket ederken en yakın hedefe otomatik ateş eder; Dash, Nova, Rift Overdrive ve koşu içi yükseltmelerle giderek zorlaşan dalgalarda ilerler.

## v1.3.0 ile eklenenler

- BYMEL COMMANDER'a can %13 altında devreye giren zorlu **4. faz (Öfke)**: dönen mermi sarmalı, sık dash zinciri, hızlı muhafız çağırma ve kırmızı öfke görünümü
- Commander can/hasarı artırıldı; boss savaşı daha zorlayıcı
- Titan ve Commander modellerine omuz dikeni ve sırt çıkıntısı eklendi
- Oyuncu gemisine vizör camı ve kuyruk kanadı eklendi

## v1.2.0 ile eklenenler

- Android uygulama kimliği: `com.bymel.Neonrift`
- Güvenli kayıt konumu: `Android/data/com.bymel.Neonrift/files/NeonRift/neonrift_secure_save_v2.dat`
- Android 6.0+ cihazlarda Android Keystore ile AES-GCM şifreli kayıt
- Android 5.x için cihaz ve imza bağlı HMAC bütünlük koruması
- Eski `localStorage` kaydını otomatik taşıma
- Release sertifika sabitleme, kritik asset SHA-256 doğrulaması, R8 küçültme ve WebView debug kapatma
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
- `android/`: Android WebView kabuğu, güvenli kayıt, bütünlük denetimi ve Google Play Billing
- `tests/`: çekirdek ekonomi/kayıt testleri ve kaynak tutarlılık kontrolleri
- `docs/`: Play Console, anti-cracking ve cihaz test notları

## Test

```bash
npm test
npm run check
```

## Uygulama simgesi

Gönderilen Neon Rift NR görseli, legacy ve adaptive Android launcher simgeleri olarak projeye eklenmiştir. Kaynak ve Play Store sürümleri `branding/` klasöründedir.

## Desteklenen sürümler

- En düşük Android sürümü: 6.0 (API 23) — Google Play Billing 9.x en az API 23 gerektirir
- Hedef Android sürümü: 16 (API 36)
- Derleme zinciri: JDK 17, Gradle 9.5.0, Android Gradle plugin 9.3.0, SDK Build Tools 36.0.0

## Android debug derlemesi

Gerekenler: JDK 17, Android SDK 36 ve Gradle dağıtımına/dependency depolarına ağ erişimi.

```bash
cd android
./gradlew assembleDebug
```

Debug çıktısı `android/app/build/outputs/apk/debug/app-debug.apk` altında oluşur.

## Güvenli release derlemesi

1. Yayın keystore ortam değişkenlerini `android/signing.env.example` biçiminde tanımlayın.
2. Yayın sertifikasının SHA-256 parmak izini alın:

```bash
keytool -list -v -keystore /path/to/bymel-release.jks -alias bymel
```

3. `android/gradle.properties` içinde `BYMEL_SIGNING_CERT_SHA256` ve `PURCHASE_VERIFY_URL` değerlerini ayarlayın.
4. AAB üretin:

```bash
cd android
./gradlew clean bundleRelease
```

Release derlemesi, 64 haneli sertifika SHA-256 değeri verilmeden varsayılan olarak durdurulur. Ayrıntılar `docs/ANTI_CRACKING.md` içindedir.

## Satın alma doğrulama isteği

Ürün kimlikleri önceki Play Console ürünleriyle uyumluluk için küçük harfli tutulmuştur. Uygulama paketi ise tam olarak `com.bymel.Neonrift` değeridir.

```json
{
  "packageName": "com.bymel.Neonrift",
  "productId": "com.bymel.neonrift.gems_80",
  "purchaseToken": "google-play-token"
}
```

Sunucu; paket, ürün, satın alma durumu ve daha önce teslim edilmemiş token koşullarını birlikte doğrulamalıdır. Servis hesabı anahtarı APK/AAB içine konulmamalıdır.

## Sınırlar

İstemci tarafı korumalar kırılmayı zorlaştırır ancak hiçbir çevrimdışı istemci yüzde yüz kırılamaz değildir. Rekabetçi skorlar, ekonomi ve gerçek para teslimatı için sunucu otoritesi kullanılmalıdır.
