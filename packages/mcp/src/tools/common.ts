import { createHash } from 'node:crypto';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PalplussApiError, isPendingApproval, type KeyInfo, type PalplussClient } from '../api/client.js';
import type { PalplussMcpConfig } from '../config.js';
import type { ApprovalRequest, Approver } from '../safety/approval.js';
import type { AuditLog } from '../safety/audit.js';
import { LimitError, nairobiDay, type PayoutLimiter } from '../safety/limits.js';
import { normalizePhone, shapeForModel, UNTRUSTED_NOTE } from '../safety/redact.js';

export interface ToolContext {
  server: McpServer;
  client: PalplussClient;
  config: PalplussMcpConfig;
  approver: Approver;
  audit: AuditLog;
  limiter: PayoutLimiter;
  /**
   * The key this server runs with (kind, mode, permissions, limits). Cached for
   * a minute; pass `{ fresh: true }` before any approval decision, because a
   * key can be switched between test and live at any time.
   */
  keyInfo: (opts?: { fresh?: boolean }) => Promise<KeyInfo>;
}

/** Assumed when the API can't say (an older API without GET /v1/api-key). */
const UNKNOWN_KEY: KeyInfo = {
  id: '',
  name: '',
  kind: 'STANDARD',
  mode: 'live',
  livemode: true,
  scopes: 'all',
  expiresAt: null,
  connectedApp: null,
  policy: null,
};

/** Fetch GET /v1/api-key at most once a minute. */
export function cachedKeyInfo(client: PalplussClient): (opts?: { fresh?: boolean }) => Promise<KeyInfo> {
  let cached: { at: number; value: Promise<KeyInfo> } | null = null;
  return (opts) => {
    if (opts?.fresh || !cached || Date.now() - cached.at > 60_000) {
      const value = client.keyInfo().catch((err: unknown) => {
        // Only "this endpoint doesn't exist" means an older API; anything else must surface.
        if (err instanceof PalplussApiError && err.status === 404) return UNKNOWN_KEY;
        cached = null;
        throw err;
      });
      cached = { at: Date.now(), value };
    }
    return cached.value;
  };
}

/** A refusal we raise ourselves (bad input, limits, declined approval). */
export class ToolRefusal extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly outcome: 'refused' | 'declined' = 'refused',
  ) {
    super(message);
  }
}

export function ok(data: unknown, extra?: { note?: string; next?: string }): CallToolResult {
  const body: Record<string, unknown> = { result: shapeForModel(data) };
  if (extra?.note) body.note = extra.note;
  if (extra?.next) body.next = extra.next;
  body.dataPolicy = UNTRUSTED_NOTE;
  return { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }] };
}

function errorResult(code: string, message: string, hint?: string): CallToolResult {
  const body: Record<string, unknown> = { error: { code, message } };
  if (hint) body.hint = hint;
  return { isError: true, content: [{ type: 'text', text: JSON.stringify(body, null, 2) }] };
}

/** Plain-language next steps for common PalPluss error codes. */
const HINTS: Record<string, string> = {
  INVALID_API_KEY: 'The API key was rejected. Create a new key at console.palpluss.com → API Keys.',
  AUTH_HEADER_INVALID: 'The API key is missing or malformed. Check PALPLUSS_API_KEY.',
  TENANT_INACTIVE: 'This PalPluss account is not active. Contact PalPluss support.',
  ACCOUNT_INACTIVE: 'This PalPluss account is not active. Contact PalPluss support.',
  INSUFFICIENT_SERVICE_BALANCE: 'Top up the service wallet (palpluss_topup_service_wallet) — it pays the per-transaction fees.',
  INSUFFICIENT_FUNDS: 'The B2C wallet does not have enough for this payout. Top it up (palpluss_topup_b2c_wallet) first.',
  KYC_NOT_VERIFIED: 'Payouts need approved KYC. Finish KYC in the PalPluss console.',
  STK_RATE_LIMITED: 'Too many payment prompts to this number. Wait the number of seconds in details.retryAfterSeconds.',
  WALLET_TOPUP_RATE_LIMITED: 'Too many top-up prompts to this number. Wait the number of seconds in details.retryAfterSeconds.',
  B2C_PAYOUT_COOLDOWN: 'Only one payout per phone number per minute. Wait a minute before paying this number again.',
  STK_TEMP_BANNED: 'STK pushes are temporarily blocked by abuse protection. Wait until details.bannedUntil.',
  TRANSACTION_HEALTH_BLOCKED: 'STK pushes are paused because too many recent prompts failed. Wait until details.blockedUntil.',
  NO_PAYMENT_CHANNELS: 'Add a payment channel first (palpluss_create_payment_channel, or in the console).',
  NO_DEFAULT_CHANNEL: 'Set a default channel (palpluss_set_default_payment_channel) or pass channelId.',
  CHANNEL_NOT_FOUND: 'No such payment channel on this account. List them with palpluss_list_payment_channels.',
  DUPLICATE_CHANNEL: 'This Paybill/account or Till is already a channel on this account.',
  RATE_LIMIT_EXCEEDED: 'The API key hit its rate limit (60 requests per minute). Slow down and retry shortly.',
  INSUFFICIENT_SCOPE: 'This key was not given that permission. The merchant can grant it in the PalPluss console under API Keys.',
  API_KEY_EXPIRED: 'This API key has expired. Create a new key in the PalPluss console.',
  INVALID_ACCESS_TOKEN: 'The sign-in has expired or was revoked. Sign in to PalPluss again.',
  IP_NOT_ALLOWED: 'This key only works from the IP addresses on its allowlist. Change the allowlist in the console under API Keys.',
  NOT_AVAILABLE_IN_TEST_MODE: 'Test keys cannot change live settings (payment channels, payment links). Use a live key for this.',
  PAYOUT_ABOVE_KEY_LIMIT: 'Above the per-payout limit set on this key in the PalPluss console.',
  PAYOUT_DAILY_TOTAL_REACHED: 'Today\'s payout limit (Nairobi time) is used up. The merchant can raise it in the console, or wait until tomorrow.',
  PAYOUT_DAILY_COUNT_REACHED: 'Today\'s payout count limit (Nairobi time) is used up. The merchant can raise it in the console, or wait until tomorrow.',
  PAYOUT_RECIPIENT_NOT_ALLOWED: 'This number is not on the payout allowlist. The merchant can add it in the console (or in PALPLUSS_MCP_PAYOUT_ALLOWLIST).',
  APPROVAL_REJECTED: 'The merchant declined this request in the PalPluss console. Nothing was done.',
  APPROVAL_EXPIRED: 'Nobody approved the request in time. Nothing was done; ask again if it is still needed.',
  PAYLINK_NOT_FOUND: 'No such payment link on this account. List them with palpluss_list_payment_links.',
  PAYLINK_LIMIT_REACHED: 'The account already has 10 payment links. Delete one it no longer needs (palpluss_disable_payment_link with permanent: true, after asking the person) and try again.',
  API_KEY_LIMIT_REACHED: 'The account already has 10 API keys. The merchant can delete one under API Keys in the console.',
  PRICING_RULE_NOT_FOUND: 'No fee rule on this account\'s plan covers that service and amount.',
};

/** Fallback next step when PalPluss returns an error without a specific code. */
function statusHint(status: number): string | undefined {
  if (status === 401) return 'The API key was rejected. Check PALPLUSS_API_KEY.';
  if (status === 403) {
    return 'PalPluss refused this for the account — for payouts the account must be active with approved KYC (finish KYC in the PalPluss console).';
  }
  if (status === 404) return 'Not found on this PalPluss account. Check the ID.';
  if (status === 409) return 'This conflicts with existing data (for example a duplicate channel).';
  if (status === 429) return 'Rate limited. Wait a little and try again.';
  if (status >= 500 || status === 0) return 'PalPluss is temporarily unavailable. Nothing was confirmed — check the transaction list before retrying.';
  return undefined;
}

/**
 * Wrap a tool body: audit every call, turn errors into readable tool results
 * instead of protocol failures, and never leak stack traces or keys.
 */
export function guarded<A>(ctx: ToolContext, tool: string, body: (args: A) => Promise<CallToolResult>) {
  return async (args: A): Promise<CallToolResult> => {
    try {
      const result = await body(args);
      ctx.audit.record({ tool, outcome: result.isError ? 'error' : 'ok', args });
      return result;
    } catch (err) {
      if (err instanceof ToolRefusal) {
        ctx.audit.record({ tool, outcome: err.outcome, args, code: err.code, message: err.message });
        return errorResult(err.code, err.message);
      }
      if (err instanceof LimitError) {
        ctx.audit.record({ tool, outcome: 'refused', args, code: err.code, message: err.message });
        return errorResult(err.code, err.message, 'Limits are set by whoever installed this MCP server. Do it in the PalPluss console, or ask them to raise the limit.');
      }
      if (err instanceof PalplussApiError) {
        ctx.audit.record({ tool, outcome: 'error', args, code: err.code, message: err.message, requestId: err.requestId });
        const detail = err.details && typeof err.details === 'object' ? { details: err.details } : {};
        const res = errorResult(err.code, err.message, HINTS[err.code] ?? statusHint(err.status));
        if (Object.keys(detail).length || err.requestId) {
          const parsed = JSON.parse((res.content[0] as { text: string }).text);
          Object.assign(parsed.error, detail, err.requestId ? { requestId: err.requestId } : {});
          (res.content[0] as { text: string }).text = JSON.stringify(parsed, null, 2);
        }
        return res;
      }
      ctx.audit.record({ tool, outcome: 'error', args, code: 'INTERNAL_ERROR', message: (err as Error)?.message });
      return errorResult('INTERNAL_ERROR', 'Something went wrong inside the PalPluss MCP server. Nothing further was attempted.');
    }
  };
}

/** What kind of governed action this is, for deciding who approves it. */
export type ActionKind = 'payout' | 'channel' | 'collect' | 'topup' | 'paylink';

/**
 * Ask for the human's yes, unless PalPluss itself already guarantees it:
 * - test keys move simulated money only, so nothing to approve;
 * - MCP keys whose payouts / channel changes PalPluss holds for console
 *   approval — asking twice would only add a step;
 * - in `backend` mode, MCP keys act within the permissions the merchant granted.
 * Returns a short note on how the action was cleared.
 */
export async function requireApproval(ctx: ToolContext, req: ApprovalRequest, kind: ActionKind): Promise<string> {
  const key = await ctx.keyInfo({ fresh: true });
  if (key.mode === 'test') return 'test mode: simulated money, no approval needed';
  if (key.kind === 'MCP' && key.policy) {
    if (kind === 'payout' && key.policy.approvals.payouts) return 'the merchant approves it in the PalPluss console';
    if (kind === 'channel' && key.policy.approvals.channels) return 'the merchant approves it in the PalPluss console';
  }
  if (ctx.config.approval === 'backend') {
    if (key.kind === 'MCP') return 'within the permissions the merchant granted this key';
    throw new ToolRefusal(
      'This server relies on PalPluss to approve actions, which needs an MCP key. Create an MCP key in the PalPluss console under API Keys.',
      'APPROVAL_UNAVAILABLE',
    );
  }
  const outcome = await ctx.approver(req);
  if (!outcome.approved) {
    throw new ToolRefusal(
      outcome.message,
      outcome.reason === 'unavailable' ? 'APPROVAL_UNAVAILABLE' : 'APPROVAL_DECLINED',
      outcome.reason === 'unavailable' ? 'refused' : 'declined',
    );
  }
  return outcome.via;
}

export function requirePhone(input: string, field = 'phone'): string {
  const phone = normalizePhone(input);
  if (!phone) {
    throw new ToolRefusal(
      `"${field}" is not a valid Kenyan mobile number. Use 07XXXXXXXX, 01XXXXXXXX or 2547XXXXXXXX.`,
      'INVALID_PHONE',
    );
  }
  return phone;
}

/**
 * Turn an API result into a tool result, recognising requests PalPluss is
 * holding for the merchant's approval.
 */
export function okOrPending(res: unknown, extra: { note: string; next?: string }): CallToolResult {
  if (isPendingApproval(res)) {
    return ok(res, {
      note: 'Nothing has happened yet: PalPluss is holding this until the merchant approves it in the console (Approvals). Tell the person, and do not say it is done.',
      next: `Call palpluss_wait_for_approval with approvalId ${res.approvalId}. It expires at ${res.expiresAt}.`,
    });
  }
  return ok(res, extra);
}

export function kes(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE')}`;
}

/**
 * Idempotency key for a money-moving call. With a caller reference it is
 * stable per reference; without one, identical requests (same action, amount,
 * phone) inside the same 10-minute window share a key, so an AI retrying after
 * a timeout can't send money twice.
 */
export function idempotencyKey(apiKey: string, parts: (string | number | undefined)[], reference?: string): string {
  const scope = createHash('sha256').update(apiKey).digest('hex').slice(0, 12);
  const window = reference ? `ref:${reference}` : `win:${nairobiDay()}:${Math.floor(Date.now() / 600_000)}`;
  const digest = createHash('sha256')
    .update([scope, ...parts.map((p) => String(p ?? '')), window].join('|'))
    .digest('hex')
    .slice(0, 40);
  return `mcp-${digest}`;
}

export function assertAmount(amount: number, { min, max, label }: { min: number; max: number; label: string }) {
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    throw new ToolRefusal(`${label} must be a whole number of Kenyan shillings.`, 'INVALID_AMOUNT');
  }
  if (amount < min) throw new ToolRefusal(`${label} must be at least ${kes(min)}.`, 'AMOUNT_TOO_LOW');
  if (amount > max) {
    throw new ToolRefusal(
      `${label} of ${kes(amount)} is above this server's limit of ${kes(max)}.`,
      'AMOUNT_ABOVE_LIMIT',
    );
  }
}
