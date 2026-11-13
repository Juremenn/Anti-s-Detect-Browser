#!/usr/bin/env python3
"""
web_ui_server.py - Embedded Web Server & Native App Launcher for Octo Stealth UI.
Serves the modern Octo-styled single page dashboard and handles backend automation.
"""

import os
import sys
import json
import time
import subprocess
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from typing import Dict

from stealth_browser.profile_manager import ProfileManager
from stealth_browser.launcher import StealthLauncher, discover_available_browsers

PORT = 58888
WEB_DIR = Path(__file__).resolve().parent / "web_ui"
profile_mgr = ProfileManager()
discovered_browsers = discover_available_browsers()
active_browser_path = discovered_browsers[0]["path"] if discovered_browsers else ""
launcher = StealthLauncher(browser_path=active_browser_path)
active_processes: Dict[str, subprocess.Popen] = {}


class OctoWebHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def do_GET(self):
        if self.path == "/api/profiles":
            self._handle_get_profiles()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/profiles/"):
            action = self.path[len("/api/profiles/"):]
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
            data = json.loads(body) if body else {}

            if action == "start":
                self._handle_start(data)
            elif action == "stop":
                self._handle_stop(data)
            elif action == "create":
                self._handle_create(data)
            elif action == "delete":
                self._handle_delete(data)
            elif action == "open_folder":
                self._handle_open_folder(data)
            else:
                self._send_json({"error": "Unknown action"}, status=404)
        else:
            self._send_json({"error": "Not Found"}, status=404)

    def _send_json(self, data: dict, status: int = 200):
        payload = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(payload)

    def _handle_get_profiles(self):
        # Refresh process statuses
        to_remove = []
        for name, proc in active_processes.items():
            if proc.poll() is not None:
                to_remove.append(name)
        for name in to_remove:
            del active_processes[name]

        profiles = profile_mgr.list_profiles()
        res_list = []
        for p in profiles:
            name = p.get("name")
            is_active = name in active_processes and active_processes[name].poll() is None
            p_dict = dict(p)
            p_dict["is_active"] = is_active
            p_dict["pid"] = active_processes[name].pid if is_active else None
            res_list.append(p_dict)

        engine_name = os.path.basename(launcher.chrome_path) if launcher.chrome_path else "Not found"
        self._send_json({"profiles": res_list, "active_engine": engine_name})

    def _handle_start(self, data: dict):
        name = data.get("name")
        target_url = data.get("url", "https://browserleaks.com/canvas")

        if not name:
            self._send_json({"error": "Profile name is required"}, status=400)
            return

        if name in active_processes and active_processes[name].poll() is None:
            self._send_json({"status": "already_running", "pid": active_processes[name].pid})
            return

        try:
            proc = launcher.launch(profile_name=name, target_url=target_url)
            active_processes[name] = proc
            self._send_json({"status": "started", "pid": proc.pid})
        except Exception as e:
            self._send_json({"error": str(e)}, status=500)

    def _handle_stop(self, data: dict):
        name = data.get("name")
        proc = active_processes.get(name)
        if proc and proc.poll() is None:
            proc.terminate()
            del active_processes[name]
            self._send_json({"status": "stopped"})
        else:
            self._send_json({"status": "not_running"})

    def _handle_create(self, data: dict):
        name = data.get("name")
        preset = data.get("preset", 0)
        proxy = data.get("proxy", None)

        if not name:
            self._send_json({"error": "Profile name required"}, status=400)
            return

        created = profile_mgr.create_profile(name=name, preset_index=preset, proxy=proxy)
        self._send_json({"status": "created", "profile": created})

    def _handle_delete(self, data: dict):
        name = data.get("name")
        if name in active_processes and active_processes[name].poll() is None:
            active_processes[name].terminate()
            del active_processes[name]

        success = profile_mgr.delete_profile(name)
        self._send_json({"status": "deleted" if success else "failed"})

    def _handle_open_folder(self, data: dict):
        name = data.get("name")
        p = profile_mgr.get_profile(name)
        user_data = p.get("user_data_dir")
        if user_data and os.path.exists(user_data):
            os.startfile(user_data)
            self._send_json({"status": "opened"})
        else:
            self._send_json({"error": "Folder not found"}, status=404)


def launch_in_app_window(port: int):
    """Launch the dashboard in an app-window mode using discovered browser."""
    if not discovered_browsers:
        print("[!] No Chromium browser found to launch app window.")
        return

    browser_bin = discovered_browsers[0]["path"]
    app_url = f"http://127.0.0.1:{port}"
    args = [
        browser_bin,
        f"--app={app_url}",
        "--window-size=1280,820",
        "--disable-infobars",
        "--no-first-run",
        "--no-default-browser-check"
    ]
    print(f"[*] Opening Octo Dashboard in App Window using: {browser_bin}")
    subprocess.Popen(args)


def main():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), OctoWebHandler)
    print(f"[*] Octo Stealth Web Server running at http://127.0.0.1:{PORT}")

    # Launch desktop app window
    launch_in_app_window(PORT)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Shutting down server...")
        for name, proc in active_processes.items():
            if proc.poll() is None:
                proc.terminate()
        server.shutdown()


if __name__ == "__main__":
    main()

