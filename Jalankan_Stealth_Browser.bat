@echo off
title Stealth Anti-Detect Browser
cd /d "%~dp0"
echo ===================================================
echo   STEALTH ANTI-DETECT BROWSER (OFFLINE / NO LOGIN)
echo ===================================================
echo.
echo Meluncurkan browser dengan profil 'profile_rtx3070'...
python run_stealth.py --profile profile_rtx3070 --test
if errorlevel 1 (
    echo.
    echo Terjadi kendala saat menjalankan python. Pastikan Python terinstal di sistem.
    pause
)

