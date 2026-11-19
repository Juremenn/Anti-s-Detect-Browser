#!/usr/bin/env python3
"""
generate_100_presets.py - Generates 100 authentic, internally consistent device presets.
Distribution:
- 35 Windows Laptops & Desktops
- 25 macOS Devices (Apple Silicon & Intel)
- 20 iOS Devices (iPhones & iPads)
- 20 Android Devices (Samsung, Google Pixel, OnePlus, Xiaomi)

Outputs:
1. extensions/anti-detect-browser/presets.json (< 65 KB)
2. stealth_browser/data/presets.json
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def make_win_preset(pid, name, category, gpu_name, gpu_vendor, cores, mem, w, h, dpr, touch=0, win_ver="11"):
    nt_ver = "10.0"
    renderer = f"ANGLE ({gpu_vendor}, {gpu_name} Direct3D11 vs_5_0 ps_5_0, D3D11)"
    ua = f"Mozilla/5.0 (Windows NT {nt_ver}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    return {
        "id": pid,
        "name": name,
        "label": f"{name} · {gpu_name} · {cores}C/8GB · {w}×{h}",
        "category": category,
        "os": "win",
        "platform": "Win32",
        "webgl_vendor": f"Google Inc. ({gpu_vendor})",
        "webgl_renderer": renderer,
        "hardware_concurrency": cores,
        "device_memory": min(8, mem),
        "screen_width": w,
        "screen_height": h,
        "device_pixel_ratio": dpr,
        "max_touch_points": touch,
        "user_agent": ua
    }

def make_mac_preset(pid, name, category, chip, cores, mem, w, h, dpr, mac_ver="14.5.0"):
    renderer = f"ANGLE (Apple, Apple {chip} (Metal), Metal)"
    ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    return {
        "id": pid,
        "name": name,
        "label": f"{name} · {chip} · {cores}C/8GB · {w}×{h}",
        "category": category,
        "os": "mac",
        "platform": "MacIntel",
        "webgl_vendor": "Google Inc. (Apple)",
        "webgl_renderer": renderer,
        "hardware_concurrency": cores,
        "device_memory": min(8, mem),
        "screen_width": w,
        "screen_height": h,
        "device_pixel_ratio": dpr,
        "max_touch_points": 0,
        "user_agent": ua
    }

def make_ios_preset(pid, name, category, model, cores, mem, w, h, dpr, ios_ver="17_5"):
    renderer = "Apple GPU"
    platform = "iPad" if category == "tablet" else "iPhone"
    ua = f"Mozilla/5.0 ({platform}; CPU {platform} OS {ios_ver} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1"
    return {
        "id": pid,
        "name": name,
        "label": f"{name} · Apple GPU · {cores}C/8GB · {w}×{h}",
        "category": category,
        "os": "ios",
        "platform": platform,
        "model": model,
        "webgl_vendor": "Apple Inc.",
        "webgl_renderer": renderer,
        "hardware_concurrency": cores,
        "device_memory": min(8, mem),
        "screen_width": w,
        "screen_height": h,
        "device_pixel_ratio": dpr,
        "max_touch_points": 5,
        "user_agent": ua
    }

def make_android_preset(pid, name, category, model, gpu_renderer, gpu_vendor, cores, mem, w, h, dpr, android_ver="14"):
    ua = f"Mozilla/5.0 (Linux; Android {android_ver}; {model}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.85 Mobile Safari/537.36"
    return {
        "id": pid,
        "name": name,
        "label": f"{name} · {gpu_renderer.split('(')[0].strip()} · {cores}C/8GB · {w}×{h}",
        "category": category,
        "os": "android",
        "platform": "Linux armv8l",
        "model": model,
        "webgl_vendor": f"Google Inc. ({gpu_vendor})",
        "webgl_renderer": gpu_renderer,
        "hardware_concurrency": cores,
        "device_memory": min(8, mem),
        "screen_width": w,
        "screen_height": h,
        "device_pixel_ratio": dpr,
        "max_touch_points": 5,
        "user_agent": ua
    }

def build_all_100():
    presets = []

    # =========================================================================
    # 35 WINDOWS LAPTOPS & DESKTOPS
    # =========================================================================
    presets.append(make_win_preset("win-thinkpad-x1-g12", "Lenovo ThinkPad X1 Carbon Gen 12", "laptop", "Intel(R) Arc(TM) Graphics", "Intel", 16, 8, 2880, 1800, 2.0))
    presets.append(make_win_preset("win-thinkpad-x1-g11", "Lenovo ThinkPad X1 Carbon Gen 11", "laptop", "Intel(R) Iris(R) Xe Graphics", "Intel", 12, 8, 1920, 1200, 1.25))
    presets.append(make_win_preset("win-thinkpad-t14s-g4", "Lenovo ThinkPad T14s Gen 4 AMD", "laptop", "AMD Radeon 780M", "AMD", 16, 8, 1920, 1200, 1.25))
    presets.append(make_win_preset("win-thinkpad-p1-g6", "Lenovo ThinkPad P1 Gen 6", "laptop", "NVIDIA RTX 4080 Laptop GPU", "NVIDIA", 20, 8, 2560, 1600, 1.5))
    presets.append(make_win_preset("win-yoga-9i", "Lenovo Yoga 9i Dual OLED", "laptop", "Intel(R) Iris(R) Xe Graphics", "Intel", 14, 8, 2880, 1800, 2.0, touch=10))
    presets.append(make_win_preset("win-yoga-pro-9i", "Lenovo Yoga Pro 9i 16", "laptop", "NVIDIA GeForce RTX 4070 Laptop GPU", "NVIDIA", 16, 8, 3200, 2000, 2.0))
    presets.append(make_win_preset("win-legion-pro-7i", "Lenovo Legion Pro 7i Gen 9", "laptop", "NVIDIA GeForce RTX 4090 Laptop GPU", "NVIDIA", 24, 8, 2560, 1600, 1.25))
    presets.append(make_win_preset("win-dell-xps-13-plus", "Dell XPS 13 Plus 9320", "laptop", "Intel(R) Iris(R) Xe Graphics", "Intel", 12, 8, 1920, 1200, 1.25))
    presets.append(make_win_preset("win-dell-xps-14-9440", "Dell XPS 14 9440", "laptop", "NVIDIA GeForce RTX 4050 Laptop GPU", "NVIDIA", 16, 8, 3200, 2000, 2.0))
    presets.append(make_win_preset("win-dell-xps-15-9530", "Dell XPS 15 9530", "laptop", "NVIDIA GeForce RTX 4070 Laptop GPU", "NVIDIA", 14, 8, 1920, 1080, 1.0))
    presets.append(make_win_preset("win-dell-xps-16-9640", "Dell XPS 16 9640", "laptop", "NVIDIA GeForce RTX 4070 Laptop GPU", "NVIDIA", 16, 8, 3840, 2400, 2.0))
    presets.append(make_win_preset("win-dell-latitude-7440", "Dell Latitude 7440 Ultralight", "laptop", "Intel(R) Iris(R) Xe Graphics", "Intel", 10, 8, 1920, 1200, 1.25))
    presets.append(make_win_preset("win-dell-precision-5680", "Dell Precision 5680 Workstation", "laptop", "NVIDIA RTX 5000 Ada Generation Laptop GPU", "NVIDIA", 20, 8, 3840, 2400, 2.0))
    presets.append(make_win_preset("win-alienware-m16-r2", "Dell Alienware m16 R2", "laptop", "NVIDIA GeForce RTX 4070 Laptop GPU", "NVIDIA", 16, 8, 2560, 1600, 1.25))
    presets.append(make_win_preset("win-surface-laptop-6", "Microsoft Surface Laptop 6 for Business", "laptop", "Intel(R) Arc(TM) Graphics", "Intel", 14, 8, 2496, 1664, 1.5, touch=10))
    presets.append(make_win_preset("win-surface-pro-10", "Microsoft Surface Pro 10", "tablet", "Intel(R) Arc(TM) Graphics", "Intel", 12, 8, 2880, 1920, 2.0, touch=10))
    presets.append(make_win_preset("win-surface-studio-2", "Microsoft Surface Laptop Studio 2", "laptop", "NVIDIA GeForce RTX 4060 Laptop GPU", "NVIDIA", 14, 8, 2400, 1600, 1.5, touch=10))
    presets.append(make_win_preset("win-hp-spectre-x360-14", "HP Spectre x360 14 OLED", "laptop", "Intel(R) Arc(TM) Graphics", "Intel", 16, 8, 2880, 1800, 2.0, touch=10))
    presets.append(make_win_preset("win-hp-spectre-x360-16", "HP Spectre x360 16", "laptop", "NVIDIA GeForce RTX 4050 Laptop GPU", "NVIDIA", 16, 8, 2560, 1600, 1.5, touch=10))
    presets.append(make_win_preset("win-hp-elitebook-840-g10", "HP EliteBook 840 G10", "laptop", "Intel(R) Iris(R) Xe Graphics", "Intel", 12, 8, 1920, 1200, 1.25))
    presets.append(make_win_preset("win-hp-omen-transcend-14", "HP OMEN Transcend 14 OLED", "laptop", "NVIDIA GeForce RTX 4060 Laptop GPU", "NVIDIA", 16, 8, 2880, 1800, 2.0))
    presets.append(make_win_preset("win-asus-zenbook-14-oled", "ASUS Zenbook 14 OLED UX3405", "laptop", "Intel(R) Arc(TM) Graphics", "Intel", 16, 8, 2880, 1800, 2.0))
    presets.append(make_win_preset("win-asus-rog-zephyrus-g14", "ASUS ROG Zephyrus G14 OLED", "laptop", "NVIDIA GeForce RTX 4070 Laptop GPU", "NVIDIA", 16, 8, 2880, 1800, 2.0))
    presets.append(make_win_preset("win-asus-rog-zephyrus-g16", "ASUS ROG Zephyrus G16 OLED", "laptop", "NVIDIA GeForce RTX 4080 Laptop GPU", "NVIDIA", 16, 8, 2560, 1600, 1.5))
    presets.append(make_win_preset("win-asus-expertbook-b9", "ASUS ExpertBook B9 OLED", "laptop", "Intel(R) Iris(R) Xe Graphics", "Intel", 10, 8, 2880, 1800, 2.0))
    presets.append(make_win_preset("win-razer-blade-14", "Razer Blade 14 (2024)", "laptop", "NVIDIA GeForce RTX 4070 Laptop GPU", "NVIDIA", 16, 8, 2560, 1600, 1.5))
    presets.append(make_win_preset("win-razer-blade-16", "Razer Blade 16 Dual Mini-LED", "laptop", "NVIDIA GeForce RTX 4090 Laptop GPU", "NVIDIA", 24, 8, 3840, 2400, 2.0))
    presets.append(make_win_preset("win-acer-swift-go-14", "Acer Swift Go 14 OLED", "laptop", "Intel(R) Arc(TM) Graphics", "Intel", 14, 8, 2880, 1800, 2.0))
    presets.append(make_win_preset("win-acer-predator-helios-16", "Acer Predator Helios 16", "laptop", "NVIDIA GeForce RTX 4080 Laptop GPU", "NVIDIA", 24, 8, 2560, 1600, 1.25))
    presets.append(make_win_preset("win-msi-prestige-16-ai", "MSI Prestige 16 AI Evo", "laptop", "Intel(R) Arc(TM) Graphics", "Intel", 16, 8, 2560, 1600, 1.5))
    presets.append(make_win_preset("win-desktop-rtx-4090", "Custom Gaming PC (RTX 4090)", "desktop", "NVIDIA GeForce RTX 4090", "NVIDIA", 24, 8, 3840, 2160, 1.5))
    presets.append(make_win_preset("win-desktop-rtx-4080s", "Workstation Pro (RTX 4080 Super)", "desktop", "NVIDIA GeForce RTX 4080 SUPER", "NVIDIA", 20, 8, 2560, 1440, 1.0))
    presets.append(make_win_preset("win-desktop-rtx-4070ti", "Creator Rig (RTX 4070 Ti Super)", "desktop", "NVIDIA GeForce RTX 4070 Ti SUPER", "NVIDIA", 16, 8, 2560, 1440, 1.0))
    presets.append(make_win_preset("win-desktop-rx-7900xtx", "Radeon Gaming PC (RX 7900 XTX)", "desktop", "AMD Radeon RX 7900 XTX", "AMD", 16, 8, 3840, 2160, 1.5))
    presets.append(make_win_preset("win-desktop-intel-arc-a770", "Intel Arc Creative Studio (A770)", "desktop", "Intel(R) Arc(TM) A770 Graphics", "Intel", 14, 8, 1920, 1080, 1.0))

    # =========================================================================
    # 25 MACOS DEVICES (APPLE SILICON & INTEL)
    # =========================================================================
    presets.append(make_mac_preset("mac-mba-13-m1", "MacBook Air 13\" (M1)", "laptop", "M1", 8, 8, 2560, 1600, 2.0))
    presets.append(make_mac_preset("mac-mba-13-m2", "MacBook Air 13\" (M2)", "laptop", "M2", 8, 8, 2560, 1664, 2.0))
    presets.append(make_mac_preset("mac-mba-15-m2", "MacBook Air 15\" (M2)", "laptop", "M2", 8, 8, 2880, 1864, 2.0))
    presets.append(make_mac_preset("mac-mba-13-m3", "MacBook Air 13\" (M3)", "laptop", "M3", 8, 8, 2560, 1664, 2.0))
    presets.append(make_mac_preset("mac-mba-15-m3", "MacBook Air 15\" (M3)", "laptop", "M3", 8, 8, 2880, 1864, 2.0))
    presets.append(make_mac_preset("mac-mbp-14-m1-pro", "MacBook Pro 14\" (M1 Pro)", "laptop", "M1 Pro", 10, 8, 3024, 1964, 2.0))
    presets.append(make_mac_preset("mac-mbp-16-m1-max", "MacBook Pro 16\" (M1 Max)", "laptop", "M1 Max", 10, 8, 3456, 2234, 2.0))
    presets.append(make_mac_preset("mac-mbp-14-m2-pro", "MacBook Pro 14\" (M2 Pro)", "laptop", "M2 Pro", 12, 8, 3024, 1964, 2.0))
    presets.append(make_mac_preset("mac-mbp-16-m2-max", "MacBook Pro 16\" (M2 Max)", "laptop", "M2 Max", 12, 8, 3456, 2234, 2.0))
    presets.append(make_mac_preset("mac-mbp-14-m3", "MacBook Pro 14\" (M3)", "laptop", "M3", 8, 8, 3024, 1964, 2.0))
    presets.append(make_mac_preset("mac-mbp-14-m3-pro", "MacBook Pro 14\" (M3 Pro)", "laptop", "M3 Pro", 11, 8, 3024, 1964, 2.0))
    presets.append(make_mac_preset("mac-mbp-16-m3-pro", "MacBook Pro 16\" (M3 Pro)", "laptop", "M3 Pro", 12, 8, 3456, 2234, 2.0))
    presets.append(make_mac_preset("mac-mbp-16-m3-max", "MacBook Pro 16\" (M3 Max)", "laptop", "M3 Max", 16, 8, 3456, 2234, 2.0))
    presets.append(make_mac_preset("mac-mbp-14-m4", "MacBook Pro 14\" (M4)", "laptop", "M4", 10, 8, 3024, 1964, 2.0))
    presets.append(make_mac_preset("mac-mbp-14-m4-pro", "MacBook Pro 14\" (M4 Pro)", "laptop", "M4 Pro", 12, 8, 3024, 1964, 2.0))
    presets.append(make_mac_preset("mac-mbp-16-m4-max", "MacBook Pro 16\" (M4 Max)", "laptop", "M4 Max", 16, 8, 3456, 2234, 2.0))
    presets.append(make_mac_preset("mac-imac-24-m1", "iMac 24\" 4.5K (M1)", "desktop", "M1", 8, 8, 4480, 2520, 2.0))
    presets.append(make_mac_preset("mac-imac-24-m3", "iMac 24\" 4.5K (M3)", "desktop", "M3", 8, 8, 4480, 2520, 2.0))
    presets.append(make_mac_preset("mac-mini-m2", "Mac mini (M2)", "desktop", "M2", 8, 8, 2560, 1440, 2.0))
    presets.append(make_mac_preset("mac-mini-m2-pro", "Mac mini (M2 Pro)", "desktop", "M2 Pro", 10, 8, 3840, 2160, 2.0))
    presets.append(make_mac_preset("mac-mini-m4", "Mac mini (M4)", "desktop", "M4", 10, 8, 3840, 2160, 2.0))
    presets.append(make_mac_preset("mac-studio-m2-max", "Mac Studio (M2 Max)", "desktop", "M2 Max", 12, 8, 5120, 2880, 2.0))
    presets.append(make_mac_preset("mac-studio-m2-ultra", "Mac Studio (M2 Ultra)", "desktop", "M2 Ultra", 24, 8, 5120, 2880, 2.0))
    presets.append(make_mac_preset("mac-pro-m2-ultra", "Mac Pro Rack (M2 Ultra)", "desktop", "M2 Ultra", 24, 8, 6016, 3384, 2.0))
    presets.append(make_mac_preset("mac-mbp-16-intel", "MacBook Pro 16\" (Intel Core i9)", "laptop", "Radeon Pro 5500M", 16, 8, 3072, 1920, 2.0))

    # =========================================================================
    # 20 IOS DEVICES (IPHONE & IPAD)
    # =========================================================================
    presets.append(make_ios_preset("ios-iphone-13", "Apple iPhone 13", "mobile", "iPhone 13", 6, 4, 390, 844, 3.0))
    presets.append(make_ios_preset("ios-iphone-13-pro", "Apple iPhone 13 Pro", "mobile", "iPhone 13 Pro", 6, 6, 390, 844, 3.0))
    presets.append(make_ios_preset("ios-iphone-13-mini", "Apple iPhone 13 mini", "mobile", "iPhone 13 mini", 6, 4, 375, 812, 3.0))
    presets.append(make_ios_preset("ios-iphone-14", "Apple iPhone 14", "mobile", "iPhone 14", 6, 6, 390, 844, 3.0))
    presets.append(make_ios_preset("ios-iphone-14-plus", "Apple iPhone 14 Plus", "mobile", "iPhone 14 Plus", 6, 6, 428, 926, 3.0))
    presets.append(make_ios_preset("ios-iphone-14-pro", "Apple iPhone 14 Pro", "mobile", "iPhone 14 Pro", 6, 6, 393, 852, 3.0))
    presets.append(make_ios_preset("ios-iphone-14-pro-max", "Apple iPhone 14 Pro Max", "mobile", "iPhone 14 Pro Max", 6, 6, 430, 932, 3.0))
    presets.append(make_ios_preset("ios-iphone-15", "Apple iPhone 15", "mobile", "iPhone 15", 6, 6, 393, 852, 3.0))
    presets.append(make_ios_preset("ios-iphone-15-plus", "Apple iPhone 15 Plus", "mobile", "iPhone 15 Plus", 6, 6, 430, 932, 3.0))
    presets.append(make_ios_preset("ios-iphone-15-pro", "Apple iPhone 15 Pro", "mobile", "iPhone 15 Pro", 6, 8, 393, 852, 3.0))
    presets.append(make_ios_preset("ios-iphone-15-pro-max", "Apple iPhone 15 Pro Max", "mobile", "iPhone 15 Pro Max", 6, 8, 430, 932, 3.0))
    presets.append(make_ios_preset("ios-iphone-16", "Apple iPhone 16", "mobile", "iPhone 16", 6, 8, 393, 852, 3.0))
    presets.append(make_ios_preset("ios-iphone-16-plus", "Apple iPhone 16 Plus", "mobile", "iPhone 16 Plus", 6, 8, 430, 932, 3.0))
    presets.append(make_ios_preset("ios-iphone-16-pro", "Apple iPhone 16 Pro", "mobile", "iPhone 16 Pro", 6, 8, 402, 874, 3.0))
    presets.append(make_ios_preset("ios-iphone-16-pro-max", "Apple iPhone 16 Pro Max", "mobile", "iPhone 16 Pro Max", 6, 8, 440, 956, 3.0))
    presets.append(make_ios_preset("ios-ipad-pro-11-m2", "Apple iPad Pro 11\" (M2)", "tablet", "iPad Pro 11", 8, 8, 834, 1194, 2.0))
    presets.append(make_ios_preset("ios-ipad-pro-12-m2", "Apple iPad Pro 12.9\" (M2)", "tablet", "iPad Pro 12.9", 8, 8, 1024, 1366, 2.0))
    presets.append(make_ios_preset("ios-ipad-pro-11-m4", "Apple iPad Pro 11\" Ultra Retina (M4)", "tablet", "iPad Pro 11 M4", 9, 8, 834, 1210, 2.0))
    presets.append(make_ios_preset("ios-ipad-pro-13-m4", "Apple iPad Pro 13\" Ultra Retina (M4)", "tablet", "iPad Pro 13 M4", 10, 8, 1032, 1376, 2.0))
    presets.append(make_ios_preset("ios-ipad-air-11-m2", "Apple iPad Air 11\" (M2)", "tablet", "iPad Air 11", 8, 8, 820, 1180, 2.0))

    # =========================================================================
    # 20 ANDROID DEVICES (SAMSUNG, GOOGLE, ONEPLUS, XIAOMI)
    # =========================================================================
    presets.append(make_android_preset("and-samsung-s24-ultra", "Samsung Galaxy S24 Ultra", "mobile", "SM-S928B", "Adreno (TM) 750", "Qualcomm", 8, 8, 384, 832, 3.75))
    presets.append(make_android_preset("and-samsung-s24-plus", "Samsung Galaxy S24+", "mobile", "SM-S926B", "Samsung Xclipse 940", "Samsung", 10, 8, 384, 832, 3.75))
    presets.append(make_android_preset("and-samsung-s24", "Samsung Galaxy S24", "mobile", "SM-S921B", "Samsung Xclipse 940", "Samsung", 10, 8, 360, 780, 3.0))
    presets.append(make_android_preset("and-samsung-s23-ultra", "Samsung Galaxy S23 Ultra", "mobile", "SM-S918B", "Adreno (TM) 740", "Qualcomm", 8, 8, 384, 824, 3.75))
    presets.append(make_android_preset("and-samsung-s23", "Samsung Galaxy S23", "mobile", "SM-S911B", "Adreno (TM) 740", "Qualcomm", 8, 8, 360, 780, 3.0))
    presets.append(make_android_preset("and-samsung-z-fold5", "Samsung Galaxy Z Fold5 (Folded)", "mobile", "SM-F946B", "Adreno (TM) 740", "Qualcomm", 8, 8, 374, 905, 2.625))
    presets.append(make_android_preset("and-samsung-z-flip5", "Samsung Galaxy Z Flip5", "mobile", "SM-F731B", "Adreno (TM) 740", "Qualcomm", 8, 8, 412, 919, 2.625))
    presets.append(make_android_preset("and-samsung-a54", "Samsung Galaxy A54 5G", "mobile", "SM-A546B", "Mali-G68 MP5", "ARM", 8, 8, 412, 915, 2.625))
    presets.append(make_android_preset("and-samsung-tab-s9-ultra", "Samsung Galaxy Tab S9 Ultra", "tablet", "SM-X910", "Adreno (TM) 740", "Qualcomm", 8, 8, 936, 1498, 2.0))
    presets.append(make_android_preset("and-google-pixel-9-pro-xl", "Google Pixel 9 Pro XL", "mobile", "Pixel 9 Pro XL", "Mali-G715-Immortalis MC10", "ARM", 8, 8, 412, 892, 3.5))
    presets.append(make_android_preset("and-google-pixel-9-pro", "Google Pixel 9 Pro", "mobile", "Pixel 9 Pro", "Mali-G715-Immortalis MC10", "ARM", 8, 8, 412, 892, 3.5))
    presets.append(make_android_preset("and-google-pixel-9", "Google Pixel 9", "mobile", "Pixel 9", "Mali-G715-Immortalis MC10", "ARM", 8, 8, 412, 915, 2.625))
    presets.append(make_android_preset("and-google-pixel-8-pro", "Google Pixel 8 Pro", "mobile", "Pixel 8 Pro", "Mali-G715-Immortalis MC10", "ARM", 8, 8, 412, 892, 3.5))
    presets.append(make_android_preset("and-google-pixel-8", "Google Pixel 8", "mobile", "Pixel 8", "Mali-G715-Immortalis MC10", "ARM", 8, 8, 412, 915, 2.625))
    presets.append(make_android_preset("and-google-pixel-7a", "Google Pixel 7a", "mobile", "Pixel 7a", "Mali-G710", "ARM", 8, 8, 412, 915, 2.625))
    presets.append(make_android_preset("and-google-pixel-fold", "Google Pixel Fold", "mobile", "Pixel Fold", "Mali-G710", "ARM", 8, 8, 380, 842, 2.8125))
    presets.append(make_android_preset("and-oneplus-12", "OnePlus 12", "mobile", "CPH2581", "Adreno (TM) 750", "Qualcomm", 8, 8, 450, 996, 3.2))
    presets.append(make_android_preset("and-xiaomi-14-ultra", "Xiaomi 14 Ultra", "mobile", "24030PN60G", "Adreno (TM) 750", "Qualcomm", 8, 8, 412, 915, 3.5))
    presets.append(make_android_preset("and-nothing-phone-2", "Nothing Phone (2)", "mobile", "A065", "Adreno (TM) 730", "Qualcomm", 8, 8, 412, 915, 2.625))
    presets.append(make_android_preset("and-asus-rog-phone-8", "ASUS ROG Phone 8 Pro", "mobile", "ASUS_AI2401", "Adreno (TM) 750", "Qualcomm", 8, 8, 412, 915, 2.625))

    return presets

def enrich_for_backend(p):
    """Enrich with backend fields for stealth_browser/data/presets.json."""
    item = dict(p)
    item["gpu_vendor"] = item["webgl_vendor"]
    item["gpu_renderer"] = item["webgl_renderer"]
    item["cores"] = item["hardware_concurrency"]
    item["memory_gb"] = item["device_memory"]
    item["screen"] = [item["screen_width"], item["screen_height"]]
    item["color_depth"] = 24
    item["languages"] = ["en-US", "en"]
    return item

def main():
    presets = build_all_100()
    assert len(presets) == 100, f"Expected 100 presets, got {len(presets)}"

    # Validate distribution
    win_cnt = sum(1 for p in presets if p["os"] == "win")
    mac_cnt = sum(1 for p in presets if p["os"] == "mac")
    ios_cnt = sum(1 for p in presets if p["os"] == "ios")
    and_cnt = sum(1 for p in presets if p["os"] == "android")
    print(f"Distribution check: Windows={win_cnt}, macOS={mac_cnt}, iOS={ios_cnt}, Android={and_cnt}")
    assert win_cnt == 35 and mac_cnt == 25 and ios_cnt == 20 and and_cnt == 20

    # 1. Save extensions/anti-detect-browser/presets.json
    ext_presets_path = ROOT / "extensions" / "anti-detect-browser" / "presets.json"
    ext_presets_json = json.dumps(presets, separators=(',', ':'))
    ext_presets_path.write_text(ext_presets_json, encoding="utf-8")
    ext_size_kb = ext_presets_path.stat().st_size / 1024
    print(f"[+] Written {ext_presets_path} ({ext_size_kb:.2f} KB)")
    assert ext_size_kb < 65, f"presets.json size exceeds 65 KB limit: {ext_size_kb:.2f} KB"

    # 2. Save stealth_browser/data/presets.json (enriched with label, screen, cores, etc.)
    data_presets_path = ROOT / "stealth_browser" / "data" / "presets.json"
    enriched = [enrich_for_backend(p) for p in presets]
    data_presets = {
        "_comment": "100 authentic, coherent hardware presets across Windows (35), macOS (25), iOS (20), and Android (20).",
        "presets": enriched
    }
    data_presets_path.write_text(json.dumps(data_presets, indent=2), encoding="utf-8")
    print(f"[+] Written {data_presets_path}")

if __name__ == "__main__":
    main()
