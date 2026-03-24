import fetchMock from 'jest-fetch-mock';
import { HttpTransport } from '../src/http/transport';
import { PalPlussApiError, RateLimitError } from '../src/http/errors';

describe('HttpTransport', () => {
  const apiKey = 'pk_test_123';
  let transport: HttpTransport;

  beforeEach(() => {
    fetchMock.resetMocks();
    transport = new HttpTransport({
      apiKey,
      baseUrl: 'https://api.palpluss.com/v1',
      autoRetryOnRateLimit: false,
    });
  });

  it('should encode auth header correctly', async () => {
    const expectedBase64 = Buffer.from('pk_test_123:').toString('base64');

    fetchMock.mockResponseOnce(JSON.stringify({
      success: true,
      data: { ok: true },
      requestId: 'req-1',
    }));

    await transport.request('GET', '/test');

    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe(`Basic ${expectedBase64}`);
  });

  it('should set Content-Type for POST requests', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({
      success: true,
      data: { id: '1' },
      requestId: 'req-1',
    }));

    await transport.request('POST', '/payments/stk', { body: { amount: 100 } });

    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('should set Content-Type for PATCH requests', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({
      success: true,
      data: { id: '1' },
      requestId: 'req-1',
    }));

    await transport.request('PATCH', '/payment-wallet/channels/123', {
      body: { name: 'test' },
    });

    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('should unwrap response envelope', async () => {
    const data = { transactionId: 'tx-1', status: 'PENDING' };
    fetchMock.mockResponseOnce(JSON.stringify({
      success: true,
      data,
      requestId: 'req-1',
    }));

    const result = await transport.request('GET', '/transactions/tx-1');
    expect(result).toEqual(data);
  });

  it('should handle 204 No Content', async () => {
    fetchMock.mockResponseOnce('', { status: 204 });

    const result = await transport.request('DELETE', '/payment-wallet/channels/ch-1');
    expect(result).toBeUndefined();
  });

  it('should throw PalPlussApiError on error response', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        success: false,
        error: {
          message: 'Transaction not found',
          code: 'TRANSACTION_NOT_FOUND',
          details: {},
        },
        requestId: 'req-err',
      }),
      { status: 404 },
    );

    await expect(transport.request('GET', '/transactions/not-found')).rejects.toThrow(
      PalPlussApiError,
    );

    try {
      fetchMock.mockResponseOnce(
        JSON.stringify({
          success: false,
          error: {
            message: 'Transaction not found',
            code: 'TRANSACTION_NOT_FOUND',
            details: {},
          },
          requestId: 'req-err-2',
        }),
        { status: 404 },
      );
      await transport.request('GET', '/transactions/not-found');
    } catch (err) {
      const apiErr = err as PalPlussApiError;
      expect(apiErr.code).toBe('TRANSACTION_NOT_FOUND');
      expect(apiErr.httpStatus).toBe(404);
      expect(apiErr.requestId).toBe('req-err-2');
    }
  });

  it('should throw RateLimitError on 429', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        success: false,
        error: {
          message: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        requestId: 'req-rl',
      }),
      {
        status: 429,
        headers: { 'Retry-After': '30' },
      },
    );

    await expect(transport.request('POST', '/payments/stk', { body: {} })).rejects.toThrow(
      RateLimitError,
    );
  });

  it('should auto-retry on 429 when enabled', async () => {
    const retryTransport = new HttpTransport({
      apiKey,
      baseUrl: 'https://api.palpluss.com/v1',
      autoRetryOnRateLimit: true,
      maxRetries: 2,
    });

    fetchMock.mockResponses(
      [
        JSON.stringify({
          success: false,
          error: { message: 'Rate limit', code: 'RATE_LIMIT_EXCEEDED' },
          requestId: 'req-rl1',
        }),
        { status: 429, headers: { 'Retry-After': '0' } },
      ],
      [
        JSON.stringify({
          success: true,
          data: { ok: true },
          requestId: 'req-ok',
        }),
        { status: 200 },
      ],
    );

    const result = await retryTransport.request('GET', '/test');
    expect(result).toEqual({ ok: true });
    expect(fetchMock.mock.calls).toHaveLength(2);
  });

  it('should forward idempotency key header', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({
      success: true,
      data: { id: '1' },
      requestId: 'req-1',
    }));

    await transport.request('POST', '/b2c/payouts', {
      body: { amount: 100 },
      idempotencyKey: 'idem-key-123',
    });

    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('idem-key-123');
  });

  it('should forward requestId via x-request-id header', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({
      success: true,
      data: { ok: true },
      requestId: 'custom-req-id',
    }));

    await transport.request('GET', '/test', { requestId: 'custom-req-id' });

    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers['x-request-id']).toBe('custom-req-id');
  });

  it('should build URL with query parameters', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({
      success: true,
      data: { items: [], next_cursor: null },
      requestId: 'req-1',
    }));

    await transport.request('GET', '/transactions', {
      query: { limit: 10, status: 'SUCCESS', cursor: undefined },
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('limit=10');
    expect(url).toContain('status=SUCCESS');
    expect(url).not.toContain('cursor');
  });

  it('should handle trailing slash in baseUrl', () => {
    const t = new HttpTransport({
      apiKey: 'test',
      baseUrl: 'https://api.palpluss.com/v1/',
    });
    // The transport should strip the trailing slash internally
    // We verify by making a request and checking the URL
    fetchMock.mockResponseOnce(JSON.stringify({
      success: true,
      data: {},
      requestId: 'r',
    }));

    t.request('GET', '/test');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/test');
    expect(url).not.toContain('/v1//test');
  });
});
