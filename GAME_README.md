# Neon Drift — 3D Mobil Oyun

Üç şeritli, sonsuz koşu tarzı bir 3D mobil oyun. Three.js (WebGL) ile yazıldı,
tek bir Android APK içine gömülü WebView kabuğuyla paketlendi. Tamamen
çevrimdışı çalışır — internet izni istemez, sunucuya bağlanmaz.

## Nasıl oynanır
- Sağa/sola kaydırarak şerit değiştir
- Yukarı kaydır veya ekrana dokun → zıpla (alçak engelleri atlamak için)
- Kristalleri topla, kombonu artır, kalkan topla ve hıza yenilme

## Klasörler
- `game/src/main.js` — oyun mantığı (Three.js, kaynak dosya)
- `game/dist/index.html` — oyunun HTML/CSS kabuğu (elle yazıldı)
- `game/dist/game.js` — `npm run build` ile üretilen paketlenmiş oyun (git'e dahil değil)
- `android/` — APK'yı elle paketlemek için gereken her şey:
  - `AndroidManifest.xml`
  - `smali_src/` — tek bir `MainActivity` (WebView'i açan minimal native kabuk)
  - `res/` — uygulama ikonu (üretici script: `make_icon.py`)
  - `build_apk.sh` — sıfırdan APK üreten tek komutluk script

## APK'yı yeniden derlemek
```bash
cd game && npm install
../android/build_apk.sh
```
Çıktı: `android/build/NeonDrift.apk` (imzalı, kuruluma hazır).

## Neden özel bir derleme yolu kullanıldı
Bu ortamda Google'ın Android SDK sunucularına (`dl.google.com`) erişim
politika gereği kapalı, bu yüzden standart Gradle + Android Gradle Plugin
akışı çalışmıyor. Bunun yerine:
- `aapt`, `zipalign`, `apksigner` → Ubuntu'nun kendi paket deposundan
- `android.jar` (API 23) → Ubuntu'nun `android-sdk-platform-23` paketinden
- Native kabuk (`MainActivity`) → Maven Central'dan çekilen `smali`
  derleyicisiyle assemble edilen çok küçük, elle yazılmış bir sınıf

Oyunun kendisi (mantık, çarpışma, skor, ses, arayüz) tamamen normal
JavaScript/Three.js; APK sadece onu tam ekran bir WebView içinde açıyor.

## Test
`game/test_playwright.js` ve `game/test_extended.js`, headless Chromium ile
oyun mantığını (menü → oyun → çarpışma → oyun sonu, 45 saniyelik rastgele
oynanış, yeniden yükleme sonrası skor kalıcılığı) hatasız çalıştığını
doğrular. **Not:** Bu ortamda gerçek bir Android cihaz/emülatör yok, bu
yüzden APK'nın cihaz üzerinde çalıştığı fiilen test edilemedi — yalnızca
paketin yapısal olarak doğru, imzalı ve `androguard` ile doğrulanmış
`classes.dex` içerdiği doğrulandı. Cihaza kurup ilk açılışı bir kontrol
etmeni öneririm.
