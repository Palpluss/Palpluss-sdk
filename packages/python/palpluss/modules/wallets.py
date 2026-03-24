from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from ..http.transport import AsyncHttpTransport, HttpTransport


class WalletsModule:
    def __init__(self, transport: HttpTransport) -> None:
        self._transport = transport

    def service_balance(self) -> Any:
        return self._transport.request("GET", "/wallets/service/balance")

    def service_topup(
        self,
        *,
        amount: float,
        phone: str,
        account_reference: str | None = None,
        transaction_desc: str | None = None,
        idempotency_key: str | None = None,
    ) -> Any:
        body: dict[str, Any] = {"amount": amount, "phone": phone}
        if account_reference is not None:
            body["accountReference"] = account_reference
        if transaction_desc is not None:
            body["transactionDesc"] = transaction_desc
        return self._transport.request(
            "POST", "/wallets/service/topups", body=body, idempotency_key=idempotency_key
        )


class AsyncWalletsModule:
    def __init__(self, transport: AsyncHttpTransport) -> None:
        self._transport = transport

    async def service_balance(self) -> Any:
        return await self._transport.request("GET", "/wallets/service/balance")

    async def service_topup(
        self,
        *,
        amount: float,
        phone: str,
        account_reference: str | None = None,
        transaction_desc: str | None = None,
        idempotency_key: str | None = None,
    ) -> Any:
        body: dict[str, Any] = {"amount": amount, "phone": phone}
        if account_reference is not None:
            body["accountReference"] = account_reference
        if transaction_desc is not None:
            body["transactionDesc"] = transaction_desc
        return await self._transport.request(
            "POST", "/wallets/service/topups", body=body, idempotency_key=idempotency_key
        )
