// src/http/errors.ts
var PalPlussApiError = class _PalPlussApiError extends Error {
  name = "PalPlussApiError";
  code;
  httpStatus;
  details;
  requestId;
  constructor(message, code, httpStatus, details = {}, requestId) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    this.requestId = requestId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
  static fromResponse(httpStatus, errorBody, requestId) {
    if (httpStatus === 429) {
      return new RateLimitError(
        errorBody.message,
        errorBody.code,
        errorBody.details ?? {},
        requestId
      );
    }
    return new _PalPlussApiError(
      errorBody.message,
      errorBody.code,
      httpStatus,
      errorBody.details ?? {},
      requestId
    );
  }
};
var RateLimitError = class extends PalPlussApiError {
  retryAfter;
  constructor(message, code, details = {}, requestId, retryAfter) {
    super(message, code, 429, details, requestId);
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, new.target.prototype);
  }
};

// src/http/transport.ts
var HttpTransport = class {
  apiKey;
  baseUrl;
  timeout;
  autoRetryOnRateLimit;
  maxRetries;
  authHeader;
  constructor(options) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeout = options.timeout ?? 3e4;
    this.autoRetryOnRateLimit = options.autoRetryOnRateLimit ?? true;
    this.maxRetries = options.maxRetries ?? 3;
    this.authHeader = "Basic " + Buffer.from(this.apiKey + ":").toString("base64");
  }
  async request(method, path, options) {
    const url = this.buildUrl(path, options?.query);
    const headers = {
      Authorization: this.authHeader,
      Accept: "application/json"
    };
    if (options?.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }
    if (options?.requestId) {
      headers["x-request-id"] = options.requestId;
    }
    let body;
    if (options?.body && (method === "POST" || method === "PATCH" || method === "PUT")) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
    let attempt = 0;
    while (true) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      let response;
      try {
        response = await fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal
        });
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof DOMException && err.name === "AbortError") {
          throw new PalPlussApiError(
            "Request timed out",
            "TIMEOUT",
            0,
            {},
            void 0
          );
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
      if (response.status === 204) {
        return void 0;
      }
      if (response.status === 429 && this.autoRetryOnRateLimit && attempt < this.maxRetries) {
        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 1;
        await this.sleep(retryAfter * 1e3);
        attempt++;
        continue;
      }
      const responseBody = await response.json();
      const requestId = responseBody.requestId ?? void 0;
      if (!response.ok || responseBody.success === false) {
        const error = responseBody.error;
        const apiError = PalPlussApiError.fromResponse(
          response.status,
          error,
          requestId
        );
        if (apiError instanceof RateLimitError) {
          const retryAfterHeader = response.headers.get("Retry-After");
          if (retryAfterHeader) {
            apiError.retryAfter = parseInt(retryAfterHeader, 10);
          }
        }
        throw apiError;
      }
      return responseBody.data;
    }
  }
  buildUrl(path, query) {
    const cleanPath = path.startsWith("/") ? path : "/" + path;
    const url = new URL(this.baseUrl + cleanPath);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== void 0) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
};

// src/modules/stk.ts
var StkModule = class {
  constructor(transport) {
    this.transport = transport;
  }
  async initiate(params) {
    return this.transport.request("POST", "/payments/stk", {
      body: params
    });
  }
};

// src/modules/b2c.ts
import { randomUUID } from "crypto";
var B2cModule = class {
  constructor(transport) {
    this.transport = transport;
  }
  async payout(params, options) {
    const idempotencyKey = options?.idempotencyKey ?? randomUUID();
    return this.transport.request("POST", "/b2c/payouts", {
      body: params,
      idempotencyKey
    });
  }
};

// src/modules/wallets.ts
var WalletsModule = class {
  constructor(transport) {
    this.transport = transport;
  }
  async serviceBalance() {
    return this.transport.request("GET", "/wallets/service/balance");
  }
  async serviceTopup(params, options) {
    return this.transport.request("POST", "/wallets/service/topups", {
      body: params,
      idempotencyKey: options?.idempotencyKey
    });
  }
};

// src/modules/transactions.ts
var TransactionsModule = class {
  constructor(transport) {
    this.transport = transport;
  }
  async get(id) {
    return this.transport.request("GET", `/transactions/${id}`);
  }
  async list(params) {
    return this.transport.request("GET", "/transactions", {
      query: {
        limit: params?.limit,
        cursor: params?.cursor,
        status: params?.status,
        type: params?.type
      }
    });
  }
};

// src/modules/channels.ts
var ChannelsModule = class {
  constructor(transport) {
    this.transport = transport;
  }
  async create(params) {
    return this.transport.request("POST", "/payment-wallet/channels", {
      body: params
    });
  }
  async update(id, params) {
    return this.transport.request("PATCH", `/payment-wallet/channels/${id}`, {
      body: params
    });
  }
  async delete(id) {
    await this.transport.request("DELETE", `/payment-wallet/channels/${id}`);
  }
};

// src/client.ts
var PalPluss = class {
  stk;
  b2c;
  wallets;
  transactions;
  channels;
  constructor(options) {
    const apiKey = options?.apiKey ?? process.env.PALPLUSS_API_KEY;
    if (!apiKey) {
      throw new Error("PalPluss: apiKey is required");
    }
    const baseUrl = options?.baseUrl ?? process.env.PALPLUSS_BASE_URL ?? "https://api.palpluss.com/v1";
    const transport = new HttpTransport({
      apiKey,
      baseUrl,
      timeout: options?.timeout,
      autoRetryOnRateLimit: options?.autoRetryOnRateLimit,
      maxRetries: options?.maxRetries
    });
    this.stk = new StkModule(transport);
    this.b2c = new B2cModule(transport);
    this.wallets = new WalletsModule(transport);
    this.transactions = new TransactionsModule(transport);
    this.channels = new ChannelsModule(transport);
  }
};

// src/webhooks.ts
function parseWebhookPayload(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON in webhook payload");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Webhook payload must be a JSON object");
  }
  const payload = parsed;
  if (payload.event !== "transaction.updated") {
    throw new Error(`Unexpected webhook event: ${String(payload.event)}`);
  }
  if (typeof payload.event_type !== "string") {
    throw new Error("Webhook payload missing event_type");
  }
  const validEventTypes = [
    "transaction.success",
    "transaction.failed",
    "transaction.cancelled",
    "transaction.expired",
    "transaction.updated"
  ];
  if (!validEventTypes.includes(payload.event_type)) {
    throw new Error(`Unknown event_type: ${payload.event_type}`);
  }
  if (typeof payload.transaction !== "object" || payload.transaction === null) {
    throw new Error("Webhook payload missing transaction object");
  }
  const tx = payload.transaction;
  if (typeof tx.id !== "string") {
    throw new Error("Webhook transaction missing id");
  }
  if (typeof tx.status !== "string") {
    throw new Error("Webhook transaction missing status");
  }
  return payload;
}
export {
  B2cModule,
  ChannelsModule,
  HttpTransport,
  PalPluss,
  PalPlussApiError,
  RateLimitError,
  StkModule,
  TransactionsModule,
  WalletsModule,
  parseWebhookPayload
};
