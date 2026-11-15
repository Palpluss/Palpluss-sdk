/**
 * Static integration guidance served to coding assistants. Kept short and
 * factual; the full reference is docs.palpluss.com.
 */
export const GUIDE_TOPICS = ['overview', 'stk-push', 'webhooks', 'b2c-payouts', 'channels', 'wallets', 'errors', 'go-live'] as const;
export type GuideTopic = (typeof GUIDE_TOPICS)[number];

const BASE = 'https://api.palpluss.com/v1';

const TOPICS: Record<GuideTopic, string> = {
  overview: `# PalPluss — overview
PalPluss is an M-Pesa payments API for Kenya: collect with STK Push, pay out with B2C, and manage the Paybills/Tills money is collected into.

- Base URL: ${BASE}
- Auth: \`Authorization: Basic <API key>\` (keys from console.palpluss.com → API Keys). Server-side only — never ship a key to a browser or mobile app.
- Responses: \`{ success: true, data, requestId }\`; errors \`{ success: false, error: { code, message, details } }\`.
- Phones: send 07XXXXXXXX, 01XXXXXXXX, +254… or 254…; PalPluss normalises to 254XXXXXXXXX.
- Amounts: whole Kenyan shillings.
- Two wallets: the **service wallet** pays PalPluss fees (STK Push is a flat KES 3 for KES 10 and above; KES 1–9 is free); the **B2C wallet** is the float payouts are sent from.
- Docs: https://docs.palpluss.com`,

  'stk-push': `# STK Push (collect a payment)
POST ${BASE}/payments/stk
\`\`\`json
{ "amount": 500, "phone": "0712345678", "accountReference": "ORDER-1042",
  "transactionDesc": "Order 1042", "callbackUrl": "https://yourapp.com/webhooks/palpluss" }
\`\`\`
- Optional \`channelId\` picks the Paybill/Till; otherwise the default channel is used.
- Keep \`accountReference\` ≤ 12 and \`transactionDesc\` ≤ 13 characters (shown on the M-Pesa prompt).
- The response is immediate with \`status: "PENDING"\` and a \`transactionId\` — store it against your order.
- The result arrives by webhook (see "webhooks") or by polling GET ${BASE}/transactions/{id}.
- Compute the amount on your server from the order. Never trust an amount sent by the browser.
- Limits: 2 STK requests per phone number per minute (429 STK_RATE_LIMITED); 60 requests per minute per API key; if fewer than 30% of the last 100 STK payments succeed, STK is paused for 30 minutes (429 TRANSACTION_HEALTH_BLOCKED).
- To collect straight into a bank account, add the bank's Paybill and your account number as a PAYBILL channel.`,

  webhooks: `# Webhooks
PalPluss POSTs to your \`callbackUrl\` when a transaction reaches a final state:
\`\`\`json
{ "event": "transaction.updated", "event_type": "transaction.success",
  "transaction": { "id": "…", "type": "STK", "status": "SUCCESS", "amount": 1000,
    "external_reference": "ORDER-1042", "mpesa_receipt": "NLJ7RT61SV", "result_desc": "…" } }
\`\`\`
- Fulfil only when \`status\` is SUCCESS. \`external_reference\` is your accountReference/reference.
- Make the handler idempotent (key on transaction.id) — a callback can arrive more than once.
- Don't trust the body alone: re-fetch GET ${BASE}/transactions/{id} with your API key before fulfilling.
- Respond 2xx quickly; do slow work after acknowledging.
- Store \`mpesa_receipt\` for reconciliation.`,

  'b2c-payouts': `# B2C payouts (send money to an M-Pesa number)
POST ${BASE}/b2c/payouts  (header \`Idempotency-Key\` strongly recommended)
\`\`\`json
{ "amount": 500, "phone": "0712345678", "reference": "PAYOUT-1001",
  "description": "Partner payout", "callbackUrl": "https://yourapp.com/webhooks/palpluss" }
\`\`\`
- Requires an ACTIVE account with APPROVED KYC (403 otherwise).
- Minimum KES 10. Paid from the B2C wallet — top it up first (POST ${BASE}/wallets/b2c/topups).
- Fees are tiered by amount (from KES 6) and charged from the service wallet.
- The response returns \`status: "PROCESSING"\`; the final SUCCESS/FAILED arrives by webhook. A FAILED payout is refunded to the B2C wallet automatically.
- Use one Idempotency-Key per intended payout so retries never pay twice.
- Limit: 1 payout per phone number per minute.`,

  channels: `# Payment channels
Channels are the Paybills and Tills customer money is collected into.
- List: GET ${BASE}/payment-wallet/channels (default first)
- Create: POST ${BASE}/payment-wallet/channels
\`\`\`json
{ "name": "Main Paybill", "type": "PAYBILL", "shortcode": "247247", "accountNumber": "0123456789", "isDefault": true }
\`\`\`
- Types: PAYBILL (needs accountNumber), TILL / BUYGOODS / SHORTCODE (no accountNumber).
- The same Paybill can be added more than once with different account numbers (e.g. several bank accounts).
- Update: PATCH …/channels/{id}; Delete: DELETE …/channels/{id} (soft delete; the default moves to another channel).
- Changing channels changes where future payments land — treat it as sensitive.`,

  wallets: `# Wallets
- Service wallet (fees): GET ${BASE}/wallets/service/balance; top up with POST ${BASE}/wallets/service/topups.
- B2C wallet (payout float): GET ${BASE}/wallets/b2c/balance; top up with POST ${BASE}/wallets/b2c/topups.
- Top-ups are STK pushes to the phone that pays; the wallet is credited once M-Pesa confirms.
- Send an \`Idempotency-Key\` header so a retried top-up isn't charged twice.
- Requests fail with 402 INSUFFICIENT_SERVICE_BALANCE when the service wallet can't cover a fee.
- Limit: 2 top-ups per phone number per minute.`,

  errors: `# Common errors
| Code | Meaning | What to do |
|---|---|---|
| INVALID_API_KEY / AUTH_HEADER_INVALID | Key missing or wrong | Send \`Authorization: Basic <key>\` |
| INVALID_PHONE | Not a Kenyan mobile number | Validate before calling |
| NO_PAYMENT_CHANNELS / NO_DEFAULT_CHANNEL | No channel to collect into | Add one, or set a default |
| INSUFFICIENT_SERVICE_BALANCE (402) | Can't cover the fee | Top up the service wallet |
| STK_RATE_LIMITED (429) | >2 prompts/min to one number | Wait details.retryAfterSeconds |
| TRANSACTION_HEALTH_BLOCKED (429) | Too many failed prompts recently | Wait until details.blockedUntil |
| 403 on payouts | KYC not approved / account inactive | Finish KYC in the console |
Always read \`error.code\`, not the message text.`,

  'go-live': `# Go-live checklist
1. API key stored server-side only (environment variable / secret manager).
2. Amounts computed on the server from your own records.
3. Webhook handler idempotent, re-fetches the transaction, fulfils only on SUCCESS.
4. Store transactionId and mpesa_receipt for every payment.
5. Handle 429s (rate limits, transaction health) with a friendly "try again shortly".
6. Keep the service wallet funded; alert when it runs low.
7. For payouts: Idempotency-Key per payout, KYC approved, B2C wallet funded.
8. Make one real small payment end to end before launch.`,
};

export function guide(topic: GuideTopic): string {
  return `${TOPICS[topic]}\n\n(Full reference: https://docs.palpluss.com)`;
}
