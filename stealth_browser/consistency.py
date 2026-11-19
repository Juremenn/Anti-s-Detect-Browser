"""
consistency.py - Validate that a profile's fingerprint values could come from one
real device, and score the result 0-100.

Rules are either "errors" (impossible or self-contradictory values; a site can
detect them) or "warnings" (plausible but suspicious; a site can flag them).
Every finding carries an optional fix: {field: value} the caller can apply.
"""

UA_PLATFORM_TOKEN = {
    "win": "Windows",
    "mac": "macOS",
    "linux": "Linux",
    "android": "Android",
    "ios": "iPhone",
    "chromeos": "Chrome OS",
}

# navigator.platform values per OS
PLATFORM_BY_OS = {
    "win": "Win32",
    "mac": "MacIntel",
    "linux": "Linux x86_64",
    "android": "Linux armv8l",
    "ios": "iPhone",
}

VALID_PLATFORMS = ("Win32", "MacIntel", "Linux x86_64", "iPhone", "iPad", "Linux armv8l", "Linux aarch64")

VALID_DEVICE_MEMORY = (0.25, 0.5, 1, 2, 4, 8)

# Timezone examples per country code; used only when both sides are known.
_TZ_BY_COUNTRY = {
    "US": "America/New_York", "CA": "America/Toronto", "GB": "Europe/London",
    "DE": "Europe/Berlin", "FR": "Europe/Paris", "NL": "Europe/Amsterdam",
    "ID": "Asia/Jakarta", "SG": "Asia/Singapore", "JP": "Asia/Tokyo",
    "KR": "Asia/Seoul", "IN": "Asia/Kolkata", "AU": "Australia/Sydney",
    "BR": "America/Sao_Paulo", "MX": "America/Mexico_City", "RU": "Europe/Moscow",
    "CN": "Asia/Shanghai", "HK": "Asia/Hong_Kong", "TW": "Asia/Taipei",
    "TH": "Asia/Bangkok", "VN": "Asia/Ho_Chi_Minh", "MY": "Asia/Kuala_Lumpur",
    "PH": "Asia/Manila", "TR": "Europe/Istanbul", "AE": "Asia/Dubai",
    "SA": "Asia/Riyadh", "ZA": "Africa/Johannesburg", "NG": "Africa/Lagos",
    "EG": "Africa/Cairo", "AR": "America/Argentina/Buenos_Aires", "CL": "America/Santiago",
    "PL": "Europe/Warsaw", "ES": "Europe/Madrid", "IT": "Europe/Rome",
    "SE": "Europe/Stockholm", "NO": "Europe/Oslo", "UA": "Europe/Kyiv",
    "BD": "Asia/Dhaka", "PK": "Asia/Karachi", "IR": "Asia/Tehran",
    "IL": "Asia/Jerusalem", "CH": "Europe/Zurich", "AT": "Europe/Vienna",
    "BE": "Europe/Brussels", "FI": "Europe/Helsinki", "DK": "Europe/Copenhagen",
    "IE": "Europe/Dublin", "PT": "Europe/Lisbon", "CZ": "Europe/Prague",
    "RO": "Europe/Bucharest", "GR": "Europe/Athens", "HU": "Europe/Budapest",
}

# Language hints per country: just the primary subtag that a local user would
# most likely have first in navigator.languages.
_LANG_BY_COUNTRY = {
    "US": "en", "GB": "en", "CA": "en", "AU": "en", "NZ": "en", "IE": "en",
    "DE": "de", "AT": "de", "CH": "de", "FR": "fr", "BE": "fr", "NL": "nl",
    "ES": "es", "MX": "es", "AR": "es", "CL": "es", "CO": "es", "PE": "es",
    "BR": "pt", "PT": "pt", "IT": "it", "PL": "pl", "CZ": "cs", "SK": "sk",
    "RU": "ru", "UA": "uk", "TR": "tr", "GR": "el", "RO": "ro", "HU": "hu",
    "SE": "sv", "NO": "nb", "DK": "da", "FI": "fi", "IS": "is",
    "ID": "id", "MY": "ms", "SG": "en", "TH": "th", "VN": "vi",
    "PH": "en", "JP": "ja", "KR": "ko", "CN": "zh", "TW": "zh", "HK": "zh",
    "IN": "hi", "PK": "ur", "BD": "bn", "LK": "si", "NP": "ne",
    "SA": "ar", "AE": "ar", "EG": "ar", "IL": "he", "IR": "fa",
    "ZA": "en", "NG": "en", "KE": "en", "TZ": "sw", "ET": "am",
}


def gpu_family(renderer: str) -> str:
    r = str(renderer or "").lower()
    if "apple" in r:
        return "apple"
    if "nvidia" in r:
        return "nvidia"
    if "intel" in r:
        return "intel"
    if "amd" in r or "radeon" in r:
        return "amd"
    if "adreno" in r:
        return "adreno"
    if "mali" in r or "immortalis" in r:
        return "mali"
    if "xclipse" in r:
        return "xclipse"
    if "llvmpipe" in r or "swiftshader" in r or "software" in r:
        return "software"
    return "unknown"


def evaluate(profile: dict, engine_version: str = None, proxy_country: str = None) -> dict:
    """Score a profile dict (or an in-progress dialog state) for consistency.

    Returns {"score": int, "errors": [...], "warnings": [...]} where each finding
    is {"rule", "message", "fix": {...} or None}.
    """
    errors: list = []
    warnings: list = []

    os_id = str(profile.get("os") or "")
    platform = str(profile.get("platform") or "")
    renderer = str(profile.get("webgl_renderer") or "")
    ua = str(profile.get("user_agent") or "")
    memory = profile.get("device_memory")
    cores = profile.get("hardware_concurrency")
    width = profile.get("screen_width")
    height = profile.get("screen_height")
    dpr = profile.get("device_pixel_ratio")
    languages = profile.get("languages") or []
    timezone = str(profile.get("timezone") or "")
    color_depth = profile.get("color_depth")

    def add(target, rule, message, fix=None):
        target.append({"rule": rule, "message": message, "fix": fix or None})

    # 1. GPU must match the OS (Apple GPU is Metal-only; D3D11 is Windows-only).
    family = gpu_family(renderer)
    if renderer:
        if family == "apple" and os_id and os_id not in ("mac", "ios"):
            add(errors, "gpu_os",
                "Apple GPU hanya mungkin di macOS atau iOS.",
                {"os": "mac", "platform": "MacIntel"})
        if family in ("adreno", "mali", "xclipse") and os_id and os_id != "android":
            add(errors, "gpu_os",
                "GPU Adreno/Mali/Xclipse hanya ada di Android.",
                {"os": "android", "platform": "Linux armv8l"})
        if family in ("nvidia", "intel", "amd") and "d3d11" in renderer.lower() and os_id and os_id != "win":
            add(errors, "gpu_os",
                "Renderer Direct3D11 hanya ada di Windows.",
                {"os": "win", "platform": "Win32"})
        if os_id == "linux" and "d3d11" in renderer.lower():
            add(errors, "gpu_os",
                "Renderer Direct3D11 tidak ada di Linux.",
                {"webgl_renderer": renderer.replace("Direct3D11", "OpenGL 4.6")
                                            .replace("vs_5_0 ps_5_0, D3D11", "OpenGL 4.6")})
    else:
        add(errors, "gpu_os", "WebGL renderer kosong.")

    # 2. navigator.platform must agree with the UA platform token.
    ua_token = ""
    for os_key, token in UA_PLATFORM_TOKEN.items():
        if token in ua:
            ua_token = token
            break
    expected_platform = PLATFORM_BY_OS.get(os_id, platform)
    if platform and platform not in VALID_PLATFORMS:
        add(errors, "platform",
            f"navigator.platform '{platform}' bukan nilai valid.",
            {"platform": expected_platform or "Win32"})
    if ua_token and platform:
        if ua_token == "Windows" and platform != "Win32":
            add(errors, "platform",
                "UA bilang Windows tapi navigator.platform bukan Win32.",
                {"platform": "Win32"})
        if ua_token == "macOS" and platform != "MacIntel":
            add(errors, "platform",
                "UA bilang macOS tapi navigator.platform bukan MacIntel.",
                {"platform": "MacIntel"})
        if ua_token == "iPhone" and platform not in ("iPhone", "iPad"):
            add(errors, "platform",
                "UA bilang iPhone tapi navigator.platform bukan iPhone/iPad.",
                {"platform": "iPhone"})
        if ua_token == "Android" and not (platform.startswith("Linux arm") or platform.startswith("Linux aarch")):
            add(errors, "platform",
                "UA bilang Android tapi navigator.platform bukan Linux ARM.",
                {"platform": "Linux armv8l"})
        if ua_token == "Linux" and not platform.startswith("Linux"):
            add(errors, "platform",
                "UA bilang Linux tapi navigator.platform bukan Linux.",
                {"platform": "Linux x86_64"})
                "UA bilang Linux tapi navigator.platform bukan Linux.",
                {"platform": "Linux x86_64"})

    # 3. deviceMemory: Chrome reports only these steps, capped at 8.
    if memory is not None:
        try:
            m = float(memory)
        except (TypeError, ValueError):
            m = None
        if m is None or m not in VALID_DEVICE_MEMORY:
            add(errors, "device_memory",
                "RAM harus salah satu dari 0.25/0.5/1/2/4/8 GB (batas report Chrome).",
                {"device_memory": 8})

    # 4. CPU cores sanity.
    if cores is not None:
        try:
            c = int(cores)
        except (TypeError, ValueError):
            c = 0
        if not 1 <= c <= 128:
            add(errors, "hardware_concurrency",
                "Jumlah core harus di antara 1 dan 128.",
                {"hardware_concurrency": 8})

    # 5. Screen realism.
    if width and height:
        try:
            w, h = int(width), int(height)
        except (TypeError, ValueError):
            w = h = 0
        if w and h:
            if not (400 <= w <= 7680 and 400 <= h <= 7680):
                add(errors, "screen",
                    "Resolusi harus di antara 400 dan 7680 piksel.",
                    {"screen_width": 1920, "screen_height": 1080})
            elif h > w:
                add(warnings, "screen",
                    "Resolusi landscape lebih umum untuk desktop; orientasi portrait mencurigakan.",
                    {"screen_width": h, "screen_height": w})
            elif (w, h) not in {(1920, 1080), (2560, 1440), (1366, 768), (1600, 900),
                                (1680, 1050), (1536, 864), (2560, 1600), (1512, 982),
                                (1800, 1169), (2056, 1329), (3840, 2160), (1440, 900),
                                (1280, 720), (1920, 1200)}:
                add(warnings, "screen",
                    f"Resolusi {w}x{h} tidak umum; deteksi statistik bisa mencurigai.")
        if dpr is not None:
            try:
                d = float(dpr)
            except (TypeError, ValueError):
                d = 0
            if d and family == "apple" and d < 1.5:
                add(warnings, "screen",
                    "Mac umumnya memakai devicePixelRatio 2 (Retina).",
                    {"device_pixel_ratio": 2.0})
            elif d and family != "apple" and d not in (1.0, 1.25, 1.5):
                add(warnings, "screen",
                    "devicePixelRatio Windows/Linux umumnya 1, 1.25 atau 1.5.")

    # 6. Language list shape.
    if not languages:
        add(warnings, "languages",
            "Bahasa kosong; website melihat navigator.languages kosong.",
            {"languages": ["en-US", "en"]})
    elif len(languages) > 6:
        add(errors, "languages",
            "Maksimal 6 bahasa (Chrome UI limit).",
            {"languages": languages[:6]})

    # 7. Browser version must match the real engine.
    if engine_version and ua:
        import re
        m_ua = re.search(r"Chrome/(\d+)\.", ua)
        m_eng = re.match(r"(\d+)\.", str(engine_version))
        if m_ua and m_eng and m_ua.group(1) != m_eng.group(1):
            add(errors, "engine_version",
                f"UA Chrome/{m_ua.group(1)} tidak cocok dengan versi engine "
                f"{m_eng.group(1)} yang benar-benar berjalan.",
                {"user_agent": re.sub(
                    r"Chrome/\d+\.",
                    f"Chrome/{m_eng.group(1)}.", ua)})
        elif m_ua and not m_eng:
            add(warnings, "engine_version",
                "Versi engine tidak terdeteksi; UA tidak bisa diverifikasi.")

    # 8. Timezone vs proxy country.
    if timezone and proxy_country:
        expected_tz = _TZ_BY_COUNTRY.get(proxy_country)
        if expected_tz and timezone.split("/") and timezone not in (
                expected_tz,) and not timezone.startswith(expected_tz.split("/")[0]):
            add(warnings, "timezone_proxy",
                f"Timezone '{timezone}' tidak cocok dengan negara IP proxy ({proxy_country}).",
                {"timezone": expected_tz})
    elif timezone and not proxy_country:
        add(warnings, "timezone_proxy",
            "Tanpa proxy, timezone harus cocok dengan IP lokal (tidak bisa diverifikasi offline).")

    # 9. Language vs proxy country (warning only, per spec).
    if languages and proxy_country:
        primary = str(languages[0]).split("-")[0].lower()
        expected_lang = _LANG_BY_COUNTRY.get(proxy_country)
        if expected_lang and primary != expected_lang:
            add(warnings, "lang_proxy",
                f"Bahasa utama '{languages[0]}' tidak biasa untuk pengunjung dari {proxy_country}.")

    score = 100 - 15 * len(errors) - 5 * len(warnings)
    return {"score": max(0, score), "errors": errors, "warnings": warnings}
