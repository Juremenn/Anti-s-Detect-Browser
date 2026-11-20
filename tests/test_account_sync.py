"""
End-to-end verification tests for:
1. Account-scoped profile & cookie persistence across Sign Out / Sign In (including real Chromium launch).
2. Account isolation between different Google accounts & one-time legacy data migration.
3. AES-256-GCM encrypted Google Drive appDataFolder selective archiving, push, and second-device pull.
4. Active-browser pull deferral and conflict resolution.
5. OAuth 2.0 drive.appdata scope and /api/sync/* endpoints.
"""

import json
import shutil
import tempfile
import threading
import time
import urllib.parse
import zipfile
from http.client import HTTPConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import io

import web_ui_server
from stealth_browser.profile_manager import ProfileManager, account_hash_for_sub, get_account_dir
from web_ui.cloud_sync import (
    ARCHIVE_MAGIC,
    AccountCrypto,
    CloudSyncManager,
    DRIVE_SCOPE,
    GoogleDriveAppDataClient,
    MANIFEST_REMOTE_NAME,
    pack_profile_archive,
    parse_google_api_error,
)


class InMemoryDriveAppDataClient:
    """In-memory Drive v3 appDataFolder mock storing encrypted blobs by file ID."""

    def __init__(self):
        self.files_by_id = {}
        self._seq = 1
        self._lock = threading.Lock()

    def list_files(self):
        with self._lock:
            return [
                {
                    "id": meta["id"],
                    "name": meta["name"],
                    "modifiedTime": meta["modifiedTime"],
                    "size": str(len(meta["data"])),
                }
                for meta in self.files_by_id.values()
            ]

    def download_file(self, file_id: str) -> bytes:
        with self._lock:
            if file_id not in self.files_by_id:
                raise FileNotFoundError(f"Drive file {file_id} not found")
            return self.files_by_id[file_id]["data"]

    def upload_file(self, name: str, content: bytes, file_id=None, mime_type="application/octet-stream"):
        with self._lock:
            if file_id and file_id in self.files_by_id:
                meta = self.files_by_id[file_id]
                meta["data"] = bytes(content)
                meta["modifiedTime"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                return {"id": file_id, "name": meta["name"], "modifiedTime": meta["modifiedTime"]}
            new_id = f"drv_{self._seq}"
            self._seq += 1
            meta = {
                "id": new_id,
                "name": name,
                "data": bytes(content),
                "modifiedTime": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            self.files_by_id[new_id] = meta
            return {"id": new_id, "name": name, "modifiedTime": meta["modifiedTime"]}

    def delete_file(self, file_id: str):
        with self._lock:
            self.files_by_id.pop(file_id, None)


class _CookieTestHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def do_GET(self):
        body = b"<html><body><h1>Cookie Set</h1></body></html>"
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.send_header("Set-Cookie", "adb_session=persisted_token_991; Path=/; Max-Age=86400")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def _api_call(port: int, method: str, path: str, body=None):
    conn = HTTPConnection("127.0.0.1", port, timeout=15)
    try:
        headers = {"Origin": f"http://127.0.0.1:{port}"}
        payload = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            payload = json.dumps(body).encode("utf-8")
        conn.request(method, path, body=payload, headers=headers)
        res = conn.getresponse()
        raw = res.read().decode("utf-8", errors="replace")
        return res.status, json.loads(raw) if raw else {}
    finally:
        conn.close()


def test_selective_archive_and_crypto():
    with tempfile.TemporaryDirectory() as tmp:
        p_dir = Path(tmp) / "Profile_Crypto_Test"
        (p_dir / "UserData" / "Default" / "Network").mkdir(parents=True)
        (p_dir / "UserData" / "Default" / "Local Storage" / "leveldb").mkdir(parents=True)
        (p_dir / "UserData" / "Default" / "Cache" / "Cache_Data").mkdir(parents=True)
        (p_dir / "UserData" / "Default" / "Code Cache" / "js").mkdir(parents=True)
        (p_dir / "UserData" / "ShaderCache").mkdir(parents=True)
        (p_dir / "UserData" / "Default" / "Service Worker" / "CacheStorage").mkdir(parents=True)
        (p_dir / "UserData" / "Crashpad").mkdir(parents=True)

        (p_dir / "config.json").write_text(json.dumps({"name": "Profile_Crypto_Test", "uuid": "u-1"}), encoding="utf-8")
        (p_dir / "UserData" / "Default" / "Network" / "Cookies").write_bytes(b"SQLite format 3\x00SECRET_COOKIE_DATA")
        (p_dir / "UserData" / "Default" / "Preferences").write_text('{"profile":{"name":"test"}}', encoding="utf-8")
        (p_dir / "UserData" / "Default" / "Local Storage" / "leveldb" / "000003.ldb").write_bytes(b"LS_VALUE")

        # Heavy disposable caches that MUST be excluded
        (p_dir / "UserData" / "Default" / "Cache" / "Cache_Data" / "data_0").write_bytes(b"X" * 1024 * 100)
        (p_dir / "UserData" / "Default" / "Code Cache" / "js" / "bundle.js").write_bytes(b"Y" * 1024 * 50)
        (p_dir / "UserData" / "ShaderCache" / "gpu.bin").write_bytes(b"Z" * 1024 * 50)
        (p_dir / "UserData" / "Default" / "Service Worker" / "CacheStorage" / "sw.bin").write_bytes(b"W" * 1024 * 50)
        (p_dir / "UserData" / "Crashpad" / "crash.dmp").write_bytes(b"D" * 1024 * 50)

        zip_bytes = pack_profile_archive(p_dir)
        with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
            names = set(zf.namelist())

        assert "config.json" in names
        assert "UserData/Default/Network/Cookies" in names
        assert "UserData/Default/Preferences" in names
        assert "UserData/Default/Local Storage/leveldb/000003.ldb" in names
        for n in names:
            low = n.lower()
            assert "cache" not in low, f"Cache file leaked into archive: {n}"
            assert "crashpad" not in low, f"Crashpad leaked into archive: {n}"

        crypto_a = AccountCrypto("google-sub-account-A")
        crypto_b = AccountCrypto("google-sub-account-B")
        enc = crypto_a.encrypt(zip_bytes, aad=b"profile_u-1.enc")
        assert enc.startswith(ARCHIVE_MAGIC)
        assert b"SECRET_COOKIE_DATA" not in enc
        assert crypto_a.decrypt(enc, aad=b"profile_u-1.enc") == zip_bytes

        # Wrong account key or wrong AAD must fail decryption
        try:
            crypto_b.decrypt(enc, aad=b"profile_u-1.enc")
            raise AssertionError("Different account must not decrypt archive")
        except ValueError:
            pass
        try:
            crypto_a.decrypt(enc, aad=b"wrong_aad.enc")
            raise AssertionError("Wrong AAD must fail GCM tag verification")
        except ValueError:
            pass
    print("[PASS] Selective archiving & AES-256-GCM encryption verified.")


def test_cross_device_sync_and_conflict_resolution():
    mock_drive = InMemoryDriveAppDataClient()
    sub = "108234567890123456789"

    with tempfile.TemporaryDirectory() as dev1_tmp, tempfile.TemporaryDirectory() as dev2_tmp:
        acct1 = Path(dev1_tmp) / "acct"
        acct2 = Path(dev2_tmp) / "acct"
        (acct1 / "profiles").mkdir(parents=True)
        (acct2 / "profiles").mkdir(parents=True)

        mgr1 = ProfileManager(acct1 / "profiles")
        prof = mgr1.create_profile("Sync_Profile_Alpha", preset_index=0, proxy="http://10.0.0.1:8080", notes="Laptop 1")
        p1_dir = acct1 / "profiles" / "Sync_Profile_Alpha"
        (p1_dir / "UserData" / "Default" / "Network").mkdir(parents=True, exist_ok=True)
        cookie_payload = b"SQLiteCookiePayload_Device1_AuthToken"
        (p1_dir / "UserData" / "Default" / "Network" / "Cookies").write_bytes(cookie_payload)
        (p1_dir / "UserData" / "Default" / "Cache").mkdir(parents=True, exist_ok=True)
        (p1_dir / "UserData" / "Default" / "Cache" / "heavy.bin").write_bytes(b"0" * 500_000)

        proxies_1 = acct1 / "proxies.json"
        proxies_1.write_text(json.dumps([{"id": "p1", "title": "SG Proxy", "url": "http://10.0.0.1:8080"}]), encoding="utf-8")

        sync1 = CloudSyncManager(
            google_sub=sub,
            account_dir=acct1,
            proxies_file=proxies_1,
            token_provider=lambda _r: "mock-token",
            drive_client=mock_drive,
            drive_authorized=True,
        )
        sync1.record_proxies_updated()
        push_res = sync1.sync_push()
        assert "Sync_Profile_Alpha" in push_res["pushed"]

        remote_names = {f["name"] for f in mock_drive.list_files()}
        assert MANIFEST_REMOTE_NAME in remote_names
        assert f"profile_{prof['uuid']}.enc" in remote_names

        # Simulate Device 2 logging in with same Google account on a clean directory
        proxies_2 = acct2 / "proxies.json"
        sync2 = CloudSyncManager(
            google_sub=sub,
            account_dir=acct2,
            proxies_file=proxies_2,
            token_provider=lambda _r: "mock-token",
            drive_client=mock_drive,
            drive_authorized=True,
        )
        pull_res = sync2.sync_pull()
        assert "Sync_Profile_Alpha" in pull_res["pulled"]
        assert pull_res["proxies_updated"] is True

        mgr2 = ProfileManager(acct2 / "profiles")
        restored = mgr2.get_profile("Sync_Profile_Alpha", create_if_missing=False)
        assert restored["uuid"] == prof["uuid"]
        assert restored["notes"] == "Laptop 1"
        assert restored["proxy"] == "http://10.0.0.1:8080"
        assert str(acct2) in restored["user_data_dir"]
        restored_cookies = (acct2 / "profiles" / "Sync_Profile_Alpha" / "UserData" / "Default" / "Network" / "Cookies").read_bytes()
        assert restored_cookies == cookie_payload
        assert not (acct2 / "profiles" / "Sync_Profile_Alpha" / "UserData" / "Default" / "Cache").exists()
        restored_proxies = json.loads(proxies_2.read_text(encoding="utf-8"))
        assert restored_proxies[0]["title"] == "SG Proxy"

        # Active browser guard: Device 2 updates profile & pushes; Device 1 has browser open -> pull deferred
        time.sleep(0.02)
        mgr2.update_profile("Sync_Profile_Alpha", {"notes": "Updated on Device 2"})
        sync2.sync_push()

        running_flag = {"active": True}
        sync1_guarded = CloudSyncManager(
            google_sub=sub,
            account_dir=acct1,
            proxies_file=proxies_1,
            token_provider=lambda _r: "mock-token",
            is_profile_running_fn=lambda n: running_flag["active"] and n == "Sync_Profile_Alpha",
            drive_client=mock_drive,
            drive_authorized=True,
        )
        res_while_open = sync1_guarded.sync_pull()
        assert "Sync_Profile_Alpha" in res_while_open["skipped_running"]
        assert mgr1.get_profile("Sync_Profile_Alpha", create_if_missing=False)["notes"] == "Laptop 1"

        # Stale Device 1 must NOT overwrite newer Device 2 on push
        push_stale = sync1_guarded.sync_push()
        assert "Sync_Profile_Alpha" not in push_stale["pushed"]

        # Once browser closes, pull applies cleanly
        running_flag["active"] = False
        res_after_close = sync1_guarded.sync_pull()
        assert "Sync_Profile_Alpha" in res_after_close["pulled"]
        assert mgr1.get_profile("Sync_Profile_Alpha", create_if_missing=False)["notes"] == "Updated on Device 2"

    print("[PASS] Cross-device sync push/pull, active-browser guard, and conflict resolution verified.")


def test_account_persistence_across_logout_and_legacy_migration():
    # Isolate all server storage paths to temp directory
    orig_app_data = web_ui_server.APP_DATA_ROOT
    orig_root = web_ui_server.ROOT
    orig_auth_file = web_ui_server.AUTH_SESSION_FILE
    orig_settings_file = web_ui_server.SETTINGS_FILE
    orig_profiles_dir = web_ui_server.profile_mgr.profiles_dir
    orig_client_id = web_ui_server.settings.get("google_client_id", "")
    orig_client_secret = web_ui_server.settings.get("google_client_secret", "")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_root = Path(tmp)
        app_data = tmp_root / "localappdata" / "AntiDetectBrowser"
        legacy_root = tmp_root / "legacy_repo"
        (legacy_root / "profiles" / "Legacy_Profile_1" / "UserData" / "Default").mkdir(parents=True)
        (legacy_root / "profiles" / "Legacy_Profile_1" / "config.json").write_text(
            json.dumps({
                "name": "Legacy_Profile_1",
                "uuid": "legacy-uuid-1",
                "user_agent": "Mozilla/5.0",
                "platform": "Win32",
                "webgl_vendor": "Google Inc. (NVIDIA)",
                "webgl_renderer": "ANGLE (NVIDIA)",
            }),
            encoding="utf-8",
        )
        (legacy_root / "proxies.json").write_text(
            json.dumps([{"id": "prx_legacy", "title": "Legacy Proxy", "url": "http://127.0.0.1:8888"}]),
            encoding="utf-8",
        )

        web_ui_server.APP_DATA_ROOT = app_data
        web_ui_server.ROOT = legacy_root
        web_ui_server.AUTH_SESSION_FILE = app_data / "data" / "auth_session.json"
        web_ui_server.SETTINGS_FILE = app_data / "app_settings.json"

        port = 58997
        cookie_srv_port = 58996
        web_ui_server.ALLOWED_ORIGINS.add(f"http://127.0.0.1:{port}")
        server = ThreadingHTTPServer(("127.0.0.1", port), web_ui_server.DashboardHandler)
        cookie_srv = ThreadingHTTPServer(("127.0.0.1", cookie_srv_port), _CookieTestHandler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        threading.Thread(target=cookie_srv.serve_forever, daemon=True).start()

        try:
            # 1. Verify OAuth start URL requests drive.appdata scope + consent (using an official client ID)
            web_ui_server.settings["google_client_id"] = "999111222333-officialappclient.apps.googleusercontent.com"
            web_ui_server.settings["google_client_secret"] = "GOCSPX-testsecret"
            st, auth_cfg_status = _api_call(port, "GET", "/api/auth/status")
            assert st == 200 and auth_cfg_status["configured"] is True

            st, start_data = _api_call(port, "POST", "/api/auth/google/start", {"open_browser": False})
            assert st == 200
            qs = urllib.parse.parse_qs(urllib.parse.urlparse(start_data["auth_url"]).query)
            assert qs.get("client_id", [""])[0] == "999111222333-officialappclient.apps.googleusercontent.com"
            scopes = qs.get("scope", [""])[0].split()
            assert "openid" in scopes and "email" in scopes and "profile" in scopes
            assert DRIVE_SCOPE in scopes, f"Missing drive.appdata scope: {scopes}"
            assert "consent" in qs.get("prompt", [""])[0]

            # 2. Sign in as Account A
            sub_a = "sub-account-A-999"
            session_a = {
                "sub": sub_a,
                "email": "usera@example.com",
                "name": "User A",
                "picture": "",
                "scope": f"openid email profile {DRIVE_SCOPE}",
                "access_token": "tok_a",
                "refresh_token": "",
                "expires_at": int(time.time() + 3600),
            }
            web_ui_server.save_auth_session(session_a)

            st, auth_status = _api_call(port, "GET", "/api/auth/status")
            assert st == 200 and auth_status["authenticated"] is True

            # Legacy profile + proxy should have migrated to Account A
            st, prof_res = _api_call(port, "GET", "/api/profiles")
            assert st == 200
            names = [p["name"] for p in prof_res["profiles"]]
            assert "Legacy_Profile_1" in names, f"Expected Legacy_Profile_1 migrated, got {names}"

            st, prx_res = _api_call(port, "GET", "/api/proxies")
            assert st == 200 and len(prx_res["proxies"]) == 1

            # 3. Create a fresh profile, launch real chrome.exe to set a cookie, and stop it
            st, created = _api_call(port, "POST", "/api/profiles/create", {"name": "Persist_Cookie_Prof", "preset": 0})
            assert st == 200

            if web_ui_server.launcher.chrome_path:
                st, started = _api_call(
                    port,
                    "POST",
                    "/api/profiles/start",
                    {"name": "Persist_Cookie_Prof", "url": f"http://127.0.0.1:{cookie_srv_port}/"},
                )
                assert st == 200 and started["status"] in ("started", "already_running")
                time.sleep(2.5)
                st, stopped = _api_call(port, "POST", "/api/profiles/stop", {"name": "Persist_Cookie_Prof"})
                assert st == 200 and stopped["status"] == "stopped"

            acct_a_dir = get_account_dir(sub_a, app_data)
            prof_dir = acct_a_dir / "profiles" / "Persist_Cookie_Prof"
            assert (prof_dir / "config.json").is_file()
            cookie_file_1 = prof_dir / "UserData" / "Default" / "Network" / "Cookies"
            cookie_file_2 = prof_dir / "UserData" / "Default" / "Cookies"
            if web_ui_server.launcher.chrome_path:
                assert cookie_file_1.is_file() or cookie_file_2.is_file(), "Expected Chromium Cookies file on disk"

            # 4. Check /api/sync/status endpoint
            st, sync_st = _api_call(port, "GET", "/api/sync/status")
            assert st == 200 and "state" in sync_st and "synced_profiles_count" in sync_st

            # 5. Sign Out -> auth_session.json removed, API returns 401, disk profiles preserved!
            st, out_res = _api_call(port, "POST", "/api/auth/logout", {})
            assert st == 200 and out_res["authenticated"] is False
            assert not web_ui_server.AUTH_SESSION_FILE.exists(), "auth_session.json must be deleted on logout"
            assert (prof_dir / "config.json").is_file(), "Profile on disk MUST survive Sign Out!"
            if web_ui_server.launcher.chrome_path:
                assert cookie_file_1.is_file() or cookie_file_2.is_file(), "Cookies on disk MUST survive Sign Out!"

            st, unauth_res = _api_call(port, "GET", "/api/profiles")
            assert st == 401

            # 6. Sign in as Account B -> isolated workspace (must NOT see Account A's profiles)
            sub_b = "sub-account-B-111"
            web_ui_server.save_auth_session({
                "sub": sub_b,
                "email": "userb@example.com",
                "name": "User B",
                "picture": "",
                "scope": f"openid email profile {DRIVE_SCOPE}",
                "access_token": "tok_b",
                "refresh_token": "",
                "expires_at": int(time.time() + 3600),
            })
            st, prof_b = _api_call(port, "GET", "/api/profiles")
            assert st == 200 and prof_b["profiles"] == []
            _api_call(port, "POST", "/api/auth/logout", {})

            # 7. Sign back in as Account A -> profiles and cookies immediately reappear!
            web_ui_server.save_auth_session(session_a)
            st, prof_a2 = _api_call(port, "GET", "/api/profiles")
            assert st == 200
            names_a2 = [p["name"] for p in prof_a2["profiles"]]
            assert "Persist_Cookie_Prof" in names_a2
            assert "Legacy_Profile_1" in names_a2
            if web_ui_server.launcher.chrome_path:
                assert cookie_file_1.is_file() or cookie_file_2.is_file()

        finally:
            web_ui_server.shutdown_all_profiles()
            web_ui_server._detach_account_workspace()
            server.shutdown()
            cookie_srv.shutdown()
            web_ui_server.APP_DATA_ROOT = orig_app_data
            web_ui_server.ROOT = orig_root
            web_ui_server.AUTH_SESSION_FILE = orig_auth_file
            web_ui_server.SETTINGS_FILE = orig_settings_file
            web_ui_server.profile_mgr.set_profiles_dir(orig_profiles_dir)
            web_ui_server.settings["google_client_id"] = orig_client_id
            web_ui_server.settings["google_client_secret"] = orig_client_secret

    print("[PASS] Logout persistence, account isolation, legacy migration, and real browser cookie preservation verified.")


def test_google_api_error_parser_and_reauth_state():
    # 1. SERVICE_DISABLED error -> plain end-user copy without doc URLs or Cloud Console jargon
    svc_disabled_body = json.dumps({
        "error": {
            "code": 403,
            "message": "Google Drive API has not been used in project 12345 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=12345",
            "status": "PERMISSION_DENIED",
            "details": [{"@type": "type.googleapis.com/google.rpc.ErrorInfo", "reason": "SERVICE_DISABLED"}],
        }
    })
    msg, needs_reauth, reason = parse_google_api_error(403, svc_disabled_body)
    assert reason == "SERVICE_DISABLED"
    assert needs_reauth is False
    assert "https://" not in msg
    assert "Google Cloud Console" not in msg

    # 2. ADC / quota project error -> plain reconnect copy without ADC/quota jargon or URLs
    adc_body = json.dumps({
        "error": {
            "code": 403,
            "message": "Your application is authenticating by using local Application Default Credentials. The drive.googleapis.com API requires a quota project, which is not set by default. To learn how to set your quota project, see https://cloud.google.com/docs/authentication/adc-troubleshooting/user-creds .",
            "status": "PERMISSION_DENIED",
        }
    })
    msg_adc, needs_reauth_adc, reason_adc = parse_google_api_error(403, adc_body)
    assert reason_adc == "NEEDS_REAUTH"
    assert needs_reauth_adc is True
    assert "https://" not in msg_adc
    assert "quota project" not in msg_adc.lower()
    assert "ADC" not in msg_adc

    # 3. Missing scope / insufficientPermissions -> triggers needs_reauth
    scope_body = json.dumps({
        "error": {
            "code": 403,
            "message": "Request had insufficient authentication scopes.",
            "status": "PERMISSION_DENIED",
            "details": [{"reason": "ACCESS_TOKEN_SCOPE_INSUFFICIENT"}],
        }
    })
    msg_scope, needs_reauth_scope, reason_scope = parse_google_api_error(403, scope_body)
    assert reason_scope == "NEEDS_REAUTH"
    assert needs_reauth_scope is True

    # 4. CloudSyncManager initialized without drive.appdata scope enters needs_reauth cleanly
    with tempfile.TemporaryDirectory() as tmp:
        acct = Path(tmp) / "acct"
        sync_mgr = CloudSyncManager(
            google_sub="sub-missing-scope",
            account_dir=acct,
            proxies_file=acct / "proxies.json",
            token_provider=lambda _r: None,
            drive_authorized=False,
        )
        st = sync_mgr.get_status()
        assert st["state"] == "needs_reauth"
        assert st["drive_authorized"] is False
        res = sync_mgr.sync_now()
        assert res["sync"]["state"] == "needs_reauth"

    # 5. GoogleDriveAppDataClient never injects X-Goog-User-Project and uses Bearer token
    seen_headers = {}
    client = GoogleDriveAppDataClient(lambda force_refresh: "fresh-user-oauth-token")

    import urllib.request as _ur
    orig_urlopen = _ur.urlopen

    class _FakeResp:
        def __init__(self, payload: bytes):
            self._payload = payload
        def read(self):
            return self._payload
        def __enter__(self):
            return self
        def __exit__(self, *args):
            return False

    def _fake_urlopen(req, timeout=15):
        seen_headers.update({k.lower(): v for k, v in req.header_items()})
        return _FakeResp(json.dumps({"files": []}).encode("utf-8"))

    _ur.urlopen = _fake_urlopen
    try:
        files = client.list_files()
        assert files == []
        assert seen_headers.get("authorization") == "Bearer fresh-user-oauth-token"
        assert "x-goog-user-project" not in seen_headers
    finally:
        _ur.urlopen = orig_urlopen

    print("[PASS] Google API error parser, needs_reauth recovery, and strict Bearer auth verified.")


if __name__ == "__main__":
    test_selective_archive_and_crypto()
    test_cross_device_sync_and_conflict_resolution()
    test_account_persistence_across_logout_and_legacy_migration()
    test_google_api_error_parser_and_reauth_state()
    print("\nALL ACCOUNT PERSISTENCE & ENCRYPTED CLOUD SYNC TESTS PASSED!")
