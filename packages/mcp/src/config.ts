import { normalizePhone } from './safety/redact.js';

/**
 * Groups of tools. `read` is always on; the rest are switched on explicitly.
 * Payouts and channel changes are off unless you name them.
 */
export const TOOLSETS = ['read', 'wallets', 'collect', 'channels', 'payouts'] as const;
export type Toolset = (typeof TOOLSETS)[number];

export const DEFAULT_TOOLSETS: Toolset[] = ['read', 'wallets', 'collect'];

/**
 * How money-moving and channel-changing tools get a human's yes:
 * - `elicit` (default): the MCP client shows the person an approval prompt;
 *   the AI never sees or answers it. Clients without that support are refused.
 * - `none`: no prompt. Only for automated tests against a fake or local API, never a live key.
 */
export type ApprovalMode = 'elicit' | 'none';

export interface Limits {
  /** Largest single B2C payout, KES. */
  maxPayout: number;
  /** Total B2C payouts per Nairobi calendar day, KES. */
  dailyPayoutTotal: number;
  /** Number of B2C payouts per Nairobi calendar day. */
  dailyPayoutCount: number;
  /** Largest wallet top-up, KES. */
  maxTopup: number;
  /** Largest STK push request, KES. */
  maxStk: number;
  /** If non-empty, payouts may only go to these numbers (254XXXXXXXXX). */
  payoutAllowlist: string[];
}

export interface PalplussMcpConfig {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  toolsets: Toolset[];
  /** Kill switch: when true, every tool that changes anything is refused. */
  readOnly: boolean;
  approval: ApprovalMode;
  limits: Limits;
  /** Where to keep the daily payout tally between restarts (stdio installs). */
  stateFile?: string;
  /** Append-only JSON-lines audit log of every tool call. */
  auditFile?: string;
}

export const DEFAULT_BASE_URL = 'https://api.palpluss.com';

export const DEFAULT_LIMITS: Limits = {
  maxPayout: 5_000,
  dailyPayoutTotal: 20_000,
  dailyPayoutCount: 20,
  maxTopup: 50_000,
  maxStk: 150_000,
  payoutAllowlist: [],
};

export class ConfigError extends Error {}

function num(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new ConfigError(`${key} must be a non-negative number (got "${raw}").`);
  }
  return n;
}

function bool(env: NodeJS.ProcessEnv, key: string, fallback: boolean): boolean {
  const raw = env[key]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  throw new ConfigError(`${key} must be true or false (got "${env[key]}").`);
}

export function parseToolsets(raw: string | undefined): Toolset[] {
  if (!raw || !raw.trim()) return [...DEFAULT_TOOLSETS];
  const wanted = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (wanted.includes('all')) return [...TOOLSETS];
  const unknown = wanted.filter((t) => !(TOOLSETS as readonly string[]).includes(t));
  if (unknown.length) {
    throw new ConfigError(
      `Unknown toolset(s): ${unknown.join(', ')}. Use any of: ${TOOLSETS.join(', ')} (or "all").`,
    );
  }
  return [...new Set<Toolset>(['read', ...(wanted as Toolset[])])];
}

export function parseAllowlist(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) return [];
  const out: string[] = [];
  for (const part of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const phone = normalizePhone(part);
    if (!phone) throw new ConfigError(`PALPLUSS_MCP_PAYOUT_ALLOWLIST has an invalid phone number: "${part}".`);
    out.push(phone);
  }
  return [...new Set(out)];
}

/** Build the configuration from environment variables (the CLI path). */
export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): PalplussMcpConfig {
  const apiKey = env.PALPLUSS_API_KEY?.trim();
  if (!apiKey) {
    throw new ConfigError(
      'PALPLUSS_API_KEY is not set. Create a key at console.palpluss.com → API Keys and pass it as an environment variable.',
    );
  }
  const approval = (env.PALPLUSS_MCP_APPROVAL?.trim().toLowerCase() || 'elicit') as ApprovalMode;
  if (approval !== 'elicit' && approval !== 'none') {
    throw new ConfigError('PALPLUSS_MCP_APPROVAL must be "elicit" or "none".');
  }
  return {
    apiKey,
    baseUrl: (env.PALPLUSS_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    timeoutMs: num(env, 'PALPLUSS_MCP_TIMEOUT_MS', 30_000),
    toolsets: parseToolsets(env.PALPLUSS_MCP_TOOLSETS),
    readOnly: bool(env, 'PALPLUSS_MCP_READ_ONLY', false),
    approval,
    limits: {
      maxPayout: num(env, 'PALPLUSS_MCP_MAX_PAYOUT', DEFAULT_LIMITS.maxPayout),
      dailyPayoutTotal: num(env, 'PALPLUSS_MCP_DAILY_PAYOUT_TOTAL', DEFAULT_LIMITS.dailyPayoutTotal),
      dailyPayoutCount: num(env, 'PALPLUSS_MCP_DAILY_PAYOUT_COUNT', DEFAULT_LIMITS.dailyPayoutCount),
      maxTopup: num(env, 'PALPLUSS_MCP_MAX_TOPUP', DEFAULT_LIMITS.maxTopup),
      maxStk: num(env, 'PALPLUSS_MCP_MAX_STK', DEFAULT_LIMITS.maxStk),
      payoutAllowlist: parseAllowlist(env.PALPLUSS_MCP_PAYOUT_ALLOWLIST),
    },
    stateFile: env.PALPLUSS_MCP_STATE_FILE?.trim() || undefined,
    auditFile: env.PALPLUSS_MCP_AUDIT_FILE?.trim() || undefined,
  };
}

/** Fill in defaults for programmatic use (embedding in another app). */
export function resolveConfig(input: Partial<PalplussMcpConfig> & { apiKey: string }): PalplussMcpConfig {
  if (!input.apiKey?.trim()) throw new ConfigError('apiKey is required.');
  return {
    apiKey: input.apiKey.trim(),
    baseUrl: (input.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
    timeoutMs: input.timeoutMs ?? 30_000,
    toolsets: input.toolsets ? [...new Set<Toolset>(['read', ...input.toolsets])] : [...DEFAULT_TOOLSETS],
    readOnly: input.readOnly ?? false,
    approval: input.approval ?? 'elicit',
    limits: {
      ...DEFAULT_LIMITS,
      ...input.limits,
      payoutAllowlist: (input.limits?.payoutAllowlist ?? []).map((p) => {
        const n = normalizePhone(p);
        if (!n) throw new ConfigError(`Invalid allowlist phone number: "${p}".`);
        return n;
      }),
    },
    stateFile: input.stateFile,
    auditFile: input.auditFile,
  };
}
