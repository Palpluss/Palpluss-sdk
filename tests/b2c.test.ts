import { B2cModule } from '../src/modules/b2c';
import type { HttpTransport } from '../src/http/transport';
import type { B2cPayoutResponse } from '../src/types/b2c';

describe('B2cModule', () => {
  let mockTransport: jest.Mocked<HttpTransport>;
  let b2c: B2cModule;

  const b2cResponse: B2cPayoutResponse = {
    transactionId: 'tx-b2c-001',
    tenantId: 'tenant-001',
    channelId: null,
    type: 'B2C',
    status: 'PENDING',
    amount: 1000,
    currency: 'KES',
    phone: '254712345678',
    reference: 'REF-001',
    description: 'Salary payout',
    providerRequestId: null,
    providerCheckoutId: null,
    resultCode: null,
    resultDescription: 'Queued',
    idempotencyKey: 'idem-001',
    channel: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    mockTransport = {
      request: jest.fn(),
    } as unknown as jest.Mocked<HttpTransport>;
    b2c = new B2cModule(mockTransport);
  });

  it('should auto-generate idempotency key when not provided', async () => {
    mockTransport.request.mockResolvedValue(b2cResponse);

    await b2c.payout({ amount: 1000, phone: '254712345678' });

    expect(mockTransport.request).toHaveBeenCalledWith(
      'POST',
      '/b2c/payouts',
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        ),
      }),
    );
  });

  it('should use provided idempotency key', async () => {
    mockTransport.request.mockResolvedValue(b2cResponse);

    await b2c.payout(
      { amount: 1000, phone: '254712345678' },
      { idempotencyKey: 'my-custom-key' },
    );

    expect(mockTransport.request).toHaveBeenCalledWith(
      'POST',
      '/b2c/payouts',
      expect.objectContaining({
        idempotencyKey: 'my-custom-key',
      }),
    );
  });

  it('should pass request body correctly', async () => {
    mockTransport.request.mockResolvedValue(b2cResponse);

    const params = {
      amount: 1000,
      phone: '254712345678',
      currency: 'KES' as const,
      reference: 'REF-001',
      description: 'Salary payout',
    };

    await b2c.payout(params);

    expect(mockTransport.request).toHaveBeenCalledWith(
      'POST',
      '/b2c/payouts',
      expect.objectContaining({
        body: params,
      }),
    );
  });

  it('should generate unique idempotency keys for each call', async () => {
    mockTransport.request.mockResolvedValue(b2cResponse);

    await b2c.payout({ amount: 100, phone: '254712345678' });
    await b2c.payout({ amount: 200, phone: '254712345678' });

    const call1 = mockTransport.request.mock.calls[0][2]!;
    const call2 = mockTransport.request.mock.calls[1][2]!;
    expect(call1.idempotencyKey).not.toBe(call2.idempotencyKey);
  });
});
