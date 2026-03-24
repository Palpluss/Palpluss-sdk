interface HttpTransportOptions {
    apiKey: string;
    baseUrl: string;
    timeout?: number;
    autoRetryOnRateLimit?: boolean;
    maxRetries?: number;
}
interface RequestOptions {
    body?: Record<string, unknown>;
    query?: Record<string, string | number | undefined>;
    idempotencyKey?: string;
    requestId?: string;
}
declare class HttpTransport {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly timeout;
    private readonly autoRetryOnRateLimit;
    private readonly maxRetries;
    private readonly authHeader;
    constructor(options: HttpTransportOptions);
    request<T>(method: string, path: string, options?: RequestOptions): Promise<T>;
    private buildUrl;
    private sleep;
}

interface StkInitiateRequest {
    amount: number;
    phone: string;
    accountReference?: string;
    transactionDesc?: string;
    channelId?: string;
    callbackUrl?: string;
    credential_id?: string;
}
interface StkInitiateResponse {
    transactionId: string;
    tenantId: string;
    channelId: string | null;
    type: 'STK';
    status: 'PENDING';
    amount: number;
    currency: string;
    phone: string;
    accountReference: string;
    transactionDesc: string;
    providerRequestId: string;
    providerCheckoutId: string;
    resultCode: string;
    resultDescription: string;
    createdAt: string;
    updatedAt: string;
}

declare class StkModule {
    private readonly transport;
    constructor(transport: HttpTransport);
    initiate(params: StkInitiateRequest): Promise<StkInitiateResponse>;
}

interface B2cPayoutRequest {
    amount: number;
    phone: string;
    currency?: string;
    reference?: string;
    description?: string;
    channelId?: string;
    credential_id?: string;
    callback_url?: string;
}
interface B2cPayoutResponse {
    transactionId: string;
    tenantId: string;
    channelId: string | null;
    type: 'B2C';
    status: 'PENDING';
    amount: number;
    currency: string;
    phone: string;
    reference: string | null;
    description: string | null;
    providerRequestId: string | null;
    providerCheckoutId: string | null;
    resultCode: string | null;
    resultDescription: string;
    idempotencyKey: string | null;
    channel: null;
    createdAt: string;
    updatedAt: string;
}

interface B2cPayoutOptions {
    idempotencyKey?: string;
}
declare class B2cModule {
    private readonly transport;
    constructor(transport: HttpTransport);
    payout(params: B2cPayoutRequest, options?: B2cPayoutOptions): Promise<B2cPayoutResponse>;
}

interface ServiceWalletBalance {
    walletId: string;
    tenantId: string;
    currency: string;
    availableBalance: number;
    ledgerBalance: number;
    updatedAt: string;
}
interface ServiceTopupRequest {
    amount: number;
    phone: string;
    accountReference?: string;
    transactionDesc?: string;
}
interface ServiceTopupResponse {
    transactionId: string;
    tenantId: string;
    type: 'WALLET_TOPUP_SERVICE_TOKENS';
    status: 'PENDING';
    amount: number;
    currency: string;
    phone: string;
    accountReference: string;
    transactionDesc: string;
    providerRequestId: string;
    providerCheckoutId: string;
    resultCode: string;
    resultDescription: string;
    idempotencyKey: string | null;
    createdAt: string;
    updatedAt: string;
}

interface WalletTopupOptions {
    idempotencyKey?: string;
}
declare class WalletsModule {
    private readonly transport;
    constructor(transport: HttpTransport);
    serviceBalance(): Promise<ServiceWalletBalance>;
    serviceTopup(params: ServiceTopupRequest, options?: WalletTopupOptions): Promise<ServiceTopupResponse>;
}

type TransactionStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REVERSED';
type TransactionType = 'STK' | 'B2C' | 'WALLET_TOPUP_SERVICE_TOKENS';
type ChannelType = 'PAYBILL' | 'TILL' | 'SHORTCODE';
interface PalPlussOptions {
    apiKey?: string;
    baseUrl?: string;
    timeout?: number;
    autoRetryOnRateLimit?: boolean;
    maxRetries?: number;
}
interface ApiSuccessResponse<T> {
    success: true;
    data: T;
    requestId: string;
}
interface ApiErrorBody {
    message: string;
    code: string;
    details?: Record<string, unknown>;
}
interface ApiErrorResponse {
    success: false;
    error: ApiErrorBody;
    requestId: string;
}
type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

interface Transaction {
    transaction_id: string;
    tenant_id: string;
    type: TransactionType;
    status: TransactionStatus;
    amount: number;
    currency: string;
    phone_number: string;
    channel_id: string | null;
    external_reference: string | null;
    customer_name: string | null;
    callback_url: string | null;
    provider: string;
    provider_request_id: string | null;
    provider_checkout_id: string | null;
    result_code: string | null;
    result_desc: string | null;
    created_at: string;
    updated_at: string;
}
interface TransactionListParams {
    limit?: number;
    cursor?: string;
    status?: string;
    type?: 'STK' | 'B2C';
}
interface TransactionListResponse {
    items: Transaction[];
    next_cursor: string | null;
}

declare class TransactionsModule {
    private readonly transport;
    constructor(transport: HttpTransport);
    get(id: string): Promise<Transaction>;
    list(params?: TransactionListParams): Promise<TransactionListResponse>;
}

interface PaymentWalletChannel {
    id: string;
    tenantId: string;
    category: 'PAYMENT_WALLET';
    type: ChannelType;
    shortcode: string;
    name: string;
    accountNumber: string | null;
    isDefault: boolean;
    createdAt: string;
}
interface CreateChannelRequest {
    type: 'PAYBILL' | 'TILL' | 'SHORTCODE';
    shortcode: string;
    name: string;
    accountNumber?: string;
    isDefault?: boolean;
}
interface UpdateChannelRequest {
    type?: 'PAYBILL' | 'TILL' | 'SHORTCODE';
    shortcode?: string;
    name?: string;
    accountNumber?: string;
    isDefault?: boolean;
}

declare class ChannelsModule {
    private readonly transport;
    constructor(transport: HttpTransport);
    create(params: CreateChannelRequest): Promise<PaymentWalletChannel>;
    update(id: string, params: UpdateChannelRequest): Promise<PaymentWalletChannel>;
    delete(id: string): Promise<void>;
}

declare class PalPluss {
    readonly stk: StkModule;
    readonly b2c: B2cModule;
    readonly wallets: WalletsModule;
    readonly transactions: TransactionsModule;
    readonly channels: ChannelsModule;
    constructor(options?: PalPlussOptions);
}

declare class PalPlussApiError extends Error {
    readonly name = "PalPlussApiError";
    readonly code: string;
    readonly httpStatus: number;
    readonly details: Record<string, unknown>;
    readonly requestId: string | undefined;
    constructor(message: string, code: string, httpStatus: number, details?: Record<string, unknown>, requestId?: string);
    static fromResponse(httpStatus: number, errorBody: {
        message: string;
        code: string;
        details?: Record<string, unknown>;
    }, requestId?: string): PalPlussApiError;
}
declare class RateLimitError extends PalPlussApiError {
    retryAfter: number | undefined;
    constructor(message: string, code: string, details?: Record<string, unknown>, requestId?: string, retryAfter?: number);
}

interface WebhookTransaction {
    id: string;
    tenant_id: string;
    type: TransactionType;
    status: TransactionStatus;
    amount: number;
    currency: string;
    phone_number: string;
    external_reference: string | null;
    provider: string;
    provider_request_id: string | null;
    provider_checkout_id: string | null;
    result_code: string | null;
    result_desc: string | null;
    mpesa_receipt: string | null;
    created_at: string;
    updated_at: string;
}
type WebhookEventType = 'transaction.success' | 'transaction.failed' | 'transaction.cancelled' | 'transaction.expired' | 'transaction.updated';
interface WebhookPayload {
    event: 'transaction.updated';
    event_type: WebhookEventType;
    transaction: WebhookTransaction;
}

/**
 * Parse and validate a raw webhook payload string into a typed WebhookPayload.
 *
 * @param raw - The raw JSON string from the webhook request body.
 * @returns The parsed and validated WebhookPayload.
 * @throws Error if the payload is invalid or missing required fields.
 */
declare function parseWebhookPayload(raw: string): WebhookPayload;

export { type ApiErrorBody, type ApiErrorResponse, type ApiResponse, type ApiSuccessResponse, B2cModule, type B2cPayoutRequest, type B2cPayoutResponse, type ChannelType, ChannelsModule, type CreateChannelRequest, HttpTransport, PalPluss, PalPlussApiError, type PalPlussOptions, type PaymentWalletChannel, RateLimitError, type ServiceTopupRequest, type ServiceTopupResponse, type ServiceWalletBalance, type StkInitiateRequest, type StkInitiateResponse, StkModule, type Transaction, type TransactionListParams, type TransactionListResponse, type TransactionStatus, type TransactionType, TransactionsModule, type UpdateChannelRequest, WalletsModule, type WebhookEventType, type WebhookPayload, type WebhookTransaction, parseWebhookPayload };
