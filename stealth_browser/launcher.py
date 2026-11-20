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
    def __init__(
        self,
        browser_path: Optional[str] = None,
        profiles_dir: Optional[Path] = None,
        custom_extensions_file: Optional[Path] = None,
    ):
        self.profile_mgr = ProfileManager(profiles_dir) if profiles_dir else ProfileManager()
        self.custom_extensions_file: Optional[Path] = Path(custom_extensions_file) if custom_extensions_file else None
        if browser_path and os.path.exists(browser_path):
            self.chrome_path = browser_path
        else:
            try:
                self.chrome_path = find_chrome_executable()
            except FileNotFoundError:
                self.chrome_path = ""

    def set_account_paths(
        self,
        profiles_dir: Optional[Path] = None,
        custom_extensions_file: Optional[Path] = None,
    ):
        """Rebind the launcher to an authenticated account's profiles and extensions paths."""
        if profiles_dir is not None:
            self.profile_mgr = ProfileManager(profiles_dir)
        self.custom_extensions_file = Path(custom_extensions_file) if custom_extensions_file else None

    def get_enabled_custom_extension_paths(self) -> List[str]:
        """
        Collect directories of enabled custom extensions that actually exist on disk.
        """
        if self.custom_extensions_file is not None:
            custom_ext_file = self.custom_extensions_file
        else:
            if getattr(sys, "frozen", False):
                local_appdata = os.environ.get("LOCALAPPDATA")
                base = Path(local_appdata) if local_appdata else (Path.home() / "AppData" / "Local")
                app_root = base / "AntiDetectBrowser"
            else:
                app_root = Path(__file__).resolve().parent.parent
            custom_ext_file = app_root / "data" / "custom_extensions.json"
        valid_paths = []
        if custom_ext_file.is_file():
            try:
                with open(custom_ext_file, "r", encoding="utf-8") as f:
                    registry = json.load(f)
                if isinstance(registry, list):
                    for ext in registry:
                        if ext.get("enabled", True):
                            ext_path_str = ext.get("path", "")
                            if ext_path_str:
                                p = Path(ext_path_str)
                                if p.is_dir() and (p / "manifest.json").is_file():
                                    valid_paths.append(str(p.resolve()))
            except Exception as e:
                print(f"[!] Warning reading custom extensions: {e}")
        return valid_paths

    def launch(
        self,
        profile_name: str,
        target_url: str = "https://browserleaks.com/canvas",
        remote_port: Optional[int] = None,
        headless: bool = False,
        overrides: Optional[dict] = None,
        use_extension: bool = True,
    ) -> subprocess.Popen:
        """
        Launch Chromium with the profile identity. CDP application runs on a
        daemon thread started here, so every entrypoint (UI server, CLI) gets
        the same engine-level treatment.
        """
        if not self.chrome_path or not os.path.exists(self.chrome_path):
            raise FileNotFoundError("Path browser Chromium belum disetel atau tidak valid.")

        if not remote_port:
            remote_port = find_free_port()
        profile = self.profile_mgr.get_profile(profile_name)
        user_data_dir = profile["user_data_dir"]
        overrides = overrides or {}

        # --- launch flags --------------------------------------------------------
        args = [
            self.chrome_path,
            f"--user-data-dir={user_data_dir}",
            f"--remote-debugging-port={remote_port}",
            "--disable-blink-features=AutomationControlled",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-infobars",
            # Machine signal suppression: no telemetry pings, no sync prompts,
            # no crash reports leaving the machine, no component updater calls.
            "--disable-crash-reporter",
            f"--crash-dumps-dir={Path(user_data_dir).parent / 'crash_dumps'}",
            "--disable-component-update",
            "--disable-sync",
            "--no-pings",
            "--disable-features=IsolateOrigins,site-per-process",
            f"--user-agent={profile.get('user_agent', '')}",
            f"--window-size={profile.get('screen_width', 1920)},{profile.get('screen_height', 1080)}",
        ]

        # Enforce strict WebRTC permissions and isolation
        args.append("--enforce-webrtc-ip-permission-check")

        if use_extension:
            custom_paths = self.get_enabled_custom_extension_paths()
            if custom_paths:
                args.append(f"--load-extension={','.join(custom_paths)}")

        # Accept-Language must equal navigator.languages (spec 4.2). --lang also
        # shapes the engine's own locale fallbacks.
        languages = overrides.get("languages") or profile.get("languages") or []
        if languages:
            args.append(f"--lang={languages[0]}")

        # WebRTC handling per profile choice; altered/disabled both keep the
        # engine from exposing local IPs (with a proxy set, WebRTC uses it).
        webrtc_mode = profile.get("webrtc_mode", "altered")
        if webrtc_mode in ("disabled", "altered"):
            args.append("--force-webrtc-ip-handling-policy=disable_non_proxied_udp")

        if profile.get("proxy"):
            args.append(f"--proxy-server={profile['proxy']}")

        for extra in (profile.get("extra_args") or "").split():
            if extra.startswith("-"):
                args.append(extra)

        if headless:
            args.append("--headless=new")

        args.append(target_url)

        tz_label = overrides.get("timezone") or (
            "auto (browser IP)" if profile.get("timezone_mode", "proxy") == "proxy" else "engine default"
        )
        print("=" * 65)
        print(f"[*] Launching Stealth Browser Profile: '{profile['name']}'")
        print(f"[*] Engine:             {self.chrome_path}")
        print(f"[*] Hardware Emulation: {profile.get('webgl_renderer')}")
        print(f"[*] Canvas Noise Seed:  {profile.get('canvas_seed')}")
        print(f"[*] Audio Noise Seed:   {profile.get('audio_seed')}")
        print(f"[*] Isolated UserData:  {user_data_dir}")
        print(f"[*] Timezone/Lang:      {tz_label} / {languages[0] if languages else 'auto (browser IP)'}")
        print(f"[*] Target URL:         {target_url}")
        print("=" * 65)

        env = os.environ.copy()
        # Suppress the "Google API keys are missing" infobar.
        env["GOOGLE_API_KEY"] = "no"
        env["GOOGLE_DEFAULT_CLIENT_ID"] = "no"
        env["GOOGLE_DEFAULT_CLIENT_SECRET"] = "no"
        # Timezone fallback (CDP setTimezoneOverride is the primary mechanism).
        if overrides.get("timezone"):
            env["TZ"] = overrides["timezone"]

        proc = subprocess.Popen(args, env=env)

        from .cdp_apply import start_cdp_thread
        start_cdp_thread(remote_port, profile, overrides, browser_path=self.chrome_path)
        return proc


async def attach_cdp_hooks(port: int, stealth_js: str):
    """
    Legacy helper kept for run_stealth.py compatibility. New code should use
    cdp_apply.apply_profile_cdp, which also applies Emulation overrides.
    """
    from .cdp_apply import _StdlibWebSocket, _wait_for_version
    await asyncio.sleep(1.5)

    ws = None
    try:
        data = await _wait_for_version(port)
        if not data:
            return
        ws_url = data.get("webSocketDebuggerUrl")
        if not ws_url:
            return
        ws = await _StdlibWebSocket.connect(ws_url)
        await ws.send_str(json.dumps({"id": 1, "method": "Page.enable", "params": {}}))
        await ws.send_str(json.dumps({
            "id": 2,
            "method": "Page.addScriptToEvaluateOnNewDocument",
            "params": {"source": stealth_js}
        }))
        print("[*] CDP Hook: Page.addScriptToEvaluateOnNewDocument successfully registered.")
    except Exception:
        pass
    finally:
        if ws is not None:
            await ws.close()
