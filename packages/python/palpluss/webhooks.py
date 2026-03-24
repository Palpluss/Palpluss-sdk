from __future__ import annotations

import json
from typing import Any

from .types.webhooks import WebhookPayload

_VALID_EVENT_TYPES = {
    "transaction.success",
    "transaction.failed",
    "transaction.cancelled",
    "transaction.expired",
    "transaction.updated",
}


def parse_webhook_payload(raw: str) -> WebhookPayload:
    """Parse and validate a raw webhook payload string into a typed WebhookPayload.

    Args:
        raw: The raw JSON string from the webhook request body.

    Returns:
        The parsed WebhookPayload dict.

    Raises:
        ValueError: If the payload is invalid or missing required fields.
    """
    try:
        parsed: Any = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid JSON in webhook payload") from exc

    if not isinstance(parsed, dict):
        raise ValueError("Webhook payload must be a JSON object")

    if parsed.get("event") != "transaction.updated":
        raise ValueError(f"Unexpected webhook event: {parsed.get('event')!r}")

    event_type = parsed.get("event_type")
    if not isinstance(event_type, str):
        raise ValueError("Webhook payload missing event_type")

    if event_type not in _VALID_EVENT_TYPES:
        raise ValueError(f"Unknown event_type: {event_type!r}")

    transaction = parsed.get("transaction")
    if not isinstance(transaction, dict):
        raise ValueError("Webhook payload missing transaction object")

    if not isinstance(transaction.get("id"), str):
        raise ValueError("Webhook transaction missing id")

    if not isinstance(transaction.get("status"), str):
        raise ValueError("Webhook transaction missing status")

    return parsed  # type: ignore[return-value]
