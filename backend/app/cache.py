import json
import socket
from typing import Any
from urllib.parse import urlparse

CACHE_UNAVAILABLE = object()


class NoopCache:
    enabled = False

    def get_json(self, key: str) -> Any:
        return None

    def set_json(self, key: str, value: Any, ttl_seconds: int = 60) -> None:
        return None

    def delete(self, *keys: str) -> None:
        return None

    def ping(self) -> bool:
        return False


def _encode_command(parts: list[Any]) -> bytes:
    chunks = [f"*{len(parts)}\r\n".encode("ascii")]
    for part in parts:
        raw = str(part).encode("utf-8")
        chunks.append(f"${len(raw)}\r\n".encode("ascii"))
        chunks.append(raw)
        chunks.append(b"\r\n")
    return b"".join(chunks)


def _read_line(sock_file: Any) -> bytes:
    line = sock_file.readline()
    if not line:
        raise RuntimeError("Redis connection closed")
    return line.rstrip(b"\r\n")


def _read_resp(sock_file: Any) -> Any:
    prefix = sock_file.read(1)
    if prefix == b"$":
        length = int(_read_line(sock_file))
        if length == -1:
            return None
        data = sock_file.read(length)
        sock_file.read(2)
        return data.decode("utf-8")
    if prefix == b"+":
        return _read_line(sock_file).decode("utf-8")
    if prefix == b":":
        return int(_read_line(sock_file))
    if prefix == b"-":
        raise RuntimeError(_read_line(sock_file).decode("utf-8"))
    raise RuntimeError("Unsupported Redis response")


def _send_redis_command(host: str, port: int, parts: list[Any]) -> Any:
    with socket.create_connection((host, port), timeout=1.2) as sock:
        sock.settimeout(1.2)
        sock.sendall(_encode_command(parts))
        return _read_resp(sock.makefile("rb"))


class RedisCache:
    enabled = True

    def __init__(self, redis_url: str):
        parsed = urlparse(redis_url)
        self.host = parsed.hostname or "127.0.0.1"
        self.port = parsed.port or 6379

    def get_json(self, key: str) -> Any:
        try:
            value = _send_redis_command(self.host, self.port, ["GET", key])
            return json.loads(value) if value else None
        except Exception as exc:
            print(f"Redis GET failed for {key}: {exc}")
            return CACHE_UNAVAILABLE

    def set_json(self, key: str, value: Any, ttl_seconds: int = 60) -> None:
        try:
            _send_redis_command(self.host, self.port, ["SETEX", key, ttl_seconds, json.dumps(value)])
        except Exception as exc:
            print(f"Redis SETEX failed for {key}: {exc}")

    def delete(self, *keys: str) -> None:
        if not keys:
            return
        try:
            _send_redis_command(self.host, self.port, ["DEL", *keys])
        except Exception as exc:
            print(f"Redis DEL failed: {exc}")

    def ping(self) -> bool:
        try:
            return _send_redis_command(self.host, self.port, ["PING"]) == "PONG"
        except Exception:
            return False


def create_redis_cache(redis_url: str) -> NoopCache | RedisCache:
    return RedisCache(redis_url) if redis_url else NoopCache()

