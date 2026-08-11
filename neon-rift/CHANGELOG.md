# Değişiklik günlüğü

## 1.3.2

- Google Play Console'un "bu sürüm mevcut kullanıcıların yeni uygulama paketlerine geçmesine izin vermiyor" / "hiçbir uygulama paketi eklemiyor veya kaldırmıyor" hataları için sürüm numaraları yükseltildi.
- Sürüm `1.3.2`, Android versionCode `15` yapıldı; oyun içi `NR_CONFIG.version` değeri de eşitlendi.
- Release AAB derlemesi için `android/build-release-aab.sh` yardımcı betiği eklendi (imza ve sertifika sabitleme ortam değişkenlerini doğrular).

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
