import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { maskArgs } from './redact.js';

export interface AuditEvent {
  at: string;
  tool: string;
  outcome: 'ok' | 'error' | 'refused' | 'declined';
  /** Tool arguments with phone numbers masked. */
  args?: unknown;
  /** PalPluss transaction or channel id involved, if any. */
  ref?: string;
  code?: string;
  message?: string;
  approval?: string;
  requestId?: string;
}

export type AuditSink = (event: AuditEvent) => void;

/**
 * Records every tool call: to a JSON-lines file (PALPLUSS_MCP_AUDIT_FILE)
 * and/or to a sink an embedding app provides. Never logs the API key.
 */
export class AuditLog {
  constructor(
    private readonly file?: string,
    private readonly sink?: AuditSink,
  ) {
    if (file) {
      try {
        mkdirSync(dirname(file), { recursive: true });
      } catch {
        /* reported on first write */
      }
    }
  }

  record(event: Omit<AuditEvent, 'at' | 'args'> & { args?: unknown }) {
    const full: AuditEvent = { ...event, at: new Date().toISOString(), args: maskArgs(event.args) };
    if (this.file) {
      try {
        appendFileSync(this.file, `${JSON.stringify(full)}\n`, { mode: 0o600 });
      } catch (err) {
        process.stderr.write(`[palpluss-mcp] could not write audit log: ${(err as Error).message}\n`);
      }
    }
    try {
      this.sink?.(full);
    } catch {
      /* an embedder's sink must never break a tool call */
    }
  }
}
