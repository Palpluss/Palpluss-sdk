import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  assertAmount,
  guarded,
  idempotencyKey,
  kes,
  ok,
  requireApproval,
  requirePhone,
  ToolRefusal,
  type ToolContext,
} from './common.js';
import { maskPhone } from '../safety/redact.js';

const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } as const;
const FINAL = new Set(['SUCCESS', 'FAILED', 'CANCELLED', 'REVERSED']);

const amountSchema = z.number().int().positive().describe('Whole Kenyan shillings.');
const phoneSchema = z.string().min(9).max(16).describe('Kenyan mobile number: 07XXXXXXXX, 01XXXXXXXX or 2547XXXXXXXX.');
const callbackSchema = z.string().url().max(500).optional().describe('HTTPS URL PalPluss POSTs the final result to.');

/** Wallet top-ups: STK push to the payer's own phone, credited once M-Pesa confirms. */
export function registerWalletTools(ctx: ToolContext) {
  const { server, client, config } = ctx;

  for (const wallet of ['service', 'b2c'] as const) {
    const name = wallet === 'service' ? 'palpluss_topup_service_wallet' : 'palpluss_topup_b2c_wallet';
    const label = wallet === 'service' ? 'service wallet (fees)' : 'B2C wallet (payout float)';
    server.registerTool(
      name,
      {
        title: wallet === 'service' ? 'Top up service wallet' : 'Top up B2C wallet',
        description:
          wallet === 'service'
            ? 'Top up the service wallet, which pays PalPluss fees. Sends an M-Pesa PIN prompt to the given phone; the wallet is credited once it is paid. Needs the person\'s approval first.'
            : 'Top up the B2C wallet, the float payouts are sent from. Sends an M-Pesa PIN prompt to the given phone; the wallet is credited once it is paid. Needs the person\'s approval first.',
        inputSchema: {
          amount: amountSchema,
          phone: phoneSchema.describe('The phone that will pay (gets the PIN prompt).'),
          reference: z.string().max(12).optional().describe('Your reference, ≤12 chars. Use a new one for each separate top-up.'),
          callbackUrl: callbackSchema,
        },
        annotations: { title: `Top up ${label}`, ...WRITE },
      },
      guarded(ctx, name, async ({ amount, phone, reference, callbackUrl }) => {
        assertAmount(amount, { min: 1, max: config.limits.maxTopup, label: 'Top-up' });
        const msisdn = requirePhone(phone);
        const approval = await requireApproval(ctx, {
          action: `${wallet}_wallet_topup`,
          title: `Top up the ${label} with ${kes(amount)}`,
          details: { Amount: kes(amount), 'PIN prompt goes to': maskPhone(msisdn) ?? '', Wallet: label },
          consequence: `An M-Pesa prompt for ${kes(amount)} will be sent to ${maskPhone(msisdn)}. The wallet is credited only after that phone pays.`,
        });
        const body = {
          amount,
          phone: msisdn,
          accountReference: reference ?? (wallet === 'service' ? 'MCP-TOPUP' : 'MCP-B2CTOP'),
          transactionDesc: wallet === 'service' ? 'Service topup' : 'B2C topup',
          ...(callbackUrl ? { callbackUrl } : {}),
        };
        const key = idempotencyKey(config.apiKey, [`topup-${wallet}`, amount, msisdn], reference);
        const res =
          wallet === 'service' ? await client.topupServiceWallet(body, key) : await client.topupB2cWallet(body, key);
        return ok(res, {
          note: `Approved (${approval}). The PIN prompt was sent.`,
          next: 'Use palpluss_get_transaction with the transactionId to see when it is paid, then palpluss_get_wallet_balances.',
        });
      }),
    );
  }
}

/** Collections: STK push to a customer, and waiting for the result. */
export function registerCollectTools(ctx: ToolContext) {
  const { server, client, config } = ctx;

  server.registerTool(
    'palpluss_send_stk_push',
    {
      title: 'Send an STK push',
      description:
        'Ask a customer to pay by sending an M-Pesa PIN prompt to their phone. Money goes to the default payment channel unless channelId is given. Needs the person\'s approval first. Returns a PENDING transaction — follow it with palpluss_wait_for_payment.',
      inputSchema: {
        amount: amountSchema,
        phone: phoneSchema.describe('The customer\'s phone (gets the PIN prompt).'),
        accountReference: z.string().max(12).optional().describe('Your order/invoice reference, ≤12 chars.'),
        description: z.string().max(13).optional().describe('Shown on the prompt, ≤13 chars.'),
        channelId: z.string().uuid().optional().describe('Payment channel to collect into (default channel if omitted).'),
        callbackUrl: callbackSchema,
      },
      annotations: { title: 'Send an STK push', ...WRITE },
    },
    guarded(ctx, 'palpluss_send_stk_push', async ({ amount, phone, accountReference, description, channelId, callbackUrl }) => {
      assertAmount(amount, { min: 1, max: config.limits.maxStk, label: 'STK push' });
      const msisdn = requirePhone(phone);
      let channelLabel = 'Default channel';
      if (channelId) {
        const ch = (await client.getChannel(channelId)) as { name?: string; shortcode?: string };
        channelLabel = `${ch.name ?? 'Channel'} (${ch.shortcode ?? '?'})`;
      }
      const approval = await requireApproval(ctx, {
        action: 'stk_push',
        title: `Request ${kes(amount)} from ${maskPhone(msisdn)}`,
        details: {
          Amount: kes(amount),
          'Customer phone': maskPhone(msisdn) ?? '',
          'Collect into': channelLabel,
          ...(accountReference ? { Reference: accountReference } : {}),
        },
        consequence: `The customer at ${maskPhone(msisdn)} gets an M-Pesa prompt to pay ${kes(amount)}.`,
      });
      const res = await client.stkPush({
        amount,
        phone: msisdn,
        ...(accountReference ? { accountReference } : {}),
        ...(description ? { transactionDesc: description } : {}),
        ...(channelId ? { channelId } : {}),
        ...(callbackUrl ? { callbackUrl } : {}),
      });
      return ok(res, {
        note: `Approved (${approval}). The prompt was sent; the customer has about a minute to enter their PIN.`,
        next: 'Call palpluss_wait_for_payment with the transactionId.',
      });
    }),
  );

  server.registerTool(
    'palpluss_wait_for_payment',
    {
      title: 'Wait for a payment result',
      description:
        'Wait (up to 90 seconds) for an STK push, top-up or payout to reach a final status — SUCCESS, FAILED, CANCELLED or REVERSED — then return it. Returns the current status if it is still pending when time runs out.',
      inputSchema: {
        transactionId: z.string().uuid(),
        timeoutSeconds: z.number().int().min(5).max(90).optional().describe('How long to wait (default 60).'),
      },
      annotations: { title: 'Wait for a payment result', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    guarded(ctx, 'palpluss_wait_for_payment', async ({ transactionId, timeoutSeconds }): Promise<CallToolResult> => {
      const deadline = Date.now() + (timeoutSeconds ?? 60) * 1000;
      let tx = (await client.getTransaction(transactionId)) as { status?: string };
      while (!FINAL.has(String(tx.status)) && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        tx = (await client.getTransaction(transactionId)) as { status?: string };
      }
      const final = FINAL.has(String(tx.status));
      return ok(tx, {
        note: final ? `Final status: ${tx.status}.` : `Still ${tx.status ?? 'pending'} — check again shortly.`,
      });
    }),
  );
}

/** B2C payouts — the strictest tool: limits, allowlist, approval, idempotency. */
export function registerPayoutTools(ctx: ToolContext) {
  const { server, client, config, limiter } = ctx;

  server.registerTool(
    'palpluss_send_payout',
    {
      title: 'Send a B2C payout',
      description:
        'Send money from the B2C wallet to an M-Pesa number (refunds, commissions, salaries). Needs the person\'s approval and is capped by this server\'s payout limits — check palpluss_get_guardrails first. Give each separate payout its own reference; repeating the same request with the same reference never pays twice.',
      inputSchema: {
        amount: amountSchema.describe('Whole Kenyan shillings, minimum 10.'),
        phone: phoneSchema.describe('The recipient\'s M-Pesa number.'),
        reference: z.string().max(120).optional().describe('Unique reference for this payout (recommended).'),
        description: z.string().max(255).optional().describe('What the payout is for.'),
        channelId: z.string().uuid().optional(),
        callbackUrl: callbackSchema,
      },
      annotations: { title: 'Send a B2C payout', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    guarded(ctx, 'palpluss_send_payout', async ({ amount, phone, reference, description, channelId, callbackUrl }) => {
      assertAmount(amount, { min: 10, max: Math.max(10, config.limits.maxPayout), label: 'Payout' });
      const msisdn = requirePhone(phone);
      limiter.check(amount, msisdn); // fail fast before bothering the person

      const left = limiter.remaining();
      const approval = await requireApproval(ctx, {
        action: 'b2c_payout',
        title: `Send ${kes(amount)} to ${maskPhone(msisdn)}`,
        details: {
          Amount: kes(amount),
          Recipient: maskPhone(msisdn) ?? '',
          ...(reference ? { Reference: reference } : {}),
          ...(description ? { For: description } : {}),
          'Left today after this': `${kes(Math.max(0, left.remainingTotal - amount))} · ${Math.max(0, left.remainingCount - 1)} payouts`,
        },
        consequence: `${kes(amount)} will leave your B2C wallet and be sent to ${maskPhone(msisdn)}. This can't be undone once M-Pesa pays it.`,
      });

      const release = limiter.reserve(amount, msisdn); // re-checks: limits may have moved while waiting
      try {
        const res = await client.b2cPayout(
          {
            amount,
            phone: msisdn,
            currency: 'KES',
            ...(reference ? { reference } : {}),
            ...(description ? { description } : {}),
            ...(channelId ? { channelId } : {}),
            ...(callbackUrl ? { callbackUrl } : {}),
          },
          idempotencyKey(config.apiKey, ['payout', amount, msisdn], reference),
        );
        const status = String((res as { status?: string }).status ?? '');
        if (status === 'FAILED') release();
        return ok(res, {
          note: `Approved (${approval}). Payout submitted with status ${status || 'unknown'}.`,
          next: 'Call palpluss_wait_for_payment with the transactionId to confirm it was paid.',
        });
      } catch (err) {
        release();
        throw err;
      }
    }),
  );
}

/** Payment channels — every change needs approval: channels decide where money lands. */
export function registerChannelTools(ctx: ToolContext) {
  const { server, client } = ctx;
  const CHANNEL_TYPES = ['PAYBILL', 'TILL', 'BUYGOODS', 'SHORTCODE'] as const;

  const describe = (c: { name?: unknown; type?: unknown; shortcode?: unknown; accountNumber?: unknown }) =>
    `${c.name ?? 'Unnamed'} — ${c.type ?? '?'} ${c.shortcode ?? '?'}${c.accountNumber ? ` / account ${c.accountNumber}` : ''}`;

  server.registerTool(
    'palpluss_create_payment_channel',
    {
      title: 'Add a payment channel',
      description:
        'Add a Paybill or Till that customer payments can be collected into. For a bank account, use the bank\'s M-Pesa Paybill as shortcode and the bank account number as accountNumber. Needs the person\'s approval.',
      inputSchema: {
        name: z.string().min(1).max(80),
        type: z.enum(CHANNEL_TYPES).describe('PAYBILL needs accountNumber; TILL/BUYGOODS/SHORTCODE must not have one.'),
        shortcode: z.string().regex(/^\d{4,10}$/).describe('The Paybill or Till number.'),
        accountNumber: z.string().min(1).max(30).optional(),
        makeDefault: z.boolean().optional().describe('Make this the channel STK pushes use by default.'),
      },
      annotations: { title: 'Add a payment channel', ...WRITE },
    },
    guarded(ctx, 'palpluss_create_payment_channel', async ({ name, type, shortcode, accountNumber, makeDefault }) => {
      if (type === 'PAYBILL' && !accountNumber) throw new ToolRefusal('A PAYBILL channel needs an accountNumber.', 'ACCOUNT_NUMBER_REQUIRED');
      if (type !== 'PAYBILL' && accountNumber) throw new ToolRefusal(`A ${type} channel must not have an accountNumber.`, 'ACCOUNT_NUMBER_NOT_ALLOWED');
      const approval = await requireApproval(ctx, {
        action: 'channel_create',
        title: `Add payment channel "${name}"`,
        details: {
          Channel: describe({ name, type, shortcode, accountNumber }),
          'Make default': makeDefault ? 'Yes — new STK payments will go here' : 'No',
        },
        consequence: makeDefault
          ? `Customer payments will start going to ${type} ${shortcode}${accountNumber ? ` (account ${accountNumber})` : ''}. Check the numbers carefully.`
          : `The channel is added but not used by default.`,
      });
      const res = await client.createChannel({ name, type, shortcode, ...(accountNumber ? { accountNumber } : {}), isDefault: !!makeDefault });
      return ok(res, { note: `Approved (${approval}). Channel added.` });
    }),
  );

  server.registerTool(
    'palpluss_update_payment_channel',
    {
      title: 'Edit a payment channel',
      description: 'Rename a channel or change its number or account number. Needs the person\'s approval.',
      inputSchema: {
        channelId: z.string().uuid(),
        name: z.string().min(1).max(80).optional(),
        type: z.enum(CHANNEL_TYPES).optional(),
        shortcode: z.string().regex(/^\d{4,10}$/).optional(),
        accountNumber: z.string().min(1).max(30).nullable().optional(),
      },
      annotations: { title: 'Edit a payment channel', ...WRITE, idempotentHint: true },
    },
    guarded(ctx, 'palpluss_update_payment_channel', async ({ channelId, ...changes }) => {
      const patch = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
      if (!Object.keys(patch).length) throw new ToolRefusal('Nothing to change — pass at least one field.', 'NO_CHANGES');
      const current = (await client.getChannel(channelId)) as Record<string, unknown>;
      const next = { ...current, ...patch };
      const approval = await requireApproval(ctx, {
        action: 'channel_update',
        title: `Change payment channel "${String(current.name ?? channelId)}"`,
        details: { Now: describe(current), 'After the change': describe(next), Default: current.isDefault ? 'Yes' : 'No' },
        consequence: current.isDefault
          ? 'This is your default channel: new customer payments will go to the changed number.'
          : 'Payments that use this channel will go to the changed number.',
      });
      const res = await client.updateChannel(channelId, patch);
      return ok(res, { note: `Approved (${approval}). Channel updated.` });
    }),
  );

  server.registerTool(
    'palpluss_set_default_payment_channel',
    {
      title: 'Set the default payment channel',
      description: 'Make a channel the default — STK pushes without a channelId collect into it. Needs the person\'s approval.',
      inputSchema: { channelId: z.string().uuid() },
      annotations: { title: 'Set the default payment channel', ...WRITE, idempotentHint: true },
    },
    guarded(ctx, 'palpluss_set_default_payment_channel', async ({ channelId }) => {
      const target = (await client.getChannel(channelId)) as Record<string, unknown>;
      if (target.isDefault) return ok(target, { note: 'Already the default channel. Nothing changed.' });
      const list = (await client.listChannels()) as { items?: Record<string, unknown>[] };
      const currentDefault = list.items?.find((c) => c.isDefault);
      const approval = await requireApproval(ctx, {
        action: 'channel_set_default',
        title: `Make "${String(target.name ?? channelId)}" the default channel`,
        details: {
          'New default': describe(target),
          'Current default': currentDefault ? describe(currentDefault) : 'None',
        },
        consequence: 'All new STK payments without a specific channel will go to the new default.',
      });
      const res = await client.updateChannel(channelId, { isDefault: true });
      return ok(res, { note: `Approved (${approval}). Default channel changed.` });
    }),
  );

  server.registerTool(
    'palpluss_delete_payment_channel',
    {
      title: 'Remove a payment channel',
      description:
        'Remove a payment channel. Past transactions keep their record; if it was the default, another channel becomes the default. Needs the person\'s approval.',
      inputSchema: { channelId: z.string().uuid() },
      annotations: { title: 'Remove a payment channel', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    guarded(ctx, 'palpluss_delete_payment_channel', async ({ channelId }) => {
      const current = (await client.getChannel(channelId)) as Record<string, unknown>;
      const approval = await requireApproval(ctx, {
        action: 'channel_delete',
        title: `Remove payment channel "${String(current.name ?? channelId)}"`,
        details: { Channel: describe(current), Default: current.isDefault ? 'Yes — another channel will become the default' : 'No' },
        consequence: 'The channel can no longer be used for payments.',
      });
      const res = await client.deleteChannel(channelId);
      return ok(res ?? { deleted: true, channelId }, { note: `Approved (${approval}). Channel removed.` });
    }),
  );
}
