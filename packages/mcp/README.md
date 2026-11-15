# @palpluss/mcp

The PalPluss [Model Context Protocol](https://modelcontextprotocol.io) server. It lets AI tools that support MCP — such as Claude Code, Cursor and VS Code — work with your PalPluss account: check wallet balances, look up transactions, manage payment channels, collect with M-Pesa STK Push and send B2C payouts.

Anything that moves money or changes where money lands **asks you to approve it first**. The approval request goes to your MCP client's interface, not to the AI model, so the model can't approve its own actions.

> Requires Node.js 18+ and a PalPluss API key from [console.palpluss.com](https://console.palpluss.com) → API Keys.

## Quick start

### Claude Code

```bash
claude mcp add palpluss -e PALPLUSS_API_KEY=your_api_key -- npx -y @palpluss/mcp
```

### Cursor — `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "palpluss": {
      "command": "npx",
      "args": ["-y", "@palpluss/mcp"],
      "env": { "PALPLUSS_API_KEY": "your_api_key" }
    }
  }
}
```

### VS Code — `.vscode/mcp.json`

```json
{
  "inputs": [{ "id": "palpluss-key", "type": "promptString", "description": "PalPluss API key", "password": true }],
  "servers": {
    "palpluss": {
      "command": "npx",
      "args": ["-y", "@palpluss/mcp"],
      "env": { "PALPLUSS_API_KEY": "${input:palpluss-key}" }
    }
  }
}
```

> **Before it's on npm:** build it (`pnpm --filter @palpluss/mcp build`) and use `node /path/to/palpluss-sdk/packages/mcp/dist/cli.js` in place of `npx -y @palpluss/mcp`.

Then ask your assistant things like *"What's my PalPluss service wallet balance?"*, *"Show my latest failed STK payments"*, or *"Add my KCB Paybill 522522, account 1188990011, as a payment channel"*.

## Tools

| Tool | Toolset | What it does | Approval |
|---|---|---|---|
| `palpluss_list_transactions` | read | List STK and B2C transactions, filter by type/status | — |
| `palpluss_get_transaction` | read | One transaction: status, amount, receipt | — |
| `palpluss_get_wallet_balances` | read | Service wallet (fees) and B2C wallet (payout float) | — |
| `palpluss_list_payment_channels` | read | Paybills/Tills money is collected into | — |
| `palpluss_get_payment_channel` | read | One channel | — |
| `palpluss_get_guardrails` | read | Enabled toolsets, limits, today's payout allowance | — |
| `palpluss_integration_guide` | read | Accurate guidance for building PalPluss into an app | — |
| `palpluss_topup_service_wallet` | wallets | STK prompt to top up the service wallet | ✅ |
| `palpluss_topup_b2c_wallet` | wallets | STK prompt to top up the B2C wallet | ✅ |
| `palpluss_send_stk_push` | collect | Ask a customer to pay by M-Pesa PIN prompt | ✅ |
| `palpluss_wait_for_payment` | collect | Wait up to 90s for a final status | — |
| `palpluss_create_payment_channel` | channels | Add a Paybill or Till (incl. a bank Paybill) | ✅ |
| `palpluss_update_payment_channel` | channels | Rename or change a channel's numbers | ✅ |
| `palpluss_set_default_payment_channel` | channels | Choose where STK payments go by default | ✅ |
| `palpluss_delete_payment_channel` | channels | Remove a channel | ✅ |
| `palpluss_send_payout` | payouts | Send money to an M-Pesa number | ✅ + limits |

**Toolsets.** `read` is always on. The default is `read,wallets,collect`. Channel changes and payouts are off until you switch them on:

```bash
PALPLUSS_MCP_TOOLSETS=read,wallets,collect,channels,payouts   # or: all
```

## Guardrails

PalPluss's own protections always apply, because every call goes through the public API: rate limits, per-phone limits, STK abuse protection and the STK success-rate pause. On top of those, this server adds:

- **Your approval for every write.** Top-ups, STK pushes, payouts and channel changes send an approval request (MCP *elicitation*) that your client shows you, with the amount, the masked phone number and, for channels, what changes. If your client doesn't support elicitation, these tools refuse instead of going ahead.
- **Payout limits** per API key: per payout, per day (total and count), and an optional allowlist of recipient numbers. They're checked before you're asked, and again just before the payout is sent. The limits are enforced by this server process, not by PalPluss, so if you run several copies each keeps its own tally.
- **No double payments.** Payouts and top-ups carry an idempotency key, so an AI retrying after a timeout can't pay twice. Give each separate payout its own `reference`.
- **Prompt-injection defence.** Text written by customers or providers (references, descriptions, result messages) is returned marked `untrusted:`. The server's instructions tell the AI never to act on it.
- **Privacy.** Phone numbers are masked in everything returned to the AI and in the audit log. The API key is never logged.
- **Audit log.** Set `PALPLUSS_MCP_AUDIT_FILE` to get one JSON line per tool call, with tool, outcome, masked arguments and error codes.
- **Kill switch.** `PALPLUSS_MCP_READ_ONLY=true` removes every tool that changes anything.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PALPLUSS_API_KEY` | — (required) | Your PalPluss API key |
| `PALPLUSS_MCP_TOOLSETS` | `read,wallets,collect` | Add `channels`, `payouts`, or use `all` |
| `PALPLUSS_MCP_READ_ONLY` | `false` | `true` turns off every write tool |
| `PALPLUSS_MCP_APPROVAL` | `elicit` | `none` disables approval prompts. Use it only for automated tests against a fake or local API, never with a live key |
| `PALPLUSS_MCP_MAX_PAYOUT` | `5000` | Largest single payout (KES) |
| `PALPLUSS_MCP_DAILY_PAYOUT_TOTAL` | `20000` | Payout total per Nairobi day (KES) |
| `PALPLUSS_MCP_DAILY_PAYOUT_COUNT` | `20` | Payouts per Nairobi day |
| `PALPLUSS_MCP_PAYOUT_ALLOWLIST` | empty (any) | Comma-separated numbers payouts may go to |
| `PALPLUSS_MCP_MAX_TOPUP` | `50000` | Largest wallet top-up (KES) |
| `PALPLUSS_MCP_MAX_STK` | `150000` | Largest STK push (KES) |
| `PALPLUSS_MCP_AUDIT_FILE` | — | JSON-lines audit log path |
| `PALPLUSS_MCP_STATE_FILE` | — | Keep today's payout tally across restarts |
| `PALPLUSS_MCP_TIMEOUT_MS` | `30000` | API request timeout |
| `PALPLUSS_BASE_URL` | `https://api.palpluss.com` | API base URL |

## HTTP mode

For apps that connect over the network instead of starting a local process, such as your own hosted deployment:

```bash
PALPLUSS_MCP_HTTP_TOKEN=$(openssl rand -hex 24) \
PALPLUSS_API_KEY=your_api_key \
npx @palpluss/mcp --http --port 3333            # → http://127.0.0.1:3333/mcp
```

- Every request needs `Authorization: Bearer <PALPLUSS_MCP_HTTP_TOKEN>`.
- One session per MCP client. Approval prompts work across requests within it.
- `PALPLUSS_MCP_HTTP_ALLOW_KEY_HEADER=true` lets one endpoint serve many merchants. Each session starts with the merchant's key in `X-PalPluss-Api-Key`, and the session is bound to that key.
- Binds to `127.0.0.1` by default. Put it behind TLS if you expose it.

## Embedding in your own app

Use `createPalplussMcpServer()` to run the server inside your own Node.js app and connect it to any MCP transport. Pass an `approver` to show approvals in your own interface. See [EMBEDDING.md](./EMBEDDING.md).

```ts
import { createPalplussMcpServer } from '@palpluss/mcp';

const { server } = createPalplussMcpServer({
  apiKey: process.env.PALPLUSS_API_KEY!,
  toolsets: ['read', 'wallets', 'collect'],
});
await server.connect(transport); // stdio, Streamable HTTP, or an in-memory pair
```

## Development

```bash
pnpm --filter @palpluss/mcp test        # guardrails, approvals, HTTP sessions
pnpm --filter @palpluss/mcp build
PALPLUSS_API_KEY=your_api_key node packages/mcp/dist/cli.js
```

## Releasing

The package is marked `"private": true`, so the SDK's changeset release can't publish it by accident. To release it manually:

1. Bump `version` in `package.json` and `USER_AGENT` in `src/api/client.ts`; the script checks that they match.
2. `npm login` (once), then `pnpm --filter @palpluss/mcp release:manual -- --otp=<code from your authenticator>`. This runs the tests and the build, lifts the private flag for the publish only, then puts it back. It publishes without provenance, which only works from CI. Use `-- --dry-run` to try it without publishing.

## License

MIT
