import { randomUUID } from 'node:crypto';
import type { HttpTransport } from '../http/transport.js';
import type { B2cPayoutRequest, B2cPayoutResponse } from '../types/b2c.js';

export interface B2cPayoutOptions {
  idempotencyKey?: string;
}

export class B2cModule {
  constructor(private readonly transport: HttpTransport) {}

  async payout(
    params: B2cPayoutRequest,
    options?: B2cPayoutOptions,
  ): Promise<B2cPayoutResponse> {
    const idempotencyKey = options?.idempotencyKey ?? randomUUID();

    return this.transport.request<B2cPayoutResponse>('POST', '/b2c/payouts', {
      body: params as unknown as Record<string, unknown>,
      idempotencyKey,
    });
  }
}
