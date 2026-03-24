<?php

declare(strict_types=1);

namespace PalPluss\Http;

use GuzzleHttp\Client;
use PalPluss\Http\Errors\PalPlussApiError;
use PalPluss\Http\Errors\RateLimitError;
use Psr\Http\Message\ResponseInterface;

final class HttpTransport
{
    private readonly Client $client;
    private readonly string $baseUrl;

    public function __construct(
        string $apiKey,
        string $baseUrl = 'https://api.palpluss.com/v1',
        float $timeout = 30.0,
        private readonly bool $autoRetryOnRateLimit = true,
        private readonly int $maxRetries = 3,
        ?Client $client = null,
    ) {
        $this->baseUrl = rtrim($baseUrl, '/');
        $authHeader = 'Basic ' . base64_encode($apiKey . ':');

        $this->client = $client ?? new Client([
            'timeout'     => $timeout,
            'http_errors' => false,
            'headers'     => [
                'Authorization' => $authHeader,
                'Accept'        => 'application/json',
            ],
        ]);
    }

    /**
     * @param array<string, mixed>|null  $body
     * @param array<string, mixed>|null  $query
     */
    public function request(
        string $method,
        string $path,
        ?array $body = null,
        ?array $query = null,
        ?string $idempotencyKey = null,
    ): mixed {
        $url = $this->baseUrl . (str_starts_with($path, '/') ? $path : '/' . $path);

        $options = [];

        $headers = [];
        if ($idempotencyKey !== null) {
            $headers['Idempotency-Key'] = $idempotencyKey;
        }
        if ($headers !== []) {
            $options['headers'] = $headers;
        }

        if ($body !== null && in_array($method, ['POST', 'PATCH', 'PUT'], true)) {
            $options['json'] = $body;
        }

        if ($query !== null) {
            $clean = array_filter($query, static fn (mixed $v): bool => $v !== null);
            if ($clean !== []) {
                $options['query'] = array_map('strval', $clean);
            }
        }

        $attempt = 0;
        while (true) {
            $response = $this->client->request($method, $url, $options);
            $statusCode = $response->getStatusCode();

            $rateLimited = $statusCode === 429;
            if ($rateLimited && $this->autoRetryOnRateLimit && $attempt < $this->maxRetries) {
                $retryAfter = (int) ($response->getHeaderLine('Retry-After') ?: '1');
                sleep($retryAfter);
                $attempt++;
                continue;
            }

            return $this->handleResponse($response);
        }
    }

    private function handleResponse(ResponseInterface $response): mixed
    {
        $statusCode = $response->getStatusCode();

        if ($statusCode === 204) {
            return null;
        }

        /** @var array<string, mixed> $body */
        $body = json_decode((string) $response->getBody(), true) ?? [];
        $requestId = isset($body['requestId']) ? (string) $body['requestId'] : null;

        $isSuccess = $statusCode >= 200 && $statusCode < 300;
        $successFlag = array_key_exists('success', $body) ? (bool) $body['success'] : null;

        if (!$isSuccess || $successFlag === false) {
            /** @var array<string, mixed> $error */
            $error = isset($body['error']) && is_array($body['error']) ? $body['error'] : [];
            $apiError = PalPlussApiError::fromResponse($statusCode, $error, $requestId);
            if ($apiError instanceof RateLimitError) {
                $retryAfterHeader = $response->getHeaderLine('Retry-After');
                if ($retryAfterHeader !== '') {
                    $apiError->retryAfter = (int) $retryAfterHeader;
                }
            }
            throw $apiError;
        }

        return $body['data'] ?? null;
    }
}
