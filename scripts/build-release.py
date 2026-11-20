#!/usr/bin/env python3
"""
Unified release build pipeline for Anti's Detect Browser.
1. Builds the React frontend (frontend -> npm run build -> web_ui/).
2. Builds the standalone Manifest V3 extension (Extension/anti-detect-browser.crx).
3. Runs PyInstaller (--onedir --noconsole --icon=app.ico --version-file=scripts/version_info.txt).
4. Compiles scripts/installer.iss via Inno Setup (ISCC.exe) to produce dist/AntiDetectBrowser-Setup-v<version>.exe.
5. Generates dist/SHA256SUMS.txt for all release artifacts.

Usage:
    python scripts/build-release.py [--version 1.0.0]
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import urllib.request

REPO_ROOT = Path(__file__).resolve().parent.parent


def find_or_install_iscc() -> Path:
    candidates = [
        shutil.which("ISCC.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Inno Setup 7\ISCC.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"),
        r"C:\Program Files (x86)\Inno Setup 7\ISCC.exe",
        r"C:\Program Files\Inno Setup 7\ISCC.exe",
        r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        r"C:\Program Files\Inno Setup 6\ISCC.exe",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return Path(candidate)

    print("[*] Inno Setup (ISCC.exe) not found. Attempting auto-install...")
    winget_candidates = [
        shutil.which("winget"),
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe"),
    ]
    winget_bin = next((w for w in winget_candidates if w and Path(w).is_file()), None)
    if winget_bin:
        try:
            subprocess.check_call([
                winget_bin,
                "install",
                "--id",
                "JRSoftware.InnoSetup",
                "--silent",
                "--accept-package-agreements",
                "--accept-source-agreements",
            ])
        except Exception as e:
            print(f"[!] winget install failed ({e}), falling back to official GitHub release installer...")

    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return Path(candidate)

    # Fallback: download official Inno Setup installer from jrsoftware/issrc GitHub releases
    req = urllib.request.Request(
        "https://api.github.com/repos/jrsoftware/issrc/releases/latest",
        headers={"User-Agent": "AntiDetectBrowser-ReleaseBuilder"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        rel = json.loads(resp.read().decode("utf-8"))
    assets = rel.get("assets", [])
    installer_asset = next(
        (a for a in assets if a["name"].endswith(".exe") and not a["name"].endswith(".issig")),
        None,
    )
    if not installer_asset:
        raise RuntimeError("Could not find Inno Setup installer asset on GitHub.")

    tmp_installer = Path(tempfile.gettempdir()) / installer_asset["name"]
    print(f"[*] Downloading {installer_asset['browser_download_url']}...")
    dl_req = urllib.request.Request(
        installer_asset["browser_download_url"],
        headers={"User-Agent": "AntiDetectBrowser-ReleaseBuilder"},
    )
    with urllib.request.urlopen(dl_req, timeout=90) as dl_resp:
        tmp_installer.write_bytes(dl_resp.read())

    print("[*] Running Inno Setup silent user-mode installation...")
    subprocess.check_call([
        str(tmp_installer),
        "/VERYSILENT",
        "/SUPPRESSMSGBOXES",
        "/NORESTART",
        "/CURRENTUSER",
    ])

    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return Path(candidate)

    raise FileNotFoundError("ISCC.exe could not be located after installation.")


def sha256_digest(file_path: Path) -> str:
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _read_dotenv_oauth() -> dict:
    env_file = REPO_ROOT / ".env"
    vals = {}
    if not env_file.is_file():
        return vals
    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k in ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET") and v:
            vals[k] = v
    return vals


def _resolve_release_oauth_credentials() -> tuple[str, str]:
    dotenv_vals = _read_dotenv_oauth()
    sys.path.insert(0, str(REPO_ROOT))
    from web_ui import oauth_config

    placeholders = {"PASTE_YOUR_CLIENT_ID_HERE", "PASTE_YOUR_CLIENT_SECRET_HERE", ""}
    cid = (
        os.environ.get("GOOGLE_CLIENT_ID", "").strip()
        or dotenv_vals.get("GOOGLE_CLIENT_ID", "").strip()
        or str(getattr(oauth_config, "OFFICIAL_GOOGLE_CLIENT_ID", "")).strip()
    )
    csec = (
        os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
        or dotenv_vals.get("GOOGLE_CLIENT_SECRET", "").strip()
        or str(getattr(oauth_config, "OFFICIAL_GOOGLE_CLIENT_SECRET", "")).strip()
    )
    if cid in placeholders:
        cid = ""
    if csec in placeholders:
        csec = ""
    return cid, csec


def build_release(version: str = "1.0.0"):
    version_clean = version.lstrip("v").strip() or "1.0.0"
    dist_dir = REPO_ROOT / "dist"
    dist_dir.mkdir(parents=True, exist_ok=True)

    # Clean up any legacy raw .exe or portable .zip artifacts in dist/
    for old_file in dist_dir.glob("*"):
        if old_file.is_file() and (
            old_file.name == "AntiDetectBrowser.exe"
            or old_file.name.endswith(".zip")
            or old_file.name.endswith(".cer")
        ):
            old_file.unlink()

    # Step 1: Build React Frontend
    print("\n=== [1/5] Building React Frontend (frontend -> web_ui/) ===")
    npm_bin = "npm.cmd" if os.name == "nt" else "npm"
    subprocess.check_call([npm_bin, "run", "build"], cwd=str(REPO_ROOT / "frontend"))

    # Step 2: Build Standalone .crx Extension
    print("\n=== [2/5] Building Standalone Chromium Extension (.crx) ===")
    subprocess.check_call([sys.executable, str(REPO_ROOT / "scripts" / "build-extension.py")], cwd=str(REPO_ROOT))
    crx_source = REPO_ROOT / "Extension" / "anti-detect-browser.crx"
    if not crx_source.is_file():
        raise FileNotFoundError(f"Expected CRX file not found: {crx_source}")
    crx_dist = dist_dir / "anti-detect-browser.crx"
    shutil.copy2(crx_source, crx_dist)

    # Step 3: Build PyInstaller --onedir Desktop Application
    print("\n=== [3/5] Packaging Desktop Application (PyInstaller --onedir) ===")
    oauth_cfg_path = REPO_ROOT / "web_ui" / "oauth_config.py"
    original_oauth_cfg = oauth_cfg_path.read_text(encoding="utf-8") if oauth_cfg_path.is_file() else None
    rel_cid, rel_csec = _resolve_release_oauth_credentials()
    try:
        if rel_cid:
            print("[*] Bundling official Google OAuth credentials into release package...")
            oauth_cfg_path.write_text(
                '"""Bundled official Google OAuth 2.0 Desktop client credentials."""\n\n'
                "import os\n\n"
                f'OFFICIAL_GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", {rel_cid!r})\n'
                f'OFFICIAL_GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", {rel_csec!r})\n',
                encoding="utf-8",
            )
        else:
            print("[!] Warning: GOOGLE_CLIENT_ID not found in .env or oauth_config.py; packaged app will have OAuth unconfigured.")
        subprocess.check_call(
            [sys.executable, str(REPO_ROOT / "scripts" / "build-desktop-exe.py"), "--install-deps"],
            cwd=str(REPO_ROOT),
        )
    finally:
        if original_oauth_cfg is not None:
            oauth_cfg_path.write_text(original_oauth_cfg, encoding="utf-8")
    onedir_exe = dist_dir / "AntiDetectBrowser" / "AntiDetectBrowser.exe"
    if not onedir_exe.is_file():
        raise FileNotFoundError(f"PyInstaller --onedir binary missing: {onedir_exe}")

    # Step 4: Compile Inno Setup Installer
    print("\n=== [4/5] Compiling Windows Setup Installer (Inno Setup) ===")
    iscc_path = find_or_install_iscc()
    print(f"[*] Using Inno Setup compiler: {iscc_path}")
    iss_script = REPO_ROOT / "scripts" / "installer.iss"
    subprocess.check_call([
        str(iscc_path),
        f"/DMyAppVersion={version_clean}",
        str(iss_script),
    ], cwd=str(REPO_ROOT / "scripts"))

    setup_exe = dist_dir / f"AntiDetectBrowser-Setup-v{version_clean}.exe"
    if not setup_exe.is_file():
        raise FileNotFoundError(f"Expected Inno Setup output missing: {setup_exe}")

    # Step 5: Generate SHA256SUMS.txt
    print("\n=== [5/5] Generating SHA256SUMS.txt ===")
    artifacts = [setup_exe, crx_source]
    checksum_lines = []
    for artifact in artifacts:
        digest = sha256_digest(artifact)
        checksum_lines.append(f"{digest}  {artifact.name}")
        print(f"[+] {artifact.name} ({artifact.stat().st_size / (1024 * 1024):.2f} MB) -> SHA256: {digest}")

    sha256_file = dist_dir / "SHA256SUMS.txt"
    sha256_file.write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")

    print("\n=======================================================")
    print(" OFFICIAL RELEASE BUILD COMPLETE")
    print(f" 1. Installer : {setup_exe}")
    print(f" 2. Extension : {crx_source}")
    print(f" 3. Checksums : {sha256_file}")
    print("=======================================================")


def main():
    parser = argparse.ArgumentParser(description="Build official Windows installer and release artifacts")
    parser.add_argument("--version", default="1.0.0", help="Release version string (default: 1.0.0)")
    args = parser.parse_args()
    build_release(args.version)


if __name__ == "__main__":
    main()
