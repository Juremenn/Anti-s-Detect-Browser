"""
proxy_utils.py - Parse proxy strings in the common paste formats and test a proxy
by tunneling through it (HTTP CONNECT / SOCKS4 / SOCKS5 implemented on raw sockets,
so the checker works even for SOCKS proxies that urllib cannot use).

Supported input formats:
  type://user:pass@host:port
  type://host:port
  user:pass@host:port        (defaults to HTTP)
  host:port:user:pass
  host:port
"""

import ipaddress
import json
import socket
import ssl
import struct
import time
from pathlib import Path

PROXY_TYPES = ("http", "https", "socks4", "socks5")

# The exit-IP echo endpoint. Plain HTTP (no TLS on our side) so the tunnel only
# needs a plain CONNECT. ip-api.com answers with the exit IP and country.
_ECHO_HOST = "ip-api.com"
_ECHO_PORT = 80
_ECHO_PATH = (
    "/json?fields=status,message,country,countryCode,query"
)
_ECHO_REQUEST = (
    f"GET {_ECHO_PATH} HTTP/1.0\r\nHost: {_ECHO_HOST}\r\n"
    f"User-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n"
).encode("ascii")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


class ProxyError(ValueError):
    """Invalid proxy input; the message is safe to show to the user."""


def _split_host_port(token: str):
    # IPv6 literals [::1]:8080
    if token.startswith("["):
        end = token.find("]")
        if end == -1 or not token[end + 1:].startswith(":"):
            raise ProxyError(f"Alamat IPv6 tidak valid: {token}")
        return token[1:end], token[end + 2:]
    if token.count(":") > 1:
        raise ProxyError(f"Alamat tidak valid: {token}")
    if ":" not in token:
        raise ProxyError(f"Port tidak ada: {token}")
    host, _, port_s = token.partition(":")
    return host, port_s


def _validate(host: str, port: int):
    if not host:
        raise ProxyError("Host proxy kosong.")
    if len(host) > 253:
        raise ProxyError("Host proxy terlalu panjang.")
    if not (1 <= port <= 65535):
        raise ProxyError("Port harus di antara 1 dan 65535.")


def parse_proxy_string(raw: str) -> dict:
    """Parse one proxy string into components. Raises ProxyError."""
    s = str(raw or "").strip()
    if not s:
        raise ProxyError("String proxy kosong.")

    ptype = "http"
    rest = s
    # scheme://...
    if "://" in s:
        scheme, _, rest = s.partition("://")
        scheme = scheme.lower()
        if scheme not in PROXY_TYPES:
            raise ProxyError(f"Tipe proxy '{scheme}' tidak dikenal. Gunakan: {', '.join(PROXY_TYPES)}.")
        ptype = scheme

    username = password = ""
    if "@" in rest:
        cred_part, _, rest = rest.rpartition("@")
        if ":" in cred_part:
            username, _, password = cred_part.partition(":")
        else:
            username = cred_part
        if not username or not password:
            raise ProxyError("Username/password proxy tidak lengkap.")

    # Bare host:port:user:pass (4 segments, no scheme prefix given)
    if ptype == "http" and "://" not in s and rest.count(":") >= 3:
        parts = rest.split(":")
        if len(parts) != 4:
            raise ProxyError(f"Format tidak dikenal: {s}")
        host, port_s, username, password = parts
        try:
            port = int(port_s)
        except ValueError:
            raise ProxyError(f"Port bukan angka: {port_s}")
        _validate(host, port)
        return {"type": ptype, "host": host, "port": port,
                "username": username, "password": password}

    host, port_s = _split_host_port(rest)
    try:
        port = int(port_s)
    except ValueError:
        raise ProxyError(f"Port bukan angka: {port_s}")
    _validate(host, port)
    return {
        "type": ptype,
        "host": host,
        "port": port,
        "username": username,
        "password": password,
    }


def to_url(parsed: dict) -> str:
    """Chrome --proxy-server form: type://host:port (no credentials)."""
    return f"{parsed['type']}://{parsed['host']}:{parsed['port']}"


def _read_http_response(sock, leftover: bytes = b"") -> bytes:
    buf = leftover
    while b"\r\n\r\n" not in buf:
        chunk = sock.recv(4096)
        if not chunk:
            return buf
        buf += chunk
    head, _, body = buf.partition(b"\r\n\r\n")
    # Content-Length based read (ip-api sends Content-Length)
    clen = 0
    for line in head.split(b"\r\n"):
        if line.lower().startswith(b"content-length:"):
            try:
                clen = int(line.split(b":", 1)[1].strip())
            except ValueError:
                clen = 0
    while len(body) < clen:
        chunk = sock.recv(4096)
        if not chunk:
            break
        body += chunk
    return body


def _tunnel_http(parsed: dict, dest_host: str, dest_port: int, timeout: float):
    """HTTP CONNECT tunnel. Returns the raw socket to the destination."""
    sock = socket.create_connection((parsed["host"], parsed["port"]), timeout=timeout)
    try:
        req = f"CONNECT {dest_host}:{dest_port} HTTP/1.1\r\nHost: {dest_host}:{dest_port}\r\n"
        if parsed["username"]:
            import base64
            cred = base64.b64encode(
                f"{parsed['username']}:{parsed['password']}".encode()
            ).decode()
            req += f"Proxy-Authorization: Basic {cred}\r\n"
        req += "\r\n"
        sock.sendall(req.encode("ascii"))
        # Read the response headers manually (socket has no file reader here).
        buf = b""
        while b"\r\n\r\n" not in buf:
            chunk = sock.recv(4096)
            if not chunk:
                break
            buf += chunk
        status = buf.split(b"\r\n", 1)[0].decode("latin-1", "replace")
        code = int(status.split()[1]) if status and len(status.split()) > 1 else 0
        if code != 200:
            sock.close()
            raise ProxyError(f"Proxy menolak CONNECT ({status[:40] or 'tanpa respons'}).")
        # Any bytes after the header blank line belong to the tunnel; simplest
        # safe path: reconnect is avoided by sending the request as-is because
        # HTTP CONNECT responses end at \r\n\r\n and the request we send next
        # is the first tunnel byte.
        leftover = buf.split(b"\r\n\r\n", 1)[1]
        return sock, leftover
    except Exception:
        sock.close()
        raise


def _tunnel_socks5(parsed: dict, dest_host: str, dest_port: int, timeout: float):
    sock = socket.create_connection((parsed["host"], parsed["port"]), timeout=timeout)
    try:
        auth_nmethods = 2 if parsed["username"] else 1
        methods = b"\x02" if parsed["username"] else b"\x00"
        sock.sendall(b"\x05" + bytes([auth_nmethods]) + methods)
        resp = sock.recv(2)
        if len(resp) < 2 or resp[0] != 5:
            raise ProxyError("Bukan proxy SOCKS5 yang valid.")
        method = resp[1]
        if method == 0x02:
            if not parsed["username"]:
                raise ProxyError("Proxy SOCKS5 meminta username/password.")
            cred = (
                b"\x01" + bytes([len(parsed["username"])]) + parsed["username"].encode()
                + bytes([len(parsed["password"])]) + parsed["password"].encode()
            )
            sock.sendall(cred)
            resp = sock.recv(2)
            if len(resp) < 2 or resp[1] != 0:
                raise ProxyError("Username/password SOCKS5 ditolak.")
        elif method != 0x00:
            raise ProxyError("Proxy SOCKS5 meminta metode auth yang tidak didukung.")

        try:
            addr_bytes = ipaddress.ip_address(dest_host).packed
            atyp = 0x01 if b"." in addr_bytes[:4] and len(addr_bytes) == 4 else 0x04
        except ValueError:
            atyp = 0x03
            addr_bytes = dest_host.encode()
        req = b"\x05\x01\x00" + bytes([atyp]) + (
            bytes([len(addr_bytes)]) + addr_bytes if atyp == 0x03 else addr_bytes
        ) + struct.pack(">H", dest_port)
        sock.sendall(req)
        resp = sock.recv(4)
        if len(resp) < 4 or resp[1] != 0:
            code = resp[1] if len(resp) > 1 else -1
            reasons = {
                1: "general failure", 2: "not allowed", 3: "network unreachable",
                4: "host unreachable", 5: "connection refused", 6: "TTL expired",
                7: "command not supported", 8: "address type not supported",
            }
            raise ProxyError(f"SOCKS5 connect gagal: {reasons.get(code, 'error ' + str(code))}")
        atyp = resp[3]
        if atyp == 0x01:
            sock.recv(4 + 2)
        elif atyp == 0x04:
            sock.recv(16 + 2)
        else:
            n = sock.recv(1)[0]
            sock.recv(n + 2)
        return sock, b""
    except Exception:
        sock.close()
        raise


def _tunnel_socks4(parsed: dict, dest_host: str, dest_port: int, timeout: float):
    sock = socket.create_connection((parsed["host"], parsed["port"]), timeout=timeout)
    try:
        # SOCKS4 requires an IP, so resolve locally first (plain HTTP dest, DNS leak
        # here only reveals ip-api.com — acceptable for a checker; the browser
        # itself tunnels SOCKS5h via --proxy-server).
        dest_ip = socket.gethostbyname(dest_host)
        user_id = parsed["username"].encode() if parsed["username"] else b""
        req = (
            b"\x04\x01" + struct.pack(">H", dest_port)
            + socket.inet_aton(dest_ip) + user_id + b"\x00"
        )
        sock.sendall(req)
        resp = sock.recv(8)
        if len(resp) < 8 or resp[1] != 0x5A:
            raise ProxyError("SOCKS4 connect ditolak (atau proxy bukan SOCKS4).")
        return sock, b""
    except Exception:
        sock.close()
        raise


def check_proxy(raw_url: str, timeout: float = 10.0) -> dict:
    """Tunnel to the IP echo endpoint through the proxy and report the exit IP.

    Returns {"ok", "ip", "country", "country_code", "latency_ms", "error"}.
    """
    result = {"ok": False, "ip": None, "country": None, "country_code": None,
              "latency_ms": None, "error": None}
    try:
        parsed = parse_proxy_string(raw_url)
    except ProxyError as e:
        result["error"] = str(e)
        return result

    tunnel = {"http": _tunnel_http, "https": _tunnel_http,
              "socks5": _tunnel_socks5, "socks4": _tunnel_socks4}[parsed["type"]]
    started = time.monotonic()
    try:
        sock, leftover = tunnel(parsed, _ECHO_HOST, _ECHO_PORT, timeout)
        try:
            sock.sendall(_ECHO_REQUEST)
            body = _read_http_response(sock, leftover)
        finally:
            sock.close()
        result["latency_ms"] = int((time.monotonic() - started) * 1000)
        data = json.loads(body.decode("utf-8", "replace"))
        if data.get("status") != "success":
            result["error"] = data.get("message") or "Echo service gagal."
            return result
        result["ok"] = True
        result["ip"] = data.get("query")
        result["country"] = data.get("country")
        result["country_code"] = data.get("countryCode")
    except ProxyError as e:
        result["error"] = str(e)
    except socket.timeout:
        result["error"] = "Timeout: proxy tidak merespons."
    except (OSError, ValueError) as e:
        result["error"] = f"Gagal terhubung: {e}"
    return result


# --- offline GeoIP (MMDB, pure Python) ---------------------------------------

def find_mmdb() -> Path | None:
    """First .mmdb file in data/ (GeoLite2-Country or DB-IP country)."""
    if not DATA_DIR.exists():
        return None
    candidates = sorted(DATA_DIR.glob("*.mmdb"))
    return candidates[0] if candidates else None


class _MMDB:
    """Minimal MaxMind DB reader: IPv4 lookups only, country databases."""

    MARKER = b"\xab\xcd\xefMaxMind.com"

    def __init__(self, path: Path):
        self._buf = path.read_bytes()
        marker = self._buf.rfind(self.MARKER)
        if marker == -1:
            raise ValueError("Bukan file MMDB yang valid.")
        self._meta_start = marker + len(self.MARKER)
        # Metadata pointers are relative to the metadata start; data-section
        # pointers are relative to the data-section start (set below).
        self._pointer_base = self._meta_start
        meta = self._decode(self._meta_start)[1]
        if not isinstance(meta, dict) or "node_count" not in meta or "record_size" not in meta:
            raise ValueError("Metadata MMDB tidak lengkap.")
        self._node_count = int(meta["node_count"])
        self._record_size = int(meta["record_size"])
        self._node_bytes = self._record_size * 2 // 8
        tree_len = self._node_count * self._node_bytes
        self._data_start = tree_len + 16  # 16 bytes: data section separator
        self._pointer_base = self._data_start  # data pointers from here on
        self._tree = self._buf[:tree_len]
        self._metadata = meta

    # data-section decoder -----------------------------------------------------

    def _ctrl(self, offset: int):
        """Returns (type, size, next_offset, size_extra_bytes).

        Spec v2: 3-bit type in the top of the control byte; type 0 is extended
        and the actual type number is stored (+7) in the NEXT byte. The 5-bit
        size field is in the control byte; for sizes 29/30/31 the extra bytes
        follow the (possible) extended-type byte.
        """
        ctrl = self._buf[offset]
        type_ = ctrl >> 5
        size = ctrl & 0x1F
        p = offset + 1
        if type_ == 0:  # extended: actual type number in the next byte (+7)
            type_ = self._buf[p] + 7
            p += 1
        if size == 29:
            size = 29 + self._buf[p]
            p += 1
        elif size == 30:
            size = 285 + int.from_bytes(self._buf[p:p + 2], "big")
            p += 2
        elif size == 31:
            size = 65821 + int.from_bytes(self._buf[p:p + 3], "big")
            p += 3
        return type_, size, p

    def _decode(self, offset: int, depth: int = 0, pointer_base: int | None = None):
        if depth > 512:
            raise ValueError("MMDB data terlalu dalam.")
        type_, size, offset = self._ctrl(offset)
        base = self._pointer_base
        if type_ == 1:  # pointer: 001SSVVV
            psz = (size >> 3) & 0x3
            v = size & 0x7
            if psz == 0:
                value = (v << 8) | self._buf[offset]
                offset += 1
            elif psz == 1:
                value = ((v << 16) | int.from_bytes(self._buf[offset:offset + 2], "big")) + 2048
                offset += 2
            elif psz == 2:
                value = ((v << 24) | int.from_bytes(self._buf[offset:offset + 3], "big")) + 526336
                offset += 3
            else:
                value = int.from_bytes(self._buf[offset:offset + 4], "big")
                offset += 4
            _, data, _ = self._decode(base + value, depth + 1)
            return 0, data, offset
        if type_ == 2:  # utf8 string
            return type_, self._buf[offset:offset + size].decode("utf-8", "replace"), offset + size
        if type_ == 3:  # double
            import struct as _s
            return type_, _s.unpack(">d", self._buf[offset:offset + 8])[0], offset + 8
        if type_ == 4:  # bytes
            return type_, self._buf[offset:offset + size], offset + size
        if type_ == 5:  # uint16
            return type_, int.from_bytes(self._buf[offset:offset + size], "big"), offset + size
        if type_ == 6:  # uint32
            return type_, int.from_bytes(self._buf[offset:offset + size], "big"), offset + size
        if type_ == 7:  # map: size = number of key/value pairs
            out = {}
            for _ in range(size):
                _, key, offset = self._decode(offset, depth + 1)
                _, value, offset = self._decode(offset, depth + 1)
                out[key] = value
            return type_, out, offset
        if type_ == 8:  # int32: shorter-than-max fields are always positive
            signed = size == 4
            return type_, int.from_bytes(self._buf[offset:offset + size], "big", signed=signed), offset + size
        if type_ == 9:  # uint64
            return type_, int.from_bytes(self._buf[offset:offset + size], "big"), offset + size
        if type_ == 10:  # uint128
            return type_, int.from_bytes(self._buf[offset:offset + size], "big"), offset + size
        if type_ == 11:  # array: size = number of values
            out = []
            for _ in range(size):
                _, value, offset = self._decode(offset, depth + 1)
                out.append(value)
            return type_, out, offset
        if type_ == 14:  # boolean
            return type_, size == 1, offset
        if type_ == 15:  # float
            import struct as _s
            return type_, _s.unpack(">f", self._buf[offset:offset + 4])[0], offset + 4
        raise ValueError(f"Tipe data MMDB tidak dikenal: {type_}")

    def lookup_country(self, ip: str) -> dict | None:
        try:
            packed = ipaddress.IPv4Address(ip).packed
        except (ipaddress.AddressValueError, ValueError):
            return None
        ip_int = int.from_bytes(packed, "big")
        node = 0
        buf, rs = self._tree, self._record_size
        for i in range(32):
            bit = (ip_int >> (31 - i)) & 1
            base = node * self._node_bytes
            if rs == 24:
                left = int.from_bytes(buf[base:base + 3], "big")
                right = int.from_bytes(buf[base + 3:base + 6], "big")
            elif rs == 28:
                middle = buf[base + 3]
                left = ((buf[base] << 20) | (buf[base + 1] << 12)
                        | (buf[base + 2] << 4) | ((middle & 0xF0) >> 4))
                right = (((middle & 0x0F) << 24) | (buf[base + 4] << 16)
                         | (buf[base + 5] << 8) | buf[base + 6])
            else:  # 32
                left = int.from_bytes(buf[base:base + 4], "big")
                right = int.from_bytes(buf[base + 4:base + 8], "big")
            node = right if bit else left
            if node >= self._node_count:
                if node == self._node_count:
                    return None  # no data for this IP
                offset = (node - self._node_count) - 16
                _, data, _ = self._decode(self._data_start + offset)
                return data if isinstance(data, dict) else None
        return None


_MMDB_CACHE: dict = {}


def geoip_country(ip: str) -> dict:
    """{"country": str|None, "source": "local"|"echo"|"none", "db": path|None}."""
    result = {"country": None, "source": "none", "db": None}
    db_path = find_mmdb()
    if db_path and ip:
        try:
            reader = _MMDB_CACHE.get(str(db_path))
            if reader is None:
                reader = _MMDB(db_path)
                _MMDB_CACHE[str(db_path)] = reader
            rec = reader.lookup_country(ip)
            if rec:
                # GeoLite2 shape: {"country": {"iso_code": "US"}}; DB-IP Lite via
                # ip-location-db shape: {"country_code": "US"}
                country = (
                    rec.get("country", {}).get("iso_code")
                    if isinstance(rec.get("country"), dict) else None
                ) or rec.get("country_code") or rec.get("registered_country", {}).get("iso_code")
                if country:
                    result["country"] = str(country)
                    result["source"] = "local"
                    result["db"] = db_path.name
        except (OSError, ValueError):
            pass
    return result
