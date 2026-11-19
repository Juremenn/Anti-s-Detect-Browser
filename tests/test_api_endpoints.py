"""
Integration test for web_ui_server API endpoints.
"""
import json
import threading
import time
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
from stealth_browser.profile_manager import ProfileManager
import web_ui_server
from web_ui_server import DashboardHandler

PORT = 58999

def test_api():
    web_ui_server.ALLOWED_ORIGINS.add(f"http://127.0.0.1:{PORT}")
    server = ThreadingHTTPServer(("127.0.0.1", PORT), DashboardHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    time.sleep(1)

    conn = HTTPConnection("127.0.0.1", PORT, timeout=10)

    try:
        # 1. Ensure test profile exists
        mgr = ProfileManager()
        test_prof = "Api_Test_Run_Profile"
        if not mgr.exists(test_prof):
            mgr.create_profile(test_prof, preset_index=0)

        # GET /api/profiles
        conn.request("GET", "/api/profiles", headers={"Origin": f"http://127.0.0.1:{PORT}"})
        res = conn.getresponse()
        assert res.status == 200
        data = json.loads(res.read().decode())
        profiles = data.get("profiles", [])
        names = [p["name"] for p in profiles]
        print("1. Profiles API returned:", names)
        assert test_prof in names, f"{test_prof} should be listed"

        # 2. POST /api/profiles/start
        payload = json.dumps({"name": test_prof}).encode()
        conn.request("POST", "/api/profiles/start", body=payload, headers={
            "Origin": f"http://127.0.0.1:{PORT}",
            "Content-Type": "application/json"
        })
        res = conn.getresponse()
        body = json.loads(res.read().decode())
        print("2. Start API response:", res.status, body)
        assert res.status == 200, f"Expected 200, got {res.status}: {body}"
        assert body.get("status") in ("started", "already_running")

        time.sleep(2)

        # 3. POST /api/profiles/stop
        payload = json.dumps({"name": test_prof}).encode()
        conn.request("POST", "/api/profiles/stop", body=payload, headers={
            "Origin": f"http://127.0.0.1:{PORT}",
            "Content-Type": "application/json"
        })
        res = conn.getresponse()
        body = json.loads(res.read().decode())
        print("3. Stop API response:", res.status, body)
        assert res.status == 200
        assert body.get("status") == "stopped"

        # 4. POST /api/profiles/delete on a non-existent profile (should return HTTP 400)
        payload = json.dumps({"name": "NoSuchProfile_XYZ"}).encode()
        conn.request("POST", "/api/profiles/delete", body=payload, headers={
            "Origin": f"http://127.0.0.1:{PORT}",
            "Content-Type": "application/json"
        })
        res = conn.getresponse()
        body = json.loads(res.read().decode())
        print("4. Delete non-existent profile response:", res.status, body)
        assert res.status == 400, f"Expected 400, got {res.status}"
        assert "error" in body, "Expected error key in body"

        # 5. Create a profile via API and then delete it (move to trash)
        temp_name = "Api_Delete_Test_Profile"
        payload = json.dumps({"name": temp_name, "preset": 1}).encode()
        conn.request("POST", "/api/profiles/create", body=payload, headers={
            "Origin": f"http://127.0.0.1:{PORT}",
            "Content-Type": "application/json"
        })
        res = conn.getresponse()
        body = json.loads(res.read().decode())
        print("5. Create API response:", res.status, body.get("status"))
        assert res.status == 200
        assert body["profile"]["name"] == temp_name

        # Delete it via API
        payload = json.dumps({"name": temp_name}).encode()
        conn.request("POST", "/api/profiles/delete", body=payload, headers={
            "Origin": f"http://127.0.0.1:{PORT}",
            "Content-Type": "application/json"
        })
        res = conn.getresponse()
        body = json.loads(res.read().decode())
        print("6. Delete API response:", res.status, body)
        assert res.status == 200
        assert temp_name in body.get("trashed", [])

        # 6. Delete API response
        print("6. Delete API response:", res.status, body)
        assert res.status == 200
        assert temp_name in body.get("trashed", [])

        # 7. Extensions API: GET /api/extensions (starts clean)
        conn.request("GET", "/api/extensions", headers={"Origin": f"http://127.0.0.1:{PORT}"})
        res = conn.getresponse()
        assert res.status == 200
        ext_data = json.loads(res.read().decode())
        extensions = ext_data.get("extensions", [])
        print("7. Initial extensions GET count:", len(extensions))

        # 8. Extensions API: POST /api/extensions/load_unpacked
        source_dir = str(Path(__file__).resolve().parent.parent / "extensions" / "anti-detect-browser")
        load_payload = json.dumps({"path": source_dir}).encode()
        conn.request("POST", "/api/extensions/load_unpacked", body=load_payload, headers={
            "Origin": f"http://127.0.0.1:{PORT}",
            "Content-Type": "application/json"
        })
        res = conn.getresponse()
        assert res.status == 200
        loaded_res = json.loads(res.read().decode())
        ext_entry = loaded_res.get("extension", {})
        loaded_id = ext_entry.get("id")
        assert loaded_id is not None
        print("8. Loaded unpacked extension:", ext_entry.get("name"), f"({loaded_id})")

        # 8b. Extensions API: GET /api/extensions/config
        conn.request("GET", f"/api/extensions/config?id={loaded_id}", headers={
            "Origin": f"http://127.0.0.1:{PORT}"
        })
        res = conn.getresponse()
        assert res.status == 200
        cfg_data = json.loads(res.read().decode())
        assert "config" in cfg_data
        assert "presets" in cfg_data
        print("8b. Extension config read:", cfg_data.get("config", {}).get("presetName"))

        # 8c. Extensions API: POST /api/extensions/config
        save_cfg_payload = json.dumps({
            "id": loaded_id,
            "config": {
                **cfg_data.get("config", {}),
                "identitySeed": "test_seed_777"
            }
        }).encode()
        conn.request("POST", "/api/extensions/config", body=save_cfg_payload, headers={
            "Origin": f"http://127.0.0.1:{PORT}",
            "Content-Type": "application/json"
        })
        res = conn.getresponse()
        assert res.status == 200
        save_cfg_res = json.loads(res.read().decode())
        assert save_cfg_res.get("config", {}).get("identitySeed") == "test_seed_777"
        print("8c. Extension config updated successfully")

        # 9. Extensions API: POST /api/extensions/toggle
        toggle_payload = json.dumps({"id": loaded_id, "enabled": False}).encode()
        conn.request("POST", "/api/extensions/toggle", body=toggle_payload, headers={
            "Origin": f"http://127.0.0.1:{PORT}",
            "Content-Type": "application/json"
        })
        res = conn.getresponse()
        assert res.status == 200
        print("9. Extensions toggle response:", res.status)

        # 10. Extensions API: POST /api/extensions/remove
        remove_payload = json.dumps({"id": loaded_id}).encode()
        conn.request("POST", "/api/extensions/remove", body=remove_payload, headers={
            "Origin": f"http://127.0.0.1:{PORT}",
            "Content-Type": "application/json"
        })
        res = conn.getresponse()
        assert res.status == 200
        print("10. Extensions remove response:", res.status)

        # Clean test profiles
        if mgr.exists(test_prof):
            mgr.delete_profile(test_prof)
        ProfileManager().purge_trash()

        print("\nALL SERVER API TESTS PASSED!")

    finally:
        server.shutdown()
        conn.close()

if __name__ == "__main__":
    test_api()
