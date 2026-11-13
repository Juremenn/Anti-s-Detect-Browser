"""
Test profile lifecycle: create, run, stop, trash, restore, purge.
"""
import time
from pathlib import Path
from stealth_browser.profile_manager import ProfileManager, ProfileError
from stealth_browser.launcher import StealthLauncher

def main():
    mgr = ProfileManager()
    launcher = StealthLauncher()

    test_name = "Test_Lifecycle_Profile"

    # Clean up if leftover
    if mgr.exists(test_name):
        mgr.delete_profile(test_name)

    print("1. Creating test profile with preset 0 (Windows RTX 3070)...")
    created = mgr.create_profile(test_name, preset_index=0)
    assert created["name"] == test_name, f"Expected name={test_name}, got {created['name']}"
    assert mgr.exists(test_name), "Profile should exist on disk"
    print(f"   Created: {created['name']} (Device: {created.get('device_name')})")

    print("2. Verifying get_profile returns correct name and user_data_dir...")
    fetched = mgr.get_profile(test_name, create_if_missing=False)
    assert fetched["name"] == test_name, f"Expected {test_name}, got {fetched['name']}"
    print(f"   Fetched: {fetched['name']}")

    print("3. Launching profile (headless)...")
    proc = launcher.launch(profile_name=test_name, headless=True)
    assert proc.poll() is None, "Process should be running"
    print(f"   Process PID: {proc.pid}")
    time.sleep(1.5)
    assert proc.poll() is None, "Process should still be running"

    print("4. Stopping profile...")
    proc.terminate()
    proc.wait(timeout=5)
    assert proc.poll() is not None, "Process should have stopped"
    print("   Process stopped successfully")

    print("5. Trashing profile...")
    trash_id = mgr.trash_profile(test_name)
    assert not mgr.exists(test_name), "Profile should no longer exist in profiles/"
    trash_items = mgr.list_trash()
    assert any(item["trash_id"] == trash_id for item in trash_items), "Profile should be in trash"
    print(f"   Moved to trash with ID: {trash_id}")

    print("6. Restoring profile from trash...")
    restored = mgr.restore_profile(trash_id)
    assert mgr.exists(restored["name"]), "Restored profile should exist in profiles/"
    print(f"   Restored: {restored['name']}")

    print("7. Moving to trash again and purging...")
    trash_id_2 = mgr.trash_profile(test_name)
    purged_count = mgr.purge_trash(trash_id_2)
    assert purged_count == 1, "Purge should return 1"
    assert not mgr.exists(test_name), "Profile should be completely gone"
    print("   Purged successfully")

    print("8. Testing non-existent profile deletion raises ProfileError...")
    try:
        mgr.trash_profile("NonExistentProfile_999")
        assert False, "Should have raised ProfileError"
    except ProfileError as e:
        print(f"   Correctly raised ProfileError: {e}")

    print("\nALL LIFECYCLE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    main()
