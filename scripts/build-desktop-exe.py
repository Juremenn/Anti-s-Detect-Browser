#!/usr/bin/env python3
"""
Windows desktop executable packager for Anti's Detect Browser.
Uses PyInstaller (--onedir --noconsole) to bundle the Python backend, Edge WebView2 shell,
stealth browser engine, web UI assets, icon, and PE VersionInfo metadata.

Usage:
    python scripts/build-desktop-exe.py [--install-deps] [--rebuild-frontend]
"""

import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys

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


def ensure_frontend_built(force_rebuild: bool = False):
    web_ui_dir = REPO_ROOT / "web_ui"
    index_html = web_ui_dir / "index.html"
    if force_rebuild or not index_html.is_file():
        print("[*] Building frontend assets (npm run build)...")
        frontend_dir = REPO_ROOT / "frontend"
        if not (frontend_dir / "package.json").is_file():
            print("[ERROR] frontend/package.json not found.")
            sys.exit(1)
        npm_bin = "npm.cmd" if os.name == "nt" else "npm"
        subprocess.check_call([npm_bin, "run", "build"], cwd=str(frontend_dir))
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


def build_exe(rebuild_frontend: bool = False) -> Path:
    ensure_frontend_built(force_rebuild=rebuild_frontend)
    ensure_icons()

    dist_dir = REPO_ROOT / "dist"
    onedir_out = dist_dir / "AntiDetectBrowser"
    if onedir_out.exists():
        shutil.rmtree(onedir_out, ignore_errors=True)

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
        "--onedir",
        "--noconsole",
        "--name=AntiDetectBrowser",
        f"--icon={app_ico}",
        f"--version-file={version_file}",
        f"--add-data={REPO_ROOT / 'web_ui'};web_ui",
        f"--add-data={REPO_ROOT / 'stealth_browser'};stealth_browser",
        f"--add-data={app_ico};.",
        f"--add-data={selfcheck_html};.",
        f"--add-data={license_file};.",
        "--hidden-import=web_ui_server",
        "--hidden-import=web_ui",
        "--hidden-import=web_ui.cloud_sync",
        "--hidden-import=web_ui.oauth_config",
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
        str(entry_script),
    ]

    print("[*] Packaging mode: Directory bundle (--onedir --noconsole)")
    print(f"[*] Executing PyInstaller command:\n    {' '.join(cmd)}\n")
    subprocess.check_call(cmd, cwd=str(REPO_ROOT))

    exe_path = dist_dir / "AntiDetectBrowser" / "AntiDetectBrowser.exe"
    if not exe_path.is_file():
        raise FileNotFoundError(f"Expected PyInstaller output not found: {exe_path}")

    print("\n=======================================================")
    print(" PYINSTALLER ONEDIR BUILD SUCCESSFUL")
    print(f" Binary location: {exe_path}")
    print("=======================================================")
    return exe_path


def inject_oauth_from_env():
    cid = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    csec = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
    if not cid:
        return
    oauth_cfg = REPO_ROOT / "web_ui" / "oauth_config.py"
    oauth_cfg.write_text(
        '"""Bundled official Google OAuth 2.0 Desktop client credentials."""\n\n'
        "import os\n\n"
        f'OFFICIAL_GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", {cid!r})\n'
        f'OFFICIAL_GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", {csec!r})\n',
        encoding="utf-8",
    )
    print("[*] Bundled official Google OAuth credentials into web_ui/oauth_config.py")


def main():
    parser = argparse.ArgumentParser(description="Build AntiDetectBrowser (--onedir)")
    parser.add_argument("--install-deps", action="store_true", help="Auto-install PyInstaller if missing")
    parser.add_argument("--rebuild-frontend", action="store_true", help="Force rebuild of React frontend")
    parser.add_argument("--inject-oauth", action="store_true", help="Bake GOOGLE_CLIENT_ID/SECRET env vars into oauth_config.py")
    args = parser.parse_args()

    check_and_install_deps(args.install_deps)
    if args.inject_oauth:
        inject_oauth_from_env()
    build_exe(rebuild_frontend=args.rebuild_frontend)


if __name__ == "__main__":
    main()
