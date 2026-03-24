# PalPluss SDK

Official SDK monorepo for the [PalPluss](https://palpluss.com) payments API.

All SDKs are built against a single shared API contract (`openapi/palpluss-v1.yaml`) and follow consistent design principles across every language.

## Available SDKs

| Language | Package | Status | Docs |
|---|---|---|---|
| TypeScript / Node.js | [`@palpluss/sdk`](packages/typescript) | ✅ Available | [README](packages/typescript/README.md) |
| Python | [`palpluss`](packages/python) | ✅ Available | [README](packages/python/README.md) |
| PHP | [`palpluss/sdk`](packages/php) | ✅ Available | [README](packages/php/README.md) |
| Go | [`github.com/palpluss/palpluss-go`](packages/go) | ✅ Available | [README](packages/go/README.md) |

## Quick Start

### TypeScript / Node.js

```bash
npm install @palpluss/sdk 
```

```typescript
import { PalPluss } from '@palpluss/sdk';

const client = new PalPluss({ apiKey: 'pk_live_...' });

const result = await client.stkPush({
  amount: 500,
  phone: '254712345678',
  accountReference: 'ORDER-001',
});

console.log(result.transactionId); // tx_...
console.log(result.status);        // PENDING
```

### Python

```bash
pip install palpluss
```

```python
from palpluss import PalPluss

client = PalPluss(api_key="pk_live_...")

result = client.stk_push(amount=500, phone="254712345678")
print(result["transactionId"])  # tx_...
print(result["status"])         # PENDING
```

Async support is included out of the box:

```python
from palpluss import AsyncPalPluss

async with AsyncPalPluss(api_key="pk_live_...") as client:
    result = await client.stk_push(amount=500, phone="254712345678")
```

### PHP

```bash
composer require palpluss/sdk
```

```php
use PalPluss\PalPluss;

$client = new PalPluss(apiKey: 'pk_live_...');

$result = $client->stkPush(amount: 500, phone: '254712345678');
echo $result['transactionId']; // tx_...
echo $result['status'];        // PENDING
```

### Go

```bash
go get github.com/palpluss/palpluss-go
```

```go
import palpluss "github.com/palpluss/palpluss-go"

client, err := palpluss.New("pk_live_...")
if err != nil {
    log.Fatal(err)
}

result, err := client.StkPush(ctx, palpluss.StkPushParams{
    Amount: 500,
    Phone:  "254712345678",
})
fmt.Println(result.TransactionID) // tx_...
fmt.Println(result.Status)        // PENDING
```

## API Reference

All SDKs expose the same set of operations against the PalPluss REST API v1:

| Operation | TypeScript | Python | PHP | Go |
|---|---|---|---|---|
| STK Push | `stkPush()` | `stk_push()` | `stkPush()` | `StkPush()` |
| B2C Payout | `b2cPayout()` | `b2c_payout()` | `b2cPayout()` | `B2cPayout()` |
| Service Balance | `getServiceBalance()` | `get_service_balance()` | `getServiceBalance()` | `GetServiceBalance()` |
| Service Topup | `serviceTopup()` | `service_topup()` | `serviceTopup()` | `ServiceTopup()` |
| Get Transaction | `getTransaction()` | `get_transaction()` | `getTransaction()` | `GetTransaction()` |
| List Transactions | `listTransactions()` | `list_transactions()` | `listTransactions()` | `ListTransactions()` |
| Create Channel | `createChannel()` | `create_channel()` | `createChannel()` | `CreateChannel()` |
| Update Channel | `updateChannel()` | `update_channel()` | `updateChannel()` | `UpdateChannel()` |
| Delete Channel | `deleteChannel()` | `delete_channel()` | `deleteChannel()` | `DeleteChannel()` |

Each SDK also provides webhook payload parsing:

| TypeScript | Python | PHP | Go |
|---|---|---|---|
| `parseWebhookPayload()` | `parse_webhook_payload()` | `Webhooks::parsePayload()` | `ParseWebhookPayload()` |

See each SDK's README for full parameter and return-type documentation.

## API Contract

The shared OpenAPI contract at [`openapi/palpluss-v1.yaml`](openapi/palpluss-v1.yaml) is the single source of truth for:

- Endpoint paths and HTTP methods
- Request / response shapes (including exact field names and casing)
- Error codes and HTTP status mapping
- Idempotency rules
- Pagination semantics
- Webhook payload structure

SDK authors must not invent endpoints, fields, or behaviours outside this contract.

## Repository Structure

```
palpluss-sdk/
├── .changeset/           Changesets for TypeScript versioning
├── .github/
│   └── workflows/
│       ├── ci.yml        CI — lint, typecheck, test, build (all SDKs)
│       └── release.yml   Release — publishes @palpluss/sdk to npm
├── docs/
│   ├── contributing.md   Contributor workflow
│   ├── sdk-design-principles.md
│   ├── versioning.md
│   └── release-process.md
├── examples/             Framework integration examples
│   ├── nextjs/
│   ├── nodejs/
│   ├── nestjs/
│   ├── fastapi/
│   ├── laravel/
│   └── go/
├── openapi/
│   └── palpluss-v1.yaml  Shared API contract (source of truth)
├── packages/
│   ├── typescript/       @palpluss/sdk        — reference implementation
│   ├── python/           palpluss             — sync + async, Python 3.9+
│   ├── php/              palpluss/sdk         — PHP 8.1+
│   └── go/               palpluss-go          — Go 1.21+, zero deps
└── scripts/              Tooling and automation
```

## Design Principles

Every PalPluss SDK, regardless of language, follows these rules:

- **Contract-first** — implements the OpenAPI contract exactly, no invented behaviour
- **HTTP Basic auth** — API key as username, empty password, Base64-encoded
- **Envelope unwrapping** — callers receive the `data` payload directly, not the `{ success, data, requestId }` wrapper
- **Typed errors** — a first-class error object carries `code`, `message`, `httpStatus`, `details`, and `requestId`
- **Rate limit handling** — `RateLimitError` (HTTP 429) includes `retryAfter`; auto-retry with `Retry-After` header support
- **Idempotency** — B2C payouts auto-generate a UUID v4 idempotency key if the caller does not provide one
- **No phone normalization** — phone numbers are passed through to the API as-is
- **Opaque cursors** — pagination cursors are treated as opaque strings; the SDK never constructs them
- **Transport isolation** — HTTP concerns live in a dedicated transport layer, separate from domain modules
- **Zero magic** — no hidden side effects, no global state, no monkey-patching

See [docs/sdk-design-principles.md](docs/sdk-design-principles.md) for the full guide.

## Contributing

See [docs/contributing.md](docs/contributing.md) for the full contributor workflow.

The short version:

1. Fork, create a branch, make your change
2. Add or update tests — all SDKs require tests for every public method
3. For TypeScript changes, run `pnpm changeset` to record the version intent
4. Open a pull request — CI validates all SDKs automatically
5. Merge after review

## License

MIT
