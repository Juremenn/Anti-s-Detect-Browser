# Native Stealth Browser Engine (Anti-Detect Framework)

Framework otomasi browser anti-detect mandiri (**100% Offline, Tanpa Login, Tanpa Akun Cloud**) hasil rekayasa balik (*reverse engineering*) arsitektur **Octo Browser v3.2.4**.

---

## 1. Latar Belakang & Masalah Octo Browser

Biner `Octo Browser.exe` resmi merupakan **Thin Client** yang memblokir semua pembuatan profil lokal jika Anda tidak memiliki akun berbayar di cloud Octo. 

Framework ini mengadopsi dan mereplikasi **seluruh 5 teknik inti pemalsuan fingerprint** Octo Browser langsung ke mesin Google Chrome lokal:
1. **Canvas Fingerprint Hook:** Perturbasi sub-pixel deterministik berbasis seed profile pada `toDataURL`, `toBlob`, dan `getImageData` (menghasilkan hash kanvas unik tanpa distorsi visual).
2. **WebGL & GPU Masking:** Overriding `UNMASKED_VENDOR_WEBGL` (0x9245) dan `UNMASKED_RENDERER_WEBGL` (0x9246) dengan GPU diskrit realistis (NVIDIA RTX 3070, RTX 4080, Intel Iris Xe, Apple M2).
3. **WebAudio Micro-Perturbation:** Modulasi spektrum frekuensi audio ($\sim 10^{-6}$) pada `AnalyserNode` dan `AudioBuffer` untuk mencegah audio hash tracking.
4. **Hardware & Navigator Normalization:** Menghapus `navigator.webdriver`, menyesuaikan `hardwareConcurrency`, `deviceMemory`, `platform`, bahasa, dan resolusi layar yang konsisten dengan taskbar Windows.
5. **DOM Geometry & WebRTC Protection:** Perturbasi `getBoundingClientRect` untuk mitigasi font fingerprinting dan penyaringan IP LAN lokal pada WebRTC SDP.

---

## 2. Struktur Proyek

```text
Octo-Browser/
├── Buka_Dashboard_UI.bat         # 1-Klik Buka Dashboard Desktop GUI (Rekomendasi Utama)
├── gui_app.py                    # Aplikasi Desktop GUI Python (Native Dark Mode)
├── run_stealth.py                # CLI utama untuk mengelola & meluncurkan browser
├── Jalankan_Stealth_Browser.bat  # 1-Klik Buka Profil Bawaan
├── Menu_Profil.bat               # Menu Konsol Cepat
├── README_STEALTH.md             # Panduan lengkap dokumentasi ini
├── stealth_browser/
│   ├── __init__.py
│   ├── profile_manager.py        # Pengelola profil & hardware preset
│   ├── stealth_hooks.py          # Generator JavaScript injeksi anti-detect
│   ├── launcher.py               # Spawner Chrome + Dual-layer CDP & Extension
│   └── extension/                # Unpacked Extension fallback (Manifest V3)
└── profiles/                     # Direktori penyimpanan profil terisolasi (UserData)
    ├── profile_rtx3070/
    └── profile_apple_m2/
```

---

## 3. Cara Penggunaan (Paling Mudah via GUI)

Cukup dobel-klik file:
**`Buka_Dashboard_UI.bat`**

Antarmuka desktop modern (Dark Theme) akan langsung terbuka tanpa terminal. Dari dashboard ini Anda dapat:
* Melihat semua profil identitas beserta statusnya (*Siap / Aktif*).
* Menekan **"+ Buat Profil Baru"** untuk memilih preset hardware (NVIDIA RTX 3070, RTX 4080, Intel Iris, Apple M2) dan proxy.
* Menekan **"▶ Buka Browser Terpilih"** untuk langsung meluncurkan browser anti-detect.
* Menekan **"Uji Fingerprint"** untuk memeriksa skor anonimitas di BrowserLeaks / CreepJS.
* Menekan **"⏹ Hentikan Browser"** atau **"📁 Buka Folder Data"**.

---

## 4. Cara Penggunaan Alternatif (CLI / Terminal)

### A. Melihat Daftar Profil
```bash
python run_stealth.py --list
```

### B. Membuat Profil Baru dengan Preset Hardware Tertentu
Tersedia 4 preset hardware bawaan:
* `0`: Windows 10 + NVIDIA GeForce RTX 3070 (8 Core, 8 GB RAM)
* `1`: Windows 10 + NVIDIA GeForce RTX 4080 (16 Core, 16 GB RAM)
* `2`: Windows 10 + Intel Iris Xe Graphics (8 Core, 8 GB RAM)
* `3`: macOS + Apple M2 (8 Core, 8 GB RAM)

Contoh pembuatan:
```bash
python run_stealth.py --create --profile toko_online_1 --preset 0
python run_stealth.py --create --profile akun_us_2 --preset 1 --proxy "http://user:pass@proxy-us.com:8080"
```

### C. Menjalankan Browser & Menguji Fingerprint
Buka situs uji fingerprint bawaan (`browserleaks.com/canvas`):
```bash
python run_stealth.py --profile toko_online_1 --test
```

Atau arahkan ke URL custom:
```bash
python run_stealth.py --profile toko_online_1 --url "https://iphey.com"
```

### D. Menghapus Profil
```bash
python run_stealth.py --delete toko_online_1
```

---

## 4. Integrasi dengan Script Otomasi (Playwright)

Jika Anda ingin mengontrol browser melalui Python Playwright secara terprogram:

```python
import asyncio
from playwright.async_api import async_playwright
from stealth_browser.profile_manager import ProfileManager
from stealth_browser.stealth_hooks import generate_stealth_script

async def run_stealth_automation():
    mgr = ProfileManager()
    profile = mgr.get_profile("toko_online_1")
    stealth_js = generate_stealth_script(profile)

    async with async_playwright() as p:
        # Jalankan context persisten dengan isolasi UserData
        context = await p.chromium.launch_persistent_context(
            user_data_dir=profile["user_data_dir"],
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                f"--user-agent={profile['user_agent']}"
            ]
        )
        
        # Injeksi script anti-detect pada seluruh frame & navigasi
        await context.add_init_script(stealth_js)
        
        page = await context.new_page()
        await page.goto("https://browserleaks.com/canvas")
        await asyncio.sleep(10)
        await context.close()

asyncio.run(run_stealth_automation())
```

---

## 5. Perbandingan: Octo Browser vs. Native Stealth Engine

| Fitur | Octo Browser (Resmi) | Native Stealth Engine (Lokal) |
| :--- | :--- | :--- |
| **Ketergantungan Akun** | Wajib Login / Cloud API | **100% Offline / Tanpa Akun** |
| **Biaya Langganan** | €29 - €329 / bulan | **Gratis & Open Source** |
| **Isolasi Profile Disk** | Enkripsi Cloud / Cache lokal | **UserData Chrome Asli per Profil** |
| **Dukungan Proxy** | HTTP / SOCKS5 / SSH | **HTTP / SOCKS5 bawaan Chrome** |
| **Canvas & WebGL Spoof** | Modifikasi Core Chromium | **Dual-layer CDP + Manifest V3 Injeksi** |
| **Keamanan Privasi** | Metadata disimpan di server Octo | **Data tersimpan 100% di PC Anda** |

