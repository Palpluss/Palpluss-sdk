export type TransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REVERSED';

export type TransactionType = 'STK' | 'B2C' | 'WALLET_TOPUP_SERVICE_TOKENS';

export type ChannelType = 'PAYBILL' | 'TILL' | 'SHORTCODE';

export interface PalPlussOptions {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  autoRetryOnRateLimit?: boolean;
  maxRetries?: number;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  requestId: string;
}

export interface ApiErrorBody {
  message: string;
  code: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorBody;
  requestId: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
