# Kayıt bütünlüğü ve satın alma güvenliği

> **Not:** Sürüm 1.4.0 ile birlikte çalışma zamanı **anti-kurcalama (anti-tamper) kontrolü kaldırılmıştır.**
> Aşağıdaki liste, uygulamada hâlâ bulunan korumaları ve bilinçli olarak bırakılan boşlukları anlatır.

## Kaldırılan katmanlar (1.4.0)

`IntegrityGuard` sınıfı ve onu çağıran tüm kod silindi. Artık **yok**:

- Paket kimliği (`com.bymel.Neonrift`) eşleşme kontrolü
- Yayın sertifikası sabitleme (`BYMEL_SIGNING_CERT_SHA256`)
- Kritik oyun assetlerinin derleme zamanı SHA-256 özetiyle bağlanması
- Debugger algılama ve `FLAG_DEBUGGABLE` kontrolü
- `REQUIRE_PLAY_INSTALLER` ile yalnızca Play kurulumuna izin verme
- Release derlemesini sertifika parmak izi girilmeden durduran Gradle kontrolü

Pratik sonucu: uygulama yeniden paketlenebilir, assetleri değiştirilebilir ve
Play dışı kanallardan kurulabilir. Bu, bilinçli bir üründe basitleştirme tercihidir.

## Hâlâ etkin olan korumalar

1. **Kayıt şifrelemesi**
   - Konum: `Android/data/com.bymel.Neonrift/files/NeonRift/neonrift_secure_save_v2.dat`
   - Android Keystore üzerinde AES-GCM ile şifrelenir (minSdk 23 olduğu için tüm cihazlarda geçerli).
   - Bozuk veya çözülemeyen kayıt `.corrupt` olarak karantinaya alınır, oyun güvenli varsayılanla açılır.

2. **Release sertleştirmesi**
   - R8 minify ve resource shrinking etkin.
   - WebView debug yalnızca debug derlemede açık.
   - `FLAG_SECURE` (ekran görüntüsü/kayıt engelleme) **kaldırıldı**: bazı cihazlarda ödüllü
     video reklamların siyah ekran olarak gelmesine yol açıyordu.

3. **Satın alma teslimi**
   - Tüketilebilir ürünler yalnızca başarılı `consumeAsync` sonrası teslim edilir.
   - Başlangıç paketi acknowledge edilir; işlenen tokenlar saklanarak tekrar teslim engellenir.
   - Ödüllü reklam ödülü yalnızca `onUserEarnedReward` tetiklendiyse verilir.

## Satın alma sunucu doğrulaması

`android/gradle.properties` içindeki `PURCHASE_VERIFY_URL` davranışı belirler:

```properties
# Boş: teslimat Google Play'in satın alma sonucuna göre yapılır.
PURCHASE_VERIFY_URL=

# HTTPS adresi girilirse release derlemesi sunucu doğrulamasını otomatik zorunlu kılar.
PURCHASE_VERIFY_URL=https://example.com/verify-play-purchase
```

Değer boşken `REQUIRE_SERVER_VERIFICATION` release'te `false` olur. Bu bilinçli bir seçimdir:
önceki sürümde release'te doğrulama zorunluydu ama uç nokta tanımlı değildi, bu yüzden
**gerçek para ile yapılan her satın alma ücretlendirilip içerik hiç teslim edilmiyordu.**

Gelir kaybı ve sahte satın alma riskini azaltmak için, mağaza yayınından sonra bir doğrulama
uç noktası kurup bu değeri doldurmanız önerilir. Servis hesabı anahtarını asla uygulamaya koymayın.

## Gerçekçi güvenlik sınırı

Oyun mantığı ve assetler cihazdadır; istemci kodu değiştirilebilir. Skor, ekonomi, etkinlik ödülü
ve satın alma teslimatı için gerçek güvence yalnızca sunucu tarafında sağlanabilir. Play Integrity API
eklemek isterseniz nonce'u sunucuda üretip tokenı Google tarafında doğrulamanız gerekir.
