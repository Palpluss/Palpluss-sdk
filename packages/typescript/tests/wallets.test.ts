import { WalletsModule } from '../src/modules/wallets';
import type { HttpTransport } from '../src/http/transport';
import type { ServiceWalletBalance, ServiceTopupResponse } from '../src/types/wallets';

describe('WalletsModule', () => {
  let mockTransport: jest.Mocked<HttpTransport>;
  let wallets: WalletsModule;

  const balanceResponse: ServiceWalletBalance = {
    walletId: 'wal-001',
    tenantId: 'tenant-001',
    currency: 'KES',
    availableBalance: 50000,
    ledgerBalance: 55000,
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  const topupResponse: ServiceTopupResponse = {
    transactionId: 'tx-topup-001',
    tenantId: 'tenant-001',
    type: 'WALLET_TOPUP_SERVICE_TOKENS',
    status: 'PENDING',
    amount: 10000,
    currency: 'KES',
    phone: '254712345678',
    accountReference: 'TOPUP-001',
    transactionDesc: 'Wallet topup',
    providerRequestId: 'pr-001',
    providerCheckoutId: 'pc-001',
    resultCode: '0',
    resultDescription: 'Success',
    idempotencyKey: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    mockTransport = {
      request: jest.fn(),
    } as unknown as jest.Mocked<HttpTransport>;
    wallets = new WalletsModule(mockTransport);
  });

  describe('serviceBalance', () => {
    it('should call GET /wallets/service/balance', async () => {
      mockTransport.request.mockResolvedValue(balanceResponse);

      const result = await wallets.serviceBalance();

      expect(mockTransport.request).toHaveBeenCalledWith('GET', '/wallets/service/balance');
      expect(result).toEqual(balanceResponse);
      expect(result.availableBalance).toBe(50000);
    });
  });

  describe('serviceTopup', () => {
    it('should call POST /wallets/service/topups with params', async () => {
      mockTransport.request.mockResolvedValue(topupResponse);

      const params = {
        amount: 10000,
        phone: '254712345678',
        accountReference: 'TOPUP-001',
        transactionDesc: 'Wallet topup',
      };

      const result = await wallets.serviceTopup(params);

      expect(mockTransport.request).toHaveBeenCalledWith('POST', '/wallets/service/topups', {
        body: params,
        idempotencyKey: undefined,
      });
      expect(result.type).toBe('WALLET_TOPUP_SERVICE_TOKENS');
    });

    it('should forward idempotency key', async () => {
      mockTransport.request.mockResolvedValue(topupResponse);

      await wallets.serviceTopup(
        { amount: 5000, phone: '254712345678' },
        { idempotencyKey: 'topup-idem-key' },
      );

      expect(mockTransport.request).toHaveBeenCalledWith('POST', '/wallets/service/topups', {
        body: { amount: 5000, phone: '254712345678' },
        idempotencyKey: 'topup-idem-key',
      });
    });
  });
});
