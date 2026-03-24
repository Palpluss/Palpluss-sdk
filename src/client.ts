import { HttpTransport } from './http/transport.js';
import { StkModule } from './modules/stk.js';
import { B2cModule } from './modules/b2c.js';
import { WalletsModule } from './modules/wallets.js';
import { TransactionsModule } from './modules/transactions.js';
import { ChannelsModule } from './modules/channels.js';
import type { PalPlussOptions } from './types/common.js';
import type { StkInitiateRequest, StkInitiateResponse } from './types/stk.js';
import type { B2cPayoutRequest, B2cPayoutResponse } from './types/b2c.js';
import type { ServiceWalletBalance, ServiceTopupRequest, ServiceTopupResponse } from './types/wallets.js';
import type { Transaction, TransactionListParams, TransactionListResponse } from './types/transactions.js';
import type { PaymentWalletChannel, CreateChannelRequest, UpdateChannelRequest } from './types/channels.js';

const DEFAULT_BASE_URL = 'https://api.palpluss.com/v1';

export class PalPluss {
  private readonly _stk: StkModule;
  private readonly _b2c: B2cModule;
  private readonly _wallets: WalletsModule;
  private readonly _transactions: TransactionsModule;
  private readonly _channels: ChannelsModule;

  constructor(options?: PalPlussOptions) {
    const apiKey = options?.apiKey ?? process.env.PALPLUSS_API_KEY;
    if (!apiKey) {
      throw new Error('PalPluss: apiKey is required');
    }

    const baseUrl = process.env.PALPLUSS_BASE_URL ?? DEFAULT_BASE_URL;

    const transport = new HttpTransport({
      apiKey,
      baseUrl,
      timeout: options?.timeout,
      autoRetryOnRateLimit: options?.autoRetryOnRateLimit,
      maxRetries: options?.maxRetries,
    });

    this._stk = new StkModule(transport);
    this._b2c = new B2cModule(transport);
    this._wallets = new WalletsModule(transport);
    this._transactions = new TransactionsModule(transport);
    this._channels = new ChannelsModule(transport);
  }

  stkPush(params: StkInitiateRequest): Promise<StkInitiateResponse> {
    return this._stk.initiate(params);
  }

  b2cPayout(params: B2cPayoutRequest, options?: { idempotencyKey?: string }): Promise<B2cPayoutResponse> {
    return this._b2c.payout(params, options);
  }

  getServiceBalance(): Promise<ServiceWalletBalance> {
    return this._wallets.serviceBalance();
  }

  serviceTopup(params: ServiceTopupRequest, options?: { idempotencyKey?: string }): Promise<ServiceTopupResponse> {
    return this._wallets.serviceTopup(params, options);
  }

  getTransaction(id: string): Promise<Transaction> {
    return this._transactions.get(id);
  }

  listTransactions(params?: TransactionListParams): Promise<TransactionListResponse> {
    return this._transactions.list(params);
  }

  createChannel(params: CreateChannelRequest): Promise<PaymentWalletChannel> {
    return this._channels.create(params);
  }

  updateChannel(id: string, params: UpdateChannelRequest): Promise<PaymentWalletChannel> {
    return this._channels.update(id, params);
  }

  deleteChannel(id: string): Promise<void> {
    return this._channels.delete(id);
  }
}
