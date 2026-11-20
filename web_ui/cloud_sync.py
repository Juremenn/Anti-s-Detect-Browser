"""
cloud_sync.py - Client-side AES-256-GCM encrypted Google Drive appDataFolder sync engine.

Handles:
1. Deterministic per-account AES-256-GCM encryption derived from Google `sub` + app salt.
2. Smart selective Chromium profile archiving (essential cookies/storage/preferences/extensions
   included; heavy disposable caches and crash dumps strictly excluded).
3. Google Drive REST API v3 client scoped to `spaces=appDataFolder`.
4. Conflict-safe bidirectional sync (`sync_pull`, `sync_push`, `sync_now`), debounced background
   pushes, and active-browser protection (defers pulls for running profiles until browser exit).
"""

from __future__ import annotations

import ctypes
from ctypes import wintypes
import hashlib
import io
import json
import os
import re
import shutil
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

DRIVE_FILES_API = "https://www.googleapis.com/drive/v3/files"
DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files"
GOOGLE_TOKENINFO_API = "https://oauth2.googleapis.com/tokeninfo"
DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata"

ARCHIVE_MAGIC = b"ADB1"
NONCE_SIZE = 12
TAG_SIZE = 16
PBKDF2_ITERATIONS = 200_000
MAX_SINGLE_FILE_BYTES = 25 * 1024 * 1024  # 25 MB safety cap per non-cookie file

MANIFEST_REMOTE_NAME = "sync_manifest.enc"
MANIFEST_LOCAL_NAME = "sync_manifest.json"

# Essential Chromium UserData relative files (case-insensitive normalized on Windows)
ESSENTIAL_USERDATA_FILES = {
    "local state",
    "default/cookies",
    "default/cookies-journal",
    "default/network/cookies",
    "default/network/cookies-journal",
    "default/preferences",
    "default/secure preferences",
    "default/login data",
    "default/login data-journal",
    "default/web data",
    "default/web data-journal",
    "default/bookmarks",
    "default/favicons",
    "default/favicons-journal",
}

ESSENTIAL_USERDATA_PREFIXES = (
    "default/local storage/",
    "default/session storage/",
    "default/extension state/",
    "default/local extension settings/",
    "default/sync extension settings/",
    "default/indexeddb/",
)

EXCLUDED_DIR_PARTS = {
    "cache",
    "code cache",
    "gpucache",
    "shadercache",
    "grshadercache",
    "graphitedawncache",
    "media cache",
    "cachestorage",
    "scriptcache",
    "crashpad",
    "crash_dumps",
    "browsermetrics",
    "blob_storage",
    "dawncache",
    "optimizationguidepredictionmodels",
    "safe browsing",
}

EXCLUDED_FILE_NAMES = {
    "lock",
    "singletonlock",
    "singletonsocket",
    "singletoncookie",
}


# ---------------------------------------------------------------------------
# AES-256-GCM Encryption (Windows CNG bcrypt.dll + optional cryptography)
# ---------------------------------------------------------------------------


class _BcryptAesGcm:
    """Zero-dependency AES-256-GCM using Windows CNG (bcrypt.dll)."""

    _BCRYPT_AES_ALGORITHM = "AES"
    _BCRYPT_CHAINING_MODE = "ChainingMode"
    _BCRYPT_CHAIN_MODE_GCM = "ChainingModeGCM"
    _BCRYPT_OBJECT_LENGTH = "ObjectLength"

    class _AUTH_INFO(ctypes.Structure):
        _fields_ = [
            ("cbSize", ctypes.c_ulong),
            ("dwInfoVersion", ctypes.c_ulong),
            ("pbNonce", ctypes.c_void_p),
            ("cbNonce", ctypes.c_ulong),
            ("pbAuthData", ctypes.c_void_p),
            ("cbAuthData", ctypes.c_ulong),
            ("pbTag", ctypes.c_void_p),
            ("cbTag", ctypes.c_ulong),
            ("pbMacContext", ctypes.c_void_p),
            ("cbMacContext", ctypes.c_ulong),
            ("cbAAD", ctypes.c_ulong),
            ("cbData", ctypes.c_uint64),
            ("dwFlags", ctypes.c_ulong),
        ]

    def __init__(self):
        self._bcrypt = ctypes.WinDLL("bcrypt.dll")
        self._configure_signatures()

    def _configure_signatures(self):
        b = self._bcrypt
        b.BCryptOpenAlgorithmProvider.argtypes = [
            ctypes.POINTER(wintypes.HANDLE),
            wintypes.LPCWSTR,
            wintypes.LPCWSTR,
            wintypes.ULONG,
        ]
        b.BCryptOpenAlgorithmProvider.restype = ctypes.c_long

        b.BCryptCloseAlgorithmProvider.argtypes = [wintypes.HANDLE, wintypes.ULONG]
        b.BCryptCloseAlgorithmProvider.restype = ctypes.c_long

        b.BCryptSetProperty.argtypes = [
            wintypes.HANDLE,
            wintypes.LPCWSTR,
            ctypes.c_void_p,
            wintypes.ULONG,
            wintypes.ULONG,
        ]
        b.BCryptSetProperty.restype = ctypes.c_long

        b.BCryptGetProperty.argtypes = [
            wintypes.HANDLE,
            wintypes.LPCWSTR,
            ctypes.c_void_p,
            wintypes.ULONG,
            ctypes.POINTER(wintypes.ULONG),
            wintypes.ULONG,
        ]
        b.BCryptGetProperty.restype = ctypes.c_long

        b.BCryptGenerateSymmetricKey.argtypes = [
            wintypes.HANDLE,
            ctypes.POINTER(wintypes.HANDLE),
            ctypes.c_void_p,
            wintypes.ULONG,
            ctypes.c_void_p,
            wintypes.ULONG,
            wintypes.ULONG,
        ]
        b.BCryptGenerateSymmetricKey.restype = ctypes.c_long

        b.BCryptDestroyKey.argtypes = [wintypes.HANDLE]
        b.BCryptDestroyKey.restype = ctypes.c_long

        b.BCryptEncrypt.argtypes = [
            wintypes.HANDLE,
            ctypes.c_void_p,
            wintypes.ULONG,
            ctypes.c_void_p,
            ctypes.c_void_p,
            wintypes.ULONG,
            ctypes.c_void_p,
            wintypes.ULONG,
            ctypes.POINTER(wintypes.ULONG),
            wintypes.ULONG,
        ]
        b.BCryptEncrypt.restype = ctypes.c_long

        b.BCryptDecrypt.argtypes = [
            wintypes.HANDLE,
            ctypes.c_void_p,
            wintypes.ULONG,
            ctypes.c_void_p,
            ctypes.c_void_p,
            wintypes.ULONG,
            ctypes.c_void_p,
            wintypes.ULONG,
            ctypes.POINTER(wintypes.ULONG),
            wintypes.ULONG,
        ]
        b.BCryptDecrypt.restype = ctypes.c_long

    def _open_gcm_key(self, key: bytes) -> Tuple[wintypes.HANDLE, wintypes.HANDLE, ctypes.Array]:
        h_alg = wintypes.HANDLE()
        status = self._bcrypt.BCryptOpenAlgorithmProvider(
            ctypes.byref(h_alg), self._BCRYPT_AES_ALGORITHM, None, 0
        )
        if status != 0:
            raise OSError(f"BCryptOpenAlgorithmProvider failed: 0x{status & 0xFFFFFFFF:08X}")

        try:
            mode_buf = ctypes.create_unicode_buffer(self._BCRYPT_CHAIN_MODE_GCM)
            status = self._bcrypt.BCryptSetProperty(
                h_alg,
                self._BCRYPT_CHAINING_MODE,
                mode_buf,
                ctypes.sizeof(mode_buf),
                0,
            )
            if status != 0:
                raise OSError(f"BCryptSetProperty(ChainingModeGCM) failed: 0x{status & 0xFFFFFFFF:08X}")

            obj_len = wintypes.ULONG(0)
            cb_res = wintypes.ULONG(0)
            status = self._bcrypt.BCryptGetProperty(
                h_alg,
                self._BCRYPT_OBJECT_LENGTH,
                ctypes.byref(obj_len),
                ctypes.sizeof(obj_len),
                ctypes.byref(cb_res),
                0,
            )
            if status != 0:
                raise OSError(f"BCryptGetProperty(ObjectLength) failed: 0x{status & 0xFFFFFFFF:08X}")

            key_obj_buf = ctypes.create_string_buffer(obj_len.value)
            key_buf = ctypes.create_string_buffer(key, len(key))
            h_key = wintypes.HANDLE()
            status = self._bcrypt.BCryptGenerateSymmetricKey(
                h_alg,
                ctypes.byref(h_key),
                key_obj_buf,
                obj_len.value,
                key_buf,
                len(key),
                0,
            )
            if status != 0:
                raise OSError(f"BCryptGenerateSymmetricKey failed: 0x{status & 0xFFFFFFFF:08X}")
            return h_alg, h_key, key_obj_buf
        except Exception:
            self._bcrypt.BCryptCloseAlgorithmProvider(h_alg, 0)
            raise

    def encrypt(self, key: bytes, nonce: bytes, plaintext: bytes, aad: bytes) -> Tuple[bytes, bytes]:
        h_alg, h_key, _key_obj = self._open_gcm_key(key)
        try:
            nonce_buf = ctypes.create_string_buffer(nonce, len(nonce))
            tag_buf = ctypes.create_string_buffer(TAG_SIZE)
            aad_buf = ctypes.create_string_buffer(aad, len(aad)) if aad else None

            info = self._AUTH_INFO()
            info.cbSize = ctypes.sizeof(self._AUTH_INFO)
            info.dwInfoVersion = 1
            info.pbNonce = ctypes.cast(nonce_buf, ctypes.c_void_p)
            info.cbNonce = len(nonce)
            info.pbAuthData = ctypes.cast(aad_buf, ctypes.c_void_p) if aad_buf is not None else None
            info.cbAuthData = len(aad)
            info.pbTag = ctypes.cast(tag_buf, ctypes.c_void_p)
            info.cbTag = TAG_SIZE
            info.pbMacContext = None
            info.cbMacContext = 0
            info.cbAAD = 0
            info.cbData = 0
            info.dwFlags = 0

            pt_len = len(plaintext)
            pt_buf = ctypes.create_string_buffer(plaintext, pt_len) if pt_len else ctypes.create_string_buffer(1)
            ct_buf = ctypes.create_string_buffer(max(pt_len, 1))
            out_len = wintypes.ULONG(0)

            status = self._bcrypt.BCryptEncrypt(
                h_key,
                ctypes.cast(pt_buf, ctypes.c_void_p) if pt_len else None,
                pt_len,
                ctypes.byref(info),
                None,
                0,
                ctypes.cast(ct_buf, ctypes.c_void_p) if pt_len else None,
                pt_len,
                ctypes.byref(out_len),
                0,
            )
            if status != 0:
                raise OSError(f"BCryptEncrypt failed: 0x{status & 0xFFFFFFFF:08X}")
            return ct_buf.raw[: out_len.value], tag_buf.raw
        finally:
            self._bcrypt.BCryptDestroyKey(h_key)
            self._bcrypt.BCryptCloseAlgorithmProvider(h_alg, 0)

    def decrypt(self, key: bytes, nonce: bytes, ciphertext: bytes, tag: bytes, aad: bytes) -> bytes:
        h_alg, h_key, _key_obj = self._open_gcm_key(key)
        try:
            nonce_buf = ctypes.create_string_buffer(nonce, len(nonce))
            tag_buf = ctypes.create_string_buffer(tag, len(tag))
            aad_buf = ctypes.create_string_buffer(aad, len(aad)) if aad else None

            info = self._AUTH_INFO()
            info.cbSize = ctypes.sizeof(self._AUTH_INFO)
            info.dwInfoVersion = 1
            info.pbNonce = ctypes.cast(nonce_buf, ctypes.c_void_p)
            info.cbNonce = len(nonce)
            info.pbAuthData = ctypes.cast(aad_buf, ctypes.c_void_p) if aad_buf is not None else None
            info.cbAuthData = len(aad)
            info.pbTag = ctypes.cast(tag_buf, ctypes.c_void_p)
            info.cbTag = len(tag)
            info.pbMacContext = None
            info.cbMacContext = 0
            info.cbAAD = 0
            info.cbData = 0
            info.dwFlags = 0

            ct_len = len(ciphertext)
            ct_buf = ctypes.create_string_buffer(ciphertext, ct_len) if ct_len else ctypes.create_string_buffer(1)
            pt_buf = ctypes.create_string_buffer(max(ct_len, 1))
            out_len = wintypes.ULONG(0)

            status = self._bcrypt.BCryptDecrypt(
                h_key,
                ctypes.cast(ct_buf, ctypes.c_void_p) if ct_len else None,
                ct_len,
                ctypes.byref(info),
                None,
                0,
                ctypes.cast(pt_buf, ctypes.c_void_p) if ct_len else None,
                ct_len,
                ctypes.byref(out_len),
                0,
            )
            if status != 0:
                raise ValueError("AES-GCM authentication failed or corrupted archive.")
            return pt_buf.raw[: out_len.value]
        finally:
            self._bcrypt.BCryptDestroyKey(h_key)
            self._bcrypt.BCryptCloseAlgorithmProvider(h_alg, 0)


class AccountCrypto:
    """Deterministic per-account AES-256-GCM encryption derived from Google `sub`."""

    def __init__(self, google_sub: str):
        sub = str(google_sub or "").strip()
        if not sub:
            raise ValueError("Google account sub is required for encryption.")
        salt = f"AntiDetectBrowser.DriveSync.v1:{sub}".encode("utf-8")
        self._key = hashlib.pbkdf2_hmac(
            "sha256",
            sub.encode("utf-8"),
            salt,
            PBKDF2_ITERATIONS,
            dklen=32,
        )
        self._backend = self._select_backend()

    @staticmethod
    def _select_backend():
        if sys.platform == "win32":
            return _BcryptAesGcm()
        try:
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # type: ignore
            return AESGCM
        except ImportError as exc:
            raise RuntimeError("AES-256-GCM backend unavailable on this platform.") from exc

    def encrypt(self, plaintext: bytes, aad: bytes = b"") -> bytes:
        nonce = os.urandom(NONCE_SIZE)
        if isinstance(self._backend, _BcryptAesGcm):
            ciphertext, tag = self._backend.encrypt(self._key, nonce, plaintext, aad)
        else:
            aesgcm = self._backend(self._key)
            ct_plus_tag = aesgcm.encrypt(nonce, plaintext, aad or None)
            ciphertext, tag = ct_plus_tag[:-TAG_SIZE], ct_plus_tag[-TAG_SIZE:]
        return ARCHIVE_MAGIC + nonce + tag + ciphertext

    def decrypt(self, blob: bytes, aad: bytes = b"") -> bytes:
        min_len = len(ARCHIVE_MAGIC) + NONCE_SIZE + TAG_SIZE
        if not isinstance(blob, (bytes, bytearray)) or len(blob) < min_len:
            raise ValueError("Encrypted archive is truncated or malformed.")
        if blob[: len(ARCHIVE_MAGIC)] != ARCHIVE_MAGIC:
            raise ValueError("Unsupported encrypted archive header.")
        offset = len(ARCHIVE_MAGIC)
        nonce = bytes(blob[offset : offset + NONCE_SIZE])
        offset += NONCE_SIZE
        tag = bytes(blob[offset : offset + TAG_SIZE])
        offset += TAG_SIZE
        ciphertext = bytes(blob[offset:])

        if isinstance(self._backend, _BcryptAesGcm):
            return self._backend.decrypt(self._key, nonce, ciphertext, tag, aad)
        aesgcm = self._backend(self._key)
        return aesgcm.decrypt(nonce, ciphertext + tag, aad or None)


# ---------------------------------------------------------------------------
# Smart Selective Profile Archiving
# ---------------------------------------------------------------------------


def _is_essential_userdata_rel(rel_posix: str) -> bool:
    """Return True only for essential session/cookie/extension/preference files."""
    lower = rel_posix.lower()
    parts = [p for p in lower.split("/") if p]
    if not parts:
        return False
    if parts[-1] in EXCLUDED_FILE_NAMES or parts[-1].endswith((".tmp", ".log", ".ldb-lock")):
        return False
    if any(part in EXCLUDED_DIR_PARTS for part in parts[:-1]):
        return False
    if lower in ESSENTIAL_USERDATA_FILES:
        return True
    return any(lower.startswith(prefix) for prefix in ESSENTIAL_USERDATA_PREFIXES)


def iter_selective_profile_files(profile_dir: Path) -> List[Tuple[Path, str]]:
    """Collect (abs_path, archive_rel_path) for config.json + essential UserData files."""
    files: List[Tuple[Path, str]] = []
    cfg_path = profile_dir / "config.json"
    if cfg_path.is_file():
        files.append((cfg_path, "config.json"))

    user_data_dir = profile_dir / "UserData"
    if not user_data_dir.is_dir():
        return files

    for root, dirs, filenames in os.walk(user_data_dir):
        # Prune heavy/cache directories immediately so os.walk never traverses them
        dirs[:] = sorted(
            d for d in dirs
            if d.lower() not in EXCLUDED_DIR_PARTS
        )
        root_path = Path(root)
        for fname in sorted(filenames):
            fpath = root_path / fname
            try:
                rel_ud = fpath.relative_to(user_data_dir).as_posix()
            except ValueError:
                continue
            if not _is_essential_userdata_rel(rel_ud):
                continue
            try:
                size = fpath.stat().st_size
            except OSError:
                continue
            if size > MAX_SINGLE_FILE_BYTES and "cookies" not in rel_ud.lower():
                continue
            files.append((fpath, f"UserData/{rel_ud}"))
    return files


def compute_profile_content_hash(profile_dir: Path) -> str:
    """Compute a deterministic SHA-256 hash over config.json (excluding local path) + essential files."""
    hasher = hashlib.sha256()
    cfg_path = profile_dir / "config.json"
    if cfg_path.is_file():
        try:
            cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
            normalized = {
                k: v for k, v in cfg.items()
                if k not in ("user_data_dir", "is_active", "pid")
            }
            hasher.update(b"config.json\0")
            hasher.update(json.dumps(normalized, sort_keys=True, ensure_ascii=False).encode("utf-8"))
        except Exception:
            hasher.update(cfg_path.read_bytes())

    for abs_path, arc_rel in iter_selective_profile_files(profile_dir):
        if arc_rel == "config.json":
            continue
        hasher.update(arc_rel.encode("utf-8"))
        hasher.update(b"\0")
        try:
            with open(abs_path, "rb") as f:
                while True:
                    chunk = f.read(65536)
                    if not chunk:
                        break
                    hasher.update(chunk)
        except OSError:
            # Skip locked/transient file read failure safely
            continue
    return hasher.hexdigest()


def pack_profile_archive(profile_dir: Path) -> bytes:
    """Package config.json and essential UserData files into an in-memory ZIP archive."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for abs_path, arc_rel in iter_selective_profile_files(profile_dir):
            try:
                if arc_rel == "config.json":
                    cfg = json.loads(abs_path.read_text(encoding="utf-8"))
                    cfg.pop("user_data_dir", None)
                    cfg.pop("is_active", None)
                    cfg.pop("pid", None)
                    zf.writestr("config.json", json.dumps(cfg, indent=2, ensure_ascii=False))
                else:
                    zf.write(abs_path, arcname=arc_rel)
            except OSError:
                continue
    return buf.getvalue()


def unpack_profile_archive(archive_bytes: bytes, target_profile_dir: Path, profile_name: str) -> dict:
    """Safely extract a profile snapshot into target_profile_dir and normalize local paths."""
    target_profile_dir.parent.mkdir(parents=True, exist_ok=True)
    staging_dir = Path(tempfile.mkdtemp(prefix=".sync_restore_", dir=str(target_profile_dir.parent)))
    try:
        with zipfile.ZipFile(io.BytesIO(archive_bytes), "r") as zf:
            staging_resolved = staging_dir.resolve()
            for info in zf.infolist():
                member = info.filename.replace("\\", "/")
                if not member or member.startswith("/") or ".." in Path(member).parts:
                    continue
                dest = (staging_dir / member).resolve()
                if not str(dest).startswith(str(staging_resolved)):
                    continue
                if info.is_dir():
                    dest.mkdir(parents=True, exist_ok=True)
                else:
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    with zf.open(info, "r") as src_f, open(dest, "wb") as dst_f:
                        shutil.copyfileobj(src_f, dst_f)

        cfg_file = staging_dir / "config.json"
        if not cfg_file.is_file():
            raise ValueError("Restored archive is missing config.json.")

        cfg = json.loads(cfg_file.read_text(encoding="utf-8"))
        cfg["name"] = profile_name
        cfg["user_data_dir"] = str((target_profile_dir / "UserData").resolve())
        (staging_dir / "UserData").mkdir(parents=True, exist_ok=True)
        cfg_file.write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")

        if target_profile_dir.exists():
            # Preserve non-synced local caches if desired? Better to cleanly replace UserData
            # essential files and keep folder atomic, avoiding stale SQLite WAL/journal mismatches.
            old_backup = target_profile_dir.parent / f".sync_old_{uuid.uuid4().hex[:8]}"
            shutil.move(str(target_profile_dir), str(old_backup))
            try:
                shutil.move(str(staging_dir), str(target_profile_dir))
            except Exception:
                if not target_profile_dir.exists() and old_backup.exists():
                    shutil.move(str(old_backup), str(target_profile_dir))
                raise
            finally:
                shutil.rmtree(old_backup, ignore_errors=True)
        else:
            shutil.move(str(staging_dir), str(target_profile_dir))

        return cfg
    finally:
        if staging_dir.exists():
            shutil.rmtree(staging_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Google Drive REST API v3 Client (appDataFolder)
# ---------------------------------------------------------------------------


class DriveSyncError(RuntimeError):
    """Error during Google Drive API communication."""

    def __init__(
        self,
        message: str,
        offline: bool = False,
        status_code: Optional[int] = None,
        needs_reauth: bool = False,
        reason: str = "",
    ):
        super().__init__(message)
        self.offline = offline
        self.status_code = status_code
        self.needs_reauth = needs_reauth
        self.reason = reason


def parse_google_api_error(status_code: int, raw_body: str, fallback_reason: str = "") -> Tuple[str, bool, str]:
    """Parse Google API JSON error payloads into plain, helpful end-user messages."""
    err_status = ""
    err_message = ""
    reasons: List[str] = []

    try:
        payload = json.loads(raw_body) if raw_body else {}
        err_obj = payload.get("error") if isinstance(payload, dict) else None
        if isinstance(err_obj, dict):
            err_status = str(err_obj.get("status") or "").strip()
            err_message = str(err_obj.get("message") or "").strip()
            for item in err_obj.get("errors") or []:
                if isinstance(item, dict) and item.get("reason"):
                    reasons.append(str(item["reason"]))
            for detail in err_obj.get("details") or []:
                if isinstance(detail, dict) and detail.get("reason"):
                    reasons.append(str(detail["reason"]))
    except Exception:
        pass

    combined_lower = f"{err_status} {' '.join(reasons)} {err_message} {raw_body}".lower()

    if (
        "service_disabled" in combined_lower
        or "accessnotconfigured" in combined_lower
        or "drive.googleapis.com has not been used" in combined_lower
        or "it is disabled" in combined_lower
    ):
        return (
            "Cloud sync is temporarily unavailable. Please try again later or click Reconnect Drive.",
            False,
            "SERVICE_DISABLED",
        )

    if (
        status_code == 401
        or "access_token_scope_insufficient" in combined_lower
        or "insufficientpermissions" in combined_lower
        or "insufficient authentication scopes" in combined_lower
    ):
        return (
            "Google Drive permission required. Please sign in again or click Reconnect Drive.",
            True,
            "NEEDS_REAUTH",
        )

    if (
        "application default credentials" in combined_lower
        or "requires a quota project" in combined_lower
    ):
        return (
            "Cloud sync needs to reconnect your Google session. Click Reconnect Drive or sign in again.",
            True,
            "NEEDS_REAUTH",
        )

    clean_msg = err_message or fallback_reason or f"HTTP {status_code}"
    clean_msg = re.sub(r"https?://\S+", "", clean_msg)
    clean_msg = re.sub(r"\s+", " ", clean_msg).strip(" .")
    if not clean_msg or status_code >= 500:
        return (
            "Cloud sync paused. Check your internet connection or click Reconnect Drive.",
            False,
            err_status or "API_ERROR",
        )
    if len(clean_msg) > 140:
        clean_msg = clean_msg[:137].rstrip() + "..."
    return f"Cloud sync paused: {clean_msg}.", False, err_status or "API_ERROR"


def verify_access_token_has_drive_scope(access_token: str, timeout: int = 5) -> Optional[bool]:
    """Verify via Google tokeninfo whether an access_token includes drive.appdata.

    Returns True/False when verified online, or None if network is unreachable.
    """
    tok = str(access_token or "").strip()
    if not tok:
        return False
    url = f"{GOOGLE_TOKENINFO_API}?{urllib.parse.urlencode({'access_token': tok})}"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            info = json.loads(resp.read().decode("utf-8"))
        scope_str = str(info.get("scope") or "").strip()
        return DRIVE_SCOPE in scope_str.split()
    except urllib.error.HTTPError as e:
        if e.code in (400, 401):
            return False
        return None
    except Exception:
        return None


class GoogleDriveAppDataClient:
    """Minimal stdlib-only Google Drive v3 client authenticated strictly via user OAuth Bearer token."""

    def __init__(self, token_provider: Callable[[bool], Optional[str]]):
        """token_provider(force_refresh: bool) -> access_token or None."""
        self._token_provider = token_provider

    def _request(
        self,
        url: str,
        method: str = "GET",
        data: Optional[bytes] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: int = 30,
    ) -> bytes:
        last_exc: Optional[Exception] = None
        for attempt in range(2):
            token = self._token_provider(attempt > 0)
            if not token:
                raise DriveSyncError(
                    "Google Drive permission required. Please sign in again to grant app data sync.",
                    offline=False,
                    status_code=401,
                    needs_reauth=True,
                    reason="NO_TOKEN",
                )
            req_headers: Dict[str, str] = {"Authorization": f"Bearer {token}"}
            if headers:
                for k, v in headers.items():
                    if k.lower() != "x-goog-user-project":
                        req_headers[k] = v
            req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
            try:
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    return resp.read()
            except urllib.error.HTTPError as e:
                body = ""
                try:
                    body = e.read().decode("utf-8", errors="replace")
                except Exception:
                    pass
                if e.code == 401 and attempt == 0:
                    last_exc = e
                    continue
                friendly_msg, needs_reauth, reason = parse_google_api_error(e.code, body, str(e.reason or ""))
                raise DriveSyncError(
                    friendly_msg,
                    offline=False,
                    status_code=e.code,
                    needs_reauth=needs_reauth,
                    reason=reason,
                ) from e
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                raise DriveSyncError(
                    "Cloud sync paused. Check your internet connection or click Reconnect Drive.",
                    offline=True,
                    reason="OFFLINE",
                ) from e
        raise DriveSyncError(
            "Google Drive permission required. Please sign in again to grant app data sync.",
            offline=False,
            status_code=401,
            needs_reauth=True,
            reason=str(last_exc or "UNAUTHORIZED"),
        )

    def list_files(self) -> List[dict]:
        files: List[dict] = []
        page_token: Optional[str] = None
        while True:
            params = {
                "spaces": "appDataFolder",
                "fields": "nextPageToken,files(id,name,modifiedTime,size)",
                "pageSize": "1000",
            }
            if page_token:
                params["pageToken"] = page_token
            url = f"{DRIVE_FILES_API}?{urllib.parse.urlencode(params)}"
            raw = self._request(url, method="GET", timeout=15)
            payload = json.loads(raw.decode("utf-8"))
            files.extend(payload.get("files") or [])
            page_token = payload.get("nextPageToken")
            if not page_token:
                break
        return files

    def download_file(self, file_id: str) -> bytes:
        url = f"{DRIVE_FILES_API}/{urllib.parse.quote(file_id, safe='')}?alt=media"
        return self._request(url, method="GET", timeout=45)

    def upload_file(
        self,
        name: str,
        content: bytes,
        file_id: Optional[str] = None,
        mime_type: str = "application/octet-stream",
    ) -> dict:
        if file_id:
            url = f"{DRIVE_UPLOAD_API}/{urllib.parse.quote(file_id, safe='')}?uploadType=media&fields=id,name,modifiedTime,size"
            raw = self._request(
                url,
                method="PATCH",
                data=content,
                headers={"Content-Type": mime_type},
                timeout=60,
            )
            return json.loads(raw.decode("utf-8"))

        boundary = f"adb_sync_{uuid.uuid4().hex}"
        metadata = json.dumps({"name": name, "parents": ["appDataFolder"]}).encode("utf-8")
        body = (
            f"--{boundary}\r\n"
            f"Content-Type: application/json; charset=UTF-8\r\n\r\n"
        ).encode("utf-8") + metadata + (
            f"\r\n--{boundary}\r\n"
            f"Content-Type: {mime_type}\r\n\r\n"
        ).encode("utf-8") + content + f"\r\n--{boundary}--\r\n".encode("utf-8")

        url = f"{DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,name,modifiedTime,size"
        raw = self._request(
            url,
            method="POST",
            data=body,
            headers={"Content-Type": f"multipart/related; boundary={boundary}"},
            timeout=60,
        )
        return json.loads(raw.decode("utf-8"))

    def delete_file(self, file_id: str):
        url = f"{DRIVE_FILES_API}/{urllib.parse.quote(file_id, safe='')}"
        self._request(url, method="DELETE", timeout=15)


# ---------------------------------------------------------------------------
# Bidirectional Cloud Sync Manager
# ---------------------------------------------------------------------------


class CloudSyncManager:
    """Coordinates encrypted sync between an account's local folder and Drive appDataFolder."""

    def __init__(
        self,
        google_sub: str,
        account_dir: Path,
        proxies_file: Path,
        token_provider: Callable[[bool], Optional[str]],
        is_profile_running_fn: Optional[Callable[[str], bool]] = None,
        drive_client: Optional[GoogleDriveAppDataClient] = None,
        drive_authorized: bool = True,
    ):
        self.google_sub = google_sub
        self.account_dir = Path(account_dir)
        self.profiles_dir = self.account_dir / "profiles"
        self.proxies_file = Path(proxies_file)
        self.manifest_file = self.account_dir / MANIFEST_LOCAL_NAME
        self.is_profile_running_fn = is_profile_running_fn or (lambda _name: False)
        self.crypto = AccountCrypto(google_sub)
        self.drive = drive_client or GoogleDriveAppDataClient(token_provider)

        self._lock = threading.RLock()
        self._sync_op_lock = threading.Lock()
        self._debounce_timer: Optional[threading.Timer] = None
        self._stopped = False

        self._state = "idle"
        self._last_synced_at: Optional[int] = None
        self._error_message: Optional[str] = None
        self._pending_changes = False
        self._pending_pull_uuids: set[str] = set()
        self._drive_authorized = drive_authorized

        self.profiles_dir.mkdir(parents=True, exist_ok=True)
        manifest = self._load_local_manifest()
        if manifest.get("last_synced_at"):
            self._last_synced_at = manifest["last_synced_at"]
            if manifest.get("profiles"):
                self._state = "synced"
        if not self._drive_authorized:
            self._state = "needs_reauth"
            self._error_message = "Google Drive permission required. Please sign in again to grant app data sync."

    # --- Manifest persistence -------------------------------------------------

    def _empty_manifest(self) -> dict:
        return {
            "schema_version": 1,
            "updated_at": 0,
            "last_synced_at": None,
            "has_drive_consent": self._drive_authorized,
            "profiles": {},
            "deleted": {},
            "proxies": {
                "updated_at": 0,
                "content_hash": "",
                "items": [],
            },
        }

    def _load_local_manifest(self) -> dict:
        if not self.manifest_file.is_file():
            return self._empty_manifest()
        try:
            data = json.loads(self.manifest_file.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                return self._empty_manifest()
            base = self._empty_manifest()
            base.update(data)
            if not isinstance(base.get("profiles"), dict):
                base["profiles"] = {}
            if not isinstance(base.get("deleted"), dict):
                base["deleted"] = {}
            if not isinstance(base.get("proxies"), dict):
                base["proxies"] = {"updated_at": 0, "content_hash": "", "items": []}
            return base
        except Exception:
            return self._empty_manifest()

    def _save_local_manifest(self, manifest: dict):
        self.account_dir.mkdir(parents=True, exist_ok=True)
        tmp = self.manifest_file.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, self.manifest_file)

    # --- Local profile & proxy indexing --------------------------------------

    def _scan_local_profiles(self) -> Dict[str, dict]:
        """Return {uuid: {uuid, name, dir, config, updated_at, content_hash}}."""
        found: Dict[str, dict] = {}
        if not self.profiles_dir.is_dir():
            return found
        for item in sorted(self.profiles_dir.iterdir(), key=lambda p: p.name.lower()):
            if item.name.startswith(".") or not item.is_dir():
                continue
            cfg_file = item / "config.json"
            if not cfg_file.is_file():
                continue
            try:
                cfg = json.loads(cfg_file.read_text(encoding="utf-8"))
            except Exception:
                continue
            prof_uuid = str(cfg.get("uuid") or "").strip()
            if not prof_uuid:
                prof_uuid = str(uuid.uuid4())
                cfg["uuid"] = prof_uuid
                cfg.setdefault("updated_at", int(time.time() * 1000))
                try:
                    cfg_file.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
                except OSError:
                    pass
            updated_at = int(cfg.get("updated_at") or 0)
            if not updated_at:
                try:
                    updated_at = int(cfg_file.stat().st_mtime * 1000)
                except OSError:
                    updated_at = int(time.time() * 1000)
            found[prof_uuid] = {
                "uuid": prof_uuid,
                "name": item.name,
                "dir": item,
                "config": cfg,
                "updated_at": updated_at,
                "content_hash": compute_profile_content_hash(item),
            }
        return found

    def _load_local_proxies(self) -> List[dict]:
        if not self.proxies_file.is_file():
            return []
        try:
            data = json.loads(self.proxies_file.read_text(encoding="utf-8"))
            return data if isinstance(data, list) else []
        except Exception:
            return []

    def _save_local_proxies(self, items: List[dict]):
        self.proxies_file.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.proxies_file.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(items, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, self.proxies_file)

    @staticmethod
    def _proxies_hash(items: List[dict]) -> str:
        raw = json.dumps(items, sort_keys=True, ensure_ascii=False).encode("utf-8")
        return hashlib.sha256(raw).hexdigest()

    # --- Event hooks from server ---------------------------------------------

    def set_drive_authorized(self, authorized: bool):
        with self._lock:
            self._drive_authorized = authorized
            if not authorized:
                self._state = "needs_reauth"
                self._error_message = "Google Drive permission required. Please sign in again to grant app data sync."
            elif self._state == "needs_reauth":
                self._state = "synced" if self._last_synced_at else "idle"
                self._error_message = None
            manifest = self._load_local_manifest()
            manifest["has_drive_consent"] = authorized
            self._save_local_manifest(manifest)

    def record_profile_deleted(self, prof_uuid: str, name: str):
        if not prof_uuid:
            return
        with self._lock:
            manifest = self._load_local_manifest()
            now_ms = int(time.time() * 1000)
            manifest["deleted"][prof_uuid] = {
                "uuid": prof_uuid,
                "name": name,
                "deleted_at": now_ms,
            }
            manifest["profiles"].pop(prof_uuid, None)
            manifest["updated_at"] = now_ms
            self._pending_changes = True
            self._save_local_manifest(manifest)
        self.schedule_push()

    def record_profile_restored(self, prof_uuid: str):
        if not prof_uuid:
            return
        with self._lock:
            manifest = self._load_local_manifest()
            manifest["deleted"].pop(prof_uuid, None)
            manifest["updated_at"] = int(time.time() * 1000)
            self._pending_changes = True
            self._save_local_manifest(manifest)
        self.schedule_push()

    def record_proxies_updated(self):
        with self._lock:
            manifest = self._load_local_manifest()
            items = self._load_local_proxies()
            now_ms = int(time.time() * 1000)
            manifest["proxies"] = {
                "updated_at": now_ms,
                "content_hash": self._proxies_hash(items),
                "items": items,
            }
            manifest["updated_at"] = now_ms
            self._pending_changes = True
            self._save_local_manifest(manifest)
        self.schedule_push()

    def on_profile_stopped(self, name: str, prof_uuid: Optional[str] = None):
        """Apply any deferred remote pull if needed, then schedule push of fresh cookies."""
        if prof_uuid and prof_uuid in self._pending_pull_uuids:
            threading.Thread(target=self.sync_now, daemon=True).start()
            return
        self._pending_changes = True
        self.schedule_push()

    def schedule_push(self, delay_seconds: float = 2.0):
        with self._lock:
            if self._stopped or not self._drive_authorized:
                return
            self._pending_changes = True
            if self._debounce_timer is not None:
                self._debounce_timer.cancel()
            timer = threading.Timer(delay_seconds, self._background_push)
            timer.daemon = True
            self._debounce_timer = timer
            timer.start()

    def _background_push(self):
        with self._lock:
            if self._stopped:
                return
            self._debounce_timer = None
        try:
            self.sync_push()
        except Exception:
            pass

    def flush_before_logout(self, timeout: float = 4.0):
        """Best-effort sync push before clearing auth session on Sign Out."""
        with self._lock:
            if self._debounce_timer is not None:
                self._debounce_timer.cancel()
                self._debounce_timer = None
            should_push = self._pending_changes or self._has_dirty_local_profiles()
        if not should_push or not self._drive_authorized:
            return
        done = threading.Event()

        def _worker():
            try:
                self.sync_push()
            except Exception:
                pass
            finally:
                done.set()

        t = threading.Thread(target=_worker, daemon=True)
        t.start()
        done.wait(timeout=timeout)

    def stop(self):
        with self._lock:
            self._stopped = True
            if self._debounce_timer is not None:
                self._debounce_timer.cancel()
                self._debounce_timer = None

    def _has_dirty_local_profiles(self) -> bool:
        manifest = self._load_local_manifest()
        local_profiles = self._scan_local_profiles()
        for prof_uuid, info in local_profiles.items():
            entry = manifest["profiles"].get(prof_uuid)
            if not entry or entry.get("content_hash") != info["content_hash"]:
                return True
        return False

    # --- Status ---------------------------------------------------------------

    def get_status(self) -> dict:
        with self._lock:
            local_count = len(self._scan_local_profiles()) if self.profiles_dir.is_dir() else 0
            manifest = self._load_local_manifest()
            synced_count = len(manifest.get("profiles") or {}) or local_count
            return {
                "state": self._state,
                "last_synced_at": self._last_synced_at,
                "synced_profiles_count": synced_count if self._state == "synced" else local_count,
                "error_message": self._error_message,
                "pending_changes": self._pending_changes,
                "drive_authorized": self._drive_authorized,
            }

    # --- Core Sync Operations -------------------------------------------------

    def _fetch_remote_manifest(self, files_by_name: Dict[str, dict]) -> Tuple[Optional[dict], Optional[str]]:
        meta = files_by_name.get(MANIFEST_REMOTE_NAME)
        if not meta:
            return None, None
        raw_enc = self.drive.download_file(meta["id"])
        raw_json = self.crypto.decrypt(raw_enc, aad=MANIFEST_REMOTE_NAME.encode("utf-8"))
        data = json.loads(raw_json.decode("utf-8"))
        if not isinstance(data, dict):
            return None, meta["id"]
        return data, meta["id"]

    def _upload_remote_manifest(self, manifest: dict, file_id: Optional[str]) -> str:
        payload = json.dumps(manifest, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        enc = self.crypto.encrypt(payload, aad=MANIFEST_REMOTE_NAME.encode("utf-8"))
        uploaded = self.drive.upload_file(MANIFEST_REMOTE_NAME, enc, file_id=file_id)
        return str(uploaded.get("id") or file_id or "")

    def _resolve_restore_name(self, desired_name: str, prof_uuid: str) -> str:
        """Avoid clobbering a different local profile with the same folder name."""
        candidate = desired_name
        target = self.profiles_dir / candidate
        if target.exists() and (target / "config.json").is_file():
            try:
                existing_cfg = json.loads((target / "config.json").read_text(encoding="utf-8"))
                if existing_cfg.get("uuid") == prof_uuid:
                    return candidate
            except Exception:
                pass
            suffix = prof_uuid.split("-")[0][:6]
            candidate = f"{desired_name[:55]}_{suffix}"
        return candidate

    def sync_pull(self) -> dict:
        """Download and restore new or newer encrypted profile snapshots from Drive appDataFolder."""
        if not self._drive_authorized:
            with self._lock:
                self._state = "needs_reauth"
                self._error_message = "Google Drive permission required. Please sign in again to grant app data sync."
            return {"pulled": [], "skipped_running": [], "proxies_updated": False, "error": self._error_message}

        with self._sync_op_lock:
            with self._lock:
                self._state = "syncing"
                self._error_message = None

            try:
                remote_files = self.drive.list_files()
                files_by_name = {f["name"]: f for f in remote_files if f.get("name")}
                remote_manifest, _manifest_id = self._fetch_remote_manifest(files_by_name)
                if not remote_manifest:
                    now_ms = int(time.time() * 1000)
                    with self._lock:
                        self._last_synced_at = self._last_synced_at or now_ms
                        self._state = "synced"
                    return {"pulled": [], "skipped_running": [], "proxies_updated": False}

                local_manifest = self._load_local_manifest()
                local_profiles = self._scan_local_profiles()
                pulled: List[str] = []
                skipped_running: List[str] = []
                proxies_updated = False

                # 1. Merge / restore proxies if remote proxies are newer
                remote_proxies = remote_manifest.get("proxies") or {}
                local_proxies_meta = local_manifest.get("proxies") or {}
                r_prx_ts = int(remote_proxies.get("updated_at") or 0)
                l_prx_ts = int(local_proxies_meta.get("updated_at") or 0)
                if r_prx_ts > l_prx_ts and isinstance(remote_proxies.get("items"), list):
                    local_items = self._load_local_proxies()
                    if not local_items:
                        merged = remote_proxies["items"]
                    else:
                        # Merge by url preserving newer remote entries
                        by_url = {p.get("url"): p for p in local_items if isinstance(p, dict) and p.get("url")}
                        for rp in remote_proxies["items"]:
                            if isinstance(rp, dict) and rp.get("url"):
                                by_url[rp["url"]] = rp
                        merged = list(by_url.values())
                    self._save_local_proxies(merged)
                    local_manifest["proxies"] = {
                        "updated_at": r_prx_ts,
                        "content_hash": self._proxies_hash(merged),
                        "items": merged,
                    }
                    proxies_updated = True

                # 2. Apply remote deletions if newer than local state
                for del_uuid, del_info in (remote_manifest.get("deleted") or {}).items():
                    del_ts = int((del_info or {}).get("deleted_at") or 0)
                    local_prof = local_profiles.get(del_uuid)
                    if local_prof and del_ts > local_prof["updated_at"]:
                        if self.is_profile_running_fn(local_prof["name"]):
                            self._pending_pull_uuids.add(del_uuid)
                            skipped_running.append(local_prof["name"])
                            continue
                        shutil.rmtree(local_prof["dir"], ignore_errors=True)
                        local_profiles.pop(del_uuid, None)
                        local_manifest["profiles"].pop(del_uuid, None)
                        local_manifest["deleted"][del_uuid] = del_info

                # 3. Pull new or updated profiles from remote
                for prof_uuid, r_entry in (remote_manifest.get("profiles") or {}).items():
                    if not isinstance(r_entry, dict):
                        continue
                    r_updated = int(r_entry.get("updated_at") or 0)
                    r_hash = str(r_entry.get("content_hash") or "")
                    r_name = str(r_entry.get("name") or f"Profile_{prof_uuid[:6]}")
                    archive_name = str(r_entry.get("archive_name") or f"profile_{prof_uuid}.enc")

                    local_del = (local_manifest.get("deleted") or {}).get(prof_uuid)
                    if local_del and int(local_del.get("deleted_at") or 0) >= r_updated:
                        continue

                    l_prof = local_profiles.get(prof_uuid)
                    needs_pull = (
                        l_prof is None
                        or (r_updated > l_prof["updated_at"] and r_hash != l_prof["content_hash"])
                    )
                    if not needs_pull:
                        # Update drive_file_id reference if needed
                        if prof_uuid in local_manifest["profiles"] and r_entry.get("drive_file_id"):
                            local_manifest["profiles"][prof_uuid]["drive_file_id"] = r_entry["drive_file_id"]
                        continue

                    if l_prof and self.is_profile_running_fn(l_prof["name"]):
                        self._pending_pull_uuids.add(prof_uuid)
                        skipped_running.append(l_prof["name"])
                        continue

                    remote_meta = files_by_name.get(archive_name)
                    if not remote_meta:
                        continue

                    enc_blob = self.drive.download_file(remote_meta["id"])
                    zip_bytes = self.crypto.decrypt(enc_blob, aad=archive_name.encode("utf-8"))

                    restore_name = l_prof["name"] if l_prof else self._resolve_restore_name(r_name, prof_uuid)
                    target_dir = self.profiles_dir / restore_name
                    restored_cfg = unpack_profile_archive(zip_bytes, target_dir, restore_name)

                    # If renamed remotely, clean old local folder if different
                    if l_prof and l_prof["name"] != r_name and not (self.profiles_dir / r_name).exists():
                        new_dir = self.profiles_dir / r_name
                        shutil.move(str(target_dir), str(new_dir))
                        target_dir = new_dir
                        restore_name = r_name
                        restored_cfg["name"] = r_name
                        restored_cfg["user_data_dir"] = str((new_dir / "UserData").resolve())
                        (new_dir / "config.json").write_text(json.dumps(restored_cfg, indent=2), encoding="utf-8")

                    local_manifest["profiles"][prof_uuid] = {
                        "uuid": prof_uuid,
                        "name": restore_name,
                        "updated_at": int(restored_cfg.get("updated_at") or r_updated),
                        "content_hash": compute_profile_content_hash(target_dir),
                        "archive_name": archive_name,
                        "drive_file_id": remote_meta["id"],
                    }
                    self._pending_pull_uuids.discard(prof_uuid)
                    pulled.append(restore_name)

                now_ms = int(time.time() * 1000)
                local_manifest["last_synced_at"] = now_ms
                self._save_local_manifest(local_manifest)

                with self._lock:
                    self._last_synced_at = now_ms
                    self._state = "synced"
                    self._error_message = None

                return {
                    "pulled": pulled,
                    "skipped_running": skipped_running,
                    "proxies_updated": proxies_updated,
                }
            except DriveSyncError as e:
                with self._lock:
                    if e.needs_reauth:
                        self._drive_authorized = False
                        self._state = "needs_reauth"
                    else:
                        self._state = "offline" if e.offline else "error"
                    self._error_message = str(e)
                return {"pulled": [], "skipped_running": [], "proxies_updated": False, "error": str(e)}
            except Exception as e:
                with self._lock:
                    self._state = "error"
                    self._error_message = str(e)
                return {"pulled": [], "skipped_running": [], "proxies_updated": False, "error": str(e)}

    def sync_push(self, profile_names: Optional[List[str]] = None) -> dict:
        """Encrypt and upload modified local profiles and proxies to Drive appDataFolder."""
        if not self._drive_authorized:
            with self._lock:
                self._state = "needs_reauth"
                self._error_message = "Google Drive permission required. Please sign in again to grant app data sync."
            return {"pushed": [], "skipped_running": [], "error": self._error_message}

        with self._sync_op_lock:
            with self._lock:
                self._state = "syncing"
                self._error_message = None

            try:
                remote_files = self.drive.list_files()
                files_by_name = {f["name"]: f for f in remote_files if f.get("name")}
                remote_manifest, manifest_file_id = self._fetch_remote_manifest(files_by_name)
                remote_profiles = (remote_manifest or {}).get("profiles") or {}
                remote_deleted = (remote_manifest or {}).get("deleted") or {}

                local_manifest = self._load_local_manifest()
                local_profiles = self._scan_local_profiles()

                pushed: List[str] = []
                skipped_running: List[str] = []

                merged_profiles: Dict[str, dict] = dict(remote_profiles)
                merged_deleted: Dict[str, dict] = dict(remote_deleted)

                # Merge local deletion tombstones
                for del_uuid, del_info in (local_manifest.get("deleted") or {}).items():
                    del_ts = int((del_info or {}).get("deleted_at") or 0)
                    r_prof = merged_profiles.get(del_uuid)
                    if not r_prof or del_ts >= int(r_prof.get("updated_at") or 0):
                        merged_deleted[del_uuid] = del_info
                        if del_uuid in merged_profiles:
                            arch_name = merged_profiles[del_uuid].get("archive_name") or f"profile_{del_uuid}.enc"
                            if arch_name in files_by_name:
                                try:
                                    self.drive.delete_file(files_by_name[arch_name]["id"])
                                except DriveSyncError:
                                    pass
                            merged_profiles.pop(del_uuid, None)

                # Push local profiles that are new or modified
                target_filter = set(profile_names) if profile_names else None
                for prof_uuid, info in local_profiles.items():
                    name = info["name"]
                    if target_filter is not None and name not in target_filter:
                        continue
                    if self.is_profile_running_fn(name):
                        skipped_running.append(name)
                        continue

                    r_entry = remote_profiles.get(prof_uuid)
                    # Conflict guard: never overwrite newer remote state
                    if r_entry and int(r_entry.get("updated_at") or 0) > info["updated_at"]:
                        if r_entry.get("content_hash") != info["content_hash"]:
                            continue

                    archive_name = f"profile_{prof_uuid}.enc"
                    remote_meta = files_by_name.get(archive_name)
                    existing_file_id = (
                        (remote_meta or {}).get("id")
                        or (r_entry or {}).get("drive_file_id")
                        or (local_manifest["profiles"].get(prof_uuid) or {}).get("drive_file_id")
                    )

                    needs_upload = (
                        remote_meta is None
                        or not r_entry
                        or r_entry.get("content_hash") != info["content_hash"]
                        or r_entry.get("name") != name
                    )

                    if needs_upload:
                        zip_bytes = pack_profile_archive(info["dir"])
                        enc_bytes = self.crypto.encrypt(zip_bytes, aad=archive_name.encode("utf-8"))
                        uploaded = self.drive.upload_file(
                            archive_name,
                            enc_bytes,
                            file_id=existing_file_id if remote_meta else None,
                        )
                        file_id = str(uploaded.get("id") or existing_file_id or "")
                        pushed.append(name)
                    else:
                        file_id = str(existing_file_id or "")

                    entry = {
                        "uuid": prof_uuid,
                        "name": name,
                        "updated_at": info["updated_at"],
                        "content_hash": info["content_hash"],
                        "archive_name": archive_name,
                        "drive_file_id": file_id,
                    }
                    merged_profiles[prof_uuid] = entry
                    local_manifest["profiles"][prof_uuid] = entry
                    merged_deleted.pop(prof_uuid, None)

                # Proxies payload
                local_proxies = self._load_local_proxies()
                local_prx_hash = self._proxies_hash(local_proxies)
                local_prx_ts = int((local_manifest.get("proxies") or {}).get("updated_at") or 0)
                if not local_prx_ts and local_proxies:
                    local_prx_ts = int(time.time() * 1000)

                remote_prx = (remote_manifest or {}).get("proxies") or {}
                remote_prx_ts = int(remote_prx.get("updated_at") or 0)
                if remote_prx_ts > local_prx_ts and isinstance(remote_prx.get("items"), list):
                    chosen_proxies = remote_prx
                else:
                    chosen_proxies = {
                        "updated_at": local_prx_ts,
                        "content_hash": local_prx_hash,
                        "items": local_proxies,
                    }

                now_ms = int(time.time() * 1000)
                new_remote_manifest = {
                    "schema_version": 1,
                    "updated_at": now_ms,
                    "profiles": merged_profiles,
                    "deleted": merged_deleted,
                    "proxies": chosen_proxies,
                }
                new_manifest_id = self._upload_remote_manifest(new_remote_manifest, manifest_file_id)

                local_manifest["profiles"] = merged_profiles
                local_manifest["deleted"] = merged_deleted
                local_manifest["proxies"] = chosen_proxies
                local_manifest["updated_at"] = now_ms
                local_manifest["last_synced_at"] = now_ms
                local_manifest["manifest_file_id"] = new_manifest_id
                self._save_local_manifest(local_manifest)

                with self._lock:
                    self._last_synced_at = now_ms
                    self._pending_changes = bool(skipped_running)
                    self._state = "synced"
                    self._error_message = None

                return {"pushed": pushed, "skipped_running": skipped_running}
            except DriveSyncError as e:
                with self._lock:
                    if e.needs_reauth:
                        self._drive_authorized = False
                        self._state = "needs_reauth"
                    else:
                        self._state = "offline" if e.offline else "error"
                    self._error_message = str(e)
                return {"pushed": [], "skipped_running": [], "error": str(e)}
            except Exception as e:
                with self._lock:
                    self._state = "error"
                    self._error_message = str(e)
                return {"pushed": [], "skipped_running": [], "error": str(e)}

    def sync_now(self) -> dict:
        """Perform an immediate bidirectional sync (pull then push) and return full status."""
        pull_res = self.sync_pull()
        push_res = self.sync_push()
        status = self.get_status()
        return {
            "sync": status,
            "pulled": pull_res.get("pulled", []),
            "pushed": push_res.get("pushed", []),
            "skipped_running": list(
                set(pull_res.get("skipped_running", [])) | set(push_res.get("skipped_running", []))
            ),
            "proxies_updated": bool(pull_res.get("proxies_updated", False)),
        }
