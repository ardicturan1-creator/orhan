# Neon Rift Android simgesi

Bu sürümde gönderilen **NR neon simgesi** Android launcher simgesi olarak projeye eklenmiştir.

- Eski Android sürümleri için yoğunluğa göre `mipmap-*` PNG dosyaları hazırdır.
- Android 8.0 ve üzeri için adaptive icon tanımı hazırdır.
- Google Play mağaza görseli: `branding/neon-rift-playstore-512.png`
- Yüksek çözünürlüklü kaynak: `branding/neon-rift-app-icon.png`

Debug APK üretmek için:

```bash
cd android
./gradlew assembleDebug
```

Oluşan dosya: `android/app/build/outputs/apk/debug/app-debug.apk`
