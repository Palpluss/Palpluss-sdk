import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createPalplussMcpServer, type CreateServerOptions } from '../src/server.js';
import type { AuditEvent } from '../src/safety/audit.js';

export interface FakeCall {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

type Route = (call: FakeCall) => { status?: number; body?: unknown; contentType?: string } | undefined;

/**
 * A fake PalPluss API: routes return envelopes; every call is recorded in
 * `calls`, except the server's own key lookups (GET /v1/api-key), which go to
 * `keyCalls` so tests can index the tool's real requests.
 */
export function fakeApi(route: Route) {
  const calls: FakeCall[] = [];
  const keyCalls: FakeCall[] = [];
  const fetch = async (input: string, init: RequestInit): Promise<Response> => {
    const url = new URL(input);
    const call: FakeCall = {
      method: String(init.method ?? 'GET'),
      path: url.pathname + url.search,
      headers: Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v])),
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    };
    (call.path === '/v1/api-key' ? keyCalls : calls).push(call);
    const r = route(call) ?? { status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'no route' } } };
    const status = r.status ?? 200;
    return new Response(r.contentType === 'text/html' ? String(r.body) : JSON.stringify(r.body ?? {}), {
      status,
      headers: { 'content-type': r.contentType ?? 'application/json', 'x-request-id': 'req-test' },
    });
  };
  return { fetch, calls, keyCalls };
}

export const ok = (data: unknown) => ({ body: { success: true, data, requestId: 'req-test' } });

type ElicitMode = 'approve' | 'decline' | 'cancel' | 'unsupported';

/**
 * Connect a real MCP client to the server in-process. `elicit` decides how the
 * "person" answers approval prompts; the prompts are captured.
 */
export async function connect(options: Partial<CreateServerOptions> & { elicit?: ElicitMode; route?: Route } = {}) {
  const { elicit = 'approve', route = () => undefined, ...serverOpts } = options;
  const api = fakeApi(route);
  const audit: AuditEvent[] = [];
  const { server, config } = createPalplussMcpServer({
    apiKey: 'pk_test_key',
    baseUrl: 'https://api.test',
    fetch: api.fetch,
    onAudit: (e) => audit.push(e),
    ...serverOpts,
  });

  const prompts: string[] = [];
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: elicit === 'unsupported' ? {} : { elicitation: { form: {} } } },
  );
  if (elicit !== 'unsupported') {
    client.setRequestHandler(ElicitRequestSchema, async (req) => {
      prompts.push(String((req.params as { message?: string }).message ?? ''));
      if (elicit === 'approve') return { action: 'accept', content: { approve: true } };
      if (elicit === 'cancel') return { action: 'cancel' };
      return { action: 'decline' };
    });
  }
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);

  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const res = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { type: string; text: string }[] };
    const text = res.content[0]?.text ?? '';
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { isError: !!res.isError, text, json };
  };

  return { client, server, config, api, audit, prompts, call, close: () => client.close() };
}
