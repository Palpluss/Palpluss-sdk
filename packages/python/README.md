# PalPluss Python SDK

Official Python SDK for the [PalPluss](https://palpluss.com) payments API.

## Requirements

- Python >= 3.9
- `httpx` >= 0.27

## Installation

```bash
pip install palpluss
```

## Quick start

```python
from palpluss import PalPluss

client = PalPluss(api_key="pk_live_your_api_key")

# STK Push (Lipa na M-Pesa)
result = client.stk_push(
    amount=500,
    phone="254712345678",
    account_reference="ORDER-001",
)
print(result["transactionId"])  # "tx_..."
print(result["status"])         # "PENDING"
```

### Async usage

```python
import asyncio
from palpluss import AsyncPalPluss

async def main():
    async with AsyncPalPluss(api_key="pk_live_your_api_key") as client:
        result = await client.stk_push(amount=500, phone="254712345678")
        print(result["transactionId"])

asyncio.run(main())
```

## Configuration

| Parameter | Type | Default | Description |
|---|---|---|---|
| `api_key` | `str` | `PALPLUSS_API_KEY` env var | Your PalPluss API key |
| `timeout` | `float` | `30.0` | Request timeout in seconds |
| `auto_retry_on_rate_limit` | `bool` | `True` | Auto-retry on HTTP 429 |
| `max_retries` | `int` | `3` | Max retry attempts |

Set `PALPLUSS_BASE_URL` to override the API base URL (e.g. for sandbox).

## API Reference

### STK Push

```python
result = client.stk_push(
    amount=500,                         # Required: amount in KES
    phone="254712345678",               # Required: recipient phone
    account_reference="ORDER-001",      # Optional
    transaction_desc="Payment",         # Optional
    channel_id="ch_...",               # Optional
    callback_url="https://...",         # Optional
    credential_id="cred_...",           # Optional
)
```

### B2C Payout

```python
result = client.b2c_payout(
    amount=1000,
    phone="254712345678",
    reference="PAY-001",                # Optional
    description="Salary",               # Optional
    idempotency_key="my-unique-key",    # Optional — auto-generated if omitted
)
```

### Service Wallet

```python
# Get balance
balance = client.get_service_balance()
print(balance["availableBalance"])

# Topup
topup = client.service_topup(
    amount=5000,
    phone="254712345678",
    idempotency_key="topup-001",        # Optional — caller must provide for safe retry
)
```

### Transactions

```python
# Get single transaction
tx = client.get_transaction("tx_...")

# List transactions (cursor-based pagination)
page = client.list_transactions(limit=20, status="SUCCESS", type="STK")
print(page["items"])
print(page["next_cursor"])  # pass to next call, or None when exhausted

# Pagination
cursor = page["next_cursor"]
while cursor:
    page = client.list_transactions(limit=20, cursor=cursor)
    print(page["items"])
    cursor = page["next_cursor"]
```

### Payment Wallet Channels

```python
# Create
channel = client.create_channel(
    type="PAYBILL",
    shortcode="123456",
    name="Main Paybill",
)

# Update
channel = client.update_channel("ch_...", name="Updated Name")

# Delete
client.delete_channel("ch_...")
```

### Webhooks

```python
from palpluss import parse_webhook_payload

# In your webhook endpoint handler:
def webhook_handler(request_body: str):
    payload = parse_webhook_payload(request_body)
    print(payload["event_type"])           # "transaction.success"
    print(payload["transaction"]["status"]) # "SUCCESS"
```

## Error handling

```python
from palpluss import PalPluss, PalPlussApiError, RateLimitError

client = PalPluss(api_key="pk_live_...")

try:
    result = client.stk_push(amount=500, phone="bad-phone")
except RateLimitError as e:
    print(f"Rate limited, retry after {e.retry_after}s")
except PalPlussApiError as e:
    print(f"API error [{e.code}] {e.http_status}: {e}")
    print(f"Request ID: {e.request_id}")
```

### Error attributes

| Attribute | Type | Description |
|---|---|---|
| `message` | `str` | Human-readable error message |
| `code` | `str` | Machine-readable code (e.g. `INVALID_PHONE`) |
| `http_status` | `int` | HTTP status code |
| `details` | `dict` | Additional error context |
| `request_id` | `str \| None` | Trace ID for support |

`RateLimitError` additionally exposes `retry_after: int | None` (seconds).

## Context manager

```python
# Sync
with PalPluss(api_key="pk_live_...") as client:
    result = client.stk_push(amount=500, phone="254712345678")

# Async
async with AsyncPalPluss(api_key="pk_live_...") as client:
    result = await client.stk_push(amount=500, phone="254712345678")
```

Or call `.close()` / `await .close()` manually when done.

## Development

```bash
# Install with dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Type check
mypy palpluss

# Lint
ruff check palpluss
```

## Design

This SDK follows the [PalPluss SDK Design Principles](../../docs/sdk-design-principles.md):

- **Flat public API** — one obvious way to do each thing
- **Zero magic** — no hidden side effects
- **Typed** — full type annotations, TypedDict responses
- **Transport isolation** — HTTP concerns in `palpluss.http`
- **No phone normalization** — pass numbers as-is
- **No SDK-side validation** — trust the server
