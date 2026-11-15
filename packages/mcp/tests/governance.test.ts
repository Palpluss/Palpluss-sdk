import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { PayoutLimiter } from '../src/safety/limits.js';
import { handleStatelessMcpRequest } from '../src/http.js';
import { connect, fakeApi, ok } from './helpers.js';

const TX = '33333333-3333-4333-8333-333333333333';
const APPROVAL = '44444444-4444-4444-8444-444444444444';

const mcpKey = (overrides: Record<string, unknown> = {}) => ({
  id: 'k1',
  name: 'Agent key',
  kind: 'MCP',
  mode: 'live',
  livemode: true,
  scopes: [{ scope: 'payouts:write', label: 'Send B2C payouts' }],
  expiresAt: null,
  connectedApp: null,
  policy: {
    payoutMax: 5000,
    dailyPayoutTotal: 20000,
    dailyPayoutCount: 20,
    payoutAllowlist: [],
    approvals: { payouts: true, channels: true },
    payoutsToday: { total: 0, count: 0, remainingTotal: 20000, remainingCount: 20 },
  },
  ...overrides,
});

afterEach(() => PayoutLimiter.resetAll());

describe('MCP keys and backend approvals', () => {
  it('does not prompt when PalPluss holds the payout for console approval, and reports it as pending', async () => {
    const s = await connect({
      toolsets: ['payouts'],
      route: (c) => {
        if (c.path === '/v1/api-key') return ok(mcpKey());
        if (c.path === '/v1/b2c/payouts') {
          return {
            status: 202,
            body: {
              success: true,
              data: { status: 'PENDING_APPROVAL', approvalId: APPROVAL, action: 'PAYOUT', expiresAt: '2026-11-15T12:00:00Z', approveUrl: 'https://console.palpluss.com/approvals', message: 'Waiting' },
            },
          };
        }
        return undefined;
      },
    });
    const r = await s.call('palpluss_send_payout', { amount: 500, phone: '0712345678', reference: 'R1' });
    expect(r.isError).toBe(false);
    expect(s.prompts).toHaveLength(0);
    expect(r.json.result.status).toBe('PENDING_APPROVAL');
    expect(r.json.note).toContain('Nothing has happened yet');
    expect(r.json.next).toContain(APPROVAL);
    await s.close();
  });

  it('still prompts for an MCP key whose payouts are not held by PalPluss', async () => {
    const key = mcpKey();
    (key.policy as any).approvals.payouts = false;
    const s = await connect({
      toolsets: ['payouts'],
      route: (c) =>
        c.path === '/v1/api-key' ? ok(key) : c.path === '/v1/b2c/payouts' ? ok({ transactionId: TX, status: 'PROCESSING' }) : undefined,
    });
    const r = await s.call('palpluss_send_payout', { amount: 500, phone: '0712345678' });
    expect(r.isError).toBe(false);
    expect(s.prompts).toHaveLength(1);
    await s.close();
  });

  it('test keys move simulated money without prompting', async () => {
    const s = await connect({
      toolsets: ['collect'],
      route: (c) =>
        c.path === '/v1/api-key'
          ? ok({ ...mcpKey(), kind: 'STANDARD', mode: 'test', livemode: false, scopes: 'all', policy: null })
          : c.path === '/v1/payments/stk'
            ? ok({ transactionId: TX, status: 'PROCESSING', livemode: false })
            : undefined,
    });
    const r = await s.call('palpluss_send_stk_push', { amount: 100, phone: '0700000002' });
    expect(r.isError).toBe(false);
    expect(s.prompts).toHaveLength(0);
    expect(r.json.note).toContain('test mode');
    await s.close();
  });

  it('backend mode refuses standard keys instead of acting without approval', async () => {
    const s = await connect({
      toolsets: ['collect'],
      approval: 'backend',
      elicit: 'unsupported',
      route: (c) => (c.path === '/v1/api-key' ? ok({ ...mcpKey(), kind: 'STANDARD', scopes: 'all', policy: null }) : undefined),
    });
    const r = await s.call('palpluss_send_stk_push', { amount: 100, phone: '0712345678' });
    expect(r.isError).toBe(true);
    expect(r.json.error.code).toBe('APPROVAL_UNAVAILABLE');
    expect(s.api.calls.find((c) => c.path === '/v1/payments/stk')).toBeUndefined();
    await s.close();
  });

  it('backend mode lets an MCP key act within its permissions without a prompt', async () => {
    const s = await connect({
      toolsets: ['collect'],
      approval: 'backend',
      elicit: 'unsupported',
      route: (c) =>
        c.path === '/v1/api-key'
          ? ok(mcpKey({ scopes: [{ scope: 'payments:stk', label: '' }] }))
          : c.path === '/v1/payments/stk'
            ? ok({ transactionId: TX, status: 'PENDING' })
            : undefined,
    });
    const r = await s.call('palpluss_send_stk_push', { amount: 100, phone: '0712345678' });
    expect(r.isError).toBe(false);
    expect(r.json.note).toContain('permissions the merchant granted');
    await s.close();
  });

  it('waits for the merchant decision and reports the result', async () => {
    let polls = 0;
    const s = await connect({
      toolsets: ['payouts'],
      route: (c) => {
        if (c.path === `/v1/approvals/${APPROVAL}`) {
          polls += 1;
          return ok({ id: APPROVAL, status: polls < 2 ? 'PENDING_APPROVAL' : 'EXECUTED', result: { transactionId: TX } });
        }
        return undefined;
      },
    });
    const r = await s.call('palpluss_wait_for_approval', { approvalId: APPROVAL, timeoutSeconds: 10 });
    expect(r.json.result.status).toBe('EXECUTED');
    expect(r.json.note).toContain('Approved and done');
    await s.close();
  }, 15_000);

  it('explains backend permission errors', async () => {
    const s = await connect({
      route: () => ({
        status: 403,
        body: { success: false, error: { code: 'HTTP_403', message: 'No permission', details: { code: 'INSUFFICIENT_SCOPE', message: 'No permission', details: { required: ['wallets:read'] } } } },
      }),
    });
    const r = await s.call('palpluss_get_wallet_history', {});
    expect(r.isError).toBe(true);
    expect(r.json.error.code).toBe('INSUFFICIENT_SCOPE');
    expect(r.json.error.details).toEqual({ required: ['wallets:read'] });
    expect(r.json.hint).toContain('console');
    await s.close();
  });
});

describe('new read and collect tools', () => {
  it('registers wallet history, fees, payment links and approvals', async () => {
    const s = await connect({ toolsets: ['read', 'collect', 'payouts'] });
    const names = (await s.client.listTools()).tools.map((t) => t.name);
    for (const n of [
      'palpluss_get_wallet_history',
      'palpluss_estimate_fee',
      'palpluss_list_payment_links',
      'palpluss_get_payment_link',
      'palpluss_list_approvals',
      'palpluss_create_payment_link',
      'palpluss_disable_payment_link',
      'palpluss_wait_for_approval',
    ]) {
      expect(names).toContain(n);
    }
    await s.close();
  });

  it('creates a payment link with the API field names', async () => {
    const s = await connect({
      toolsets: ['collect'],
      route: (c) => (c.path === '/v1/payment-links' ? ok({ id: 'l1', url: 'https://link.palpluss.com/l1' }) : undefined),
    });
    const r = await s.call('palpluss_create_payment_link', { amount: 1500, phone: '0712345678', reference: 'INV-1', expiry: '72h' });
    expect(r.isError).toBe(false);
    expect(s.api.calls[0].body).toEqual({ amount: 1500, phone_number: '254712345678', external_reference: 'INV-1', expiry: '72h' });
    await s.close();
  });

  it('passes fee estimate and history filters as query parameters', async () => {
    const s = await connect({ route: () => ok({ items: [] }) });
    await s.call('palpluss_estimate_fee', { service: 'B2C', amount: 2500 });
    await s.call('palpluss_get_wallet_history', { wallet: 'b2c', category: 'refund', limit: 5 });
    expect(s.api.calls[0].path).toBe('/v1/fees/estimate?service=B2C&amount=2500');
    expect(s.api.calls[1].path).toBe('/v1/wallets/history?wallet=b2c&category=refund&limit=5');
    await s.close();
  });
});

describe('stateless HTTP handler', () => {
  let http: Server | undefined;
  afterEach(() => new Promise<void>((r) => (http ? http.close(() => r()) : r())));

  it('answers initialize and tools/list on independent requests', async () => {
    const api = fakeApi(() => undefined);
    http = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      await handleStatelessMcpRequest(req, res, body, { apiKey: 'k', baseUrl: 'https://api.test', fetch: api.fetch, approval: 'backend' });
    });
    await new Promise<void>((r) => http!.listen(0, '127.0.0.1', () => r()));
    const port = (http.address() as { port: number }).port;
    const post = (body: unknown) =>
      fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify(body),
      }).then((r) => r.json() as Promise<any>);

    const init = await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } },
    });
    expect(init.result.serverInfo.name).toBe('palpluss');
    const list = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    expect(list.result.tools.map((t: { name: string }) => t.name)).toContain('palpluss_get_wallet_history');
  });
});

describe('mode switches', () => {
  it('re-reads the key before every approval decision, so a switch to live is never missed', async () => {
    let mode = 'test';
    const s = await connect({
      toolsets: ['collect'],
      route: (c) =>
        c.path === '/v1/api-key'
          ? ok({ ...mcpKey(), kind: 'STANDARD', mode, livemode: mode === 'live', scopes: 'all', policy: null })
          : c.path === '/v1/payments/stk'
            ? ok({ transactionId: TX, status: 'PENDING' })
            : undefined,
    });
    await s.call('palpluss_send_stk_push', { amount: 100, phone: '0712345678' });
    expect(s.prompts).toHaveLength(0); // test mode
    mode = 'live';
    await s.call('palpluss_send_stk_push', { amount: 100, phone: '0712345678' });
    expect(s.prompts).toHaveLength(1); // switched to live: the person is asked again
    await s.close();
  });
});

describe('0.2.1: signing domains and payment link deletion', () => {
  const LINK = '55555555-5555-4555-8555-555555555555';

  it('lists signing domains without secrets', async () => {
    const s = await connect({
      route: (c) => (c.path === '/v1/webhook-signing/domains' ? ok({ items: [{ domain: 'api.shop.co.ke', rotating: false }] }) : undefined),
    });
    const r = await s.call('palpluss_list_signing_domains');
    expect(r.isError).toBe(false);
    expect(r.json.result.items[0].domain).toBe('api.shop.co.ke');
    await s.close();
  });

  it('deletes a payment link only with permanent: true, after approval', async () => {
    const s = await connect({
      toolsets: ['collect'],
      route: (c) =>
        c.method === 'GET' && c.path === `/v1/payment-links/${LINK}`
          ? ok({ id: LINK, url: 'https://link.palpluss.com/x', amount: 100, status: 'DISABLED' })
          : c.method === 'DELETE'
            ? { status: 204 }
            : undefined,
    });
    const disable = await s.call('palpluss_disable_payment_link', { paymentLinkId: LINK });
    expect(disable.json.note).toContain('Already disabled');
    const del = await s.call('palpluss_disable_payment_link', { paymentLinkId: LINK, permanent: true });
    expect(del.json.result.status).toBe('DELETED');
    expect(s.prompts).toHaveLength(1);
    expect(s.prompts[0]).toContain('Delete a payment link');
    expect(s.api.calls.find((c) => c.method === 'DELETE')?.path).toBe(`/v1/payment-links/${LINK}?permanent=true`);
    await s.close();
  });

  it('explains the payment link limit', async () => {
    const s = await connect({
      toolsets: ['collect'],
      route: () => ({
        status: 400,
        body: { success: false, error: { code: 'HTTP_400', message: 'Limit', details: { code: 'PAYLINK_LIMIT_REACHED', message: 'Limit', details: { limit: 10 } } } },
      }),
    });
    const r = await s.call('palpluss_create_payment_link', { amount: 100 });
    expect(r.json.error.code).toBe('PAYLINK_LIMIT_REACHED');
    expect(r.json.hint).toContain('permanent: true');
    await s.close();
  });

  it('teaches signature verification in the webhooks guide', async () => {
    const s = await connect();
    const r = await s.call('palpluss_integration_guide', { topic: 'webhooks' });
    expect(r.text).toContain('webhook-signature');
    expect(r.text).toContain('whsec_');
    await s.close();
  });
});
