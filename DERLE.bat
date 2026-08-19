@echo off
chcp 65001 >nul
title Vanguard Ban - EXE Derleme
cd /d "%~dp0"
echo.
echo   Vanguard Ban  ->  tek dosya .exe derleniyor
echo   ------------------------------------------
echo.

python -m pip install --upgrade pip pyinstaller
if errorlevel 1 (
    echo.
    echo   HATA: pip/pyinstaller kurulamadi. Python kurulu mu?
    pause
    exit /b 1
)

pyinstaller --onefile --noconsole --name VanguardBan vanguard_ban.py
if errorlevel 1 (
    echo.
    echo   HATA: derleme basarisiz oldu.
    pause
    exit /b 1
)

echo.
echo   Bitti!  ->  dist\VanguardBan.exe
echo.
pause
