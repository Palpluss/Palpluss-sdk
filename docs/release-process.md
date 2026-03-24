# Release Process

Releases are fully automated. No manual `npm publish` is ever required.

## Flow

```
1. Developer makes a change on a branch
        │
2. Developer runs: pnpm changeset
   → CLI prompts for package, bump type, and summary
   → Creates a .changeset/<random-name>.md file
   → Developer commits the changeset alongside their code
        │
3. Developer opens a Pull Request
   → CI runs: lint + typecheck + test + build
   → PR cannot merge if CI fails
        │
4. Maintainer reviews and merges PR to main
        │
5. Release workflow runs on main
   → Detects pending changesets
   → Opens (or updates) a "Version Packages" PR:
        • bumps version in package.json
        • updates CHANGELOG.md
        • commit message: "chore: version packages"
        │
6. Maintainer reviews and merges the Version PR
        │
7. Release workflow runs on main again
   → No pending changesets (they were consumed)
   → Runs: pnpm --filter @palpluss/sdk build
   → Runs: changeset publish
        • publishes @palpluss/sdk to npm
        • pushes git tag, e.g. @palpluss/sdk@0.2.0
        • npm provenance attestation is attached automatically
```

## Required secrets

| Secret | Purpose | Where to create |
|---|---|---|
| `NPM_TOKEN` | npm publish authentication | [npmjs.com → tokens](https://www.npmjs.com/settings/<user>/tokens) |
| `GITHUB_TOKEN` | Create PRs, push tags | Automatically provided by GitHub Actions |

### Creating the npm token

1. Go to [npmjs.com](https://www.npmjs.com) → your account → Access Tokens
2. Click **Generate New Token** → **Granular Access Token**
3. Set scope to **publish** on `@palpluss/sdk` only
4. Set type to **Automation** (bypasses 2FA for CI use)
5. Copy the token
6. Add it in the GitHub repo: **Settings → Secrets → Actions → New repository secret** → name `NPM_TOKEN`

## npm Provenance

The release workflow sets `permissions.id-token: write` and `.npmrc` sets `provenance=true`. This means every published version includes a cryptographic attestation linking the npm package to the exact GitHub Actions run and source commit. No additional setup is needed once `NPM_TOKEN` is configured.

## Hotfixes

Hotfixes follow the same flow:

1. Branch off `main`
2. Apply fix
3. Run `pnpm changeset` (select `patch`)
4. PR → CI → merge
5. Version PR is created → merge
6. Package is published automatically
