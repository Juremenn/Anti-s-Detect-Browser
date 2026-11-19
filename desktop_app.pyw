"""
Native Python desktop shell for Anti's Detect Browser.
Uses pywebview with Edge WebView2 backend on Windows 11.
Provides single-instance protection, native file dialogs,
and headless server lifecycle management.
"""

import base64
import ctypes
import logging
import os
from pathlib import Path
import sys
import threading
import time
import webview

# Add base directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import web_ui_server

# 1. Register Windows AppUserModelID for taskbar grouping and crisp icon
APP_ID = "AntisDetectBrowser.Desktop.1.0"
if sys.platform == "win32":
    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(APP_ID)
    except Exception:
        pass

# 2. Setup logging to data/app.log and terminal
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = DATA_DIR / "app.log"

logger = logging.getLogger("DesktopApp")
logger.setLevel(logging.INFO)

file_handler = logging.FileHandler(str(LOG_FILE), encoding="utf-8")
file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
logger.addHandler(file_handler)

if sys.stdout is not None:
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(logging.Formatter("[%(levelname)s] %(message)s"))
    logger.addHandler(console_handler)


class StreamToLogger:
    """Redirect stdout/stderr to logging file when running headless under pythonw."""

    def __init__(self, log_level):
        self.log_level = log_level
        self._buf = ""

    def write(self, buf):
        if not buf:
            return
        self._buf += buf
        while "\n" in self._buf:
            line, self._buf = self._buf.split("\n", 1)
            line = line.strip()
            if line:
                logger.log(self.log_level, line)

    def flush(self):
        if self._buf.strip():
            logger.log(self.log_level, self._buf.strip())
            self._buf = ""


if sys.stdout is None:
    sys.stdout = StreamToLogger(logging.INFO)
if sys.stderr is None:
    sys.stderr = StreamToLogger(logging.ERROR)

# 3. Single-Instance Named Mutex (Local session namespace)
ERROR_ALREADY_EXISTS = 183
MUTEX_NAME = "Local\\AntiDetectBrowser_Desktop_Mutex"


def acquire_single_instance_mutex():
    if sys.platform != "win32":
        return True, None
    try:
        kernel32 = ctypes.windll.kernel32
        handle = kernel32.CreateMutexW(None, False, MUTEX_NAME)
        if not handle:
            return True, None
        last_error = kernel32.GetLastError()
        if last_error == ERROR_ALREADY_EXISTS:
            return False, handle
        return True, handle
    except Exception as e:
        logger.warning(f"Failed to create single-instance mutex: {e}")
        return True, None


def find_existing_window():
    if sys.platform != "win32":
        return None
    try:
        user32 = ctypes.windll.user32
        hwnd = user32.FindWindowW(None, "Anti's Detect Browser")
        return hwnd if hwnd else None
    except Exception:
        return None


def focus_window(hwnd):
    if sys.platform != "win32" or not hwnd:
        return
    try:
        user32 = ctypes.windll.user32
        user32.ShowWindow(hwnd, 9)  # SW_RESTORE
        user32.SetForegroundWindow(hwnd)
    except Exception as e:
        logger.warning(f"Failed to focus window: {e}")


def cleanup_orphaned_webview(storage_path: Path):
    """Release locks on webview_cache by terminating orphaned msedgewebview2 processes from abrupt crashes."""
    if sys.platform != "win32":
        return
    try:
        norm = str(storage_path).lower().replace("/", "\\")
        import subprocess
        cmd = f'Get-CimInstance Win32_Process -Filter "Name LIKE \'%webview%\'" | Where-Object {{ $_.CommandLine -like "*{norm}*" }} | ForEach-Object {{ Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }}'
        subprocess.run(["powershell", "-NoProfile", "-Command", cmd], capture_output=True, text=True, timeout=3)
    except Exception:
        pass


# 4. Native Dialog Bridge for pywebview JS API
# CRITICAL: Do NOT store the window object as a public attribute (e.g. self.window).
# pywebview's JS bridge generator recursively inspects all public non-callable attributes.
# WinForms Form has AccessibilityObject.Bounds.Empty.Empty... which creates an infinite
# reflection loop and freezes the application if exposed. Store as private self._window.
class DesktopBridge:
    def __init__(self):
        self._window = None

    def _set_window(self, win):
        self._window = win

    def pick_folder(self):
        """Open native Windows directory picker dialog for Load Unpacked."""
        if not self._window:
            return None
        try:
            res = self._window.create_file_dialog(webview.FOLDER_DIALOG)
            if res and len(res) > 0:
                selected = res[0]
                logger.info(f"Native folder selected: {selected}")
                return selected
        except Exception as e:
            logger.error(f"pick_folder error: {e}")
        return None

    def pick_crx_file(self):
        """Open native Windows file dialog for Install .crx and return base64 payload."""
        if not self._window:
            return None
        try:
            res = self._window.create_file_dialog(
                webview.OPEN_DIALOG,
                file_types=("Chromium Extension (*.crx)", "All files (*.*)")
            )
            if res and len(res) > 0:
                selected_path = res[0]
                if os.path.isfile(selected_path):
                    with open(selected_path, "rb") as f:
                        content = f.read()
                    logger.info(f"Native CRX file selected: {selected_path}")
                    return {
                        "file_name": os.path.basename(selected_path),
                        "file_data": base64.b64encode(content).decode("ascii")
                    }
        except Exception as e:
            logger.error(f"pick_crx_file error: {e}")
        return None


# 5. Server Lifecycle Management
PORT = web_ui_server.PORT


def ensure_server():
    if web_ui_server.server_already_running(PORT):
        logger.info(f"Backend HTTP server already responding on port {PORT}")
        return None

    try:
        server = web_ui_server.create_server(PORT)
        thread = threading.Thread(
            target=server.serve_forever,
            daemon=True,
            name="BackendServerThread"
        )
        thread.start()

        # Wait up to 3 seconds for server to be responsive
        for _ in range(30):
            if web_ui_server.server_already_running(PORT):
                break
            time.sleep(0.1)

        logger.info(f"Backend HTTP server started on http://127.0.0.1:{PORT}")
        return server
    except OSError as e:
        logger.error(f"Failed to start server on port {PORT}: {e}")
        return None


def main():
    acquired, mutex_handle = acquire_single_instance_mutex()
    if not acquired:
        existing_hwnd = find_existing_window()
        if existing_hwnd:
            logger.info("Another instance is already running. Focusing existing window and exiting.")
            focus_window(existing_hwnd)
            sys.exit(0)
        else:
            # Mutex flag present but no active window found (stale handle from unclean close). Proceed safely.
            logger.warning("Mutex detected without active window. Continuing startup.")

    server = ensure_server()

    bridge = DesktopBridge()
    icon_path = BASE_DIR / "app.ico"
    storage_path = DATA_DIR / "webview_cache"
    storage_path.mkdir(parents=True, exist_ok=True)
    cleanup_orphaned_webview(storage_path)

    window = webview.create_window(
        title="Anti's Detect Browser",
        url=f"http://127.0.0.1:{PORT}",
        js_api=bridge,
        width=1360,
        height=860,
        min_size=(960, 600),
        resizable=True,
        background_color="#F8FAFC"
    )
    bridge._set_window(window)

    try:
        logger.info("Starting pywebview GUI loop with Edge WebView2...")
        webview.start(
            gui="edgechromium",
            icon=str(icon_path) if icon_path.is_file() else None,
            private_mode=False,
            storage_path=str(storage_path)
        )
    finally:
        logger.info("Window closed. Cleaning up profiles and server...")
        try:
            web_ui_server.shutdown_all_profiles()
        except Exception as e:
            logger.error(f"Error shutting down profiles: {e}")
        if server:
            try:
                server.shutdown()
                server.server_close()
            except Exception as e:
                logger.error(f"Error closing server: {e}")
        if mutex_handle and sys.platform == "win32":
            try:
                ctypes.windll.kernel32.CloseHandle(mutex_handle)
            except Exception:
                pass
        cleanup_orphaned_webview(storage_path)
        sys.exit(0)


if __name__ == "__main__":
    main()
