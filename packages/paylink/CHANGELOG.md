# @palpluss/paylink

## 1.4.1

### Security fix

- **Payment events are now verified.** `pay()` and `<PalplussPayment>` only accept
  `postMessage` events whose origin is `https://link.palpluss.com` **and** whose
  source is the SDK's own iframe, with a well-formed payload. Previously any frame
  or script on the page could post a fake `PAYMENT_SUCCESS` and resolve `pay()` /
  fire `onSuccess`. Upgrade recommended.
- Reminder: always confirm payments server-side (webhook or `GET /v1/transactions/{id}`)
  before delivering goods — the browser result is a UI signal, not proof of payment.

No API changes.

## 1.4.0

### Minor changes

- **Pre-fill the payment form.** `pay(paylinkId, options)` and `<PalplussPayment>`
  accept `amount`, `phone`, `customerName` and `lockPrefill`. Merchant-fixed values
  on the paylink always win; invalid values throw a `TypeError`.
- **`buildPaylinkUrl(paylinkId, prefill?, { embed? })`** — build the hosted payment
  page URL (with validated pre-fill) for raw iframes or shareable links. Also on the
  CDN global as `Palpluss.buildPaylinkUrl`.
- New exported type `PaylinkPrefill`.

No breaking changes — calls without pre-fill produce the same URL as 1.3.0.
