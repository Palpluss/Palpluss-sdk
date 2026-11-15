// Manual release for @palpluss/mcp. The package stays "private": true in git so the
// SDK's changeset release can't publish it by accident; this script lifts the flag
// only for the publish and always puts it back.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../package.json', import.meta.url);
const original = readFileSync(path, 'utf8');
const pkg = JSON.parse(original);
const run = (cmd) => execSync(cmd, { stdio: 'inherit', cwd: new URL('..', import.meta.url) });

const ua = readFileSync(new URL('../src/api/client.ts', import.meta.url), 'utf8').match(/palpluss-mcp\/([\d.]+)/)?.[1];
if (ua !== pkg.version) {
  console.error(`Version mismatch: package.json ${pkg.version} vs USER_AGENT ${ua} in src/api/client.ts`);
  process.exit(1);
}

try {
  run('npm whoami');
  run('pnpm test');
  run('pnpm build');
  delete pkg.private;
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
  // The repo's .npmrc sets provenance=true for the GitHub Actions release.
  // Provenance needs a CI identity (OIDC), so a manual publish turns it off.
  // Accounts with 2FA need the authenticator code: pass --otp=123456.
  const otp = process.argv.find((a) => a.startsWith('--otp='));
  const dry = process.argv.includes('--dry-run') ? ' --dry-run' : '';
  run(`npm publish --access public --provenance=false${otp ? ` ${otp}` : ''}${dry}`);
  console.log(`\nPublished @palpluss/mcp@${pkg.version}`);
} finally {
  writeFileSync(path, original);
}
