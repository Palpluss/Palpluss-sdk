# PalPluss — Next.js Example

Using `@palpluss/sdk` in Next.js App Router server routes.

## Setup

```bash
npm install @palpluss/sdk
```

Add to `.env.local`:

```
PALPLUSS_API_KEY=pk_live_your_key
```

## Route handlers

### `app/api/pay/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { PalPluss, PalPlussApiError } from '@palpluss/sdk';

const palpluss = new PalPluss({ apiKey: process.env.PALPLUSS_API_KEY! });

export async function POST(req: NextRequest) {
  const { phone, amount, reference } = await req.json();

  try {
    const stk = await palpluss.stkPush({
      amount,
      phone,
      accountReference: reference,
      callbackUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook`,
    });

    return NextResponse.json({ transactionId: stk.transactionId });
  } catch (err) {
    if (err instanceof PalPlussApiError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.httpStatus },
      );
    }
    throw err;
  }
}
```

### `app/api/webhook/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { parseWebhookPayload } from '@palpluss/sdk';

export async function POST(req: NextRequest) {
  const payload = parseWebhookPayload(await req.text());

  switch (payload.event_type) {
    case 'transaction.success':
      // Update order status in your DB
      await markOrderPaid(
        payload.transaction.external_reference!,
        payload.transaction.mpesa_receipt!,
      );
      break;
    case 'transaction.failed':
    case 'transaction.cancelled':
      await markOrderFailed(payload.transaction.external_reference!);
      break;
  }

  return new NextResponse(null, { status: 200 });
}

async function markOrderPaid(ref: string, receipt: string) { /* ... */ }
async function markOrderFailed(ref: string) { /* ... */ }
```

## Notes

- The SDK works in Next.js App Router server components and route handlers
- It uses native `fetch` — no polyfills needed on Node 18+
- Never use the SDK in client components; your API key must stay server-side
