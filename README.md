<div id="top"></div>

<div align="center">
  <img src="frontend/public/assets/logo.png" alt="Anti's Detect Browser Logo" width="112" height="112" />

  # Anti's Detect Browser

  **Multi-Profile Anti-Detect Browser & Deterministic Fingerprint Isolation Engine**

  **Language / Bahasa:** [**English** (Default)](README.md) | [**Bahasa Indonesia**](README.id.md)

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6.svg)](#top)
  [![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB.svg)](#top)
  [![Auth](https://img.shields.io/badge/Auth-Google%20OAuth%202.0-4285F4.svg)](#top)
  [![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Saweria-F9A825.svg)](https://saweria.co/juremenn)

  ☕ **Support this project / Dukung proyek ini:** [Buy me a coffee on Saweria (https://saweria.co/juremenn)](https://saweria.co/juremenn)
</div>

---

<table>
<tr>
<th width="50%">🇺🇸 English (Default)</th>
<th width="50%">🇮🇩 Bahasa Indonesia</th>
</tr>
<tr>
<td width="50%" valign="top">

### 1. Overview

**Anti's Detect Browser** is a multi-profile anti-detect browser management application and multi-vector fingerprint spoofing engine for Windows.

The desktop dashboard uses **Google OAuth 2.0 Sign-In** for user authentication while keeping all browser profiles, cookies, extensions, and isolated Chromium `UserData` folders stored locally on your machine with zero monthly subscription fees.

By combining Chrome DevTools Protocol (CDP) runtime emulation with a Manifest V3 main-world stealth engine, each profile operates as a separate physical device across standard Chromium browsers (Chromium, Brave, Google Chrome, and Microsoft Edge).

</td>
<td width="50%" valign="top">

### 1. Ringkasan

**Anti's Detect Browser** adalah aplikasi manajemen browser anti-detect multi-profil dan mesin penyamaran fingerprint multi-vektor untuk Windows.

Dashboard desktop dilengkapi autentikasi **Login Google (OAuth 2.0)**, sementara seluruh data profil browser, cookies, ekstensi, dan direktori `UserData` Chromium tetap disimpan secara lokal di komputer Anda tanpa biaya langganan bulanan.

Dengan memadukan emulasi runtime *Chrome DevTools Protocol* (CDP) dan injeksi ekstensi Manifest V3, setiap profil berjalan layaknya perangkat fisik terpisah di atas browser berbasis Chromium (Chromium, Brave, Google Chrome, dan Microsoft Edge).

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 2. Core Features

- **Google OAuth 2.0 Sign-In & Local Data Storage**: Authenticate via your Google account through a secure loopback callback (`127.0.0.1`), while all profile data and `UserData` directories stay on your local disk (`profiles/`).
- **Deterministic Identity Derivation**: Powered by a 64-bit `identity_seed` and Mulberry32 PRNG (`stealth_browser/fingerprint.py`). Every profile reproduces the exact same hardware fingerprint across sessions while remaining distinct from other profiles.
- **5-Vector Fingerprint Spoofing**:
  - **Canvas**: Seeded sub-pixel deterministic perturbation on `toDataURL`, `toBlob`, and `getImageData`.
  - **WebGL & GPU**: Overrides `UNMASKED_VENDOR_WEBGL` (`0x9245`) and `UNMASKED_RENDERER_WEBGL` (`0x9246`) across NVIDIA GeForce RTX, AMD Radeon, Intel Iris/Arc, and Apple Silicon M1/M2/M3 presets.
  - **AudioContext**: Deterministic micro-perturbation on `AnalyserNode` FFT frequency bins and `AudioBuffer`.
  - **Navigator, Client Hints & Screen**: Matches `hardwareConcurrency`, `deviceMemory` (capped at 8 GB per Chromium spec), `platform`, `Sec-CH-UA` headers, and taskbar-adjusted screen geometry.
  - **WebRTC, Geolocation, Timezone & DOM Geometry**: Automatic proxy-based resolution (`Based on proxy`) or manual overrides, plus `getBoundingClientRect` perturbation and local port-scan protection.
- **100 Built-In Hardware Presets**: 35 Windows laptops/desktops, 25 macOS devices, 20 iOS devices, and 20 Android devices (`stealth_browser/data/presets.json`).
- **Native Windows Desktop Shell & React Dashboard**:
  - Built on `pywebview` (Edge WebView2) and a local HTTP API server bound to `127.0.0.1:58888`.
  - Organize profiles with folders, tags, color labels, notes, search filters, trash bin recovery, fingerprint consistency evaluation, proxy testing (`HTTP`, `HTTPS`, `SOCKS4`, `SOCKS5`), custom `.crx` / unpacked extensions, and light/dark themes.
- **Multi-Browser Engine Discovery**: Automatically detects installed Playwright Chromium, Brave Browser, Google Chrome, and Microsoft Edge binaries.

</td>
<td width="50%" valign="top">

### 2. Fitur Utama

- **Login Google OAuth 2.0 & Penyimpanan Lokal**: Masuk menggunakan akun Google melalui callback lokal (`127.0.0.1`), dengan seluruh konfigurasi dan folder `UserData` profil tetap tersimpan di komputer Anda (`profiles/`).
- **Identitas Deterministik Berbasis Seed**: Menggunakan `identity_seed` 64-bit dengan algoritma PRNG Mulberry32 (`stealth_browser/fingerprint.py`). Setiap profil selalu menghasilkan sidik jari perangkat yang konsisten saat dibuka kembali, namun tetap unik antar profil.
- **Manipulasi Fingerprint 5 Vektor**:
  - **Canvas**: Perturbasi sub-piksel deterministik pada `toDataURL`, `toBlob`, dan `getImageData` tanpa distorsi visual.
  - **WebGL & GPU**: Mengubah `UNMASKED_VENDOR_WEBGL` (`0x9245`) dan `UNMASKED_RENDERER_WEBGL` (`0x9246`) sesuai profil GPU NVIDIA GeForce RTX, AMD Radeon, Intel Iris/Arc, dan Apple Silicon M1/M2/M3.
  - **AudioContext**: Mikro-perturbasi deterministik pada spektrum frekuensi `AnalyserNode` dan buffer `AudioBuffer`.
  - **Navigator, Client Hints & Layar**: Menyelaraskan `hardwareConcurrency`, `deviceMemory` (maksimal 8 GB sesuai spesifikasi Chromium), `platform`, header `Sec-CH-UA`, serta dimensi layar yang memperhitungkan taskbar.
  - **WebRTC, Geolokasi, Zona Waktu & Geometri DOM**: Mendukung resolusi otomatis mengikuti lokasi IP proxy (`Based on proxy`) maupun manual, ditambah perturbasi `getBoundingClientRect` dan proteksi pemindaian port lokal.
- **100 Preset Perangkat Bawaan**: Mencakup 35 laptop/desktop Windows, 25 perangkat macOS, 20 perangkat iOS, dan 20 perangkat Android (`stealth_browser/data/presets.json`).
- **Aplikasi Desktop Native & Dashboard React**:
  - Berjalan sebagai jendela desktop Windows native via `pywebview` (Edge WebView2) dengan server API lokal di `127.0.0.1:58888`.
  - Kelola profil dengan folder, tag, label warna, catatan, pencarian, *Trash Bin*, pemeriksaan konsistensi fingerprint, tes koneksi proxy (`HTTP`, `HTTPS`, `SOCKS4`, `SOCKS5`), manajemen ekstensi `.crx` / *unpacked*, serta tema terang dan gelap (*Light/Dark Mode*).
- **Deteksi Mesin Browser Otomatis**: Mengenali instalasi Playwright Chromium, Brave Browser, Google Chrome, dan Microsoft Edge secara otomatis.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 3. Requirements

- **OS**: Windows 10 or Windows 11 (64-bit recommended)
- **Python**: Python 3.10 or newer
- **Internet Connection**: Required for Google OAuth 2.0 sign-in and online browsing/proxy checks
- **Browser Engine**: Google Chrome, Brave, Microsoft Edge, or Playwright Chromium
- **Python Packages**:
  - `pywebview` (native desktop window shell)
  - `playwright` *(optional, for automation scripts)*

```bash
pip install pywebview playwright
```

</td>
<td width="50%" valign="top">

### 3. Kebutuhan Sistem

- **OS**: Windows 10 atau Windows 11 (disarankan 64-bit)
- **Python**: Python 3.10 atau lebih baru
- **Koneksi Internet**: Diperlukan untuk autentikasi Login Google OAuth 2.0 dan pengecekan proxy/browsing
- **Mesin Browser**: Google Chrome, Brave, Microsoft Edge, atau Playwright Chromium
- **Paket Python**:
  - `pywebview` (shell jendela aplikasi desktop native)
  - `playwright` *(opsional, untuk script otomasi)*

```bash
pip install pywebview playwright
```

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 4. Quick Start (Desktop UI)

**Option 1: Double-Click Launcher (Recommended)**
1. Double-click **`Buka_Anti_Detect_Browser.bat`** or **`AntiDetectBrowser.pyw`**.
2. Click **Continue with Google** on the login screen to sign in via your browser.

**Option 2: Run via Terminal**
```bash
python desktop_app.pyw
# or start the local server directly:
python web_ui_server.py
```

**Rebuilding the Frontend UI (Optional)**
```bash
cd frontend
npm install
npm run build
```

</td>
<td width="50%" valign="top">

### 4. Cara Penggunaan Cepat (Desktop UI)

**Cara 1: Dobel-Klik File Peluncur (Direkomendasikan)**
1. Dobel-klik file **`Buka_Anti_Detect_Browser.bat`** atau **`AntiDetectBrowser.pyw`**.
2. Klik **Continue with Google** pada layar login untuk masuk menggunakan akun Google Anda.

**Cara 2: Menjalankan lewat Terminal**
```bash
python desktop_app.pyw
# atau jalankan server lokal secara langsung:
python web_ui_server.py
```

**Membangun Ulang Frontend UI (Opsional)**
```bash
cd frontend
npm install
npm run build
```

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 5. Command-Line Usage (CLI)

Manage and launch profiles directly from the terminal using `run_stealth.py`:

```bash
# 1. List local profiles
python run_stealth.py --list

# 2. Create a profile (with optional proxy)
python run_stealth.py --create --profile store_1 --preset 0
python run_stealth.py --create --profile us_2 --preset 1 --proxy "http://user:pass@host:8080"

# 3. Launch profile & test fingerprint
python run_stealth.py --profile store_1 --test
python run_stealth.py --profile store_1 --url "https://iphey.com"

# 4. Delete a profile
python run_stealth.py --delete store_1
```

</td>
<td width="50%" valign="top">

### 5. Penggunaan via Terminal (CLI)

Kelola dan jalankan profil langsung dari terminal menggunakan `run_stealth.py`:

```bash
# 1. Melihat daftar profil lokal
python run_stealth.py --list

# 2. Membuat profil baru (dengan opsi proxy)
python run_stealth.py --create --profile toko_1 --preset 0
python run_stealth.py --create --profile akun_us_2 --preset 1 --proxy "http://user:pass@host:8080"

# 3. Menjalankan profil & uji fingerprint
python run_stealth.py --profile toko_1 --test
python run_stealth.py --profile toko_1 --url "https://iphey.com"

# 4. Menghapus profil
python run_stealth.py --delete toko_1
```

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 6. Standalone Chromium Extension

A standalone Manifest V3 extension is included in `extensions/anti-detect-browser/` and packaged at `Extension/anti-detect-browser.crx`:
- Searchable **DevicePicker** popup with all 100 hardware presets.
- Dynamic `declarativeNetRequest` spoofing for `User-Agent` and `Sec-CH-UA*` Client Hints headers.
- Main-world (`spoof-engine.js`) overrides for Canvas, WebGL, AudioContext, Navigator, and Screen geometry.

**How to Load Unpacked:**
1. Open `chrome://extensions/` and enable **Developer mode**.
2. Click **Load unpacked** and select `extensions/anti-detect-browser`.

</td>
<td width="50%" valign="top">

### 6. Ekstensi Chromium Mandiri

Tersedia ekstensi Manifest V3 mandiri di folder `extensions/anti-detect-browser/` serta paket `.crx` di `Extension/anti-detect-browser.crx`:
- Popup **DevicePicker** dengan pencarian dan 100 preset perangkat.
- Penyamaran header `User-Agent` dan `Sec-CH-UA*` Client Hints secara dinamis via `declarativeNetRequest`.
- Injeksi *main-world* (`spoof-engine.js`) untuk Canvas, WebGL, AudioContext, Navigator, dan geometri layar.

**Cara Memasang (Load Unpacked):**
1. Buka `chrome://extensions/` dan aktifkan **Developer mode**.
2. Klik **Load unpacked** lalu pilih folder `extensions/anti-detect-browser`.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 7. Project Structure

```text
Anti-s-Detect-Browser/
├── Buka_Anti_Detect_Browser.bat
├── AntiDetectBrowser.pyw
├── desktop_app.pyw
├── web_ui_server.py
├── run_stealth.py
├── selfcheck.html
├── app.ico
├── stealth_browser/
│   ├── profile_manager.py
│   ├── fingerprint.py
│   ├── stealth_hooks.py
│   ├── cdp_apply.py
│   ├── launcher.py
│   ├── consistency.py
│   ├── proxy_utils.py
│   └── data/presets.json
├── extensions/anti-detect-browser/
├── Extension/anti-detect-browser.crx
├── frontend/
├── web_ui/
├── scripts/
└── tests/
```

</td>
<td width="50%" valign="top">

### 7. Struktur Proyek

```text
Anti-s-Detect-Browser/
├── Buka_Anti_Detect_Browser.bat
├── AntiDetectBrowser.pyw
├── desktop_app.pyw
├── web_ui_server.py
├── run_stealth.py
├── selfcheck.html
├── app.ico
├── stealth_browser/
│   ├── profile_manager.py
│   ├── fingerprint.py
│   ├── stealth_hooks.py
│   ├── cdp_apply.py
│   ├── launcher.py
│   ├── consistency.py
│   ├── proxy_utils.py
│   └── data/presets.json
├── extensions/anti-detect-browser/
├── Extension/anti-detect-browser.crx
├── frontend/
├── web_ui/
├── scripts/
└── tests/
```

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 8. Playwright Automation Integration

Use `ProfileManager` and `generate_stealth_script` inside Python Playwright scripts:

```python
import asyncio
from playwright.async_api import async_playwright
from stealth_browser.profile_manager import ProfileManager
from stealth_browser.stealth_hooks import generate_stealth_script

async def main():
    mgr = ProfileManager()
    profile = mgr.get_profile("store_1")
    stealth_js = generate_stealth_script(profile)

    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context(
            user_data_dir=profile["user_data_dir"],
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                f"--user-agent={profile['user_agent']}",
            ],
        )
        await ctx.add_init_script(stealth_js)
        page = await ctx.new_page()
        await page.goto("https://browserleaks.com/canvas")
        await asyncio.sleep(10)
        await ctx.close()

asyncio.run(main())
```

</td>
<td width="50%" valign="top">

### 8. Integrasi Otomasi Playwright

Gunakan `ProfileManager` dan `generate_stealth_script` di dalam script Python Playwright:

```python
import asyncio
from playwright.async_api import async_playwright
from stealth_browser.profile_manager import ProfileManager
from stealth_browser.stealth_hooks import generate_stealth_script

async def main():
    mgr = ProfileManager()
    profile = mgr.get_profile("toko_1")
    stealth_js = generate_stealth_script(profile)

    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context(
            user_data_dir=profile["user_data_dir"],
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                f"--user-agent={profile['user_agent']}",
            ],
        )
        await ctx.add_init_script(stealth_js)
        page = await ctx.new_page()
        await page.goto("https://browserleaks.com/canvas")
        await asyncio.sleep(10)
        await ctx.close()

asyncio.run(main())
```

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 9. Support & Donation

If this project saves you time or helps your workflow, you can support its development by buying me a coffee:

- ☕ **Buy me a coffee (Saweria):** [https://saweria.co/juremenn](https://saweria.co/juremenn)

### 10. License

Licensed under the [MIT License](LICENSE). Copyright (c) 2026 Nirvana Handika Putra.

</td>
<td width="50%" valign="top">

### 9. Dukungan & Donasi

Jika proyek ini bermanfaat bagi pekerjaan Anda, Anda dapat memberikan dukungan melalui Saweria:

- ☕ **Buy me a coffee (Saweria):** [https://saweria.co/juremenn](https://saweria.co/juremenn)

### 10. Lisensi

Didistribusikan di bawah [Lisensi MIT](LICENSE). Hak Cipta (c) 2026 Nirvana Handika Putra.

</td>
</tr>
</table>
