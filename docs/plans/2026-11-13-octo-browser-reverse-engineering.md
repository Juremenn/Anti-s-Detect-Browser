# Octo Browser Reverse Engineering Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Melakukan reverse engineering statis dan offline terhadap Octo Browser v3.2.4 untuk memetakan arsitektur anti-detect dan modifikasi Chromium core (Canvas, WebGL, Audio, Hardware, TLS).

**Architecture:** Ekstraksi offline berjenjang dari installer Caphyon Advanced Installer ke direktori staging lokal, diikuti analisis lapisan konfigurasi & orchestrator Electron (`app.asar`), dan diakhiri dengan static binary analysis pada patched Chromium engine (`chrome.dll`) serta pendokumentasian komprehensif.

**Tech Stack:** Python 3.15, PowerShell, 7-Zip, REA (Reverse-Engineer-Anything MCP / Ghidra / Rizin), Electron ASAR extractor, PE Analysis utilities.

---

### Task 1: Offline Extraction of Caphyon Advanced Installer Payload

**Files:**
- Input: `Octo_Browser_latest_win.exe`
- Create: `scripts/unpack_installer.py`
- Output Directory: `extracted/`

**Step 1: Write the unpacking extraction script**

Create `scripts/unpack_installer.py` yang mendeteksi offset payload, struktur CAB/7z/MSI, dan mengekstrak file inti (MSI, CAB, atau biner terkompresi) secara offline tanpa eksekusi langsung installer.

**Step 2: Run the extraction script**

Run: `python scripts/unpack_installer.py`  
Expected Output: Berhasil mengekstrak seluruh artefak aplikasi (direktori aplikasi, `app.asar`, `chrome.dll`, resources) ke folder `extracted/`.

**Step 3: Verify extracted components inventory**

Run: `powershell -Command "Get-ChildItem -Recurse extracted | Select-Object -First 30"`  
Expected Output: Menampilkan daftar file biner utama seperti `chrome.dll`, `app.asar`, file `.pak`, dan `.dll` lainnya.

**Step 4: Commit**

```bash
git add scripts/unpack_installer.py
git commit -m "feat: implement offline installer unpacking script"
```

---

### Task 2: Static Analysis of Electron Orchestration & Profile Launch Layer

**Files:**
- Input: `extracted/**/app.asar`
- Create: `scripts/analyze_asar.py`
- Output: `reports/01_electron_orchestration.md`

**Step 1: Extract `app.asar` package**

Unpack file `app.asar` ke `extracted/asar_unpacked/` menggunakan script Node.js atau Python ASAR unpacker.

**Step 2: Inspect browser spawner and flag injection logic**

Analisis file JavaScript peluncur browser (mencari spawn arguments, command-line flags Chromium, CDP hooks, dan seed generator).

**Step 3: Document IPC and CLI flags profile mapping**

Simpan temuan konfigurasi, list flags custom (e.g., `--octo-*` atau parameter fingerprint), dan mekanisme passing profil ke `reports/01_electron_orchestration.md`.

**Step 4: Commit**

```bash
git add scripts/analyze_asar.py reports/01_electron_orchestration.md
git commit -m "feat: analyze electron orchestration and browser launch arguments"
```

---

### Task 3: Deep Binary Analysis of Patched Chromium Core (`chrome.dll` & Native Modules)

**Files:**
- Input: `extracted/**/chrome.dll` (dan modul biner pendukung)
- Create: `scripts/scan_fingerprint_hooks.py`
- Output: `reports/02_chromium_fingerprint_hooks.md`

**Step 1: Scan string tables and symbols for fingerprint vectors**

Gunakan script pemindai pola dan REA MCP (`search_strings`, `binary_overview`, `find_xrefs_to_name`) untuk memetakan referensi ke:
- Canvas: `toDataURL`, `getImageData`, Skia noise injection.
- WebGL: `getParameter`, `UNMASKED_VENDOR_WEBGL`, `UNMASKED_RENDERER_WEBGL`.
- Audio: `AnalyserNode`, `getFloatFrequencyData`, `AudioDestinationNode`.
- Hardware: `hardwareConcurrency`, `deviceMemory`, platform constants.
- TLS/BoringSSL: Cipher suites ordering, ALPN extensions, GREASE.

**Step 2: Perform disassembly and decompilation on identified functions**

Analisis fungsi target di `chrome.dll` untuk mengidentifikasi apakah modifikasi berupa hooking table, in-place patching, atau custom build flags.

**Step 3: Document engine modifications per vector**

Catat temuan detail matematis (pola noise, random vs profile-seeded) di `reports/02_chromium_fingerprint_hooks.md`.

**Step 4: Commit**

```bash
git add scripts/scan_fingerprint_hooks.py reports/02_chromium_fingerprint_hooks.md
git commit -m "feat: analyze chromium engine binary fingerprint hooks"
```

---

### Task 4: Synthesis & Final Technical Reverse Engineering Report

**Files:**
- Input: `reports/01_electron_orchestration.md`, `reports/02_chromium_fingerprint_hooks.md`
- Create: `OCTO_BROWSER_REVERSE_ENGINEERING_REPORT.md`

**Step 1: Synthesize all findings into comprehensive report**

Susun laporan akhir yang mencakup:
1. Executive Summary & Arsitektur Lengkap.
2. Mekanisme Injeksi Profil (Electron $\rightarrow$ Chromium).
3. Modifikasi Vektor per Vektor (Canvas, WebGL, Audio, Hardware, TLS).
4. Penilaian Efektivitas & Karakteristik Noise Anti-Detect.

**Step 2: Review and verify completeness**

Pastikan seluruh pertanyaan checklist terjawab dengan bukti biner/kode konkret tanpa spekulasi.

**Step 3: Commit**

```bash
git add OCTO_BROWSER_REVERSE_ENGINEERING_REPORT.md
git commit -m "docs: finalize octo browser reverse engineering report"
```

