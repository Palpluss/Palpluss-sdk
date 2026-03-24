import { PalPluss, PalPlussApiError, RateLimitError } from '../src';

async function main() {
  const palpluss = new PalPluss({
    apiKey: 'pk_test_your_api_key',
    // timeout: 30_000,
    // autoRetryOnRateLimit: true,
    // maxRetries: 3,
  });

  try {
    // --- STK Push ---
    const stk = await palpluss.stkPush({
      amount: 100,
      phone: '254712345678',
      accountReference: 'ORDER-001',
      transactionDesc: 'Payment for order #001',
      callbackUrl: 'https://your-server.com/webhooks/palpluss',
    });
    console.log('STK Push initiated:', stk.transactionId);
    console.log('Status:', stk.status); // PENDING

    // --- B2C Payout ---
    // Idempotency key is auto-generated per call
    const payout = await palpluss.b2cPayout({
      amount: 1000,
      phone: '254712345678',
      currency: 'KES',
      reference: 'SALARY-JAN-001',
      description: 'January salary payment',
    });
    console.log('B2C Payout queued:', payout.transactionId);

    // Supply your own idempotency key for safe retries
    const payout2 = await palpluss.b2cPayout(
      { amount: 500, phone: '254700000000' },
      { idempotencyKey: 'salary-jan-002' },
    );
    console.log('B2C Payout (custom key):', payout2.transactionId);

    // --- Service Wallet Balance ---
    const balance = await palpluss.getServiceBalance();
    console.log('Balance:', balance.availableBalance, balance.currency);

    // --- Service Wallet Topup ---
    const topup = await palpluss.serviceTopup({
      amount: 5000,
      phone: '254712345678',
      accountReference: 'TOPUP-001',
      transactionDesc: 'Service wallet topup',
    });
    console.log('Topup initiated:', topup.transactionId);

    // --- Get Transaction ---
    const tx = await palpluss.getTransaction(stk.transactionId);
    console.log('Transaction status:', tx.status);

    // --- List Transactions ---
    const page1 = await palpluss.listTransactions({ limit: 10, status: 'SUCCESS', type: 'STK' });
    console.log('Transactions:', page1.items.length);

    // Cursor pagination — pass next_cursor as-is, never construct it manually
    if (page1.next_cursor) {
      const page2 = await palpluss.listTransactions({ cursor: page1.next_cursor, limit: 10 });
      console.log('Next page:', page2.items.length);
    }

    // --- Payment Channels ---
    const channel = await palpluss.createChannel({
      type: 'PAYBILL',
      shortcode: '123456',
      name: 'My Paybill',
      accountNumber: 'ACC001',
      isDefault: true,
    });
    console.log('Channel created:', channel.id);

    const updated = await palpluss.updateChannel(channel.id, { name: 'Updated Paybill' });
    console.log('Channel updated:', updated.name);

    await palpluss.deleteChannel(channel.id);
    console.log('Channel deleted');
  } catch (error) {
    if (error instanceof RateLimitError) {
      console.error('Rate limited. Retry after:', error.retryAfter, 'seconds');
    } else if (error instanceof PalPlussApiError) {
      console.error('API Error:', error.code, '-', error.message);
      console.error('HTTP Status:', error.httpStatus);
      console.error('Request ID:', error.requestId);
      if (Object.keys(error.details).length > 0) {
        console.error('Details:', error.details);
      }
    } else {
      throw error;
    }
  }
}

main();
