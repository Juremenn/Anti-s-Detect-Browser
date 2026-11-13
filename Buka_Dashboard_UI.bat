@echo off
title Octo Stealth Anti-Detect Manager
cd /d "%~dp0"

:: Cek apakah pythonw tersedia
where pythonw.exe >nul 2>&1
if %errorlevel% equ 0 (
    start "" pythonw.exe gui_app.py
) else (
    echo Menjalankan GUI dengan Python standard...
    python gui_app.py
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Terjadi kendala saat membuka antarmuka GUI.
        echo Silakan periksa apakah dependensi Python telah lengkap.
        pause
    )
)
