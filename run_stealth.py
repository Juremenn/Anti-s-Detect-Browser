#!/usr/bin/env python3
"""
run_stealth.py - Command-line interface for Anti's Detect Browser.
Run stealth anti-detect profiles locally with zero cloud dependencies or login requirements.
"""

import sys
import argparse
from pathlib import Path

from stealth_browser.profile_manager import ProfileManager, HARDWARE_PRESETS
from stealth_browser.launcher import StealthLauncher


def main():
    parser = argparse.ArgumentParser(
        description="Anti's Detect Browser CLI - Local Anti-Detect Automation Runner",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--profile", "-p", default="stealth_identity_1", help="Profile name to load or create")
    parser.add_argument("--create", "-c", action="store_true", help="Create a new profile")
    parser.add_argument("--preset", type=int, default=0, help="Hardware preset (0: RTX 3070, 1: RTX 4080, 2: Intel Iris, 3: Apple M2)")
    parser.add_argument("--list", "-l", action="store_true", help="List all local profiles")
    parser.add_argument("--delete", "-d", help="Delete a profile by name")
    parser.add_argument("--url", "-u", default="https://browserleaks.com/canvas", help="URL to navigate to")
    parser.add_argument("--test", "-t", action="store_true", help="Test mode: opens BrowserLeaks & CreepJS")
    parser.add_argument("--proxy", help="Proxy URL (e.g. http://host:port or socks5://host:port)")
    parser.add_argument("--port", type=int, default=9222, help="CDP Remote Debugging Port (default: 9222)")
    parser.add_argument("--headless", action="store_true", help="Run browser in headless mode")

    args = parser.parse_args()
    mgr = ProfileManager()

    if args.list:
        profiles = mgr.list_profiles()
        print("\n" + "=" * 65)
        print(f"[*] LOCAL STEALTH PROFILES ({len(profiles)} found):")
        print("=" * 65)
        if not profiles:
            print("  No profiles found. Create one with: python run_stealth.py --create --profile my_profile")
        for p in profiles:
            print(f"  - Profile:    {p['name']}")
            print(f"    Renderer:   {p.get('webgl_renderer', 'Default')}")
            print(f"    CanvasSeed: {p.get('canvas_seed', 'N/A')}")
            print(f"    Platform:   {p.get('platform', 'Win32')}")
            print(f"    UserData:   {p.get('user_data_dir', 'N/A')}")
            print("-" * 65)
        return

    if args.delete:
        if mgr.delete_profile(args.delete):
            print(f"[*] Profile '{args.delete}' deleted successfully.")
        else:
            print(f"[-] Profile '{args.delete}' not found.")
        return

    if args.create:
        p = mgr.create_profile(args.profile, preset_index=args.preset, proxy=args.proxy)
        print(f"[+] Successfully created profile '{p['name']}' with preset {args.preset}:")
        print(f"    WebGL Renderer: {p['webgl_renderer']}")
        print(f"    Canvas Seed:    {p['canvas_seed']}")
        print(f"    Platform:       {p['platform']}")
        return

    # Determine URL
    target_url = args.url
    if args.test:
        target_url = "https://browserleaks.com/canvas"

    # Launch browser (launch() starts the CDP apply thread itself, which
    # registers the script and the Emulation overrides — no double attach here)
    launcher = StealthLauncher()
    proc = launcher.launch(
        profile_name=args.profile,
        target_url=target_url,
        remote_port=args.port,
        headless=args.headless
    )

    print("[*] Browser process running. Press Ctrl+C or close the browser window to stop.")
    try:
        proc.wait()
    except KeyboardInterrupt:
        print("\n[*] Terminating browser process...")
        proc.terminate()
        proc.wait()
    print("[*] Browser closed cleanly.")


if __name__ == "__main__":
    main()

