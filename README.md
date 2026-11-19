<div align="center">
  <img src="frontend/public/assets/logo.png" alt="Anti's Detect Browser Logo" width="112" height="112" />

  # Anti's Detect Browser

  **Multi-Profile Anti-Detect Browser & Deterministic Fingerprint Isolation Engine**

  <p>
    <a href="README.md"><img src="https://img.shields.io/badge/Language-English%20(Active)-4F46E5?style=for-the-badge" alt="English" /></a>
    <a href="README.id.md"><img src="https://img.shields.io/badge/Bahasa-Indonesia-1E293B?style=for-the-badge" alt="Bahasa Indonesia" /></a>
  </p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6.svg)](#requirements)
  [![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB.svg)](#requirements)
  [![Auth](https://img.shields.io/badge/Auth-Google%20OAuth%202.0-4285F4.svg)](#quick-start-desktop-ui)
  [![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Saweria-F9A825.svg)](https://saweria.co/juremenn)

  ☕ **Support this project:** [Buy me a coffee on Saweria (https://saweria.co/juremenn)](https://saweria.co/juremenn)
</div>

---

## Table of Contents

1. [Overview](#1-overview)
2. [Core Features](#2-core-features)
3. [Requirements](#3-requirements)
4. [Quick Start (Desktop UI)](#4-quick-start-desktop-ui)
5. [Command-Line Usage (CLI)](#5-command-line-usage-cli)
6. [Standalone Chromium Extension](#6-standalone-chromium-extension)
7. [Project Structure](#7-project-structure)
8. [Playwright Automation Integration](#8-playwright-automation-integration)
9. [Support & Donation](#9-support--donation)
10. [License](#10-license)

---

## 1. Overview

**Anti's Detect Browser** is a multi-profile anti-detect browser management application and multi-vector fingerprint spoofing engine for Windows.

The desktop dashboard uses **Google OAuth 2.0 Sign-In** for user authentication while keeping all browser profiles, cookies, extensions, and isolated Chromium `UserData` directories stored locally on your machine with zero monthly subscription fees.

By combining Chrome DevTools Protocol (CDP) runtime emulation with a Manifest V3 main-world stealth engine, each profile operates as a separate physical device across standard Chromium browsers (Chromium, Brave, Google Chrome, and Microsoft Edge).

---

## 2. Core Features

- **Google OAuth 2.0 Sign-In & Local Data Storage**: Authenticate with your Google account via a local loopback callback (`127.0.0.1`), while all profile configurations and Chromium `UserData` directories stay on your local disk (`profiles/`).
- **Deterministic Identity Derivation**: Powered by a 64-bit `identity_seed` and Mulberry32 PRNG (`stealth_browser/fingerprint.py`). Every profile reproduces the exact same hardware fingerprint across sessions while remaining distinct from other profiles.
- **5-Vector Fingerprint Spoofing**:
  - **Canvas**: Seeded sub-pixel deterministic perturbation on `toDataURL`, `toBlob`, and `getImageData` without visual distortion.
  - **WebGL & GPU**: Overrides `UNMASKED_VENDOR_WEBGL` (`0x9245`) and `UNMASKED_RENDERER_WEBGL` (`0x9246`) with matched GPU signatures across NVIDIA GeForce RTX, AMD Radeon, Intel Iris/Arc, and Apple Silicon M1/M2/M3 presets.
  - **AudioContext**: Deterministic micro-perturbation on `AnalyserNode` FFT frequency bins and `AudioBuffer` channel data.
  - **Navigator, Client Hints & Screen**: Synchronizes `navigator.hardwareConcurrency`, `navigator.deviceMemory` (clamped at 8 GB per Chromium specification), `navigator.platform`, high-entropy `Sec-CH-UA` headers, and taskbar-adjusted screen dimensions.
  - **WebRTC, Geolocation, Timezone & DOM Geometry**: Supports automatic proxy-based resolution (`Based on proxy`) or manual overrides for timezone, locale, and coordinates, alongside `getBoundingClientRect` perturbation and local port-scan protection.
- **100 Built-In Hardware Presets**: Ships with 100 validated device presets (`stealth_browser/data/presets.json`): 35 Windows laptops/desktops, 25 macOS devices, 20 iOS devices, and 20 Android devices.
- **Native Windows Desktop Shell & React Dashboard**:
  - Runs as a native desktop window via `pywebview` (Edge WebView2) backed by a local HTTP API server bound strictly to `127.0.0.1:58888`.
  - Organize profiles with folders, tags, color labels, notes, search filters, trash bin recovery, fingerprint consistency evaluation, proxy testing (`HTTP`, `HTTPS`, `SOCKS4`, `SOCKS5`), custom `.crx` / unpacked extensions, and light/dark themes.
- **Multi-Browser Engine Discovery**: Automatically detects installed Playwright Chromium, Brave Browser, Google Chrome, and Microsoft Edge binaries on Windows.

---

## 3. Requirements

- **Operating System**: Windows 10 or Windows 11 (64-bit recommended)
- **Python**: Python 3.10 or newer
- **Internet Connection**: Required for Google OAuth 2.0 sign-in and online browsing/proxy verification
- **Browser Engine**: At least one Chromium-based browser installed (Google Chrome, Brave, Microsoft Edge, or Playwright Chromium)
- **Python Packages**:
  - `pywebview` (for the native desktop window shell)
  - `playwright` *(optional, only required if running Playwright automation scripts)*

```bash
pip install pywebview playwright
```

---

## 4. Quick Start (Desktop UI)

### Option 1: Double-Click Launcher (Recommended)
1. Double-click **`Buka_Anti_Detect_Browser.bat`** or **`AntiDetectBrowser.pyw`**.
2. Click **Continue with Google** on the login gate to sign in through your browser.

### Option 2: Run from Terminal
```bash
python desktop_app.pyw
```
Or start the local web server directly (opens on `http://127.0.0.1:58888`):
```bash
python web_ui_server.py
```

### Rebuilding the Frontend UI (Optional)
If you modify files inside `frontend/src/`:
```bash
cd frontend
npm install
npm run build
```

---

## 5. Command-Line Usage (CLI)

Use `run_stealth.py` to manage and launch profiles directly from a terminal or script:

```bash
# 1. List local profiles
python run_stealth.py --list

# 2. Create a profile (with optional proxy)
python run_stealth.py --create --profile store_account_1 --preset 0
python run_stealth.py --create --profile us_account_2 --preset 1 --proxy "http://user:pass@proxy.example.com:8080"

# 3. Launch a profile & test fingerprint
python run_stealth.py --profile store_account_1 --test
python run_stealth.py --profile store_account_1 --url "https://iphey.com"

# 4. Delete a profile
python run_stealth.py --delete store_account_1
```

---

## 6. Standalone Chromium Extension

The repository includes a standalone Manifest V3 extension under `extensions/anti-detect-browser/` and a packaged build at `Extension/anti-detect-browser.crx`:

- Categorized, searchable **DevicePicker** popup with all 100 hardware presets (Windows, macOS, iOS, Android).
- Dynamic `declarativeNetRequest` spoofing for `User-Agent` and `Sec-CH-UA*` Client Hints request headers.
- Main-world (`spoof-engine.js`) overrides for Canvas, WebGL, AudioContext, Navigator, and Screen geometry.

### How to Load Unpacked
1. Open `chrome://extensions/` in Chrome, Brave, or Edge and enable **Developer mode**.
2. Click **Load unpacked** and select the `extensions/anti-detect-browser` folder.

To rebuild the `.crx` package:
```bash
python scripts/build-extension.py
```

---

## 7. Project Structure

```text
Anti-s-Detect-Browser/
├── Buka_Anti_Detect_Browser.bat             # 1-click launcher for the native desktop UI
├── AntiDetectBrowser.pyw                    # Silent desktop app entrypoint (no console window)
├── desktop_app.pyw                          # pywebview (Edge WebView2) native shell & lifecycle manager
├── web_ui_server.py                         # Local backend HTTP API server (127.0.0.1:58888)
├── run_stealth.py                           # CLI runner for profile management & automation
├── selfcheck.html                           # Built-in local fingerprint verification page
├── app.ico                                  # Multi-resolution Windows application icon
├── stealth_browser/                         # Core anti-detect Python package
│   ├── profile_manager.py                   # Profile CRUD, validation, folders, tags, trash bin
│   ├── fingerprint.py                       # Mulberry32 deterministic PRNG & UA-CH metadata builder
│   ├── stealth_hooks.py                     # JavaScript injection generator for 5 fingerprint vectors
│   ├── cdp_apply.py                         # Chrome DevTools Protocol runtime emulation & overrides
│   ├── launcher.py                          # Browser discovery, port allocation & process spawning
│   ├── consistency.py                       # Profile fingerprint consistency evaluator
│   ├── proxy_utils.py                       # Proxy parsing, connectivity checking & GeoIP lookup
│   └── data/presets.json                    # 100 categorized hardware presets
├── extensions/anti-detect-browser/          # Standalone Manifest V3 anti-detect extension source
├── Extension/anti-detect-browser.crx        # Packaged CRX extension build
├── frontend/                                # React 19 + TypeScript + Vite source for the dashboard UI
├── web_ui/                                  # Compiled static frontend assets served by web_ui_server.py
├── scripts/                                 # Build scripts for icons, presets, extension & desktop exe
└── tests/                                   # Unit and integration tests (API, CRX install, profiles)
```

---

## 8. Playwright Automation Integration

You can integrate `ProfileManager` and `generate_stealth_script` directly into Python Playwright workflows:

```python
import asyncio
from playwright.async_api import async_playwright
from stealth_browser.profile_manager import ProfileManager
from stealth_browser.stealth_hooks import generate_stealth_script

async def main():
    mgr = ProfileManager()
    profile = mgr.get_profile("store_account_1")
    stealth_js = generate_stealth_script(profile)

    async with async_playwright() as p:
        context = await p.chromium.launch_persistent_context(
            user_data_dir=profile["user_data_dir"],
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                f"--user-agent={profile['user_agent']}",
            ],
        )
        await context.add_init_script(stealth_js)

        page = await context.new_page()
        await page.goto("https://browserleaks.com/canvas")
        await asyncio.sleep(10)
        await context.close()

asyncio.run(main())
```

---

## 9. Support & Donation

If this project saves you time or helps your workflow, you can support its development by buying me a coffee:

- ☕ **Buy me a coffee (Saweria):** [https://saweria.co/juremenn](https://saweria.co/juremenn)

---

## 10. License

Licensed under the [MIT License](LICENSE). Copyright (c) 2026 Nirvana Handika Putra.
