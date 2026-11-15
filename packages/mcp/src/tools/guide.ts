/**
 * Static integration guidance served to coding assistants. Kept short and
 * factual; the full reference is docs.palpluss.com.
 */
export const GUIDE_TOPICS = [
  'overview',
  'stk-push',
  'webhooks',
  'b2c-payouts',
  'channels',
  'wallets',
  'payment-links',
  'test-mode',
  'mcp-keys',
  'errors',
  'go-live',
] as const;
export type GuideTopic = (typeof GUIDE_TOPICS)[number];

const BASE = 'https://api.palpluss.com/v1';

const TOPICS: Record<GuideTopic, string> = {
  overview: `# PalPluss — overview
PalPluss is an M-Pesa payments API for Kenya: collect with STK Push, pay out with B2C, and manage the Paybills/Tills money is collected into.

- Base URL: ${BASE}
- Auth: \`Authorization: Basic <API key>\` (keys from console.palpluss.com → API Keys). Server-side only — never ship a key to a browser or mobile app.
- Responses: \`{ success: true, data, requestId }\`; errors \`{ success: false, error: { code, message, details } }\`. \`error.code\` is \`HTTP_<status>\`; the specific reason (e.g. \`KYC_NOT_VERIFIED\`) is in \`error.details.code\` when there is one.
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
- Limit: 1 payout per phone number per minute (429, details.code \`B2C_PAYOUT_COOLDOWN\`). Not enough float: details.code \`INSUFFICIENT_FUNDS\`.`,

  channels: `# Payment channels
Channels are the Paybills and Tills customer money is collected into.
- List: GET ${BASE}/payment-wallet/channels (default first)
- Create: POST ${BASE}/payment-wallet/channels
\`\`\`json
{ "name": "Main Paybill", "type": "PAYBILL", "shortcode": "247247", "accountNumber": "0123456789", "isDefault": true }
\`\`\`
- Types: PAYBILL (with the accountNumber customers pay into), TILL, SHORTCODE.
- The same Paybill can be added more than once with different account numbers (e.g. several bank accounts).
- Update: PATCH …/channels/{id}; Delete: DELETE …/channels/{id} (soft delete; the default moves to another channel).
- Changing channels changes where future payments land — treat it as sensitive.`,

  wallets: `# Wallets
- Service wallet (fees): GET ${BASE}/wallets/service/balance; top up with POST ${BASE}/wallets/service/topups.
- B2C wallet (payout float): GET ${BASE}/wallets/b2c/balance; top up with POST ${BASE}/wallets/b2c/topups.
- Top-ups are STK pushes to the phone that pays; the wallet is credited once M-Pesa confirms.
- Send an \`Idempotency-Key\` header so a retried top-up isn't charged twice.
- Requests fail with 402 INSUFFICIENT_SERVICE_BALANCE when the service wallet can't cover a fee.
- Limit: 2 top-ups per phone number per minute.
- History: GET ${BASE}/wallets/history?wallet=service|b2c&category=charge|topup|refund|payout — every entry with the balance after it.
- Fees: GET ${BASE}/fees/estimate?service=STK|B2C&amount=500 returns what this account's plan charges.`,

  'payment-links': `# Payment links
A payment link is a hosted page where the customer enters their number and pays by STK Push — no checkout code needed.
- Create: POST ${BASE}/payment-links
\`\`\`json
{ "amount": 1500, "external_reference": "INV-2041", "customer_name": "Jane", "expiry": "72h",
  "callbackUrl": "https://yourapp.com/webhooks/palpluss" }
\`\`\`
- Omit \`amount\` to let the customer type it. \`phone_number\` pre-fills their number; \`channel_id\` picks the Paybill/Till (default channel otherwise).
- \`expiry\`: 1h, 6h, 24h, 72h, 168h, 720h or never (default).
- The response has \`url\` — share it. Payments appear as STK transactions and fire your callback like any STK push.
- List: GET ${BASE}/payment-links; one: GET ${BASE}/payment-links/{id}; disable: DELETE ${BASE}/payment-links/{id}.`,

  'test-mode': `# Test mode
Create a **test** key in the console (API Keys → mode: Test). Test keys use the same endpoints and response shapes with simulated money:
- Nothing reaches M-Pesa. Every response and callback has \`livemode: false\`.
- Each account gets test wallets with KES 10,000 in the service wallet and KES 10,000 in the B2C wallet.
- STK pushes, payouts and top-ups settle about 5 seconds later and send your callback.
- How it ends depends on the phone number: 0700000001 → FAILED (insufficient balance), 0700000002 → CANCELLED (customer cancelled), 0700000003 → FAILED (customer unreachable), any other valid number → SUCCESS.
- Payouts work without KYC in test mode. Fees follow your real pricing plan.
- Payment channels and payment links are live settings: test keys can read them but not change them (403 NOT_AVAILABLE_IN_TEST_MODE).
- A key can be switched between test and live in the console (API Keys → Edit); it applies from the next request and the key string stays the same. Check GET ${BASE}/api-key for the current mode.`,

  'mcp-keys': `# MCP keys (for AI tools)
In the console (API Keys) choose **MCP** as the key type to give an AI tool limited access:
- Permissions: only what you tick works — transactions:read, wallets:read, wallets:topup, payments:stk, paylinks:read, paylinks:write, channels:read, channels:write, payouts:write. Anything else returns 403 INSUFFICIENT_SCOPE.
- Payout limits enforced by PalPluss: per payout, per day (total and count, Nairobi time) and an optional allowlist of numbers.
- Approvals: payouts and channel changes can be held until you approve them in the console. The API then answers 202 with \`status: "PENDING_APPROVAL"\` and an \`approvalId\`; follow it with GET ${BASE}/approvals/{id} (EXECUTED, REJECTED, EXPIRED or FAILED). Requests expire after 15 minutes.
- Optional expiry date and IP allowlist (exact IPs or CIDR ranges).
- GET ${BASE}/api-key shows the key's kind, mode, permissions, limits and today's payout usage.
- Standard keys keep full access and none of these limits.`,

  errors: `# Common errors
Error responses carry \`error.code\` as \`HTTP_<status>\`; read \`error.details.code\` for the specific reason.
| HTTP | details.code | Meaning | What to do |
|---|---|---|---|
| 401 | INVALID_API_KEY / AUTH_HEADER_INVALID | Key missing or wrong | Send \`Authorization: Basic <key>\` |
| 400 | INVALID_PHONE | Not a Kenyan mobile number | Validate before calling |
| 400 | NO_PAYMENT_CHANNELS / NO_DEFAULT_CHANNEL | No channel to collect into | Add one, or set a default |
| 402 | INSUFFICIENT_SERVICE_BALANCE | Can't cover the fee | Top up the service wallet |
| 403 | KYC_NOT_VERIFIED | Payouts need approved KYC | Finish KYC in the console |
| 401 | API_KEY_EXPIRED | The key's expiry date passed | Create a new key |
| 403 | INSUFFICIENT_SCOPE | MCP key lacks that permission | Grant it in the console |
| 403 | IP_NOT_ALLOWED | Request from an IP not on the key's allowlist | Update the allowlist |
| 403 | NOT_AVAILABLE_IN_TEST_MODE | Test key on a live-only endpoint | Use a live key |
| 403 | PAYOUT_ABOVE_KEY_LIMIT / PAYOUT_DAILY_TOTAL_REACHED / PAYOUT_DAILY_COUNT_REACHED / PAYOUT_RECIPIENT_NOT_ALLOWED | MCP key payout limits | Change them in the console |
| 429 | STK_RATE_LIMITED / WALLET_TOPUP_RATE_LIMITED | >2 prompts per minute to one number | Wait error.details.details.retryAfterSeconds |
| 429 | B2C_PAYOUT_COOLDOWN | >1 payout per minute to one number | Wait a minute |
| 429 | TRANSACTION_HEALTH_BLOCKED | Too many failed prompts recently | Wait until error.details.details.blockedUntil |
| 429 | RATE_LIMIT_EXCEEDED | API key over 60 requests per minute | Slow down |
`,

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
