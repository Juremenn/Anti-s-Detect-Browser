"""
fingerprint.py - Deterministic identity derivation.

Every derived value (GPU variant, cores, RAM, screen, UA build digits, media
device ids, ...) comes from one 64-bit `identity_seed` through a Mulberry32
PRNG, so the same seed always reproduces the same fingerprint (a real device
reports the same values in every session) while different profiles differ.

Also builds the UA-CH userAgentMetadata that must agree with the User-Agent
header, and resolves timezone/locale/geolocation from the proxy country when
the profile is set to "Based on proxy".
"""

from __future__ import annotations

_MASK32 = 0xFFFFFFFF


def mulberry32(seed: int):
    """Classic Mulberry32: fast, well-distributed, deterministic from one uint32."""
    state = seed & _MASK32

    def next_u32() -> int:
        nonlocal state
        state = (state + 0x6D2B79F5) & _MASK32
        t = state
        t = (t ^ (t >> 15)) * (t | 1) & _MASK32
        t = (t ^ ((t + ((t ^ (t >> 7)) * (t | 61) & _MASK32)) & _MASK32)) & _MASK32
        return (t ^ (t >> 14)) & _MASK32

    return next_u32


class SeededRandom:
    """random.Random-compatible subset (randint/choice/choices) over mulberry32."""

    def __init__(self, seed: int):
        seed &= _MASK32 if seed else 0
        self._next = mulberry32(seed or 0x9E3779B9)

    def random(self) -> float:
        return self._next() / 4294967296.0

    def randint(self, a: int, b: int) -> int:
        if b < a:
            a, b = b, a
        return a + int(self.random() * (b - a + 1))

    def choice(self, seq):
        return seq[self.randint(0, len(seq) - 1)]

    def choices(self, seq, weights=None):
        if not weights:
            return [self.choice(seq)]
        total = sum(weights)
        pick = self.random() * total
        acc = 0.0
        for item, w in zip(seq, weights):
            acc += w
            if pick < acc:
                return [item]
        return [seq[-1]]

    def randbytes(self, n: int) -> bytes:
        out = bytearray()
        while len(out) < n:
            out += self._next().to_bytes(4, "little")
        return bytes(out[:n])


# Chrome grease brands (the decoy brand always present in real UA-CH).
_GREASE_BRANDS = (
    ("Not_A Brand", "99"),
    ("Not A;Brand", "99"),
    ("Not.A/Brand", "99"),
    ("Not/A)Brand", "24"),
    ("Not)A;Brand", "8"),
)

_PLATFORM_NAME = {"win": "Windows", "mac": "macOS", "linux": "Linux"}
_DEFAULT_PLATFORM_VERSION = {"win": "15.0.0", "mac": "14.5.0", "linux": "6.8.0"}
_DEFAULT_AVAIL_OFFSET = {"win": 40, "mac": 25, "linux": 30}


def gpu_family(renderer: str) -> str:
    r = str(renderer or "")
    if "Apple" in r:
        return "apple"
    if "NVIDIA" in r:
        return "nvidia"
    if "Intel" in r:
        return "intel"
    return "amd"


def derive_identity(base: dict, seed: int) -> dict:
    """Deterministically derive a coherent fingerprint from (base preset, seed).

    Uses the same pools as the legacy diversifier (imported from
    profile_manager to avoid a second copy) but runs on a seeded PRNG.
    """
    from .profile_manager import (_GPU_VARIANTS, _MEMORY_BY_FAMILY,
                                  _MAC_SCREENS, _WIN_SCREENS)

    rng = SeededRandom(seed)
    family = gpu_family(base.get("webgl_renderer", ""))
    pool = _GPU_VARIANTS[family]

    ua = str(base.get("user_agent", ""))
    # Only the build/patch digits vary; the Chrome major stays, so the value
    # never contradicts the Sec-CH-UA header the engine itself sends.
    import re
    ua = re.sub(r"(Chrome/\d+\.0\.)(\d+)\.(\d+)",
                lambda m: f"{m.group(1)}{rng.randint(6200, 6900)}.{rng.randint(0, 120)}", ua)

    memories, weights = zip(*_MEMORY_BY_FAMILY[family])
    screen = rng.choice(_MAC_SCREENS if family == "apple" else _WIN_SCREENS)
    os_id = base.get("os") or ("mac" if family == "apple" else "win")

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
        "media_seed": rng.randint(100000, 9999999),
        "voice_seed": rng.randint(100000, 9999999),
        "grease_index": rng.randint(0, len(_GREASE_BRANDS) - 1),
        "avail_offset": _DEFAULT_AVAIL_OFFSET.get(os_id, 40),
    }


def build_user_agent_metadata(profile: dict, engine_version: str, brand_from_path: str = "") -> dict | None:
    """UA-CH metadata consistent with the User-Agent string and the real engine.

    engine_version: full '131.0.6778.85' from CDP /json/version. Returns None
    when the engine version is unknown (nothing to agree with).
    """
    full = str(engine_version or "").strip()
    if not full or not full[0].isdigit():
        return None
    major = full.split(".")[0]
    grease = _GREASE_BRANDS[int(profile.get("grease_index") or 0) % len(_GREASE_BRANDS)]

    os_id = profile.get("os") or "win"
    if "apple" in str(profile.get("webgl_renderer", "")).lower():
        os_id = "mac"
    platform = _PLATFORM_NAME.get(os_id, "Windows")

    # Brand list: grease + Chromium (+ product brand for branded builds).
    chromium = ("Chromium", full)
    product = None
    p = (brand_from_path or "").lower().replace("\\", "/")
    if "chrome.exe" in p and "google/chrome" in p:
        product = ("Google Chrome", full)
    elif "msedge.exe" in p or "edge" in p:
        product = ("Microsoft Edge", full)
    elif "brave" in p:
        product = ("Brave", full)
    brands = [grease, chromium] + ([product] if product else [])
    full_list = [grease, chromium] + ([product] if product else [])

    return {
        "brands": [{"brand": b, "version": v} for b, v in brands],
        "fullVersionList": [{"brand": b, "version": v} for b, v in full_list],
        "platform": platform,
        "platformVersion": str(profile.get("platform_version")
                               or _DEFAULT_PLATFORM_VERSION.get(os_id, "15.0.0")),
        "architecture": "x86",
        "bitness": "64",
        "wow64": False,
        "model": "",
        "mobile": False,
    }


# --- "Based on proxy" resolution ----------------------------------------------
# Imported from the consistency module so both ends use the same tables.
from .consistency import _TZ_BY_COUNTRY, _LANG_BY_COUNTRY  # noqa: E402

# Rough capital-area coordinates per country (approximate by design: a real
# device's geo is never a pin-point, and accuracy is set wide on purpose).
_GEO_BY_COUNTRY = {
    "US": (38.9, -77.0), "CA": (45.4, -75.7), "GB": (51.5, -0.13), "DE": (52.5, 13.4),
    "FR": (48.85, 2.35), "NL": (52.37, 4.9), "ID": (-6.2, 106.85), "SG": (1.35, 103.82),
    "JP": (35.68, 139.69), "KR": (37.57, 126.98), "IN": (28.6, 77.2), "AU": (-33.87, 151.2),
    "BR": (-23.55, -46.63), "MX": (19.43, -99.13), "RU": (55.75, 37.62), "CN": (39.9, 116.4),
    "HK": (22.32, 114.17), "TW": (25.03, 121.57), "TH": (13.75, 100.5), "VN": (21.03, 105.85),
    "MY": (3.14, 101.69), "PH": (14.6, 120.98), "TR": (41.0, 28.95), "AE": (24.45, 54.38),
    "SA": (24.71, 46.68), "ZA": (-26.2, 28.04), "NG": (9.07, 7.49), "EG": (30.04, 31.24),
    "AR": (-34.6, -58.38), "CL": (-33.45, -70.66), "PL": (52.23, 21.0), "ES": (40.42, -3.7),
    "IT": (41.9, 12.5), "SE": (59.33, 18.07), "NO": (59.91, 10.75), "UA": (50.45, 30.52),
    "BD": (23.81, 90.41), "PK": (33.68, 73.05), "IR": (35.7, 51.42), "IL": (31.78, 35.22),
    "CH": (46.95, 7.45), "AT": (48.21, 16.37), "BE": (50.85, 4.35), "FI": (60.17, 24.94),
    "DK": (55.68, 12.57), "IE": (53.35, -6.26), "PT": (38.72, -9.14), "CZ": (50.08, 14.44),
    "RO": (44.43, 26.1), "GR": (37.98, 23.73), "HU": (47.5, 19.04),
}


def _locale_pair(country: str) -> list:
    sub = _LANG_BY_COUNTRY.get(country or "", "en")
    if sub == "en":
        return ["en-US", "en"]
    if sub == "zh":
        return [f"zh-{country}", "zh"]
    return [f"{sub}-{country}", sub]


def resolve_overrides(profile: dict, proxy_country: str | None) -> dict:
    """Compute the CDP override values for one launch.

    Returns {} entries only for values that should be overridden; anything left
    empty means "leave the real engine value in place".
    """
    out: dict = {"timezone": "", "languages": None, "geo": None}

    tz_mode = profile.get("timezone_mode", "proxy")
    if tz_mode == "manual" and profile.get("timezone"):
        out["timezone"] = profile["timezone"]
    elif tz_mode == "proxy" and proxy_country:
        out["timezone"] = _TZ_BY_COUNTRY.get(proxy_country, "")

    if profile.get("locale_mode", "proxy") == "manual" and profile.get("languages"):
        out["languages"] = list(profile["languages"])
    elif proxy_country:
        # "Based on proxy": derive from the country so Accept-Language,
        # navigator.languages and the timezone tell the same story.
        out["languages"] = _locale_pair(proxy_country)

    geo_mode = profile.get("geo_mode", "proxy")
    if geo_mode == "manual" and profile.get("geo_lat") is not None:
        out["geo"] = {
            "latitude": float(profile["geo_lat"]),
            "longitude": float(profile.get("geo_lon", 0.0)),
            "accuracy": float(profile.get("geo_accuracy") or 100.0),
        }
    elif geo_mode == "proxy" and proxy_country and proxy_country in _GEO_BY_COUNTRY:
        lat, lon = _GEO_BY_COUNTRY[proxy_country]
        out["geo"] = {"latitude": lat, "longitude": lon, "accuracy": 1200.0}
    # geo_mode == "block" is enforced with Browser.setPermission (denied),
    # not with a fake coordinate.
    return out
