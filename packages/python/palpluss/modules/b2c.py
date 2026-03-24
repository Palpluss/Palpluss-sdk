from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from ..http.transport import AsyncHttpTransport, HttpTransport


class B2cModule:
    def __init__(self, transport: HttpTransport) -> None:
        self._transport = transport

    def payout(
        self,
        *,
        amount: float,
        phone: str,
        currency: str | None = None,
        reference: str | None = None,
        description: str | None = None,
        channel_id: str | None = None,
        credential_id: str | None = None,
        callback_url: str | None = None,
        idempotency_key: str | None = None,
    ) -> Any:
        key = idempotency_key or str(uuid.uuid4())
        body: dict[str, Any] = {"amount": amount, "phone": phone}
        if currency is not None:
            body["currency"] = currency
        if reference is not None:
            body["reference"] = reference
        if description is not None:
            body["description"] = description
        if channel_id is not None:
            body["channelId"] = channel_id
        if credential_id is not None:
            body["credential_id"] = credential_id
        if callback_url is not None:
            body["callback_url"] = callback_url
        return self._transport.request("POST", "/b2c/payouts", body=body, idempotency_key=key)


class AsyncB2cModule:
    def __init__(self, transport: AsyncHttpTransport) -> None:
        self._transport = transport

    async def payout(
        self,
        *,
        amount: float,
        phone: str,
        currency: str | None = None,
        reference: str | None = None,
        description: str | None = None,
        channel_id: str | None = None,
        credential_id: str | None = None,
        callback_url: str | None = None,
        idempotency_key: str | None = None,
    ) -> Any:
        key = idempotency_key or str(uuid.uuid4())
        body: dict[str, Any] = {"amount": amount, "phone": phone}
        if currency is not None:
            body["currency"] = currency
        if reference is not None:
            body["reference"] = reference
        if description is not None:
            body["description"] = description
        if channel_id is not None:
            body["channelId"] = channel_id
        if credential_id is not None:
            body["credential_id"] = credential_id
        if callback_url is not None:
            body["callback_url"] = callback_url
        return await self._transport.request("POST", "/b2c/payouts", body=body, idempotency_key=key)
