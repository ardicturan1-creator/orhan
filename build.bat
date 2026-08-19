@echo off
REM ============================================================
REM  build.bat - chrome_opener.py dosyasini .exe olarak derler
REM  Windows uzerinde calistir. Python 3 kurulu olmali.
REM ============================================================
setlocal

echo [*] Python kontrol ediliyor...
python --version >nul 2>&1
if errorlevel 1 (
    echo [!] Python bulunamadi. Once https://python.org adresinden kurun.
    pause
    exit /b 1
)

echo [*] PyInstaller kuruluyor / guncelleniyor...
python -m pip install --upgrade pip
python -m pip install --upgrade pyinstaller
if errorlevel 1 (
    echo [!] PyInstaller kurulamadi.
    pause
    exit /b 1
)

echo [*] EXE derleniyor...
python -m PyInstaller --onefile --noconsole --name chrome_opener chrome_opener.py
if errorlevel 1 (
    echo [!] Derleme basarisiz.
    pause
    exit /b 1
)

echo.
echo [+] Tamam! EXE burada: dist\chrome_opener.exe
echo     - Calistirmak icin: dist\chrome_opener.exe
echo     - Cift tiklayinca kendini aciliisa ekler ve 5 sekme acar
echo.
pause
endlocal
