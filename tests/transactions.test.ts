import { TransactionsModule } from '../src/modules/transactions';
import type { HttpTransport } from '../src/http/transport';
import type { Transaction, TransactionListResponse } from '../src/types/transactions';

describe('TransactionsModule', () => {
  let mockTransport: jest.Mocked<HttpTransport>;
  let transactions: TransactionsModule;

  const sampleTransaction: Transaction = {
    transaction_id: 'tx-001',
    tenant_id: 'tenant-001',
    type: 'STK',
    status: 'SUCCESS',
    amount: 100,
    currency: 'KES',
    phone_number: '254712345678',
    channel_id: null,
    external_reference: 'REF-001',
    customer_name: 'John Doe',
    callback_url: 'https://example.com/callback',
    provider: 'MPESA',
    provider_request_id: 'pr-001',
    provider_checkout_id: 'pc-001',
    result_code: '0',
    result_desc: 'Success',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    mockTransport = {
      request: jest.fn(),
    } as unknown as jest.Mocked<HttpTransport>;
    transactions = new TransactionsModule(mockTransport);
  });

  describe('get', () => {
    it('should call GET /transactions/:id', async () => {
      mockTransport.request.mockResolvedValue(sampleTransaction);

      const result = await transactions.get('tx-001');

      expect(mockTransport.request).toHaveBeenCalledWith('GET', '/transactions/tx-001');
      expect(result).toEqual(sampleTransaction);
    });
  });

  describe('list', () => {
    const listResponse: TransactionListResponse = {
      items: [sampleTransaction],
      next_cursor: 'cursor-abc',
    };

    it('should call GET /transactions with default params', async () => {
      mockTransport.request.mockResolvedValue(listResponse);

      const result = await transactions.list();

      expect(mockTransport.request).toHaveBeenCalledWith('GET', '/transactions', {
        query: {
          limit: undefined,
          cursor: undefined,
          status: undefined,
          type: undefined,
        },
      });
      expect(result.items).toHaveLength(1);
    });

    it('should pass query params correctly', async () => {
      mockTransport.request.mockResolvedValue(listResponse);

      await transactions.list({ limit: 10, cursor: 'abc', status: 'SUCCESS', type: 'STK' });

      expect(mockTransport.request).toHaveBeenCalledWith('GET', '/transactions', {
        query: {
          limit: 10,
          cursor: 'abc',
          status: 'SUCCESS',
          type: 'STK',
        },
      });
    });

    it('should pass through next_cursor for pagination', async () => {
      const responseWithCursor: TransactionListResponse = {
        items: [sampleTransaction],
        next_cursor: 'next-page-cursor',
      };
      mockTransport.request.mockResolvedValue(responseWithCursor);

      const result = await transactions.list({ cursor: 'prev-cursor' });
      expect(result.next_cursor).toBe('next-page-cursor');
    });

    it('should handle null next_cursor at end of results', async () => {
      const lastPage: TransactionListResponse = {
        items: [],
        next_cursor: null,
      };
      mockTransport.request.mockResolvedValue(lastPage);

      const result = await transactions.list();
      expect(result.next_cursor).toBeNull();
      expect(result.items).toHaveLength(0);
    });
  });
});
