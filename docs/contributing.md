# Contributing

Thank you for contributing to the PalPluss SDK monorepo. This guide covers everything you need to get started, regardless of which SDK you are working on.

## Prerequisites

| Tool | Required for | Minimum version |
|---|---|---|
| Node.js | TypeScript SDK | 18 |
| pnpm | TypeScript SDK | 9 (`npm install -g pnpm`) |
| Python | Python SDK | 3.9 |
| uv | Python SDK | latest (`pip install uv` or `curl -LsSf https://astral.sh/uv/install.sh \| sh`) |
| PHP | PHP SDK | 8.1 |
| Composer | PHP SDK | 2 |
| Go | Go SDK | 1.21 |

You only need the tools for the SDK you are working on.

## Initial Setup

```bash
git clone https://github.com/palpluss/palpluss-sdk.git
cd palpluss-sdk
```

Then install dependencies for the SDK(s) you plan to work on:

```bash
# TypeScript
pnpm install

# Python
cd packages/python && uv pip install -e ".[dev]" --system

# PHP
cd packages/php && composer install

# Go  (no install step — go test downloads nothing)
```

## Working on an SDK

### TypeScript

```bash
cd packages/typescript

pnpm test       # run tests (jest)
pnpm typecheck  # TypeScript type-check
pnpm lint       # ESLint
pnpm build      # compile to dist/
```

Or from the repo root using pnpm workspace filters:

```bash
pnpm --filter @palpluss/sdk test
pnpm --filter @palpluss/sdk build
```

### Python

```bash
cd packages/python

pytest                  # run tests
mypy palpluss           # type-check
ruff check palpluss     # lint
ruff check palpluss --fix --unsafe-fixes   # auto-fix lint issues
```

The Python SDK ships both a synchronous (`PalPluss`) and asynchronous (`AsyncPalPluss`) client. Both must be tested whenever transport or client behaviour changes.

### PHP

```bash
cd packages/php

vendor/bin/phpunit      # run tests
```

PHP 8.1+ features are used throughout (constructor promotion, readonly properties, named arguments). Make sure the system PHP is 8.1 or above before running tests.

### Go

```bash
cd packages/go

go test ./...           # run tests
go test ./... -race     # run tests with race detector (recommended)
go vet ./...            # static analysis
```

The Go SDK has zero runtime dependencies — keep it that way. Only the standard library is permitted.

## Before Opening a Pull Request

Run the full check suite for the SDK you changed:

| SDK | Command |
|---|---|
| TypeScript | `pnpm --filter @palpluss/sdk lint && pnpm --filter @palpluss/sdk typecheck && pnpm --filter @palpluss/sdk test` |
| Python | `ruff check palpluss && mypy palpluss && pytest` |
| PHP | `vendor/bin/phpunit` |
| Go | `go vet ./... && go test ./... -race` |

All tests must pass. Do not open a PR with failing tests.

## Making a Change

1. Create a branch off `main` — use a descriptive name (`feat/go-webhook-sig`, `fix/python-retry-sleep`)
2. Make your change
3. Add or update tests — every public method must have test coverage
4. Check the API contract (`openapi/palpluss-v1.yaml`) if you are changing endpoint behaviour
5. For TypeScript changes, record a changeset (see below)
6. Open a pull request — CI validates all SDKs automatically

## Recording a Changeset (TypeScript only)

The TypeScript SDK uses [Changesets](https://github.com/changesets/changesets) for versioning and CHANGELOG generation. Every PR that changes TypeScript SDK behaviour must include a changeset:

```bash
pnpm changeset
```

The CLI will ask:

- **Which packages?** — select `@palpluss/sdk`
- **Change type?**
  - `patch` — bug fix, internal refactor, documentation improvement
  - `minor` — new method, new optional parameter, non-breaking addition
  - `major` — breaking change to the public API
- **Summary** — one-line description (appears in the CHANGELOG)

Commit the generated `.changeset/*.md` file alongside your code changes.

**Skip changesets for:** docs-only changes, test-only changes, CI config changes, or changes to the Python / PHP / Go SDKs (they use their own versioning independently of changesets).

## Release Flow (TypeScript — automated)

```
Developer opens PR with changeset
        │
CI validates (lint + typecheck + test + build)
        │
PR merged to main
        │
Release workflow detects pending changesets
        │
Opens / updates a "Version Packages" PR
  ├── bumps version in package.json
  └── appends to CHANGELOG.md
        │
Maintainer merges the Version PR
        │
Release workflow publishes to npm
  ├── builds the SDK
  ├── runs changeset publish
  ├── creates git tag  (@palpluss/sdk@x.y.z)
  └── attaches npm provenance attestation
```

See [release-process.md](release-process.md) for full details.

## API Contract

Before changing endpoint behaviour, request/response shapes, or error codes, read `openapi/palpluss-v1.yaml`. The SDK must reflect the contract exactly — do not invent fields, endpoints, or behaviours that are not in the spec.

## Adding a New Language SDK

All planned SDKs are now implemented. If you want to add support for a new language:

1. Create `packages/<language>/` following the structure of an existing SDK
2. Read [sdk-design-principles.md](sdk-design-principles.md) — all SDKs must follow the shared principles
3. Model the architecture after `packages/typescript/` (reference implementation)
4. Add a CI job in `.github/workflows/ci.yml`
5. Update the SDK table in the root `README.md`
6. Provide a `README.md` inside the package with install, usage, and error-handling examples

The Python, PHP, and Go SDKs are good references for non-TypeScript implementations.

## Commit Style

- `feat:` new feature or method
- `fix:` bug fix
- `chore:` maintenance, dependency updates, CI config
- `docs:` documentation only
- `test:` test changes only
- `refactor:` internal restructure with no behaviour change

Changelogs for the TypeScript SDK are generated from **changeset summaries**, not commit messages. Commit messages are for humans reading `git log`.

## Code Style

Each SDK follows its own language conventions:

| SDK | Formatter / Linter |
|---|---|
| TypeScript | ESLint + Prettier (configured in `packages/typescript`) |
| Python | ruff (line length 100, rules E/F/I/UP) |
| PHP | PSR-12 (no formatter enforced in CI, follow existing style) |
| Go | `gofmt` (enforced automatically — run `go fmt ./...` before committing) |

## One-Time Setup (Maintainers Only)

To enable automated npm publishing, create a **granular npm automation token** scoped to the `@palpluss` organisation and add it to the repository:

`Settings → Secrets and variables → Actions → NPM_TOKEN`

See [release-process.md](release-process.md) for full instructions.
