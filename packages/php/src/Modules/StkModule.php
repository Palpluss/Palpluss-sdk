<?php

declare(strict_types=1);

namespace PalPluss\Modules;

use PalPluss\Http\HttpTransport;

final class StkModule
{
    public function __construct(private readonly HttpTransport $transport) {}

    /**
     * @return array<string, mixed>
     */
    public function initiate(
        float $amount,
        string $phone,
        ?string $accountReference = null,
        ?string $transactionDesc = null,
        ?string $channelId = null,
        ?string $callbackUrl = null,
        ?string $credentialId = null,
    ): array {
        $body = ['amount' => $amount, 'phone' => $phone];

        if ($accountReference !== null) {
            $body['accountReference'] = $accountReference;
        }
        if ($transactionDesc !== null) {
            $body['transactionDesc'] = $transactionDesc;
        }
        if ($channelId !== null) {
            $body['channelId'] = $channelId;
        }
        if ($callbackUrl !== null) {
            $body['callbackUrl'] = $callbackUrl;
        }
        if ($credentialId !== null) {
            $body['credential_id'] = $credentialId;
        }

        /** @var array<string, mixed> */
        return $this->transport->request('POST', '/payments/stk', body: $body);
    }
}
