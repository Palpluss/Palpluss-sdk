from __future__ import annotations

from typing import TYPE_CHECKING, Any, Literal

if TYPE_CHECKING:
    from ..http.transport import AsyncHttpTransport, HttpTransport


class TransactionsModule:
    def __init__(self, transport: HttpTransport) -> None:
        self._transport = transport

    def get(self, transaction_id: str) -> Any:
        return self._transport.request("GET", f"/transactions/{transaction_id}")

    def list(
        self,
        *,
        limit: int | None = None,
        cursor: str | None = None,
        status: str | None = None,
        type: Literal["STK", "B2C"] | None = None,
    ) -> Any:
        query: dict[str, Any] = {
            "limit": limit,
            "cursor": cursor,
            "status": status,
            "type": type,
        }
        return self._transport.request("GET", "/transactions", query=query)


class AsyncTransactionsModule:
    def __init__(self, transport: AsyncHttpTransport) -> None:
        self._transport = transport

    async def get(self, transaction_id: str) -> Any:
        return await self._transport.request("GET", f"/transactions/{transaction_id}")

    async def list(
        self,
        *,
        limit: int | None = None,
        cursor: str | None = None,
        status: str | None = None,
        type: Literal["STK", "B2C"] | None = None,
    ) -> Any:
        query: dict[str, Any] = {
            "limit": limit,
            "cursor": cursor,
            "status": status,
            "type": type,
        }
        return await self._transport.request("GET", "/transactions", query=query)
