"""Tests for the PalPluss sync and async clients."""
from __future__ import annotations

import base64
import os
import re

import pytest
import pytest_asyncio

from palpluss import AsyncPalPluss, PalPluss, PalPlussApiError, RateLimitError

# ── Fixtures ──────────────────────────────────────────────────────────────────

STK_RESPONSE = {
    "transactionId": "tx-stk-001",
    "tenantId": "tenant-001",
    "channelId": None,
    "type": "STK",
    "status": "PENDING",
    "amount": 500,
    "currency": "KES",
    "phone": "254712345678",
    "accountReference": "ORDER-001",
    "transactionDesc": "Payment",
    "providerRequestId": "pr-001",
    "providerCheckoutId": "pc-001",
    "resultCode": "0",
    "resultDescription": "Success",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
}

API_KEY = "pk_test_123"
EXPECTED_AUTH = "Basic " + base64.b64encode(f"{API_KEY}:".encode()).decode()

# ── Constructor tests ─────────────────────────────────────────────────────────


def test_raises_without_api_key(monkeypatch):
    monkeypatch.delenv("PALPLUSS_API_KEY", raising=False)
    with pytest.raises(ValueError, match="api_key is required"):
        PalPluss()


def test_reads_api_key_from_env(monkeypatch):
    monkeypatch.setenv("PALPLUSS_API_KEY", "pk_env_key")
    client = PalPluss()
    client.close()


def test_accepts_api_key_in_constructor():
    client = PalPluss(api_key=API_KEY)
    client.close()


def test_async_raises_without_api_key(monkeypatch):
    monkeypatch.delenv("PALPLUSS_API_KEY", raising=False)
    with pytest.raises(ValueError, match="api_key is required"):
        AsyncPalPluss()


# ── Auth header ───────────────────────────────────────────────────────────────


def test_auth_header_encoding(httpx_mock):
    httpx_mock.add_response(
        json={"success": True, "data": {"items": [], "next_cursor": None}, "requestId": "req-1"}
    )
    client = PalPluss(api_key=API_KEY)
    client.list_transactions()
    request = httpx_mock.get_request()
    assert request.headers["Authorization"] == EXPECTED_AUTH
    client.close()


# ── Flat sync methods ─────────────────────────────────────────────────────────


def test_stk_push(httpx_mock):
    httpx_mock.add_response(
        json={"success": True, "data": STK_RESPONSE, "requestId": "req-1"}
    )
    client = PalPluss(api_key=API_KEY)
    result = client.stk_push(amount=500, phone="254712345678")
    request = httpx_mock.get_request()
    assert "/payments/stk" in str(request.url)
    assert request.method == "POST"
    assert result["transactionId"] == "tx-stk-001"
    assert result["status"] == "PENDING"
    client.close()


def test_b2c_payout_auto_idempotency_key(httpx_mock):
    httpx_mock.add_response(
        json={
            "success": True,
            "data": {"transactionId": "tx-b2c-001", "type": "B2C", "status": "PENDING"},
            "requestId": "req-1",
        }
    )
    client = PalPluss(api_key=API_KEY)
    client.b2c_payout(amount=1000, phone="254712345678")
    request = httpx_mock.get_request()
    assert "/b2c/payouts" in str(request.url)
    assert request.method == "POST"
    idempotency_key = request.headers.get("Idempotency-Key")
    assert idempotency_key is not None
    uuid_pattern = re.compile(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    )
    assert uuid_pattern.match(idempotency_key)
    client.close()


def test_b2c_payout_custom_idempotency_key(httpx_mock):
    httpx_mock.add_response(
        json={
            "success": True,
            "data": {"transactionId": "tx-b2c-002", "type": "B2C", "status": "PENDING"},
            "requestId": "req-1",
        }
    )
    client = PalPluss(api_key=API_KEY)
    client.b2c_payout(amount=1000, phone="254712345678", idempotency_key="my-key-001")
    request = httpx_mock.get_request()
    assert request.headers.get("Idempotency-Key") == "my-key-001"
    client.close()


def test_get_service_balance(httpx_mock):
    httpx_mock.add_response(
        json={
            "success": True,
            "data": {"walletId": "wal-1", "availableBalance": 5000, "currency": "KES"},
            "requestId": "req-1",
        }
    )
    client = PalPluss(api_key=API_KEY)
    result = client.get_service_balance()
    request = httpx_mock.get_request()
    assert "/wallets/service/balance" in str(request.url)
    assert request.method == "GET"
    assert result["availableBalance"] == 5000
    client.close()


def test_service_topup(httpx_mock):
    httpx_mock.add_response(
        json={
            "success": True,
            "data": {"transactionId": "tx-topup-001", "type": "WALLET_TOPUP_SERVICE_TOKENS", "status": "PENDING"},
            "requestId": "req-1",
        }
    )
    client = PalPluss(api_key=API_KEY)
    client.service_topup(amount=5000, phone="254712345678")
    request = httpx_mock.get_request()
    assert "/wallets/service/topups" in str(request.url)
    assert request.method == "POST"
    client.close()


def test_get_transaction(httpx_mock):
    httpx_mock.add_response(
        json={
            "success": True,
            "data": {"transaction_id": "tx-001", "status": "SUCCESS", "type": "STK"},
            "requestId": "req-1",
        }
    )
    client = PalPluss(api_key=API_KEY)
    client.get_transaction("tx-001")
    request = httpx_mock.get_request()
    assert "/transactions/tx-001" in str(request.url)
    client.close()


def test_list_transactions_with_query_params(httpx_mock):
    httpx_mock.add_response(
        json={
            "success": True,
            "data": {"items": [], "next_cursor": None},
            "requestId": "req-1",
        }
    )
    client = PalPluss(api_key=API_KEY)
    result = client.list_transactions(limit=10, status="SUCCESS")
    request = httpx_mock.get_request()
    assert "/transactions" in str(request.url)
    assert "limit=10" in str(request.url)
    assert "status=SUCCESS" in str(request.url)
    assert result["next_cursor"] is None
    client.close()


def test_create_channel(httpx_mock):
    httpx_mock.add_response(
        json={
            "success": True,
            "data": {"id": "ch-001", "type": "PAYBILL", "category": "PAYMENT_WALLET"},
            "requestId": "req-1",
        }
    )
    client = PalPluss(api_key=API_KEY)
    client.create_channel(type="PAYBILL", shortcode="123456", name="My Paybill")
    request = httpx_mock.get_request()
    assert "/payment-wallet/channels" in str(request.url)
    assert request.method == "POST"
    client.close()


def test_update_channel(httpx_mock):
    httpx_mock.add_response(
        json={
            "success": True,
            "data": {"id": "ch-001", "name": "New Name", "category": "PAYMENT_WALLET"},
            "requestId": "req-1",
        }
    )
    client = PalPluss(api_key=API_KEY)
    client.update_channel("ch-001", name="New Name")
    request = httpx_mock.get_request()
    assert "/payment-wallet/channels/ch-001" in str(request.url)
    assert request.method == "PATCH"
    client.close()


def test_delete_channel_returns_none(httpx_mock):
    httpx_mock.add_response(status_code=204)
    client = PalPluss(api_key=API_KEY)
    result = client.delete_channel("ch-001")
    request = httpx_mock.get_request()
    assert "/payment-wallet/channels/ch-001" in str(request.url)
    assert request.method == "DELETE"
    assert result is None
    client.close()


# ── Error handling ────────────────────────────────────────────────────────────


def test_raises_api_error_on_4xx(httpx_mock):
    httpx_mock.add_response(
        status_code=400,
        json={
            "success": False,
            "error": {"message": "Invalid phone", "code": "INVALID_PHONE", "details": {}},
            "requestId": "req-err",
        },
    )
    client = PalPluss(api_key=API_KEY)
    with pytest.raises(PalPlussApiError) as exc_info:
        client.stk_push(amount=100, phone="bad")
    err = exc_info.value
    assert err.code == "INVALID_PHONE"
    assert err.http_status == 400
    assert err.request_id == "req-err"
    client.close()


def test_raises_rate_limit_error_on_429(httpx_mock):
    httpx_mock.add_response(
        status_code=429,
        headers={"Retry-After": "5"},
        json={
            "success": False,
            "error": {"message": "Rate limited", "code": "RATE_LIMIT_EXCEEDED", "details": {}},
            "requestId": "req-rl",
        },
    )
    # Disable auto-retry so we get the error immediately
    client = PalPluss(api_key=API_KEY, auto_retry_on_rate_limit=False)
    with pytest.raises(RateLimitError) as exc_info:
        client.stk_push(amount=100, phone="254712345678")
    err = exc_info.value
    assert err.http_status == 429
    assert err.retry_after == 5
    client.close()


# ── Default base URL ──────────────────────────────────────────────────────────


def test_default_base_url(httpx_mock, monkeypatch):
    monkeypatch.delenv("PALPLUSS_BASE_URL", raising=False)
    httpx_mock.add_response(
        json={"success": True, "data": {"items": [], "next_cursor": None}, "requestId": "req-1"}
    )
    client = PalPluss(api_key=API_KEY)
    client.list_transactions()
    request = httpx_mock.get_request()
    assert "api.palpluss.com/v1" in str(request.url)
    client.close()


def test_base_url_from_env(httpx_mock, monkeypatch):
    monkeypatch.setenv("PALPLUSS_BASE_URL", "https://sandbox.palpluss.com/v1")
    httpx_mock.add_response(
        json={"success": True, "data": {"items": [], "next_cursor": None}, "requestId": "req-1"}
    )
    client = PalPluss(api_key=API_KEY)
    client.list_transactions()
    request = httpx_mock.get_request()
    assert "sandbox.palpluss.com/v1" in str(request.url)
    client.close()


# ── Async client ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_async_stk_push(httpx_mock):
    httpx_mock.add_response(
        json={"success": True, "data": STK_RESPONSE, "requestId": "req-1"}
    )
    async with AsyncPalPluss(api_key=API_KEY) as client:
        result = await client.stk_push(amount=500, phone="254712345678")
    request = httpx_mock.get_request()
    assert "/payments/stk" in str(request.url)
    assert result["transactionId"] == "tx-stk-001"


@pytest.mark.asyncio
async def test_async_b2c_payout_auto_idempotency(httpx_mock):
    httpx_mock.add_response(
        json={
            "success": True,
            "data": {"transactionId": "tx-b2c-001", "type": "B2C", "status": "PENDING"},
            "requestId": "req-1",
        }
    )
    async with AsyncPalPluss(api_key=API_KEY) as client:
        await client.b2c_payout(amount=1000, phone="254712345678")
    request = httpx_mock.get_request()
    assert request.headers.get("Idempotency-Key") is not None


@pytest.mark.asyncio
async def test_async_delete_channel_returns_none(httpx_mock):
    httpx_mock.add_response(status_code=204)
    async with AsyncPalPluss(api_key=API_KEY) as client:
        result = await client.delete_channel("ch-001")
    assert result is None


@pytest.mark.asyncio
async def test_async_raises_api_error(httpx_mock):
    httpx_mock.add_response(
        status_code=422,
        json={
            "success": False,
            "error": {"message": "Unprocessable", "code": "UNPROCESSABLE", "details": {}},
            "requestId": "req-422",
        },
    )
    async with AsyncPalPluss(api_key=API_KEY) as client:
        with pytest.raises(PalPlussApiError) as exc_info:
            await client.stk_push(amount=0, phone="254712345678")
    assert exc_info.value.http_status == 422
