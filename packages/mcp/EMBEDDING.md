# Embedding @palpluss/mcp in your app

`createPalplussMcpServer()` returns a standard MCP server (`McpServer` from `@modelcontextprotocol/sdk`). You can connect it to any MCP transport: stdio, Streamable HTTP, or an in-memory pair inside your own process.

## In-process with your own approval UI

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createPalplussMcpServer, type ApprovalRequest } from '@palpluss/mcp';

// Your own function that shows the request to the user and resolves true/false.
declare function askUserToConfirm(req: ApprovalRequest): Promise<boolean>;

const { server } = createPalplussMcpServer({
  apiKey: process.env.PALPLUSS_API_KEY!,
  toolsets: ['read', 'wallets', 'collect', 'channels', 'payouts'],
  limits: {
    maxPayout: 2000,
    dailyPayoutTotal: 10000,
    dailyPayoutCount: 10,
    maxTopup: 50000,
    maxStk: 150000,
    payoutAllowlist: [],
  },
  approver: async (req) =>
    (await askUserToConfirm(req))
      ? { approved: true, via: 'host' }
      : { approved: false, reason: 'declined', message: 'The user declined. Nothing was done.' },
  onAudit: (event) => console.log(JSON.stringify(event)),
});

const client = new Client({ name: 'my-app', version: '1.0.0' });
const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

const { tools } = await client.listTools(); // pass these to your model as tools
const result = await client.callTool({ name: 'palpluss_get_wallet_balances', arguments: {} });
```

`ApprovalRequest` has `action` (a stable name such as `b2c_payout`), `title`, `details` (label → value, with phone numbers already masked) and `consequence`. Show all of it to the user.

Without an `approver`, the server asks through MCP elicitation, and tools that need approval refuse when the connected client doesn't support elicitation.

## Things to get right

- **Keep the API key on your server.** Never send it to a browser, a mobile app, or an environment that runs untrusted code.
- **Allowlist tools.** Expose only the tools your product needs, and add `palpluss_send_payout` deliberately.
- **Show approvals to the account owner,** not to whoever happens to be using the AI.
- **Keep the audit events** so users can see what was done on their account.
- **Payout limits are per server process.** They're held in memory (and in `stateFile` if you set one). If you run several processes, each enforces its own limits.

## Over HTTP

See "HTTP mode" in the [README](./README.md). Sessions are bound to the PalPluss key that opened them, and every request needs the bearer token.
