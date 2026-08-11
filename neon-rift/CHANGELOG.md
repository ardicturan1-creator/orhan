# Değişiklik günlüğü

## 1.4.1

- Google Play Console'un "bu sürüm mevcut kullanıcıların yeni uygulama paketlerine geçmesine
  izin vermiyor" ve "bu sürüm hiçbir uygulama paketi eklemiyor veya kaldırmıyor" hataları için
  sürüm numaraları yükseltildi: `versionCode 15 -> 20`, `versionName 1.4.0 -> 1.4.1`.
  Play yalnızca versionCode'un artmasını ister; atlanan numaralar sorun değildir.
- Oyun içi `NR_CONFIG.version` değeri sürümle eşitlendi.

## 1.4.0

- **Anti-kurcalama kontrolü kaldırıldı.** `IntegrityGuard` sınıfı ve onu çağıran tüm kod silindi:
  paket kimliği eşleşmesi, yayın sertifikası sabitleme, kritik asset SHA-256 doğrulaması,
  debugger algılama ve `REQUIRE_PLAY_INSTALLER` kontrolü artık yok. Release derlemesini
  sertifika parmak izi olmadan durduran Gradle kontrolü de kaldırıldı.
- **Google AdMob entegrasyonu eklendi** (gerçek kimlikler, test kimliği kullanılmaz):
  - Uygulama kimliği `ca-app-pub-4125240213199221~3005404416`
  - Bölüm sonu / ölüm reklamı (geçiş reklamı): `ca-app-pub-4125240213199221/9294766589`
  - Mağaza ödüllü reklamı: `ca-app-pub-4125240213199221/4071074074`
- Oyuncu öldüğünde sonuç ekranı belirdikten sonra geçiş reklamı gösterilir. Reklamlar arasında
  30 saniyelik en kısa bekleme uygulanır; menüye çıkışta reklam gösterilmez.
- Mağazaya **5 ödüllü reklam → 200 elmas** çarkı eklendi. İlerleme kayıtta tutulur ve ödül
  yalnızca reklam gerçekten tamamlandığında (`onUserEarnedReward`) verilir.
- Satın alma sunucu doğrulaması artık yalnızca `PURCHASE_VERIFY_URL` tanımlıysa zorunludur.
  Önceki davranışta release'te doğrulama zorunlu ama uç nokta boştu; bu, gerçek para ile yapılan
  satın almaların ücretlendirilip teslim edilmemesine yol açıyordu.
- `minSdk` 21'den 23'e yükseltildi (Google Mobile Ads SDK gereksinimi), `android.useAndroidX` açıldı.
- **Play paket adı düzeltildi:** `applicationId` `com.bymel.Neonrift` → `com.bymel.neonrift`.
  Play Console kaydı küçük harfli olduğu için büyük harfli AAB yüklemede reddediliyordu.
  Java kaynak paketi `com.bymel.Neonrift` olarak korundu (`namespace`); ikisi farklı olduğundan
  manifest'teki activity adı tam nitelikli yazıldı.
- Sürüm `1.4.0`, Android versionCode `15` yapıldı.

## 1.3.1

- Uzun oturumlarda zorluk artışına üst sınır eklendi (dalga/süre/Commander döngüsü katsayıları); marifetli oyuncuyu asla çözümsüz hale getirmeden zorluk yüksek kalır.
- BYMEL COMMANDER muhafız çağırma deseni Commander döngüsüne göre değişkenleşti (tekrar karşılaşmalar daha az monoton).
- Düşman isabet parlama animasyonunda havuzdan tekrar kullanılan nesnelerde oluşabilecek görsel kararsızlık (stale-timeout) giderildi.
- Sürüm `1.3.1`, Android versionCode `14` yapıldı.

## 1.3.0

- BYMEL COMMANDER'a can %13 altında devreye giren **4. faz "Öfke" (Enrage)** modu eklendi: daha hızlı saldırı temposu, dönen mermi sarmalı, sık dash zinciri ve daha sık muhafız çağırma.
- Commander can/hasar değerleri yükseltildi (`hp 5200→6100`, `damage 30→33`) ve faz geçişinde kırmızı öfke rengi + ekran sarsıntısı eklendi.
- Titan ve Commander modellerine omuz dikenleri ve sırt çıkıntısı eklendi; siluetleri belirginleşti.
- Oyuncu gemisine vizör camı ve arka kuyruk kanadı eklenerek model detayı artırıldı.
- Sürüm `1.3.0`, Android versionCode `13` yapıldı; test paketi yeni faz mantığını doğrular.

## 1.2.0

- Paket kimliği `com.bymel.Neonrift` olarak değiştirildi.
- Android/data altında şifreli, bütünlük kontrollü kayıt eklendi.
- Release imza sabitleme ve kritik asset doğrulaması eklendi.
- BYMEL COMMANDER üç fazlı boss savaşı eklendi.
- Rift Overdrive, elit düşmanlar, Splitter ve dalga modları eklendi.
- Dört yeni koşu yükseltmesi ve Reaktör Senkronu kalıcı gelişimi eklendi.
- Kariyer kayıtları, başarılar ve Commander kaplaması eklendi.
- Oyuncu ve düşman modelleri ek parçalarla geliştirildi.
- Sürüm `1.2.0`, Android versionCode `12` yapıldı.
