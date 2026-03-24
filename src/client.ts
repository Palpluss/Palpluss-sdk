import { HttpTransport } from './http/transport.js';
import { StkModule } from './modules/stk.js';
import { B2cModule } from './modules/b2c.js';
import { WalletsModule } from './modules/wallets.js';
import { TransactionsModule } from './modules/transactions.js';
import { ChannelsModule } from './modules/channels.js';
import type { PalPlussOptions } from './types/common.js';

export class PalPluss {
  readonly stk: StkModule;
  readonly b2c: B2cModule;
  readonly wallets: WalletsModule;
  readonly transactions: TransactionsModule;
  readonly channels: ChannelsModule;

  constructor(options?: PalPlussOptions) {
    const apiKey = options?.apiKey ?? process.env.PALPLUSS_API_KEY;
    if (!apiKey) {
      throw new Error('PalPluss: apiKey is required');
    }

    const baseUrl =
      options?.baseUrl ??
      process.env.PALPLUSS_BASE_URL ??
      'https://api.palpluss.com/v1';

    const transport = new HttpTransport({
      apiKey,
      baseUrl,
      timeout: options?.timeout,
      autoRetryOnRateLimit: options?.autoRetryOnRateLimit,
      maxRetries: options?.maxRetries,
    });

    this.stk = new StkModule(transport);
    this.b2c = new B2cModule(transport);
    this.wallets = new WalletsModule(transport);
    this.transactions = new TransactionsModule(transport);
    this.channels = new ChannelsModule(transport);
  }
}
