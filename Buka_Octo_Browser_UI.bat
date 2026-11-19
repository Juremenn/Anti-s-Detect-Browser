@echo off
cd /d "%~dp0"

:: Prefer pythonw for silent native launch without console window
where pythonw >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    start "" pythonw desktop_app.pyw
    exit /b 0
)

where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    start "" python desktop_app.pyw
    exit /b 0
)

echo [ERROR] Python tidak ditemukan di sistem. Pastikan Python sudah terinstal dan ada di PATH.
pause
exit /b 1
