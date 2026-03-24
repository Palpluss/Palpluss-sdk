import { parseWebhookPayload } from '../src';
import type { WebhookPayload } from '../src';

/**
 * Example webhook handler for PalPluss transaction callbacks.
 *
 * This example shows how to handle incoming webhooks in a generic HTTP handler.
 * Adapt the request/response handling to your framework (Express, Fastify, Hono, etc.).
 */

// Generic handler that works with any framework
function handleWebhook(requestBody: string): { status: number; body: string } {
  let payload: WebhookPayload;

  try {
    payload = parseWebhookPayload(requestBody);
  } catch (error) {
    console.error('Invalid webhook payload:', (error as Error).message);
    return { status: 400, body: JSON.stringify({ error: 'Invalid payload' }) };
  }

  const { event_type, transaction } = payload;

  console.log(`Received webhook: ${event_type}`);
  console.log(`Transaction ID: ${transaction.id}`);
  console.log(`Type: ${transaction.type}, Status: ${transaction.status}`);

  switch (event_type) {
    case 'transaction.success':
      console.log(`Payment successful: ${transaction.amount} ${transaction.currency}`);
      if (transaction.type === 'STK' && transaction.mpesa_receipt) {
        console.log(`M-Pesa receipt: ${transaction.mpesa_receipt}`);
      }
      // Update your order/record as paid
      break;

    case 'transaction.failed':
      console.log(`Payment failed: ${transaction.result_desc}`);
      // Handle failure - notify user, retry, etc.
      break;

    case 'transaction.cancelled':
      console.log('Payment was cancelled by user');
      // Handle cancellation
      break;

    case 'transaction.expired':
      console.log('Payment expired');
      // Handle expiration - prompt user to retry
      break;

    case 'transaction.updated':
      console.log(`Transaction updated to status: ${transaction.status}`);
      // Handle generic update
      break;
  }

  // Always respond with 200 to acknowledge receipt
  return { status: 200, body: JSON.stringify({ received: true }) };
}

// --- Express example ---
// import express from 'express';
// const app = express();
// app.use(express.text({ type: 'application/json' }));
// app.post('/webhooks/palpluss', (req, res) => {
//   const result = handleWebhook(req.body);
//   res.status(result.status).send(result.body);
// });

// --- Node.js http example ---
import { createServer } from 'node:http';

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhooks/palpluss') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      const result = handleWebhook(body);
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(result.body);
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = process.env.PORT ?? 3000;
server.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
