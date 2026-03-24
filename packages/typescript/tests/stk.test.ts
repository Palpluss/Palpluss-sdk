import { StkModule } from '../src/modules/stk';
import type { HttpTransport } from '../src/http/transport';
import type { StkInitiateResponse } from '../src/types/stk';

describe('StkModule', () => {
  let mockTransport: jest.Mocked<HttpTransport>;
  let stk: StkModule;

  const stkResponse: StkInitiateResponse = {
    transactionId: 'tx-001',
    tenantId: 'tenant-001',
    channelId: null,
    type: 'STK',
    status: 'PENDING',
    amount: 100,
    currency: 'KES',
    phone: '254712345678',
    accountReference: 'ORDER-123',
    transactionDesc: 'Payment for order',
    providerRequestId: 'pr-001',
    providerCheckoutId: 'pc-001',
    resultCode: '0',
    resultDescription: 'Success',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    mockTransport = {
      request: jest.fn(),
    } as unknown as jest.Mocked<HttpTransport>;
    stk = new StkModule(mockTransport);
  });

  it('should call POST /payments/stk with params', async () => {
    mockTransport.request.mockResolvedValue(stkResponse);

    const params = {
      amount: 100,
      phone: '254712345678',
      accountReference: 'ORDER-123',
      transactionDesc: 'Payment for order',
    };

    const result = await stk.initiate(params);

    expect(mockTransport.request).toHaveBeenCalledWith('POST', '/payments/stk', {
      body: params,
    });
    expect(result).toEqual(stkResponse);
    expect(result.type).toBe('STK');
    expect(result.status).toBe('PENDING');
  });

  it('should pass optional fields', async () => {
    mockTransport.request.mockResolvedValue(stkResponse);

    const params = {
      amount: 500,
      phone: '254700000000',
      channelId: '550e8400-e29b-41d4-a716-446655440000',
      callbackUrl: 'https://example.com/callback',
      credential_id: '660e8400-e29b-41d4-a716-446655440000',
    };

    await stk.initiate(params);

    expect(mockTransport.request).toHaveBeenCalledWith('POST', '/payments/stk', {
      body: params,
    });
  });
});
