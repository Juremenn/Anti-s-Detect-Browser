#!/usr/bin/env python3
"""
web_ui_server.py - Local web server and app-window launcher for the Profil Studio dashboard.
Binds to 127.0.0.1 only and rejects requests from other origins.
"""

import base64
import ctypes
import hashlib
import html
import io
import json
import os
import re
import secrets
import shutil
import struct
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
import zipfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple
from urllib.parse import parse_qs, urlencode, urlparse

from stealth_browser.consistency import evaluate as evaluate_consistency
from stealth_browser.fingerprint import resolve_overrides
from stealth_browser.launcher import StealthLauncher, discover_available_browsers
from stealth_browser.profile_manager import (
    HARDWARE_PRESETS,
    ProfileError,
    ProfileManager,
    account_hash_for_sub,
    get_account_dir,
    get_app_data_dir,
)
from stealth_browser import proxy_utils
from web_ui.cloud_sync import (
    CloudSyncManager,
    DRIVE_SCOPE,
    verify_access_token_has_drive_scope,
)
from web_ui.oauth_config import (
    OFFICIAL_GOOGLE_CLIENT_ID,
    OFFICIAL_GOOGLE_CLIENT_SECRET,
)

PORT = 58888
BUNDLE_ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
APP_DATA_ROOT = get_app_data_dir()
if getattr(sys, "frozen", False):
    ROOT = APP_DATA_ROOT
else:
    ROOT = Path(__file__).resolve().parent
WEB_DIR = BUNDLE_ROOT / "web_ui"
SETTINGS_FILE = ROOT / "app_settings.json"
ENV_FILE = ROOT / ".env"
PROXIES_FILE = ROOT / "proxies.json"
MAX_BODY = 50 * 1024 * 1024
CUSTOM_EXTENSIONS_FILE = ROOT / "data" / "custom_extensions.json"
CUSTOM_EXTENSIONS_DIR = ROOT / "data" / "custom-extensions"
AUTH_SESSION_FILE = ROOT / "data" / "auth_session.json"

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke"
GOOGLE_OAUTH_SCOPES = f"openid email profile {DRIVE_SCOPE}"
GOOGLE_CLIENT_ID_RE = re.compile(r"^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$")
OAUTH_STATE_TTL_SECONDS = 600
_PLACEHOLDER_OAUTH_VALUES = {"PASTE_YOUR_CLIENT_ID_HERE", "PASTE_YOUR_CLIENT_SECRET_HERE"}

DEFAULT_SETTINGS = {
    "browser_path": "",
    "start_url": "https://browserleaks.com/canvas",
    "mask_webrtc": True,
    "google_client_id": "",
    "google_client_secret": "",
}
ALLOWED_ORIGINS = {f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}"}

def load_custom_extensions() -> List[dict]:
    if not CUSTOM_EXTENSIONS_FILE.is_file():
        return []
    try:
        with open(CUSTOM_EXTENSIONS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception:
        return []

def save_custom_extensions(items: List[dict]):
    CUSTOM_EXTENSIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CUSTOM_EXTENSIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2)

def resolve_extension_icon(ext_dir: Path, manifest: dict) -> str:
    icons = manifest.get("icons") or {}
    default_icon = (manifest.get("action") or {}).get("default_icon")
    icon_rel = None
    if isinstance(icons, dict):
        for size in ("128", "48", "32", "16"):
            if size in icons and isinstance(icons[size], str):
                icon_rel = icons[size]
                break
    elif isinstance(icons, str):
        icon_rel = icons

    if not icon_rel and isinstance(default_icon, dict):
        for size in ("128", "48", "32", "16"):
            if size in default_icon and isinstance(default_icon[size], str):
                icon_rel = default_icon[size]
                break
    elif not icon_rel and isinstance(default_icon, str):
        icon_rel = default_icon

    if icon_rel:
        icon_path = ext_dir / icon_rel
        if icon_path.is_file():
            try:
                raw = icon_path.read_bytes()
                mime = "image/png"
                if icon_path.suffix.lower() == ".svg":
                    mime = "image/svg+xml"
                elif icon_path.suffix.lower() in (".jpg", ".jpeg"):
                    mime = "image/jpeg"
                b64 = base64.b64encode(raw).decode("ascii")
                return f"data:{mime};base64,{b64}"
            except Exception:
                pass
    return ""

def compute_extension_id_from_pubkey(pubkey_bytes: bytes) -> str:
    digest = hashlib.sha256(pubkey_bytes).digest()[:16]
    return "".join(chr(ord("a") + ((b >> 4) & 0x0F)) + chr(ord("a") + (b & 0x0F)) for b in digest)

def compute_fallback_id(name: str, path_str: str) -> str:
    norm = f"{name}:{path_str}".lower()
    digest = hashlib.sha256(norm.encode("utf-8")).digest()[:16]
    return "".join(chr(ord("a") + ((b >> 4) & 0x0F)) + chr(ord("a") + (b & 0x0F)) for b in digest)

profile_mgr = ProfileManager()
active_processes: Dict[str, subprocess.Popen] = {}
active_overrides: Dict[str, dict] = {}
proc_lock = threading.Lock()


def _load_dotenv_file() -> Dict[str, str]:
    values: Dict[str, str] = {}
    if not ENV_FILE.is_file():
        return values
    try:
        for raw_line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip()
            if len(val) >= 2 and ((val[0] == '"' and val[-1] == '"') or (val[0] == "'" and val[-1] == "'")):
                val = val[1:-1]
            if key:
                values[key] = val
    except OSError:
        pass
    return values


def _clean_oauth_value(val: Optional[str]) -> str:
    clean = str(val or "").strip()
    if not clean or clean in _PLACEHOLDER_OAUTH_VALUES:
        return ""
    return clean


def load_settings() -> dict:
    s = dict(DEFAULT_SETTINGS)
    try:
        if SETTINGS_FILE.exists():
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                stored = json.load(f)
            for k, v in stored.items():
                if k in ("google_client_id", "google_client_secret"):
                    cleaned = _clean_oauth_value(v)
                    if cleaned:
                        s[k] = cleaned
                elif k in DEFAULT_SETTINGS and v not in (None, ""):
                    s[k] = v
                elif k in ("browser_path", "start_url", "mask_webrtc") and k in stored:
                    s[k] = v
    except (OSError, ValueError):
        pass
    return s


def save_settings(settings_data: dict):
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings_data, f, indent=2)


def is_valid_google_client_id(client_id: str) -> bool:
    clean = _clean_oauth_value(client_id)
    if not clean:
        return False
    return bool(GOOGLE_CLIENT_ID_RE.match(clean))


def get_google_oauth_config() -> Tuple[str, str]:
    dotenv_vals = _load_dotenv_file()
    official_id = _clean_oauth_value(OFFICIAL_GOOGLE_CLIENT_ID)
    official_secret = _clean_oauth_value(OFFICIAL_GOOGLE_CLIENT_SECRET)

    override_id = _clean_oauth_value(settings.get("google_client_id"))
    env_id = _clean_oauth_value(os.environ.get("GOOGLE_CLIENT_ID")) or _clean_oauth_value(dotenv_vals.get("GOOGLE_CLIENT_ID"))
    client_id = override_id or env_id or official_id

    override_secret = _clean_oauth_value(settings.get("google_client_secret"))
    env_secret = _clean_oauth_value(os.environ.get("GOOGLE_CLIENT_SECRET")) or _clean_oauth_value(dotenv_vals.get("GOOGLE_CLIENT_SECRET"))
    client_secret = override_secret or env_secret or (official_secret if client_id == official_id else "")

    return client_id, client_secret


auth_lock = threading.Lock()
pending_oauth_states: Dict[str, dict] = {}
_last_auth_error: Optional[str] = None
_window_focus_callbacks: List[Callable[[], None]] = []


def register_window_focus_callback(cb: Callable[[], None]):
    if cb not in _window_focus_callbacks:
        _window_focus_callbacks.append(cb)


def focus_desktop_window() -> bool:
    """Restore and bring the native pywebview desktop window to the foreground after OAuth callback."""
    focused = False
    for cb in list(_window_focus_callbacks):
        try:
            cb()
            focused = True
        except Exception:
            pass
    if sys.platform != "win32":
        return focused
    try:
        user32 = ctypes.windll.user32
        hwnd = user32.FindWindowW(None, "Anti's Detect Browser")
        if not hwnd:
            return focused
        SW_RESTORE = 9
        HWND_TOPMOST = -1
        HWND_NOTOPMOST = -2
        SWP_NOSIZE = 0x0001
        SWP_NOMOVE = 0x0002
        SWP_SHOWWINDOW = 0x0040
        if user32.IsIconic(hwnd):
            user32.ShowWindow(hwnd, SW_RESTORE)
        user32.SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
        user32.SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
        user32.SetForegroundWindow(hwnd)
        focused = True
    except Exception:
        pass
    return focused


def _decode_jwt_payload(jwt_token: str) -> dict:
    try:
        parts = jwt_token.split(".")
        if len(parts) != 3:
            return {}
        payload_b64 = parts[1]
        padding = "=" * ((4 - len(payload_b64) % 4) % 4)
        raw = base64.urlsafe_b64decode((payload_b64 + padding).encode("ascii"))
        data = json.loads(raw.decode("utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def load_auth_session() -> Optional[dict]:
    if not AUTH_SESSION_FILE.is_file():
        return None
    try:
        with open(AUTH_SESSION_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return None
        if not data.get("sub") or not data.get("email"):
            return None
        return data
    except Exception:
        return None


def save_auth_session(session_data: dict):
    AUTH_SESSION_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp_file = AUTH_SESSION_FILE.with_suffix(".json.tmp")
    with open(tmp_file, "w", encoding="utf-8") as f:
        json.dump(session_data, f, indent=2)
    os.replace(tmp_file, AUTH_SESSION_FILE)


def clear_auth_session():
    try:
        if AUTH_SESSION_FILE.is_file():
            AUTH_SESSION_FILE.unlink()
    except OSError:
        pass


def _session_has_drive_scope(session: Optional[dict]) -> bool:
    if not session:
        return False
    scope_str = str(session.get("scope") or "").strip()
    if not scope_str:
        return False
    return DRIVE_SCOPE in scope_str.split()


def _refresh_google_token(session: dict) -> Optional[dict]:
    """Use stored refresh_token to obtain a fresh access_token when expired."""
    refresh_token = str(session.get("refresh_token") or "").strip()
    if not refresh_token:
        return None
    client_id, client_secret = get_google_oauth_config()
    if not is_valid_google_client_id(client_id):
        return session
    payload = {
        "client_id": client_id,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }
    if client_secret:
        payload["client_secret"] = client_secret
    body = urlencode(payload).encode("utf-8")
    req = urllib.request.Request(
        GOOGLE_TOKEN_ENDPOINT,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            token_data = json.loads(resp.read().decode("utf-8"))
        access_token = token_data.get("access_token")
        if not access_token:
            return session
        expires_in = int(token_data.get("expires_in") or 3600)
        session["access_token"] = access_token
        session["expires_at"] = int(time.time() + expires_in)
        if token_data.get("refresh_token"):
            session["refresh_token"] = token_data["refresh_token"]
        if token_data.get("scope"):
            session["scope"] = str(token_data["scope"]).strip()
        if token_data.get("id_token"):
            claims = _decode_jwt_payload(token_data["id_token"])
            if claims.get("name"):
                session["name"] = claims["name"]
            if claims.get("picture"):
                session["picture"] = claims["picture"]
        save_auth_session(session)
        return session
    except urllib.error.HTTPError as e:
        if e.code in (400, 401):
            clear_auth_session()
            return None
        return session
    except Exception:
        # Preserve local desktop session on transient offline startup
        return session


account_lock = threading.RLock()
_active_account_sub: Optional[str] = None
_active_account_dir: Optional[Path] = None
_cloud_sync: Optional[CloudSyncManager] = None


def _get_valid_drive_access_token(force_refresh: bool = False) -> Optional[str]:
    """Return a valid Google OAuth access token for the currently active account."""
    with auth_lock:
        session = load_auth_session()
        if not session or session.get("sub") != _active_account_sub:
            return None
        if not _session_has_drive_scope(session):
            return None
        expires_at = float(session.get("expires_at") or 0)
        if force_refresh or time.time() >= expires_at - 60:
            if session.get("refresh_token"):
                refreshed = _refresh_google_token(session)
                if not refreshed:
                    return None
                session = refreshed
            elif time.time() >= expires_at:
                return None
        return str(session.get("access_token") or "").strip() or None


def migrate_legacy_data_to_account(
    sub: str,
    account_dir: Path,
    base_data_dir: Optional[Path] = None,
    legacy_roots: Optional[List[Path]] = None,
) -> bool:
    """Move unscoped legacy profiles, proxies, and extensions into the first logged-in account."""
    accounts_root = (Path(base_data_dir) if base_data_dir is not None else APP_DATA_ROOT) / "accounts"
    accounts_root.mkdir(parents=True, exist_ok=True)
    marker_file = accounts_root / ".legacy_migrated.json"
    if marker_file.is_file():
        return False

    if legacy_roots is None:
        roots = [APP_DATA_ROOT]
        if ROOT.resolve() != APP_DATA_ROOT.resolve():
            roots.append(ROOT)
    else:
        roots = list(legacy_roots)

    dest_profiles = account_dir / "profiles"
    dest_trash = dest_profiles / ".trash"
    dest_profiles.mkdir(parents=True, exist_ok=True)
    dest_ext_dir = account_dir / "custom-extensions"
    dest_ext_dir.mkdir(parents=True, exist_ok=True)

    migrated_items: List[str] = []

    for legacy_root in roots:
        # 1. Legacy profiles + trash + templates
        legacy_profiles = legacy_root / "profiles"
        if legacy_profiles.is_dir():
            for entry in list(legacy_profiles.iterdir()):
                if entry.name == ".trash" and entry.is_dir():
                    for t_entry in list(entry.iterdir()):
                        if t_entry.is_dir() and (t_entry / "config.json").is_file():
                            dest_trash.mkdir(parents=True, exist_ok=True)
                            target_t = dest_trash / t_entry.name
                            if not target_t.exists():
                                shutil.move(str(t_entry), str(target_t))
                                migrated_items.append(f"trash:{t_entry.name}")
                elif entry.name == ".templates.json" and entry.is_file():
                    try:
                        old_tpls = json.loads(entry.read_text(encoding="utf-8"))
                        if isinstance(old_tpls, list) and old_tpls:
                            dest_tpl_file = dest_profiles / ".templates.json"
                            cur_tpls = []
                            if dest_tpl_file.is_file():
                                cur_tpls = json.loads(dest_tpl_file.read_text(encoding="utf-8"))
                                if not isinstance(cur_tpls, list):
                                    cur_tpls = []
                            existing_names = {t.get("name") for t in cur_tpls if isinstance(t, dict)}
                            for tpl in old_tpls:
                                if isinstance(tpl, dict) and tpl.get("name") not in existing_names:
                                    cur_tpls.append(tpl)
                            dest_tpl_file.write_text(json.dumps(cur_tpls, indent=2), encoding="utf-8")
                            migrated_items.append("templates")
                    except Exception:
                        pass
                elif not entry.name.startswith(".") and entry.is_dir() and (entry / "config.json").is_file():
                    target_p = dest_profiles / entry.name
                    if not target_p.exists():
                        shutil.move(str(entry), str(target_p))
                        try:
                            cfg = json.loads((target_p / "config.json").read_text(encoding="utf-8"))
                            cfg["user_data_dir"] = str((target_p / "UserData").resolve())
                            cfg.setdefault("updated_at", int(time.time() * 1000))
                            (target_p / "config.json").write_text(json.dumps(cfg, indent=2), encoding="utf-8")
                        except Exception:
                            pass
                        migrated_items.append(f"profile:{entry.name}")

        # 2. Legacy proxies.json
        legacy_proxies = legacy_root / "proxies.json"
        if legacy_proxies.is_file():
            try:
                old_proxies = json.loads(legacy_proxies.read_text(encoding="utf-8"))
                if isinstance(old_proxies, list) and old_proxies:
                    dest_proxies_file = account_dir / "proxies.json"
                    cur_proxies = []
                    if dest_proxies_file.is_file():
                        cur_proxies = json.loads(dest_proxies_file.read_text(encoding="utf-8"))
                        if not isinstance(cur_proxies, list):
                            cur_proxies = []
                    seen_urls = {p.get("url") for p in cur_proxies if isinstance(p, dict) and p.get("url")}
                    for prx in old_proxies:
                        if isinstance(prx, dict) and prx.get("url") and prx["url"] not in seen_urls:
                            cur_proxies.append(prx)
                            seen_urls.add(prx["url"])
                    dest_proxies_file.write_text(json.dumps(cur_proxies, indent=2), encoding="utf-8")
                    legacy_proxies.unlink(missing_ok=True)
                    migrated_items.append("proxies")
            except Exception:
                pass

        # 3. Legacy custom extensions
        legacy_ext_file = legacy_root / "data" / "custom_extensions.json"
        legacy_ext_dir = legacy_root / "data" / "custom-extensions"
        if legacy_ext_file.is_file():
            try:
                old_exts = json.loads(legacy_ext_file.read_text(encoding="utf-8"))
                if isinstance(old_exts, list) and old_exts:
                    dest_ext_file = account_dir / "custom_extensions.json"
                    cur_exts = []
                    if dest_ext_file.is_file():
                        cur_exts = json.loads(dest_ext_file.read_text(encoding="utf-8"))
                        if not isinstance(cur_exts, list):
                            cur_exts = []
                    seen_ids = {e.get("id") for e in cur_exts if isinstance(e, dict)}
                    for ext in old_exts:
                        if not isinstance(ext, dict):
                            continue
                        ext_copy = dict(ext)
                        old_path_str = str(ext_copy.get("path") or "")
                        if old_path_str and legacy_ext_dir.is_dir():
                            try:
                                old_p = Path(old_path_str).resolve()
                                if str(old_p).startswith(str(legacy_ext_dir.resolve())) and old_p.is_dir():
                                    new_ext_sub = dest_ext_dir / old_p.name
                                    if not new_ext_sub.exists():
                                        shutil.move(str(old_p), str(new_ext_sub))
                                    ext_copy["path"] = str(new_ext_sub.resolve())
                            except Exception:
                                pass
                        if ext_copy.get("id") not in seen_ids:
                            cur_exts.append(ext_copy)
                            seen_ids.add(ext_copy.get("id"))
                    dest_ext_file.write_text(json.dumps(cur_exts, indent=2), encoding="utf-8")
                    legacy_ext_file.unlink(missing_ok=True)
                    migrated_items.append("custom_extensions")
            except Exception:
                pass

    marker_payload = {
        "migrated_to_sub_hash": account_hash_for_sub(sub),
        "migrated_at": int(time.time()),
        "items": migrated_items,
    }
    marker_file.write_text(json.dumps(marker_payload, indent=2), encoding="utf-8")
    return True


def _activate_account_workspace(session: dict, trigger_pull: bool = True):
    """Bind storage paths, ProfileManager, StealthLauncher, and CloudSyncManager to session['sub']."""
    global PROXIES_FILE, CUSTOM_EXTENSIONS_FILE, CUSTOM_EXTENSIONS_DIR
    global _active_account_sub, _active_account_dir, _cloud_sync

    sub = str(session.get("sub") or "").strip()
    if not sub:
        return

    has_drive = _session_has_drive_scope(session)
    with account_lock:
        if _active_account_sub == sub and _cloud_sync is not None:
            _cloud_sync.set_drive_authorized(has_drive)
            if trigger_pull and has_drive:
                threading.Thread(target=_cloud_sync.sync_now, daemon=True).start()
            return

        if _cloud_sync is not None:
            _cloud_sync.stop()
            _cloud_sync = None

        acct_dir = get_account_dir(sub, APP_DATA_ROOT)
        migrate_legacy_data_to_account(sub, acct_dir, base_data_dir=APP_DATA_ROOT)

        _active_account_sub = sub
        _active_account_dir = acct_dir
        PROXIES_FILE = acct_dir / "proxies.json"
        CUSTOM_EXTENSIONS_FILE = acct_dir / "custom_extensions.json"
        CUSTOM_EXTENSIONS_DIR = acct_dir / "custom-extensions"

        profiles_dir = acct_dir / "profiles"
        profile_mgr.set_profiles_dir(profiles_dir)
        launcher.set_account_paths(profiles_dir=profiles_dir, custom_extensions_file=CUSTOM_EXTENSIONS_FILE)

        sync_mgr = CloudSyncManager(
            google_sub=sub,
            account_dir=acct_dir,
            proxies_file=PROXIES_FILE,
            token_provider=_get_valid_drive_access_token,
            is_profile_running_fn=running,
            drive_authorized=has_drive,
        )
        _cloud_sync = sync_mgr

    if trigger_pull and has_drive:
        def _verify_and_pull():
            tok = _get_valid_drive_access_token(False)
            if tok:
                verified = verify_access_token_has_drive_scope(tok)
                if verified is False:
                    sync_mgr.set_drive_authorized(False)
                    return
            sync_mgr.sync_pull()

        threading.Thread(target=_verify_and_pull, daemon=True).start()


def _detach_account_workspace():
    """Stop cloud sync worker and clear active in-memory account bindings on Sign Out."""
    global PROXIES_FILE, CUSTOM_EXTENSIONS_FILE, CUSTOM_EXTENSIONS_DIR
    global _active_account_sub, _active_account_dir, _cloud_sync

    with account_lock:
        if _cloud_sync is not None:
            _cloud_sync.stop()
            _cloud_sync = None
        _active_account_sub = None
        _active_account_dir = None
        PROXIES_FILE = ROOT / "proxies.json"
        CUSTOM_EXTENSIONS_FILE = ROOT / "data" / "custom_extensions.json"
        CUSTOM_EXTENSIONS_DIR = ROOT / "data" / "custom-extensions"
        profile_mgr.set_profiles_dir(ROOT / "profiles")
        launcher.set_account_paths(profiles_dir=ROOT / "profiles", custom_extensions_file=CUSTOM_EXTENSIONS_FILE)


def get_authenticated_user() -> Optional[dict]:
    """Return verified session user dict, refreshing token automatically if expired."""
    with auth_lock:
        session = load_auth_session()
        if not session:
            return None
        expires_at = float(session.get("expires_at") or 0)
        now = time.time()
        if now >= expires_at - 60:
            if session.get("refresh_token"):
                session = _refresh_google_token(session)
                if not session:
                    return None
            elif now >= expires_at:
                clear_auth_session()
                return None
    _activate_account_workspace(session, trigger_pull=True)
    return {
        "sub": str(session.get("sub") or ""),
        "name": str(session.get("name") or session.get("email") or ""),
        "email": str(session.get("email") or ""),
        "picture": str(session.get("picture") or ""),
    }


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
_engine_version_cache = {"path": None, "version": ""}


def _get_file_version_win(filepath: str) -> str:
    try:
        import ctypes
        size = ctypes.windll.version.GetFileVersionInfoSizeW(filepath, None)
        if not size:
            return ""
        res = ctypes.create_string_buffer(size)
        if not ctypes.windll.version.GetFileVersionInfoW(filepath, 0, size, res):
            return ""
        ptr = ctypes.c_void_p()
        length = ctypes.c_uint()
        if ctypes.windll.version.VerQueryValueW(res, "\\", ctypes.byref(ptr), ctypes.byref(length)):
            vals = (ctypes.c_uint * 13).from_address(ptr.value)
            ms, ls = vals[2], vals[3]
            return f"{ms >> 16}.{ms & 0xffff}.{ls >> 16}.{ls & 0xffff}"
    except Exception:
        pass
    return ""


def detect_engine_version() -> str:
    """'131.0.6778.85' from binary version info; cached per binary path."""
    path = launcher.chrome_path
    if not path:
        return ""
    if _engine_version_cache["path"] == path:
        return _engine_version_cache["version"]
    version = ""
    if os.name == "nt":
        version = _get_file_version_win(path)
    if not version:
        try:
            out = subprocess.run([path, "--version"], capture_output=True, text=True,
                                 timeout=2, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            for token in (out.stdout or "").split():
                if token and token[0].isdigit() and "." in token:
                    version = token
                    break
        except (OSError, subprocess.SubprocessError):
            pass
    _engine_version_cache.update({"path": path, "version": version})
    return version


def kill_tree(proc: subprocess.Popen):
    """Chrome spawns child processes; terminating only the parent can leave them holding UserData."""
    if proc.poll() is not None:
        return
    if os.name == "nt":
        si = subprocess.STARTUPINFO()
        si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        si.wShowWindow = 0  # SW_HIDE
        subprocess.run(
            ["taskkill", "/PID", str(proc.pid), "/T", "/F"],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            startupinfo=si,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000),
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


def _handle_profile_exited(name: str):
    """Run post-close cleanup, update timestamps, and notify cloud sync when a browser exits."""
    time.sleep(0.3)
    prof = None
    try:
        prof = profile_mgr.get_profile(name, create_if_missing=False)
        _apply_on_close(prof)
        prof = profile_mgr.touch_profile(name, last_used=True) or prof
    except (ProfileError, OSError):
        pass
    sync_mgr = _cloud_sync
    if sync_mgr is not None:
        sync_mgr.on_profile_stopped(name, (prof or {}).get("uuid"))


def prune_processes():
    exited: List[str] = []
    with proc_lock:
        for name in [n for n, p in active_processes.items() if p.poll() is not None]:
            del active_processes[name]
            active_overrides.pop(name, None)
            exited.append(name)
    for name in exited:
        threading.Thread(target=_handle_profile_exited, args=(name,), daemon=True).start()


def stop_profile(name: str) -> bool:
    with proc_lock:
        proc = active_processes.pop(name, None)
        active_overrides.pop(name, None)
    if proc and proc.poll() is None:
        kill_tree(proc)
        # Give Chrome a beat to release file locks before touching UserData.
        _handle_profile_exited(name)
        return True
    return False


_watcher_started = False


def _start_process_watcher():
    global _watcher_started
    if _watcher_started:
        return
    _watcher_started = True

    def _watch_loop():
        while True:
            time.sleep(2.0)
            try:
                prune_processes()
            except Exception:
                pass

    threading.Thread(target=_watch_loop, daemon=True).start()


_CACHE_DIR_NAMES = (
    "Cache", "Code Cache", "GPUCache", "ShaderCache",
    "GrShaderCache", "GraphiteDawnCache", "Media Cache",
)

def _apply_on_close(profile: dict):
    """Wipe storage after a clean stop, per the profile's on_close choice."""
    mode = profile.get("on_close", "keep")
    if mode not in ("clear_cache", "clear_all"):
        return
    user_data = Path(profile["user_data_dir"])
    if mode == "clear_cache":
        # Render cache lives under Default; shader caches sit at the root.
        bases = [user_data / "Default", user_data]
        for base in bases:
            for d in _CACHE_DIR_NAMES:
                shutil.rmtree(base / d, ignore_errors=True)
    elif mode == "clear_all":
        shutil.rmtree(user_data, ignore_errors=True)
        user_data.mkdir(parents=True, exist_ok=True)


def proxy_country_for(profile: dict) -> Optional[str]:
    """Country of the profile's proxy, matched by exact URL against the saved
    proxy list (or resolved from local GeoIP DB if the proxy host is an IP)."""
    proxy = (profile.get("proxy") or "").strip()
    if not proxy:
        return None
    for entry in load_proxies():
        if isinstance(entry, dict) and entry.get("url") == proxy:
            if entry.get("country"):
                return entry.get("country")
    try:
        parsed = proxy_utils.parse_proxy_string(proxy)
        geo = proxy_utils.geoip_country(parsed.get("host") or "")
        if geo.get("country"):
            return geo["country"]
    except Exception:
        pass
    return None


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

    def _send_html(self, html_content: str, status: int = 200):
        payload = html_content.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _error(self, message: str, status: int = 400):
        self._send_json({"error": message}, status=status)

    def _same_origin(self) -> bool:
        active_port = self.server.server_address[1] if hasattr(self, "server") and self.server else PORT
        allowed = set(ALLOWED_ORIGINS) | {f"http://127.0.0.1:{active_port}", f"http://localhost:{active_port}"}
        origin = self.headers.get("Origin")
        if origin is not None:
            return origin in allowed
        return self.headers.get("Host", "") in {o.split("//", 1)[1] for o in allowed}

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

        # OAuth 2.0 loopback redirect from Google in external browser
        if path == "/api/auth/google/callback":
            return self._run(self._auth_google_callback)

        if path == "/api/auth/status":
            if not self._same_origin():
                return self._error("Origin tidak diizinkan.", 403)
            return self._run(self._auth_status)

        routes = {
            "/api/profiles": self._get_profiles,
            "/api/trash": lambda: self._send_json({"items": profile_mgr.list_trash()}),
            "/api/settings": self._get_settings,
            "/api/presets": self._get_presets,
            "/api/proxies": lambda: self._send_json({"proxies": load_proxies()}),
            "/api/templates": lambda: self._send_json({"templates": profile_mgr.list_templates()}),
            "/api/extensions": self._get_extensions,
            "/api/extensions/health_check": self._health_check_extensions,
            "/api/extensions/config": self._get_extension_config,
            "/api/profiles/detail": self._profile_detail,
            "/api/sync/status": self._get_sync_status,
            "/api/geoip/status": lambda: self._send_json({
                "db": (proxy_utils.find_mmdb().name if proxy_utils.find_mmdb() else None)}),
        }
        if path.startswith("/api/"):
            if not self._same_origin():
                return self._error("Origin tidak diizinkan.", 403)
            if not get_authenticated_user():
                return self._send_json({"error": "Authentication required.", "authenticated": False}, status=401)
            if path in routes:
                return self._run(routes[path])
            return self._error("Endpoint tidak ditemukan.", 404)

        if path == "/selfcheck":
            # Served from the repo root, not web_ui/ (the vite build empties it).
            return self._serve_selfcheck()
        super().do_GET()

    def _serve_selfcheck(self):
        file = BUNDLE_ROOT / "selfcheck.html"
        if not file.is_file():
            file = ROOT / "selfcheck.html"
        if not file.is_file():
            return self._error("selfcheck.html tidak ditemukan.", 404)
        body = file.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        path = urlparse(self.path).path
        if not self._same_origin():
            return self._error("Origin tidak diizinkan.", 403)
        if "application/json" not in (self.headers.get("Content-Type") or ""):
            return self._error("Content-Type harus application/json.", 415)

        auth_routes = {
            "/api/auth/config": self._auth_config,
            "/api/auth/google/start": self._auth_google_start,
            "/api/auth/google/cancel": self._auth_google_cancel,
            "/api/auth/focus": self._auth_focus,
            "/api/auth/logout": self._auth_logout,
        }
        if path in auth_routes:
            return self._run(lambda: auth_routes[path](self._read_body()))

        if not get_authenticated_user():
            return self._send_json({"error": "Authentication required.", "authenticated": False}, status=401)

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
            "/api/proxies/parse": self._parse_proxies,
            "/api/proxies/check": self._check_proxy,
            "/api/templates/save": self._save_template,
            "/api/templates/delete": self._delete_template,
            "/api/extensions/toggle": self._toggle_extension,
            "/api/extensions/config": self._save_extension_config,
            "/api/extensions/install_crx": self._install_crx,
            "/api/extensions/load_unpacked": self._load_unpacked,
            "/api/extensions/reload": self._reload_extension,
            "/api/extensions/remove": self._remove_extension,
            "/api/extensions/open_folder": self._open_extension_folder,
            "/api/profiles/validate": self._validate_profile,
            "/api/sync/now": self._sync_now,
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

    # --- OAuth 2.0 + PKCE handlers ---------------------------------------------

    def _prune_pending_oauth_states(self):
        now = time.time()
        expired = [
            st for st, info in pending_oauth_states.items()
            if now - float(info.get("created_at") or 0) > OAUTH_STATE_TTL_SECONDS
        ]
        for st in expired:
            pending_oauth_states.pop(st, None)

    def _auth_status(self):
        client_id, client_secret = get_google_oauth_config()
        configured = is_valid_google_client_id(client_id)
        user = get_authenticated_user()
        with auth_lock:
            self._prune_pending_oauth_states()
            pending = len(pending_oauth_states) > 0
            last_error = _last_auth_error
        self._send_json({
            "authenticated": user is not None,
            "configured": configured,
            "user": user,
            "client_id": client_id if configured else "",
            "has_client_secret": bool(client_secret),
            "pending": pending,
            "last_error": last_error,
        })

    def _auth_config(self, data: dict):
        global _last_auth_error
        raw_client_id = str(data.get("google_client_id") or "").strip()
        if not is_valid_google_client_id(raw_client_id):
            raise ProfileError("Invalid Google OAuth Client ID. Must end with .apps.googleusercontent.com.")

        settings["google_client_id"] = raw_client_id
        if "google_client_secret" in data and data.get("google_client_secret") is not None:
            settings["google_client_secret"] = str(data.get("google_client_secret") or "").strip()

        save_settings(settings)
        with auth_lock:
            _last_auth_error = None
        self._send_json({
            "status": "ok",
            "configured": True,
            "client_id": raw_client_id,
            "has_client_secret": bool(settings.get("google_client_secret")),
        })

    def _auth_google_start(self, data: dict):
        global _last_auth_error
        client_id, _ = get_google_oauth_config()
        if not is_valid_google_client_id(client_id):
            raise ProfileError("Google OAuth Client ID is not configured.")

        state = secrets.token_urlsafe(32)
        code_verifier = secrets.token_urlsafe(64)
        digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
        code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")

        active_port = self.server.server_address[1] if hasattr(self, "server") and self.server else PORT
        redirect_uri = f"http://127.0.0.1:{active_port}/api/auth/google/callback"

        with auth_lock:
            self._prune_pending_oauth_states()
            pending_oauth_states[state] = {
                "code_verifier": code_verifier,
                "redirect_uri": redirect_uri,
                "created_at": time.time(),
            }
            _last_auth_error = None

        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": GOOGLE_OAUTH_SCOPES,
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            "access_type": "offline",
            "prompt": "select_account consent",
        }
        auth_url = f"{GOOGLE_AUTH_ENDPOINT}?{urlencode(params)}"

        if data.get("open_browser", True) is not False:
            try:
                webbrowser.open(auth_url, new=2)
            except Exception:
                pass

        self._send_json({
            "auth_url": auth_url,
            "state": state,
            "redirect_uri": redirect_uri,
        })

    def _auth_google_cancel(self, _data: dict):
        global _last_auth_error
        with auth_lock:
            pending_oauth_states.clear()
            _last_auth_error = None
        self._send_json({"status": "canceled"})

    def _auth_focus(self, _data: dict):
        focused = focus_desktop_window()
        self._send_json({"focused": bool(focused)})

    def _render_oauth_callback_html(
        self,
        success: bool,
        title: str,
        message: str,
        account_email: str = "",
    ) -> str:
        safe_title = html.escape(title)
        safe_message = html.escape(message)
        safe_email = html.escape(account_email.strip()) if account_email else ""
        if success and safe_email:
            body_html = (
                f'Signed in as <strong class="account">{safe_email}</strong>. '
                "Return to Anti's Detect Browser to continue."
            )
        else:
            body_html = safe_message

        status_icon_bg = "#F0FDF4" if success else "#FEF2F2"
        status_icon_border = "#BBF7D0" if success else "#FECACA"
        status_icon_color = "#15803D" if success else "#B91C1C"
        status_icon_svg = (
            '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">'
            '<path d="M4.5 10.5L8.2 14.2L15.5 6.5" stroke="currentColor" stroke-width="2.2" '
            'stroke-linecap="round" stroke-linejoin="round"/></svg>'
            if success
            else '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">'
            '<path d="M10 6.2V10.6M10 13.8H10.01" stroke="currentColor" stroke-width="2.2" '
            'stroke-linecap="round"/><circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.6"/></svg>'
        )
        auto_close_js = "true" if success else "false"
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{safe_title} - Anti's Detect Browser</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%235B4FE9'/%3E%3Cpath d='M16 5.5L25 9.5V16.2C25 21.6 21.1 25.9 16 27.5C10.9 25.9 7 21.6 7 16.2V9.5L16 5.5Z' stroke='%23FFF' stroke-width='1.8' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E" />
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #F8FAFC;
      color: #0F172A;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 20px 16px;
      -webkit-font-smoothing: antialiased;
    }}
    main {{
      width: 100%;
      max-width: 400px;
    }}
    .card {{
      width: 100%;
      background: #FFFFFF;
      border: 1px solid #DCE1EB;
      border-radius: 14px;
      box-shadow: 0 16px 36px -12px rgba(15, 23, 42, 0.08);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }}
    .brand {{
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding-bottom: 16px;
      border-bottom: 1px solid #E5E7EB;
    }}
    .logo {{
      width: 28px;
      height: 28px;
      flex-shrink: 0;
      display: block;
    }}
    .brand-name {{
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      letter-spacing: -0.01em;
    }}
    .status-block {{
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 10px;
    }}
    .status-icon {{
      width: 36px;
      height: 36px;
      border-radius: 9999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: {status_icon_color};
      background-color: {status_icon_bg};
      border: 1px solid {status_icon_border};
    }}
    h1 {{
      font-size: 18px;
      font-weight: 600;
      line-height: 1.3;
      color: #0F172A;
      letter-spacing: -0.02em;
    }}
    .message {{
      font-size: 13.5px;
      line-height: 1.55;
      color: #475569;
      overflow-wrap: anywhere;
    }}
    .account {{
      color: #0F172A;
      font-weight: 600;
    }}
    .actions {{
      display: flex;
      flex-direction: column;
      gap: 10px;
    }}
    button.btn-primary {{
      width: 100%;
      min-height: 44px;
      padding: 10px 16px;
      border-radius: 8px;
      border: 1px solid #4B3FD8;
      background-color: #5B4FE9;
      color: #FFFFFF;
      font-family: inherit;
      font-size: 13.5px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 140ms ease-out, transform 80ms ease-out;
    }}
    button.btn-primary:hover:not(:disabled) {{
      background-color: #4B3FD8;
    }}
    button.btn-primary:active:not(:disabled) {{
      background-color: #4338CA;
      transform: translateY(1px);
    }}
    button.btn-primary:focus-visible {{
      outline: 2px solid #5B4FE9;
      outline-offset: 2px;
    }}
    button.btn-primary:disabled {{
      opacity: 0.7;
      cursor: not-allowed;
    }}
    .hint {{
      font-size: 12px;
      line-height: 1.5;
      color: #475569;
      text-align: center;
    }}
    .hint-ok {{
      color: #15803D;
      font-weight: 500;
    }}
    .hint-err {{
      color: #B91C1C;
    }}
    kbd {{
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      border: 1px solid #CBD5E1;
      background-color: #F8FAFC;
      color: #0F172A;
      font-family: inherit;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.4;
    }}
    @media (prefers-reduced-motion: reduce) {{
      button.btn-primary {{
        transition: none;
      }}
      button.btn-primary:active:not(:disabled) {{
        transform: none;
      }}
    }}
  </style>
</head>
<body>
  <main>
    <section class="card" aria-labelledby="callback-heading">
      <header class="brand">
        <svg class="logo" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect width="32" height="32" rx="8" fill="#5B4FE9" />
          <path d="M16 5.5L25 9.5V16.2C25 21.6 21.1 25.9 16 27.5C10.9 25.9 7 21.6 7 16.2V9.5L16 5.5Z" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round" fill="rgba(255,255,255,0.12)" />
          <path d="M16 10.5L11.5 21.5M16 10.5L20.5 21.5M13.2 17.8H18.8" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="16" cy="14.2" r="1.4" fill="#A5F3FC" />
        </svg>
        <span class="brand-name">Anti's Detect Browser</span>
      </header>

      <div class="status-block">
        <span class="status-icon" aria-hidden="true">{status_icon_svg}</span>
        <h1 id="callback-heading">{safe_title}</h1>
        <p class="message">{body_html}</p>
      </div>

      <div class="actions">
        <button type="button" id="return-btn" class="btn-primary">Return to Anti's Detect Browser</button>
        <p id="action-status" class="hint" role="status" aria-live="polite">Close this browser tab anytime with <kbd id="close-mod">Ctrl</kbd> + <kbd>W</kbd>.</p>
      </div>
    </section>
  </main>
  <script>
    (function() {{
      var isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
      var modEl = document.getElementById('close-mod');
      if (modEl && isMac) modEl.textContent = 'Cmd';
      var shortcutText = isMac ? 'Cmd + W' : 'Ctrl + W';

      var canScriptClose = Boolean(window.opener);
      var autoClose = {auto_close_js};
      if (autoClose && canScriptClose) {{
        setTimeout(function() {{
          try {{ window.close(); }} catch (e) {{}}
        }}, 250);
      }}

      var btn = document.getElementById('return-btn');
      var statusEl = document.getElementById('action-status');
      if (!btn || !statusEl) return;

      btn.addEventListener('click', function() {{
        if (window.opener) {{
          try {{
            window.close();
            return;
          }} catch (e) {{}}
        }}

        btn.disabled = true;
        btn.textContent = "Switching to Anti's Detect Browser...";
        statusEl.className = 'hint';
        statusEl.textContent = 'Bringing the app window to the front...';

        fetch('/api/auth/focus', {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json' }},
          body: '{{}}'
        }})
          .then(function(res) {{
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
          }})
          .then(function(data) {{
            if (data && data.focused) {{
              btn.disabled = false;
              btn.textContent = "Return to Anti's Detect Browser";
              statusEl.className = 'hint hint-ok';
              statusEl.textContent = 'App window focused. Press ' + shortcutText + ' to close this browser tab.';
            }} else {{
              window.location.replace('/');
            }}
          }})
          .catch(function() {{
            btn.disabled = false;
            btn.textContent = "Return to Anti's Detect Browser";
            statusEl.className = 'hint hint-err';
            statusEl.textContent = "Could not focus the app window automatically. Switch to Anti's Detect Browser and press " + shortcutText + ' to close this tab.';
          }});
      }});
    }})();
  </script>
</body>
</html>"""

    def _auth_google_callback(self):
        global _last_auth_error
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        state = (qs.get("state") or [""])[0].strip()
        code = (qs.get("code") or [""])[0].strip()
        oauth_error = (qs.get("error") or [""])[0].strip()

        if oauth_error:
            err_desc = (qs.get("error_description") or [oauth_error])[0]
            with auth_lock:
                if state:
                    pending_oauth_states.pop(state, None)
                _last_auth_error = f"Google sign-in failed: {err_desc}"
            threading.Thread(target=focus_desktop_window, daemon=True).start()
            return self._send_html(
                self._render_oauth_callback_html(
                    False,
                    "Sign-In Canceled",
                    f"Google returned an error ({oauth_error}). Return to Anti's Detect Browser to try again.",
                ),
                status=400,
            )

        with auth_lock:
            self._prune_pending_oauth_states()
            pending = pending_oauth_states.pop(state, None) if state else None

        if not pending or not code:
            with auth_lock:
                _last_auth_error = "Invalid or expired OAuth state parameter. Please try signing in again."
            threading.Thread(target=focus_desktop_window, daemon=True).start()
            return self._send_html(
                self._render_oauth_callback_html(
                    False,
                    "Verification Failed",
                    "Invalid or expired authentication state token. Return to Anti's Detect Browser and try again.",
                ),
                status=400,
            )

        client_id, client_secret = get_google_oauth_config()
        token_params = {
            "client_id": client_id,
            "code": code,
            "code_verifier": pending["code_verifier"],
            "grant_type": "authorization_code",
            "redirect_uri": pending["redirect_uri"],
        }
        if client_secret:
            token_params["client_secret"] = client_secret

        req = urllib.request.Request(
            GOOGLE_TOKEN_ENDPOINT,
            data=urlencode(token_params).encode("utf-8"),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                token_data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_body = ""
            try:
                err_body = e.read().decode("utf-8", errors="replace")
                err_json = json.loads(err_body)
                detail = err_json.get("error_description") or err_json.get("error") or err_body
            except Exception:
                detail = err_body or str(e)
            if "client_secret" in str(detail).lower():
                friendly = "Google requires the OAuth Client Secret for this Desktop Client ID. Add your Client Secret in the setup box."
            else:
                friendly = f"Token exchange failed: {detail}"
            with auth_lock:
                _last_auth_error = friendly
            threading.Thread(target=focus_desktop_window, daemon=True).start()
            return self._send_html(
                self._render_oauth_callback_html(False, "Authentication Error", friendly),
                status=400,
            )
        except Exception as e:
            with auth_lock:
                _last_auth_error = f"Unable to reach Google OAuth token endpoint: {e}"
            threading.Thread(target=focus_desktop_window, daemon=True).start()
            return self._send_html(
                self._render_oauth_callback_html(
                    False,
                    "Network Error",
                    f"Unable to reach Google OAuth token server ({e}). Check your network connection.",
                ),
                status=502,
            )

        access_token = str(token_data.get("access_token") or "").strip()
        id_token = str(token_data.get("id_token") or "").strip()
        id_claims = _decode_jwt_payload(id_token) if id_token else {}

        if id_claims:
            iss = id_claims.get("iss")
            aud = id_claims.get("aud")
            exp = float(id_claims.get("exp") or 0)
            if iss not in ("https://accounts.google.com", "accounts.google.com") or aud != client_id or exp < time.time() - 60:
                with auth_lock:
                    _last_auth_error = "Google ID token verification failed (audience or issuer mismatch)."
                threading.Thread(target=focus_desktop_window, daemon=True).start()
                return self._send_html(
                    self._render_oauth_callback_html(
                        False,
                        "Verification Error",
                        "Google ID token verification failed. Please try signing in again.",
                    ),
                    status=400,
                )

        userinfo = {}
        if access_token:
            try:
                u_req = urllib.request.Request(
                    GOOGLE_USERINFO_ENDPOINT,
                    headers={"Authorization": f"Bearer {access_token}"},
                    method="GET",
                )
                with urllib.request.urlopen(u_req, timeout=8) as u_resp:
                    userinfo = json.loads(u_resp.read().decode("utf-8"))
            except Exception:
                userinfo = {}

        sub = str(userinfo.get("sub") or id_claims.get("sub") or "").strip()
        email = str(userinfo.get("email") or id_claims.get("email") or "").strip()
        name = str(userinfo.get("name") or id_claims.get("name") or (email.split("@")[0] if email else "")).strip()
        picture = str(userinfo.get("picture") or id_claims.get("picture") or "").strip()

        if not sub or not email:
            with auth_lock:
                _last_auth_error = "Could not verify Google account identity (missing sub or email)."
            threading.Thread(target=focus_desktop_window, daemon=True).start()
            return self._send_html(
                self._render_oauth_callback_html(
                    False,
                    "Profile Verification Failed",
                    "Google did not return a valid account email and subject identifier.",
                ),
                status=400,
            )

        with auth_lock:
            existing = load_auth_session()
            refresh_token = str(token_data.get("refresh_token") or "").strip()
            if not refresh_token and existing and existing.get("sub") == sub:
                refresh_token = str(existing.get("refresh_token") or "").strip()
            granted_scope = str(token_data.get("scope") or "").strip()
            if not granted_scope and existing and existing.get("sub") == sub:
                granted_scope = str(existing.get("scope") or "").strip()
            expires_in = int(token_data.get("expires_in") or 3600)
            session_obj = {
                "sub": sub,
                "email": email,
                "name": name,
                "picture": picture,
                "scope": granted_scope,
                "access_token": access_token,
                "refresh_token": refresh_token,
                "expires_at": int(time.time() + expires_in),
                "authenticated_at": int(time.time()),
            }
            save_auth_session(session_obj)
            pending_oauth_states.clear()
            _last_auth_error = None

        _activate_account_workspace(session_obj, trigger_pull=True)

        def _delayed_focus():
            time.sleep(0.15)
            focus_desktop_window()

        threading.Thread(target=_delayed_focus, daemon=True).start()

        return self._send_html(
            self._render_oauth_callback_html(
                True,
                "Authentication Complete",
                "Authentication complete. You can close this tab and return to Anti's Detect Browser.",
                account_email=email,
            ),
            status=200,
        )

    def _auth_logout(self, _data: dict):
        global _last_auth_error
        # Best-effort background sync flush before clearing auth_session.json
        sync_mgr = _cloud_sync
        if sync_mgr is not None:
            try:
                sync_mgr.flush_before_logout(timeout=4.0)
            except Exception:
                pass

        with auth_lock:
            session = load_auth_session()
            clear_auth_session()
            pending_oauth_states.clear()
            _last_auth_error = None

        _detach_account_workspace()

        if session:
            token_to_revoke = str(session.get("refresh_token") or session.get("access_token") or "").strip()
            if token_to_revoke:
                def _revoke_async(tok: str):
                    try:
                        rev_req = urllib.request.Request(
                            f"{GOOGLE_REVOKE_ENDPOINT}?{urlencode({'token': tok})}",
                            data=b"",
                            headers={"Content-Type": "application/x-www-form-urlencoded"},
                            method="POST",
                        )
                        urllib.request.urlopen(rev_req, timeout=2).close()
                    except Exception:
                        pass

                threading.Thread(target=_revoke_async, args=(token_to_revoke,), daemon=True).start()

        self._send_json({"status": "logged_out", "authenticated": False})

    # --- cloud sync handlers ---------------------------------------------------

    def _get_sync_status(self):
        if _cloud_sync is None:
            return self._send_json({
                "state": "idle",
                "last_synced_at": None,
                "synced_profiles_count": 0,
                "error_message": None,
                "pending_changes": False,
                "drive_authorized": False,
            })
        self._send_json(_cloud_sync.get_status())

    def _sync_now(self, _data: dict):
        if _cloud_sync is None:
            raise ProfileError("Cloud sync is unavailable while signed out.")
        result = _cloud_sync.sync_now()
        self._send_json({"status": "ok", **result})

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

    def _get_presets(self):
        import re
        eng = detect_engine_version()
        major = eng.split(".")[0] if eng and eng[0].isdigit() else ""
        out = []
        for p in HARDWARE_PRESETS:
            item = dict(p)
            if major and item.get("user_agent"):
                item["user_agent"] = re.sub(r"Chrome/\d+\.", f"Chrome/{major}.", str(item["user_agent"]))
            out.append(item)
        self._send_json({"presets": out})

    def _get_settings(self):
        public_settings = {k: v for k, v in settings.items() if k != "google_client_secret"}
        self._send_json({
            **public_settings,
            "has_client_secret": bool(settings.get("google_client_secret")),
            "active_browser_path": launcher.chrome_path,
            "engine_version": detect_engine_version(),
            "browsers": discover_available_browsers(),
            "geoip_db": (proxy_utils.find_mmdb().name if proxy_utils.find_mmdb() else None),
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
        launcher.__init__(
            browser_path=browser_path or None,
            profiles_dir=profile_mgr.profiles_dir,
            custom_extensions_file=CUSTOM_EXTENSIONS_FILE,
        )
        self._get_settings()

    def _start(self, data: dict):
        name = data.get("name")
        profile = profile_mgr.get_profile(name, create_if_missing=False)
        if not launcher.chrome_path:
            raise ProfileError("Browser Chromium/Chrome/Edge tidak ditemukan. Atur path-nya di Settings.")
        # Resolve "based on proxy" values from the proxy's country, and score
        # the identity once so the UI can warn about inconsistencies at launch.
        country = proxy_country_for(profile)
        overrides = resolve_overrides(profile, country)
        consistency = evaluate_consistency(
            profile, engine_version=detect_engine_version(), proxy_country=country)
        with proc_lock:
            if running(name):
                return self._send_json({"status": "already_running", "pid": active_processes[name].pid})
            active_overrides[name] = overrides
            proc = launcher.launch(profile_name=name, target_url=data.get("url") or settings["start_url"],
                                   overrides=overrides)
            active_processes[name] = proc
        _start_process_watcher()
        self._send_json({"status": "started", "pid": proc.pid, "consistency": consistency})

    def _stop(self, data: dict):
        self._send_json({"status": "stopped" if stop_profile(data.get("name")) else "not_running"})

    def _create(self, data: dict):
        import re
        eng = detect_engine_version()
        major = eng.split(".")[0] if eng and eng[0].isdigit() else ""
        created = profile_mgr.create_profile(
            name=data.get("name"),
            preset_index=data.get("preset", 0),
            proxy=data.get("proxy"),
            tags=data.get("tags"),
            folder=data.get("folder", ""),
            notes=data.get("notes", ""),
            diversify=bool(data.get("diversify", True)),
            custom=data.get("custom"),
            extra=data.get("extra"),
        )
        if major and created.get("user_agent") and not (data.get("custom") or {}).get("user_agent"):
            fixed_ua = re.sub(r"Chrome/\d+\.", f"Chrome/{major}.", str(created["user_agent"]))
            if fixed_ua != created["user_agent"]:
                created = profile_mgr.set_fingerprint(created["name"], {"user_agent": fixed_ua})
        if _cloud_sync is not None:
            _cloud_sync.schedule_push()
        self._send_json({"status": "created", "profile": created})

    def _refresh_fingerprint(self, data: dict):
        name = data.get("name")
        profile_mgr.get_profile(name, create_if_missing=False)
        if running(name):
            raise ProfileError("Hentikan profil yang sedang berjalan sebelum regenerate identitas.")
        keep_cookies = bool(data.get("keep_cookies", False))
        profile = profile_mgr.refresh_fingerprint(name, keep_cookies=keep_cookies)
        if _cloud_sync is not None:
            _cloud_sync.schedule_push()
        self._send_json({"status": "refreshed", "profile": profile})

    def _profile_detail(self):
        """Full stored config + launch-resolved values for the self-check page."""
        query = parse_qs(urlparse(self.path).query)
        name = (query.get("name") or [""])[0]
        profile = profile_mgr.get_profile(name, create_if_missing=False)
        overrides = active_overrides.get(name) or resolve_overrides(profile, proxy_country_for(profile))
        self._send_json({**profile, "_overrides": overrides})

    def _set_fingerprint(self, data: dict):
        name = data.get("name")
        profile_mgr.get_profile(name, create_if_missing=False)
        if running(name):
            raise ProfileError("Hentikan profil yang sedang berjalan sebelum mengubah fingerprint.")
        profile = profile_mgr.set_fingerprint(name, data.get("fields") or {})
        if _cloud_sync is not None:
            _cloud_sync.schedule_push()
        self._send_json({"status": "updated", "profile": profile})

    def _update(self, data: dict):
        """Split incoming fields: fingerprint keys are validated strictly and
        refused while the profile runs; other keys are simple settings."""
        name = data.get("name")
        fields = dict(data.get("fields") or {})
        new_name = fields.pop("name", None)
        if new_name and new_name != name:
            if running(name):
                raise ProfileError("Hentikan profil yang sedang berjalan sebelum mengubah nama.")
            profile_mgr.rename_profile(name, new_name)
            name = new_name

        fingerprint_keys = {"platform", "webgl_vendor", "webgl_renderer", "user_agent",
                            "hardware_concurrency", "device_memory", "screen_width",
                            "screen_height", "color_depth", "languages"}
        fp_fields = {k: fields.pop(k) for k in list(fields) if k in fingerprint_keys}
        if fp_fields:
            if running(name):
                raise ProfileError("Hentikan profil yang sedang berjalan sebelum mengubah fingerprint.")
            profile_mgr.set_fingerprint(name, fp_fields)
        updated = profile_mgr.update_profile(name, fields)
        if _cloud_sync is not None:
            _cloud_sync.schedule_push()
        self._send_json({"status": "updated", "profile": updated})

    def _validate_profile(self, data: dict):
        fields = data.get("fields") or {}
        result = evaluate_consistency(
            fields,
            engine_version=detect_engine_version(),
            proxy_country=data.get("proxy_country"),
        )
        self._send_json(result)

    def _delete(self, data: dict):
        names = data.get("names") or ([data.get("name")] if data.get("name") else [])
        if not names:
            raise ProfileError("Pilih minimal satu profil untuk dihapus.")
        trashed, errors = [], []
        for name in names:
            try:
                stop_profile(name)
                prof_uuid = ""
                try:
                    prof_uuid = str(profile_mgr.get_profile(name, create_if_missing=False).get("uuid") or "")
                except Exception:
                    pass
                profile_mgr.trash_profile(name)
                if _cloud_sync is not None and prof_uuid:
                    _cloud_sync.record_profile_deleted(prof_uuid, name)
                trashed.append(name)
            except (ProfileError, OSError) as e:
                errors.append(f"{name}: {e}")
        if not trashed and errors:
            raise ProfileError("; ".join(errors))
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
        if imported and _cloud_sync is not None:
            _cloud_sync.schedule_push()
        self._send_json({"status": "imported", "imported": imported, "errors": errors})

    def _restore(self, data: dict):
        restored = profile_mgr.restore_profile(data.get("trash_id"))
        if _cloud_sync is not None and restored.get("uuid"):
            _cloud_sync.record_profile_restored(str(restored["uuid"]))
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
        parsed = {}
        try:
            parsed = proxy_utils.parse_proxy_string(proxy_url)
        except proxy_utils.ProxyError:
            pass  # keep the raw string; the dialog's parse step surfaces errors
        proxies = load_proxies()
        new_entry = {
            "id": f"prx_{int(time.time() * 1000)}",
            "title": title or proxy_url,
            "url": proxy_url,
            "added_at": int(time.time()),
            **{k: parsed[k] for k in ("type", "host", "port", "username", "password") if parsed},
            **{k: data.get(k) for k in ("country", "latency", "status", "exit_ip") if data.get(k) is not None},
        }
        proxies.append(new_entry)
        save_proxies(proxies)
        if _cloud_sync is not None:
            _cloud_sync.record_proxies_updated()
        self._send_json({"status": "added", "proxy": new_entry})

    def _delete_proxy(self, data: dict):
        proxy_id = data.get("id")
        proxies = load_proxies()
        filtered = [p for p in proxies if p.get("id") != proxy_id]
        save_proxies(filtered)
        if _cloud_sync is not None:
            _cloud_sync.record_proxies_updated()
        self._send_json({"status": "deleted"})

    def _parse_proxies(self, data: dict):
        lines = data.get("text") or ""
        parsed, errors = [], []
        for i, line in enumerate(str(lines).splitlines()):
            line = line.strip()
            if not line:
                continue
            try:
                item = proxy_utils.parse_proxy_string(line)
                item["line"] = i + 1
                parsed.append(item)
            except proxy_utils.ProxyError as e:
                errors.append({"line": i + 1, "error": str(e)})
        self._send_json({"parsed": parsed, "errors": errors})

    def _check_proxy(self, data: dict):
        raw = str(data.get("url") or "").strip()
        if not raw:
            raise ProfileError("Alamat proxy wajib diisi.")
        result = proxy_utils.check_proxy(raw)
        if result.get("ok") and result.get("ip"):
            geo = proxy_utils.geoip_country(result["ip"])
            result["country"] = geo["country"] or result.get("country")
            result["geo_source"] = geo["source"]
        self._send_json(result)

    def _save_template(self, data: dict):
        name = data.get("name")
        source_name = data.get("profile")
        if source_name:
            profile = profile_mgr.get_profile(source_name, create_if_missing=False)
        elif isinstance(data.get("config"), dict):
            profile = data["config"]
        else:
            raise ProfileError("Template butuh profil sumber atau konfigurasi.")
        entry = profile_mgr.save_template(name, profile, data.get("description", ""))
        self._send_json({"status": "saved", "template": entry})

    def _delete_template(self, data: dict):
        deleted = profile_mgr.delete_template(data.get("id"))
        self._send_json({"status": "deleted" if deleted else "not_found"})

    def _get_extensions(self):
        extensions = load_custom_extensions()
        updated = False
        for ext in extensions:
            p = Path(ext.get("path", ""))
            manifest_p = p / "manifest.json"
            config_p = p / "config.json"
            is_configurable = config_p.is_file()
            if ext.get("configurable") != is_configurable:
                ext["configurable"] = is_configurable
                updated = True

            if p.is_dir() and manifest_p.is_file():
                if ext.get("status") != "ready":
                    ext["status"] = "ready"
                    updated = True
            else:
                if ext.get("status") != "missing":
                    ext["status"] = "missing"
                    updated = True
        if updated:
            save_custom_extensions(extensions)
        self._send_json({"extensions": extensions})

    def _health_check_extensions(self):
        return self._get_extensions()

    def _get_extension_config(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        ext_id = qs.get("id", [""])[0]
        if not ext_id:
            return self._error("Parameter 'id' is required.", 400)

        extensions = load_custom_extensions()
        ext = next((e for e in extensions if e.get("id") == ext_id), None)
        if not ext:
            return self._error(f"Extension '{ext_id}' not found.", 404)

        folder = Path(ext.get("path", ""))
        config_file = folder / "config.json"
        presets_file = folder / "presets.json"

        cfg = {}
        if config_file.is_file():
            try:
                cfg = json.loads(config_file.read_text(encoding="utf-8"))
            except Exception as e:
                return self._error(f"Failed to read config.json: {e}", 500)

        presets = []
        if presets_file.is_file():
            try:
                presets = json.loads(presets_file.read_text(encoding="utf-8"))
            except Exception:
                pass

        self._send_json({"status": "ok", "config": cfg, "presets": presets})

    def _save_extension_config(self, data: dict):
        ext_id = data.get("id")
        new_config = data.get("config")
        if not ext_id or not isinstance(new_config, dict):
            return self._error("id and config dictionary are required.", 400)

        extensions = load_custom_extensions()
        ext = next((e for e in extensions if e.get("id") == ext_id), None)
        if not ext:
            return self._error(f"Extension '{ext_id}' not found.", 404)

        folder = Path(ext.get("path", ""))
        config_file = folder / "config.json"
        if not folder.is_dir():
            return self._error(f"Extension directory not found: {folder}", 404)

        try:
            config_file.write_text(json.dumps(new_config, indent=2), encoding="utf-8")
            self._send_json({"status": "ok", "config": new_config})
        except Exception as e:
            self._error(f"Failed to write config.json: {e}", 500)

    def _toggle_extension(self, data: dict):
        ext_id = data.get("id")
        enabled = bool(data.get("enabled", True))
        extensions = load_custom_extensions()
        found = False
        for ext in extensions:
            if ext.get("id") == ext_id:
                ext["enabled"] = enabled
                found = True
                break
        if found:
            save_custom_extensions(extensions)
            self._send_json({"status": "ok", "id": ext_id, "enabled": enabled})
        else:
            self._error(f"Extension '{ext_id}' not found.", 404)

    def _install_crx(self, data: dict):
        file_name = data.get("file_name") or data.get("fileName") or "extension.crx"
        file_data_b64 = data.get("file_data") or data.get("fileData") or ""
        if not file_data_b64:
            return self._error("file_data is required.", 400)

        try:
            if "," in file_data_b64:
                file_data_b64 = file_data_b64.split(",", 1)[1]
            raw_data = base64.b64decode(file_data_b64)
        except Exception as e:
            return self._error(f"Failed to decode base64 file data: {e}", 400)

        pubkey_bytes = b""
        if raw_data.startswith(b"Cr24"):
            version = struct.unpack("<I", raw_data[4:8])[0]
            if version == 3:
                header_len = struct.unpack("<I", raw_data[8:12])[0]
                zip_offset = 12 + header_len
            elif version == 2:
                pub_len = struct.unpack("<I", raw_data[8:12])[0]
                sig_len = struct.unpack("<I", raw_data[12:16])[0]
                pubkey_bytes = raw_data[16:16+pub_len]
                zip_offset = 16 + pub_len + sig_len
            else:
                zip_offset = raw_data.find(b"PK\x03\x04")
        else:
            zip_offset = raw_data.find(b"PK\x03\x04")

        if zip_offset == -1 or zip_offset >= len(raw_data):
            return self._error("Invalid CRX archive: ZIP signature not found.", 400)

        zip_bytes = raw_data[zip_offset:]
        try:
            zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
        except Exception as e:
            return self._error(f"Invalid ZIP payload: {e}", 400)

        manifest_entry = None
        for name in zf.namelist():
            if name.lower() == "manifest.json":
                manifest_entry = name
                break
        if not manifest_entry:
            return self._error("Invalid extension: manifest.json missing inside archive.", 400)

        try:
            manifest = json.loads(zf.read(manifest_entry).decode("utf-8"))
        except Exception as e:
            return self._error(f"Failed to parse manifest.json: {e}", 400)

        ext_name = manifest.get("name", Path(file_name).stem)
        if pubkey_bytes:
            ext_id = compute_extension_id_from_pubkey(pubkey_bytes)
        else:
            sanitized = re.sub(r"[^a-z0-9_-]", "-", ext_name.lower()).strip("-")
            ext_id = sanitized or "custom-extension"

        CUSTOM_EXTENSIONS_DIR.mkdir(parents=True, exist_ok=True)
        dest_dir = CUSTOM_EXTENSIONS_DIR / ext_id
        if dest_dir.exists():
            shutil.rmtree(dest_dir, ignore_errors=True)
        dest_dir.mkdir(parents=True, exist_ok=True)

        for member in zf.namelist():
            target_path = (dest_dir / member).resolve()
            if not str(target_path).startswith(str(dest_dir.resolve())):
                continue
            if member.endswith("/") or member.endswith("\\"):
                target_path.mkdir(parents=True, exist_ok=True)
            else:
                target_path.parent.mkdir(parents=True, exist_ok=True)
                with open(target_path, "wb") as f_out:
                    f_out.write(zf.read(member))

        icon_data = resolve_extension_icon(dest_dir, manifest)
        entry = {
            "id": ext_id,
            "name": ext_name,
            "version": manifest.get("version", "1.0.0"),
            "description": manifest.get("description", ""),
            "enabled": True,
            "source_type": "crx",
            "path": str(dest_dir.resolve()),
            "manifest_version": manifest.get("manifest_version", 3),
            "permissions": manifest.get("permissions", []),
            "icon_url": icon_data,
            "status": "ready",
            "configurable": (dest_dir / "config.json").is_file()
        }

        extensions = load_custom_extensions()
        existing_idx = next((i for i, e in enumerate(extensions) if e.get("id") == ext_id), None)
        if existing_idx is not None:
            entry["enabled"] = extensions[existing_idx].get("enabled", True)
            extensions[existing_idx] = entry
        else:
            extensions.append(entry)
        save_custom_extensions(extensions)

        self._send_json({"status": "ok", "extension": entry})

    def _load_unpacked(self, data: dict):
        raw_path = (data.get("path") or "").strip()
        if not raw_path:
            return self._error("Folder path is required.", 400)

        folder = Path(raw_path).resolve()
        if not folder.is_dir():
            return self._error(f"Directory not found: {folder}", 404)

        manifest_file = folder / "manifest.json"
        if not manifest_file.is_file():
            return self._error(f"manifest.json not found in: {folder}", 400)

        try:
            manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
        except Exception as e:
            return self._error(f"Failed to parse manifest.json: {e}", 400)

        ext_name = manifest.get("name", folder.name)
        ext_id = compute_fallback_id(ext_name, str(folder))
        icon_data = resolve_extension_icon(folder, manifest)

        entry = {
            "id": ext_id,
            "name": ext_name,
            "version": manifest.get("version", "1.0.0"),
            "description": manifest.get("description", ""),
            "enabled": True,
            "source_type": "unpacked",
            "path": str(folder),
            "manifest_version": manifest.get("manifest_version", 3),
            "permissions": manifest.get("permissions", []),
            "icon_url": icon_data,
            "status": "ready",
            "configurable": (folder / "config.json").is_file()
        }

        extensions = load_custom_extensions()
        existing_idx = next((i for i, e in enumerate(extensions) if e.get("path") == str(folder) or e.get("id") == ext_id), None)
        if existing_idx is not None:
            entry["enabled"] = extensions[existing_idx].get("enabled", True)
            extensions[existing_idx] = entry
        else:
            extensions.append(entry)
        save_custom_extensions(extensions)

        self._send_json({"status": "ok", "extension": entry})

    def _reload_extension(self, data: dict):
        ext_id = data.get("id")
        extensions = load_custom_extensions()
        existing = next((e for e in extensions if e.get("id") == ext_id), None)
        if not existing:
            return self._error(f"Extension '{ext_id}' not found.", 404)

        folder = Path(existing.get("path", ""))
        manifest_file = folder / "manifest.json"
        if not folder.is_dir() or not manifest_file.is_file():
            existing["status"] = "missing"
            save_custom_extensions(extensions)
            return self._send_json({"status": "ok", "extension": existing})

        try:
            manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
            existing["name"] = manifest.get("name", existing.get("name"))
            existing["version"] = manifest.get("version", existing.get("version"))
            existing["description"] = manifest.get("description", existing.get("description"))
            existing["manifest_version"] = manifest.get("manifest_version", existing.get("manifest_version"))
            existing["permissions"] = manifest.get("permissions", existing.get("permissions"))
            existing["icon_url"] = resolve_extension_icon(folder, manifest)
            existing["status"] = "ready"
            save_custom_extensions(extensions)
            self._send_json({"status": "ok", "extension": existing})
        except Exception as e:
            return self._error(f"Failed to reload extension: {e}", 400)

    def _remove_extension(self, data: dict):
        ext_id = data.get("id")
        extensions = load_custom_extensions()
        existing = next((e for e in extensions if e.get("id") == ext_id), None)
        if not existing:
            return self._error(f"Extension '{ext_id}' not found.", 404)

        if existing.get("source_type") == "crx":
            dest_dir = Path(existing.get("path", ""))
            if dest_dir.is_dir() and str(dest_dir.resolve()).startswith(str(CUSTOM_EXTENSIONS_DIR.resolve())):
                shutil.rmtree(dest_dir, ignore_errors=True)

        extensions = [e for e in extensions if e.get("id") != ext_id]
        save_custom_extensions(extensions)
        self._send_json({"status": "ok", "id": ext_id})

    def _open_extension_folder(self, data: dict):
        ext_id = data.get("id")
        extensions = load_custom_extensions()
        existing = next((e for e in extensions if e.get("id") == ext_id), None)
        if not existing:
            return self._error(f"Extension '{ext_id}' not found.", 404)

        folder = Path(existing.get("path", ""))
        if not folder.exists():
            return self._error(f"Folder does not exist on disk: {folder}", 404)

        try:
            if sys.platform == "win32":
                subprocess.Popen(["explorer.exe", str(folder.resolve())])
            elif sys.platform == "darwin":
                subprocess.Popen(["open", str(folder.resolve())])
            else:
                subprocess.Popen(["xdg-open", str(folder.resolve())])
            self._send_json({"status": "ok"})
        except Exception as e:
            self._error(f"Failed to open folder: {e}", 500)


def launch_in_app_window(port: int):
    """Open the dashboard as an app window (no tabs or address bar) and disable dev infobars."""
    browser_bin = launcher.chrome_path
    url = f"http://127.0.0.1:{port}"
    if not browser_bin:
        print(f"[!] Tidak ada browser Chromium. Buka {url} secara manual.")
        return
    env = os.environ.copy()
    env["GOOGLE_API_KEY"] = "no"
    env["GOOGLE_DEFAULT_CLIENT_ID"] = "no"
    env["GOOGLE_DEFAULT_CLIENT_SECRET"] = "no"
    subprocess.Popen([
        browser_bin,
        f"--app={url}",
        "--window-size=1360,860",
        "--test-type",
        "--disable-infobars",
        "--disable-features=TranslateUI",
        "--no-first-run",
        "--no-default-browser-check"
    ], env=env)


def server_already_running(port: int) -> bool:
    try:
        req = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/auth/status",
            headers={"Host": f"127.0.0.1:{port}"}
        )
        with urllib.request.urlopen(req, timeout=1) as r:
            return r.status == 200
    except Exception:
        return False


def create_server(port: int = PORT) -> ThreadingHTTPServer:
    _start_process_watcher()
    return ThreadingHTTPServer(("127.0.0.1", port), DashboardHandler)


def shutdown_all_profiles():
    with proc_lock:
        names = list(active_processes.keys())
    for name in names:
        try:
            stop_profile(name)
        except Exception:
            pass


def main():
    try:
        server = create_server(PORT)
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
        shutdown_all_profiles()
        server.server_close()


if __name__ == "__main__":
    main()
