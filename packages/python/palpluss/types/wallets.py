from __future__ import annotations

from typing_extensions import TypedDict


class ServiceWalletBalance(TypedDict):
    walletId: str
    tenantId: str
    currency: str
    availableBalance: float
    ledgerBalance: float
    updatedAt: str


class ServiceTopupResponse(TypedDict):
    transactionId: str
    tenantId: str
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
    idempotencyKey: str | None
    createdAt: str
    updatedAt: str
