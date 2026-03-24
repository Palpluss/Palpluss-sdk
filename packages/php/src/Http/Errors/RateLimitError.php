<?php

declare(strict_types=1);

namespace PalPluss\Http\Errors;

class RateLimitError extends PalPlussApiError
{
    public ?int $retryAfter;

    /**
     * @param array<string, mixed> $details
     */
    public function __construct(
        string $message,
        string $errorCode,
        array $details = [],
        ?string $requestId = null,
        ?int $retryAfter = null,
    ) {
        parent::__construct($message, $errorCode, 429, $details, $requestId);
        $this->retryAfter = $retryAfter;
    }
}
