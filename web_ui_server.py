#!/usr/bin/env python3
"""
web_ui_server.py - Local web server and app-window launcher for the Profil Studio dashboard.
Binds to 127.0.0.1 only and rejects requests from other origins.
"""

import json
import os
import subprocess
import sys
import threading
import time
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Dict, List
from urllib.parse import urlparse

from stealth_browser.launcher import StealthLauncher, discover_available_browsers
from stealth_browser.profile_manager import HARDWARE_PRESETS, ProfileError, ProfileManager

PORT = 58888
ROOT = Path(__file__).resolve().parent
WEB_DIR = ROOT / "web_ui"
SETTINGS_FILE = ROOT / "app_settings.json"
PROXIES_FILE = ROOT / "proxies.json"
MAX_BODY = 5 * 1024 * 1024
DEFAULT_SETTINGS = {
    "browser_path": "",
    "start_url": "https://browserleaks.com/canvas",
    "mask_webrtc": True,
}
ALLOWED_ORIGINS = {f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}"}

profile_mgr = ProfileManager()
active_processes: Dict[str, subprocess.Popen] = {}
proc_lock = threading.Lock()


def load_settings() -> dict:
    settings = dict(DEFAULT_SETTINGS)
    try:
        if SETTINGS_FILE.exists():
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                stored = json.load(f)
            settings.update({k: v for k, v in stored.items() if k in DEFAULT_SETTINGS})
    except (OSError, ValueError):
        pass
    return settings


def save_settings(settings_data: dict):
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings_data, f, indent=2)


def load_proxies() -> List[dict]:
    if not PROXIES_FILE.exists():
        return []
    try:
        with open(PROXIES_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def save_proxies(proxies_list: list):
    with open(PROXIES_FILE, "w", encoding="utf-8") as f:
        json.dump(proxies_list, f, indent=2)


settings = load_settings()
launcher = StealthLauncher(browser_path=settings["browser_path"] or None)


def kill_tree(proc: subprocess.Popen):
    """Chrome spawns child processes; terminating only the parent can leave them holding UserData."""
    if proc.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(proc.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    else:
        proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


def running(name: str) -> bool:
    proc = active_processes.get(name)
    return bool(proc and proc.poll() is None)


def prune_processes():
    with proc_lock:
        for name in [n for n, p in active_processes.items() if p.poll() is not None]:
            del active_processes[name]


def stop_profile(name: str) -> bool:
    with proc_lock:
        proc = active_processes.pop(name, None)
    if proc and proc.poll() is None:
        kill_tree(proc)
        return True
    return False


class DashboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def log_message(self, fmt, *args):
        if "/api/" not in self.path:
            super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    # --- plumbing --------------------------------------------------------------

    def _send_json(self, data, status: int = 200):
        payload = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _error(self, message: str, status: int = 400):
        self._send_json({"error": message}, status=status)

    def _same_origin(self) -> bool:
        origin = self.headers.get("Origin")
        if origin is not None:
            return origin in ALLOWED_ORIGINS
        return self.headers.get("Host", "") in {o.split("//", 1)[1] for o in ALLOWED_ORIGINS}

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            raise ProfileError("Data terlalu besar (maks. 5 MB).")
        raw = self.rfile.read(length).decode("utf-8") if length else ""
        if not raw:
            return {}
        try:
            data = json.loads(raw)
        except ValueError:
            raise ProfileError("Body request bukan JSON yang valid.")
        if not isinstance(data, dict):
            raise ProfileError("Body request harus berupa objek JSON.")
        return data

    # --- routing ---------------------------------------------------------------

    def do_GET(self):
        path = urlparse(self.path).path
        routes = {
            "/api/profiles": self._get_profiles,
            "/api/trash": lambda: self._send_json({"items": profile_mgr.list_trash()}),
            "/api/settings": self._get_settings,
            "/api/presets": lambda: self._send_json({"presets": HARDWARE_PRESETS}),
            "/api/proxies": lambda: self._send_json({"proxies": load_proxies()}),
        }
        if path in routes:
            if not self._same_origin():
                return self._error("Origin tidak diizinkan.", 403)
            return self._run(routes[path])
        if path.startswith("/api/"):
            return self._error("Endpoint tidak ditemukan.", 404)
        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if not self._same_origin():
            return self._error("Origin tidak diizinkan.", 403)
        if "application/json" not in (self.headers.get("Content-Type") or ""):
            return self._error("Content-Type harus application/json.", 415)
        routes = {
            "/api/profiles/start": self._start,
            "/api/profiles/stop": self._stop,
            "/api/profiles/create": self._create,
            "/api/profiles/refresh_fingerprint": self._refresh_fingerprint,
            "/api/profiles/set_fingerprint": self._set_fingerprint,
            "/api/profiles/update": self._update,
            "/api/profiles/delete": self._delete,
            "/api/profiles/open_folder": self._open_folder,
            "/api/profiles/export": self._export,
            "/api/profiles/import": self._import,
            "/api/trash/restore": self._restore,
            "/api/trash/purge": self._purge,
            "/api/settings": self._set_settings,
            "/api/proxies/add": self._add_proxy,
            "/api/proxies/delete": self._delete_proxy,
        }
        handler = routes.get(path)
        if not handler:
            return self._error("Endpoint tidak ditemukan.", 404)
        self._run(lambda: handler(self._read_body()))

    def _run(self, fn):
        try:
            fn()
        except ProfileError as e:
            self._error(str(e), 400)
        except FileNotFoundError as e:
            self._error(str(e), 404)
        except Exception as e:
            self._error(f"Kesalahan server: {e}", 500)

    # --- handlers --------------------------------------------------------------

    def _get_profiles(self):
        prune_processes()
        profiles = []
        for p in profile_mgr.list_profiles():
            proc = active_processes.get(p["name"])
            p["is_active"] = bool(proc and proc.poll() is None)
            p["pid"] = proc.pid if p["is_active"] else None
            profiles.append(p)
        folders = sorted({p["folder"] for p in profiles if p.get("folder")}, key=str.lower)
        engine = os.path.basename(launcher.chrome_path) if launcher.chrome_path else ""
        trash_count = len(profile_mgr.list_trash())
        self._send_json({
            "profiles": profiles,
            "folders": folders,
            "active_engine": engine,
            "trash_count": trash_count
        })

    def _get_settings(self):
        self._send_json({
            **settings,
            "active_browser_path": launcher.chrome_path,
            "browsers": discover_available_browsers(),
        })

    def _set_settings(self, data: dict):
        browser_path = str(data.get("browser_path", settings["browser_path"])).strip()
        start_url = str(data.get("start_url", settings["start_url"])).strip()
        mask_webrtc = bool(data.get("mask_webrtc", settings.get("mask_webrtc", True)))

        if browser_path and not os.path.isfile(browser_path):
            raise ProfileError("File browser tidak ditemukan di path tersebut.")
        if start_url and urlparse(start_url).scheme not in ("http", "https", "about", "chrome"):
            raise ProfileError("Halaman awal harus diawali http:// atau https://.")

        settings.update({
            "browser_path": browser_path,
            "start_url": start_url or DEFAULT_SETTINGS["start_url"],
            "mask_webrtc": mask_webrtc,
        })
        save_settings(settings)
        launcher.__init__(browser_path=browser_path or None)
        self._get_settings()

    def _start(self, data: dict):
        name = data.get("name")
        profile_mgr.get_profile(name, create_if_missing=False)
        if not launcher.chrome_path:
            raise ProfileError("Browser Chromium/Chrome/Edge tidak ditemukan. Atur path-nya di Settings.")
        with proc_lock:
            if running(name):
                return self._send_json({"status": "already_running", "pid": active_processes[name].pid})
            proc = launcher.launch(profile_name=name, target_url=data.get("url") or settings["start_url"])
            active_processes[name] = proc
        self._send_json({"status": "started", "pid": proc.pid})

    def _stop(self, data: dict):
        self._send_json({"status": "stopped" if stop_profile(data.get("name")) else "not_running"})

    def _create(self, data: dict):
        created = profile_mgr.create_profile(
            name=data.get("name"),
            preset_index=data.get("preset", 0),
            proxy=data.get("proxy"),
            tags=data.get("tags"),
            folder=data.get("folder", ""),
            notes=data.get("notes", ""),
            diversify=bool(data.get("diversify", True)),
            custom=data.get("custom"),
        )
        self._send_json({"status": "created", "profile": created})

    def _refresh_fingerprint(self, data: dict):
        name = data.get("name")
        profile_mgr.get_profile(name, create_if_missing=False)
        if running(name):
            raise ProfileError("Hentikan profil yang sedang berjalan sebelum refresh fingerprint.")
        profile = profile_mgr.refresh_fingerprint(name)
        self._send_json({"status": "refreshed", "profile": profile})

    def _set_fingerprint(self, data: dict):
        name = data.get("name")
        profile_mgr.get_profile(name, create_if_missing=False)
        if running(name):
            raise ProfileError("Hentikan profil yang sedang berjalan sebelum mengubah fingerprint.")
        profile = profile_mgr.set_fingerprint(name, data.get("fields") or {})
        self._send_json({"status": "updated", "profile": profile})

    def _update(self, data: dict):
        updated = profile_mgr.update_profile(data.get("name"), data.get("fields") or {})
        self._send_json({"status": "updated", "profile": updated})

    def _delete(self, data: dict):
        names = data.get("names") or [data.get("name")]
        trashed, errors = [], []
        for name in names:
            try:
                stop_profile(name)
                profile_mgr.trash_profile(name)
                trashed.append(name)
            except (ProfileError, OSError) as e:
                errors.append(f"{name}: {e}")
        self._send_json({"status": "trashed", "trashed": trashed, "errors": errors})

    def _open_folder(self, data: dict):
        profile = profile_mgr.get_profile(data.get("name"), create_if_missing=False)
        folder = Path(profile["user_data_dir"]).parent
        if not folder.exists():
            raise FileNotFoundError("Folder profil tidak ditemukan.")
        if os.name == "nt":
            os.startfile(folder)
        else:
            subprocess.Popen(["xdg-open" if sys.platform != "darwin" else "open", str(folder)])
        self._send_json({"status": "opened"})

    def _export(self, data: dict):
        names = data.get("names") or []
        if not names:
            raise ProfileError("Pilih minimal satu profil untuk diekspor.")
        self._send_json({"format": "profil-studio/v1", "profiles": [profile_mgr.export_profile(n) for n in names]})

    def _import(self, data: dict):
        items = data.get("profiles")
        if not isinstance(items, list) or not items:
            raise ProfileError("File tidak berisi profil. Gunakan file hasil Export.")
        imported, errors = [], []
        for item in items:
            try:
                imported.append(profile_mgr.import_profile(item)["name"])
            except ProfileError as e:
                label = item.get("name", "?") if isinstance(item, dict) else "?"
                errors.append(f"{label}: {e}")
        self._send_json({"status": "imported", "imported": imported, "errors": errors})

    def _restore(self, data: dict):
        restored = profile_mgr.restore_profile(data.get("trash_id"))
        self._send_json({"status": "restored", "name": restored["name"]})

    def _purge(self, data: dict):
        count = profile_mgr.purge_trash(data.get("trash_id") or None)
        self._send_json({"status": "purged", "count": count})

    # --- proxy handlers --------------------------------------------------------

    def _add_proxy(self, data: dict):
        title = str(data.get("title", "")).strip()
        proxy_url = str(data.get("url", "")).strip()
        if not proxy_url:
            raise ProfileError("Alamat proxy wajib diisi.")
        proxies = load_proxies()
        new_entry = {
            "id": f"prx_{int(time.time() * 1000)}",
            "title": title or proxy_url,
            "url": proxy_url,
            "added_at": int(time.time()),
        }
        proxies.append(new_entry)
        save_proxies(proxies)
        self._send_json({"status": "added", "proxy": new_entry})

    def _delete_proxy(self, data: dict):
        proxy_id = data.get("id")
        proxies = load_proxies()
        filtered = [p for p in proxies if p.get("id") != proxy_id]
        save_proxies(filtered)
        self._send_json({"status": "deleted"})


def launch_in_app_window(port: int):
    """Open the dashboard as an app window (no tabs or address bar) and disable dev infobars."""
    browser_bin = launcher.chrome_path
    url = f"http://127.0.0.1:{port}"
    if not browser_bin:
        print(f"[!] Tidak ada browser Chromium. Buka {url} secara manual.")
        return
    subprocess.Popen([
        browser_bin,
        f"--app={url}",
        "--window-size=1360,860",
        "--test-type",
        "--disable-infobars",
        "--disable-features=TranslateUI",
        "--no-first-run",
        "--no-default-browser-check"
    ])


def server_already_running(port: int) -> bool:
    try:
        req = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/presets",
            headers={"Host": f"127.0.0.1:{port}"}
        )
        with urllib.request.urlopen(req, timeout=1) as r:
            return r.status == 200
    except Exception:
        return False


def main():
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), DashboardHandler)
    except OSError:
        if server_already_running(PORT):
            print("[*] Dashboard sudah berjalan, membuka jendelanya.")
            launch_in_app_window(PORT)
            return
        print(f"[!] Port {PORT} dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.")
        sys.exit(1)

    print(f"[*] Profil Studio berjalan di http://127.0.0.1:{PORT}")
    if "--no-window" not in sys.argv:
        launch_in_app_window(PORT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Menutup server...")
    finally:
        for name in list(active_processes):
            stop_profile(name)
        server.server_close()


if __name__ == "__main__":
    main()
