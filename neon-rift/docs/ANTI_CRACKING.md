# Anti-cracking ve kayıt bütünlüğü

## Uygulanan katmanlar

1. **Paket kimliği kontrolü**
   - Beklenen kimlik: `com.bymel.Neonrift`.
   - Farklı paket adıyla yeniden paketlenen release sürümü açılmaz.

2. **Yayın sertifikası sabitleme**
   - `BYMEL_SIGNING_CERT_SHA256` release sertifikasının 64 haneli SHA-256 değeridir.
   - Release çalışma zamanında mevcut APK imzası bu değerle sabit süreli karşılaştırılır.
   - Değer eksikse release derlemesi varsayılan olarak durur.

3. **Kritik oyun asset bütünlüğü**
   - HTML, CSS, oyun JavaScript dosyaları ve Three.js dosyası derleme sırasında tek SHA-256 özetiyle bağlanır.
   - Uygulama başlamadan önce APK içindeki assetler tekrar hesaplanır.

4. **Release sertleştirmesi**
   - R8 minify ve resource shrinking etkin.
   - Release WebView debug kapalı.
   - Debugger algılanırsa release açılmaz.
   - Release ekran görüntüsü/kayıt koruması için `FLAG_SECURE` kullanır.
   - İsteğe bağlı `REQUIRE_PLAY_INSTALLER=true` yalnızca Play Store kurulumlarına izin verir.

5. **Kayıt koruması**
   - Konum: `Android/data/com.bymel.Neonrift/files/NeonRift/neonrift_secure_save_v2.dat`.
   - API 23+ cihazlarda Android Keystore AES-GCM.
   - API 21–22 cihazlarda uygulama imzası ve cihaz kimliğine bağlı HMAC.
   - Bozuk veya değiştirilmiş kayıt `.corrupt` olarak karantinaya alınır ve güvenli varsayılan kayıt açılır.

6. **Satın alma koruması**
   - Release sürümünde HTTPS sunucu doğrulaması zorunlu.
   - Tüketilebilir ürün teslimi başarılı consume işleminden sonra yapılır.
   - Başlangıç paketi acknowledge edilir ve token tekrar teslimi engellenir.

## Gradle ayarları

`android/gradle.properties`:

```properties
PURCHASE_VERIFY_URL=https://example.com/verify-play-purchase
BYMEL_SIGNING_CERT_SHA256=64_HEX_CHARACTER_RELEASE_CERTIFICATE_SHA256
REQUIRE_PLAY_INSTALLER=true
```

Yerel geçici test için `ALLOW_UNPINNED_RELEASE=true` kullanılabilir; mağaza sürümü için kullanılmamalıdır.

## Gerçekçi güvenlik sınırı

Çevrimdışı oyun mantığı ve assetler cihazdadır. Yeterli zaman ve erişimle istemci kodu değiştirilebilir. Önemli skor, ekonomi, etkinlik ödülü ve satın alma teslimatı sunucuda doğrulanmalıdır. Play Integrity API eklemek için sunucu nonce üretmeli ve tokenı Google tarafında doğrulamalıdır; yalnızca istemci kontrolü yeterli değildir.
