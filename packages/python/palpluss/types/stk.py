from __future__ import annotations

from typing_extensions import TypedDict


class StkInitiateResponse(TypedDict):
    transactionId: str
    tenantId: str
    channelId: str | None
    type: str
    status: str
    amount: float
    currency: str
    phone: str
    accountReference: str
    transactionDesc: str
    providerRequestId: str
    providerCheckoutId: str
    resultCode: str
    resultDescription: str
    createdAt: str
    updatedAt: str
