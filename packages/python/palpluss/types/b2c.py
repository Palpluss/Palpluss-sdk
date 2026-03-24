from __future__ import annotations

from typing_extensions import TypedDict


class B2cPayoutResponse(TypedDict):
    transactionId: str
    tenantId: str
    channelId: str | None
    type: str
    status: str
    amount: float
    currency: str
    phone: str
    reference: str | None
    description: str | None
    providerRequestId: str | None
    providerCheckoutId: str | None
    resultCode: str | None
    resultDescription: str
    idempotencyKey: str | None
    channel: None
    createdAt: str
    updatedAt: str
