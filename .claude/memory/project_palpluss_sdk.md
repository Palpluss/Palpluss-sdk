---
name: palpluss_sdk_project
description: PalPluss TypeScript SDK structure, API contract, and key design decisions
type: project
---

Official PalPluss TypeScript SDK at /home/bazarin/Desktop/Palpluss/Palpluss-sdk.
API backend reference at /home/bazarin/Desktop/Nestjs-Projects/palpluss-backend.

**Why:** Open-source reference SDK for PalPluss payments API (Kenya / M-Pesa).
**How to apply:** All SDK work must match the API contract in the backend docs exactly.

## Key Architecture
- Package: @palpluss/sdk v0.1.0
- Zero runtime deps — native fetch (Node 18+), Buffer, crypto.randomUUID()
- Dual CJS/ESM build via tsup
- Test framework: Jest + ts-jest + jest-fetch-mock (47 tests, all passing)

## Structure
- src/client.ts — PalPluss main class
- src/http/transport.ts — HttpTransport (auth, envelope unwrap, retry, 204)
- src/http/errors.ts — PalPlussApiError + RateLimitError
- src/modules/ — stk, b2c, wallets, transactions, channels
- src/types/ — all TypeScript interfaces
- src/webhooks.ts — parseWebhookPayload()
- tests/ — 8 test suites
- examples/ — basic.ts, webhook-handler.ts

## API Contract Highlights
- Base URL: https://api.palpluss.com/v1
- Auth: HTTP Basic, apiKey as username, empty password
- Envelope: { success, data, requestId } / { success, error, requestId }
- 204 → undefined
- STK/wallets/channels → camelCase response fields
- Transactions → snake_case response fields
- B2C + wallets topup support Idempotency-Key header
- B2C auto-generates UUID v4 idempotency key if none provided
- Pagination: cursor-based, next_cursor is opaque
- Rate limit: 60 req/min, 429 + Retry-After, optional auto-retry
- DO NOT normalize phone numbers in the SDK
