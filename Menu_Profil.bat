@echo off
title Kelola Profil Stealth Browser
cd /d "%~dp0"
:menu
cls
echo ===================================================
echo     KELOLA PROFIL STEALTH BROWSER (ANTI-DETECT)
echo ===================================================
echo 1. Lihat Daftar Profil Aktif
echo 2. Buka Browser Profil RTX 3070 (Windows)
echo 3. Buka Browser Profil Apple M2 (macOS)
echo 4. Buat Profil Baru
echo 5. Keluar
echo ===================================================
set /p pilihan="Pilih nomor (1-5): "

if "%pilihan%"=="1" (
    echo.
    python run_stealth.py --list
    echo.
    pause
    goto menu
)
if "%pilihan%"=="2" (
    echo.
    echo Meluncurkan Profil RTX 3070...
    python run_stealth.py --profile profile_rtx3070 --test
    pause
    goto menu
)
if "%pilihan%"=="3" (
    echo.
    echo Meluncurkan Profil Apple M2...
    python run_stealth.py --profile profile_apple_m2 --test
    pause
    goto menu
)
if "%pilihan%"=="4" (
    echo.
    set /p namaprofil="Masukkan nama profil baru: "
    python run_stealth.py --create --profile %namaprofil% --preset 0
    echo.
    pause
    goto menu
)
if "%pilihan%"=="5" exit
goto menu
