/**
 * Minimal client for the PalPluss developer API (/v1). Every call goes through
 * the public API, so PalPluss's own limits — rate limits, per-phone velocity
 * limits, STK abuse protection, transaction health — always apply.
 */

export const USER_AGENT = 'palpluss-mcp/0.2.0';

export class PalplussApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'PalplussApiError';
  }
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface ClientOptions {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  fetch?: FetchLike;
}

export interface TransactionListQuery {
  limit?: number;
  cursor?: string;
  status?: string;
  type?: 'STK' | 'B2C';
}

export interface StkPushBody {
  amount: number;
  phone: string;
  accountReference?: string;
  transactionDesc?: string;
  channelId?: string;
  callbackUrl?: string;
}

export interface TopupBody {
  amount: number;
  phone: string;
  accountReference?: string;
  transactionDesc?: string;
  callbackUrl?: string;
}

export interface PayoutBody {
  amount: number;
  phone: string;
  currency?: 'KES';
  reference?: string;
  description?: string;
  channelId?: string;
  callbackUrl?: string;
}

export interface ChannelCreateBody {
  name: string;
  type: 'PAYBILL' | 'TILL' | 'SHORTCODE';
  shortcode: string;
  accountNumber?: string;
  isDefault?: boolean;
}

export type ChannelUpdateBody = Partial<ChannelCreateBody> & { accountNumber?: string | null };

export interface WalletHistoryQuery {
  wallet?: 'service' | 'b2c';
  category?: 'charge' | 'topup' | 'refund' | 'payout' | 'bonus' | 'other';
  limit?: number;
  cursor?: string;
}

export interface PaymentLinkBody {
  amount?: number;
  phone_number?: string;
  customer_name?: string;
  external_reference?: string;
  channel_id?: string;
  callbackUrl?: string;
  expiry?: '1h' | '6h' | '24h' | '72h' | '168h' | '720h' | 'never';
}

/** GET /v1/api-key — the key this server runs with. */
export interface KeyInfo {
  id: string;
  name: string;
  kind: 'STANDARD' | 'MCP';
  mode: 'live' | 'test';
  livemode: boolean;
  scopes: 'all' | { scope: string; label: string }[];
  expiresAt: string | null;
  connectedApp: string | null;
  policy: null | {
    payoutMax: number;
    dailyPayoutTotal: number;
    dailyPayoutCount: number;
    payoutAllowlist: string[];
    approvals: { payouts: boolean; channels: boolean };
    payoutsToday: { total: number; count: number; remainingTotal: number; remainingCount: number };
  };
}

/** Returned (HTTP 202) when PalPluss holds a request for the merchant's approval. */
export interface PendingApproval {
  status: 'PENDING_APPROVAL';
  approvalId: string;
  action: string;
  expiresAt: string;
  approveUrl: string;
  message: string;
}

export function isPendingApproval(value: unknown): value is PendingApproval {
  return !!value && typeof value === 'object' && (value as { status?: unknown }).status === 'PENDING_APPROVAL' && 'approvalId' in value;
}

type Json = Record<string, unknown>;

export class PalplussClient {
  private readonly fetchImpl: FetchLike;

  constructor(private readonly opts: ClientOptions) {
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
  }

  private async request<T = Json>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    options: { query?: Record<string, unknown>; body?: unknown; idempotencyKey?: string } = {},
  ): Promise<T> {
    const url = new URL(`${this.opts.baseUrl}/v1${path}`);
    for (const [k, v] of Object.entries(options.query ?? {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = {
      Authorization: `Basic ${this.opts.apiKey}`,
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(url.toString(), {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch (err) {
      const aborted = (err as { name?: string })?.name === 'AbortError';
      throw new PalplussApiError(
        aborted
          ? `PalPluss did not answer within ${Math.round(this.opts.timeoutMs / 1000)}s.`
          : `Could not reach PalPluss at ${this.opts.baseUrl}.`,
        0,
        aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
      );
    } finally {
      clearTimeout(timer);
    }

    const requestId = res.headers.get('x-request-id') ?? undefined;
    if (res.status === 204) return undefined as T;

    // Never JSON.parse an HTML error page (proxies, gateways, maintenance).
    const contentType = res.headers.get('content-type') ?? '';
    const text = await res.text();
    if (!contentType.includes('json')) {
      throw new PalplussApiError(
        `PalPluss returned an unexpected ${res.status} response (${contentType || 'no content type'}).`,
        res.status,
        'NON_JSON_RESPONSE',
        undefined,
        requestId,
      );
    }
    let payload: { success?: boolean; data?: unknown; error?: { message?: unknown; code?: string; details?: unknown } };
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new PalplussApiError('PalPluss returned malformed JSON.', res.status, 'MALFORMED_RESPONSE', undefined, requestId);
    }
    if (!res.ok || payload.success === false) {
      const e = (payload.error ?? {}) as { message?: unknown; code?: string; details?: unknown };
      // The API's error filter reports `code` as HTTP_<status> and keeps the
      // specific code (e.g. KYC_NOT_VERIFIED) in details.code — prefer that.
      const details = e.details && typeof e.details === 'object' ? (e.details as Record<string, unknown>) : undefined;
      const specific = typeof details?.code === 'string' ? details.code : undefined;
      const code = specific && (!e.code || /^HTTP_\d+$/.test(e.code)) ? specific : e.code || `HTTP_${res.status}`;
      // Validation errors arrive with message as an array of strings.
      const message = Array.isArray(e.message) ? e.message.join('; ') : typeof e.message === 'string' ? e.message : '';
      // The filter wraps the original body ({ message, code, details }) in
      // error.details; surface the inner details (e.g. retryAfterSeconds) directly.
      const inner = details && details.details && typeof details.details === 'object' ? details.details : undefined;
      throw new PalplussApiError(message || `PalPluss request failed (${res.status}).`, res.status, code, inner ?? e.details, requestId);
    }
    return (payload.data ?? payload) as T;
  }

  listTransactions(query: TransactionListQuery = {}) {
    return this.request('GET', '/transactions', { query: { ...query } });
  }

  getTransaction(id: string) {
    return this.request('GET', `/transactions/${encodeURIComponent(id)}`);
  }

  serviceWalletBalance() {
    return this.request('GET', '/wallets/service/balance');
  }

  b2cWalletBalance() {
    return this.request('GET', '/wallets/b2c/balance');
  }

  topupServiceWallet(body: TopupBody, idempotencyKey: string) {
    return this.request('POST', '/wallets/service/topups', { body, idempotencyKey });
  }

  topupB2cWallet(body: TopupBody, idempotencyKey: string) {
    return this.request('POST', '/wallets/b2c/topups', { body, idempotencyKey });
  }

  listChannels() {
    return this.request<{ items?: Json[] }>('GET', '/payment-wallet/channels');
  }

  getChannel(id: string) {
    return this.request('GET', `/payment-wallet/channels/${encodeURIComponent(id)}`);
  }

  createChannel(body: ChannelCreateBody) {
    return this.request('POST', '/payment-wallet/channels', { body });
  }

  updateChannel(id: string, body: ChannelUpdateBody) {
    return this.request('PATCH', `/payment-wallet/channels/${encodeURIComponent(id)}`, { body });
  }

  deleteChannel(id: string) {
    return this.request('DELETE', `/payment-wallet/channels/${encodeURIComponent(id)}`);
  }

  stkPush(body: StkPushBody) {
    return this.request('POST', '/payments/stk', { body });
  }

  b2cPayout(body: PayoutBody, idempotencyKey: string) {
    return this.request('POST', '/b2c/payouts', { body, idempotencyKey });
  }

  keyInfo() {
    return this.request<KeyInfo>('GET', '/api-key');
  }

  walletHistory(query: WalletHistoryQuery = {}) {
    return this.request('GET', '/wallets/history', { query: { ...query } });
  }

  estimateFee(service: 'STK' | 'B2C', amount: number) {
    return this.request('GET', '/fees/estimate', { query: { service, amount } });
  }

  listPaymentLinks(query: { limit?: number; cursor?: string } = {}) {
    return this.request('GET', '/payment-links', { query: { ...query } });
  }

  getPaymentLink(id: string) {
    return this.request('GET', `/payment-links/${encodeURIComponent(id)}`);
  }

  createPaymentLink(body: PaymentLinkBody) {
    return this.request('POST', '/payment-links', { body });
  }

  disablePaymentLink(id: string) {
    return this.request('DELETE', `/payment-links/${encodeURIComponent(id)}`);
  }

  getApproval(id: string) {
    return this.request('GET', `/approvals/${encodeURIComponent(id)}`);
  }

  listApprovals(query: { status?: string; limit?: number; cursor?: string } = {}) {
    return this.request('GET', '/approvals', { query: { ...query } });
  }
}
