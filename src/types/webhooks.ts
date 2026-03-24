import type { TransactionStatus, TransactionType } from './common.js';

export interface WebhookTransaction {
  id: string;
  tenant_id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  phone_number: string;
  external_reference: string | null;
  provider: string;
  provider_request_id: string | null;
  provider_checkout_id: string | null;
  result_code: string | null;
  result_desc: string | null;
  mpesa_receipt: string | null;
  created_at: string;
  updated_at: string;
}

export type WebhookEventType =
  | 'transaction.success'
  | 'transaction.failed'
  | 'transaction.cancelled'
  | 'transaction.expired'
  | 'transaction.updated';

export interface WebhookPayload {
  event: 'transaction.updated';
  event_type: WebhookEventType;
  transaction: WebhookTransaction;
}
