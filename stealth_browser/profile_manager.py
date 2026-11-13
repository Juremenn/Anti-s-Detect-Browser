"""
profile_manager.py - Local browser profiles: config, isolated UserData, tags, folders, trash.
"""

import json
import random
import re
import shutil
import time
import uuid
from pathlib import Path
from typing import Optional

BASE_PROFILES_DIR = Path(__file__).resolve().parent.parent / "profiles"
TRASH_DIRNAME = ".trash"

# Letters, digits, space, dash, underscore. No dots or slashes, so a name can never
# escape the profiles directory (delete uses rmtree on this path).
NAME_RE = re.compile(r"^[A-Za-z0-9_\- ]{1,64}$")

EDITABLE_FIELDS = {"tags", "folder", "notes", "proxy"}

HARDWARE_PRESETS = [
    {
        "id": "win-rtx-3070",
        "name": "Windows RTX 3070",
        "label": "Windows · RTX 3070 · 8C/8GB · 1920×1080",
        "os": "win",
        "platform": "Win32",
        "platform_version": "15.0.0",
        "webgl_vendor": "Google Inc. (NVIDIA)",
        "webgl_renderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "gpu_vendor": "Google Inc. (NVIDIA)",
        "gpu_renderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "cores": 8,
        "hardware_concurrency": 8,
        "memory_gb": 8,
        "device_memory": 8,
        "screen": [1920, 1080],
        "screen_width": 1920,
        "screen_height": 1080,
        "color_depth": 24,
        "device_pixel_ratio": 1.0,
        "languages": ["en-US", "en"],
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    },
    {
        "id": "win-rtx-4080",
        "name": "Windows RTX 4080",
        "label": "Windows · RTX 4080 · 16C/16GB · 2560×1440",
        "os": "win",
        "platform": "Win32",
        "platform_version": "15.0.0",
        "webgl_vendor": "Google Inc. (NVIDIA)",
        "webgl_renderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "gpu_vendor": "Google Inc. (NVIDIA)",
        "gpu_renderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "cores": 16,
        "hardware_concurrency": 16,
        "memory_gb": 16,
        "device_memory": 16,
        "screen": [2560, 1440],
        "screen_width": 2560,
        "screen_height": 1440,
        "color_depth": 24,
        "device_pixel_ratio": 1.0,
        "languages": ["en-US", "en"],
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    },
    {
        "id": "win-intel-iris",
        "name": "Windows Intel Iris Xe",
        "label": "Windows · Intel Iris Xe · 8C/8GB · 1920×1080",
        "os": "win",
        "platform": "Win32",
        "platform_version": "15.0.0",
        "webgl_vendor": "Google Inc. (Intel)",
        "webgl_renderer": "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "gpu_vendor": "Google Inc. (Intel)",
        "gpu_renderer": "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "cores": 8,
        "hardware_concurrency": 8,
        "memory_gb": 8,
        "device_memory": 8,
        "screen": [1920, 1080],
        "screen_width": 1920,
        "screen_height": 1080,
        "color_depth": 24,
        "device_pixel_ratio": 1.0,
        "languages": ["en-US", "en"],
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    },
    {
        "id": "mac-apple-m2",
        "name": "macOS Apple M2",
        "label": "macOS · Apple M2 · 8C/8GB · 2560×1600",
        "os": "mac",
        "platform": "MacIntel",
        "platform_version": "14.5.0",
        "webgl_vendor": "Google Inc. (Apple)",
        "webgl_renderer": "ANGLE (Apple, Apple M2, OpenGL 4.1)",
        "gpu_vendor": "Google Inc. (Apple)",
        "gpu_renderer": "ANGLE (Apple, Apple M2, OpenGL 4.1)",
        "cores": 8,
        "hardware_concurrency": 8,
        "memory_gb": 8,
        "device_memory": 8,
        "screen": [2560, 1600],
        "screen_width": 2560,
        "screen_height": 1600,
        "color_depth": 30,
        "device_pixel_ratio": 2.0,
        "languages": ["en-US", "en"],
        "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    },
    {
        "id": "linux-amd-rx6800",
        "name": "Linux Radeon RX 6800",
        "label": "Linux · RX 6800 · 12C/16GB · 1920×1080",
        "os": "linux",
        "platform": "Linux x86_64",
        "platform_version": "6.5.0",
        "webgl_vendor": "Google Inc. (AMD)",
        "webgl_renderer": "ANGLE (AMD, AMD Radeon RX 6800 XT (RADV NAVI21), OpenGL 4.6)",
        "gpu_vendor": "Google Inc. (AMD)",
        "gpu_renderer": "ANGLE (AMD, AMD Radeon RX 6800 XT (RADV NAVI21), OpenGL 4.6)",
        "cores": 12,
        "hardware_concurrency": 12,
        "memory_gb": 16,
        "device_memory": 16,
        "screen": [1920, 1080],
        "screen_width": 1920,
        "screen_height": 1080,
        "color_depth": 24,
        "device_pixel_ratio": 1.0,
        "languages": ["en-US", "en"],
        "user_agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    }
]


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


def _clean_fields(fields: dict) -> dict:
    out = {}
    for key in EDITABLE_FIELDS & set(fields):
        value = fields[key]
        if key == "tags":
            out[key] = _clean_tags(value)
        else:
            out[key] = ("" if value is None else str(value)).strip()[:500 if key == "notes" else 200]
    if "proxy" in out:
        out["proxy"] = validate_proxy(out["proxy"])
    return out


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

    # --- paths -----------------------------------------------------------------

    def _path(self, name: str) -> Path:
        return self.profiles_dir / validate_name(name)

    def exists(self, name: str) -> bool:
        return (self._path(name) / "config.json").exists()

    def _with_paths(self, profile: dict, profile_path: Path) -> dict:
        # The stored path may come from another machine (import) or an old location;
        # the folder on disk is the source of truth.
        profile = dict(profile)
        profile["user_data_dir"] = str(profile_path / "UserData")
        profile.setdefault("tags", [])
        profile.setdefault("folder", "")
        profile.setdefault("notes", "")
        profile.setdefault("proxy", "")
        return profile

    # --- CRUD ------------------------------------------------------------------

    def create_profile(self, name: str, preset_index: int = 0, proxy: Optional[str] = None,
                       tags=None, folder: str = "", notes: str = "",
                       diversify: bool = True, custom: Optional[dict] = None) -> dict:
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
        fingerprint = _derive_fingerprint(preset, random.Random()) if diversify else {}
        overrides = _validate_custom_fingerprint(custom or {})
        profile = {
            "name": name,
            "uuid": str(uuid.uuid4()),
            "created_at": str(int(time.time())),
            "user_data_dir": str(user_data_path),
            "mask_webrtc": True,
            "base_preset": preset_index,
            "diversified": bool(diversify) and not overrides,
            "custom": bool(overrides),
            **preset,
            **fingerprint,
            **overrides,
            **_clean_fields({"proxy": proxy, "tags": tags or [], "folder": folder, "notes": notes}),
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
        return self._with_paths(_read_json(config_file), profile_path)

    def update_profile(self, name: str, fields: dict) -> dict:
        profile = self.get_profile(name, create_if_missing=False)
        profile.update(_clean_fields(fields or {}))
        _write_json(self._path(name) / "config.json", profile)
        return profile

    def refresh_fingerprint(self, name: str) -> dict:
        """Regenerate the device identity: GPU variant, cores, RAM, screen, UA build, all seeds."""
        profile = self.get_profile(name, create_if_missing=False)
        profile.update(_derive_fingerprint(profile, random.Random()))
        profile["diversified"] = True
        profile["custom"] = False
        _write_json(self._path(name) / "config.json", profile)
        return profile

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
            **_clean_fields(data),
        })
        for seed in ("canvas_seed", "audio_seed", "font_seed"):
            if not isinstance(profile.get(seed), int):
                profile[seed] = random.randint(100000, 9999999)
        profile = self._with_paths(profile, profile_path)
        _write_json(profile_path / "config.json", profile)
        return profile
