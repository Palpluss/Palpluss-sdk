<?php

declare(strict_types=1);

namespace PalPluss\Modules;

use PalPluss\Http\HttpTransport;

final class TransactionsModule
{
    public function __construct(private readonly HttpTransport $transport) {}

    /**
     * @return array<string, mixed>
     */
    public function get(string $transactionId): array
    {
        /** @var array<string, mixed> */
        return $this->transport->request('GET', "/transactions/{$transactionId}");
    }

    /**
     * @return array<string, mixed>
     */
    public function list(
        ?int $limit = null,
        ?string $cursor = null,
        ?string $status = null,
        ?string $type = null,
    ): array {
        $query = [
            'limit'  => $limit,
            'cursor' => $cursor,
            'status' => $status,
            'type'   => $type,
        ];

        /** @var array<string, mixed> */
        return $this->transport->request('GET', '/transactions', query: $query);
    }
}
