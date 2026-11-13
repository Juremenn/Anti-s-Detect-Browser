"""
launcher.py - Spawns Chromium-based browsers with anti-detect flags and injects stealth scripts.
Supports pure Chromium, Brave, Chrome, and Edge with automatic engine discovery.
"""

import os
import sys
import json
import glob
import socket
import asyncio
import subprocess
from pathlib import Path
from typing import Optional, List

from .profile_manager import ProfileManager
from .stealth_hooks import generate_stealth_script

# Common candidate paths for Chromium-based browser engines on Windows
BROWSER_CANDIDATE_PATTERNS = [
    # 1. Clean Playwright / Puppeteer Chromium
    os.path.expandvars(r"%LOCALAPPDATA%\ms-playwright\chromium-*\chrome-win\chrome.exe"),
    os.path.expandvars(r"%LOCALAPPDATA%\ms-playwright\chromium-*\chrome-win64\chrome.exe"),
    # 2. Brave Browser
    r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
    r"C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"),
    # 3. Google Chrome
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    # 4. Microsoft Edge & EdgeCore
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
    r"C:\Program Files (x86)\Microsoft\EdgeCore\*\msedge.exe",
    r"C:\Program Files\Microsoft\EdgeCore\*\msedge.exe",
]


def discover_available_browsers() -> List[dict]:
    """
    Search and return all installed Chromium engines on the system.
    """
    found = []
    seen = set()

    for pattern in BROWSER_CANDIDATE_PATTERNS:
        matches = glob.glob(pattern)
        for match in matches:
            norm = os.path.normpath(match)
            if norm not in seen and os.path.exists(norm):
                seen.add(norm)
                # Classify browser name
                lower = norm.lower()
                if "ms-playwright" in lower or "chromium" in lower:
                    name = "Chromium (Pure Engine)"
                elif "brave" in lower:
                    name = "Brave Browser"
                elif "chrome" in lower:
                    name = "Google Chrome"
                elif "edge" in lower:
                    name = "Microsoft Edge"
                else:
                    name = "Chromium Compatible"

                found.append({"name": name, "path": norm})

    return found


def find_chrome_executable() -> str:
    """
    Locate the best available Chromium executable on the system.
    """
    browsers = discover_available_browsers()
    if browsers:
        return browsers[0]["path"]
    raise FileNotFoundError(
        "Tidak ditemukan browser berbasis Chromium (Google Chrome, Brave, atau Chromium) di sistem."
    )


def find_free_port() -> int:
    """Ask the OS for an unused localhost port so several profiles can run at once."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class StealthLauncher:
    def __init__(self, browser_path: Optional[str] = None, profiles_dir: Optional[Path] = None):
        self.profile_mgr = ProfileManager(profiles_dir) if profiles_dir else ProfileManager()
        if browser_path and os.path.exists(browser_path):
            self.chrome_path = browser_path
        else:
            try:
                self.chrome_path = find_chrome_executable()
            except FileNotFoundError:
                self.chrome_path = ""

    def prepare_extension(self, profile: dict) -> Path:
        """
        Create a per-profile customized unpacked extension.
        """
        profile_path = Path(profile["user_data_dir"]).parent
        ext_dir = profile_path / "StealthExtension"
        ext_dir.mkdir(parents=True, exist_ok=True)

        # Manifest V3
        manifest = {
            "manifest_version": 3,
            "name": f"Stealth Identity - {profile['name']}",
            "version": "1.0.0",
            "description": "Hardware & canvas fingerprint masking",
            "content_scripts": [
                {
                    "matches": ["<all_urls>"],
                    "js": ["content.js"],
                    "run_at": "document_start",
                    "world": "MAIN",
                    "all_frames": True
                }
            ]
        }
        with open(ext_dir / "manifest.json", "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

        # Injected content script
        stealth_js = generate_stealth_script(profile)
        with open(ext_dir / "content.js", "w", encoding="utf-8") as f:
            f.write(stealth_js)

        return ext_dir

    def launch(
        self,
        profile_name: str,
        target_url: str = "https://browserleaks.com/canvas",
        remote_port: Optional[int] = None,
        headless: bool = False
    ) -> subprocess.Popen:
        """
        Launch Chromium browser with the stealth profile.
        """
        if not self.chrome_path or not os.path.exists(self.chrome_path):
            raise FileNotFoundError("Path browser Chromium belum disetel atau tidak valid.")

        if not remote_port:
            remote_port = find_free_port()
        profile = self.profile_mgr.get_profile(profile_name)
        ext_path = self.prepare_extension(profile)
        user_data_dir = profile["user_data_dir"]

        args = [
            self.chrome_path,
            f"--user-data-dir={user_data_dir}",
            f"--load-extension={str(ext_path)}",
            f"--remote-debugging-port={remote_port}",
            "--disable-blink-features=AutomationControlled",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-infobars",
            "--disable-features=IsolateOrigins,site-per-process",
            f"--user-agent={profile.get('user_agent', '')}",
            f"--window-size={profile.get('screen_width', 1920)},{profile.get('screen_height', 1080)}",
        ]

        if profile.get("proxy"):
            args.append(f"--proxy-server={profile['proxy']}")

        if headless:
            args.append("--headless=new")

        args.append(target_url)

        print("=" * 65)
        print(f"[*] Launching Stealth Browser Profile: '{profile['name']}'")
        print(f"[*] Engine:             {self.chrome_path}")
        print(f"[*] Hardware Emulation: {profile['webgl_renderer']}")
        print(f"[*] Canvas Noise Seed:  {profile['canvas_seed']}")
        print(f"[*] Audio Noise Seed:   {profile['audio_seed']}")
        print(f"[*] Isolated UserData:  {user_data_dir}")
        print(f"[*] Target URL:         {target_url}")
        print("=" * 65)

        proc = subprocess.Popen(args)
        return proc


async def attach_cdp_hooks(port: int, stealth_js: str):
    """
    Connect to Chrome CDP and register Page.addScriptToEvaluateOnNewDocument.
    """
    import aiohttp
    await asyncio.sleep(1.5)

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"http://127.0.0.1:{port}/json/version") as resp:
                if resp.status != 200:
                    return
                data = await resp.json()
                ws_url = data.get("webSocketDebuggerUrl")

            if not ws_url:
                return

            async with session.ws_connect(ws_url) as ws:
                await ws.send_json({"id": 1, "method": "Page.enable", "params": {}})
                await ws.send_json({
                    "id": 2,
                    "method": "Page.addScriptToEvaluateOnNewDocument",
                    "params": {"source": stealth_js}
                })
                print("[*] CDP Hook: Page.addScriptToEvaluateOnNewDocument successfully registered.")
    except Exception:
        pass
