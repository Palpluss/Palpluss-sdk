<?php

declare(strict_types=1);

namespace PalPluss;

final class Webhooks
{
    private const VALID_EVENT_TYPES = [
        'transaction.success',
        'transaction.failed',
        'transaction.cancelled',
        'transaction.expired',
        'transaction.updated',
    ];

    /**
     * Parse and validate a raw webhook payload string.
     *
     * @param  string $raw Raw JSON string from the webhook request body.
     * @return array<string, mixed> Parsed webhook payload.
     * @throws \InvalidArgumentException If the payload is invalid or missing required fields.
     */
    public static function parsePayload(string $raw): array
    {
        $parsed = json_decode($raw, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \InvalidArgumentException('Invalid JSON in webhook payload');
        }

        if (!is_array($parsed)) {
            throw new \InvalidArgumentException('Webhook payload must be a JSON object');
        }

        if (($parsed['event'] ?? null) !== 'transaction.updated') {
            $event = $parsed['event'] ?? null;
            throw new \InvalidArgumentException(
                sprintf('Unexpected webhook event: %s', json_encode($event)),
            );
        }

        $eventType = $parsed['event_type'] ?? null;
        if (!is_string($eventType)) {
            throw new \InvalidArgumentException('Webhook payload missing event_type');
        }

        if (!in_array($eventType, self::VALID_EVENT_TYPES, true)) {
            throw new \InvalidArgumentException(
                sprintf('Unknown event_type: %s', json_encode($eventType)),
            );
        }

        $transaction = $parsed['transaction'] ?? null;
        if (!is_array($transaction)) {
            throw new \InvalidArgumentException('Webhook payload missing transaction object');
        }

        if (!is_string($transaction['id'] ?? null)) {
            throw new \InvalidArgumentException('Webhook transaction missing id');
        }

        if (!is_string($transaction['status'] ?? null)) {
            throw new \InvalidArgumentException('Webhook transaction missing status');
        }

        /** @var array<string, mixed> */
        return $parsed;
    }
}
