# @palpluss/sdk

Official PalPluss TypeScript SDK — M-Pesa STK Push, B2C payouts, wallet management, and more.

## Installation

```bash
npm install @palpluss/sdk
# or
pnpm add @palpluss/sdk
# or
yarn add @palpluss/sdk
```

## Quick Start

```typescript
import { PalPluss } from '@palpluss/sdk';

const palpluss = new PalPluss({ apiKey: 'pk_live_your_api_key' });

const stk = await palpluss.stkPush({
  amount: 500,
  phone: '254712345678',
  accountReference: 'ORDER-001',
});

console.log(stk.transactionId); // tx_...
console.log(stk.status);        // PENDING
```

## Configuration

```typescript
const palpluss = new PalPluss({
  apiKey: 'pk_live_your_api_key', // or set PALPLUSS_API_KEY env var
});
```

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | `PALPLUSS_API_KEY` env var | Your PalPluss API key |
| `timeout` | `number` | `30000` | Request timeout in ms |
| `autoRetryOnRateLimit` | `boolean` | `true` | Auto-retry on HTTP 429 |
| `maxRetries` | `number` | `3` | Maximum retry attempts |

The SDK always connects to `https://api.palpluss.com`. Set `PALPLUSS_BASE_URL` to point at a different environment (e.g. staging).

## Methods

### STK Push

Prompt a customer to complete a payment on their phone.

```typescript
const stk = await palpluss.stkPush({
  amount: 500,                                // required, KES
  phone: '254712345678',                      // required
  accountReference: 'ORDER-001',              // optional
  transactionDesc: 'Payment for order',       // optional
  channelId: 'uuid',                          // optional
  callbackUrl: 'https://you.com/webhooks',    // optional
  credential_id: 'uuid',                      // optional
});
```

### B2C Payout

Send money to a customer's M-Pesa.

```typescript
// Idempotency key is auto-generated per call
const payout = await palpluss.b2cPayout({
  amount: 1000,             // required, min 10 KES
  phone: '254712345678',    // required
  currency: 'KES',          // optional
  reference: 'REF-001',     // optional
  description: 'Salary',    // optional
  channelId: 'uuid',        // optional
  callback_url: 'https://…', // optional
});

// Supply your own key for safe retries
const payout = await palpluss.b2cPayout(
  { amount: 1000, phone: '254712345678' },
  { idempotencyKey: 'salary-jan-001' },
);
```

### Service Wallet

```typescript
// Check balance
const balance = await palpluss.getServiceBalance();
console.log(balance.availableBalance, balance.currency);

// Top up via STK Push
const topup = await palpluss.serviceTopup({
  amount: 5000,
  phone: '254712345678',
  accountReference: 'TOPUP-001',     // optional
  transactionDesc: 'Wallet topup',   // optional
});
```

### Transactions

```typescript
// Fetch a single transaction
const tx = await palpluss.getTransaction('tx_id_here');

// List with filters
const page = await palpluss.listTransactions({
  limit: 20,           // 1–100, default 20
  status: 'SUCCESS',   // optional
  type: 'STK',         // optional: 'STK' | 'B2C'
});

// Paginate — pass next_cursor as-is, never construct it manually
if (page.next_cursor) {
  const next = await palpluss.listTransactions({ cursor: page.next_cursor });
}
```

### Payment Channels

```typescript
const channel = await palpluss.createChannel({
  type: 'PAYBILL',         // 'PAYBILL' | 'TILL' | 'SHORTCODE'
  shortcode: '123456',
  name: 'My Paybill',
  accountNumber: 'ACC001', // optional
  isDefault: true,         // optional
});

await palpluss.updateChannel(channel.id, { name: 'New Name' });

await palpluss.deleteChannel(channel.id); // returns void
```

## Webhooks

```typescript
import { parseWebhookPayload } from '@palpluss/sdk';

// In your HTTP handler:
const payload = parseWebhookPayload(req.body); // raw string

switch (payload.event_type) {
  case 'transaction.success':
    console.log('Paid:', payload.transaction.amount, 'KES');
    console.log('Receipt:', payload.transaction.mpesa_receipt);
    break;
  case 'transaction.failed':
    console.log('Failed:', payload.transaction.result_desc);
    break;
}
```

Webhook event types: `transaction.success`, `transaction.failed`, `transaction.cancelled`, `transaction.expired`, `transaction.updated`.

## Error Handling

```typescript
import { PalPlussApiError, RateLimitError } from '@palpluss/sdk';

try {
  await palpluss.stkPush({ amount: 500, phone: '254712345678' });
} catch (error) {
  if (error instanceof RateLimitError) {
    // Retry after this many seconds
    console.log('Retry after:', error.retryAfter, 'seconds');
  } else if (error instanceof PalPlussApiError) {
    console.log(error.code);       // 'INVALID_PHONE', 'INSUFFICIENT_FUNDS', etc.
    console.log(error.httpStatus); // 400, 402, 409, etc.
    console.log(error.requestId);  // trace ID for support
    console.log(error.details);    // additional context
  }
}
```

## Requirements

- Node.js >= 18 (uses native `fetch`)
- No external runtime dependencies

## License

MIT
