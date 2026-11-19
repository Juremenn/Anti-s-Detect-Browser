"""
profile_manager.py - Local browser profiles: config, isolated UserData, tags, folders, trash.
"""

import json
import random
import re
import shutil
import sys
import tempfile
import time
import uuid
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from .fingerprint import derive_identity

_APP_ROOT = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else Path(__file__).resolve().parent.parent
BASE_PROFILES_DIR = _APP_ROOT / "profiles"
TRASH_DIRNAME = ".trash"

# Letters, digits, space, dash, underscore. No dots or slashes, so a name can never
# escape the profiles directory (delete uses rmtree on this path).
NAME_RE = re.compile(r"^[A-Za-z0-9_\- ]{1,64}$")

def _clean_typed_fields(fields: dict) -> dict:
    """Clean/validate the extended per-profile settings (dialog Advanced,
    Fingerprint behavior, Proxy, General extras). Unknown keys are ignored."""
    out: dict = {}

    if "tags" in fields:
        out["tags"] = _clean_tags(fields["tags"])
    for key in ("folder", "notes", "proxy"):
        if key in fields:
            value = fields[key]
            out[key] = ("" if value is None else str(value)).strip()[:500 if key == "notes" else 200]
    if "proxy" in out:
        out["proxy"] = validate_proxy(out["proxy"])

    if "color" in fields:
        color = str(fields["color"] or "").strip().lower()
        out["color"] = color if re.match(r"^#[0-9a-f]{6}$", color) or color in (
            "", "gray", "blue", "green", "yellow", "red", "purple", "orange") else ""

    if "start_urls" in fields:
        urls = fields["start_urls"]
        if isinstance(urls, str):
            urls = [u.strip() for u in urls.splitlines() if u.strip()]
        clean = []
        for u in urls if isinstance(urls, list) else []:
            u = str(u).strip()[:500]
            if u and urlparse(u).scheme in ("http", "https"):
                clean.append(u)
        out["start_urls"] = clean[:20]

    for key in ("webrtc_mode", "timezone_mode", "locale_mode", "geo_mode", "on_close"):
        if key in fields:
            value = str(fields[key] or "").strip().lower()
            allowed = {
                "webrtc_mode": ("disabled", "altered", "real"),
                "timezone_mode": ("proxy", "manual", "system"),
                "locale_mode": ("proxy", "manual"),
                "geo_mode": ("block", "proxy", "manual"),
                "on_close": ("keep", "clear_cache", "clear_all"),
            }[key]
            out[key] = value if value in allowed else allowed[0] if key != "locale_mode" else "proxy"

    if "timezone" in fields:
        out["timezone"] = str(fields["timezone"] or "").strip()[:64]
    if "locale" in fields:
        out["locale"] = str(fields["locale"] or "").strip()[:16]
    if "browser_version" in fields:
        out["browser_version"] = str(fields["browser_version"] or "").strip()[:32]

    if "geo_mode" in fields and fields.get("geo_mode") == "manual":
        for key in ("geo_lat", "geo_lon", "geo_accuracy"):
            if key in fields:
                try:
                    out[key] = max(-90.0 if key.endswith("lat") else 0.0,
                                   min(90.0 if key.endswith("lat") else 100000.0,
                                       float(fields[key])))
                except (TypeError, ValueError):
                    pass

    if "extra_args" in fields:
        args = str(fields["extra_args"] or "").strip()[:1000]
        dangerous = ("--user-data-dir", "--load-extension", "--remote-debugging",
                     "--proxy-server", "--user-agent")
        if any(d in args for d in dangerous):
            raise ProfileError(
                "Argumen tambahan tidak boleh memuat: " + ", ".join(dangerous))
        out["extra_args"] = args

    for key in (
        "canvas_noise", "webgl_noise", "audio_noise", "clientrects_noise",
        "font_noise", "port_scan_protection", "battery_spoof", "dnt",
    ):
        if key in fields:
            out[key] = bool(fields[key])
    for key in ("media_mic", "media_cam", "media_spk"):
        if key in fields:
            try:
                out[key] = max(0, min(4, int(fields[key])))
            except (TypeError, ValueError):
                pass

    return out

# Hardware presets live in data/presets.json so new devices can be added
# without touching code. The export name stays HARDWARE_PRESETS.
_PRESETS_FILE = Path(__file__).resolve().parent / "data" / "presets.json"

def _load_presets() -> list:
    try:
        with open(_PRESETS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        presets = [dict(p) for p in data.get("presets", []) if isinstance(p, dict)]
    except (OSError, ValueError):
        presets = []
    if not presets:
        raise RuntimeError(f"Preset perangkat tidak bisa dimuat dari {_PRESETS_FILE}.")
    # navigator.deviceMemory is capped by Chrome at 8 ("8 GB or more"); a
    # higher value is a detection signal, so clamp no matter what the file says.
    for p in presets:
        try:
            p["device_memory"] = min(8, float(p.get("device_memory") or 8))
        except (TypeError, ValueError):
            p["device_memory"] = 8
    return presets

HARDWARE_PRESETS = _load_presets()


class ProfileError(ValueError):
    """Invalid input or state; the message is safe to show to the user."""


def validate_name(name) -> str:
    if not isinstance(name, str):
        raise ProfileError("Nama profil wajib diisi.")
    name = name.strip()
    if not NAME_RE.match(name):
        raise ProfileError("Nama profil hanya boleh huruf, angka, spasi, '-' dan '_' (maks. 64 karakter).")
    return name


def _clean_tags(tags) -> list:
    if isinstance(tags, str):
        tags = tags.split(",")
    if not isinstance(tags, list):
        return []
    seen, out = set(), []
    for t in tags:
        t = str(t).strip()[:32]
        if t and t.lower() not in seen:
            seen.add(t.lower())
            out.append(t)
    return out[:20]


PROXY_RE = re.compile(r"^(http|https|socks4|socks5)://[A-Za-z0-9.\-\[\]:]+:\d{1,5}$")


# --- Fingerprint diversification --------------------------------------------
# A raw preset copy is a linkable identity: N profiles on the same preset share
# the exact GPU string, cores, RAM, resolution and UA. _derive_fingerprint splits
# a base template into a per-profile variant that stays inside what a real
# browser would report.

# navigator.deviceMemory is capped by Chrome at 8 ("8 GB or more"), so 16 GB
# is a detection signal, not a spec. Memory stays plausible per GPU family:
# a desktop RTX card never ships in a 2 GB machine.
_MEMORY_BY_FAMILY = {
    "nvidia": [(4, 2), (8, 7)],
    "amd": [(4, 2), (8, 7)],
    "intel": [(4, 3), (8, 7)],
    "apple": [(8, 1)],
}
_WIN_SCREENS = [
    (1920, 1080), (1920, 1080), (1920, 1080), (2560, 1440),
    (1600, 900), (1680, 1050), (1366, 768), (1536, 864),
]
_MAC_SCREENS = [(2560, 1600), (1800, 1169), (1512, 982), (2056, 1329)]

_GPU_VARIANTS = {
    "nvidia": {
        "webgl_vendor": "Google Inc. (NVIDIA)",
        "renderers": [
            "ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 Direct3D11 vs_5_0 ps_5_0, D3D11)",
            "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
            "ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)",
            "ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)",
            "ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
            "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)",
            "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)",
        ],
        "concurrency": [8, 12, 16, 24],
    },
    "intel": {
        "webgl_vendor": "Google Inc. (Intel)",
        "renderers": [
            "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)",
            "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)",
            "ANGLE (Intel, Intel(R) UHD Graphics 770 Direct3D11 vs_5_0 ps_5_0, D3D11)",
            "ANGLE (Intel, Intel(R) Arc(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)",
        ],
        "concurrency": [4, 8, 12, 16],
    },
    "amd": {
        "webgl_vendor": "Google Inc. (AMD)",
        "renderers": [
            "ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)",
            "ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)",
            "ANGLE (AMD, AMD Radeon RX 7600 Direct3D11 vs_5_0 ps_5_0, D3D11)",
        ],
        "concurrency": [6, 8, 12, 16],
    },
    "apple": {
        "webgl_vendor": "Google Inc. (Apple)",
        "renderers": [
            "ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)",
            "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)",
            "ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)",
            "ANGLE (Apple, ANGLE Metal Renderer: Apple M3, Unspecified Version)",
        ],
        "concurrency": [8, 10, 12],
    },
}

# "Chrome/131.0.0.0" -> "Chrome/131.0.<build>.<patch>". Major stays untouched so
# it never contradicts the Sec-CH-UA header the real engine sends; only the
# build/patch digits vary, which is how real fleets look.
_UA_BUILD_RE = re.compile(r"(Chrome/\d+\.0\.)(\d+)\.(\d+)")

def _derive_fingerprint(base: dict, rng: random.Random) -> dict:
    renderer = str(base.get("webgl_renderer", ""))
    if "Apple" in renderer:
        family = "apple"
    elif "NVIDIA" in renderer:
        family = "nvidia"
    elif "Intel" in renderer:
        family = "intel"
    else:
        family = "amd"
    pool = _GPU_VARIANTS[family]

    ua = str(base.get("user_agent", ""))
    if ua:
        ua = _UA_BUILD_RE.sub(
            lambda m: f"{m.group(1)}{rng.randint(6200, 6900)}.{rng.randint(0, 120)}", ua)

    memories, weights = zip(*_MEMORY_BY_FAMILY[family])
    screen = rng.choice(_MAC_SCREENS if family == "apple" else _WIN_SCREENS)
    return {
        "webgl_vendor": pool["webgl_vendor"],
        "webgl_renderer": rng.choice(pool["renderers"]),
        "hardware_concurrency": rng.choice(pool["concurrency"]),
        "device_memory": rng.choices(memories, weights=weights)[0],
        "screen_width": screen[0],
        "screen_height": screen[1],
        "user_agent": ua,
        "canvas_seed": rng.randint(100000, 9999999),
        "audio_seed": rng.randint(100000, 9999999),
        "font_seed": rng.randint(100000, 9999999),
    }


def validate_proxy(proxy: str) -> str:
    proxy = proxy.strip()
    if not proxy:
        return ""
    if "@" in proxy:
        raise ProfileError("Proxy dengan login (user:pass@) tidak didukung Chrome lewat --proxy-server. "
                           "Gunakan proxy tanpa login atau whitelist IP.")
    if not PROXY_RE.match(proxy):
        raise ProfileError("Format proxy: http://host:port, https://host:port, socks4://host:port atau socks5://host:port.")
    return proxy


def _validate_custom_fingerprint(fields: dict) -> dict:
    """Validate user-entered fingerprint values. Only provided keys are returned."""
    if not isinstance(fields, dict):
        raise ProfileError("Data fingerprint tidak valid.")
    out = {}

    if "platform" in fields:
        platform = str(fields["platform"]).strip()
        if platform and platform not in ("Win32", "MacIntel"):
            raise ProfileError("Platform harus Win32 atau MacIntel.")
        out["platform"] = platform or "Win32"

    for key in ("webgl_vendor", "webgl_renderer", "user_agent"):
        if key in fields:
            value = str(fields[key] or "").strip()
            if not value:
                raise ProfileError(f"'{key}' tidak boleh kosong.")
            if len(value) > 300:
                raise ProfileError(f"'{key}' maksimal 300 karakter.")
            out[key] = value

    if "hardware_concurrency" in fields:
        try:
            cores = int(fields["hardware_concurrency"])
        except (TypeError, ValueError):
            raise ProfileError("Jumlah core harus angka.")
        if not 1 <= cores <= 128:
            raise ProfileError("Jumlah core harus di antara 1 dan 128.")
        out["hardware_concurrency"] = cores

    if "device_memory" in fields:
        try:
            memory = float(fields["device_memory"])
        except (TypeError, ValueError):
            raise ProfileError("RAM harus angka.")
        # Chrome reports deviceMemory only in these steps, capped at 8.
        if memory not in (0.25, 0.5, 1, 2, 4, 8):
            raise ProfileError("RAM harus salah satu dari: 0.25, 0.5, 1, 2, 4, atau 8 GB (batas report Chrome).")
        out["device_memory"] = memory

    for key in ("screen_width", "screen_height"):
        if key in fields:
            try:
                value = int(fields[key])
            except (TypeError, ValueError):
                raise ProfileError(f"{key.replace('_', ' ').title()} harus angka.")
            if not 400 <= value <= 7680:
                raise ProfileError("Resolusi layar harus di antara 400 dan 7680 piksel.")
            out[key] = value

    if "languages" in fields:
        langs = [s.strip()[:16] for s in str(fields["languages"]).split(",") if s.strip()]
        if len(langs) > 6:
            raise ProfileError("Maksimal 6 bahasa.")
        out["languages"] = langs or ["en-US", "en"]

    if "color_depth" in fields:
        try:
            depth = int(fields["color_depth"])
        except (TypeError, ValueError):
            raise ProfileError("Color depth harus angka.")
        if depth not in (24, 30):
            raise ProfileError("Color depth harus 24 atau 30.")
        out["color_depth"] = depth

    return out


def _read_json(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, data: dict):
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    tmp.replace(path)


def _move_with_retry(src: Path, dst: Path, attempts: int = 10):
    # Chrome can hold file locks for a moment after its process is killed.
    for i in range(attempts):
        try:
            shutil.move(str(src), str(dst))
            return
        except (PermissionError, OSError):
            if i == attempts - 1:
                raise
            time.sleep(0.5)


class ProfileManager:
    def __init__(self, profiles_dir: Path = BASE_PROFILES_DIR):
        self.profiles_dir = Path(profiles_dir)
        self.trash_dir = self.profiles_dir / TRASH_DIRNAME
        self.profiles_dir.mkdir(parents=True, exist_ok=True)
        self._heal_profile_names()

    def _heal_profile_names(self):
        """Ensure all profile config.json files have 'name' synchronized with the folder name."""
        if not self.profiles_dir.exists():
            return
        for item in self.profiles_dir.iterdir():
            if item.name.startswith(".") or not item.is_dir():
                continue
            cfg_file = item / "config.json"
            if not cfg_file.is_file():
                continue
            try:
                cfg = _read_json(cfg_file)
                if cfg.get("name") != item.name:
                    cfg["name"] = item.name
                    _write_json(cfg_file, cfg)
            except (OSError, ValueError):
                continue

    # --- paths -----------------------------------------------------------------

    def _path(self, name: str) -> Path:
        return self.profiles_dir / validate_name(name)

    def exists(self, name: str) -> bool:
        return (self._path(name) / "config.json").exists()

    def _with_paths(self, profile: dict, profile_path: Path) -> dict:
        # The stored path may come from another machine (import) or an old location;
        # the folder on disk is the source of truth.
        profile = dict(profile)
        profile["name"] = profile_path.name
        profile["user_data_dir"] = str(profile_path / "UserData")
        profile.setdefault("tags", [])
        profile.setdefault("folder", "")
        profile.setdefault("notes", "")
        profile.setdefault("proxy", "")
        return profile

    # --- CRUD ------------------------------------------------------------------

    def create_profile(self, name: str, preset_index: int = 0, proxy: Optional[str] = None,
                       tags=None, folder: str = "", notes: str = "",
                       diversify: bool = True, custom: Optional[dict] = None,
                       extra: Optional[dict] = None) -> dict:
        name = validate_name(name)
        profile_path = self.profiles_dir / name
        if (profile_path / "config.json").exists():
            raise ProfileError(f"Profil '{name}' sudah ada.")
        try:
            preset_index = int(preset_index)
        except (TypeError, ValueError):
            preset_index = 0
        preset_index %= len(HARDWARE_PRESETS)

        user_data_path = profile_path / "UserData"
        user_data_path.mkdir(parents=True, exist_ok=True)

        preset = HARDWARE_PRESETS[preset_index].copy()
        preset_device_name = preset.pop("name", None)
        overrides = _validate_custom_fingerprint(custom or {})
        # One 64-bit seed per profile: every derived value (GPU variant, seeds,
        # grease brand, ...) comes from it, so the identity is reproducible.
        identity_seed = random.getrandbits(64)
        fingerprint = (derive_identity(preset, identity_seed)
                       if diversify and not overrides else {})
        profile = {
            "uuid": str(uuid.uuid4()),
            "created_at": str(int(time.time())),
            "user_data_dir": str(user_data_path),
            "mask_webrtc": True,
            "base_preset": preset_index,
            "identity_seed": identity_seed,
            "diversified": bool(diversify) and not overrides,
            "custom": bool(overrides),
            "device_name": preset_device_name,
            **preset,
            **fingerprint,
            **overrides,
            **_clean_typed_fields({
                "proxy": proxy, "tags": tags or [], "folder": folder, "notes": notes,
                **(extra or {}),
            }),
            "name": name,
        }
        _write_json(profile_path / "config.json", profile)
        return profile

    def get_profile(self, name: str, create_if_missing: bool = True) -> dict:
        profile_path = self._path(name)
        config_file = profile_path / "config.json"
        if not config_file.exists():
            if not create_if_missing:
                raise ProfileError(f"Profil '{name}' tidak ditemukan.")
            return self.create_profile(name)
        cfg = _read_json(config_file)
        if cfg.get("name") != profile_path.name:
            cfg["name"] = profile_path.name
            _write_json(config_file, cfg)
        return self._with_paths(cfg, profile_path)

    def rename_profile(self, old_name: str, new_name: str) -> dict:
        old_name = validate_name(old_name)
        new_name = validate_name(new_name)
        if old_name == new_name:
            return self.get_profile(old_name, create_if_missing=False)
        src = self._path(old_name)
        dst = self._path(new_name)
        if not (src / "config.json").exists():
            raise ProfileError(f"Profil '{old_name}' tidak ditemukan.")
        if dst.exists():
            raise ProfileError(f"Profil dengan nama '{new_name}' sudah ada.")
        _move_with_retry(src, dst)
        cfg = _read_json(dst / "config.json")
        cfg["name"] = new_name
        cfg["user_data_dir"] = str(dst / "UserData")
        _write_json(dst / "config.json", cfg)
        return self._with_paths(cfg, dst)

    def update_profile(self, name: str, fields: dict) -> dict:
        profile = self.get_profile(name, create_if_missing=False)
        profile.update(_clean_typed_fields(fields or {}))
        _write_json(self._path(name) / "config.json", profile)
        return profile

    def refresh_fingerprint(self, name: str, keep_cookies: bool = False) -> dict:
        """Regenerate the device identity: new seed, new fingerprint, and — by
        default — a wiped UserData so sites see a genuinely fresh device.

        keep_cookies=True keeps session cookies (Default/Cookies) so logins
        survive; everything else (cache, storage, history) is still deleted.
        """
        profile = self.get_profile(name, create_if_missing=False)
        try:
            base_index = int(profile.get("base_preset", 0)) % len(HARDWARE_PRESETS)
        except (TypeError, ValueError):
            base_index = 0
        base = HARDWARE_PRESETS[base_index]
        # Re-derive from the base preset (not from the old fingerprint) so the
        # new identity is not correlated with the previous one.
        seed = random.getrandbits(64)
        profile.update(derive_identity(base, seed))
        profile["identity_seed"] = seed
        profile["diversified"] = True
        profile["custom"] = False
        self._wipe_user_data(self._path(name) / "UserData", keep_cookies=keep_cookies)
        _write_json(self._path(name) / "config.json", profile)
        return profile

    @staticmethod
    def _wipe_user_data(user_data: Path, keep_cookies: bool = False):
        """Delete the isolated storage directory.

        With keep_cookies, Default/Cookies and Default/Network/Cookies are
        moved out first and restored after the wipe (Chrome holds locks here,
        so the move goes to a temp dir outside the profile folder).
        """
        if not user_data.exists():
            user_data.mkdir(parents=True, exist_ok=True)
            return
        keepers = []
        tmp_dir = None
        if keep_cookies:
            tmp_dir = Path(tempfile.mkdtemp(dir=str(user_data.parent)))
            for idx, rel in enumerate((Path("Default") / "Cookies",
                                       Path("Default") / "Network" / "Cookies")):
                src = user_data / rel
                if src.exists():
                    dst = tmp_dir / f"{idx}_{rel.name}"
                    shutil.move(str(src), str(dst))
                    keepers.append((dst, rel))
        shutil.rmtree(user_data, ignore_errors=True)
        user_data.mkdir(parents=True, exist_ok=True)
        for dst, rel in keepers:
            target = user_data / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(dst), str(target))
        if tmp_dir is not None:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    def set_fingerprint(self, name: str, fields: dict) -> dict:
        """Manually set fingerprint fields on an existing profile."""
        if not fields:
            raise ProfileError("Tidak ada field fingerprint yang dikirim.")
        profile = self.get_profile(name, create_if_missing=False)
        overrides = _validate_custom_fingerprint(fields)
        profile.update(overrides)
        profile["custom"] = True
        profile["diversified"] = False
        _write_json(self._path(name) / "config.json", profile)
        return profile

    def list_profiles(self) -> list:
        profiles = []
        for item in sorted(self.profiles_dir.iterdir(), key=lambda p: p.name.lower()):
            if item.name.startswith(".") or not (item / "config.json").is_file():
                continue
            try:
                profiles.append(self._with_paths(_read_json(item / "config.json"), item))
            except (OSError, ValueError):
                continue
        return profiles

    # --- trash -----------------------------------------------------------------

    def trash_profile(self, name: str) -> str:
        """Move a profile to the trash. Returns the trash entry id."""
        src = self._path(name)
        if not (src / "config.json").exists():
            raise ProfileError(f"Profil '{name}' tidak ditemukan.")
        self.trash_dir.mkdir(exist_ok=True)
        trash_id = f"{src.name}__{int(time.time() * 1000)}"
        config = _read_json(src / "config.json")
        config["trashed_at"] = str(int(time.time()))
        _write_json(src / "config.json", config)
        _move_with_retry(src, self.trash_dir / trash_id)
        return trash_id

    def list_trash(self) -> list:
        if not self.trash_dir.exists():
            return []
        items = []
        for item in self.trash_dir.iterdir():
            if not (item / "config.json").is_file():
                continue
            try:
                cfg = _read_json(item / "config.json")
            except (OSError, ValueError):
                continue
            items.append({
                "trash_id": item.name,
                "name": cfg.get("name", item.name.split("__")[0]),
                "trashed_at": cfg.get("trashed_at", ""),
                "webgl_renderer": cfg.get("webgl_renderer", ""),
                "tags": cfg.get("tags", []),
                "folder": cfg.get("folder", ""),
            })
        items.sort(key=lambda x: x["trashed_at"], reverse=True)
        return items

    def _trash_path(self, trash_id: str) -> Path:
        if not isinstance(trash_id, str) or not re.match(r"^[A-Za-z0-9_\- ]{1,64}__\d+$", trash_id):
            raise ProfileError("Item trash tidak valid.")
        path = self.trash_dir / trash_id
        if not (path / "config.json").exists():
            raise ProfileError("Item trash tidak ditemukan.")
        return path

    def restore_profile(self, trash_id: str) -> dict:
        src = self._trash_path(trash_id)
        cfg = _read_json(src / "config.json")
        name = validate_name(cfg.get("name", ""))
        if self.exists(name):
            raise ProfileError(f"Profil '{name}' sudah ada. Hapus atau ganti nama profil itu dulu.")
        cfg.pop("trashed_at", None)
        _write_json(src / "config.json", cfg)
        dst = self.profiles_dir / name
        _move_with_retry(src, dst)
        return self._with_paths(cfg, dst)

    def purge_trash(self, trash_id: Optional[str] = None) -> int:
        """Permanently delete one trash entry, or all when trash_id is None."""
        targets = [self._trash_path(trash_id)] if trash_id else (
            [p for p in self.trash_dir.iterdir() if p.is_dir()] if self.trash_dir.exists() else [])
        for path in targets:
            shutil.rmtree(path, ignore_errors=True)
        return len(targets)

    def delete_profile(self, name: str) -> bool:
        """Permanently delete a profile (used by the CLI)."""
        try:
            path = self._path(name)
        except ProfileError:
            return False
        if path.exists():
            shutil.rmtree(path, ignore_errors=True)
            return True
        return False

    # --- templates --------------------------------------------------------------

    TEMPLATE_KEYS = (
        "base_preset", "os", "platform", "platform_version", "webgl_vendor", "webgl_renderer",
        "hardware_concurrency", "device_memory", "screen_width", "screen_height",
        "color_depth", "device_pixel_ratio", "languages", "user_agent",
        "webrtc_mode", "timezone_mode", "locale_mode", "geo_mode", "timezone", "locale",
        "canvas_noise", "webgl_noise", "audio_noise", "clientrects_noise",
        "font_noise", "port_scan_protection", "battery_spoof", "dnt",
        "media_mic", "media_cam", "media_spk", "on_close", "start_urls", "extra_args",
        "proxy", "folder", "tags", "notes", "color", "diversified", "custom",
    )

    def _templates_file(self) -> Path:
        return self.profiles_dir / ".templates.json"

    def list_templates(self) -> list:
        try:
            with open(self._templates_file(), "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, list) else []
        except (OSError, ValueError):
            return []

    def save_template(self, name: str, profile: dict, description: str = "") -> dict:
        name = validate_name(name)
        entry = {
            "id": f"tpl_{int(time.time() * 1000)}",
            "name": name,
            "description": str(description or "").strip()[:200],
            "created_at": str(int(time.time())),
            **{k: profile[k] for k in self.TEMPLATE_KEYS if k in profile},
            # Seeds are never saved: a template must not ship a shared identity.
            "canvas_seed": None, "audio_seed": None, "font_seed": None,
            "media_seed": None, "voice_seed": None, "identity_seed": None,
        }
        templates = [t for t in self.list_templates() if t.get("name") != name]
        templates.append(entry)
        with open(self._templates_file(), "w", encoding="utf-8") as f:
            json.dump(templates, f, indent=2)
        return entry

    def delete_template(self, template_id: str) -> bool:
        templates = self.list_templates()
        filtered = [t for t in templates if t.get("id") != template_id]
        if len(filtered) == len(templates):
            return False
        with open(self._templates_file(), "w", encoding="utf-8") as f:
            json.dump(filtered, f, indent=2)
        return True

    # --- import / export -------------------------------------------------------

    def export_profile(self, name: str) -> dict:
        """Profile settings only. Cookies and history in UserData are not included."""
        profile = self.get_profile(name, create_if_missing=False)
        profile.pop("user_data_dir", None)
        return profile

    def import_profile(self, data: dict, name: Optional[str] = None) -> dict:
        if not isinstance(data, dict):
            raise ProfileError("Format file import tidak valid.")
        name = validate_name(name or data.get("name", ""))
        if self.exists(name):
            raise ProfileError(f"Profil '{name}' sudah ada.")
        required = ("user_agent", "platform", "webgl_vendor", "webgl_renderer")
        missing = [k for k in required if not data.get(k)]
        if missing:
            raise ProfileError(f"File import tidak lengkap, kurang: {', '.join(missing)}.")

        profile_path = self.profiles_dir / name
        (profile_path / "UserData").mkdir(parents=True, exist_ok=True)
        profile = {k: v for k, v in data.items() if k not in ("user_data_dir", "trashed_at", "is_active", "pid")}
        profile.update({
            "name": name,
            "uuid": str(uuid.uuid4()),
            "created_at": str(int(time.time())),
            **_clean_typed_fields(data),
        })
        for seed in ("canvas_seed", "audio_seed", "font_seed",
                     "media_seed", "voice_seed"):
            if not isinstance(profile.get(seed), int):
                profile[seed] = random.randint(100000, 9999999)
        if not isinstance(profile.get("identity_seed"), int):
            profile["identity_seed"] = random.getrandbits(64)
        profile = self._with_paths(profile, profile_path)
        _write_json(profile_path / "config.json", profile)
        return profile
