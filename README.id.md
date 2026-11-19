<div id="top"></div>

<div align="center">
  <img src="frontend/public/assets/logo.png" alt="Anti's Detect Browser Logo" width="112" height="112" />

  # Anti's Detect Browser

  **Aplikasi Manajemen Browser Anti-Detect Multi-Profil & Mesin Isolasi Fingerprint Deterministik**

  **Language / Bahasa:** [**English** (Default & Side-by-Side)](README.md) | [**Bahasa Indonesia**](README.id.md)

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6.svg)](#kebutuhan-sistem)
  [![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB.svg)](#kebutuhan-sistem)
  [![Auth](https://img.shields.io/badge/Auth-Google%20OAuth%202.0-4285F4.svg)](#cara-penggunaan-cepat-desktop-ui)
  [![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Saweria-F9A825.svg)](https://saweria.co/juremenn)

  ☕ **Dukung proyek ini:** [Buy me a coffee di Saweria (https://saweria.co/juremenn)](https://saweria.co/juremenn)
</div>

---

## 1. Ringkasan

**Anti's Detect Browser** adalah aplikasi manajemen browser anti-detect multi-profil dan mesin penyamaran fingerprint multi-vektor untuk Windows.

Dashboard desktop dilengkapi autentikasi **Login Google (OAuth 2.0)**, sementara seluruh data profil browser, cookies, ekstensi, dan direktori `UserData` Chromium tetap disimpan secara lokal di komputer Anda tanpa biaya langganan bulanan.

Dengan memadukan emulasi runtime *Chrome DevTools Protocol* (CDP) dan injeksi ekstensi Manifest V3, setiap profil berjalan layaknya perangkat fisik terpisah di atas browser berbasis Chromium (Chromium, Brave, Google Chrome, dan Microsoft Edge).

---

## 2. Fitur Utama

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

---

## 3. Kebutuhan Sistem

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

---

## 4. Cara Penggunaan Cepat (Desktop UI)

### Cara 1: Dobel-Klik File Peluncur (Direkomendasikan)
1. Dobel-klik file **`Buka_Anti_Detect_Browser.bat`** atau **`AntiDetectBrowser.pyw`**.
2. Klik **Continue with Google** pada layar login untuk masuk menggunakan akun Google Anda.

### Cara 2: Menjalankan lewat Terminal
```bash
python desktop_app.pyw
# atau jalankan server lokal secara langsung:
python web_ui_server.py
```

### Membangun Ulang Frontend UI (Opsional)
```bash
cd frontend
npm install
npm run build
```

---

## 5. Penggunaan via Terminal (CLI)

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

---

## 6. Ekstensi Chromium Mandiri

Tersedia ekstensi Manifest V3 mandiri di folder `extensions/anti-detect-browser/` serta paket `.crx` di `Extension/anti-detect-browser.crx`:
- Popup **DevicePicker** dengan pencarian dan 100 preset perangkat.
- Penyamaran header `User-Agent` dan `Sec-CH-UA*` Client Hints secara dinamis via `declarativeNetRequest`.
- Injeksi *main-world* (`spoof-engine.js`) untuk Canvas, WebGL, AudioContext, Navigator, dan geometri layar.

**Cara Memasang (Load Unpacked):**
1. Buka `chrome://extensions/` dan aktifkan **Developer mode**.
2. Klik **Load unpacked** lalu pilih folder `extensions/anti-detect-browser`.

---

## 7. Struktur Proyek

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

---

## 8. Integrasi Otomasi Playwright

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

---

## 9. Dukungan & Donasi

Jika proyek ini bermanfaat bagi pekerjaan Anda, Anda dapat memberikan dukungan melalui Saweria:

- ☕ **Buy me a coffee (Saweria):** [https://saweria.co/juremenn](https://saweria.co/juremenn)

---

## 10. Lisensi

Didistribusikan di bawah [Lisensi MIT](LICENSE). Hak Cipta (c) 2026 Nirvana Handika Putra.
