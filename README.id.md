<div align="center">
  <img src="frontend/public/assets/logo.png" alt="Anti's Detect Browser Logo" width="112" height="112" />

  # Anti's Detect Browser

  **Aplikasi Manajemen Browser Anti-Detect Multi-Profil & Mesin Isolasi Fingerprint Deterministik**

  <p>
    <a href="README.md"><img src="https://img.shields.io/badge/Language-English-1E293B?style=for-the-badge" alt="English" /></a>
    <a href="README.id.md"><img src="https://img.shields.io/badge/Bahasa-Indonesia%20(Aktif)-4F46E5?style=for-the-badge" alt="Bahasa Indonesia" /></a>
  </p>

  [![Release](https://img.shields.io/github/v/release/Juremenn/Anti-s-Detect-Browser?color=5B4FE9&label=Release)](https://github.com/Juremenn/Anti-s-Detect-Browser/releases/latest)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6.svg)](#3-kebutuhan-sistem)
  [![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB.svg)](#3-kebutuhan-sistem)
  [![Auth](https://img.shields.io/badge/Auth-Google%20OAuth%202.0-4285F4.svg)](#4-cara-penggunaan-cepat-desktop-ui)
  [![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Saweria-F9A825.svg)](https://saweria.co/juremenn)

  ☕ **Dukung proyek ini:** [Buy me a coffee di Saweria (https://saweria.co/juremenn)](https://saweria.co/juremenn)
</div>

---

## Daftar Isi

1. [Ringkasan](#1-ringkasan)
2. [Fitur Utama](#2-fitur-utama)
3. [Kebutuhan Sistem](#3-kebutuhan-sistem)
4. [Cara Penggunaan Cepat (Desktop UI)](#4-cara-penggunaan-cepat-desktop-ui)
5. [Penggunaan via Terminal (CLI)](#5-penggunaan-via-terminal-cli)
6. [Ekstensi Chromium Mandiri](#6-ekstensi-chromium-mandiri)
7. [Struktur Proyek](#7-struktur-proyek)
8. [Integrasi Otomasi Playwright](#8-integrasi-otomasi-playwright)
9. [Kontributor](#9-kontributor)
10. [Dukungan & Donasi](#10-dukungan--donasi)
11. [Lisensi](#11-lisensi)

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
  - **Navigator, Client Hints & Layar**: Menyelaraskan `navigator.hardwareConcurrency`, `navigator.deviceMemory` (dibatasi maksimal 8 GB sesuai spesifikasi resmi Chromium), `navigator.platform`, header `Sec-CH-UA`, serta dimensi layar yang memperhitungkan ukuran taskbar.
  - **WebRTC, Geolokasi, Zona Waktu & Geometri DOM**: Mendukung pengaturan otomatis mengikuti lokasi IP proxy (`Based on proxy`) maupun manual, dilengkapi perturbasi `getBoundingClientRect` dan proteksi pemindaian port lokal.
- **100 Preset Perangkat Bawaan**: Dilengkapi 100 preset perangkat tervalidasi (`stealth_browser/data/presets.json`) yang mencakup 35 laptop/desktop Windows, 25 perangkat macOS, 20 perangkat iOS, dan 20 perangkat Android.
- **Aplikasi Desktop Native & Dashboard React**:
  - Berjalan sebagai jendela aplikasi desktop Windows native menggunakan `pywebview` (Edge WebView2) dengan server API lokal di `127.0.0.1:58888`.
  - Mendukung pengelompokan folder, tag, label warna, catatan, pencarian, *Trash Bin* (pemulihan profil terhapus), pemeriksaan konsistensi fingerprint, pengujian koneksi proxy (`HTTP`, `HTTPS`, `SOCKS4`, `SOCKS5`), manajemen ekstensi `.crx` / *unpacked*, serta tema terang dan gelap (*Light/Dark Mode*).
- **Deteksi Mesin Browser Otomatis**: Mengenali instalasi Playwright Chromium, Brave Browser, Google Chrome, dan Microsoft Edge di sistem secara otomatis.

---

## 3. Kebutuhan Sistem

- **Sistem Operasi**: Windows 10 atau Windows 11 (disarankan 64-bit)
- **Python**: Python 3.10 atau lebih baru
- **Koneksi Internet**: Diperlukan untuk autentikasi Login Google OAuth 2.0 dan pengecekan proxy/browsing
- **Mesin Browser**: Minimal satu browser berbasis Chromium terinstal (Google Chrome, Brave, Microsoft Edge, atau Playwright Chromium)
- **Paket Python**:
  - `pywebview` (untuk jendela aplikasi desktop native)
  - `playwright` *(opsional, hanya diperlukan jika menggunakan script otomasi Playwright)*

```bash
pip install pywebview playwright
```

---

## 4. Cara Penggunaan Cepat (Desktop UI)

### Cara 1: Installer Resmi Windows (`AntiDetectBrowser-Setup-v1.0.0.exe` - Direkomendasikan)
1. Buka halaman [**GitHub Releases**](https://github.com/Juremenn/Anti-s-Detect-Browser/releases/latest) lalu unduh **`AntiDetectBrowser-Setup-v1.0.0.exe`** (serta ekstensi mandiri opsional **`anti-detect-browser.crx`**).
2. Jalankan **`AntiDetectBrowser-Setup-v1.0.0.exe`** untuk memasang **Anti's Detect Browser** lengkap dengan pintasan Start Menu dan Desktop. Seluruh data profil, ekstensi, dan sesi login Google disimpan dengan aman di `%LOCALAPPDATA%\AntiDetectBrowser\`.
3. Buka aplikasi dan klik **Continue with Google** pada layar login untuk masuk menggunakan akun Google Anda.

### Cara 2: Dobel-Klik File Peluncur (Dari Source Code)
1. Dobel-klik file **`Buka_Anti_Detect_Browser.bat`** atau **`AntiDetectBrowser.pyw`**.
2. Klik **Continue with Google** pada layar login untuk masuk menggunakan akun Google Anda.

### Cara 3: Menjalankan atau Build Installer Resmi lewat Terminal
```bash
# Menjalankan aplikasi desktop dari source Python
python desktop_app.pyw

# Atau menjalankan server UI lokal secara langsung (http://127.0.0.1:58888)
python web_ui_server.py

# Membangun paket rilis lengkap (Frontend + CRX + PyInstaller --onedir + Inno Setup Installer + SHA256SUMS.txt)
python scripts/build-release.py
```

### CI/CD & Azure Trusted Signing (Reputasi SmartScreen)
Pipeline GitHub Actions (`.github/workflows/release.yml`) secara otomatis membangun `AntiDetectBrowser-Setup-<version>.exe`, `anti-detect-browser.crx`, dan `SHA256SUMS.txt` setiap kali tag `v*` di-push. Untuk mengaktifkan penandatanganan digital Authenticode otomatis agar langsung dipercaya Windows SmartScreen, tambahkan GitHub Repository Secrets berikut:
- **Azure Trusted Signing**: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_CODE_SIGNING_ENDPOINT`, `AZURE_CODE_SIGNING_ACCOUNT`, `AZURE_CERT_PROFILE_NAME`.
- **Atau Sertifikat PFX Standar**: `WINDOWS_PFX_BASE64`, `WINDOWS_PFX_PASSWORD`.

### Membangun Ulang Frontend UI (Opsional)
Jika Anda mengubah kode di dalam `frontend/src/`:
```bash
cd frontend
npm install
npm run build
```

---

## 5. Penggunaan via Terminal (CLI)

Gunakan `run_stealth.py` untuk mengelola dan menjalankan profil langsung dari terminal:

```bash
# 1. Melihat daftar profil lokal
python run_stealth.py --list

# 2. Membuat profil baru (dengan opsi proxy)
python run_stealth.py --create --profile toko_online_1 --preset 0
python run_stealth.py --create --profile akun_us_2 --preset 1 --proxy "http://user:pass@proxy.example.com:8080"

# 3. Menjalankan profil & uji fingerprint
python run_stealth.py --profile toko_online_1 --test
python run_stealth.py --profile toko_online_1 --url "https://iphey.com"

# 4. Menghapus profil
python run_stealth.py --delete toko_online_1
```

---

## 6. Ekstensi Chromium Mandiri

Repositori ini menyertakan ekstensi Manifest V3 mandiri di dalam folder `extensions/anti-detect-browser/` serta file paket `.crx` di `Extension/anti-detect-browser.crx`:

- Popup **DevicePicker** dengan kolom pencarian dan 100 preset perangkat (Windows, macOS, iOS, Android).
- Penyamaran header `User-Agent` dan `Sec-CH-UA*` Client Hints secara dinamis menggunakan `declarativeNetRequest`.
- Injeksi *main-world* (`spoof-engine.js`) untuk memanipulasi Canvas, WebGL, AudioContext, Navigator, dan geometri layar.

### Cara Memasang (Load Unpacked)
1. Buka `chrome://extensions/` di Chrome, Brave, atau Edge dan aktifkan **Developer mode**.
2. Klik **Load unpacked** lalu pilih folder `extensions/anti-detect-browser`.

Untuk membangun ulang file `.crx`:
```bash
python scripts/build-extension.py
```

---

## 7. Struktur Proyek

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

## 8. Integrasi Otomasi Playwright

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

## 9. Kontributor

- **Nirvana Handika Putra ([@Juremenn](https://github.com/Juremenn))** - Kreator, Peneliti Keamanan Utama & Arsitek Sistem
- **Antigravity (Google Gemini / Google DeepMind)** - AI Co-Engineer (Mesin Fingerprint, Desktop Shell, React UI & Arsitektur Google OAuth 2.0 PKCE)

---

## 10. Dukungan & Donasi

Jika proyek ini bermanfaat bagi pekerjaan Anda, Anda dapat memberikan dukungan melalui Saweria:

- ☕ **Buy me a coffee (Saweria):** [https://saweria.co/juremenn](https://saweria.co/juremenn)

---

## 11. Lisensi

Didistribusikan di bawah [Lisensi MIT](LICENSE). Hak Cipta (c) 2026 Nirvana Handika Putra.
