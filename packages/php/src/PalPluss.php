<?php

declare(strict_types=1);

namespace PalPluss;

use PalPluss\Http\HttpTransport;
use PalPluss\Modules\B2cModule;
use PalPluss\Modules\ChannelsModule;
use PalPluss\Modules\StkModule;
use PalPluss\Modules\TransactionsModule;
use PalPluss\Modules\WalletsModule;

/**
 * PalPluss API client.
 *
 * @example
 * ```php
 * $client = new PalPluss(apiKey: 'pk_live_...');
 * $result = $client->stkPush(amount: 500, phone: '254712345678');
 * echo $result['transactionId'];
 * ```
 */
final class PalPluss
{
    private readonly HttpTransport $transport;
    private readonly StkModule $stk;
    private readonly B2cModule $b2c;
    private readonly WalletsModule $wallets;
    private readonly TransactionsModule $transactions;
    private readonly ChannelsModule $channels;

    /**
     * @param string|null      $apiKey               Your PalPluss API key. Falls back to
     *                                               PALPLUSS_API_KEY environment variable.
     * @param float            $timeout              Request timeout in seconds. Default: 30.
     * @param bool             $autoRetryOnRateLimit Automatically retry on HTTP 429. Default: true.
     * @param int              $maxRetries           Maximum retry attempts. Default: 3.
     * @param HttpTransport|null $transport           @internal — for testing only.
     */
    public function __construct(
        ?string $apiKey = null,
        float $timeout = 30.0,
        bool $autoRetryOnRateLimit = true,
        int $maxRetries = 3,
        ?HttpTransport $transport = null,
    ) {
        if ($transport !== null) {
            $this->transport = $transport;
        } else {
            $resolvedKey = $apiKey ?? (getenv('PALPLUSS_API_KEY') ?: null);
            if ($resolvedKey === null || $resolvedKey === '') {
                throw new \InvalidArgumentException('PalPluss: api_key is required');
            }

            $baseUrl = getenv('PALPLUSS_BASE_URL') ?: 'https://api.palpluss.com/v1';

            $this->transport = new HttpTransport(
                apiKey: $resolvedKey,
                baseUrl: $baseUrl,
                timeout: $timeout,
                autoRetryOnRateLimit: $autoRetryOnRateLimit,
                maxRetries: $maxRetries,
            );
        }

        $this->stk = new StkModule($this->transport);
        $this->b2c = new B2cModule($this->transport);
        $this->wallets = new WalletsModule($this->transport);
        $this->transactions = new TransactionsModule($this->transport);
        $this->channels = new ChannelsModule($this->transport);
    }

    // ── STK Push ─────────────────────────────────────────────────────────────

    /**
     * Initiate an STK Push (Lipa na M-Pesa) payment.
     *
     * @return array<string, mixed>
     */
    public function stkPush(
        float $amount,
        string $phone,
        ?string $accountReference = null,
        ?string $transactionDesc = null,
        ?string $channelId = null,
        ?string $callbackUrl = null,
        ?string $credentialId = null,
    ): array {
        return $this->stk->initiate(
            amount: $amount,
            phone: $phone,
            accountReference: $accountReference,
            transactionDesc: $transactionDesc,
            channelId: $channelId,
            callbackUrl: $callbackUrl,
            credentialId: $credentialId,
        );
    }

    // ── B2C Payout ───────────────────────────────────────────────────────────

    /**
     * Send a B2C payout to a phone number.
     *
     * A UUID v4 idempotency key is auto-generated if not provided.
     *
     * @return array<string, mixed>
     */
    public function b2cPayout(
        float $amount,
        string $phone,
        ?string $currency = null,
        ?string $reference = null,
        ?string $description = null,
        ?string $channelId = null,
        ?string $credentialId = null,
        ?string $callbackUrl = null,
        ?string $idempotencyKey = null,
    ): array {
        return $this->b2c->payout(
            amount: $amount,
            phone: $phone,
            currency: $currency,
            reference: $reference,
            description: $description,
            channelId: $channelId,
            credentialId: $credentialId,
            callbackUrl: $callbackUrl,
            idempotencyKey: $idempotencyKey,
        );
    }

    // ── Service Wallet ────────────────────────────────────────────────────────

    /**
     * Retrieve the service wallet balance.
     *
     * @return array<string, mixed>
     */
    public function getServiceBalance(): array
    {
        return $this->wallets->serviceBalance();
    }

    /**
     * Top up the service wallet via STK Push.
     *
     * @return array<string, mixed>
     */
    public function serviceTopup(
        float $amount,
        string $phone,
        ?string $accountReference = null,
        ?string $transactionDesc = null,
        ?string $idempotencyKey = null,
    ): array {
        return $this->wallets->serviceTopup(
            amount: $amount,
            phone: $phone,
            accountReference: $accountReference,
            transactionDesc: $transactionDesc,
            idempotencyKey: $idempotencyKey,
        );
    }

    // ── Transactions ──────────────────────────────────────────────────────────

    /**
     * Retrieve a single transaction by ID.
     *
     * @return array<string, mixed>
     */
    public function getTransaction(string $transactionId): array
    {
        return $this->transactions->get($transactionId);
    }

    /**
     * List transactions with optional filters.
     *
     * @param  string|null $type  "STK" or "B2C"
     * @return array<string, mixed>
     */
    public function listTransactions(
        ?int $limit = null,
        ?string $cursor = null,
        ?string $status = null,
        ?string $type = null,
    ): array {
        return $this->transactions->list(
            limit: $limit,
            cursor: $cursor,
            status: $status,
            type: $type,
        );
    }

    // ── Payment Wallet Channels ───────────────────────────────────────────────

    /**
     * Create a payment wallet channel.
     *
     * @param  string $type "PAYBILL", "TILL", or "SHORTCODE"
     * @return array<string, mixed>
     */
    public function createChannel(
        string $type,
        string $shortcode,
        string $name,
        ?string $accountNumber = null,
        ?bool $isDefault = null,
    ): array {
        return $this->channels->create(
            type: $type,
            shortcode: $shortcode,
            name: $name,
            accountNumber: $accountNumber,
            isDefault: $isDefault,
        );
    }

    /**
     * Update a payment wallet channel.
     *
     * @return array<string, mixed>
     */
    public function updateChannel(
        string $channelId,
        ?string $type = null,
        ?string $shortcode = null,
        ?string $name = null,
        ?string $accountNumber = null,
        ?bool $isDefault = null,
    ): array {
        return $this->channels->update(
            channelId: $channelId,
            type: $type,
            shortcode: $shortcode,
            name: $name,
            accountNumber: $accountNumber,
            isDefault: $isDefault,
        );
    }

    /**
     * Delete a payment wallet channel.
     */
    public function deleteChannel(string $channelId): void
    {
        $this->channels->delete($channelId);
    }
}
