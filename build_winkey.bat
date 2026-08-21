@echo off
REM build_winkey.bat - winkey_blocker.py dosyasini .exe olarak derler (Windows)
setlocal
python --version >nul 2>&1 || (echo [!] Python bulunamadi. https://python.org & pause & exit /b 1)
echo [*] PyInstaller kuruluyor...
python -m pip install --upgrade pip pyinstaller || (echo [!] Kurulamadi & pause & exit /b 1)
echo [*] EXE derleniyor...
python -m PyInstaller --onefile --noconsole --name winkey_blocker winkey_blocker.py || (echo [!] Derleme basarisiz & pause & exit /b 1)
echo.
echo [+] Tamam! EXE: dist\winkey_blocker.exe
echo     - Calistir: dist\winkey_blocker.exe   (Win tusu engellenir, aciliisa eklenir)
echo     - Cikis: Ctrl + Alt + Q
echo     - Aciliistan cikar: dist\winkey_blocker.exe --uninstall
echo.
pause
endlocal
