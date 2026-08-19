# Chrome Opener (Gelismis)

Belirtilen sayida Google sekmesini hizlica acar. Varsayilan: **5 sekme**.
Windows aciliisinda otomatik baslatma destegi vardir.

## Dosyalar
- `chrome_opener.py` — Python kaynak kodu
- `build.bat` — Windows'ta `.exe` uretir (PyInstaller)
- `run.bat` — Derlemeden dogrudan calistirir

## 1) EXE olusturma (Windows)
1. Python 3'un kurulu oldugundan emin ol (https://python.org).
2. `build.bat` dosyasina cift tikla.
3. EXE burada olusur: `dist\chrome_opener.exe`

## 2) Kullanim
`chrome_opener.exe` dosyasina **cift tiklamak yeterli**:
- Kendini otomatik olarak Windows aciliisina ekler (yalnizca bir kez, zaten ekliyse dokunmaz).
- 5 Google sekmesini hizlica acar.

Artik her bilgisayar acildiginda 5 sekme otomatik acilir.

```
chrome_opener.exe            # aciliisa ekler + 5 sekme acar
chrome_opener.exe -n 8       # 8 sekme
chrome_opener.exe -u https://github.com   # baska URL
chrome_opener.exe -d 0.2     # sekmeler arasi 0.2 sn bekleme
chrome_opener.exe --no-startup  # bu sefer aciliisa dokunma, sadece ac
```

## 3) Aciliistan cikarma
```
chrome_opener.exe --uninstall   # aciliistan cikarir
```
Aciliis kaydi `HKCU\...\CurrentVersion\Run` altinda `ChromeOpener` adiyla tutulur.

## Not
- EXE Windows'ta uretilmelidir; bu ortamda (Linux) capraz derleme yapilamaz.
- Sekme sayisi guvenlik icin 1–50 araligina sinirlidir.
