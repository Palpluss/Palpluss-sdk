# PalPluss PHP SDK

Official PHP SDK for the [PalPluss](https://palpluss.com) payment API.

## Requirements

- PHP 8.1+
- Composer

## Installation

```bash
composer require palpluss/sdk
```

## Quick Start

```php
use PalPluss\PalPluss;

$client = new PalPluss(apiKey: 'pk_live_...');

$result = $client->stkPush(amount: 500, phone: '254712345678');
echo $result['transactionId'];
```

The API key can also be set via the `PALPLUSS_API_KEY` environment variable:

```php
$client = new PalPluss(); // reads PALPLUSS_API_KEY from env
```

## Configuration

```php
$client = new PalPluss(
    apiKey: 'pk_live_...',
    timeout: 30.0,               // request timeout in seconds (default: 30)
    autoRetryOnRateLimit: true,  // auto-retry on HTTP 429 (default: true)
    maxRetries: 3,               // max retry attempts (default: 3)
);
```

## Methods

### STK Push

```php
$result = $client->stkPush(
    amount: 500,
    phone: '254712345678',
    accountReference: 'ORDER-001',    // optional
    transactionDesc: 'Order payment', // optional
    channelId: 'ch_abc',              // optional
    callbackUrl: 'https://...',       // optional
    credentialId: 'cred_abc',         // optional
);
// $result['transactionId'], $result['status'], ...
```

### B2C Payout

```php
$result = $client->b2cPayout(
    amount: 1000,
    phone: '254712345678',
    currency: 'KES',                 // optional
    reference: 'PAYOUT-001',        // optional
    description: 'Salary payment',  // optional
    channelId: 'ch_abc',            // optional
    credentialId: 'cred_abc',       // optional
    callbackUrl: 'https://...',     // optional
    idempotencyKey: 'uuid-...',     // optional — auto-generated UUID v4 if not provided
);
```

### Service Wallet

```php
// Get balance
$balance = $client->getServiceBalance();
// $balance['balance'], $balance['currency']

// Top up
$topup = $client->serviceTopup(
    amount: 500,
    phone: '254712345678',
    accountReference: 'REF-001',    // optional
    transactionDesc: 'Top up',      // optional
    idempotencyKey: 'uuid-...',     // optional
);
```

### Transactions

```php
// Get single transaction
$txn = $client->getTransaction('txn_abc123');

// List transactions
$list = $client->listTransactions(
    limit: 20,          // optional
    cursor: 'cursor_',  // optional — for pagination
    status: 'SUCCESS',  // optional
    type: 'STK',        // optional — "STK" or "B2C"
);
// $list['items'], $list['next_cursor']
```

### Payment Wallet Channels

```php
// Create
$channel = $client->createChannel(
    type: 'PAYBILL',          // "PAYBILL", "TILL", or "SHORTCODE"
    shortcode: '123456',
    name: 'My Paybill',
    accountNumber: 'ACC-01',  // optional
    isDefault: true,          // optional
);

// Update
$channel = $client->updateChannel(
    channelId: 'ch_001',
    name: 'Updated Name',     // all update fields are optional
);

// Delete
$client->deleteChannel('ch_001');
```

### Webhooks

```php
use PalPluss\Webhooks;

// In your webhook handler:
$payload = Webhooks::parsePayload(file_get_contents('php://input'));

echo $payload['event_type'];              // e.g. "transaction.success"
echo $payload['transaction']['id'];       // transaction ID
echo $payload['transaction']['status'];   // transaction status
```

Valid event types: `transaction.success`, `transaction.failed`, `transaction.cancelled`,
`transaction.expired`, `transaction.updated`.

`parsePayload()` throws `\InvalidArgumentException` if the payload is invalid or missing required fields.

## Error Handling

```php
use PalPluss\Http\Errors\PalPlussApiError;
use PalPluss\Http\Errors\RateLimitError;

try {
    $result = $client->stkPush(amount: 500, phone: '254712345678');
} catch (RateLimitError $e) {
    echo "Rate limited. Retry after: {$e->retryAfter}s\n";
} catch (PalPlussApiError $e) {
    echo "API error [{$e->errorCode}] HTTP {$e->httpStatus}: {$e->getMessage()}\n";
    // $e->requestId  — request ID from the API response
    // $e->details    — additional error details array
}
```

## Development

```bash
# Install dependencies
composer install

# Run tests
vendor/bin/phpunit
```
