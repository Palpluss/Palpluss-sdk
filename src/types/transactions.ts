import type { TransactionStatus, TransactionType } from './common.js';

export interface Transaction {
  transaction_id: string;
  tenant_id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  phone_number: string;
  channel_id: string | null;
  external_reference: string | null;
  customer_name: string | null;
  callback_url: string | null;
  provider: string;
  provider_request_id: string | null;
  provider_checkout_id: string | null;
  result_code: string | null;
  result_desc: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionListParams {
  limit?: number;
  cursor?: string;
  status?: string;
  type?: 'STK' | 'B2C';
}

export interface TransactionListResponse {
  items: Transaction[];
  next_cursor: string | null;
}
