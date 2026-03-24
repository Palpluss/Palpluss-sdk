export interface B2cPayoutRequest {
  amount: number;
  phone: string;
  currency?: string;
  reference?: string;
  description?: string;
  channelId?: string;
  credential_id?: string;
  callback_url?: string;
}

export interface B2cPayoutResponse {
  transactionId: string;
  tenantId: string;
  channelId: string | null;
  type: 'B2C';
  status: 'PENDING';
  amount: number;
  currency: string;
  phone: string;
  reference: string | null;
  description: string | null;
  providerRequestId: string | null;
  providerCheckoutId: string | null;
  resultCode: string | null;
  resultDescription: string;
  idempotencyKey: string | null;
  channel: null;
  createdAt: string;
  updatedAt: string;
}
