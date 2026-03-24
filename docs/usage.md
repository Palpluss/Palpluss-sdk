# PalPluss SDK — Usage Guide

Complete usage reference for all PalPluss SDKs: TypeScript, Python, PHP, and Go.

Every SDK covers the same API surface with idiomatic naming conventions for each language. All examples use the same request parameters so you can compare implementations side by side.

---

## Table of Contents

1. [Installation](#1-installation)
2. [Client Initialisation](#2-client-initialisation)
3. [STK Push](#3-stk-push)
4. [B2C Payout](#4-b2c-payout)
5. [Service Wallet](#5-service-wallet)
6. [Transactions](#6-transactions)
7. [Payment Wallet Channels](#7-payment-wallet-channels)
8. [Webhooks](#8-webhooks)
9. [Error Handling](#9-error-handling)
10. [Rate Limiting and Retries](#10-rate-limiting-and-retries)

---

## 1. Installation

**TypeScript / Node.js**
```bash
npm install @palpluss/sdk
# or
pnpm add @palpluss/sdk
# or
yarn add @palpluss/sdk
```

**Python**
```bash
pip install palpluss
```

**PHP**
```bash
composer require palpluss/sdk
```

**Go**
```bash
go get github.com/palpluss/palpluss-go
```

---

## 2. Client Initialisation

The API key can be passed directly or read from the `PALPLUSS_API_KEY` environment variable. All other parameters are optional.

| Parameter | Default | Description |
|---|---|---|
| `apiKey` | `PALPLUSS_API_KEY` env var | Your PalPluss API key (`pk_live_...` or `pk_test_...`) |
| `timeout` | `30s` | Request timeout |
| `autoRetryOnRateLimit` | `true` | Automatically retry on HTTP 429 |
| `maxRetries` | `3` | Maximum retry attempts |

Set `PALPLUSS_BASE_URL` to point to a different environment (e.g. sandbox).

**TypeScript**
```typescript
import { PalPluss } from '@palpluss/sdk';

// Explicit key
const client = new PalPluss({ apiKey: 'pk_live_...' });

// From environment variable
const client = new PalPluss();

// With all options
const client = new PalPluss({
  apiKey: 'pk_live_...',
  timeout: 60_000,              // milliseconds
  autoRetryOnRateLimit: true,
  maxRetries: 5,
});
```

**Python**
```python
from palpluss import PalPluss, AsyncPalPluss

# Explicit key
client = PalPluss(api_key="pk_live_...")

# From environment variable
client = PalPluss()

# With all options
client = PalPluss(
    api_key="pk_live_...",
    timeout=60.0,               # seconds
    auto_retry_on_rate_limit=True,
    max_retries=5,
)

# Async variant — same options
async_client = AsyncPalPluss(api_key="pk_live_...")
```

**PHP**
```php
use PalPluss\PalPluss;

// Explicit key
$client = new PalPluss(apiKey: 'pk_live_...');

// From environment variable
$client = new PalPluss();

// With all options
$client = new PalPluss(
    apiKey: 'pk_live_...',
    timeout: 60.0,
    autoRetryOnRateLimit: true,
    maxRetries: 5,
);
```

**Go**
```go
import palpluss "github.com/palpluss/palpluss-go"

// Explicit key
client, err := palpluss.New("pk_live_...")

// From environment variable (pass empty string)
client, err := palpluss.New("")

// With all options
client, err := palpluss.New(
    "pk_live_...",
    palpluss.WithTimeout(60 * time.Second),
    palpluss.WithAutoRetryOnRateLimit(true),
    palpluss.WithMaxRetries(5),
)
if err != nil {
    log.Fatal(err)
}
```

### Resource management

Close the underlying HTTP connection pool when the client is no longer needed.

**TypeScript**
```typescript
// Using a context manager pattern (recommended for scripts)
// TypeScript client does not require explicit close for server use.
// For short-lived scripts:
const client = new PalPluss({ apiKey: 'pk_live_...' });
try {
  // ... use client
} finally {
  client.close();
}
```

**Python**
```python
# Context manager (recommended)
with PalPluss(api_key="pk_live_...") as client:
    result = client.stk_push(amount=500, phone="254712345678")

# Async context manager
async with AsyncPalPluss(api_key="pk_live_...") as client:
    result = await client.stk_push(amount=500, phone="254712345678")

# Manual close
client = PalPluss(api_key="pk_live_...")
try:
    result = client.stk_push(amount=500, phone="254712345678")
finally:
    client.close()
```

**PHP**
```php
// PHP GC handles connection cleanup automatically.
// For explicit cleanup:
$client->close();
```

**Go**
```go
// Go's net/http transport manages connection reuse automatically.
// No explicit close needed for long-running services.
```

---

## 3. STK Push

Initiates a Lipa na M-Pesa (STK Push) payment request. The customer receives a payment prompt on their phone.

**Parameters**

| Parameter | Required | Description |
|---|---|---|
| `amount` | Yes | Amount in KES |
| `phone` | Yes | Customer phone number (e.g. `254712345678`) |
| `accountReference` | No | Reference shown to the customer |
| `transactionDesc` | No | Description shown in the payment prompt |
| `channelId` | No | Payment channel ID to use |
| `callbackUrl` | No | Webhook URL for payment status updates |
| `credentialId` | No | Credential ID override |

**TypeScript**
```typescript
const result = await client.stkPush({
  amount: 500,
  phone: '254712345678',
  accountReference: 'ORDER-001',
  transactionDesc: 'Payment for order #001',
  callbackUrl: 'https://yourapp.com/webhooks/palpluss',
});

console.log(result.transactionId);  // "tx_01j8..."
console.log(result.status);         // "PENDING"
```

**Python (sync)**
```python
result = client.stk_push(
    amount=500,
    phone="254712345678",
    account_reference="ORDER-001",
    transaction_desc="Payment for order #001",
    callback_url="https://yourapp.com/webhooks/palpluss",
)

print(result["transactionId"])  # "tx_01j8..."
print(result["status"])         # "PENDING"
```

**Python (async)**
```python
async with AsyncPalPluss(api_key="pk_live_...") as client:
    result = await client.stk_push(
        amount=500,
        phone="254712345678",
        account_reference="ORDER-001",
        transaction_desc="Payment for order #001",
    )
    print(result["transactionId"])
```

**PHP**
```php
$result = $client->stkPush(
    amount: 500,
    phone: '254712345678',
    accountReference: 'ORDER-001',
    transactionDesc: 'Payment for order #001',
    callbackUrl: 'https://yourapp.com/webhooks/palpluss',
);

echo $result['transactionId'];  // "tx_01j8..."
echo $result['status'];         // "PENDING"
```

**Go**
```go
accountRef := "ORDER-001"
desc := "Payment for order #001"

result, err := client.StkPush(ctx, palpluss.StkPushParams{
    Amount:           500,
    Phone:            "254712345678",
    AccountReference: &accountRef,
    TransactionDesc:  &desc,
})
if err != nil {
    log.Fatal(err)
}

fmt.Println(result.TransactionID) // "tx_01j8..."
fmt.Println(result.Status)        // "PENDING"
```

**Response**
```json
{
  "transactionId": "tx_01j8abc123",
  "tenantId": "ten_xyz",
  "channelId": "ch_abc",
  "type": "STK",
  "status": "PENDING",
  "amount": 500,
  "currency": "KES",
  "phone": "254712345678",
  "accountReference": "ORDER-001",
  "transactionDesc": "Payment for order #001",
  "providerRequestId": "ws_CO_...",
  "providerCheckoutId": "ws_CO_...",
  "resultCode": "",
  "resultDescription": "",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Status values**: `PENDING` → `PROCESSING` → `SUCCESS` | `FAILED` | `CANCELLED` | `EXPIRED`

The initial response is always `PENDING`. Use [webhooks](#8-webhooks) or [poll the transaction](#6-transactions) to track the final status.

---

## 4. B2C Payout

Sends a Business-to-Customer payout directly to a phone number.

An idempotency key is auto-generated (UUID v4) if you do not provide one. Supply your own key to safely retry a payout without risking a duplicate payment.

**Parameters**

| Parameter | Required | Description |
|---|---|---|
| `amount` | Yes | Amount in KES |
| `phone` | Yes | Recipient phone number |
| `currency` | No | Currency code (default: `KES`) |
| `reference` | No | Your internal reference |
| `description` | No | Payout description |
| `channelId` | No | Payment channel ID |
| `credentialId` | No | Credential ID override |
| `callbackUrl` | No | Webhook URL for status updates |
| `idempotencyKey` | No | Unique key for safe retries — auto-generated if omitted |

**TypeScript**
```typescript
const result = await client.b2cPayout({
  amount: 1000,
  phone: '254712345678',
  reference: 'SALARY-JAN-EMP001',
  description: 'January salary',
  idempotencyKey: 'salary-jan-2025-emp001',  // stable key for safe retry
});

console.log(result.transactionId);  // "tx_01j9..."
console.log(result.status);         // "PENDING"
```

**Python**
```python
result = client.b2c_payout(
    amount=1000,
    phone="254712345678",
    reference="SALARY-JAN-EMP001",
    description="January salary",
    idempotency_key="salary-jan-2025-emp001",
)

print(result["transactionId"])
print(result["status"])  # "PENDING"
```

**PHP**
```php
$result = $client->b2cPayout(
    amount: 1000,
    phone: '254712345678',
    reference: 'SALARY-JAN-EMP001',
    description: 'January salary',
    idempotencyKey: 'salary-jan-2025-emp001',
);

echo $result['transactionId'];
echo $result['status'];  // "PENDING"
```

**Go**
```go
ref := "SALARY-JAN-EMP001"
desc := "January salary"
ikey := "salary-jan-2025-emp001"

result, err := client.B2cPayout(ctx, palpluss.B2cPayoutParams{
    Amount:         1000,
    Phone:          "254712345678",
    Reference:      &ref,
    Description:    &desc,
    IdempotencyKey: &ikey,
})
if err != nil {
    log.Fatal(err)
}

fmt.Println(result.TransactionID)
fmt.Println(result.Status)  // "PENDING"
```

**Response**
```json
{
  "transactionId": "tx_01j9def456",
  "tenantId": "ten_xyz",
  "channelId": null,
  "type": "B2C",
  "status": "PENDING",
  "amount": 1000,
  "currency": "KES",
  "phone": "254712345678",
  "reference": "SALARY-JAN-EMP001",
  "description": "January salary",
  "providerRequestId": null,
  "providerCheckoutId": null,
  "resultCode": null,
  "resultDescription": "",
  "idempotencyKey": "salary-jan-2025-emp001",
  "createdAt": "2025-01-15T11:00:00.000Z",
  "updatedAt": "2025-01-15T11:00:00.000Z"
}
```

---

## 5. Service Wallet

Manage the service wallet that funds B2C payouts.

### Get balance

**TypeScript**
```typescript
const balance = await client.getServiceBalance();

console.log(balance.availableBalance);  // 45000
console.log(balance.ledgerBalance);     // 47500
console.log(balance.currency);          // "KES"
```

**Python**
```python
balance = client.get_service_balance()

print(balance["availableBalance"])  # 45000.0
print(balance["ledgerBalance"])     # 47500.0
print(balance["currency"])          # "KES"
```

**PHP**
```php
$balance = $client->getServiceBalance();

echo $balance['availableBalance'];  // 45000
echo $balance['currency'];          // "KES"
```

**Go**
```go
balance, err := client.GetServiceBalance(ctx)
if err != nil {
    log.Fatal(err)
}

fmt.Println(balance.AvailableBalance)  // 45000
fmt.Println(balance.Currency)          // "KES"
```

**Response**
```json
{
  "walletId": "wal_abc123",
  "tenantId": "ten_xyz",
  "currency": "KES",
  "availableBalance": 45000,
  "ledgerBalance": 47500,
  "updatedAt": "2025-01-15T09:00:00.000Z"
}
```

### Top up service wallet

Initiates an STK Push to the specified phone number to top up the service wallet.

**Parameters**

| Parameter | Required | Description |
|---|---|---|
| `amount` | Yes | Top-up amount in KES |
| `phone` | Yes | Phone number to charge |
| `accountReference` | No | Reference label |
| `transactionDesc` | No | Description |
| `idempotencyKey` | No | Unique key for safe retries |

**TypeScript**
```typescript
const topup = await client.serviceTopup({
  amount: 10000,
  phone: '254712345678',
  accountReference: 'TOPUP-JAN-2025',
  idempotencyKey: 'wallet-topup-jan-2025-001',
});

console.log(topup.transactionId);
console.log(topup.status);  // "PENDING"
```

**Python**
```python
topup = client.service_topup(
    amount=10000,
    phone="254712345678",
    account_reference="TOPUP-JAN-2025",
    idempotency_key="wallet-topup-jan-2025-001",
)

print(topup["transactionId"])
print(topup["status"])  # "PENDING"
```

**PHP**
```php
$topup = $client->serviceTopup(
    amount: 10000,
    phone: '254712345678',
    accountReference: 'TOPUP-JAN-2025',
    idempotencyKey: 'wallet-topup-jan-2025-001',
);

echo $topup['transactionId'];
echo $topup['status'];  // "PENDING"
```

**Go**
```go
ref := "TOPUP-JAN-2025"
ikey := "wallet-topup-jan-2025-001"

topup, err := client.ServiceTopup(ctx, palpluss.ServiceTopupParams{
    Amount:           10000,
    Phone:            "254712345678",
    AccountReference: &ref,
    IdempotencyKey:   &ikey,
})
if err != nil {
    log.Fatal(err)
}

fmt.Println(topup.TransactionID)
fmt.Println(topup.Status)  // "PENDING"
```

**Response**
```json
{
  "transactionId": "tx_01jabc789",
  "tenantId": "ten_xyz",
  "type": "WALLET_TOPUP_SERVICE_TOKENS",
  "status": "PENDING",
  "amount": 10000,
  "currency": "KES",
  "phone": "254712345678",
  "accountReference": "TOPUP-JAN-2025",
  "transactionDesc": "",
  "providerRequestId": "ws_CO_...",
  "providerCheckoutId": "ws_CO_...",
  "resultCode": "",
  "resultDescription": "",
  "idempotencyKey": "wallet-topup-jan-2025-001",
  "createdAt": "2025-01-15T12:00:00.000Z",
  "updatedAt": "2025-01-15T12:00:00.000Z"
}
```

---

## 6. Transactions

### Get a single transaction

**TypeScript**
```typescript
const tx = await client.getTransaction('tx_01j8abc123');

console.log(tx.transactionId);  // "tx_01j8abc123"
console.log(tx.status);         // "SUCCESS"
console.log(tx.amount);         // 500
```

**Python**
```python
tx = client.get_transaction("tx_01j8abc123")

print(tx["transaction_id"])  # "tx_01j8abc123"
print(tx["status"])          # "SUCCESS"
print(tx["amount"])          # 500.0
```

**PHP**
```php
$tx = $client->getTransaction('tx_01j8abc123');

echo $tx['transaction_id'];  // "tx_01j8abc123"
echo $tx['status'];          // "SUCCESS"
echo $tx['amount'];          // 500
```

**Go**
```go
tx, err := client.GetTransaction(ctx, "tx_01j8abc123")
if err != nil {
    log.Fatal(err)
}

fmt.Println(tx.TransactionID)  // "tx_01j8abc123"
fmt.Println(tx.Status)         // "SUCCESS"
fmt.Println(tx.Amount)         // 500
```

**Response**
```json
{
  "transaction_id": "tx_01j8abc123",
  "tenant_id": "ten_xyz",
  "type": "STK",
  "status": "SUCCESS",
  "amount": 500,
  "currency": "KES",
  "phone_number": "254712345678",
  "channel_id": "ch_abc",
  "external_reference": "ORDER-001",
  "customer_name": "John Doe",
  "callback_url": "https://yourapp.com/webhooks/palpluss",
  "provider": "MPESA",
  "provider_request_id": "ws_CO_...",
  "provider_checkout_id": "ws_CO_...",
  "result_code": "0",
  "result_desc": "The service request is processed successfully.",
  "created_at": "2025-01-15T10:30:00.000Z",
  "updated_at": "2025-01-15T10:31:45.000Z"
}
```

### List transactions

Returns a paginated list of transactions. All filter parameters are optional.

**Parameters**

| Parameter | Description |
|---|---|
| `limit` | Number of results per page (max 100) |
| `cursor` | Pagination cursor from a previous response |
| `status` | Filter by status: `PENDING`, `PROCESSING`, `SUCCESS`, `FAILED`, `CANCELLED`, `EXPIRED`, `REVERSED` |
| `type` | Filter by type: `STK` or `B2C` |

**TypeScript**
```typescript
const page = await client.listTransactions({
  limit: 20,
  status: 'SUCCESS',
  type: 'STK',
});

console.log(page.items.length);   // up to 20
console.log(page.nextCursor);     // "cursor_xyz" or null
```

**Python**
```python
page = client.list_transactions(
    limit=20,
    status="SUCCESS",
    type="STK",
)

print(len(page["items"]))    # up to 20
print(page["next_cursor"])   # "cursor_xyz" or None
```

**PHP**
```php
$page = $client->listTransactions(
    limit: 20,
    status: 'SUCCESS',
    type: 'STK',
);

echo count($page['items']);   // up to 20
echo $page['next_cursor'];    // "cursor_xyz" or null
```

**Go**
```go
limit := 20
status := "SUCCESS"
txType := "STK"

page, err := client.ListTransactions(ctx, palpluss.ListTransactionsParams{
    Limit:  &limit,
    Status: &status,
    Type:   &txType,
})
if err != nil {
    log.Fatal(err)
}

fmt.Println(len(page.Items))  // up to 20
// page.NextCursor is *string — nil when there are no more pages
```

**Response**
```json
{
  "items": [
    {
      "transaction_id": "tx_01j8abc123",
      "tenant_id": "ten_xyz",
      "type": "STK",
      "status": "SUCCESS",
      "amount": 500,
      "currency": "KES",
      "phone_number": "254712345678",
      "channel_id": "ch_abc",
      "external_reference": "ORDER-001",
      "customer_name": "John Doe",
      "callback_url": null,
      "provider": "MPESA",
      "provider_request_id": "ws_CO_...",
      "provider_checkout_id": "ws_CO_...",
      "result_code": "0",
      "result_desc": "The service request is processed successfully.",
      "created_at": "2025-01-15T10:30:00.000Z",
      "updated_at": "2025-01-15T10:31:45.000Z"
    }
  ],
  "next_cursor": "cursor_01j8xyz"
}
```

### Pagination

Pass `next_cursor` from each response into the next call to walk through all pages. The cursor is `null` / `nil` / `None` when you have reached the last page.

**TypeScript**
```typescript
let cursor: string | null = null;

do {
  const page = await client.listTransactions({ limit: 100, cursor });
  for (const tx of page.items) {
    console.log(tx.transactionId, tx.status);
  }
  cursor = page.nextCursor ?? null;
} while (cursor !== null);
```

**Python**
```python
cursor = None

while True:
    page = client.list_transactions(limit=100, cursor=cursor)
    for tx in page["items"]:
        print(tx["transaction_id"], tx["status"])
    cursor = page["next_cursor"]
    if cursor is None:
        break
```

**PHP**
```php
$cursor = null;

do {
    $page = $client->listTransactions(limit: 100, cursor: $cursor);
    foreach ($page['items'] as $tx) {
        echo $tx['transaction_id'] . ' ' . $tx['status'] . "\n";
    }
    $cursor = $page['next_cursor'] ?? null;
} while ($cursor !== null);
```

**Go**
```go
var cursor *string

for {
    page, err := client.ListTransactions(ctx, palpluss.ListTransactionsParams{
        Limit:  palpluss.Ptr(100),
        Cursor: cursor,
    })
    if err != nil {
        log.Fatal(err)
    }
    for _, tx := range page.Items {
        fmt.Println(tx.TransactionID, tx.Status)
    }
    cursor = page.NextCursor
    if cursor == nil {
        break
    }
}
```

---

## 7. Payment Wallet Channels

Payment wallet channels define the M-Pesa shortcodes, paybills, or till numbers that STK Push and B2C transactions flow through.

### Create a channel

**Parameters**

| Parameter | Required | Description |
|---|---|---|
| `type` | Yes | `PAYBILL`, `TILL`, or `SHORTCODE` |
| `shortcode` | Yes | The M-Pesa shortcode |
| `name` | Yes | Display name |
| `accountNumber` | No | Account number (used with PAYBILL) |
| `isDefault` | No | Whether this is the default channel |

**TypeScript**
```typescript
const channel = await client.createChannel({
  type: 'PAYBILL',
  shortcode: '400200',
  name: 'Main Paybill',
  accountNumber: 'ACC-001',
  isDefault: true,
});

console.log(channel.id);   // "ch_01jxyz..."
console.log(channel.type); // "PAYBILL"
```

**Python**
```python
channel = client.create_channel(
    type="PAYBILL",
    shortcode="400200",
    name="Main Paybill",
    account_number="ACC-001",
    is_default=True,
)

print(channel["id"])    # "ch_01jxyz..."
print(channel["type"])  # "PAYBILL"
```

**PHP**
```php
$channel = $client->createChannel(
    type: 'PAYBILL',
    shortcode: '400200',
    name: 'Main Paybill',
    accountNumber: 'ACC-001',
    isDefault: true,
);

echo $channel['id'];    // "ch_01jxyz..."
echo $channel['type'];  // "PAYBILL"
```

**Go**
```go
accNum := "ACC-001"
isDefault := true

channel, err := client.CreateChannel(ctx, palpluss.CreateChannelParams{
    Type:          "PAYBILL",
    Shortcode:     "400200",
    Name:          "Main Paybill",
    AccountNumber: &accNum,
    IsDefault:     &isDefault,
})
if err != nil {
    log.Fatal(err)
}

fmt.Println(channel.ID)   // "ch_01jxyz..."
fmt.Println(channel.Type) // "PAYBILL"
```

**Response**
```json
{
  "id": "ch_01jxyz789",
  "tenantId": "ten_xyz",
  "category": "MPESA",
  "type": "PAYBILL",
  "shortcode": "400200",
  "name": "Main Paybill",
  "accountNumber": "ACC-001",
  "isDefault": true,
  "createdAt": "2025-01-15T08:00:00.000Z"
}
```

### Update a channel

Only the fields you provide are updated. Omitted fields remain unchanged.

**TypeScript**
```typescript
const updated = await client.updateChannel('ch_01jxyz789', {
  name: 'Primary Paybill',
  isDefault: false,
});

console.log(updated.name);      // "Primary Paybill"
console.log(updated.isDefault); // false
```

**Python**
```python
updated = client.update_channel(
    "ch_01jxyz789",
    name="Primary Paybill",
    is_default=False,
)

print(updated["name"])       # "Primary Paybill"
print(updated["isDefault"])  # False
```

**PHP**
```php
$updated = $client->updateChannel(
    channelId: 'ch_01jxyz789',
    name: 'Primary Paybill',
    isDefault: false,
);

echo $updated['name'];       // "Primary Paybill"
echo $updated['isDefault'];  // false
```

**Go**
```go
name := "Primary Paybill"
isDefault := false

updated, err := client.UpdateChannel(ctx, "ch_01jxyz789", palpluss.UpdateChannelParams{
    Name:      &name,
    IsDefault: &isDefault,
})
if err != nil {
    log.Fatal(err)
}

fmt.Println(updated.Name)      // "Primary Paybill"
fmt.Println(updated.IsDefault) // false
```

### Delete a channel

**TypeScript**
```typescript
await client.deleteChannel('ch_01jxyz789');
// Returns void — no response body
```

**Python**
```python
client.delete_channel("ch_01jxyz789")
# Returns None — no response body
```

**PHP**
```php
$client->deleteChannel('ch_01jxyz789');
// Returns void — no response body
```

**Go**
```go
err := client.DeleteChannel(ctx, "ch_01jxyz789")
if err != nil {
    log.Fatal(err)
}
// No return value on success
```

---

## 8. Webhooks

PalPluss sends HTTP POST requests to your configured `callbackUrl` whenever a transaction status changes.

### Event types

| Event type | Description |
|---|---|
| `transaction.success` | Transaction completed successfully |
| `transaction.failed` | Transaction failed |
| `transaction.cancelled` | Transaction cancelled by the customer |
| `transaction.expired` | Transaction timed out |
| `transaction.updated` | General status update |

### Webhook payload structure

```json
{
  "event": "transaction.updated",
  "event_type": "transaction.success",
  "transaction": {
    "id": "tx_01j8abc123",
    "tenant_id": "ten_xyz",
    "type": "STK",
    "status": "SUCCESS",
    "amount": 500,
    "currency": "KES",
    "phone_number": "254712345678",
    "external_reference": "ORDER-001",
    "provider": "MPESA",
    "provider_request_id": "ws_CO_...",
    "provider_checkout_id": "ws_CO_...",
    "result_code": "0",
    "result_desc": "The service request is processed successfully.",
    "mpesa_receipt": "QHX123ABC456",
    "created_at": "2025-01-15T10:30:00.000Z",
    "updated_at": "2025-01-15T10:31:45.000Z"
  }
}
```

### Parsing webhook payloads

Each SDK provides a `parseWebhookPayload` function that validates the payload structure and returns a typed object. It raises an error if the payload is malformed.

**TypeScript**

```typescript
import { parseWebhookPayload } from '@palpluss/sdk';
import type { Request, Response } from 'express';

export function webhookHandler(req: Request, res: Response) {
  let payload;
  try {
    payload = parseWebhookPayload(req.body);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  const { event_type, transaction } = payload;

  switch (event_type) {
    case 'transaction.success':
      console.log(`Payment ${transaction.id} succeeded — receipt: ${transaction.mpesa_receipt}`);
      // fulfil order, credit account, etc.
      break;
    case 'transaction.failed':
      console.log(`Payment ${transaction.id} failed: ${transaction.result_desc}`);
      break;
    default:
      console.log(`Unhandled event: ${event_type}`);
  }

  res.status(200).json({ received: true });
}
```

**Python**

```python
from palpluss import parse_webhook_payload
from fastapi import Request, HTTPException

@app.post("/webhooks/palpluss")
async def webhook_handler(request: Request):
    body = await request.body()

    try:
        payload = parse_webhook_payload(body.decode())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    event_type = payload["event_type"]
    transaction = payload["transaction"]

    if event_type == "transaction.success":
        print(f"Payment {transaction['id']} succeeded — receipt: {transaction['mpesa_receipt']}")
        # fulfil order, credit account, etc.
    elif event_type == "transaction.failed":
        print(f"Payment {transaction['id']} failed: {transaction['result_desc']}")

    return {"received": True}
```

**PHP**

```php
use PalPluss\Webhooks;
use PalPluss\Http\Errors\PalPlussApiError;

// In your webhook controller / route handler:
$raw = file_get_contents('php://input');

try {
    $payload = Webhooks::parsePayload($raw);
} catch (\InvalidArgumentException $e) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid webhook payload']);
    exit;
}

$eventType   = $payload['event_type'];
$transaction = $payload['transaction'];

switch ($eventType) {
    case 'transaction.success':
        echo "Payment {$transaction['id']} succeeded — receipt: {$transaction['mpesa_receipt']}";
        // fulfil order, credit account, etc.
        break;
    case 'transaction.failed':
        echo "Payment {$transaction['id']} failed: {$transaction['result_desc']}";
        break;
}

http_response_code(200);
echo json_encode(['received' => true]);
```

**Go**

```go
import (
    palpluss "github.com/palpluss/palpluss-go"
    "io"
    "net/http"
)

func webhookHandler(w http.ResponseWriter, r *http.Request) {
    body, err := io.ReadAll(r.Body)
    if err != nil {
        http.Error(w, "bad request", http.StatusBadRequest)
        return
    }

    payload, err := palpluss.ParseWebhookPayload(string(body))
    if err != nil {
        http.Error(w, "invalid payload", http.StatusBadRequest)
        return
    }

    switch payload.EventType {
    case "transaction.success":
        receipt := ""
        if payload.Transaction.MpesaReceipt != nil {
            receipt = *payload.Transaction.MpesaReceipt
        }
        fmt.Printf("Payment %s succeeded — receipt: %s\n", payload.Transaction.ID, receipt)
    case "transaction.failed":
        desc := ""
        if payload.Transaction.ResultDesc != nil {
            desc = *payload.Transaction.ResultDesc
        }
        fmt.Printf("Payment %s failed: %s\n", payload.Transaction.ID, desc)
    }

    w.WriteHeader(http.StatusOK)
    w.Write([]byte(`{"received":true}`))
}
```

---

## 9. Error Handling

All SDKs raise / throw a typed error when the API returns a non-2xx response.

### Error types

| Type | HTTP Status | Description |
|---|---|---|
| `RateLimitError` | 429 | Too many requests — includes `retryAfter` (seconds) |
| `PalPlussApiError` | 4xx / 5xx | All other API errors |

### Error attributes

| Attribute | Type | Description |
|---|---|---|
| `message` | string | Human-readable description |
| `code` | string | Machine-readable code (e.g. `INVALID_PHONE`, `INSUFFICIENT_BALANCE`) |
| `httpStatus` | int | HTTP status code |
| `details` | object | Additional context from the API |
| `requestId` | string \| null | Trace ID — include this when contacting support |
| `retryAfter` | int \| null | Seconds to wait before retrying (`RateLimitError` only) |

**TypeScript**
```typescript
import { PalPluss, PalPlussApiError, RateLimitError } from '@palpluss/sdk';

const client = new PalPluss({ apiKey: 'pk_live_...' });

try {
  const result = await client.stkPush({ amount: 500, phone: '254712345678' });
} catch (err) {
  if (err instanceof RateLimitError) {
    console.log(`Rate limited — retry after ${err.retryAfter}s`);
  } else if (err instanceof PalPlussApiError) {
    console.log(`API error [${err.code}] HTTP ${err.httpStatus}: ${err.message}`);
    console.log(`Request ID: ${err.requestId}`);
    console.log('Details:', err.details);
  } else {
    throw err;  // network error, timeout, etc.
  }
}
```

**Python**
```python
from palpluss import PalPluss, PalPlussApiError, RateLimitError

client = PalPluss(api_key="pk_live_...")

try:
    result = client.stk_push(amount=500, phone="254712345678")
except RateLimitError as e:
    print(f"Rate limited — retry after {e.retry_after}s")
except PalPlussApiError as e:
    print(f"API error [{e.code}] HTTP {e.http_status}: {e}")
    print(f"Request ID: {e.request_id}")
    print("Details:", e.details)
```

**PHP**
```php
use PalPluss\Http\Errors\PalPlussApiError;
use PalPluss\Http\Errors\RateLimitError;

try {
    $result = $client->stkPush(amount: 500, phone: '254712345678');
} catch (RateLimitError $e) {
    echo "Rate limited — retry after {$e->retryAfter}s\n";
} catch (PalPlussApiError $e) {
    echo "API error [{$e->errorCode}] HTTP {$e->httpStatus}: {$e->getMessage()}\n";
    echo "Request ID: {$e->requestId}\n";
    print_r($e->details);
}
```

**Go**
```go
import (
    palpluss "github.com/palpluss/palpluss-go"
    "errors"
)

result, err := client.StkPush(ctx, palpluss.StkPushParams{
    Amount: 500,
    Phone:  "254712345678",
})
if err != nil {
    var rateLimitErr *palpluss.RateLimitError
    var apiErr *palpluss.PalPlussApiError

    switch {
    case errors.As(err, &rateLimitErr):
        fmt.Printf("Rate limited — retry after %ds\n", rateLimitErr.RetryAfter)
    case errors.As(err, &apiErr):
        fmt.Printf("API error [%s] HTTP %d: %s\n",
            apiErr.Code, apiErr.HTTPStatus, apiErr.Message)
        fmt.Printf("Request ID: %s\n", apiErr.RequestID)
    default:
        log.Fatal(err)  // network error, timeout, etc.
    }
}
```

### Common error codes

| Code | HTTP | Description |
|---|---|---|
| `INVALID_PHONE` | 400 | Phone number is not valid |
| `INSUFFICIENT_BALANCE` | 400 | Service wallet has insufficient funds for a B2C payout |
| `DUPLICATE_IDEMPOTENCY_KEY` | 409 | A request with this key was already processed |
| `CHANNEL_NOT_FOUND` | 404 | The specified channel ID does not exist |
| `UNAUTHORIZED` | 401 | API key is missing or invalid |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server-side error |

---

## 10. Rate Limiting and Retries

### Automatic retries

By default all clients automatically retry on HTTP 429 using the `Retry-After` response header. The retry behaviour is controlled by two constructor parameters:

| Parameter | Default | Description |
|---|---|---|
| `autoRetryOnRateLimit` | `true` | Enable automatic retries on 429 |
| `maxRetries` | `3` | Maximum number of retry attempts |

```typescript
// TypeScript — disable auto-retry
const client = new PalPluss({
  apiKey: 'pk_live_...',
  autoRetryOnRateLimit: false,
});
```

```python
# Python — disable auto-retry
client = PalPluss(api_key="pk_live_...", auto_retry_on_rate_limit=False)
```

```php
// PHP — disable auto-retry
$client = new PalPluss(apiKey: 'pk_live_...', autoRetryOnRateLimit: false);
```

```go
// Go — disable auto-retry
client, _ := palpluss.New("pk_live_...", palpluss.WithAutoRetryOnRateLimit(false))
```

### Manual retry with backoff

When auto-retry is disabled or exhausted, handle `RateLimitError` manually:

```python
import time
from palpluss import PalPluss, RateLimitError

client = PalPluss(api_key="pk_live_...", auto_retry_on_rate_limit=False)

for attempt in range(4):
    try:
        result = client.stk_push(amount=500, phone="254712345678")
        break
    except RateLimitError as e:
        if attempt == 3:
            raise
        wait = e.retry_after or (2 ** attempt)
        print(f"Rate limited — waiting {wait}s before retry {attempt + 1}")
        time.sleep(wait)
```

### Idempotency and safe retries

For B2C payouts and wallet top-ups, always supply an explicit `idempotencyKey` before retrying. If you omit the key, a new UUID is auto-generated on each call and a retry may produce a duplicate payout.

```typescript
// Safe to retry — same key, same outcome
const result = await client.b2cPayout({
  amount: 1000,
  phone: '254712345678',
  idempotencyKey: 'payout-order-123-attempt-1',
});
```
