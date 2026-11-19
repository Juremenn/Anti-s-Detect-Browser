"""
cdp_apply.py - Applies a profile identity to a running Chromium over CDP.

Engine-level mechanisms first (spec 4.3):
  - Emulation.setUserAgentOverride (with full userAgentMetadata so UA-CH,
    Sec-CH-UA and navigator.userAgentData all agree with the UA header)
  - Emulation.setTimezoneOverride / setLocaleOverride
  - Emulation.setGeolocationOverride, or Browser.setPermission(denied) to block
  - Page.addScriptToEvaluateOnNewDocument for everything CDP cannot set
  - Target.setAutoAttach(flatten, waitForDebuggerOnStart) so iframes (OOPIF),
    Web Workers, Shared Workers and Service Workers get the same script and
    never start unmasked.
  - Live in-browser IP & timezone detection via Network.loadNetworkResource so
    VPN browser extensions (e.g. Windscribe, Browsec, Urban VPN), system VPNs,
    and proxies automatically update the browser's timezone, locale, and geo.
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import struct
import time
import urllib.request
from urllib.parse import urlparse

from . import proxy_utils
from .consistency import _LANG_BY_COUNTRY, _TZ_BY_COUNTRY
from .fingerprint import _GEO_BY_COUNTRY, _locale_pair, build_user_agent_metadata
from .stealth_hooks import generate_stealth_script

_WAIT_FOR_BROWSER = 30.0

_GEOIP_ENDPOINTS = (
    "https://ipwho.is/",
    "https://freeipapi.com/api/json",
    "http://ip-api.com/json?fields=status,country,countryCode,timezone,lat,lon,query",
    "https://api.ip.sb/geoip",
)


def _http_get_json_sync(url: str, timeout: float = 2.0) -> dict | list | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode("utf-8", "replace"))
    except Exception:
        pass
    return None


async def _wait_for_version(port: int) -> dict | None:
    deadline = time.monotonic() + _WAIT_FOR_BROWSER
    url = f"http://127.0.0.1:{int(port)}/json/version"
    while time.monotonic() < deadline:
        data = await asyncio.to_thread(_http_get_json_sync, url, 2.0)
        if isinstance(data, dict) and data.get("webSocketDebuggerUrl"):
            return data
        await asyncio.sleep(0.4)
    return None


class _StdlibWebSocket:
    """Minimal RFC 6455 WebSocket client over asyncio streams (no external packages)."""

    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        self._reader = reader
        self._writer = writer
        self._write_lock = asyncio.Lock()
        self._closed = False

    @classmethod
    async def connect(cls, ws_url: str, timeout: float = 10.0) -> "_StdlibWebSocket":
        parsed = urlparse(ws_url)
        host = parsed.hostname or "127.0.0.1"
        port = parsed.port or 80
        path = parsed.path or "/"
        if parsed.query:
            path = f"{path}?{parsed.query}"

        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=timeout
        )
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        handshake = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host}:{port}\r\n"
            f"Upgrade: websocket\r\n"
            f"Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            f"Sec-WebSocket-Version: 13\r\n\r\n"
        )
        writer.write(handshake.encode("ascii"))
        await writer.drain()

        status_line = await asyncio.wait_for(reader.readline(), timeout=timeout)
        if b"101" not in status_line:
            writer.close()
            raise ConnectionError(f"WebSocket upgrade failed: {status_line.decode('latin-1', 'replace').strip()}")
        while True:
            line = await asyncio.wait_for(reader.readline(), timeout=timeout)
            if line in (b"\r\n", b"\n", b""):
                break
        return cls(reader, writer)

    async def _send_frame(self, opcode: int, payload: bytes):
        if self._closed:
            raise ConnectionError("WebSocket is closed")
        mask = os.urandom(4)
        header = bytearray([0x80 | (opcode & 0x0F)])
        n = len(payload)
        if n < 126:
            header.append(0x80 | n)
        elif n < 65536:
            header.append(0x80 | 126)
            header.extend(struct.pack(">H", n))
        else:
            header.append(0x80 | 127)
            header.extend(struct.pack(">Q", n))
        header.extend(mask)
        masked = bytes(b ^ mask[i & 3] for i, b in enumerate(payload))
        async with self._write_lock:
            self._writer.write(header + masked)
            await self._writer.drain()

    async def send_str(self, text: str):
        await self._send_frame(0x1, text.encode("utf-8"))

    async def receive(self) -> str | None:
        fragments: list[bytes] = []
        while not self._closed:
            try:
                hdr = await self._reader.readexactly(2)
            except (asyncio.IncompleteReadError, ConnectionError, OSError):
                self._closed = True
                return None
            fin = bool(hdr[0] & 0x80)
            opcode = hdr[0] & 0x0F
            masked = bool(hdr[1] & 0x80)
            length = hdr[1] & 0x7F
            try:
                if length == 126:
                    length = struct.unpack(">H", await self._reader.readexactly(2))[0]
                elif length == 127:
                    length = struct.unpack(">Q", await self._reader.readexactly(8))[0]
                mask_key = await self._reader.readexactly(4) if masked else b""
                data = await self._reader.readexactly(length) if length else b""
            except (asyncio.IncompleteReadError, ConnectionError, OSError):
                self._closed = True
                return None

            if masked and data:
                data = bytes(b ^ mask_key[i & 3] for i, b in enumerate(data))

            if opcode == 0x8:  # CLOSE
                self._closed = True
                return None
            if opcode == 0x9:  # PING -> PONG
                try:
                    await self._send_frame(0xA, data)
                except Exception:
                    pass
                continue
            if opcode == 0xA:  # PONG
                continue
            if opcode in (0x0, 0x1, 0x2):
                fragments.append(data)
                if fin:
                    return b"".join(fragments).decode("utf-8", "replace")
        return None

    async def close(self):
        if not self._closed:
            self._closed = True
            try:
                self._writer.close()
                await self._writer.wait_closed()
            except Exception:
                pass


class _CDPClient:
    """Minimal CDP client over one websocket with flattened child sessions."""

    def __init__(self, ws: _StdlibWebSocket):
        self._ws = ws
        self._id = 0
        self._pending: dict[int, asyncio.Future] = {}

    async def send(
        self,
        method: str,
        params: dict | None = None,
        session_id: str | None = None,
        timeout: float = 10.0,
    ):
        self._id += 1
        req_id = self._id
        msg: dict = {"id": req_id, "method": method, "params": params or {}}
        if session_id:
            msg["sessionId"] = session_id
        loop = asyncio.get_running_loop()
        fut = loop.create_future()
        self._pending[req_id] = fut
        try:
            await self._ws.send_str(json.dumps(msg))
            return await asyncio.wait_for(fut, timeout=timeout)
        except Exception:
            self._pending.pop(req_id, None)
            raise

    async def recv_loop(self, on_event):
        try:
            while True:
                raw = await self._ws.receive()
                if raw is None:
                    break
                try:
                    msg = json.loads(raw)
                except ValueError:
                    continue

                if "id" in msg:
                    fut = self._pending.pop(msg["id"], None)
                    if fut is not None and not fut.done():
                        if "error" in msg:
                            err = msg["error"]
                            err_msg = err.get("message", "CDP error") if isinstance(err, dict) else str(err)
                            fut.set_exception(RuntimeError(err_msg))
                        else:
                            fut.set_result(msg.get("result"))
                    continue

                if "method" in msg and on_event is not None:
                    # Run event handlers concurrently so recv_loop never blocks
                    # while a handler awaits a response from client.send().
                    asyncio.create_task(self._safe_event(on_event, msg))
        finally:
            for fut in list(self._pending.values()):
                if not fut.done():
                    fut.set_exception(ConnectionError("CDP WebSocket closed"))
            self._pending.clear()

    @staticmethod
    async def _safe_event(on_event, msg: dict):
        try:
            await on_event(msg)
        except Exception:
            pass


def _parse_geoip_payload(data: dict) -> dict | None:
    """Normalize GeoIP JSON from ipwho.is, freeipapi, ip-api, or ip.sb."""
    if not isinstance(data, dict):
        return None
    if data.get("success") is False or data.get("status") == "fail":
        return None

    ip = str(data.get("ip") or data.get("ipAddress") or data.get("query") or "").strip()
    country = str(
        data.get("country_code")
        or data.get("countryCode")
        or ""
    ).strip().upper()

    tz = ""
    raw_tz = data.get("timezone")
    if isinstance(raw_tz, dict):
        tz = str(raw_tz.get("id") or raw_tz.get("name") or "").strip()
    elif isinstance(raw_tz, str):
        tz = raw_tz.strip()
    if not tz:
        tz_list = data.get("timeZones")
        if isinstance(tz_list, list) and tz_list:
            tz = str(tz_list[0] or "").strip()

    lat = data.get("latitude") if data.get("latitude") is not None else data.get("lat")
    lon = data.get("longitude") if data.get("longitude") is not None else data.get("lon")
    try:
        lat = float(lat) if lat is not None else None
        lon = float(lon) if lon is not None else None
    except (TypeError, ValueError):
        lat = lon = None

    if ip and not country:
        country = str(proxy_utils.geoip_country(ip).get("country") or "").upper()
    if country and not tz:
        tz = _TZ_BY_COUNTRY.get(country, "")
    if country and (lat is None or lon is None) and country in _GEO_BY_COUNTRY:
        lat, lon = _GEO_BY_COUNTRY[country]

    if not ip and not tz and not country:
        return None
    return {
        "ip": ip,
        "country": country,
        "timezone": tz,
        "lat": lat,
        "lon": lon,
    }


async def _probe_browser_ip_geo(client: _CDPClient, session_id: str) -> dict | None:
    """Query the browser's exit IP and timezone through Chromium's network stack.

    Uses CDP Network.loadNetworkResource on the page's root frame so the request
    routes through any active Chrome VPN extension (chrome.proxy), profile proxy,
    or system VPN, while bypassing page CORS and CSP.
    """
    frame_id = None
    try:
        tree = await client.send("Page.getFrameTree", session_id=session_id, timeout=4.0)
        frame_id = ((tree or {}).get("frameTree") or {}).get("frame", {}).get("id")
    except Exception:
        frame_id = None

    if frame_id:
        for url in _GEOIP_ENDPOINTS:
            try:
                res = await client.send(
                    "Network.loadNetworkResource",
                    {
                        "frameId": frame_id,
                        "url": url,
                        "options": {"disableCache": True, "includeCredentials": False},
                    },
                    session_id=session_id,
                    timeout=6.0,
                )
                resource = (res or {}).get("resource") or {}
                if not resource.get("success"):
                    continue
                stream = resource.get("stream")
                if not stream:
                    continue
                chunks: list[str] = []
                try:
                    while True:
                        part = await client.send(
                            "IO.read", {"handle": stream}, session_id=session_id, timeout=4.0
                        )
                        if not part:
                            break
                        chunk = part.get("data") or ""
                        if part.get("base64Encoded") and chunk:
                            chunk = base64.b64decode(chunk).decode("utf-8", "replace")
                        chunks.append(chunk)
                        if part.get("eof"):
                            break
                finally:
                    try:
                        await client.send(
                            "IO.close", {"handle": stream}, session_id=session_id, timeout=2.0
                        )
                    except Exception:
                        pass
                parsed = _parse_geoip_payload(json.loads("".join(chunks)))
                if parsed and (parsed.get("timezone") or parsed.get("country")):
                    return parsed
            except Exception:
                continue

    # Fallback: fetch inside an isolated world if loadNetworkResource is unavailable
    for url in _GEOIP_ENDPOINTS[:2]:
        try:
            expr = f"fetch({json.dumps(url)}, {{cache: 'no-store'}}).then(r => r.text())"
            eval_res = await client.send(
                "Runtime.evaluate",
                {"expression": expr, "awaitPromise": True, "returnByValue": True},
                session_id=session_id,
                timeout=6.0,
            )
            val = ((eval_res or {}).get("result") or {}).get("value")
            if isinstance(val, str) and val:
                parsed = _parse_geoip_payload(json.loads(val))
                if parsed and (parsed.get("timezone") or parsed.get("country")):
                    return parsed
        except Exception:
            continue
    return None


async def _set_timezone_on_session(client: _CDPClient, tz: str, session_id: str | None = None):
    if not tz:
        return
    try:
        await client.send("Emulation.setTimezoneOverride", {"timezoneId": tz}, session_id=session_id, timeout=4.0)
    except Exception:
        try:
            await client.send("Emulation.setTimezoneOverride", {"timezoneId": ""}, session_id=session_id, timeout=2.0)
            await client.send("Emulation.setTimezoneOverride", {"timezoneId": tz}, session_id=session_id, timeout=4.0)
        except Exception:
            pass


async def _set_locale_on_session(client: _CDPClient, locale: str, session_id: str | None = None):
    if not locale:
        return
    try:
        await client.send("Emulation.setLocaleOverride", {"locale": locale}, session_id=session_id, timeout=4.0)
    except Exception:
        try:
            await client.send("Emulation.setLocaleOverride", {"locale": ""}, session_id=session_id, timeout=2.0)
            await client.send("Emulation.setLocaleOverride", {"locale": locale}, session_id=session_id, timeout=4.0)
        except Exception:
            pass


async def _apply_emulation_to_session(
    client: _CDPClient,
    session_id: str | None,
    is_page: bool,
    ua_params: dict | None,
    overrides: dict,
):
    tz = overrides.get("timezone")
    if tz:
        await _set_timezone_on_session(client, tz, session_id=session_id)

    languages = overrides.get("languages")
    if languages:
        await _set_locale_on_session(client, languages[0], session_id=session_id)

    if is_page and session_id:
        if ua_params:
            params = dict(ua_params)
            if languages:
                params["acceptLanguage"] = ", ".join(languages)
            try:
                await client.send("Emulation.setUserAgentOverride", params, session_id=session_id, timeout=4.0)
            except Exception:
                pass
        geo = overrides.get("geo")
        if geo:
            try:
                await client.send(
                    "Emulation.setGeolocationOverride",
                    {
                        "latitude": geo["latitude"],
                        "longitude": geo["longitude"],
                        "accuracy": geo["accuracy"],
                    },
                    session_id=session_id,
                    timeout=4.0,
                )
            except Exception:
                pass


async def _setup_target(
    client: _CDPClient,
    session_id: str,
    info: dict,
    state: dict,
    reload_page: bool = False,
):
    """Register hooks and emulation overrides on one attached target, then resume it."""
    url = str(info.get("url") or "")
    target_type = str(info.get("type") or "")

    # Never inject website stealth hooks into browser UI, extension, or DevTools targets.
    if (
        target_type == "browser_ui"
        or url.startswith(("chrome-extension://", "devtools://", "chrome-untrusted://"))
        or (url.startswith(("chrome://", "edge://", "brave://")) and target_type != "page")
    ):
        try:
            await client.send("Runtime.runIfWaitingForDebugger", session_id=session_id, timeout=3.0)
        except Exception:
            pass
        return

    is_page = target_type == "page"
    if is_page:
        state["pages"][session_id] = {"url": url, "script_id": None}

    try:
        await client.send("Page.enable", session_id=session_id, timeout=4.0)
    except Exception:
        pass
    try:
        await client.send("Runtime.enable", session_id=session_id, timeout=4.0)
    except Exception:
        pass

    if is_page:
        # Also auto-attach child OOPIFs and dedicated Web Workers of this page.
        try:
            await client.send(
                "Target.setAutoAttach",
                {"autoAttach": True, "waitForDebuggerOnStart": True, "flatten": True},
                session_id=session_id,
                timeout=4.0,
            )
        except Exception:
            pass

    script = state["script"]
    registered = False
    try:
        res = await client.send(
            "Page.addScriptToEvaluateOnNewDocument",
            {"source": script},
            session_id=session_id,
            timeout=4.0,
        )
        if is_page and session_id in state["pages"] and isinstance(res, dict):
            state["pages"][session_id]["script_id"] = res.get("identifier")
        registered = True
    except Exception:
        pass

    if not registered and target_type in ("worker", "shared_worker", "service_worker"):
        try:
            await client.send(
                "Runtime.evaluate",
                {"expression": script},
                session_id=session_id,
                timeout=4.0,
            )
        except Exception:
            pass

    await _apply_emulation_to_session(
        client, session_id, is_page, state["ua_params"], state["overrides"]
    )

    try:
        await client.send("Runtime.runIfWaitingForDebugger", session_id=session_id, timeout=3.0)
    except Exception:
        pass

    if reload_page and is_page and not url.startswith("chrome://"):
        try:
            await client.send("Page.reload", {"ignoreCache": False}, session_id=session_id, timeout=4.0)
        except Exception:
            pass


async def apply_profile_cdp(
    port: int,
    profile: dict,
    overrides: dict,
    browser_path: str = "",
) -> bool:
    """Connect to the browser's debug port and apply the identity. Blocking.

    Automatically detects the browser's live exit IP & timezone from inside the
    browser when timezone_mode / locale_mode / geo_mode is set to 'proxy' (IP-based),
    supporting VPN extensions, system VPNs, and proxies.
    """
    engine_info = await _wait_for_version(port)
    if not engine_info:
        return False

    ws_url = engine_info.get("webSocketDebuggerUrl")
    if not ws_url:
        return False

    engine_version = ""
    ua_header = ""
    try:
        browser_field = engine_info.get("Browser", "")
        engine_version = browser_field.split("/", 1)[1] if "/" in browser_field else ""
        ua_header = engine_info.get("User-Agent", "")
    except (AttributeError, IndexError):
        pass

    ua = profile.get("user_agent") or ua_header
    metadata = build_user_agent_metadata(profile, engine_version, browser_path)
    languages = overrides.get("languages") or profile.get("languages") or []
    accept_language = ", ".join(languages)

    ua_params = None
    if ua:
        ua_params = {
            "userAgent": ua,
            "acceptLanguage": accept_language,
            "platform": {
                "win": "Win32",
                "mac": "MacIntel",
                "linux": "Linux x86_64",
            }.get(profile.get("os") or "win", ""),
        }
        if metadata:
            ua_params["userAgentMetadata"] = metadata

    needs_ip_resolve = (
        profile.get("timezone_mode", "proxy") == "proxy"
        or profile.get("locale_mode", "proxy") == "proxy"
        or profile.get("geo_mode", "proxy") == "proxy"
    )

    state = {
        "profile": profile,
        "overrides": overrides,
        "ua_params": ua_params,
        "script": generate_stealth_script(profile, languages=languages or None),
        "pages": {},       # session_id -> {"url": str, "script_id": str | None}
        "other_sessions": set(),
        "last_ip": None,
        "last_tz": overrides.get("timezone") or "",
        "started_at": time.monotonic(),
        "startup_reloaded": False,
    }

    probe_lock = asyncio.Lock()
    probe_trigger = asyncio.Event()

    async def _broadcast_updated_overrides(client: _CDPClient, tz_changed: bool, lang_changed: bool):
        """Push updated timezone/locale/geo overrides to browser and all open sessions."""
        await _apply_emulation_to_session(client, None, False, state["ua_params"], overrides)

        new_langs = overrides.get("languages") or profile.get("languages") or []
        if lang_changed:
            state["script"] = generate_stealth_script(profile, languages=new_langs or None)

        for sid, page_meta in list(state["pages"].items()):
            await _apply_emulation_to_session(client, sid, True, state["ua_params"], overrides)
            if lang_changed and new_langs:
                old_script_id = page_meta.get("script_id")
                if old_script_id:
                    try:
                        await client.send(
                            "Page.removeScriptToEvaluateOnNewDocument",
                            {"identifier": old_script_id},
                            session_id=sid,
                            timeout=3.0,
                        )
                    except Exception:
                        pass
                try:
                    res = await client.send(
                        "Page.addScriptToEvaluateOnNewDocument",
                        {"source": state["script"]},
                        session_id=sid,
                        timeout=3.0,
                    )
                    if isinstance(res, dict):
                        page_meta["script_id"] = res.get("identifier")
                except Exception:
                    pass
                # Update navigator.language / languages in already-loaded pages
                langs_json = json.dumps(new_langs)
                js_lang = (
                    f"(() => {{ try {{ const l = {langs_json}; "
                    f"Object.defineProperty(Navigator.prototype, 'languages', {{get: () => Object.freeze([...l]), configurable: true, enumerable: true}}); "
                    f"Object.defineProperty(Navigator.prototype, 'language', {{get: () => l[0], configurable: true, enumerable: true}}); "
                    f"}} catch(e) {{}} }})()"
                )
                try:
                    await client.send("Runtime.evaluate", {"expression": js_lang}, session_id=sid, timeout=3.0)
                except Exception:
                    pass

        for sid in list(state["other_sessions"]):
            await _apply_emulation_to_session(client, sid, False, None, overrides)

        # If a VPN extension finished connecting during the initial startup window
        # (first 10s), reload the initial page once so the rendered DOM reflects the new timezone/IP.
        if tz_changed and not state["startup_reloaded"] and (time.monotonic() - state["started_at"] < 10.0):
            state["startup_reloaded"] = True
            for sid, page_meta in list(state["pages"].items()):
                u = str(page_meta.get("url") or "")
                if not u.startswith("chrome://") and not u.startswith("chrome-extension://"):
                    try:
                        await client.send("Page.reload", {"ignoreCache": False}, session_id=sid, timeout=3.0)
                    except Exception:
                        pass

    async def _refresh_from_browser_ip(client: _CDPClient) -> bool:
        if not needs_ip_resolve:
            return False
        if probe_lock.locked():
            return False
        async with probe_lock:
            # Choose an active web page session to perform the network probe
            candidates = [
                sid for sid, m in list(state["pages"].items())
                if not str(m.get("url") or "").startswith(("chrome://", "chrome-extension://", "devtools://"))
            ]
            if not candidates:
                candidates = list(state["pages"].keys())
            if not candidates:
                return False

            detected = None
            for sid in candidates:
                detected = await _probe_browser_ip_geo(client, sid)
                if detected:
                    break
            if not detected:
                return False

            ip = detected.get("ip") or ""
            country = detected.get("country") or ""
            tz = detected.get("timezone") or ""
            lat = detected.get("lat")
            lon = detected.get("lon")

            overrides["ip"] = ip
            overrides["country"] = country

            tz_changed = False
            lang_changed = False

            if profile.get("timezone_mode", "proxy") == "proxy" and tz:
                if overrides.get("timezone") != tz:
                    overrides["timezone"] = tz
                    tz_changed = True

            if profile.get("locale_mode", "proxy") == "proxy" and country:
                new_langs = _locale_pair(country)
                if overrides.get("languages") != new_langs:
                    overrides["languages"] = new_langs
                    lang_changed = True

            if profile.get("geo_mode", "proxy") == "proxy" and lat is not None and lon is not None:
                overrides["geo"] = {"latitude": float(lat), "longitude": float(lon), "accuracy": 1200.0}

            ip_changed = ip and ip != state["last_ip"]
            if ip_changed or tz_changed or lang_changed:
                state["last_ip"] = ip
                state["last_tz"] = overrides.get("timezone") or ""
                print(
                    f"[*] Browser IP detected: {ip or '?'} ({country or '?'}) -> "
                    f"Timezone: {overrides.get('timezone') or 'default'} | "
                    f"Locale: {(overrides.get('languages') or ['-'])[0]}"
                )
                await _broadcast_updated_overrides(client, tz_changed=tz_changed, lang_changed=lang_changed)
                return True
            return False

    async def _ip_monitor_loop(client: _CDPClient):
        """Continuously watch for browser IP changes (e.g. VPN extension toggled/switched)."""
        if not needs_ip_resolve:
            return
        # Fast checks right after launch to catch MV3 VPN extension startup,
        # then steady 5s interval or immediate wakeup on probe_trigger.
        while True:
            elapsed = time.monotonic() - state["started_at"]
            wait_sec = 2.0 if elapsed < 12.0 else 5.0
            try:
                await asyncio.wait_for(probe_trigger.wait(), timeout=wait_sec)
                probe_trigger.clear()
                await asyncio.sleep(0.4)
            except asyncio.TimeoutError:
                pass
            try:
                await _refresh_from_browser_ip(client)
            except Exception:
                pass

    ws = None
    try:
        ws = await _StdlibWebSocket.connect(ws_url)
        client = _CDPClient(ws)
        reloaded = {"done": False}
        last_nav_probe = {"ts": 0.0}

        async def on_event(msg: dict):
            method = msg.get("method")
            params = msg.get("params") or {}

            if method == "Target.attachedToTarget":
                info = params.get("targetInfo") or {}
                sid = params.get("sessionId")
                if not sid:
                    return
                ttype = info.get("type")
                url = str(info.get("url") or "")
                if url.startswith("chrome-extension://"):
                    await _setup_target(client, sid, info, state, reload_page=False)
                    probe_trigger.set()
                    return
                if ttype == "page" and not reloaded["done"]:
                    reloaded["done"] = True
                    await _setup_target(client, sid, info, state, reload_page=True)
                    probe_trigger.set()
                else:
                    if ttype != "page":
                        state["other_sessions"].add(sid)
                    await _setup_target(client, sid, info, state, reload_page=False)
                    if ttype == "page":
                        probe_trigger.set()

            elif method == "Target.detachedFromTarget":
                sid = params.get("sessionId")
                if sid:
                    state["pages"].pop(sid, None)
                    state["other_sessions"].discard(sid)

            elif method in ("Target.targetCreated", "Target.targetDestroyed", "Target.targetInfoChanged"):
                info = params.get("targetInfo") or {}
                url = str(info.get("url") or "")
                if url.startswith("chrome-extension://"):
                    # User opened/closed/interacted with a browser extension (e.g. VPN popup)
                    probe_trigger.set()

            elif method == "Page.frameNavigated":
                sid = msg.get("sessionId")
                frame = params.get("frame") or {}
                if sid in state["pages"] and not frame.get("parentId"):
                    state["pages"][sid]["url"] = frame.get("url") or ""
                    # Re-apply timezone on navigation to ensure override stays active
                    await _apply_emulation_to_session(
                        client, sid, True, state["ua_params"], state["overrides"]
                    )
                    now = time.monotonic()
                    if now - last_nav_probe["ts"] > 2.0:
                        last_nav_probe["ts"] = now
                        probe_trigger.set()

        # Start recv_loop BEFORE sending any commands so responses are always processed.
        recv_task = asyncio.create_task(client.recv_loop(on_event))

        # Apply any initial static overrides at browser level.
        await _apply_emulation_to_session(client, None, False, state["ua_params"], overrides)

        if profile.get("geo_mode") == "block":
            try:
                await client.send(
                    "Browser.setPermission",
                    {"permission": {"name": "geolocation"}, "setting": "denied"},
                    timeout=4.0,
                )
            except Exception:
                pass

        try:
            await client.send("Target.setDiscoverTargets", {"discover": True}, timeout=4.0)
        except Exception:
            pass

        await client.send(
            "Target.setAutoAttach",
            {"autoAttach": True, "waitForDebuggerOnStart": True, "flatten": True},
            timeout=5.0,
        )

        monitor_task = asyncio.create_task(_ip_monitor_loop(client))
        try:
            await recv_task
        finally:
            monitor_task.cancel()
        return True
    except Exception:
        return False
    finally:
        if ws is not None:
            await ws.close()


def start_cdp_thread(port: int, profile: dict, overrides: dict, browser_path: str = ""):
    """Run apply_profile_cdp on a daemon thread for the profile's lifetime."""
    import threading

    def runner():
        try:
            asyncio.run(apply_profile_cdp(port, profile, overrides, browser_path))
        except Exception:
            pass

    thread = threading.Thread(
        target=runner, daemon=True, name=f"cdp-apply-{profile.get('name')}"
    )
    thread.start()
    return thread
