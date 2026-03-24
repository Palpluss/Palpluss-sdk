<?php

declare(strict_types=1);

namespace PalPluss\Tests;

use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\TestCase;
use PalPluss\Http\Errors\PalPlussApiError;
use PalPluss\Http\Errors\RateLimitError;
use PalPluss\Http\HttpTransport;
use PalPluss\PalPluss;

class ClientTest extends TestCase
{
    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * @param array<mixed, mixed>  $data
     */
    private function okResponse(mixed $data, string $requestId = 'req_test'): Response
    {
        return new Response(
            200,
            ['Content-Type' => 'application/json'],
            (string) json_encode(['success' => true, 'requestId' => $requestId, 'data' => $data]),
        );
    }

    private function errorResponse(int $status, string $message, string $code): Response
    {
        return new Response(
            $status,
            ['Content-Type' => 'application/json'],
            (string) json_encode([
                'success'   => false,
                'requestId' => 'req_err',
                'error'     => ['message' => $message, 'code' => $code],
            ]),
        );
    }

    /** @param Response[] $responses */
    private function makeClient(array $responses): PalPluss
    {
        $mock = new MockHandler($responses);
        $stack = HandlerStack::create($mock);
        $guzzle = new Client(['handler' => $stack, 'http_errors' => false]);
        $transport = new HttpTransport(apiKey: 'test_key', client: $guzzle);

        return new PalPluss(transport: $transport);
    }

    /**
     * @param  Response[] $responses
     * @param  array<int, array<string, mixed>> $container passed by reference to capture requests
     * @return PalPluss
     */
    private function makeClientWithHistory(array $responses, array &$container): PalPluss
    {
        $mock = new MockHandler($responses);
        $stack = HandlerStack::create($mock);
        $stack->push(Middleware::history($container));
        $guzzle = new Client(['handler' => $stack, 'http_errors' => false]);
        $transport = new HttpTransport(apiKey: 'test_key', client: $guzzle);

        return new PalPluss(transport: $transport);
    }

    // ── Constructor ──────────────────────────────────────────────────────────

    public function testThrowsWhenNoApiKey(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('PalPluss: api_key is required');
        putenv('PALPLUSS_API_KEY');
        new PalPluss();
    }

    public function testFallsBackToEnvVar(): void
    {
        putenv('PALPLUSS_API_KEY=pk_env_test');
        $client = new PalPluss();
        $this->assertInstanceOf(PalPluss::class, $client);
        putenv('PALPLUSS_API_KEY');
    }

    public function testAcceptsExplicitApiKey(): void
    {
        $client = new PalPluss(apiKey: 'pk_explicit');
        $this->assertInstanceOf(PalPluss::class, $client);
    }

    // ── Auth header ──────────────────────────────────────────────────────────

    public function testAuthHeaderBase64Encoding(): void
    {
        $apiKey = 'pk_test_abc';
        $expected = 'Basic ' . base64_encode($apiKey . ':');

        $this->assertStringStartsWith('Basic ', $expected);
        $decoded = base64_decode(substr($expected, 6));
        $this->assertSame($apiKey . ':', $decoded);
    }

    // ── Default base URL ─────────────────────────────────────────────────────

    public function testDefaultBaseUrl(): void
    {
        $container = [];
        $client = $this->makeClientWithHistory(
            [$this->okResponse(['balance' => 100.0, 'currency' => 'KES'])],
            $container,
        );

        $client->getServiceBalance();

        $uri = (string) $container[0]['request']->getUri();
        $this->assertStringContainsString('api.palpluss.com/v1', $uri);
    }

    public function testBaseUrlEnvOverride(): void
    {
        putenv('PALPLUSS_BASE_URL=https://sandbox.palpluss.com/v1');

        $client = new PalPluss(apiKey: 'pk_test');
        $this->assertInstanceOf(PalPluss::class, $client);

        putenv('PALPLUSS_BASE_URL');
    }

    // ── STK Push ─────────────────────────────────────────────────────────────

    public function testStkPushReturnsData(): void
    {
        $data = [
            'transactionId' => 'txn_stk_001',
            'status'        => 'PENDING',
            'amount'        => 500.0,
            'phone'         => '254712345678',
        ];

        $client = $this->makeClient([$this->okResponse($data)]);
        $result = $client->stkPush(amount: 500, phone: '254712345678');

        $this->assertSame('txn_stk_001', $result['transactionId']);
        $this->assertSame('PENDING', $result['status']);
    }

    public function testStkPushSendsCorrectBody(): void
    {
        $container = [];
        $client = $this->makeClientWithHistory(
            [$this->okResponse(['transactionId' => 'txn_001'])],
            $container,
        );

        $client->stkPush(
            amount: 250.0,
            phone: '254712345678',
            accountReference: 'REF123',
            transactionDesc: 'Test payment',
        );

        $body = json_decode((string) $container[0]['request']->getBody(), true);
        $this->assertEquals(250.0, $body['amount']);
        $this->assertSame('254712345678', $body['phone']);
        $this->assertSame('REF123', $body['accountReference']);
        $this->assertSame('Test payment', $body['transactionDesc']);
    }

    // ── B2C Payout ───────────────────────────────────────────────────────────

    public function testB2cPayoutReturnsData(): void
    {
        $data = [
            'transactionId' => 'txn_b2c_001',
            'status'        => 'PENDING',
            'amount'        => 1000.0,
            'phone'         => '254712345678',
        ];

        $client = $this->makeClient([$this->okResponse($data)]);
        $result = $client->b2cPayout(amount: 1000, phone: '254712345678');

        $this->assertSame('txn_b2c_001', $result['transactionId']);
    }

    public function testB2cAutoGeneratesIdempotencyKey(): void
    {
        $container = [];
        $client = $this->makeClientWithHistory(
            [$this->okResponse(['transactionId' => 'txn_b2c'])],
            $container,
        );

        $client->b2cPayout(amount: 100, phone: '254712345678');

        $sentKey = $container[0]['request']->getHeaderLine('Idempotency-Key');
        $this->assertNotEmpty($sentKey);
        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
            $sentKey,
        );
    }

    public function testB2cUsesProvidedIdempotencyKey(): void
    {
        $container = [];
        $client = $this->makeClientWithHistory(
            [$this->okResponse(['transactionId' => 'txn_b2c'])],
            $container,
        );

        $client->b2cPayout(
            amount: 100,
            phone: '254712345678',
            idempotencyKey: 'my-custom-key-123',
        );

        $sentKey = $container[0]['request']->getHeaderLine('Idempotency-Key');
        $this->assertSame('my-custom-key-123', $sentKey);
    }

    // ── Service Wallet ────────────────────────────────────────────────────────

    public function testGetServiceBalanceReturnsData(): void
    {
        $data = ['balance' => 5000.0, 'currency' => 'KES'];

        $client = $this->makeClient([$this->okResponse($data)]);
        $result = $client->getServiceBalance();

        $this->assertEquals(5000.0, $result['balance']);
        $this->assertSame('KES', $result['currency']);
    }

    public function testServiceTopupReturnsData(): void
    {
        $data = ['transactionId' => 'txn_topup_001', 'status' => 'PENDING'];

        $client = $this->makeClient([$this->okResponse($data)]);
        $result = $client->serviceTopup(amount: 200, phone: '254712345678');

        $this->assertSame('txn_topup_001', $result['transactionId']);
    }

    // ── Transactions ──────────────────────────────────────────────────────────

    public function testGetTransactionReturnsData(): void
    {
        $data = [
            'transaction_id' => 'txn_abc123',
            'status'         => 'SUCCESS',
            'amount'         => 500.0,
        ];

        $client = $this->makeClient([$this->okResponse($data)]);
        $result = $client->getTransaction('txn_abc123');

        $this->assertSame('txn_abc123', $result['transaction_id']);
        $this->assertSame('SUCCESS', $result['status']);
    }

    public function testListTransactionsReturnsData(): void
    {
        $data = [
            'items'       => [['transaction_id' => 'txn_001'], ['transaction_id' => 'txn_002']],
            'next_cursor' => 'cursor_abc',
        ];

        $client = $this->makeClient([$this->okResponse($data)]);
        $result = $client->listTransactions(limit: 2);

        $this->assertCount(2, $result['items']);
        $this->assertSame('cursor_abc', $result['next_cursor']);
    }

    public function testListTransactionsSendsQueryParams(): void
    {
        $container = [];
        $client = $this->makeClientWithHistory(
            [$this->okResponse(['items' => [], 'next_cursor' => null])],
            $container,
        );

        $client->listTransactions(limit: 5, status: 'SUCCESS', type: 'STK');

        $query = $container[0]['request']->getUri()->getQuery();
        $this->assertStringContainsString('limit=5', $query);
        $this->assertStringContainsString('status=SUCCESS', $query);
        $this->assertStringContainsString('type=STK', $query);
    }

    // ── Payment Wallet Channels ───────────────────────────────────────────────

    public function testCreateChannelReturnsData(): void
    {
        $data = ['id' => 'ch_001', 'type' => 'PAYBILL', 'shortcode' => '123456'];

        $client = $this->makeClient([$this->okResponse($data)]);
        $result = $client->createChannel(
            type: 'PAYBILL',
            shortcode: '123456',
            name: 'My Paybill',
        );

        $this->assertSame('ch_001', $result['id']);
        $this->assertSame('PAYBILL', $result['type']);
    }

    public function testUpdateChannelReturnsData(): void
    {
        $data = ['id' => 'ch_001', 'name' => 'Updated Name'];

        $client = $this->makeClient([$this->okResponse($data)]);
        $result = $client->updateChannel(channelId: 'ch_001', name: 'Updated Name');

        $this->assertSame('Updated Name', $result['name']);
    }

    public function testDeleteChannelReturnsVoid(): void
    {
        $client = $this->makeClient([new Response(204)]);

        // Should not throw
        $client->deleteChannel('ch_001');
        $this->assertTrue(true);
    }

    // ── 204 No Content ───────────────────────────────────────────────────────

    public function testReturnsNullOn204(): void
    {
        $mock = new MockHandler([new Response(204)]);
        $stack = HandlerStack::create($mock);
        $guzzle = new Client(['handler' => $stack, 'http_errors' => false]);
        $transport = new HttpTransport(apiKey: 'test_key', client: $guzzle);

        $result = $transport->request('DELETE', '/some/resource');
        $this->assertNull($result);
    }

    // ── Error handling ───────────────────────────────────────────────────────

    public function testThrowsPalPlussApiErrorOn4xx(): void
    {
        $client = $this->makeClient([
            $this->errorResponse(400, 'Invalid amount', 'INVALID_AMOUNT'),
        ]);

        try {
            $client->stkPush(amount: -1, phone: '254712345678');
            $this->fail('Expected PalPlussApiError');
        } catch (PalPlussApiError $e) {
            $this->assertSame(400, $e->httpStatus);
            $this->assertSame('INVALID_AMOUNT', $e->errorCode);
            $this->assertSame('Invalid amount', $e->getMessage());
        }
    }

    public function testThrowsRateLimitErrorOn429(): void
    {
        $response = new Response(
            429,
            ['Content-Type' => 'application/json', 'Retry-After' => '30'],
            (string) json_encode([
                'success'   => false,
                'requestId' => 'req_rl',
                'error'     => ['message' => 'Too many requests', 'code' => 'RATE_LIMIT'],
            ]),
        );

        $mock = new MockHandler([$response]);
        $stack = HandlerStack::create($mock);
        $guzzle = new Client(['handler' => $stack, 'http_errors' => false]);
        $transport = new HttpTransport(
            apiKey: 'test_key',
            client: $guzzle,
            autoRetryOnRateLimit: false,
        );
        $palpluss = new PalPluss(transport: $transport);

        try {
            $palpluss->getServiceBalance();
            $this->fail('Expected RateLimitError');
        } catch (RateLimitError $e) {
            $this->assertSame(429, $e->httpStatus);
            $this->assertSame('RATE_LIMIT', $e->errorCode);
            $this->assertSame(30, $e->retryAfter);
        }
    }

    public function testRateLimitErrorHasCorrectRequestId(): void
    {
        $response = new Response(
            429,
            ['Content-Type' => 'application/json'],
            (string) json_encode([
                'success'   => false,
                'requestId' => 'req_rl_123',
                'error'     => ['message' => 'Rate limited', 'code' => 'RATE_LIMIT'],
            ]),
        );

        $mock = new MockHandler([$response]);
        $stack = HandlerStack::create($mock);
        $guzzle = new Client(['handler' => $stack, 'http_errors' => false]);
        $transport = new HttpTransport(
            apiKey: 'test_key',
            client: $guzzle,
            autoRetryOnRateLimit: false,
        );
        $palpluss = new PalPluss(transport: $transport);

        try {
            $palpluss->getServiceBalance();
        } catch (RateLimitError $e) {
            $this->assertSame('req_rl_123', $e->requestId);
        }
    }

    // ── Retry logic ──────────────────────────────────────────────────────────

    public function testRetriesOn429ThenSucceeds(): void
    {
        $rateLimitResponse = new Response(
            429,
            ['Content-Type' => 'application/json', 'Retry-After' => '0'],
            (string) json_encode([
                'success' => false,
                'error'   => ['message' => 'Rate limited', 'code' => 'RATE_LIMIT'],
            ]),
        );
        $successResponse = $this->okResponse(['balance' => 100.0, 'currency' => 'KES']);

        $mock = new MockHandler([$rateLimitResponse, $successResponse]);
        $stack = HandlerStack::create($mock);
        $guzzle = new Client(['handler' => $stack, 'http_errors' => false]);
        $transport = new HttpTransport(
            apiKey: 'test_key',
            client: $guzzle,
            autoRetryOnRateLimit: true,
            maxRetries: 3,
        );
        $palpluss = new PalPluss(transport: $transport);

        $result = $palpluss->getServiceBalance();
        $this->assertEquals(100.0, $result['balance']);
    }
}
