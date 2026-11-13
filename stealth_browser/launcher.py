"""
launcher.py - Spawns Chrome with anti-detect flags and injects stealth scripts.
Uses both Chrome Extension (world: MAIN) and CDP Page.addScriptToEvaluateOnNewDocument.
"""

import os
import sys
import json
import shutil
import asyncio
import subprocess
from pathlib import Path
from typing import Optional

from .profile_manager import ProfileManager
from .stealth_hooks import generate_stealth_script

CHROME_CANDIDATE_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
]


def find_chrome_executable() -> str:
    """Locate Chrome on the system."""
    for path in CHROME_CANDIDATE_PATHS:
        if os.path.exists(path):
            return path
    raise FileNotFoundError("Google Chrome executable not found in default installation directories.")


class StealthLauncher:
    def __init__(self, profiles_dir: Optional[Path] = None):
        self.profile_mgr = ProfileManager(profiles_dir) if profiles_dir else ProfileManager()
        self.chrome_path = find_chrome_executable()

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
        remote_port: int = 9222,
        headless: bool = False
    ) -> subprocess.Popen:
        """
        Launch Chrome with the stealth profile.
        """
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
    await asyncio.sleep(1.5) # Wait for Chrome to bind port

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
                # Enable Page domain
                await ws.send_json({"id": 1, "method": "Page.enable", "params": {}})
                # Register script to evaluate on new document
                await ws.send_json({
                    "id": 2,
                    "method": "Page.addScriptToEvaluateOnNewDocument",
                    "params": {"source": stealth_js}
                })
                print("[*] CDP Hook: Page.addScriptToEvaluateOnNewDocument successfully registered.")
    except Exception as e:
        # If CDP connection fails (e.g. Chrome opened already), Extension layer still active
        pass
