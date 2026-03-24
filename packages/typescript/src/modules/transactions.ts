import type { HttpTransport } from '../http/transport.js';
import type {
  Transaction,
  TransactionListParams,
  TransactionListResponse,
} from '../types/transactions.js';

export class TransactionsModule {
  constructor(private readonly transport: HttpTransport) {}

  async get(id: string): Promise<Transaction> {
    return this.transport.request<Transaction>('GET', `/transactions/${id}`);
  }

  async list(params?: TransactionListParams): Promise<TransactionListResponse> {
    return this.transport.request<TransactionListResponse>('GET', '/transactions', {
      query: {
        limit: params?.limit,
        cursor: params?.cursor,
        status: params?.status,
        type: params?.type,
      },
    });
  }
}
