from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from ..http.transport import AsyncHttpTransport, HttpTransport


class StkModule:
    def __init__(self, transport: HttpTransport) -> None:
        self._transport = transport

    def initiate(
        self,
        *,
        amount: float,
        phone: str,
        account_reference: str | None = None,
        transaction_desc: str | None = None,
        channel_id: str | None = None,
        callback_url: str | None = None,
        credential_id: str | None = None,
    ) -> Any:
        body: dict[str, Any] = {"amount": amount, "phone": phone}
        if account_reference is not None:
            body["accountReference"] = account_reference
        if transaction_desc is not None:
            body["transactionDesc"] = transaction_desc
        if channel_id is not None:
            body["channelId"] = channel_id
        if callback_url is not None:
            body["callbackUrl"] = callback_url
        if credential_id is not None:
            body["credential_id"] = credential_id
        return self._transport.request("POST", "/payments/stk", body=body)


class AsyncStkModule:
    def __init__(self, transport: AsyncHttpTransport) -> None:
        self._transport = transport

    async def initiate(
        self,
        *,
        amount: float,
        phone: str,
        account_reference: str | None = None,
        transaction_desc: str | None = None,
        channel_id: str | None = None,
        callback_url: str | None = None,
        credential_id: str | None = None,
    ) -> Any:
        body: dict[str, Any] = {"amount": amount, "phone": phone}
        if account_reference is not None:
            body["accountReference"] = account_reference
        if transaction_desc is not None:
            body["transactionDesc"] = transaction_desc
        if channel_id is not None:
            body["channelId"] = channel_id
        if callback_url is not None:
            body["callbackUrl"] = callback_url
        if credential_id is not None:
            body["credential_id"] = credential_id
        return await self._transport.request("POST", "/payments/stk", body=body)
