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
Injects <iframe src="https://link.palpluss.com/abc-123?embed=1">
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
| `options` | `PayOptions` | No | Callbacks (see below) |

**`PayOptions`**

| Option | Type | Description |
|---|---|---|
| `onSuccess` | `(data: PaymentResult) => void` | Called immediately when payment succeeds, before the Promise resolves |
| `onClose` | `() => void` | Called when the user dismisses the modal without paying |

```ts
const result = await pay('abc-123', {
  onSuccess: (data) => console.log('paid', data),
  onClose:   ()     => console.log('modal closed'),
})
```

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

### `<PalplussPayment>` (React)

Import from `@palpluss/paylink/react`. Renders the payment iframe inline — no overlay, no modal — so you control layout and placement.

```tsx
import { PalplussPayment } from '@palpluss/paylink/react'

<PalplussPayment
  id="abc-123"
  onSuccess={({ txId, amount }) => console.log(txId, amount)}
  className="my-payment-frame"
/>
```

| Prop | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Paylink ID |
| `onSuccess` | `(data: PaymentResult) => void` | No | Called on successful payment |
| `className` | `string` | No | CSS class applied to the `<iframe>` |

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
Palpluss.pay('abc-123')
  .then(result => console.log(result))
  .catch(() => console.log('cancelled'))
```

---

## TypeScript Types

```ts
import type { PaymentResult, PayOptions, IframeEvent } from '@palpluss/paylink'

type PaymentResult = {
  txId:   string   // transaction reference
  amount: number   // amount paid in KES
  phone:  string   // M-PESA number used
}

type PayOptions = {
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

1. **Overlay** — a `position: fixed; inset: 0` div with a semi-transparent backdrop is appended to `document.body`. `z-index` is set to `2147483647` (the maximum) so it sits above everything.
2. **Card** — a centered white card (`max-width: 860px`) holds the close button and the iframe.
3. **Iframe** — src is `https://link.palpluss.com/{id}?embed=1`. The `?embed=1` query param tells the Palpluss page it is running inside an SDK modal.
4. **Body scroll lock** — `document.body.style.overflow = 'hidden'` while the modal is open, restored on cleanup.
5. **postMessage listener** — listens for two event types from the iframe origin:
   - `RESIZE` — adjusts `iframe.style.height` for seamless auto-height
   - `PAYMENT_SUCCESS` — extracts `{ txId, amount, phone }`, calls `onSuccess`, removes the modal, resolves the Promise
6. **Close handlers** — the modal closes (and the Promise rejects) on:
   - Clicking the `✕` button
   - Clicking outside the card on the backdrop
   - Pressing `Escape`
7. **Cleanup** — removes the overlay from the DOM, restores scroll, removes all event listeners.

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
