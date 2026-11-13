@echo off
title Octo Browser Offline Manager
cd /d "%~dp0"
echo =========================================================
echo    OCTO BROWSER - OFFLINE EDITION (NO CLOUD / NO LOGIN)
echo =========================================================
echo Membuka antarmuka desktop Octo Browser...
python web_ui_server.py
if errorlevel 1 (
    echo.
    echo [ERROR] Server UI terhenti.
    pause
)

