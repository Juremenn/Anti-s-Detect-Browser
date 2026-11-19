"""
Verification test for CRX3 archive installation and un-installation.
"""

import base64
import json
from pathlib import Path
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
import threading
import time
import web_ui_server
from web_ui_server import DashboardHandler

PORT = 58998

def test_crx_lifecycle():
    web_ui_server.ALLOWED_ORIGINS.add(f"http://127.0.0.1:{PORT}")
    server = ThreadingHTTPServer(("127.0.0.1", PORT), DashboardHandler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    time.sleep(1)

    conn = HTTPConnection("127.0.0.1", PORT, timeout=10)

    try:
        crx_path = Path("Extension/anti-detect-browser.crx")
        assert crx_path.is_file(), "Extension/anti-detect-browser.crx must exist"

        with open(crx_path, "rb") as f:
            b64_data = base64.b64encode(f.read()).decode("ascii")

        # 1. Install CRX
        install_payload = json.dumps({
            "fileName": crx_path.name,
            "fileData": f"data:application/x-chrome-extension;base64,{b64_data}"
        }).encode()

        conn.request("POST", "/api/extensions/install_crx", body=install_payload, headers={
            "Origin": f"http://127.0.0.1:{PORT}",
            "Content-Type": "application/json"
        })
        res = conn.getresponse()
        assert res.status == 200, f"Expected 200, got {res.status}"
        data = json.loads(res.read().decode())
        installed_ext = data.get("extension", {})
        ext_id = installed_ext.get("id")
        assert ext_id, "Installed extension must have an ID"
        print(f"[+] CRX installation successful: {installed_ext.get('name')} ({ext_id})")

        # 2. Verify Config endpoint works on installed extension
        conn.request("GET", f"/api/extensions/config?id={ext_id}", headers={
            "Origin": f"http://127.0.0.1:{PORT}"
        })
        res = conn.getresponse()
        assert res.status == 200
        cfg_res = json.loads(res.read().decode())
        assert "config" in cfg_res
        assert "presets" in cfg_res
        print(f"[+] Extension config API retrieved successfully for CRX ({len(cfg_res.get('presets', []))} presets)")

        # 3. Clean up: Remove installed extension
        remove_payload = json.dumps({"id": ext_id}).encode()
        conn.request("POST", "/api/extensions/remove", body=remove_payload, headers={
            "Origin": f"http://127.0.0.1:{PORT}",
            "Content-Type": "application/json"
        })
        res = conn.getresponse()
        assert res.status == 200
        print("[+] Extension clean removal successful")

        print("\nCRX LIFECYCLE TEST PASSED!")
    finally:
        server.shutdown()
        conn.close()

if __name__ == "__main__":
    test_crx_lifecycle()
