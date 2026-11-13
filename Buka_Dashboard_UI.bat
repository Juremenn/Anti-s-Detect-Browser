@echo off
cd /d "%~dp0"
start "" pythonw.exe gui_app.py
if errorlevel 1 (
    echo Terjadi kendala saat membuka GUI. Menjalankan fallback dengan python biasa...
    python gui_app.py
    pause
)
