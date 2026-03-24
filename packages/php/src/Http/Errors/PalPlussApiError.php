<?php

declare(strict_types=1);

namespace PalPluss\Http\Errors;

class PalPlussApiError extends \RuntimeException
{
    public readonly string $errorCode;
    public readonly int $httpStatus;
    /** @var array<string, mixed> */
    public readonly array $details;
    public readonly ?string $requestId;

    /**
     * @param array<string, mixed> $details
     */
    public function __construct(
        string $message,
        string $errorCode,
        int $httpStatus,
        array $details = [],
        ?string $requestId = null,
    ) {
        parent::__construct($message);
        $this->errorCode  = $errorCode;
        $this->httpStatus = $httpStatus;
        $this->details    = $details;
        $this->requestId  = $requestId;
    }

    /**
     * @param array<string, mixed> $errorBody
     */
    public static function fromResponse(
        int $httpStatus,
        array $errorBody,
        ?string $requestId = null,
    ): self {
        $message = isset($errorBody['message']) ? (string) $errorBody['message'] : 'Unknown error';
        $code    = isset($errorBody['code']) ? (string) $errorBody['code'] : 'UNKNOWN';
        /** @var array<string, mixed> $details */
        $details = isset($errorBody['details']) && is_array($errorBody['details'])
            ? $errorBody['details']
            : [];

        if ($httpStatus === 429) {
            return new RateLimitError($message, $code, $details, $requestId);
        }

        return new self($message, $code, $httpStatus, $details, $requestId);
    }

    public function __toString(): string
    {
        return sprintf(
            '%s(errorCode=%s, http_status=%d, message=%s)',
            static::class,
            $this->errorCode,
            $this->httpStatus,
            $this->getMessage(),
        );
    }
}
