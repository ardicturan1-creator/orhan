# Neon Rift — AAB nasıl alınır

Bu depoda AAB'yi sizin için derleyen bir GitHub Actions iş akışı var:
`.github/workflows/neon-rift-aab.yml`

## 1. Derlemeyi başlatın

1. GitHub'da depoyu açın → **Actions** sekmesi
2. Soldaki listeden **Neon Rift AAB** iş akışını seçin
3. Sağdaki **Run workflow** düğmesine basın
4. İki alan sorulur (ikisi de boş bırakılabilir):
   - **play_app_signing_sha256**: Play Console'daki uygulama imzalama sertifikasının SHA-256'sı
   - **purchase_verify_url**: satın alma doğrulama sunucunuzun HTTPS adresi
5. **Run workflow** deyin ve bitmesini bekleyin (ilk derleme yaklaşık 5–10 dakika sürer)

Derleme bitince sayfanın altındaki **Artifacts** bölümünden indirin:

| Çıktı | Ne işe yarar |
| --- | --- |
| `neon-rift-release-aab` | `.aab` dosyası — adı `TEST-imzali` ise Play'e yüklemeyin |
| `neon-rift-debug-apk` | Telefona doğrudan kurup test edebileceğiniz `.apk` |

Aynı dosyalar her başarılı derlemede depodaki `dist/` klasörüne de yazılır.

## 2. Yayın için kendi imzalama anahtarınızı ekleyin (önemli)

Depoda imzalama anahtarı tanımlı değilse iş akışı sadece derlemeyi doğrulamak için tek
kullanımlık bir anahtar üretir, çıktıyı `TEST-imzali` diye adlandırır ve o anahtarı hiçbir yere
kaydetmez. **Bu dosyayı Play Console'a yüklemeyin**: Play ilk yüklediğiniz anahtarı yükleme
anahtarınız olarak kaydeder, o anahtar kaybolduğu için uygulamayı bir daha güncelleyemezsiniz.

Yayına hazır AAB için kendi anahtarınızı kendi bilgisayarınızda üretin:

```bash
keytool -genkeypair -v -keystore bymel-release.jks -alias bymel \
  -keyalg RSA -keysize 4096 -validity 10000 -storetype PKCS12
base64 -w0 bymel-release.jks > keystore.txt
```

`bymel-release.jks` dosyasını yedekleyin ve **asla depoya koymayın** (bu depo herkese açık).
Sonra **Settings → Secrets and variables → Actions → New repository secret** ile şunları ekleyin:

| Secret adı | Değer |
| --- | --- |
| `KEYSTORE_BASE64` | `keystore.txt` içeriği |
| `KEYSTORE_PASSWORD` | keystore şifresi |
| `KEY_ALIAS` | `bymel` |
| `KEY_PASSWORD` | anahtar şifresi |

Bunlar tanımlandıktan sonra çıktı `neon-rift-release.aab` adıyla ve hep aynı anahtarla imzalanır.

## 3. Bütünlük sabitlemesi (uygulamanın telefonda açılması için şart)

Proje, kurcalanmaya karşı **imza sabitleme** kullanır: uygulama, çalışırken kendi imzasını
`BYMEL_SIGNING_CERT_SHA256` değeriyle karşılaştırır. Bu değer boşken release sürümü
telefonda "Uygulama bütünlüğü doğrulanamadı — Kod: SIGNATURE_PIN_MISSING" ekranı gösterir.

Google Play App Signing kullanıldığı için sabitlenmesi gereken parmak izi **yükleme (upload)
anahtarınız değil**, Google'ın cihazdaki APK'yı imzaladığı **app signing** sertifikasıdır.
Bu yüzden sıralama şöyle olmalı:

1. Sabitlemesiz bir AAB derleyin (alanı boş bırakın) ve Play Console'da **iç test** kanalına yükleyin
2. Play Console → **Test ve yayınlama → Kurulum → Uygulama imzalama** sayfasından
   **App signing key certificate** altındaki **SHA-256** değerini kopyalayın
3. İş akışını tekrar çalıştırın, bu değeri **play_app_signing_sha256** alanına yapıştırın
   (ya da `PLAY_APP_SIGNING_SHA256` adıyla repository secret olarak ekleyin)
4. Çıkan AAB'yi yükleyin — artık uygulama tüm cihazlarda normal açılır

> Not: 1. adımdaki AAB yalnızca sertifikayı öğrenmek içindir; o sürüm cihazda oyunu açmaz.
> Test etmek isterseniz `neon-rift-debug-apk` çıktısını kullanın, debug sürümünde sabitleme aranmaz.

## 4. Satın almalar

Release sürümünde satın alma teslimatı sunucu doğrulamasına bağlıdır. `purchase_verify_url`
boşken ürünler satın alınabilir ama içerik teslim edilmez. Doğrulama servisinin yapması
gerekenler `docs/PLAY_CONSOLE_KURULUM.md` içinde anlatılıyor.

## 5. Kendi bilgisayarınızda derlemek isterseniz

Gerekenler: JDK 17, Android SDK (platform 36 + build-tools 36.0.0), internet erişimi.

```bash
cd NeonRift/android
export BYMEL_KEYSTORE_FILE=/tam/yol/bymel-release.jks
export BYMEL_KEYSTORE_PASSWORD=...
export BYMEL_KEY_ALIAS=bymel
export BYMEL_KEY_PASSWORD=...
./gradlew clean bundleRelease -PBYMEL_SIGNING_CERT_SHA256=<64_haneli_sha256>
```

Çıktı: `NeonRift/android/app/build/outputs/bundle/release/app-release.aab`
