# Building the `@palpluss/paylink` Embed SDK

## What We Are Building

A browser-only frontend SDK that lets any developer embed a Palpluss payment link
into their site in two lines. It is **completely separate** from the existing
`@palpluss/sdk` server package — that one is for Node.js API calls; this one is
for rendering a payment UI inside a modal or inline iframe.

```ts
import { pay } from '@palpluss/paylink'
const result = await pay('abc-123')
```

---

## 1. Where It Lives

Add it as a new workspace package inside the existing monorepo.

```
Palpluss-sdk/
├── packages/
│   ├── typescript/        ← existing server SDK (@palpluss/sdk)
│   └── paylink/           ← new browser SDK (@palpluss/paylink)  ← CREATE THIS
├── pnpm-workspace.yaml    ← already covers packages/*
└── package.json
```

Create the directory:

```bash
mkdir -p packages/paylink/src
```

---

## 2. `packages/paylink/package.json`

```json
{
  "name": "@palpluss/paylink",
  "version": "0.1.0",
  "description": "Embed a Palpluss payment link in any website — modal or inline",
  "license": "MIT",
  "keywords": ["palpluss", "payments", "mpesa", "paylink", "embed", "iframe"],
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types":   "./dist/index.d.ts",
      "import":  "./dist/index.mjs",
      "require": "./dist/index.js"
    },
    "./react": {
      "types":   "./dist/react.d.ts",
      "import":  "./dist/react.mjs",
      "require": "./dist/react.js"
    }
  },
  "files": ["dist", "README.md"],
  "sideEffects": false,
  "scripts": {
    "build":     "tsup",
    "build:cdn": "tsup --config tsup.cdn.config.ts",
    "typecheck": "tsc --noEmit",
    "dev":       "tsup --watch"
  },
  "devDependencies": {
    "@types/react": "^19",
    "react":        "^19",
    "tsup":         "^8.0.0",
    "typescript":   "^5.4.0"
  },
  "peerDependencies": {
    "react":     ">=18",
    "react-dom": ">=18"
  },
  "peerDependenciesMeta": {
    "react":     { "optional": true },
    "react-dom": { "optional": true }
  },
  "engines": { "node": ">=18" }
}
```

> **Why peer deps for React?** The `pay()` function and modal are pure DOM —
> zero React required. React is only needed if someone imports `./react`.
> Making it optional means vanilla JS users don't pull in React.

---

## 3. `packages/paylink/tsconfig.json`

```json
{
  "compilerOptions": {
    "target":           "ES2017",
    "module":           "ESNext",
    "moduleResolution": "Bundler",
    "lib":              ["ES2017", "DOM"],
    "strict":           true,
    "declaration":      true,
    "jsx":              "react-jsx",
    "outDir":           "dist",
    "rootDir":          "src"
  },
  "include": ["src"]
}
```

---

## 4. `packages/paylink/tsup.config.ts` (npm build)

```ts
import { defineConfig } from 'tsup'

export default defineConfig([
  // Core — no React dependency
  {
    entry:  { index: 'src/index.ts' },
    format: ['cjs', 'esm'],
    dts:    true,
    clean:  true,
    external: ['react', 'react-dom'],
  },
  // React subpath export
  {
    entry:  { react: 'src/react.tsx' },
    format: ['cjs', 'esm'],
    dts:    true,
    external: ['react', 'react-dom'],
  },
])
```

---

## 5. `packages/paylink/tsup.cdn.config.ts` (CDN build)

Bundles everything into a single IIFE file that sets `window.Palpluss`.

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry:          { 'palpluss-paylink': 'src/cdn.ts' },
  format:         ['iife'],
  globalName:     'Palpluss',
  minify:         true,
  dts:            false,
  outDir:         'dist/cdn',
  target:         'es2017',
})
```

---

## 6. Source Files

> **v1.4.0 — pre-fill.** `pay()` options and `<PalplussPayment>` props gained
> `amount`, `phone`, `customerName` and `lockPrefill`. The iframe URL is now built
> by `src/url.ts` (§6g) in both `modal.ts` and `react.tsx`, replacing the inline
> `` `${BASE_URL}/${id}?embed=1` ``. The listings for `modal.ts` / `react.tsx` below
> show the original structure — see the source for the exact current code.

### 6a. `src/types.ts`

All shared types in one place.

```ts
export type PaymentResult = {
  txId:   string
  amount: number
  phone:  string
}

// Values pre-filled on the payment form. Merchant-fixed values on the paylink win.
export type PaylinkPrefill = {
  amount?:       number   // KES, ≥ 1
  phone?:        string
  customerName?: string   // max 120 characters
  lockPrefill?:  boolean  // make pre-filled fields read-only
}

export type PayOptions = PaylinkPrefill & {
  onSuccess?: (data: PaymentResult) => void
  onClose?:   () => void
}

// postMessage event shapes sent by the iframe
export type IframeEvent =
  | { type: 'RESIZE';          height: number }
  | { type: 'PAYMENT_SUCCESS'; txId: string; amount: number; phone: string }
```

---

### 6b. `src/modal.ts`

The core of the SDK. Creates a full-screen overlay, injects the iframe, wires
up all postMessage events, and returns a cleanup function.

```ts
import type { IframeEvent, PaymentResult, PayOptions } from './types.js'

const BASE_URL = 'https://link.palpluss.com'

export function openModal(
  paylinkId: string,
  options: PayOptions,
  resolve: (result: PaymentResult) => void,
  reject:  (reason?: unknown) => void,
): () => void {

  // ── 1. Build DOM ────────────────────────────────────────────────────────────

  const overlay = document.createElement('div')
  overlay.setAttribute('data-palpluss-overlay', '')
  Object.assign(overlay.style, {
    position:        'fixed',
    inset:           '0',
    backgroundColor: 'rgba(0,0,0,0.55)',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          '2147483647', // max z-index — always on top
    padding:         '16px',
    boxSizing:       'border-box',
  })

  const card = document.createElement('div')
  Object.assign(card.style, {
    position:     'relative',
    width:        '100%',
    maxWidth:     '860px',
    background:   '#fff',
    borderRadius: '12px',
    overflow:     'hidden',
    boxShadow:    '0 24px 64px rgba(0,0,0,0.20)',
  })

  const closeBtn = document.createElement('button')
  closeBtn.textContent = '✕'
  closeBtn.setAttribute('aria-label', 'Close payment')
  Object.assign(closeBtn.style, {
    position:   'absolute',
    top:        '12px',
    right:      '12px',
    zIndex:     '1',
    background: 'transparent',
    border:     'none',
    cursor:     'pointer',
    fontSize:   '18px',
    color:      '#6b7280',
    lineHeight: '1',
    padding:    '4px',
  })

  const iframe = document.createElement('iframe')
  iframe.src = `${BASE_URL}/${encodeURIComponent(paylinkId)}?embed=1`
  iframe.allow = 'payment'
  Object.assign(iframe.style, {
    display:    'block',
    width:      '100%',
    border:     'none',
    minHeight:  '560px',
    transition: 'height 0.2s ease',
  })

  card.appendChild(closeBtn)
  card.appendChild(iframe)
  overlay.appendChild(card)
  document.body.appendChild(overlay)

  // ── 2. Block body scroll while modal is open ─────────────────────────────

  const prevOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'

  // ── 3. Cleanup helper ───────────────────────────────────────────────────

  function cleanup() {
    document.body.removeChild(overlay)
    document.body.style.overflow = prevOverflow
    window.removeEventListener('message', onMessage)
    document.removeEventListener('keydown', onKeydown)
  }

  // ── 4. postMessage handler ───────────────────────────────────────────────

  function onMessage(e: MessageEvent<IframeEvent>) {
    if (!e.data || typeof e.data !== 'object') return

    if (e.data.type === 'RESIZE') {
      iframe.style.height = `${e.data.height}px`
    }

    if (e.data.type === 'PAYMENT_SUCCESS') {
      const result: PaymentResult = {
        txId:   e.data.txId,
        amount: e.data.amount,
        phone:  e.data.phone,
      }
      options.onSuccess?.(result)
      cleanup()
      resolve(result)
    }
  }

  // ── 5. Close handlers ────────────────────────────────────────────────────

  function close() {
    options.onClose?.()
    cleanup()
    reject(new Error('Payment modal closed by user'))
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close()
  }

  closeBtn.addEventListener('click', close)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close() // click outside card closes modal
  })

  window.addEventListener('message', onMessage)
  document.addEventListener('keydown', onKeydown)

  return cleanup
}
```

---

### 6c. `src/pay.ts`

The public-facing function. Wraps `openModal` in a Promise.

```ts
import { openModal } from './modal.js'
import type { PaymentResult, PayOptions } from './types.js'

export function pay(
  paylinkId: string,
  options: PayOptions = {},
): Promise<PaymentResult> {
  return new Promise((resolve, reject) => {
    openModal(paylinkId, options, resolve, reject)
  })
}
```

---

### 6d. `src/react.tsx`

The inline React component. Wraps the iframe directly — no modal, no overlay.
For developers who want to control placement themselves.

```tsx
import { useEffect, useRef } from 'react'
import type { IframeEvent, PaymentResult } from './types.js'

const BASE_URL = 'https://link.palpluss.com'

interface PalplussPaymentProps {
  id:          string
  onSuccess?:  (data: PaymentResult) => void
  className?:  string
}

export function PalplussPayment({ id, onSuccess, className }: PalplussPaymentProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    function handleMessage(e: MessageEvent<IframeEvent>) {
      if (!e.data || typeof e.data !== 'object') return

      if (e.data.type === 'RESIZE' && iframeRef.current) {
        iframeRef.current.style.height = `${e.data.height}px`
      }

      if (e.data.type === 'PAYMENT_SUCCESS') {
        onSuccess?.({ txId: e.data.txId, amount: e.data.amount, phone: e.data.phone })
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onSuccess])

  return (
    <iframe
      ref={iframeRef}
      src={`${BASE_URL}/${encodeURIComponent(id)}?embed=1`}
      allow="payment"
      className={className}
      style={{ width: '100%', border: 'none', minHeight: 560, display: 'block' }}
    />
  )
}
```

---

### 6e. `src/index.ts`

The main entry point. Only exports the core — no React here.

```ts
export { pay }             from './pay.js'
export { openModal }       from './modal.js'
export { buildPaylinkUrl, PAYLINK_BASE_URL } from './url.js'
export type { PaymentResult, PayOptions, PaylinkPrefill, IframeEvent } from './types.js'
```

---

### 6f. `src/cdn.ts`

Entry point for the CDN IIFE build. Exposes everything on `window.Palpluss`.

```ts
export { pay }             from './pay.js'
export { buildPaylinkUrl } from './url.js'

// Usage via CDN:
// <script src="https://cdn.palpluss.com/paylink.min.js"></script>
// <script>Palpluss.pay('abc-123', { amount: 1500 })</script>
```

---

### 6g. `src/url.ts` (v1.4.0)

Builds the hosted payment page URL with validated pre-fill. Used by `modal.ts`,
`react.tsx`, and exported for raw-iframe / shareable-link use.

```ts
buildPaylinkUrl('abc-123', { amount: 1500, phone: '0712345678', lockPrefill: true })
// → https://link.palpluss.com/abc-123?embed=1&amount=1500&phone=0712345678&lock=1
```

| Query param | Source option | Rule |
|---|---|---|
| `embed=1` | (default) | omitted with `{ embed: false }` |
| `amount` | `amount` | finite number ≥ 1, rounded to 2 dp — else `TypeError` |
| `phone` | `phone` | non-empty string — else `TypeError` |
| `customer_name` | `customerName` | trimmed, ≤ 120 chars — else `TypeError` |
| `lock=1` | `lockPrefill: true` | |

The payment page (`link.palpluss.com/[id]`) reads these params and pre-fills only
the fields the merchant left open on the paylink.

---

## 7. Final File Tree

```
packages/paylink/
├── src/
│   ├── types.ts       ← shared TypeScript types
│   ├── modal.ts       ← DOM modal creation, postMessage wiring
│   ├── pay.ts         ← pay() Promise wrapper
│   ├── react.tsx      ← inline React component
│   ├── index.ts       ← npm entry (no React)
│   └── cdn.ts         ← CDN IIFE entry
├── package.json
├── tsconfig.json
├── tsup.config.ts     ← npm build (CJS + ESM + types)
└── tsup.cdn.config.ts ← CDN build (minified IIFE)
```

---

## 8. Building

```bash
# from monorepo root
cd packages/paylink

# Build npm package (CJS + ESM + .d.ts)
pnpm build

# Build CDN file (dist/cdn/palpluss-paylink.global.js)
pnpm build:cdn
```

---

## 9. Usage Examples

### Vanilla JS / TypeScript (modal)

```ts
import { pay } from '@palpluss/paylink'

document.getElementById('pay-btn').addEventListener('click', async () => {
  try {
    const { txId, amount } = await pay('abc-123')
    window.location.href = `/thank-you?ref=${txId}&amount=${amount}`
  } catch {
    // user closed the modal — do nothing, or show a message
  }
})
```

### React — modal trigger

```tsx
import { pay } from '@palpluss/paylink'

export function CheckoutButton() {
  async function handleClick() {
    const result = await pay('abc-123')
    console.log('Paid', result.amount, 'KES — ref:', result.txId)
  }

  return <button onClick={handleClick}>Pay with M-PESA</button>
}
```

### React — inline embed

```tsx
import { PalplussPayment } from '@palpluss/paylink/react'

export function CheckoutPage() {
  return (
    <PalplussPayment
      id="abc-123"
      onSuccess={({ txId, amount }) => console.log(txId, amount)}
    />
  )
}
```

### CDN script tag (no npm, no build step)

```html
<script src="https://cdn.palpluss.com/paylink.min.js"></script>
<button onclick="Palpluss.pay('abc-123')">Pay Now</button>
```

---

## 10. Publishing to npm

The monorepo already uses Changesets. From the monorepo root:

```bash
# 1. Create a changeset
pnpm changeset

# 2. Select @palpluss/paylink → patch / minor / major
# 3. Write a summary of the change

# 4. Version the package
pnpm version-packages

# 5. Build and publish
pnpm --filter @palpluss/paylink run release
```

---

## 11. How the Two SDKs Relate

| Package              | Runtime     | Who uses it          | What it does                              |
|----------------------|-------------|----------------------|-------------------------------------------|
| `@palpluss/sdk`      | Node.js     | Backend developers   | Server-side API calls (STK push, B2C, etc.) |
| `@palpluss/paylink`  | Browser     | Frontend developers  | Embed payment link modal/inline on any site |

They are completely independent. A developer building a full integration would
install both — `@palpluss/sdk` on their server to create paylinks and handle
webhooks, and `@palpluss/paylink` on their frontend to present the payment UI.
