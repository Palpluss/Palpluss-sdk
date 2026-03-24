"""Tests for parse_webhook_payload."""
from __future__ import annotations

import json

import pytest

from palpluss import parse_webhook_payload

VALID_PAYLOAD = {
    "event": "transaction.updated",
    "event_type": "transaction.success",
    "transaction": {
        "id": "tx-001",
        "tenant_id": "tenant-001",
        "type": "STK",
        "status": "SUCCESS",
        "amount": 500,
        "currency": "KES",
        "phone_number": "254712345678",
        "external_reference": None,
        "provider": "mpesa",
        "provider_request_id": "pr-001",
        "provider_checkout_id": "pc-001",
        "result_code": "0",
        "result_desc": "The service request is processed successfully.",
        "mpesa_receipt": "RHF7GHJ9KL",
        "created_at": "2024-01-01T00:00:00.000Z",
        "updated_at": "2024-01-01T00:00:00.000Z",
    },
}


def test_valid_payload():
    payload = parse_webhook_payload(json.dumps(VALID_PAYLOAD))
    assert payload["event"] == "transaction.updated"
    assert payload["event_type"] == "transaction.success"
    assert payload["transaction"]["id"] == "tx-001"
    assert payload["transaction"]["status"] == "SUCCESS"


def test_all_valid_event_types():
    for event_type in [
        "transaction.success",
        "transaction.failed",
        "transaction.cancelled",
        "transaction.expired",
        "transaction.updated",
    ]:
        raw = json.dumps({**VALID_PAYLOAD, "event_type": event_type})
        payload = parse_webhook_payload(raw)
        assert payload["event_type"] == event_type


def test_invalid_json_raises():
    with pytest.raises(ValueError, match="Invalid JSON"):
        parse_webhook_payload("not-json")


def test_non_object_raises():
    with pytest.raises(ValueError, match="JSON object"):
        parse_webhook_payload('"just a string"')


def test_unexpected_event_raises():
    data = {**VALID_PAYLOAD, "event": "some.other.event"}
    with pytest.raises(ValueError, match="Unexpected webhook event"):
        parse_webhook_payload(json.dumps(data))


def test_missing_event_type_raises():
    data = {k: v for k, v in VALID_PAYLOAD.items() if k != "event_type"}
    with pytest.raises(ValueError, match="missing event_type"):
        parse_webhook_payload(json.dumps(data))


def test_unknown_event_type_raises():
    data = {**VALID_PAYLOAD, "event_type": "unknown.event"}
    with pytest.raises(ValueError, match="Unknown event_type"):
        parse_webhook_payload(json.dumps(data))


def test_missing_transaction_raises():
    data = {k: v for k, v in VALID_PAYLOAD.items() if k != "transaction"}
    with pytest.raises(ValueError, match="missing transaction"):
        parse_webhook_payload(json.dumps(data))


def test_transaction_missing_id_raises():
    data = {
        **VALID_PAYLOAD,
        "transaction": {k: v for k, v in VALID_PAYLOAD["transaction"].items() if k != "id"},
    }
    with pytest.raises(ValueError, match="missing id"):
        parse_webhook_payload(json.dumps(data))


def test_transaction_missing_status_raises():
    data = {
        **VALID_PAYLOAD,
        "transaction": {k: v for k, v in VALID_PAYLOAD["transaction"].items() if k != "status"},
    }
    with pytest.raises(ValueError, match="missing status"):
        parse_webhook_payload(json.dumps(data))
