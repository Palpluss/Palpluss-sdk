import fetchMock from 'jest-fetch-mock';
import { PalPluss } from '../src/client';

describe('PalPluss client', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    delete process.env.PALPLUSS_API_KEY;
    delete process.env.PALPLUSS_BASE_URL;
  });

  describe('constructor', () => {
    it('throws when apiKey is not provided', () => {
      expect(() => new PalPluss()).toThrow('apiKey is required');
    });

    it('reads apiKey from PALPLUSS_API_KEY env var', () => {
      process.env.PALPLUSS_API_KEY = 'pk_env_key';
      expect(() => new PalPluss()).not.toThrow();
    });

    it('accepts apiKey in options', () => {
      expect(() => new PalPluss({ apiKey: 'pk_test_123' })).not.toThrow();
    });

    it('options apiKey takes precedence over env var', async () => {
      process.env.PALPLUSS_API_KEY = 'pk_env_key';
      const client = new PalPluss({ apiKey: 'pk_explicit_key' });

      fetchMock.mockResponseOnce(JSON.stringify({
        success: true,
        data: { items: [], next_cursor: null },
        requestId: 'req-1',
      }));

      await client.listTransactions();

      const [, init] = fetchMock.mock.calls[0];
      const headers = init?.headers as Record<string, string>;
      const expected = 'Basic ' + Buffer.from('pk_explicit_key:').toString('base64');
      expect(headers['Authorization']).toBe(expected);
    });

    it('uses https://api.palpluss.com/v1 as default base URL', async () => {
      const client = new PalPluss({ apiKey: 'pk_test_123' });

      fetchMock.mockResponseOnce(JSON.stringify({
        success: true,
        data: { items: [], next_cursor: null },
        requestId: 'req-1',
      }));

      await client.listTransactions();

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('https://api.palpluss.com/v1/transactions');
    });

    it('reads base URL from PALPLUSS_BASE_URL env var', async () => {
      process.env.PALPLUSS_BASE_URL = 'https://sandbox.palpluss.com/v1';
      const client = new PalPluss({ apiKey: 'pk_test_123' });

      fetchMock.mockResponseOnce(JSON.stringify({
        success: true,
        data: { items: [], next_cursor: null },
        requestId: 'req-1',
      }));

      await client.listTransactions();

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('https://sandbox.palpluss.com/v1/transactions');
    });
  });

  describe('flat methods', () => {
    let client: PalPluss;

    const stkResponse = {
      transactionId: 'tx-stk-001',
      tenantId: 'tenant-001',
      channelId: null,
      type: 'STK',
      status: 'PENDING',
      amount: 500,
      currency: 'KES',
      phone: '254712345678',
      accountReference: 'ORDER-001',
      transactionDesc: 'Payment',
      providerRequestId: 'pr-001',
      providerCheckoutId: 'pc-001',
      resultCode: '0',
      resultDescription: 'Success',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    beforeEach(() => {
      client = new PalPluss({ apiKey: 'pk_test_123' });
    });

    it('stkPush calls POST /payments/stk', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({
        success: true,
        data: stkResponse,
        requestId: 'req-1',
      }));

      const result = await client.stkPush({ amount: 500, phone: '254712345678' });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/payments/stk');
      expect(init?.method).toBe('POST');
      expect(result.transactionId).toBe('tx-stk-001');
      expect(result.status).toBe('PENDING');
    });

    it('b2cPayout calls POST /b2c/payouts with auto-generated idempotency key', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({
        success: true,
        data: { transactionId: 'tx-b2c-001', type: 'B2C', status: 'PENDING' },
        requestId: 'req-1',
      }));

      await client.b2cPayout({ amount: 1000, phone: '254712345678' });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/b2c/payouts');
      expect(init?.method).toBe('POST');
      const headers = init?.headers as Record<string, string>;
      expect(headers['Idempotency-Key']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('b2cPayout uses provided idempotency key', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({
        success: true,
        data: { transactionId: 'tx-b2c-002', type: 'B2C', status: 'PENDING' },
        requestId: 'req-1',
      }));

      await client.b2cPayout(
        { amount: 1000, phone: '254712345678' },
        { idempotencyKey: 'my-key-001' },
      );

      const [, init] = fetchMock.mock.calls[0];
      const headers = init?.headers as Record<string, string>;
      expect(headers['Idempotency-Key']).toBe('my-key-001');
    });

    it('getServiceBalance calls GET /wallets/service/balance', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({
        success: true,
        data: { walletId: 'wal-1', availableBalance: 5000, currency: 'KES' },
        requestId: 'req-1',
      }));

      const result = await client.getServiceBalance();

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/wallets/service/balance');
      expect(init?.method).toBe('GET');
      expect(result.availableBalance).toBe(5000);
    });

    it('serviceTopup calls POST /wallets/service/topups', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({
        success: true,
        data: { transactionId: 'tx-topup-001', type: 'WALLET_TOPUP_SERVICE_TOKENS', status: 'PENDING' },
        requestId: 'req-1',
      }));

      await client.serviceTopup({ amount: 5000, phone: '254712345678' });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/wallets/service/topups');
      expect(init?.method).toBe('POST');
    });

    it('getTransaction calls GET /transactions/:id', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({
        success: true,
        data: { transaction_id: 'tx-001', status: 'SUCCESS', type: 'STK' },
        requestId: 'req-1',
      }));

      await client.getTransaction('tx-001');

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('/transactions/tx-001');
    });

    it('listTransactions calls GET /transactions', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({
        success: true,
        data: { items: [], next_cursor: null },
        requestId: 'req-1',
      }));

      const result = await client.listTransactions({ limit: 10, status: 'SUCCESS' });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('/transactions');
      expect(url).toContain('limit=10');
      expect(url).toContain('status=SUCCESS');
      expect(result.next_cursor).toBeNull();
    });

    it('createChannel calls POST /payment-wallet/channels', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({
        success: true,
        data: { id: 'ch-001', type: 'PAYBILL', category: 'PAYMENT_WALLET' },
        requestId: 'req-1',
      }));

      await client.createChannel({ type: 'PAYBILL', shortcode: '123456', name: 'My Paybill' });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/payment-wallet/channels');
      expect(init?.method).toBe('POST');
    });

    it('updateChannel calls PATCH /payment-wallet/channels/:id', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({
        success: true,
        data: { id: 'ch-001', name: 'New Name', category: 'PAYMENT_WALLET' },
        requestId: 'req-1',
      }));

      await client.updateChannel('ch-001', { name: 'New Name' });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/payment-wallet/channels/ch-001');
      expect(init?.method).toBe('PATCH');
    });

    it('deleteChannel calls DELETE /payment-wallet/channels/:id and returns void', async () => {
      fetchMock.mockResponseOnce('', { status: 204 });

      const result = await client.deleteChannel('ch-001');

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/payment-wallet/channels/ch-001');
      expect(init?.method).toBe('DELETE');
      expect(result).toBeUndefined();
    });
  });
});
