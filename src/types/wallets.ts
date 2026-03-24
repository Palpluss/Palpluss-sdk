export interface ServiceWalletBalance {
  walletId: string;
  tenantId: string;
  currency: string;
  availableBalance: number;
  ledgerBalance: number;
  updatedAt: string;
}

export interface ServiceTopupRequest {
  amount: number;
  phone: string;
  accountReference?: string;
  transactionDesc?: string;
}

export interface ServiceTopupResponse {
  transactionId: string;
  tenantId: string;
  type: 'WALLET_TOPUP_SERVICE_TOKENS';
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
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}
