import type { WebhookPayload } from './types/webhooks.js';

/**
 * Parse and validate a raw webhook payload string into a typed WebhookPayload.
 *
 * @param raw - The raw JSON string from the webhook request body.
 * @returns The parsed and validated WebhookPayload.
 * @throws Error if the payload is invalid or missing required fields.
 */
export function parseWebhookPayload(raw: string): WebhookPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON in webhook payload');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Webhook payload must be a JSON object');
  }

  const payload = parsed as Record<string, unknown>;

  if (payload.event !== 'transaction.updated') {
    throw new Error(`Unexpected webhook event: ${String(payload.event)}`);
  }

  if (typeof payload.event_type !== 'string') {
    throw new Error('Webhook payload missing event_type');
  }

  const validEventTypes = [
    'transaction.success',
    'transaction.failed',
    'transaction.cancelled',
    'transaction.expired',
    'transaction.updated',
  ];

  if (!validEventTypes.includes(payload.event_type)) {
    throw new Error(`Unknown event_type: ${payload.event_type}`);
  }

  if (typeof payload.transaction !== 'object' || payload.transaction === null) {
    throw new Error('Webhook payload missing transaction object');
  }

  const tx = payload.transaction as Record<string, unknown>;

  if (typeof tx.id !== 'string') {
    throw new Error('Webhook transaction missing id');
  }

  if (typeof tx.status !== 'string') {
    throw new Error('Webhook transaction missing status');
  }

  return payload as unknown as WebhookPayload;
}
