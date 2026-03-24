import { ChannelsModule } from '../src/modules/channels';
import type { HttpTransport } from '../src/http/transport';
import type { PaymentWalletChannel } from '../src/types/channels';

describe('ChannelsModule', () => {
  let mockTransport: jest.Mocked<HttpTransport>;
  let channels: ChannelsModule;

  const sampleChannel: PaymentWalletChannel = {
    id: 'ch-001',
    tenantId: 'tenant-001',
    category: 'PAYMENT_WALLET',
    type: 'PAYBILL',
    shortcode: '123456',
    name: 'My Paybill',
    accountNumber: 'ACC001',
    isDefault: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    mockTransport = {
      request: jest.fn(),
    } as unknown as jest.Mocked<HttpTransport>;
    channels = new ChannelsModule(mockTransport);
  });

  describe('create', () => {
    it('should call POST /payment-wallet/channels', async () => {
      mockTransport.request.mockResolvedValue(sampleChannel);

      const params = {
        type: 'PAYBILL' as const,
        shortcode: '123456',
        name: 'My Paybill',
        accountNumber: 'ACC001',
        isDefault: true,
      };

      const result = await channels.create(params);

      expect(mockTransport.request).toHaveBeenCalledWith('POST', '/payment-wallet/channels', {
        body: params,
      });
      expect(result).toEqual(sampleChannel);
      expect(result.category).toBe('PAYMENT_WALLET');
    });
  });

  describe('update', () => {
    it('should call PATCH /payment-wallet/channels/:id', async () => {
      const updatedChannel = { ...sampleChannel, name: 'Updated Paybill' };
      mockTransport.request.mockResolvedValue(updatedChannel);

      const result = await channels.update('ch-001', { name: 'Updated Paybill' });

      expect(mockTransport.request).toHaveBeenCalledWith(
        'PATCH',
        '/payment-wallet/channels/ch-001',
        { body: { name: 'Updated Paybill' } },
      );
      expect(result.name).toBe('Updated Paybill');
    });
  });

  describe('delete', () => {
    it('should call DELETE /payment-wallet/channels/:id and return void', async () => {
      mockTransport.request.mockResolvedValue(undefined);

      const result = await channels.delete('ch-001');

      expect(mockTransport.request).toHaveBeenCalledWith(
        'DELETE',
        '/payment-wallet/channels/ch-001',
      );
      expect(result).toBeUndefined();
    });
  });
});
