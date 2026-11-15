# Adding the PalPluss MCP server to Konaar

This guide is for the Konaar backend (`konar-backend`). Konaar's build agent has a fixed set of built-in tools, defined in `src/builder/agent/agent-tools.ts`, and no MCP client. Its PalPluss support so far is the reviewed kit that `add_integration('palpluss')` writes into a merchant's app.

The MCP server adds **account actions** the agent can take for the merchant while building: check balances, list transactions, add the Paybill they collect into, top up wallets, run a test STK push and send payouts. It sits alongside the kit and doesn't replace it.

## Two keys, two places

| Key | Lives in | Used by |
|---|---|---|
| `PALPLUSS_API_KEY` (project secret, set through `request_input`) | The merchant's **generated app**, inside the sandbox and the deployment | The app's own checkout code from the kit |
| The merchant's key for agent actions | **Konaar's API host only** (encrypted, like other credentials) | The PalPluss MCP server |

Never give the MCP key to the build sandbox. Generated code is untrusted, and the MCP server can move money.

## Option A — embed in-process (recommended)

There's no extra process to run, and approvals go through Konaar's own UI.

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createPalplussMcpServer } from '@palpluss/mcp';

export async function palplussToolsFor(run: AgentRun, merchantKey: string) {
  const { server } = createPalplussMcpServer({
    apiKey: merchantKey,
    toolsets: ['read', 'wallets', 'collect', 'channels', 'payouts'],
    limits: { maxPayout: 2000, dailyPayoutTotal: 10000, dailyPayoutCount: 10, maxTopup: 50000, maxStk: 150000, payoutAllowlist: [] },
    // Konaar's confirm dialog — the same pattern as request_input: the run
    // pauses, the merchant sees the card, and their click answers it.
    approver: async (req) => {
      const answer = await run.requestConfirmation({
        title: req.title,
        rows: req.details,
        body: req.consequence,
        confirmLabel: 'Approve',
      });
      return answer.confirmed
        ? { approved: true, via: 'host' }
        : { approved: false, reason: 'declined', message: 'The merchant declined in Konaar. Nothing was done.' };
    },
    onAudit: (e) => run.audit('palpluss_mcp', e),
  });

  const client = new Client({ name: 'konaar-agent', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);

  const { tools } = await client.listTools();
  return {
    // Hand these to the LLM as tools (name, description, inputSchema).
    definitions: tools.filter((t) => ALLOWED.has(t.name)),
    call: (name: string, args: unknown) =>
      ALLOWED.has(name) ? client.callTool({ name, arguments: args as Record<string, unknown> }) : Promise.reject(new Error('Tool not allowed')),
    close: () => client.close(),
  };
}

// Konaar's allowlist — start narrow and widen deliberately.
const ALLOWED = new Set([
  'palpluss_get_wallet_balances',
  'palpluss_list_transactions',
  'palpluss_get_transaction',
  'palpluss_list_payment_channels',
  'palpluss_get_guardrails',
  'palpluss_integration_guide',
  'palpluss_create_payment_channel',
  'palpluss_set_default_payment_channel',
  'palpluss_send_stk_push',
  'palpluss_wait_for_payment',
  // 'palpluss_send_payout',  // enable when Konaar's confirm UI is ready
]);
```

Tool results are plain text holding JSON, so pass them back to the model unchanged. They already mask phone numbers and mark customer-written text as untrusted.

## Option B — over HTTP

Run one shared endpoint and connect with the MCP Streamable HTTP client:

```bash
PALPLUSS_MCP_HTTP_TOKEN=<random 48 hex> PALPLUSS_MCP_HTTP_ALLOW_KEY_HEADER=true \
PALPLUSS_MCP_TOOLSETS=all npx @palpluss/mcp --http --host 127.0.0.1 --port 3333
```

Each agent run opens a session with `Authorization: Bearer <token>` and `X-PalPluss-Api-Key: <merchant key>`. The session is bound to that key. Approvals arrive as MCP elicitation requests, which Konaar answers from its confirm dialog. The limits in this mode come from environment variables and are shared by all merchants, so prefer Option A if you need per-merchant limits.

## Checklist

- [ ] Store the merchant's MCP key encrypted on the API host, never in project secrets.
- [ ] Implement `run.requestConfirmation`, a card in the run UI like `request_input`.
- [ ] Start with the allowlist above and add payouts once the confirm card is live.
- [ ] Send `onAudit` events to Konaar's audit log so merchants can see what the agent did.
- [ ] Update the PalPluss kit guides only if the key requirements change. Today any key works, because API key scopes aren't enforced yet.
