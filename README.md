<div id="top"></div>

<div align="center">
  <img src="frontend/public/assets/logo.png" alt="Anti's Detect Browser Logo" width="112" height="112" />

  # Anti's Detect Browser

  **100% Offline Multi-Profile Anti-Detect Browser & Fingerprint Isolation Engine**

  **Language / Bahasa:** [**English** (Default)](#english) | [**Bahasa Indonesia**](#bahasa-indonesia)

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6.svg)](#requirements)
  [![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB.svg)](#requirements)
  [![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Saweria-F9A825.svg)](https://saweria.co/juremenn)

  ☕ **Support this project / Dukung proyek ini:** [Buy me a coffee on Saweria (https://saweria.co/juremenn)](https://saweria.co/juremenn)
</div>

---

<div id="english"></div>

## English (Default)

**Anti's Detect Browser** is a standalone, 100% offline anti-detect browser management application and multi-vector fingerprint spoofing engine for Windows. It runs directly on your machine without cloud accounts, login requirements, or monthly subscription fees.

### Table of Contents
1. [Overview](#overview)
2. [Core Features](#core-features)
3. [Project Structure](#project-structure)
4. [Requirements](#requirements)
5. [Quick Start (Desktop UI)](#quick-start-desktop-ui)
6. [Command-Line Usage (CLI)](#command-line-usage-cli)
7. [Standalone Chromium Extension](#standalone-chromium-extension)
8. [Playwright Automation Integration](#playwright-automation-integration)
9. [Contributors](#contributors)
10. [Support & Donation](#support--donation)
11. [License](#license)

---

### Overview

**Anti's Detect Browser** provides isolated browser environments and deterministic hardware fingerprint control across standard Chromium-based browsers (Chromium, Brave, Google Chrome, and Microsoft Edge). By combining Chrome DevTools Protocol (CDP) runtime emulation with a Manifest V3 main-world stealth engine, each profile operates as a separate physical device with its own persistent storage, proxy routing, and hardware signature.

### Core Features

- **100% Offline & Local Privacy**: Zero external account or cloud sync dependencies. Every profile stores its configuration and isolated Chromium `UserData` directory locally inside `profiles/`.
- **Deterministic Identity Derivation**: Powered by a 64-bit `identity_seed` and Mulberry32 PRNG (`stealth_browser/fingerprint.py`). Each profile consistently generates the exact same hardware fingerprint across sessions while remaining distinct from every other profile.
- **5-Vector Fingerprint Spoofing**:
  - **Canvas**: Seeded sub-pixel deterministic perturbation on `toDataURL`, `toBlob`, and `getImageData` without visual distortion.
  - **WebGL & GPU**: Overrides `UNMASKED_VENDOR_WEBGL` (`0x9245`) and `UNMASKED_RENDERER_WEBGL` (`0x9246`) with matched GPU signatures across NVIDIA GeForce RTX, AMD Radeon, Intel Iris/Arc, and Apple Silicon M1/M2/M3 families.
  - **AudioContext**: Deterministic micro-perturbation on `AnalyserNode` FFT frequency bins and `AudioBuffer` channel data.
  - **Navigator, Client Hints & Screen**: Synchronizes `navigator.hardwareConcurrency`, `navigator.deviceMemory` (clamped at 8 GB per Chromium specification), `navigator.platform`, high-entropy `Sec-CH-UA` headers, and taskbar-adjusted screen dimensions.
  - **WebRTC, Geolocation, Timezone & DOM Geometry**: Supports automatic proxy-based resolution (`Based on proxy`) or manual overrides for timezone, locale, and coordinates, alongside `getBoundingClientRect` perturbation and local port-scan protection.
- **100 Built-In Hardware Presets**: Ships with 100 validated device presets (`stealth_browser/data/presets.json`): 35 Windows laptops/desktops, 25 macOS devices, 20 iOS devices, and 20 Android devices.
- **Native Windows Desktop Shell, Google OAuth 2.0 Gate & React Dashboard**:
  - Runs as a native desktop window via `pywebview` (Edge WebView2) backed by a local HTTP server bound strictly to `127.0.0.1:58888`.
  - Secured with a clean **Google-only OAuth 2.0 Loopback + PKCE (RFC 8252)** desktop login gate and persistent local session refresh (`data/auth_session.json`).
  - Organize profiles with folders, tags, color labels, notes, search filters, trash bin recovery, fingerprint consistency checks, proxy testing (`HTTP`, `HTTPS`, `SOCKS4`, `SOCKS5`), custom `.crx` / unpacked extension loading, and light/dark themes.
- **Multi-Browser Engine Discovery**: Automatically detects installed Chromium binaries on Windows (Playwright Chromium, Brave Browser, Google Chrome, and Microsoft Edge).

---

### Project Structure

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

### Requirements

- **Operating System**: Windows 10 or Windows 11 (64-bit recommended)
- **Python**: Python 3.10 or newer
- **Browser Engine**: At least one Chromium-based browser installed (Google Chrome, Brave, Microsoft Edge, or Playwright Chromium)
- **Python Packages**:
  - `pywebview` (for the native desktop window shell; falls back to Chromium `--app` mode if run directly via `web_ui_server.py`)
  - `playwright` *(optional, only required if running Playwright automation scripts)*

Install optional dependencies if needed:
```bash
pip install pywebview playwright
```

---

### Quick Start (Desktop UI)

#### Option 1: Double-Click Launcher (Recommended)
Double-click **`Buka_Anti_Detect_Browser.bat`** or **`AntiDetectBrowser.pyw`**.
This launches the native desktop interface without a background terminal window.

#### Option 2: Run from Terminal
```bash
python desktop_app.pyw
```
Or start the local web server directly (opens in app-window mode on `http://127.0.0.1:58888`):
```bash
python web_ui_server.py
```

#### Rebuilding the Frontend UI (Optional)
If you modify files inside `frontend/src/`:
```bash
cd frontend
npm install
npm run build
```

---

### Command-Line Usage (CLI)

Use `run_stealth.py` to manage and launch profiles from a terminal or script:

#### 1. List Existing Profiles
```bash
python run_stealth.py --list
```

#### 2. Create a Profile
```bash
# Create a profile using preset index 0
python run_stealth.py --create --profile store_account_1 --preset 0

# Create a profile with a proxy (HTTP or SOCKS5)
python run_stealth.py --create --profile us_account_2 --preset 1 --proxy "http://user:pass@proxy.example.com:8080"
```

#### 3. Launch a Profile & Test Fingerprint
```bash
# Open the profile on BrowserLeaks Canvas test
python run_stealth.py --profile store_account_1 --test

# Open a custom URL
python run_stealth.py --profile store_account_1 --url "https://iphey.com"
```

#### 4. Delete a Profile
```bash
python run_stealth.py --delete store_account_1
```

---

### Standalone Chromium Extension

The repository includes a standalone Manifest V3 extension under `extensions/anti-detect-browser/` and a packaged build at `Extension/anti-detect-browser.crx`.

Features:
- Categorized, searchable **DevicePicker** popup with all 100 hardware presets (Windows, macOS, iOS, Android).
- Dynamic `declarativeNetRequest` spoofing for `User-Agent` and `Sec-CH-UA*` Client Hints request headers.
- Main-world (`spoof-engine.js`) overrides for Canvas, WebGL, AudioContext, Navigator, and Screen geometry.

To load unpacked in Chrome, Brave, or Edge:
1. Open `chrome://extensions/` and enable **Developer mode**.
2. Click **Load unpacked** and select the `extensions/anti-detect-browser` folder.

To rebuild the `.crx` package:
```bash
python scripts/build-extension.py
```

---

### Playwright Automation Integration

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

### Contributors

- **Nirvana Handika Putra ([@Juremenn](https://github.com/Juremenn))** - Creator, Lead Security Researcher & Architect
- **Antigravity (Google Gemini / Google DeepMind)** - AI Co-Engineer (Fingerprint Engine, Desktop Shell, React UI & Google OAuth 2.0 PKCE Architecture)

---

### Support & Donation

If this project saves you time or helps your workflow, you can support its development by buying me a coffee:

- ☕ **Buy me a coffee (Saweria):** [https://saweria.co/juremenn](https://saweria.co/juremenn)

---

### License

Licensed under the [MIT License](LICENSE). Copyright (c) 2026 Nirvana Handika Putra.

---
---

<div id="bahasa-indonesia"></div>

## Bahasa Indonesia

[**⬆️ Back to Top / Kembali ke Atas**](#top) | [**Switch to English**](#english)

**Anti's Detect Browser** adalah aplikasi manajemen browser anti-detect lokal dan mesin isolasi fingerprint multi-profil (**100% Offline, Tanpa Login, Tanpa Akun Cloud**) untuk Windows. Seluruh fitur berjalan langsung di komputer Anda tanpa ketergantungan server luar maupun biaya langganan bulanan.

### Daftar Isi
1. [Ringkasan](#ringkasan)
2. [Fitur Utama](#fitur-utama)
3. [Struktur Proyek](#struktur-proyek-id)
4. [Kebutuhan Sistem](#kebutuhan-sistem)
5. [Cara Penggunaan Cepat (Desktop UI)](#cara-penggunaan-cepat-desktop-ui)
6. [Penggunaan via Terminal (CLI)](#penggunaan-via-terminal-cli)
7. [Ekstensi Chromium Mandiri](#ekstensi-chromium-mandiri)
8. [Integrasi Otomasi Playwright](#integrasi-otomasi-playwright)
9. [Kontributor](#kontributor)
10. [Dukungan & Donasi](#dukungan--donasi)
11. [Lisensi](#lisensi)

---

### Ringkasan

**Anti's Detect Browser** menyediakan lingkungan profil browser yang terisolasi penuh beserta kontrol sidik jari perangkat (*hardware fingerprint*) secara deterministik di atas mesin browser berbasis Chromium (Chromium, Brave, Google Chrome, dan Microsoft Edge). Dengan memadukan emulasi *Chrome DevTools Protocol* (CDP) dan injeksi ekstensi Manifest V3, setiap profil beroperasi layaknya perangkat fisik terpisah dengan ruang penyimpanan lokal, jalur proxy, dan identitas hardware masing-masing.

### Fitur Utama

- **100% Offline & Privasi Lokal**: Tidak membutuhkan akun atau sinkronisasi ke cloud pihak ketiga. Seluruh konfigurasi dan direktori `UserData` Chrome masing-masing profil disimpan secara terisolasi di folder `profiles/`.
- **Identitas Deterministik Berbasis Seed**: Menggunakan `identity_seed` 64-bit dengan algoritma PRNG Mulberry32 (`stealth_browser/fingerprint.py`). Setiap profil selalu menghasilkan sidik jari perangkat yang konsisten saat dibuka kembali, namun tetap unik antar profil.
- **Manipulasi Fingerprint 5 Vektor**:
  - **Canvas**: Perturbasi sub-piksel deterministik pada `toDataURL`, `toBlob`, dan `getImageData` (menghasilkan hash kanvas unik tanpa merusak tampilan visual).
  - **WebGL & GPU**: Mengubah `UNMASKED_VENDOR_WEBGL` (`0x9245`) dan `UNMASKED_RENDERER_WEBGL` (`0x9246`) sesuai profil GPU NVIDIA GeForce RTX, AMD Radeon, Intel Iris/Arc, dan Apple Silicon M1/M2/M3.
  - **AudioContext**: Mikro-perturbasi deterministik pada spektrum frekuensi `AnalyserNode` dan buffer `AudioBuffer`.
  - **Navigator, Client Hints & Layar**: Menyelaraskan `navigator.hardwareConcurrency`, `navigator.deviceMemory` (dibatasi maksimal 8 GB sesuai spesifikasi resmi Chromium), `navigator.platform`, header `Sec-CH-UA`, serta dimensi layar yang memperhitungkan ukuran taskbar.
  - **WebRTC, Geolokasi, Zona Waktu & Geometri DOM**: Mendukung pengaturan otomatis mengikuti lokasi IP proxy (`Based on proxy`) maupun manual, dilengkapi perturbasi `getBoundingClientRect` dan proteksi pemindaian port lokal.
- **100 Preset Perangkat Bawaan**: Dilengkapi 100 preset perangkat tervalidasi (`stealth_browser/data/presets.json`) yang mencakup 35 laptop/desktop Windows, 25 perangkat macOS, 20 perangkat iOS, dan 20 perangkat Android.
- **Aplikasi Desktop Native, Google OAuth 2.0 Gate & Dashboard React**:
  - Berjalan sebagai jendela aplikasi desktop Windows native menggunakan `pywebview` (Edge WebView2) dengan server lokal di `127.0.0.1:58888`.
  - Dilengkapi gerbang autentikasi desktop **Google-only OAuth 2.0 Loopback + PKCE (RFC 8252)** dengan pembaruan sesi otomatis (`data/auth_session.json`).
  - Mendukung pengelompokan folder, tag, label warna, catatan, pencarian, *Trash Bin* (pemulihan profil terhapus), pemeriksaan konsistensi fingerprint, pengujian koneksi proxy (`HTTP`, `HTTPS`, `SOCKS4`, `SOCKS5`), manajemen ekstensi `.crx` / *unpacked*, serta tema terang dan gelap (*Light/Dark Mode*).
- **Deteksi Mesin Browser Otomatis**: Mengenali instalasi Chromium, Brave Browser, Google Chrome, dan Microsoft Edge di sistem secara otomatis.

---

<div id="struktur-proyek-id"></div>

### Struktur Proyek

```text
Anti-s-Detect-Browser/
├── Buka_Anti_Detect_Browser.bat             # Peluncur 1-klik aplikasi desktop native
├── AntiDetectBrowser.pyw                    # Entrypoint aplikasi desktop tanpa jendela konsol
├── desktop_app.pyw                          # Shell native pywebview (Edge WebView2)
├── web_ui_server.py                         # Server API HTTP lokal (127.0.0.1:58888)
├── run_stealth.py                           # CLI untuk manajemen profil & otomasi terminal
├── selfcheck.html                           # Halaman lokal untuk verifikasi mandiri fingerprint
├── app.ico                                  # Ikon aplikasi Windows multi-resolusi
├── stealth_browser/                         # Paket inti mesin anti-detect Python
│   ├── profile_manager.py                   # CRUD profil, validasi, folder, tag, trash bin
│   ├── fingerprint.py                       # PRNG deterministik Mulberry32 & builder UA-CH
│   ├── stealth_hooks.py                     # Generator injeksi JS untuk 5 vektor fingerprint
│   ├── cdp_apply.py                         # Emulasi runtime Chrome DevTools Protocol (CDP)
│   ├── launcher.py                          # Deteksi browser, alokasi port & peluncur proses
│   ├── consistency.py                       # Evaluator konsistensi fingerprint profil
│   ├── proxy_utils.py                       # Validasi proxy, tes koneksi & pembacaan GeoIP
│   └── data/presets.json                    # 100 preset perangkat berkategori
├── extensions/anti-detect-browser/          # Kode sumber ekstensi mandiri Manifest V3
├── Extension/anti-detect-browser.crx        # Paket ekstensi CRX siap pasang
├── frontend/                                # Kode sumber dashboard UI (React 19 + TypeScript + Vite)
├── web_ui/                                  # Hasil kompilasi frontend yang disajikan web_ui_server.py
├── scripts/                                 # Script build ikon, preset, ekstensi & aplikasi desktop
└── tests/                                   # Pengujian unit & integrasi (API, CRX, profil)
```

---

### Kebutuhan Sistem

- **Sistem Operasi**: Windows 10 atau Windows 11 (disarankan 64-bit)
- **Python**: Python 3.10 atau lebih baru
- **Mesin Browser**: Minimal satu browser berbasis Chromium terinstal (Google Chrome, Brave, Microsoft Edge, atau Playwright Chromium)
- **Paket Python**:
  - `pywebview` (untuk jendela aplikasi desktop native; otomatis beralih ke mode `--app` Chromium jika dijalankan langsung lewat `web_ui_server.py`)
  - `playwright` *(opsional, hanya diperlukan jika menggunakan script otomasi Playwright)*

Instal dependensi tambahan bila diperlukan:
```bash
pip install pywebview playwright
```

---

### Cara Penggunaan Cepat (Desktop UI)

#### Cara 1: Dobel-Klik File Peluncur (Direkomendasikan)
Dobel-klik file **`Buka_Anti_Detect_Browser.bat`** atau **`AntiDetectBrowser.pyw`**.
Jendela aplikasi desktop akan langsung terbuka tanpa menampilkan jendela terminal di latar belakang.

#### Cara 2: Menjalankan lewat Terminal
```bash
python desktop_app.pyw
```
Atau jalankan server UI lokal secara langsung (terbuka di `http://127.0.0.1:58888`):
```bash
python web_ui_server.py
```

#### Membangun Ulang Frontend UI (Opsional)
Jika Anda mengubah kode di dalam `frontend/src/`:
```bash
cd frontend
npm install
npm run build
```

---

### Penggunaan via Terminal (CLI)

Gunakan `run_stealth.py` untuk mengelola dan menjalankan profil langsung dari terminal:

#### 1. Melihat Daftar Profil Lokal
```bash
python run_stealth.py --list
```

#### 2. Membuat Profil Baru
```bash
# Membuat profil dengan preset indeks 0
python run_stealth.py --create --profile toko_online_1 --preset 0

# Membuat profil dengan proxy (HTTP atau SOCKS5)
python run_stealth.py --create --profile akun_us_2 --preset 1 --proxy "http://user:pass@proxy.example.com:8080"
```

#### 3. Menjalankan Profil & Uji Fingerprint
```bash
# Membuka profil langsung ke halaman uji BrowserLeaks Canvas
python run_stealth.py --profile toko_online_1 --test

# Membuka URL tertentu
python run_stealth.py --profile toko_online_1 --url "https://iphey.com"
```

#### 4. Menghapus Profil
```bash
python run_stealth.py --delete toko_online_1
```

---

### Ekstensi Chromium Mandiri

Repositori ini juga menyertakan ekstensi Manifest V3 mandiri di dalam folder `extensions/anti-detect-browser/` serta file paket `.crx` di `Extension/anti-detect-browser.crx`.

Fitur ekstensi:
- Popup **DevicePicker** dengan kolom pencarian dan 100 preset perangkat (Windows, macOS, iOS, Android).
- Penyamaran header `User-Agent` dan `Sec-CH-UA*` Client Hints secara dinamis menggunakan `declarativeNetRequest`.
- Injeksi *main-world* (`spoof-engine.js`) untuk memanipulasi Canvas, WebGL, AudioContext, Navigator, dan geometri layar.

Cara memasang (*Load unpacked*) di Chrome, Brave, atau Edge:
1. Buka `chrome://extensions/` dan aktifkan **Developer mode**.
2. Klik **Load unpacked** lalu pilih folder `extensions/anti-detect-browser`.

Untuk membangun ulang file `.crx`:
```bash
python scripts/build-extension.py
```

---

### Integrasi Otomasi Playwright

Anda dapat mengintegrasikan `ProfileManager` dan `generate_stealth_script` ke dalam script Python Playwright:

```python
import asyncio
from playwright.async_api import async_playwright
from stealth_browser.profile_manager import ProfileManager
from stealth_browser.stealth_hooks import generate_stealth_script

async def main():
    mgr = ProfileManager()
    profile = mgr.get_profile("toko_online_1")
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

### Kontributor

- **Nirvana Handika Putra ([@Juremenn](https://github.com/Juremenn))** - Kreator, Peneliti Keamanan Utama & Arsitek Sistem
- **Antigravity (Google Gemini / Google DeepMind)** - AI Co-Engineer (Mesin Fingerprint, Desktop Shell, React UI & Arsitektur Google OAuth 2.0 PKCE)

---

### Dukungan & Donasi

Jika proyek ini bermanfaat bagi pekerjaan Anda, Anda dapat memberikan dukungan melalui Saweria:

- ☕ **Buy me a coffee (Saweria):** [https://saweria.co/juremenn](https://saweria.co/juremenn)

---

### Lisensi

Didistribusikan di bawah [Lisensi MIT](LICENSE). Hak Cipta (c) 2026 Nirvana Handika Putra.
