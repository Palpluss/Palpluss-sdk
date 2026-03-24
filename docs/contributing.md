# Contributing

## Prerequisites

- Node.js >= 18
- pnpm >= 9 (`npm install -g pnpm`)

## Setup

```bash
git clone https://github.com/Palpluss/Palpluss-sdk.git
cd Palpluss-sdk
pnpm install
```

> Commit the generated `pnpm-lock.yaml` when setting up a fresh clone — CI requires it.

## Working on the TypeScript SDK

```bash
cd packages/typescript

pnpm test       # run tests
pnpm typecheck  # TypeScript type-check
pnpm lint       # ESLint
pnpm build      # compile to dist/
```

Or from the repo root using workspace filters:

```bash
pnpm --filter @palpluss/sdk test
pnpm --filter @palpluss/sdk build
```

## Making a change

1. Create a branch off `main`
2. Make your change in `packages/typescript/` (or the relevant package)
3. Record the version intent (see below)
4. Open a pull request — CI runs automatically
5. Merge after review

## Recording a changeset

Every PR that changes SDK behaviour must include a changeset. Run:

```bash
pnpm changeset
```

The CLI will ask:
- **Which packages?** — select the affected package(s)
- **Change type?**
  - `patch` — bug fix, internal refactor
  - `minor` — new feature, new method, new optional parameter
  - `major` — breaking change
- **Summary** — one-line description for the CHANGELOG

Commit the generated `.changeset/*.md` file alongside your code.

**Skip changesets for:** docs-only changes, test-only changes, CI config changes.

## Release flow (automated)

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
  - bumps version in package.json
  - updates CHANGELOG.md
        │
Maintainer merges the Version PR
        │
Release workflow publishes to npm
  - builds SDK
  - changeset publish
  - git tag (e.g. @palpluss/sdk@0.2.0)
  - npm provenance attestation attached
```

See [release-process.md](release-process.md) for full details.

## API contract

Before changing endpoint behaviour, request/response shapes, or error codes, check `openapi/palpluss-v1.yaml`. The SDK must reflect the contract exactly.

## Adding a new language SDK

1. Create `packages/<language>/` — see the existing placeholder READMEs
2. Read [sdk-design-principles.md](sdk-design-principles.md) — all SDKs follow shared principles
3. Model the architecture after `packages/typescript/`
4. Add a CI job in `.github/workflows/ci.yml` for the new package

## One-time setup (maintainers only)

Create a **granular npm automation token** scoped to `@palpluss/sdk` publish and add it to the repo:
`Settings → Secrets → Actions → NPM_TOKEN`

See [release-process.md](release-process.md) for full instructions.

## Commit style

- `feat:` new feature
- `fix:` bug fix
- `chore:` maintenance
- `docs:` documentation only
- `test:` test changes

Changelogs are generated from **changeset summaries**, not commit messages.
