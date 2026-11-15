import { createHash } from 'node:crypto';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PalplussApiError, type PalplussClient } from '../api/client.js';
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
  TENANT_INACTIVE: 'This PalPluss account is not active. Contact PalPluss support.',
  INSUFFICIENT_SERVICE_BALANCE: 'Top up the service wallet (palpluss_topup_service_wallet) — it pays the per-transaction fees.',
  INSUFFICIENT_B2C_BALANCE: 'Top up the B2C wallet (palpluss_topup_b2c_wallet) before sending payouts.',
  STK_RATE_LIMITED: 'Too many payment prompts to this number. Wait the number of seconds in details.retryAfterSeconds.',
  TRANSACTION_HEALTH_BLOCKED: 'STK pushes are paused because too many recent prompts failed. Wait until details.blockedUntil.',
  KYC_NOT_APPROVED: 'Payouts need an approved KYC. Finish KYC in the PalPluss console.',
  NO_PAYMENT_CHANNELS: 'Add a payment channel first (palpluss_create_payment_channel, or in the console).',
  NO_DEFAULT_CHANNEL: 'Set a default channel (palpluss_set_default_payment_channel) or pass channelId.',
  RATE_LIMITED: 'The API key hit its rate limit. Slow down and retry shortly.',
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

/** Ask the person; throw a refusal unless they approve. Returns how it was approved. */
export async function requireApproval(ctx: ToolContext, req: ApprovalRequest): Promise<string> {
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
