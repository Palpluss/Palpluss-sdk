<?php

declare(strict_types=1);

namespace PalPluss\Modules;

use PalPluss\Http\HttpTransport;

final class ChannelsModule
{
    public function __construct(private readonly HttpTransport $transport) {}

    /**
     * @return array<string, mixed>
     */
    public function create(
        string $type,
        string $shortcode,
        string $name,
        ?string $accountNumber = null,
        ?bool $isDefault = null,
    ): array {
        $body = ['type' => $type, 'shortcode' => $shortcode, 'name' => $name];

        if ($accountNumber !== null) {
            $body['accountNumber'] = $accountNumber;
        }
        if ($isDefault !== null) {
            $body['isDefault'] = $isDefault;
        }

        /** @var array<string, mixed> */
        return $this->transport->request('POST', '/payment-wallet/channels', body: $body);
    }

    /**
     * @return array<string, mixed>
     */
    public function update(
        string $channelId,
        ?string $type = null,
        ?string $shortcode = null,
        ?string $name = null,
        ?string $accountNumber = null,
        ?bool $isDefault = null,
    ): array {
        $body = [];

        if ($type !== null) {
            $body['type'] = $type;
        }
        if ($shortcode !== null) {
            $body['shortcode'] = $shortcode;
        }
        if ($name !== null) {
            $body['name'] = $name;
        }
        if ($accountNumber !== null) {
            $body['accountNumber'] = $accountNumber;
        }
        if ($isDefault !== null) {
            $body['isDefault'] = $isDefault;
        }

        /** @var array<string, mixed> */
        return $this->transport->request(
            'PATCH',
            "/payment-wallet/channels/{$channelId}",
            body: $body,
        );
    }

    public function delete(string $channelId): void
    {
        $this->transport->request('DELETE', "/payment-wallet/channels/{$channelId}");
    }
}
