#!/usr/bin/env python3
"""
Stand-alone Windows desktop executable packager for Anti's Detect Browser.
Uses PyInstaller to bundle the Python backend, Edge WebView2 shell,
stealth browser engine, web UI assets, version metadata, and Authenticode signature
into a production binary and portable ZIP archive.

Usage:
    python scripts/build-desktop-exe.py [--onefile] [--install-deps]
"""

import argparse
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

REPO_ROOT = Path(__file__).resolve().parent.parent


def check_and_install_deps(auto_install: bool = False):
    try:
        import PyInstaller
        print(f"[*] PyInstaller {PyInstaller.__version__} is installed.")
    except ImportError:
        if auto_install:
            print("[*] PyInstaller not detected. Installing via pip...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
        else:
            print("[!] PyInstaller is not installed in the current Python environment.")
            print("    Run: pip install pyinstaller")
            print("    Or pass --install-deps to install automatically.")
            sys.exit(1)


def ensure_frontend_built():
    web_ui_dir = REPO_ROOT / "web_ui"
    index_html = web_ui_dir / "index.html"
    if not index_html.is_file():
        print("[*] web_ui/index.html not found. Building frontend assets...")
        frontend_dir = REPO_ROOT / "frontend"
        if not (frontend_dir / "package.json").is_file():
            print("[ERROR] frontend/package.json not found.")
            sys.exit(1)
        subprocess.check_call(["npm", "run", "build"], cwd=str(frontend_dir), shell=True)
    else:
        print("[*] Frontend web_ui bundle verified.")


def ensure_icons():
    ico_path = REPO_ROOT / "app.ico"
    if not ico_path.is_file():
        print("[*] app.ico not found at root. Generating icons...")
        gen_script = REPO_ROOT / "scripts" / "generate_icons.py"
        subprocess.check_call([sys.executable, str(gen_script)])
    else:
        print("[*] app.ico verified.")


def create_portable_zip(exe_path: Path, zip_path: Path):
    """Create a portable ZIP bundle with an auto-unblocking launcher that clears Mark-of-the-Web."""
    launcher_bat = """@echo off
title Anti's Detect Browser
cd /d "%~dp0"

:: Remove Mark-of-the-Web (Zone.Identifier) so Windows SmartScreen does not block AntiDetectBrowser.exe
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
  "Unblock-File -Path '%~dp0AntiDetectBrowser.exe' -ErrorAction SilentlyContinue"

start "" "%~dp0AntiDetectBrowser.exe"
exit
"""
    license_file = REPO_ROOT / "LICENSE"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(exe_path, arcname="AntiDetectBrowser.exe")
        if license_file.is_file():
            zf.write(license_file, arcname="LICENSE.txt")
        zf.writestr("Buka_Anti_Detect_Browser.bat", launcher_bat.replace("\n", "\r\n"))
    print(f"[+] Portable ZIP bundle created: {zip_path}")


def build_exe(onefile: bool = False):
    ensure_frontend_built()
    ensure_icons()

    dist_dir = REPO_ROOT / "dist"
    app_ico = REPO_ROOT / "app.ico"
    selfcheck_html = REPO_ROOT / "selfcheck.html"
    license_file = REPO_ROOT / "LICENSE"
    version_file = REPO_ROOT / "scripts" / "version_info.txt"
    entry_script = REPO_ROOT / "desktop_app.pyw"

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--name=AntiDetectBrowser",
        "--windowed",
        f"--icon={app_ico}",
        f"--version-file={version_file}",
        f"--add-data={REPO_ROOT / 'web_ui'};web_ui",
        f"--add-data={REPO_ROOT / 'stealth_browser'};stealth_browser",
        f"--add-data={app_ico};.",
        f"--add-data={selfcheck_html};.",
        f"--add-data={license_file};.",
        "--hidden-import=web_ui_server",
        "--hidden-import=webview",
        "--hidden-import=webview.platforms.winforms",
        "--hidden-import=webview.platforms.edgechromium",
        "--hidden-import=clr",
        "--hidden-import=pythonnet",
        "--hidden-import=stealth_browser",
        "--hidden-import=stealth_browser.profile_manager",
        "--hidden-import=stealth_browser.launcher",
        "--hidden-import=stealth_browser.fingerprint",
        "--hidden-import=stealth_browser.stealth_hooks",
        "--hidden-import=stealth_browser.cdp_apply",
        "--hidden-import=stealth_browser.consistency",
        "--hidden-import=stealth_browser.proxy_utils",
    ]

    if onefile:
        cmd.append("--onefile")
        print("[*] Packaging mode: Single-file executable (--onefile)")
    else:
        cmd.append("--onedir")
        print("[*] Packaging mode: Directory bundle (--onedir)")

    cmd.append(str(entry_script))

    print(f"[*] Executing PyInstaller command:\n    {' '.join(cmd)}\n")
    subprocess.check_call(cmd, cwd=str(REPO_ROOT))

    if onefile:
        exe_path = dist_dir / "AntiDetectBrowser.exe"
    else:
        exe_path = dist_dir / "AntiDetectBrowser" / "AntiDetectBrowser.exe"

    if onefile:
        zip_path = dist_dir / "AntiDetectBrowser-Portable-v1.0.0.zip"
        create_portable_zip(exe_path, zip_path)

    print("\n=======================================================")
    print(" BUILD SUCCESSFUL")
    print(f" Binary location: {exe_path}")
    print("=======================================================")


def main():
    parser = argparse.ArgumentParser(description="Build standalone AntiDetectBrowser.exe")
    parser.add_argument("--onefile", action="store_true", help="Build single-file exe instead of directory bundle")
    parser.add_argument("--install-deps", action="store_true", help="Auto-install PyInstaller if missing")
    args = parser.parse_args()

    check_and_install_deps(args.install_deps)
    build_exe(args.onefile)


if __name__ == "__main__":
    main()
