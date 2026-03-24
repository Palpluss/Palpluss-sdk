import type { HttpTransport } from '../http/transport.js';
import type {
  PaymentWalletChannel,
  CreateChannelRequest,
  UpdateChannelRequest,
} from '../types/channels.js';

export class ChannelsModule {
  constructor(private readonly transport: HttpTransport) {}

  async create(params: CreateChannelRequest): Promise<PaymentWalletChannel> {
    return this.transport.request<PaymentWalletChannel>('POST', '/payment-wallet/channels', {
      body: params as unknown as Record<string, unknown>,
    });
  }

  async update(id: string, params: UpdateChannelRequest): Promise<PaymentWalletChannel> {
    return this.transport.request<PaymentWalletChannel>('PATCH', `/payment-wallet/channels/${id}`, {
      body: params as unknown as Record<string, unknown>,
    });
  }

  async delete(id: string): Promise<void> {
    await this.transport.request<void>('DELETE', `/payment-wallet/channels/${id}`);
  }
}
