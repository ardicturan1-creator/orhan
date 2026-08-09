# Neon Rift v1.2.0 test matrisi

## Bu teslimatta çalıştırılan kontroller

| Kontrol | Sonuç |
| --- | --- |
| JavaScript sözdizimi | Geçti |
| Çekirdek ekonomi/görev/kayıt/skor testleri | Geçti |
| Paket ve kaynak tutarlılık testleri | Geçti |
| Paket adı | `com.bymel.Neonrift` |
| minSdk / targetSdk | 23 / 36 |
| Güvenli kayıt kaynak kontrolü | Geçti |
| BYMEL COMMANDER kaynak akışı kontrolü | Geçti |
| Chromium DOM/oyun döngüsü başlatma | Geçti; test konteynerinde WebGL bağlamı sunulmadı |
| Android APK/AAB derlemesi | Bu ortam Gradle dağıtımını indiremiyor; doğrulanamadı |
| Fiziksel cihaz testi | Yapılmadı |

## Yayın öncesi fiziksel cihaz matrisi

| Sınıf | Örnek | Android | Kontrol |
| --- | --- | --- | --- |
| Düşük segment Xiaomi | Redmi 9A/10A | 10–12 | 20 dk koşu, düşük kalite, 30+ FPS |
| Orta segment Xiaomi | Redmi Note 12/13 | 13–15 | Otomatik kalite, dokunma, ses |
| Düşük/orta Samsung | Galaxy A13/A15 | 12–15 | 20:9 UI, arka plan/geri dönüş |
| Orta Samsung | Galaxy A54/A55 | 14–16 | 60 FPS hedefi, Commander mermi yoğunluğu |
| En düşük cihaz | API 23 cihaz | 6.0 | AES-GCM kayıt, WebGL açılışı |
| API 23+ cihaz | Android 6+ | 6–16 | AES-GCM kayıt, güncelleme sonrası okuma |
| Güncel cihaz | API 36 | 16 | Tam ekran, çentik, Play Billing |

Her cihazda temiz kurulum, eski kayıt göçü, ekran kilidi, arka plana geçiş, 30 dakikalık koşu, Titan→Commander akışı, kayıt bozulması, ödeme ve iade senaryoları test edilmelidir.
