# Versioning Policy

## Semantic versioning

All PalPluss SDKs follow [Semantic Versioning](https://semver.org):

- **patch** (0.1.0 → 0.1.1) — bug fixes, internal changes with no public API impact
- **minor** (0.1.0 → 0.2.0) — new public methods, new optional parameters, backwards-compatible additions
- **major** (0.1.0 → 1.0.0) — breaking changes to the public API

## Independent versioning

Each language SDK versions independently. The TypeScript SDK being at `0.3.0` does not imply the Python SDK is at `0.3.0`. Versions reflect each package's own maturity and release cadence.

## Changesets

Version bumps are driven by [Changesets](https://github.com/changesets/changesets):

1. Every PR with a meaningful change includes a changeset file (created via `pnpm changeset`)
2. The changeset records: which package is affected, what kind of change (patch/minor/major), and a summary
3. On merge to `main`, the release workflow opens a "Version Packages" PR that aggregates pending changesets into a version bump and CHANGELOG entry
4. Merging the version PR triggers publishing

## What requires a changeset

| Change | Changeset required? | Kind |
|---|---|---|
| New public method | Yes | minor |
| New optional request field | Yes | minor |
| Bug fix | Yes | patch |
| Breaking change to public API | Yes | major |
| Internal refactor (no API change) | Yes | patch |
| Docs-only change | No | — |
| Test-only change | No | — |
| CI config change | No | — |

## Pre-1.0 stability

Until a package reaches `1.0.0`, minor versions may include breaking changes. We aim to reach `1.0.0` once the public API is stable and the SDK is in production use.
