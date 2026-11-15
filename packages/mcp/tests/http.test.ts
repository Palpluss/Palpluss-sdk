import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Server } from 'node:http';
import { startHttpServer } from '../src/http.js';
import { resolveConfig } from '../src/config.js';
import { fakeApi, ok } from './helpers.js';

const TOKEN = 'test-token-0123456789abcdef-xyz';

describe('HTTP mode', () => {
  let http: Server;
  let base: string;
  const api = fakeApi((c) => (c.path === '/v1/b2c/payouts' ? ok({ transactionId: 'x', status: 'PROCESSING' }) : ok({ items: [] })));

  beforeAll(async () => {
    http = await startHttpServer({
      config: resolveConfig({ apiKey: 'pk_env', baseUrl: 'https://api.test', toolsets: ['payouts'] }),
      token: TOKEN,
      allowKeyHeader: true,
      port: 0,
      extra: { fetch: api.fetch },
    });
    base = `http://127.0.0.1:${(http.address() as AddressInfo).port}/mcp`;
  });
  afterAll(() => new Promise<void>((r) => http.close(() => r())));

  const connect = async (key: string) => {
    const client = new Client({ name: 'http-test', version: '1' }, { capabilities: { elicitation: { form: {} } } });
    let prompts = 0;
    client.setRequestHandler(ElicitRequestSchema, async () => {
      prompts += 1;
      return { action: 'accept', content: { approve: true } };
    });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(base), {
        requestInit: { headers: { Authorization: `Bearer ${TOKEN}`, 'X-PalPluss-Api-Key': key } },
      }),
    );
    return { client, prompts: () => prompts };
  };

  it('approval prompts work across requests in one session, using the per-request key', async () => {
    const { client, prompts } = await connect('pk_merchant_a');
    const res = (await client.callTool({ name: 'palpluss_send_payout', arguments: { amount: 100, phone: '0712345678' } })) as {
      isError?: boolean;
    };
    expect(res.isError).toBeFalsy();
    expect(prompts()).toBe(1);
    expect(api.calls.at(-1)?.headers.authorization).toBe('Basic pk_merchant_a');
    await client.close();
  });

  it('rejects requests without the bearer token', async () => {
    const res = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(res.status).toBe(401);
  });
});
