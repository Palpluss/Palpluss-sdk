<?php

declare(strict_types=1);

namespace PalPluss\Modules;

use PalPluss\Http\HttpTransport;

final class WalletsModule
{
    public function __construct(private readonly HttpTransport $transport) {}

    /**
     * @return array<string, mixed>
     */
    public function serviceBalance(): array
    {
        /** @var array<string, mixed> */
        return $this->transport->request('GET', '/wallets/service/balance');
    }

    /**
     * @return array<string, mixed>
     */
    public function serviceTopup(
        float $amount,
        string $phone,
        ?string $accountReference = null,
        ?string $transactionDesc = null,
        ?string $idempotencyKey = null,
    ): array {
        $body = ['amount' => $amount, 'phone' => $phone];

        if ($accountReference !== null) {
            $body['accountReference'] = $accountReference;
        }
        if ($transactionDesc !== null) {
            $body['transactionDesc'] = $transactionDesc;
        }

        /** @var array<string, mixed> */
        return $this->transport->request(
            'POST',
            '/wallets/service/topups',
            body: $body,
            idempotencyKey: $idempotencyKey,
        );
    }
}
