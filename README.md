# @palpluss/sdk

Official PalPluss TypeScript SDK for M-Pesa STK Push, B2C payouts, wallet management, and more.

## Installation

```bash
npm install @palpluss/sdk
```

## Quick Start

```typescript
import { PalPluss } from '@palpluss/sdk';

const client = new PalPluss({
  apiKey: 'pk_test_your_api_key',
  baseUrl: 'https://api.palpluss.com/v1', // optional, defaults to production
});

// STK Push
const stk = await client.stk.initiate({
  amount: 100,
  phone: '254712345678',
  accountReference: 'ORDER-001',
  transactionDesc: 'Payment for order',
});

// B2C Payout
const payout = await client.b2c.payout({
  amount: 1000,
  phone: '254712345678',
  reference: 'SALARY-001',
});

// Wallet Balance
const balance = await client.wallets.serviceBalance();

// List Transactions
const transactions = await client.transactions.list({ limit: 10, status: 'SUCCESS' });
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | `PALPLUSS_API_KEY` env var | Your API key |
| `baseUrl` | `string` | `https://api.palpluss.com/v1` | API base URL |
| `timeout` | `number` | `30000` | Request timeout in milliseconds |
| `autoRetryOnRateLimit` | `boolean` | `true` | Auto-retry on 429 responses |
| `maxRetries` | `number` | `3` | Maximum retry attempts |

## Modules

### STK Push

```typescript
const result = await client.stk.initiate({
  amount: 100,
  phone: '254712345678',
  accountReference: 'ORDER-001',
  transactionDesc: 'Payment',
  channelId: 'optional-channel-uuid',
  callbackUrl: 'https://your-server.com/webhook',
  credential_id: 'optional-credential-uuid',
});
```

### B2C Payouts

```typescript
// Auto-generates idempotency key
const result = await client.b2c.payout({
  amount: 1000,
  phone: '254712345678',
  currency: 'KES',
  reference: 'REF-001',
  description: 'Payout',
});

// Custom idempotency key
const result = await client.b2c.payout(
  { amount: 1000, phone: '254712345678' },
  { idempotencyKey: 'my-unique-key' },
);
```

### Wallets

```typescript
const balance = await client.wallets.serviceBalance();
const topup = await client.wallets.serviceTopup({
  amount: 5000,
  phone: '254712345678',
});
```

### Transactions

```typescript
const tx = await client.transactions.get('transaction-id');
const list = await client.transactions.list({
  limit: 20,
  cursor: 'optional-cursor',
  status: 'SUCCESS',
  type: 'STK',
});
```

### Payment Channels

```typescript
const channel = await client.channels.create({
  type: 'PAYBILL',
  shortcode: '123456',
  name: 'My Paybill',
  accountNumber: 'ACC001',
  isDefault: true,
});

await client.channels.update(channel.id, { name: 'New Name' });
await client.channels.delete(channel.id);
```

## Webhooks

```typescript
import { parseWebhookPayload } from '@palpluss/sdk';

const payload = parseWebhookPayload(requestBodyString);

switch (payload.event_type) {
  case 'transaction.success':
    // Handle successful payment
    break;
  case 'transaction.failed':
    // Handle failure
    break;
}
```

## Error Handling

```typescript
import { PalPlussApiError, RateLimitError } from '@palpluss/sdk';

try {
  await client.stk.initiate({ amount: 100, phone: '254712345678' });
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log('Retry after:', error.retryAfter, 'seconds');
  } else if (error instanceof PalPlussApiError) {
    console.log(error.code);       // e.g. 'INVALID_PHONE'
    console.log(error.httpStatus);  // e.g. 400
    console.log(error.requestId);   // request trace ID
    console.log(error.details);     // additional error details
  }
}
```

## Requirements

- Node.js >= 18 (uses native `fetch`)
- No external runtime dependencies

## License

MIT
