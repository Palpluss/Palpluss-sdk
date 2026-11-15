import { z } from 'zod';
import { guarded, ok, type ToolContext } from './common.js';
import { maskPhone } from '../safety/redact.js';
import { GUIDE_TOPICS, guide } from './guide.js';

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;

export function registerReadTools(ctx: ToolContext) {
  const { server, client } = ctx;

  server.registerTool(
    'palpluss_list_transactions',
    {
      title: 'List transactions',
      description:
        'List recent PalPluss transactions (STK collections and B2C payouts), newest first. Filter by type or status; page with the returned next_cursor.',
      inputSchema: {
        type: z.enum(['STK', 'B2C']).optional().describe('Only STK collections or only B2C payouts.'),
        status: z
          .enum(['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REVERSED', 'CANCELLED'])
          .optional()
          .describe('Only transactions in this status.'),
        limit: z.number().int().min(1).max(100).optional().describe('How many to return (default 20, max 100).'),
        cursor: z.string().max(500).optional().describe('next_cursor from a previous page.'),
      },
      annotations: { title: 'List transactions', ...READ },
    },
    guarded(ctx, 'palpluss_list_transactions', async (args) => ok(await client.listTransactions(args))),
  );

  server.registerTool(
    'palpluss_get_transaction',
    {
      title: 'Get a transaction',
      description:
        'Get one transaction by its PalPluss transaction ID — status, amount, M-Pesa receipt and result. Use it to check whether an STK push, payout or top-up succeeded.',
      inputSchema: { transactionId: z.string().uuid().describe('PalPluss transaction ID (UUID).') },
      annotations: { title: 'Get a transaction', ...READ },
    },
    guarded(ctx, 'palpluss_get_transaction', async ({ transactionId }) => ok(await client.getTransaction(transactionId))),
  );

  server.registerTool(
    'palpluss_get_wallet_balances',
    {
      title: 'Wallet balances',
      description:
        'Balances of both PalPluss wallets: the service wallet (pays transaction fees, e.g. KES 3 per STK push) and the B2C wallet (the float that payouts are sent from).',
      inputSchema: {},
      annotations: { title: 'Wallet balances', ...READ },
    },
    guarded(ctx, 'palpluss_get_wallet_balances', async () => {
      const [service, b2c] = await Promise.allSettled([client.serviceWalletBalance(), client.b2cWalletBalance()]);
      const pick = (r: PromiseSettledResult<unknown>) =>
        r.status === 'fulfilled' ? r.value : { unavailable: true, reason: (r.reason as Error)?.message ?? 'unknown' };
      return ok({ serviceWallet: pick(service), b2cWallet: pick(b2c) });
    }),
  );

  server.registerTool(
    'palpluss_list_payment_channels',
    {
      title: 'List payment channels',
      description:
        'List the account\'s payment channels — the Paybills and Tills customer payments are collected into. The default channel is first; STK pushes use it unless a channelId is given.',
      inputSchema: {},
      annotations: { title: 'List payment channels', ...READ },
    },
    guarded(ctx, 'palpluss_list_payment_channels', async () => ok(await client.listChannels())),
  );

  server.registerTool(
    'palpluss_get_payment_channel',
    {
      title: 'Get a payment channel',
      description: 'Get one payment channel by ID.',
      inputSchema: { channelId: z.string().uuid().describe('Payment channel ID (UUID).') },
      annotations: { title: 'Get a payment channel', ...READ },
    },
    guarded(ctx, 'palpluss_get_payment_channel', async ({ channelId }) => ok(await client.getChannel(channelId))),
  );

  server.registerTool(
    'palpluss_get_guardrails',
    {
      title: 'Guardrails in force',
      description:
        'Show what this PalPluss MCP server is allowed to do: enabled toolsets, whether writes are switched off, how approvals work, the payout limits and how much of today\'s payout limit is left. Call this before planning payouts or channel changes.',
      inputSchema: {},
      annotations: { title: 'Guardrails in force', ...READ, openWorldHint: false },
    },
    guarded(ctx, 'palpluss_get_guardrails', async () => {
      const { config } = ctx;
      return ok(
        {
          toolsets: config.toolsets,
          writesEnabled: !config.readOnly,
          approval:
            config.approval === 'elicit'
              ? 'Every top-up, STK push, payout and channel change asks the person to approve it in their app before anything happens.'
              : 'Approval prompts are switched off (PALPLUSS_MCP_APPROVAL=none).',
          limits: {
            maxPayoutKes: config.limits.maxPayout,
            dailyPayoutTotalKes: config.limits.dailyPayoutTotal,
            dailyPayoutCount: config.limits.dailyPayoutCount,
            maxTopupKes: config.limits.maxTopup,
            maxStkKes: config.limits.maxStk,
            payoutAllowlist: config.limits.payoutAllowlist.length
              ? config.limits.payoutAllowlist.map((p) => maskPhone(p))
              : 'any number',
          },
          payoutsToday: ctx.config.toolsets.includes('payouts') ? ctx.limiter.remaining() : 'payouts toolset is off',
        },
        { note: 'Limits here are enforced by this MCP server in addition to PalPluss\'s own limits.' },
      );
    }),
  );

  server.registerTool(
    'palpluss_integration_guide',
    {
      title: 'Integration guide',
      description:
        'Short, accurate guidance for building PalPluss into an app: STK push, webhooks, B2C payouts, payment channels, wallets, errors and going live. Use it before writing PalPluss integration code.',
      inputSchema: { topic: z.enum(GUIDE_TOPICS).describe('Which part of the integration.') },
      annotations: { title: 'Integration guide', ...READ, openWorldHint: false },
    },
    guarded(ctx, 'palpluss_integration_guide', async ({ topic }) => ({
      content: [{ type: 'text', text: guide(topic) }],
    })),
  );
}
