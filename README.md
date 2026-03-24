# PalPluss SDK

Official SDK monorepo for the [PalPluss](https://palpluss.com) payments API.

All SDKs in this repository are built against a single shared API contract (`openapi/palpluss-v1.yaml`) and follow consistent design principles across languages.

## Available SDKs

| Language | Package | Status | Docs |
|---|---|---|---|
| TypeScript / Node.js | [`@palpluss/sdk`](packages/typescript) | ✅ Available | [README](packages/typescript/README.md) |
| Python | `palpluss` | 🔜 Planned | — |
| PHP | `palpluss/palpluss-php` | 🔜 Planned | — |
| Go | `github.com/palpluss/palpluss-go` | 🔜 Planned | — |

## Quick Start (TypeScript)

```bash
npm install @palpluss/sdk
```

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

See the [TypeScript SDK README](packages/typescript/README.md) for full usage.

## API Contract

All SDKs implement the PalPluss REST API v1.

The shared OpenAPI contract lives at [`openapi/palpluss-v1.yaml`](openapi/palpluss-v1.yaml) and is the source of truth for:

- Endpoint definitions
- Request / response shapes (including exact field names and casing)
- Error codes and HTTP status mapping
- Idempotency rules
- Pagination semantics
- Webhook payload structure

SDK authors must not invent endpoints, fields, or behaviours outside this contract.

## Repository Structure

```
palpluss-sdk/
├── .changeset/          # Changesets for versioning
├── .github/workflows/   # CI (ci.yml) and release (release.yml) pipelines
├── docs/                # Shared documentation
│   ├── contributing.md
│   ├── sdk-design-principles.md
│   ├── versioning.md
│   └── release-process.md
├── examples/            # Framework-specific integration examples
│   ├── nextjs/
│   ├── nodejs/
│   ├── nestjs/
│   ├── fastapi/
│   ├── laravel/
│   └── go/
├── openapi/
│   └── palpluss-v1.yaml # Shared API contract (source of truth)
├── packages/
│   ├── typescript/      # @palpluss/sdk — reference implementation ✅
│   ├── python/          # palpluss (planned)
│   ├── php/             # palpluss/palpluss-php (planned)
│   └── go/              # palpluss-go (planned)
├── scripts/             # Tooling and automation scripts
├── package.json         # Workspace root (pnpm)
└── pnpm-workspace.yaml
```

## Design Principles

Every PalPluss SDK, regardless of language, must:

- Follow the API contract exactly (no invented behaviour)
- Use HTTP Basic auth with the API key as username, empty password
- Unwrap the `{ success, data, requestId }` response envelope for callers
- Expose a typed, first-class error object (not raw HTTP errors)
- Support idempotency keys on the documented endpoints
- Not normalize phone numbers (pass through to the server)
- Expose cursor-based pagination without constructing cursors manually

The TypeScript SDK in `packages/typescript` is the reference implementation. Future SDKs should model their architecture, naming, and test patterns after it.

See [docs/sdk-design-principles.md](docs/sdk-design-principles.md) for the full guide.

## Contributing

See [docs/contributing.md](docs/contributing.md) for the full contributor workflow.

The short version:

1. Create a branch, make your change
2. Run `pnpm changeset` to record version intent
3. Open a PR — CI validates automatically
4. Merge → release PR is created automatically
5. Merge the release PR → package is published to npm

## License

MIT
