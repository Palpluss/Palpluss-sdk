import type { HttpTransport } from '../http/transport.js';
import type { StkInitiateRequest, StkInitiateResponse } from '../types/stk.js';

export class StkModule {
  constructor(private readonly transport: HttpTransport) {}

  async initiate(params: StkInitiateRequest): Promise<StkInitiateResponse> {
    return this.transport.request<StkInitiateResponse>('POST', '/payments/stk', {
      body: params as unknown as Record<string, unknown>,
    });
  }
}
