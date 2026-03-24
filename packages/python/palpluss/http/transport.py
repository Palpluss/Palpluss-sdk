from __future__ import annotations

import base64
import time
from typing import Any

import httpx

from .errors import PalPlussApiError, RateLimitError

DEFAULT_BASE_URL = "https://api.palpluss.com/v1"
DEFAULT_TIMEOUT = 30.0
DEFAULT_MAX_RETRIES = 3


def _build_auth_header(api_key: str) -> str:
    return "Basic " + base64.b64encode(f"{api_key}:".encode()).decode()


def _build_url(base_url: str, path: str) -> str:
    base = base_url.rstrip("/")
    return base + (path if path.startswith("/") else "/" + path)


def _clean_query(query: dict[str, Any] | None) -> dict[str, str] | None:
    if not query:
        return None
    return {k: str(v) for k, v in query.items() if v is not None}


def _handle_response(response: httpx.Response) -> Any:
    """Unwrap the API envelope or raise a typed error."""
    if response.status_code == 204:
        return None

    body: dict[str, Any] = response.json()
    request_id: str | None = body.get("requestId")

    if not response.is_success or body.get("success") is False:
        error = body.get("error") or {}
        api_error = PalPlussApiError.from_response(response.status_code, error, request_id)
        if isinstance(api_error, RateLimitError):
            retry_after_header = response.headers.get("Retry-After")
            if retry_after_header:
                api_error.retry_after = int(retry_after_header)
        raise api_error

    return body.get("data")


class HttpTransport:
    """Synchronous HTTP transport layer."""

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
        auto_retry_on_rate_limit: bool = True,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._auto_retry_on_rate_limit = auto_retry_on_rate_limit
        self._max_retries = max_retries
        self._client = httpx.Client(
            headers={
                "Authorization": _build_auth_header(api_key),
                "Accept": "application/json",
            },
            timeout=timeout,
        )

    def request(
        self,
        method: str,
        path: str,
        *,
        body: dict[str, Any] | None = None,
        query: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> Any:
        url = _build_url(self._base_url, path)
        extra_headers: dict[str, str] = {}
        if idempotency_key:
            extra_headers["Idempotency-Key"] = idempotency_key

        send_body = body if body and method in ("POST", "PATCH", "PUT") else None
        params = _clean_query(query)

        attempt = 0
        while True:
            response = self._client.request(
                method,
                url,
                headers=extra_headers or None,
                json=send_body,
                params=params,
            )

            rate_limited = response.status_code == 429
            if rate_limited and self._auto_retry_on_rate_limit and attempt < self._max_retries:
                retry_after = int(response.headers.get("Retry-After", "1"))
                time.sleep(retry_after)
                attempt += 1
                continue

            return _handle_response(response)

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> HttpTransport:
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()


class AsyncHttpTransport:
    """Asynchronous HTTP transport layer."""

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
        auto_retry_on_rate_limit: bool = True,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._auto_retry_on_rate_limit = auto_retry_on_rate_limit
        self._max_retries = max_retries
        self._client = httpx.AsyncClient(
            headers={
                "Authorization": _build_auth_header(api_key),
                "Accept": "application/json",
            },
            timeout=timeout,
        )

    async def request(
        self,
        method: str,
        path: str,
        *,
        body: dict[str, Any] | None = None,
        query: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> Any:
        import asyncio

        url = _build_url(self._base_url, path)
        extra_headers: dict[str, str] = {}
        if idempotency_key:
            extra_headers["Idempotency-Key"] = idempotency_key

        send_body = body if body and method in ("POST", "PATCH", "PUT") else None
        params = _clean_query(query)

        attempt = 0
        while True:
            response = await self._client.request(
                method,
                url,
                headers=extra_headers or None,
                json=send_body,
                params=params,
            )

            rate_limited = response.status_code == 429
            if rate_limited and self._auto_retry_on_rate_limit and attempt < self._max_retries:
                retry_after = int(response.headers.get("Retry-After", "1"))
                await asyncio.sleep(retry_after)
                attempt += 1
                continue

            return _handle_response(response)

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> AsyncHttpTransport:
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.close()
