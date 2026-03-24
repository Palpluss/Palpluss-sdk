# PalPluss — Node.js Example

A minimal Node.js HTTP server that handles STK Push and webhook callbacks.

## Setup

```bash
npm install @palpluss/sdk
```

## Example

```typescript
// server.ts
import http from 'node:http';
import { PalPluss, parseWebhookPayload, PalPlussApiError } from '@palpluss/sdk';

const palpluss = new PalPluss({ apiKey: process.env.PALPLUSS_API_KEY! });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);

  // POST /pay — initiate STK Push
  if (req.method === 'POST' && url.pathname === '/pay') {
    try {
      const stk = await palpluss.stkPush({
        amount: 100,
        phone: '254712345678',
        accountReference: 'ORDER-001',
        callbackUrl: 'https://your-server.com/webhook',
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ transactionId: stk.transactionId }));
    } catch (err) {
      if (err instanceof PalPlussApiError) {
        res.writeHead(err.httpStatus);
        res.end(JSON.stringify({ error: err.code }));
      }
    }
    return;
  }

  // POST /webhook — receive payment result
  if (req.method === 'POST' && url.pathname === '/webhook') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const payload = parseWebhookPayload(body);
      if (payload.event_type === 'transaction.success') {
        console.log('Payment received:', payload.transaction.mpesa_receipt);
      }
      res.writeHead(200).end();
    });
    return;
  }

  res.writeHead(404).end();
});

server.listen(3000, () => console.log('Listening on :3000'));
```

## Environment

```bash
PALPLUSS_API_KEY=pk_live_your_key
```
