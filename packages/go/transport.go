package palpluss

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type transport struct {
	client     *http.Client
	baseURL    string
	authHeader string
	autoRetry  bool
	maxRetries int
}

func newTransport(apiKey, baseURL string, timeout time.Duration, autoRetry bool, maxRetries int) *transport {
	return &transport{
		client:     &http.Client{Timeout: timeout},
		baseURL:    strings.TrimRight(baseURL, "/"),
		authHeader: "Basic " + base64.StdEncoding.EncodeToString([]byte(apiKey+":")),
		autoRetry:  autoRetry,
		maxRetries: maxRetries,
	}
}

type apiEnvelope struct {
	Success   bool            `json:"success"`
	RequestID string          `json:"requestId"`
	Data      json.RawMessage `json:"data"`
	Error     struct {
		Message string         `json:"message"`
		Code    string         `json:"code"`
		Details map[string]any `json:"details"`
	} `json:"error"`
}

func (t *transport) do(
	ctx context.Context,
	method, path string,
	body map[string]any,
	query url.Values,
	idempotencyKey string,
) (json.RawMessage, error) {
	rawURL := t.baseURL
	if strings.HasPrefix(path, "/") {
		rawURL += path
	} else {
		rawURL += "/" + path
	}
	if len(query) > 0 {
		rawURL += "?" + query.Encode()
	}

	sendBody := body != nil && (method == "POST" || method == "PATCH" || method == "PUT")
	var bodyBytes []byte
	if sendBody {
		var err error
		bodyBytes, err = json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("palpluss: marshal request body: %w", err)
		}
	}

	for attempt := 0; ; attempt++ {
		var bodyReader io.Reader
		if bodyBytes != nil {
			bodyReader = bytes.NewReader(bodyBytes)
		}

		req, err := http.NewRequestWithContext(ctx, method, rawURL, bodyReader)
		if err != nil {
			return nil, fmt.Errorf("palpluss: build request: %w", err)
		}

		req.Header.Set("Authorization", t.authHeader)
		req.Header.Set("Accept", "application/json")
		if bodyBytes != nil {
			req.Header.Set("Content-Type", "application/json")
		}
		if idempotencyKey != "" {
			req.Header.Set("Idempotency-Key", idempotencyKey)
		}

		resp, err := t.client.Do(req)
		if err != nil {
			return nil, fmt.Errorf("palpluss: http: %w", err)
		}

		if resp.StatusCode == http.StatusTooManyRequests && t.autoRetry && attempt < t.maxRetries {
			retryAfter := 1
			if v := resp.Header.Get("Retry-After"); v != "" {
				if n, err2 := strconv.Atoi(v); err2 == nil && n > 0 {
					retryAfter = n
				}
			}
			resp.Body.Close()
			time.Sleep(time.Duration(retryAfter) * time.Second)
			continue
		}

		return handleResponse(resp)
	}
}

func handleResponse(resp *http.Response) (json.RawMessage, error) {
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNoContent {
		return nil, nil
	}

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("palpluss: read response body: %w", err)
	}

	var env apiEnvelope
	if err := json.Unmarshal(b, &env); err != nil {
		return nil, fmt.Errorf("palpluss: decode response: %w", err)
	}

	isSuccess := resp.StatusCode >= 200 && resp.StatusCode < 300
	if !isSuccess || !env.Success {
		msg := env.Error.Message
		if msg == "" {
			msg = "Unknown error"
		}
		code := env.Error.Code
		if code == "" {
			code = "UNKNOWN"
		}
		apiErr := &APIError{
			Message:    msg,
			ErrorCode:  code,
			HTTPStatus: resp.StatusCode,
			Details:    env.Error.Details,
			RequestID:  env.RequestID,
		}
		if resp.StatusCode == http.StatusTooManyRequests {
			rl := &RateLimitError{APIError: apiErr}
			if v := resp.Header.Get("Retry-After"); v != "" {
				if n, err2 := strconv.Atoi(v); err2 == nil {
					rl.RetryAfter = n
				}
			}
			return nil, rl
		}
		return nil, apiErr
	}

	return env.Data, nil
}

// call executes a request and decodes the data payload into T.
func call[T any](
	ctx context.Context,
	t *transport,
	method, path string,
	body map[string]any,
	query url.Values,
	idempotencyKey string,
) (*T, error) {
	raw, err := t.do(ctx, method, path, body, query, idempotencyKey)
	if err != nil {
		return nil, err
	}
	if raw == nil {
		return nil, nil
	}
	var result T
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("palpluss: decode data: %w", err)
	}
	return &result, nil
}
