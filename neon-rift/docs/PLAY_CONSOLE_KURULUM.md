# Google Play Console ve ödeme kurulumu

## 1. Uygulama

- Paket adı: `com.bymel.Neonrift`
- Varsayılan dil: Türkçe
- Uygulama türü: Oyun
- Para kazanma: Uygulama içi ürünler
- Hedef SDK: 36

Paket adı yayınlandıktan sonra değiştirilemez. Play Console'da daha önce küçük harfli eski paketle uygulama oluşturulduysa bu yeni kimlik ayrı uygulama sayılır.

## 2. Tek seferlik ürünler

Mevcut ürün uyumluluğu için ürün kimlikleri küçük harfli bırakılmıştır; ürün kimliği uygulama paket adıyla aynı olmak zorunda değildir.

| Ürün kimliği | Tür | Teslimat |
| --- | --- | --- |
| `com.bymel.neonrift.gems_80` | Tüketilebilir | 80 elmas |
| `com.bymel.neonrift.gems_500` | Tüketilebilir | 500 elmas |
| `com.bymel.neonrift.gold_12000` | Tüketilebilir | 12.000 altın |
| `com.bymel.neonrift.starter_pack` | Tüketilemez | 250 elmas, 5.000 altın, Solar Flare kaplaması |

## 3. Satın alma doğrulama servisi

Release derlemesi `PURCHASE_VERIFY_URL` boşsa içerik teslim etmez. HTTPS endpoint şu kontrolleri yapmalıdır:

1. İstek paket adı tam olarak `com.bymel.Neonrift` mi?
2. Ürün kimliği beyaz listede mi?
3. Android Publisher API sonucu `PURCHASED` mı?
4. Dönen ürün satırı istenen ürünle eşleşiyor mu?
5. Token daha önce teslim edilmiş mi?
6. Kontroller aynı veritabanı işlemi içinde başarılıysa `{"valid":true}` dönüyor mu?

## 4. Release bütünlüğü

- `BYMEL_SIGNING_CERT_SHA256` yayın sertifikasının SHA-256 parmak izine ayarlanmalıdır.
- Play dışı kurulumu engellemek için `REQUIRE_PLAY_INSTALLER=true` kullanılabilir.
- Play App Signing kullanılıyorsa yerel upload sertifikası değil, cihazdaki APK'yı imzalayan **App Signing certificate** parmak izi sabitlenmelidir.

## 5. Test kanalı

1. Kalıcı release anahtarıyla AAB oluşturun.
2. Dahili test yayını açıp AAB'yi yükleyin.
3. Lisans test kullanıcılarını ekleyin.
4. Ürünleri etkinleştirin.
5. Uygulamayı Play test bağlantısından kurun.
6. Başarılı, iptal, pending, bağlantı kesilmesi, tekrar açma ve iade senaryolarını deneyin.
