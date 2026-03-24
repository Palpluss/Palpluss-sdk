package palpluss

import "fmt"

// APIError is returned for all non-2xx responses from the PalPluss API.
type APIError struct {
	// Message is the human-readable error description from the API.
	Message string
	// ErrorCode is the machine-readable error code (e.g. "INVALID_AMOUNT").
	ErrorCode string
	// HTTPStatus is the HTTP response status code.
	HTTPStatus int
	// Details contains any additional error context returned by the API.
	Details map[string]any
	// RequestID is the unique request identifier from the API response.
	RequestID string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("palpluss: %s (code=%s, status=%d, requestId=%s)",
		e.Message, e.ErrorCode, e.HTTPStatus, e.RequestID)
}

// RateLimitError is returned when the API responds with HTTP 429 Too Many Requests.
type RateLimitError struct {
	*APIError
	// RetryAfter is the number of seconds to wait before retrying, from the
	// Retry-After response header. Zero means the header was not present.
	RetryAfter int
}
