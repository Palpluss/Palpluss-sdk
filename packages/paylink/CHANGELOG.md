# @palpluss/paylink

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
