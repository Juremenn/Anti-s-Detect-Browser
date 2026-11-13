"""
profile_manager.py - Manages local, account-free anti-detect browser profiles.
Stores persistent configurations and isolated UserData directories per profile.
"""

import os
import json
import random
import uuid
from pathlib import Path

BASE_PROFILES_DIR = Path(__file__).resolve().parent.parent / "profiles"

HARDWARE_PRESETS = [
    {
        "os": "win",
        "platform": "Win32",
        "webgl_vendor": "Google Inc. (NVIDIA)",
        "webgl_renderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "hardware_concurrency": 8,
        "device_memory": 8,
        "screen_width": 1920,
        "screen_height": 1080,
        "color_depth": 24,
        "languages": ["id-ID", "id", "en-US", "en"],
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    },
    {
        "os": "win",
        "platform": "Win32",
        "webgl_vendor": "Google Inc. (NVIDIA)",
        "webgl_renderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "hardware_concurrency": 16,
        "device_memory": 16,
        "screen_width": 2560,
        "screen_height": 1440,
        "color_depth": 24,
        "languages": ["en-US", "en"],
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    },
    {
        "os": "win",
        "platform": "Win32",
        "webgl_vendor": "Google Inc. (Intel)",
        "webgl_renderer": "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "hardware_concurrency": 8,
        "device_memory": 8,
        "screen_width": 1920,
        "screen_height": 1080,
        "color_depth": 24,
        "languages": ["id-ID", "id", "en-US", "en"],
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    },
    {
        "os": "mac",
        "platform": "MacIntel",
        "webgl_vendor": "Google Inc. (Apple)",
        "webgl_renderer": "ANGLE (Apple, Apple M2, OpenGL 4.1)",
        "hardware_concurrency": 8,
        "device_memory": 8,
        "screen_width": 2560,
        "screen_height": 1600,
        "color_depth": 30,
        "languages": ["en-US", "en"],
        "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    }
]


class ProfileManager:
    def __init__(self, profiles_dir: Path = BASE_PROFILES_DIR):
        self.profiles_dir = profiles_dir
        self.profiles_dir.mkdir(parents=True, exist_ok=True)

    def create_profile(self, name: str, preset_index: int = 0, proxy: str = None) -> dict:
        """
        Create a new persistent identity profile with isolated directories and seeds.
        """
        profile_path = self.profiles_dir / name
        user_data_path = profile_path / "UserData"
        profile_path.mkdir(parents=True, exist_ok=True)
        user_data_path.mkdir(parents=True, exist_ok=True)

        preset = HARDWARE_PRESETS[preset_index % len(HARDWARE_PRESETS)].copy()
        
        profile = {
            "name": name,
            "uuid": str(uuid.uuid4()),
            "created_at": str(random.randint(1700000000, 1730000000)),
            "user_data_dir": str(user_data_path),
            "proxy": proxy or "",
            "mask_webrtc": True,
            # Distinct deterministic fingerprint seeds
            "canvas_seed": random.randint(100000, 9999999),
            "audio_seed": random.randint(100000, 9999999),
            "font_seed": random.randint(100000, 9999999),
            **preset
        }

        config_file = profile_path / "config.json"
        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(profile, f, indent=2)

        return profile

    def get_profile(self, name: str) -> dict:
        """
        Load an existing profile by name, or create default if not found.
        """
        profile_path = self.profiles_dir / name
        config_file = profile_path / "config.json"
        if not config_file.exists():
            return self.create_profile(name)
        with open(config_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def list_profiles(self) -> list:
        """
        List all available local profiles.
        """
        profiles = []
        if not self.profiles_dir.exists():
            return profiles
        for item in self.profiles_dir.iterdir():
            if item.is_dir() and (item / "config.json").exists():
                try:
                    with open(item / "config.json", "r", encoding="utf-8") as f:
                        profiles.append(json.load(f))
                except Exception:
                    pass
        return profiles

    def delete_profile(self, name: str) -> bool:
        """
        Delete a profile and its associated data directory.
        """
        import shutil
        profile_path = self.profiles_dir / name
        if profile_path.exists():
            shutil.rmtree(profile_path, ignore_errors=True)
            return True
        return False
