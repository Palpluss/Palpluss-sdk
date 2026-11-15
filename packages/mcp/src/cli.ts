#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ConfigError, loadConfigFromEnv } from './config.js';
import { startHttpServer } from './http.js';
import { createPalplussMcpServer, SERVER_VERSION } from './server.js';

const HELP = `palpluss-mcp ${SERVER_VERSION} — PalPluss MCP server

Usage:
  palpluss-mcp              Run over stdio (Claude Code, Cursor, VS Code, …)
  palpluss-mcp --http       Run a Streamable HTTP endpoint at /mcp
      --port <n>            Port (default 3333, or PORT)
      --host <addr>         Bind address (default 127.0.0.1)

Environment:
  PALPLUSS_API_KEY               Required. Your PalPluss API key.
  PALPLUSS_MCP_TOOLSETS          read,wallets,collect (default) · add channels,payouts · or all
  PALPLUSS_MCP_READ_ONLY         true to switch off every tool that changes anything
  PALPLUSS_MCP_APPROVAL          elicit (default) | none
  PALPLUSS_MCP_MAX_PAYOUT        KES per payout (default 5000)
  PALPLUSS_MCP_DAILY_PAYOUT_TOTAL / _COUNT   daily payout caps (default 20000 / 20)
  PALPLUSS_MCP_PAYOUT_ALLOWLIST  comma-separated phone numbers payouts may go to
  PALPLUSS_MCP_MAX_TOPUP / _MAX_STK          caps for top-ups and STK pushes
  PALPLUSS_MCP_AUDIT_FILE        JSON-lines audit log path
  PALPLUSS_MCP_STATE_FILE        where to keep today's payout tally
  PALPLUSS_BASE_URL              API base (default https://api.palpluss.com)
  PALPLUSS_MCP_HTTP_TOKEN        --http only: required bearer token (≥24 chars)
  PALPLUSS_MCP_HTTP_ALLOW_KEY_HEADER  --http only: accept X-PalPluss-Api-Key per request
`;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    process.stdout.write(HELP);
    return;
  }
  if (process.argv.includes('--version')) {
    process.stdout.write(`${SERVER_VERSION}\n`);
    return;
  }

  const httpMode = process.argv.includes('--http');
  const allowKeyHeader = ['1', 'true', 'yes'].includes((process.env.PALPLUSS_MCP_HTTP_ALLOW_KEY_HEADER ?? '').toLowerCase());

  // In HTTP multi-merchant mode the key may come per request instead of env.
  const env = httpMode && allowKeyHeader && !process.env.PALPLUSS_API_KEY ? { ...process.env, PALPLUSS_API_KEY: '-' } : process.env;
  const config = loadConfigFromEnv(env);
  if (config.apiKey === '-') config.apiKey = '';

  if (httpMode) {
    const port = Number(arg('--port') ?? process.env.PORT ?? 3333);
    const host = arg('--host') ?? '127.0.0.1';
    await startHttpServer({ config, port, host, token: process.env.PALPLUSS_MCP_HTTP_TOKEN ?? '', allowKeyHeader });
    process.stderr.write(`[palpluss-mcp] listening on http://${host}:${port}/mcp (toolsets: ${config.toolsets.join(', ')})\n`);
    return;
  }

  const { server } = createPalplussMcpServer(config);
  await server.connect(new StdioServerTransport());
  // stdout carries the protocol; status goes to stderr.
  process.stderr.write(
    `[palpluss-mcp] ready (toolsets: ${config.toolsets.join(', ')}${config.readOnly ? ', read-only' : ''}, approval: ${config.approval})\n`,
  );
}

main().catch((err) => {
  const msg = err instanceof ConfigError ? err.message : `Failed to start: ${(err as Error)?.message ?? err}`;
  process.stderr.write(`[palpluss-mcp] ${msg}\n`);
  process.exit(1);
});
