from __future__ import annotations

from typing import Any


class PalPlussApiError(Exception):
    """Raised for all non-2xx responses from the PalPluss API."""

    code: str
    http_status: int
    details: dict[str, Any]
    request_id: str | None

    def __init__(
        self,
        message: str,
        code: str,
        http_status: int,
        details: dict[str, Any] | None = None,
        request_id: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.http_status = http_status
        self.details = details or {}
        self.request_id = request_id

    @classmethod
    def from_response(
        cls,
        http_status: int,
        error_body: dict[str, Any],
        request_id: str | None = None,
    ) -> PalPlussApiError:
        message = error_body.get("message", "Unknown error")
        code = error_body.get("code", "UNKNOWN")
        details = error_body.get("details") or {}
        if http_status == 429:
            return RateLimitError(message, code, details, request_id)
        return cls(message, code, http_status, details, request_id)

    def __repr__(self) -> str:
        return (
            f"{type(self).__name__}("
            f"code={self.code!r}, "
            f"http_status={self.http_status}, "
            f"message={str(self)!r})"
        )


class RateLimitError(PalPlussApiError):
    """Raised when the API returns HTTP 429 Too Many Requests."""

    retry_after: int | None

    def __init__(
        self,
        message: str,
        code: str,
        details: dict[str, Any] | None = None,
        request_id: str | None = None,
        retry_after: int | None = None,
    ) -> None:
        super().__init__(message, code, 429, details, request_id)
        self.retry_after = retry_after
