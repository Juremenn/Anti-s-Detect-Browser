# Report 01: Orchestration Architecture & Profile Launch Mechanism

**Target**: Octo Browser v3.2.4  
**Date**: 2026-11-13  
**Analysis Type**: Offline Static Reverse Engineering (De-obfuscation & Bytecode Inspection)

---

## 1. Executive Summary

Berdasarkan ekstraksi payload installer dan pembongkaran arsip biner `Octo Browser.exe`:
1. **Tech Stack Desktop Client**: Bukan Electron standar, melainkan **Python 3.12 (win_amd64)** yang dipaketkan menggunakan **PyInstaller**, dipadukan dengan **pywebview** (antarmuka Microsoft Edge WebView2), dan bundle frontend web berbasis React/Vite (`_internal/assets_new/app/`).
2. **Local Daemon & Automation RPC**: Aplikasi menjalankan daemon server lokal berbasis **FastAPI** (`octo.fastapi`) dan WebSocket (`octo.websocket`) untuk mengelola komunikasi internal, REST API otomasi, serta penanganan event profil.
3. **Identitas Mesin Browser**: Browser engine Octo Browser diberi nama **Octium** (fork Chromium proprietary yang telah dimodifikasi). Octium dikelola sebagai komponen modular (`OctiumComponentLifecycle`) di bawah folder biner `bin/Octium/<version>/`.

---

## 2. Command-Line Arguments & Parameter Passing (Client $\rightarrow$ Octium)

Saat profil browser diluncurkan (`octo.browser.launch_args.LaunchArgs` dan `octo.browser.browser.Browser.start`), Octo Browser mengeksekusi biner `octium.exe` dengan command-line switches berikut:

| Flag / Parameter | Deskripsi & Tujuan |
|---|---|
| `--octokey=<key>` | Kunci otorisasi/kriptografis unik per-sesi yang digunakan core Octium untuk mendekripsi konfigurasi profil (`octo_config.json`) dan canvas blobs. Parameter ini diproteksi dari logging sanitized. |
| `--octo-client-port=<port>` | Port lokal HTTP daemon FastAPI. Octium menggunakannya untuk callback RPC dan meneruskan request internal (`forward_octium_requests`). |
| `--user-data-dir=<path>` | Jalur direktori data profil pengguna (`[AppData]/.../profiles/<uuid>`). |
| `--disk-cache-dir=<path>` | Jalur cache disk lokal untuk sesi profil terkait. |
| `--remote-debugging-port=<port>` | Port Chrome DevTools Protocol (CDP) untuk kontrol lifecycle dan otomasi browser. |
| `--load-extension=<paths>` | Memuat ekstensi internal Octium (`OctiumExtension`) yang di-inject secara otomatis. |
| `--proxy-server=<proxy>` | Mengarahkan lalu lintas jaringan melalui local proxy forwarder (`octo.proxy.forwarder`). |
| `--enable-logging=stderr` | Mengalihkan log internal engine ke file buffer `_stdout.log` dan `_stderr.log`. |

---

## 3. Struktur File System Profil (`octo.browser.fs.BrowserFS`)

Setiap profil Octo Browser diisolasi dalam struktur folder terstruktur:

```
[Profile_Dir]/
├── Default/
│   ├── Preferences             # Pengaturan Chromium standar
│   ├── Secure Preferences      # Pengaturan preferensi yang di-hash
│   ├── StoragePrefs            # Pengaturan penyimpanan profil
│   ├── NotCached               # File pasangan Canvas Spoofing (dibaca oleh core Chromium)
│   ├── Cached                  # Cache status canvas
│   └── Cookies                 # Database SQLite cookie sesi
├── Local State                 # Konfigurasi state lokal Chromium
├── octo_config.json            # Konfigurasi anti-detect terenkripsi (fingerprint profile)
├── profile_config.json         # Konfigurasi metadata profil
└── snare_file                  # File umpan berisi byte acak (SNARE_FILE_SIZE_RANGE_KB) untuk anti-forensik
```

---

## 4. Mekanisme Spoofing Vektor Fingerprint

### 4.1. Canvas Spoofing: Real-User Replay & Matching (Bukan Random Noise Sederhana)
Berdasarkan dokumentasi teknis dan kode internal pada `octo.browser.canvas_cache` dan `octo.browser.fs`:
- Octo Browser **tidak** menggunakan generator noise acak matematis sederhana pada kanvas, karena noise acak mudah dideteksi oleh skrip fingerprint modern (seperti CreepJS atau FingerprintJS).
- Sebagai gantinya, Octo Browser mengimplementasikan arsitektur **Real-User Canvas Collection & Replay**:
  - Server Octo mengumpulkan script fingerprint canvas nyata beserta output gambar canvas dari pengguna asli dalam bentuk blob terenkripsi.
  - Blob diidentifikasi menggunakan `MD5(payload)` dan disimpan di cache global aplikasi:
    ```
    bcache/casc/<script_hash>/
        s                # Payload script uji canvas
        <canvas_hash>    # Payload gambar hasil render nyata pengguna asli
    ```
  - Sebelum profil berjalan, `BrowserFS.write_canvas_pairs` menuliskan daftar pasangan canvas ke file `Default/NotCached`.
  - Core browser (`Octium`) membaca file `NotCached`. Ketika sebuah halaman web mengeksekusi script canvas fingerprint yang cocok dengan `<script_hash>`, Octium langsung mengembalikan output render pengguna asli yang sesuai (`<canvas_hash>`).
  - Pembersihan cache dilakukan secara periodik melalui garbage collector background (`octo.browser.canvas_gc.CanvasCacheGC`).

### 4.2. WebGL & Hardware Emulation
Dikelola melalui schema model pydantic pada `octo.fastapi.schemas` dan `octo.fastapi.routers.profiles.schemas`:
- **WebGL Parameters**:
  - `UNMASKED_VENDOR_WEBGL`: Diisi vendor GPU target (misal: Google Inc. / NVIDIA Corporation).
  - `UNMASKED_RENDERER_WEBGL`: String renderer GPU emulasi (misal: ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)).
- **Hardware & Navigator**:
  - `hardwareConcurrency`: Jumlah logical core CPU emulasi.
  - `deviceMemory`: Kapasitas RAM (misal: 8 GB, 16 GB).
  - `Screen`: Resolusi layar (`screen_w`, `screen_y`), display depth, dan usable window area.
  - `Audio`: Konfigurasi `AudioIn` dan `AudioOut` device masking.
  - `WebRTC`: Pilihan mode WebRTC (`real`, `disabled`, atau `public_ip` replacement).

### 4.3. Network & TCP Stack Spoofing (`p0f` SYN Matching)
Pada modul `octo.proxy.p0f`:
- Octo Browser memeriksa fingerprint TCP/IP paket SYN (analisis p0f: MTU, TCP Window Size, Window Scale, MSS, dan TCP Options ordering).
- Memastikan bahwa jika profil diset sebagai "macOS" atau "Windows", karakteristik TCP stack pada proxy exit node selaras dengan OS yang diemulasikan (`syn_mode: profile_based`).
