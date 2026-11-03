# @palpluss/paylink

Embed a Palpluss payment link into any website — as a modal overlay or an inline iframe — with two lines of code.

```ts
import { pay } from '@palpluss/paylink'
const result = await pay('your-paylink-id')
```

React is **optional**. The core `pay()` function is pure DOM with zero dependencies.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
  - [Vanilla JS / TypeScript](#vanilla-js--typescript)
  - [React — modal trigger](#react--modal-trigger)
  - [React — inline embed](#react--inline-embed)
  - [CDN script tag](#cdn-script-tag)
- [TypeScript Types](#typescript-types)
- [How the Modal Works Internally](#how-the-modal-works-internally)
- [Relation to @palpluss/sdk](#relation-to-palplussdk)

---

## How It Works

```
Your page                          Palpluss
─────────────────────────────      ──────────────────────
pay('abc-123')
  │
  ▼
Creates full-screen overlay
Injects <iframe src="https://link.palpluss.com/abc-123?embed=1[&amount=…&phone=…]">
  │
  │  ◄──── postMessage: RESIZE ──────────────── iframe adjusts height
  │  ◄──── postMessage: PAYMENT_SUCCESS ─────── payment complete
  │
  ▼
cleanup() — removes overlay, resolves Promise
```

1. `pay()` creates a modal overlay and injects an iframe pointing to `https://link.palpluss.com/{id}?embed=1`.
2. The embedded payment page communicates back via `window.postMessage`.
3. On success the Promise resolves with `{ txId, amount, phone }`. On close/cancel it rejects.

The iframe origin is `https://link.palpluss.com` — your page never handles raw payment credentials.

From v1.4.1 the SDK only accepts messages whose origin is `https://link.palpluss.com` **and** whose source is its own iframe, so other frames or scripts on your page cannot fake a `PAYMENT_SUCCESS`. Still confirm payments on your server (webhook or `GET /v1/transactions/{id}`) before delivering goods.

---

## Installation

```bash
# npm
npm install @palpluss/paylink

# pnpm
pnpm add @palpluss/paylink

# yarn
yarn add @palpluss/paylink
```

React peer dependencies are optional — only needed if you import `@palpluss/paylink/react`.

```bash
# only if you use the React component
npm install react react-dom
```

---

## Quick Start

```ts
import { pay } from '@palpluss/paylink'

const result = await pay('abc-123')
// result → { txId: 'TXN_...', amount: 500, phone: '2547...' }
```

---

## API Reference

### `pay(paylinkId, options?)`

Opens a full-screen modal containing the payment iframe.

Returns a `Promise<PaymentResult>` that:
- **resolves** when the customer completes payment
- **rejects** with `Error('Payment modal closed by user')` when the modal is dismissed

| Parameter | Type | Required | Description |
|---|---|---|---|
| `paylinkId` | `string` | Yes | The paylink ID from your Palpluss dashboard |
| `options` | `PayOptions` | No | Pre-fill values and callbacks (see below) |

**`PayOptions`**

| Option | Type | Description |
|---|---|---|
| `amount` | `number` | Pre-fill the amount in KES (must be ≥ 1). Ignored if the paylink already has a fixed amount. |
| `phone` | `string` | Pre-fill the customer's M-PESA number, e.g. `0712345678` or `254712345678`. Ignored if the paylink already has a fixed phone. |
| `customerName` | `string` | Pre-fill the customer name / payment note (max 120 characters). |
| `lockPrefill` | `boolean` | Make the pre-filled fields read-only for the customer. Default `false`. |
| `onSuccess` | `(data: PaymentResult) => void` | Called immediately when payment succeeds, before the Promise resolves |
| `onClose` | `() => void` | Called when the user dismisses the modal without paying |

```ts
const result = await pay('abc-123', {
  amount:       1500,
  phone:        '0712345678',
  customerName: 'Jane Wanjiku',
  onSuccess: (data) => console.log('paid', data),
  onClose:   ()     => console.log('modal closed'),
})
```

#### Pre-filling the payment form

Pass `amount`, `phone` and `customerName` to save your customer typing — for
example when the amount comes from your cart and you already know their number.

- **Merchant-fixed values always win.** If the paylink was created with a fixed
  amount or phone, that value is used and the pre-fill is ignored. The Palpluss
  API enforces this too, so a pre-fill can never change a merchant's price.
- **`lockPrefill: true`** makes the pre-filled fields read-only. It is a
  convenience, not a security control — the values travel in the iframe URL,
  which can be edited. If the amount must be guaranteed, create the paylink with
  a fixed amount (Console or `@palpluss/sdk`) instead.
- **Invalid values throw** a `TypeError` (e.g. `amount: 0`, a name over 120
  characters), so `pay()` rejects immediately and the mistake shows up during
  development.
- A phone number that isn't a valid Kenyan number is left blank on the form so
  the customer can type it.

---

### `openModal(paylinkId, options, resolve, reject)`

Low-level function used internally by `pay()`. Exposed for advanced use cases where you need direct control of the Promise lifecycle.

Returns a `cleanup()` function that tears down the modal immediately.

```ts
import { openModal } from '@palpluss/paylink'

const cleanup = openModal(
  'abc-123',
  {},
  (result) => console.log('resolved', result),
  (err)    => console.log('rejected', err),
)

// force-close from outside:
cleanup()
```

---

### `buildPaylinkUrl(paylinkId, prefill?, { embed? })`

Returns the URL of the hosted payment page with the same validated pre-fill —
useful for raw iframes, server-rendered pages, or a shareable link.

```ts
import { buildPaylinkUrl } from '@palpluss/paylink'

buildPaylinkUrl('abc-123', { amount: 1500, phone: '0712345678' })
// → https://link.palpluss.com/abc-123?embed=1&amount=1500&phone=0712345678

buildPaylinkUrl('abc-123', { amount: 1500 }, { embed: false })
// → https://link.palpluss.com/abc-123?amount=1500   (plain link to share)
```

**URL parameters** (if you build the URL yourself):

| Parameter | Example | Meaning |
|---|---|---|
| `embed` | `1` | Page runs inside an iframe and sends `postMessage` events |
| `amount` | `1500` | Pre-filled amount in KES (≥ 1) |
| `phone` | `0712345678` | Pre-filled M-PESA number |
| `customer_name` | `Jane%20Wanjiku` | Pre-filled customer name / note |
| `lock` | `1` | Make the pre-filled fields read-only |

---

### `<PalplussPayment>` (React)

Import from `@palpluss/paylink/react`. Renders the payment iframe inline — no overlay, no modal — so you control layout and placement.

```tsx
import { PalplussPayment } from '@palpluss/paylink/react'

<PalplussPayment
  id="abc-123"
  amount={1500}
  phone="0712345678"
  onSuccess={({ txId, amount }) => console.log(txId, amount)}
  className="my-payment-frame"
/>
```

| Prop | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Paylink ID |
| `amount` | `number` | No | Pre-fill the amount in KES (≥ 1) |
| `phone` | `string` | No | Pre-fill the customer's M-PESA number |
| `customerName` | `string` | No | Pre-fill the customer name / note (max 120 chars) |
| `lockPrefill` | `boolean` | No | Make the pre-filled fields read-only |
| `onSuccess` | `(data: PaymentResult) => void` | No | Called on successful payment |
| `className` | `string` | No | CSS class applied to the `<iframe>` |

Pre-fill props follow the same rules as `pay()` (merchant-fixed values win). The
iframe only reloads when one of them changes.

The iframe starts at `minHeight: 560px` and auto-resizes via `RESIZE` postMessage events.

---

## Usage Examples

### Vanilla JS / TypeScript

```ts
import { pay } from '@palpluss/paylink'

document.getElementById('pay-btn')!.addEventListener('click', async () => {
  try {
    const { txId, amount } = await pay('abc-123')
    window.location.href = `/thank-you?ref=${txId}&amount=${amount}`
  } catch {
    // user closed the modal — no action needed
  }
})
```

---

### Pre-filled checkout (amount from your cart)

```ts
import { pay } from '@palpluss/paylink'

async function checkout(cart: { total: number }, customer: { phone: string; name: string }) {
  try {
    const { txId } = await pay('abc-123', {
      amount:       cart.total,
      phone:        customer.phone,
      customerName: customer.name,
      lockPrefill:  true,          // customer confirms, but can't edit the values
    })
    await fetch('/api/orders/confirm', { method: 'POST', body: JSON.stringify({ txId }) })
  } catch {
    // modal closed, or an invalid pre-fill (TypeError) during development
  }
}
```

> Always confirm the amount on your server (webhook or transaction lookup) before
> fulfilling an order — the browser is never the source of truth for payments.

---

### React — modal trigger

```tsx
import { pay } from '@palpluss/paylink'

export function CheckoutButton({ paylinkId }: { paylinkId: string }) {
  async function handleClick() {
    try {
      const result = await pay(paylinkId)
      console.log('Paid', result.amount, 'KES — ref:', result.txId)
    } catch {
      // modal dismissed
    }
  }

  return <button onClick={handleClick}>Pay with M-PESA</button>
}
```

---

### React — inline embed

Use `@palpluss/paylink/react` when you want the payment form embedded directly in your page layout instead of a floating modal.

```tsx
import { PalplussPayment } from '@palpluss/paylink/react'

export function CheckoutPage() {
  function handleSuccess({ txId, amount }: { txId: string; amount: number }) {
    console.log(`Payment complete — ${amount} KES, ref: ${txId}`)
  }

  return (
    <div className="checkout">
      <h1>Complete your payment</h1>
      <PalplussPayment id="abc-123" onSuccess={handleSuccess} />
    </div>
  )
}
```

---

### CDN script tag

No build step required. Drop this into any HTML page:

```html
<script src="https://cdn.palpluss.com/paylink.min.js"></script>

<button onclick="Palpluss.pay('abc-123').then(r => alert('Paid! Ref: ' + r.txId))">
  Pay with M-PESA
</button>
```

The script sets `window.Palpluss` — everything available on the `Palpluss` global:

```js
Palpluss.pay('abc-123', { amount: 1500, phone: '0712345678' })
  .then(result => console.log(result))
  .catch(() => console.log('cancelled'))

// Build a pre-filled URL for a raw iframe or a shareable link
Palpluss.buildPaylinkUrl('abc-123', { amount: 1500 })
```

---

## TypeScript Types

```ts
import type { PaymentResult, PayOptions, PaylinkPrefill, IframeEvent } from '@palpluss/paylink'

type PaymentResult = {
  txId:   string   // transaction reference
  amount: number   // amount paid in KES
  phone:  string   // M-PESA number used
}

type PaylinkPrefill = {
  amount?:       number   // KES, ≥ 1
  phone?:        string   // e.g. '0712345678' or '254712345678'
  customerName?: string   // max 120 characters
  lockPrefill?:  boolean  // make pre-filled fields read-only
}

type PayOptions = PaylinkPrefill & {
  onSuccess?: (data: PaymentResult) => void
  onClose?:   () => void
}

// postMessage events sent by the embedded iframe
type IframeEvent =
  | { type: 'RESIZE';          height: number }
  | { type: 'PAYMENT_SUCCESS'; txId: string; amount: number; phone: string }
```

---

## How the Modal Works Internally

When `pay()` is called:

1. **Validation** — pre-fill values are checked and the iframe URL is built (`buildPaylinkUrl`). Invalid values throw before anything is drawn.
2. **Native `<dialog>`** — a `<dialog>` element (`max-width: 860px`, full-screen on phones) is opened with `showModal()`. It sits in the browser's top layer, so no `z-index` is needed and page scroll is locked automatically.
3. **Iframe** — src is `https://link.palpluss.com/{id}?embed=1` plus any pre-fill parameters. `?embed=1` tells the Palpluss page it is running inside an SDK modal.
4. **Styles** — injected once per page and shared by every modal.
5. **postMessage listener** — listens for two event types from the iframe origin:
   - `RESIZE` — adjusts `iframe.style.height` for seamless auto-height
   - `PAYMENT_SUCCESS` — extracts `{ txId, amount, phone }`, calls `onSuccess`, removes the modal, resolves the Promise
6. **Close handlers** — the modal closes (and the Promise rejects) on:
   - Clicking the `✕` button
   - Clicking outside the dialog on the backdrop
   - Pressing `Escape`
7. **Cleanup** — closes and removes the dialog and removes the message listener.

---

## Relation to @palpluss/sdk

| Package | Runtime | Who uses it | What it does |
|---|---|---|---|
| `@palpluss/sdk` | Node.js | Backend developers | Server-side API calls — create paylinks, STK push, webhooks |
| `@palpluss/paylink` | Browser | Frontend developers | Embed a payment link modal or inline iframe on any site |

These two packages are completely independent. A typical full-stack integration uses both:

```
Backend (Node.js)             Frontend (Browser)
──────────────────            ──────────────────
@palpluss/sdk                 @palpluss/paylink
  └─ createPaylink()   ──►      └─ pay(id)
  └─ handleWebhook()   ◄──            resolves on success
```

---

## License

MIT
