import { PalPluss, PalPlussApiError, RateLimitError } from '../src';

async function main() {
  // Initialize the client
  // Uses PALPLUSS_API_KEY and PALPLUSS_BASE_URL env vars if not provided
  const client = new PalPluss({
    apiKey: 'pk_test_your_api_key',
    baseUrl: 'https://sandbox.palpluss.com/v1',
    timeout: 30_000,
    autoRetryOnRateLimit: true,
    maxRetries: 3,
  });

  try {
    // --- STK Push ---
    const stkResult = await client.stk.initiate({
      amount: 100,
      phone: '254712345678',
      accountReference: 'ORDER-001',
      transactionDesc: 'Payment for order #001',
      callbackUrl: 'https://your-server.com/webhooks/palpluss',
    });
    console.log('STK Push initiated:', stkResult.transactionId);
    console.log('Status:', stkResult.status); // PENDING

    // --- B2C Payout ---
    const payoutResult = await client.b2c.payout({
      amount: 1000,
      phone: '254712345678',
      currency: 'KES',
      reference: 'SALARY-JAN-001',
      description: 'January salary payment',
    });
    console.log('B2C Payout initiated:', payoutResult.transactionId);
    console.log('Idempotency key:', payoutResult.idempotencyKey);

    // B2C with custom idempotency key
    const payoutResult2 = await client.b2c.payout(
      { amount: 500, phone: '254700000000' },
      { idempotencyKey: 'my-unique-key-123' },
    );
    console.log('B2C with custom key:', payoutResult2.transactionId);

    // --- Wallet Balance ---
    const balance = await client.wallets.serviceBalance();
    console.log('Wallet balance:', balance.availableBalance, balance.currency);

    // --- Wallet Topup ---
    const topup = await client.wallets.serviceTopup({
      amount: 5000,
      phone: '254712345678',
      accountReference: 'TOPUP-001',
      transactionDesc: 'Service wallet topup',
    });
    console.log('Topup initiated:', topup.transactionId);

    // --- Get Transaction ---
    const transaction = await client.transactions.get(stkResult.transactionId);
    console.log('Transaction status:', transaction.status);

    // --- List Transactions ---
    const txList = await client.transactions.list({
      limit: 10,
      status: 'SUCCESS',
      type: 'STK',
    });
    console.log('Transactions found:', txList.items.length);

    // Pagination
    if (txList.next_cursor) {
      const nextPage = await client.transactions.list({
        cursor: txList.next_cursor,
        limit: 10,
      });
      console.log('Next page:', nextPage.items.length);
    }

    // --- Payment Channels ---
    const channel = await client.channels.create({
      type: 'PAYBILL',
      shortcode: '123456',
      name: 'My Paybill',
      accountNumber: 'ACC001',
      isDefault: true,
    });
    console.log('Channel created:', channel.id);

    // Update channel
    const updated = await client.channels.update(channel.id, {
      name: 'Updated Paybill Name',
    });
    console.log('Channel updated:', updated.name);

    // Delete channel
    await client.channels.delete(channel.id);
    console.log('Channel deleted');
  } catch (error) {
    if (error instanceof RateLimitError) {
      console.error('Rate limited. Retry after:', error.retryAfter, 'seconds');
    } else if (error instanceof PalPlussApiError) {
      console.error('API Error:', error.code, error.message);
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
