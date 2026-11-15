import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApprovalMode } from '../config.js';

/** One action waiting for a human's yes. */
export interface ApprovalRequest {
  /** Stable action name, e.g. "b2c_payout". */
  action: string;
  /** One line a person can read at a glance. */
  title: string;
  /** Label → value pairs shown to the person (already masked where needed). */
  details: Record<string, string>;
  /** What happens if they approve, in plain words. */
  consequence: string;
}

export type ApprovalOutcome =
  | { approved: true; via: 'elicitation' | 'host' | 'disabled' }
  | { approved: false; reason: 'declined' | 'cancelled' | 'unavailable'; message: string };

/**
 * Decides whether an action may go ahead. An embedding app (such as Konaar)
 * can pass its own — for example one that opens its confirm dialog.
 */
export type Approver = (request: ApprovalRequest) => Promise<ApprovalOutcome>;

function renderMessage(req: ApprovalRequest): string {
  const lines = Object.entries(req.details).map(([k, v]) => `• ${k}: ${v}`);
  return [`PalPluss — ${req.title}`, '', ...lines, '', req.consequence, '', 'Approve only if you asked for this.'].join('\n');
}

/**
 * Ask the person directly through the MCP client (elicitation). The request
 * goes from this server to the person's app and back — the AI model never
 * sees or answers it, so it cannot approve its own actions.
 */
export function createElicitationApprover(server: McpServer): Approver {
  return async (req) => {
    const caps = server.server.getClientCapabilities();
    if (!caps?.elicitation) {
      return {
        approved: false,
        reason: 'unavailable',
        message:
          'This action needs your approval, but this app cannot show approval prompts (MCP elicitation). Use a client that supports them, or do it in the PalPluss console.',
      };
    }
    try {
      const result = await server.server.elicitInput({
        mode: 'form',
        message: renderMessage(req),
        requestedSchema: {
          type: 'object',
          properties: {
            approve: {
              type: 'boolean',
              title: 'Approve this action',
              description: req.title,
              default: false,
            },
          },
          required: ['approve'],
        },
      });
      if (result.action === 'accept' && result.content?.approve === true) {
        return { approved: true, via: 'elicitation' };
      }
      if (result.action === 'cancel') {
        return { approved: false, reason: 'cancelled', message: 'The approval prompt was dismissed. Nothing was done.' };
      }
      return { approved: false, reason: 'declined', message: 'You declined. Nothing was done.' };
    } catch (err) {
      return {
        approved: false,
        reason: 'unavailable',
        message: `Could not show the approval prompt (${(err as Error)?.message ?? 'unknown error'}). Nothing was done.`,
      };
    }
  };
}

/** Pick the approver for a server: the embedder's, the client prompt, or none. */
export function resolveApprover(mode: ApprovalMode, server: McpServer, custom?: Approver): Approver {
  if (custom) return custom;
  if (mode === 'none') return async () => ({ approved: true, via: 'disabled' });
  return createElicitationApprover(server);
}
