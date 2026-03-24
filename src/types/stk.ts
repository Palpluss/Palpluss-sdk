export interface StkInitiateRequest {
  amount: number;
  phone: string;
  accountReference?: string;
  transactionDesc?: string;
  channelId?: string;
  callbackUrl?: string;
  credential_id?: string;
}

export interface StkInitiateResponse {
  transactionId: string;
  tenantId: string;
  channelId: string | null;
  type: 'STK';
  status: 'PENDING';
  amount: number;
  currency: string;
  phone: string;
  accountReference: string;
  transactionDesc: string;
  providerRequestId: string;
  providerCheckoutId: string;
  resultCode: string;
  resultDescription: string;
  createdAt: string;
  updatedAt: string;
}
