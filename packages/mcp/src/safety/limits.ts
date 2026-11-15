import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Limits } from '../config.js';
import { maskPhone } from './redact.js';

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Today's date in Nairobi, YYYY-MM-DD. */
export function nairobiDay(now: Date = new Date()): string {
  return new Date(now.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10);
}

interface DayTally {
  day: string;
  total: number;
  count: number;
}

export class LimitError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

/**
 * Per-key payout limits enforced by this MCP server: per payout, per day
 * (total and count) and an optional recipient allowlist.
 *
 * A payout reserves its amount before the API call and releases it if the
 * call fails, so two payouts approved at the same moment can't both slip
 * under the daily limit.
 *
 * These are a guardrail in front of the API, not a replacement for limits the
 * backend enforces; they reset if the state file is removed.
 */
export class PayoutLimiter {
  private static readonly shared = new Map<string, DayTally>();
  private readonly key: string;

  constructor(
    private readonly limits: Limits,
    apiKey: string,
    private readonly stateFile?: string,
    private readonly now: () => Date = () => new Date(),
  ) {
    // Tally per API key, never storing the key itself.
    this.key = createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
  }

  private load(): DayTally {
    const day = nairobiDay(this.now());
    let tally = PayoutLimiter.shared.get(this.key);
    if (!tally && this.stateFile) {
      try {
        const disk = JSON.parse(readFileSync(this.stateFile, 'utf8')) as Record<string, DayTally>;
        if (disk[this.key]) tally = disk[this.key];
      } catch {
        /* no state yet */
      }
    }
    if (!tally || tally.day !== day) tally = { day, total: 0, count: 0 };
    PayoutLimiter.shared.set(this.key, tally);
    return tally;
  }

  private persist(tally: DayTally) {
    PayoutLimiter.shared.set(this.key, tally);
    if (!this.stateFile) return;
    try {
      let disk: Record<string, DayTally> = {};
      try {
        disk = JSON.parse(readFileSync(this.stateFile, 'utf8'));
      } catch {
        /* fresh file */
      }
      disk[this.key] = tally;
      mkdirSync(dirname(this.stateFile), { recursive: true });
      const tmp = `${this.stateFile}.tmp`;
      writeFileSync(tmp, JSON.stringify(disk), { mode: 0o600 });
      renameSync(tmp, this.stateFile);
    } catch {
      /* best effort: the in-memory tally still applies */
    }
  }

  /** What's left today, for display. */
  remaining() {
    const t = this.load();
    return {
      day: t.day,
      usedTotal: t.total,
      usedCount: t.count,
      remainingTotal: Math.max(0, this.limits.dailyPayoutTotal - t.total),
      remainingCount: Math.max(0, this.limits.dailyPayoutCount - t.count),
    };
  }

  /** Throws LimitError if this payout isn't allowed. Does not reserve. */
  check(amount: number, phone: string) {
    const { maxPayout, dailyPayoutTotal, dailyPayoutCount, payoutAllowlist } = this.limits;
    if (payoutAllowlist.length && !payoutAllowlist.includes(phone)) {
      throw new LimitError(
        `${maskPhone(phone)} is not on this key's payout allowlist (PALPLUSS_MCP_PAYOUT_ALLOWLIST).`,
        'PAYOUT_RECIPIENT_NOT_ALLOWED',
      );
    }
    if (amount > maxPayout) {
      throw new LimitError(
        `KES ${amount.toLocaleString('en-KE')} is above the per-payout limit of KES ${maxPayout.toLocaleString('en-KE')} (PALPLUSS_MCP_MAX_PAYOUT).`,
        'PAYOUT_ABOVE_LIMIT',
      );
    }
    const t = this.load();
    if (t.count + 1 > dailyPayoutCount) {
      throw new LimitError(
        `Today's limit of ${dailyPayoutCount} payouts is used up (PALPLUSS_MCP_DAILY_PAYOUT_COUNT). It resets at midnight Nairobi time.`,
        'PAYOUT_DAILY_COUNT_REACHED',
      );
    }
    if (t.total + amount > dailyPayoutTotal) {
      throw new LimitError(
        `This payout would take today's total to KES ${(t.total + amount).toLocaleString('en-KE')}, above the daily limit of KES ${dailyPayoutTotal.toLocaleString('en-KE')} (PALPLUSS_MCP_DAILY_PAYOUT_TOTAL). KES ${Math.max(0, dailyPayoutTotal - t.total).toLocaleString('en-KE')} is left today.`,
        'PAYOUT_DAILY_TOTAL_REACHED',
      );
    }
  }

  /** Check and reserve atomically (single-threaded JS). Returns a release fn. */
  reserve(amount: number, phone: string): () => void {
    this.check(amount, phone);
    const t = this.load();
    const next = { day: t.day, total: t.total + amount, count: t.count + 1 };
    this.persist(next);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const cur = this.load();
      if (cur.day !== next.day) return;
      this.persist({ day: cur.day, total: Math.max(0, cur.total - amount), count: Math.max(0, cur.count - 1) });
    };
  }

  /** Test helper. */
  static resetAll() {
    PayoutLimiter.shared.clear();
  }
}
