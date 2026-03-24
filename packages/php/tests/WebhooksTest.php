<?php

declare(strict_types=1);

namespace PalPluss\Tests;

use PHPUnit\Framework\TestCase;
use PalPluss\Webhooks;

class WebhooksTest extends TestCase
{
    private function validPayload(string $eventType = 'transaction.success'): string
    {
        return (string) json_encode([
            'event'      => 'transaction.updated',
            'event_type' => $eventType,
            'transaction' => [
                'id'     => 'txn_webhook_001',
                'status' => 'SUCCESS',
                'amount' => 500.0,
                'phone'  => '254712345678',
            ],
        ]);
    }

    public function testParsesValidPayload(): void
    {
        $result = Webhooks::parsePayload($this->validPayload());

        $this->assertSame('transaction.updated', $result['event']);
        $this->assertSame('transaction.success', $result['event_type']);
        $this->assertSame('txn_webhook_001', $result['transaction']['id']);
        $this->assertSame('SUCCESS', $result['transaction']['status']);
    }

    public function testAllValidEventTypes(): void
    {
        $eventTypes = [
            'transaction.success',
            'transaction.failed',
            'transaction.cancelled',
            'transaction.expired',
            'transaction.updated',
        ];

        foreach ($eventTypes as $eventType) {
            $result = Webhooks::parsePayload($this->validPayload($eventType));
            $this->assertSame($eventType, $result['event_type']);
        }
    }

    public function testThrowsOnInvalidJson(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid JSON in webhook payload');

        Webhooks::parsePayload('not-valid-json{');
    }

    public function testThrowsWhenPayloadIsNotObject(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Webhook payload must be a JSON object');

        Webhooks::parsePayload('"just a string"');
    }

    public function testThrowsOnUnexpectedEvent(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Unexpected webhook event');

        Webhooks::parsePayload((string) json_encode([
            'event'      => 'payment.created',
            'event_type' => 'transaction.success',
            'transaction' => ['id' => 'txn_001', 'status' => 'SUCCESS'],
        ]));
    }

    public function testThrowsOnMissingEventType(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Webhook payload missing event_type');

        Webhooks::parsePayload((string) json_encode([
            'event'       => 'transaction.updated',
            'transaction' => ['id' => 'txn_001', 'status' => 'SUCCESS'],
        ]));
    }

    public function testThrowsOnUnknownEventType(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Unknown event_type');

        Webhooks::parsePayload((string) json_encode([
            'event'       => 'transaction.updated',
            'event_type'  => 'transaction.refunded',
            'transaction' => ['id' => 'txn_001', 'status' => 'REVERSED'],
        ]));
    }

    public function testThrowsOnMissingTransaction(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Webhook payload missing transaction object');

        Webhooks::parsePayload((string) json_encode([
            'event'      => 'transaction.updated',
            'event_type' => 'transaction.success',
        ]));
    }

    public function testThrowsOnMissingTransactionId(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Webhook transaction missing id');

        Webhooks::parsePayload((string) json_encode([
            'event'       => 'transaction.updated',
            'event_type'  => 'transaction.success',
            'transaction' => ['status' => 'SUCCESS'],
        ]));
    }

    public function testThrowsOnMissingTransactionStatus(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Webhook transaction missing status');

        Webhooks::parsePayload((string) json_encode([
            'event'       => 'transaction.updated',
            'event_type'  => 'transaction.success',
            'transaction' => ['id' => 'txn_001'],
        ]));
    }
}
