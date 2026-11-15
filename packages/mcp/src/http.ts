import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PalplussMcpConfig } from './config.js';
import { createPalplussMcpServer, type CreateServerOptions } from './server.js';

export interface HttpServerOptions {
  /** Base configuration (from env). Its apiKey is used unless per-request keys are allowed. */
  config: PalplussMcpConfig;
  host?: string;
  port?: number;
  /**
   * Required bearer token for every request (PALPLUSS_MCP_HTTP_TOKEN). Protects
   * the endpoint so only the app you run it for can call it.
   */
  token: string;
  /**
   * Accept the merchant's PalPluss key in `X-PalPluss-Api-Key` when a session
   * starts (one endpoint serving many merchants). Off by default.
   */
  allowKeyHeader?: boolean;
  /** Close sessions idle longer than this (default 30 minutes). */
  sessionIdleMs?: number;
  extra?: Omit<CreateServerOptions, keyof PalplussMcpConfig>;
}

interface Session {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  keyHash: string;
  lastSeen: number;
}

const hash = (s: string) => createHash('sha256').update(s).digest();

function sameSecret(a: string, b: string): boolean {
  return timingSafeEqual(hash(a), hash(b));
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
}

const rpcError = (code: number, message: string) => ({ jsonrpc: '2.0', error: { code, message }, id: null });

async function readJson(req: IncomingMessage, limit = 1_000_000): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error('Request body too large');
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : undefined;
}

/**
 * Streamable HTTP endpoint at /mcp with sessions. Each session is one MCP
 * client connection with its own server, bound to the PalPluss key it started
 * with, so approval prompts (elicitation) and the client's capabilities carry
 * across requests. Requires a bearer token on every request.
 */
export function startHttpServer(opts: HttpServerOptions): Promise<Server> {
  const host = opts.host ?? '127.0.0.1';
  const port = opts.port ?? 3333;
  const idleMs = opts.sessionIdleMs ?? 30 * 60_000;
  if (!opts.token || opts.token.length < 24) {
    throw new Error('PALPLUSS_MCP_HTTP_TOKEN must be set to a random secret of at least 24 characters.');
  }

  const sessions = new Map<string, Session>();
  const closeSession = (id: string) => {
    const s = sessions.get(id);
    if (!s) return;
    sessions.delete(id);
    void s.transport.close();
    void s.server.close();
  };
  const sweeper = setInterval(() => {
    const cutoff = Date.now() - idleMs;
    for (const [id, s] of sessions) if (s.lastSeen < cutoff) closeSession(id);
  }, 60_000);
  sweeper.unref();

  const keyFor = (req: IncomingMessage): string => {
    const headerKey = req.headers['x-palpluss-api-key'];
    return opts.allowKeyHeader && typeof headerKey === 'string' && headerKey.trim() ? headerKey.trim() : opts.config.apiKey;
  };

  const httpServer = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      if (url.pathname === '/health') return send(res, 200, { ok: true, sessions: sessions.size });
      if (url.pathname !== '/mcp') return send(res, 404, { error: 'Not found' });

      const auth = req.headers.authorization ?? '';
      const presented = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
      if (!presented || !sameSecret(presented, opts.token)) return send(res, 401, rpcError(-32001, 'Unauthorized'));

      const apiKey = keyFor(req);
      if (!apiKey) return send(res, 400, rpcError(-32602, 'No PalPluss API key: set PALPLUSS_API_KEY or send X-PalPluss-Api-Key.'));
      const keyHash = hash(apiKey).toString('hex');

      const sessionId = req.headers['mcp-session-id'];
      const body = req.method === 'POST' ? await readJson(req) : undefined;

      if (typeof sessionId === 'string' && sessionId) {
        const s = sessions.get(sessionId);
        if (!s) return send(res, 404, rpcError(-32001, 'Session not found or expired. Reconnect.'));
        // A session belongs to the key that opened it.
        if (s.keyHash !== keyHash) return send(res, 403, rpcError(-32001, 'This session belongs to a different PalPluss key.'));
        s.lastSeen = Date.now();
        if (req.method === 'DELETE') {
          await s.transport.handleRequest(req, res, body);
          closeSession(sessionId);
          return;
        }
        return s.transport.handleRequest(req, res, body);
      }

      if (req.method !== 'POST' || !isInitializeRequest(body)) {
        return send(res, 400, rpcError(-32000, 'Start a session with an initialize request first.'));
      }

      const { server } = createPalplussMcpServer({ ...opts.config, ...opts.extra, apiKey });
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          sessions.set(id, { server, transport, keyHash, lastSeen: Date.now() });
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      if (!res.headersSent) send(res, 400, rpcError(-32700, (err as Error).message || 'Bad request'));
    }
  });
  httpServer.on('close', () => {
    clearInterval(sweeper);
    for (const id of [...sessions.keys()]) closeSession(id);
  });

  return new Promise((resolve) => httpServer.listen(port, host, () => resolve(httpServer)));
}

/**
 * Handle one MCP request without sessions: a fresh server and transport per
 * request, closed when the response ends. For hosts that run several
 * instances behind a load balancer (no shared session state).
 *
 * Elicitation needs a session, so approval prompts are not available here:
 * use `approval: 'backend'` with an MCP key (PalPluss holds payouts and
 * channel changes for console approval), or pass your own `approver`.
 *
 * `body` is the already-parsed JSON body (frameworks like Express or NestJS
 * parse it before your handler runs).
 */
export async function handleStatelessMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  body: unknown,
  options: CreateServerOptions,
): Promise<void> {
  const { server } = createPalplussMcpServer(options);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}
