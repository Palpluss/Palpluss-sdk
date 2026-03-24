from __future__ import annotations

from typing import Literal

from typing_extensions import TypedDict

from .common import TransactionStatus, TransactionType

WebhookEventType = Literal[
    "transaction.success",
    "transaction.failed",
    "transaction.cancelled",
    "transaction.expired",
    "transaction.updated",
]


class WebhookTransaction(TypedDict):
    id: str
    tenant_id: str
    type: TransactionType
    status: TransactionStatus
    amount: float
    currency: str
    phone_number: str
    external_reference: str | None
    provider: str
    provider_request_id: str | None
    provider_checkout_id: str | None
    result_code: str | None
    result_desc: str | None
    mpesa_receipt: str | None
    created_at: str
    updated_at: str


class WebhookPayload(TypedDict):
    event: str
    event_type: WebhookEventType
    transaction: WebhookTransaction
