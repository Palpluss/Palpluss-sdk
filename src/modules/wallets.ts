import type { HttpTransport } from '../http/transport.js';
import type {
  ServiceWalletBalance,
  ServiceTopupRequest,
  ServiceTopupResponse,
} from '../types/wallets.js';

export interface WalletTopupOptions {
  idempotencyKey?: string;
}

export class WalletsModule {
  constructor(private readonly transport: HttpTransport) {}

  async serviceBalance(): Promise<ServiceWalletBalance> {
    return this.transport.request<ServiceWalletBalance>('GET', '/wallets/service/balance');
  }

  async serviceTopup(
    params: ServiceTopupRequest,
    options?: WalletTopupOptions,
  ): Promise<ServiceTopupResponse> {
    return this.transport.request<ServiceTopupResponse>('POST', '/wallets/service/topups', {
      body: params as unknown as Record<string, unknown>,
      idempotencyKey: options?.idempotencyKey,
    });
  }
}
