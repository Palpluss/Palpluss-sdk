<?php

declare(strict_types=1);

namespace PalPluss\Modules;

use PalPluss\Http\HttpTransport;

final class B2cModule
{
    public function __construct(private readonly HttpTransport $transport) {}

    /**
     * @return array<string, mixed>
     */
    public function payout(
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
        $key = $idempotencyKey ?? self::generateUuidV4();

        $body = ['amount' => $amount, 'phone' => $phone];

        if ($currency !== null) {
            $body['currency'] = $currency;
        }
        if ($reference !== null) {
            $body['reference'] = $reference;
        }
        if ($description !== null) {
            $body['description'] = $description;
        }
        if ($channelId !== null) {
            $body['channelId'] = $channelId;
        }
        if ($credentialId !== null) {
            $body['credential_id'] = $credentialId;
        }
        if ($callbackUrl !== null) {
            $body['callback_url'] = $callbackUrl;
        }

        /** @var array<string, mixed> */
        return $this->transport->request('POST', '/b2c/payouts', body: $body, idempotencyKey: $key);
    }

    private static function generateUuidV4(): string
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
