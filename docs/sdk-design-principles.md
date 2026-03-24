# SDK Design Principles

These principles apply to every PalPluss SDK regardless of language.

## 1. The API contract is the only source of truth

The file `openapi/palpluss-v1.yaml` defines everything: endpoints, request shapes, response shapes, error codes, idempotency rules, and pagination behaviour. SDKs must implement it exactly and must not invent behaviour outside it.

## 2. Flat, action-based public API

The public surface must feel like a product, not a mirror of the HTTP API:

| Instead of | Use |
|---|---|
| `client.stk.initiate(...)` | `client.stkPush(...)` |
| `client.wallets.serviceBalance()` | `client.getServiceBalance()` |
| `client.transactions.list(...)` | `client.listTransactions(...)` |

One obvious way to do each thing. No unnecessary nesting.

## 3. Minimal constructor

The developer only needs to provide an API key:

```typescript
const client = new PalPluss({ apiKey: "pk_live_..." });
```

Advanced options (`timeout`, `autoRetryOnRateLimit`, `maxRetries`) are available but optional. The base URL is not exposed in the public API.

## 4. Authentication

HTTP Basic auth. API key as username, empty password:

```
Authorization: Basic base64("<apiKey>:")
```

The SDK encodes this automatically from the raw key.

## 5. Response envelope unwrapping

Every successful API response is wrapped in:

```json
{ "success": true, "data": { ... }, "requestId": "uuid" }
```

SDKs must unwrap the envelope and return only `data` to callers. `requestId` must be preserved for error surfaces.

204 responses must return void / None / null cleanly.

## 6. Typed first-class errors

Non-2xx responses must throw (not return) a typed error object with at minimum:

- `message` — human-readable message
- `code` — machine-readable code (e.g. `INVALID_PHONE`)
- `httpStatus` — HTTP status code
- `details` — additional context
- `requestId` — trace ID for support

Rate-limit errors (`RATE_LIMIT_EXCEEDED` / HTTP 429) must be a subtype that exposes `retryAfter` in seconds.

## 7. No phone normalization

Accept phone numbers as-is. The server normalises Kenyan phone numbers internally. SDK-side normalization creates drift risk.

## 8. No SDK-side validation

Do not validate request fields in the SDK unless a constraint is computationally unavoidable. Trust the server to reject invalid inputs and return the correct error code.

## 9. Idempotency

B2C payouts (`POST /b2c/payouts`) and service wallet topups (`POST /wallets/service/topups`) support `Idempotency-Key` headers.

- Auto-generate a random UUID v4 key for B2C payouts if the caller does not provide one.
- Allow callers to pass their own key for safe retries.
- Do not auto-generate keys for topups — the caller must opt in.

## 10. Cursor-based pagination

Treat `next_cursor` as an opaque string. Pass it directly to the next request. Never construct or decode cursors in the SDK.

## 11. Transport isolation

Keep HTTP concerns (auth headers, retry logic, request timeout, envelope unwrapping) in a dedicated transport/client layer, separate from domain modules.

## 12. Zero magic

Do not add hidden side effects, silent retries of unsafe operations, or behaviour that callers cannot observe or disable.

## 13. Test coverage

Every SDK must include tests for at minimum:

- Auth header encoding
- Envelope unwrapping
- 204 handling
- Error mapping
- Idempotency header forwarding
- Rate-limit retry behaviour
- Pagination passthrough
- Each domain module
