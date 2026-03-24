package palpluss_test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	palpluss "github.com/palpluss/palpluss-go"
)

// ── Test helpers ─────────────────────────────────────────────────────────────

func okJSON(data any) string {
	b, _ := json.Marshal(map[string]any{
		"success":   true,
		"requestId": "req_test",
		"data":      data,
	})
	return string(b)
}

func errJSON(status int, message, code string) string {
	b, _ := json.Marshal(map[string]any{
		"success":   false,
		"requestId": "req_err",
		"error":     map[string]any{"message": message, "code": code},
	})
	return string(b)
}

// newTestClient creates a test httptest.Server and a Client pointing at it.
// handler receives each request; call srv.Close() when done (or use t.Cleanup).
func newTestClient(t *testing.T, handler http.HandlerFunc) (*palpluss.Client, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	c, err := palpluss.New("pk_test_key", palpluss.WithBaseURL(srv.URL))
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return c, srv
}

var ctx = context.Background()

// ── Constructor ──────────────────────────────────────────────────────────────

func TestNew_NoAPIKey(t *testing.T) {
	t.Setenv("PALPLUSS_API_KEY", "")
	_, err := palpluss.New("")
	if err == nil {
		t.Fatal("expected error when no api_key")
	}
	if !strings.Contains(err.Error(), "api_key is required") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestNew_EnvVarFallback(t *testing.T) {
	t.Setenv("PALPLUSS_API_KEY", "pk_from_env")
	c, err := palpluss.New("")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c == nil {
		t.Fatal("expected non-nil client")
	}
}

func TestNew_ExplicitKey(t *testing.T) {
	c, err := palpluss.New("pk_explicit")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c == nil {
		t.Fatal("expected non-nil client")
	}
}

// ── Auth header ───────────────────────────────────────────────────────────────

func TestAuthHeaderEncoding(t *testing.T) {
	apiKey := "pk_test_abc"
	var gotAuth string

	client, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, okJSON(map[string]any{"balance": 500, "currency": "KES"}))
	})

	// Override the client with the specific key we want to test.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, okJSON(map[string]any{"walletId": "w1", "currency": "KES"}))
	}))
	t.Cleanup(srv.Close)
	_ = client

	c, err := palpluss.New(apiKey, palpluss.WithBaseURL(srv.URL))
	if err != nil {
		t.Fatal(err)
	}
	_, _ = c.GetServiceBalance(ctx)

	expected := "Basic " + base64.StdEncoding.EncodeToString([]byte(apiKey+":"))
	if gotAuth != expected {
		t.Errorf("auth header: got %q, want %q", gotAuth, expected)
	}
}

// ── Default base URL ──────────────────────────────────────────────────────────

func TestDefaultBaseURL(t *testing.T) {
	var gotURL string
	client, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		gotURL = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, okJSON(map[string]any{"walletId": "w1", "currency": "KES"}))
	})
	_, _ = client.GetServiceBalance(ctx)
	if gotURL != "/wallets/service/balance" {
		t.Errorf("path: got %q, want /wallets/service/balance", gotURL)
	}
}

// ── STK Push ─────────────────────────────────────────────────────────────────

func TestStkPush(t *testing.T) {
	client, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method: got %s, want POST", r.Method)
		}
		if r.URL.Path != "/payments/stk" {
			t.Errorf("path: got %s, want /payments/stk", r.URL.Path)
		}
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body["amount"] != float64(500) {
			t.Errorf("amount: got %v, want 500", body["amount"])
		}
		if body["phone"] != "254712345678" {
			t.Errorf("phone: got %v", body["phone"])
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, okJSON(map[string]any{"transactionId": "txn_stk_001", "status": "PENDING"}))
	})

	result, err := client.StkPush(ctx, palpluss.StkPushParams{
		Amount: 500,
		Phone:  "254712345678",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.TransactionID != "txn_stk_001" {
		t.Errorf("transactionId: got %s, want txn_stk_001", result.TransactionID)
	}
	if result.Status != "PENDING" {
		t.Errorf("status: got %s, want PENDING", result.Status)
	}
}

func TestStkPushOptionalFields(t *testing.T) {
	var gotBody map[string]any

	client, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, okJSON(map[string]any{"transactionId": "txn_001"}))
	})

	_, _ = client.StkPush(ctx, palpluss.StkPushParams{
		Amount:           250,
		Phone:            "254712345678",
		AccountReference: palpluss.Ptr("REF-001"),
		TransactionDesc:  palpluss.Ptr("Test payment"),
	})

	if gotBody["accountReference"] != "REF-001" {
		t.Errorf("accountReference: got %v", gotBody["accountReference"])
	}
	if gotBody["transactionDesc"] != "Test payment" {
		t.Errorf("transactionDesc: got %v", gotBody["transactionDesc"])
	}
}

// ── B2C Payout ────────────────────────────────────────────────────────────────

func TestB2cPayout(t *testing.T) {
	client, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, okJSON(map[string]any{"transactionId": "txn_b2c_001", "status": "PENDING"}))
	})

	result, err := client.B2cPayout(ctx, palpluss.B2cPayoutParams{
		Amount: 1000,
		Phone:  "254712345678",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.TransactionID != "txn_b2c_001" {
		t.Errorf("transactionId: got %s", result.TransactionID)
	}
}

func TestB2cAutoGeneratesIdempotencyKey(t *testing.T) {
	var gotKey string
	uuidRe := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

	client, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		gotKey = r.Header.Get("Idempotency-Key")
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, okJSON(map[string]any{"transactionId": "txn_b2c"}))
	})

	_, _ = client.B2cPayout(ctx, palpluss.B2cPayoutParams{Amount: 100, Phone: "254712345678"})

	if gotKey == "" {
		t.Fatal("expected auto-generated Idempotency-Key header")
	}
	if !uuidRe.MatchString(gotKey) {
		t.Errorf("key %q is not a valid UUID v4", gotKey)
	}
}

func TestB2cCustomIdempotencyKey(t *testing.T) {
	var gotKey string

	client, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		gotKey = r.Header.Get("Idempotency-Key")
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, okJSON(map[string]any{"transactionId": "txn_b2c"}))
	})

	_, _ = client.B2cPayout(ctx, palpluss.B2cPayoutParams{
		Amount:         100,
		Phone:          "254712345678",
		IdempotencyKey: palpluss.Ptr("my-custom-key"),
	})

	if gotKey != "my-custom-key" {
		t.Errorf("idempotency key: got %q, want my-custom-key", gotKey)
	}
}

// ── Service Wallet ────────────────────────────────────────────────────────────

func TestGetServiceBalance(t *testing.T) {
	client, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method: got %s, want GET", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, okJSON(map[string]any{
			"walletId":         "wal_001",
			"currency":         "KES",
			"availableBalance": 5000.0,
			"ledgerBalance":    5000.0,
		}))
	})

	result, err := client.GetServiceBalance(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Currency != "KES" {
		t.Errorf("currency: got %s, want KES", result.Currency)
	}
	if result.AvailableBalance != 5000.0 {
		t.Errorf("balance: got %v, want 5000.0", result.AvailableBalance)
	}
}

func TestServiceTopup(t *testing.T) {
	client, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, okJSON(map[string]any{"transactionId": "txn_topup_001", "status": "PENDING"}))
	})

	result, err := client.ServiceTopup(ctx, palpluss.ServiceTopupParams{
		Amount: 200,
		Phone:  "254712345678",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.TransactionID != "txn_topup_001" {
		t.Errorf("transactionId: got %s", result.TransactionID)
	}
}

// ── Transactions ──────────────────────────────────────────────────────────────

func TestGetTransaction(t *testing.T) {
	client, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/transactions/txn_abc123" {
			t.Errorf("path: got %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, okJSON(map[string]any{"transaction_id": "txn_abc123", "status": "SUCCESS"}))
	})

	result, err := client.GetTransaction(ctx, "txn_abc123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.TransactionID != "txn_abc123" {
		t.Errorf("transactionId: got %s", result.TransactionID)
	}
}

func TestListTransactions(t *testing.T) {
	client, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("limit") != "5" {
			t.Errorf("limit: got %s", q.Get("limit"))
		}
		if q.Get("status") != "SUCCESS" {
			t.Errorf("status: got %s", q.Get("status"))
		}
		if q.Get("type") != "STK" {
			t.Errorf("type: got %s", q.Get("type"))
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, okJSON(map[string]any{
			"items":       []map[string]any{{"transaction_id": "txn_001"}, {"transaction_id": "txn_002"}},
			"next_cursor": "cursor_abc",
		}))
	})

	result, err := client.ListTransactions(ctx, palpluss.ListTransactionsParams{
		Limit:  palpluss.Ptr(5),
		Status: palpluss.Ptr("SUCCESS"),
		Type:   palpluss.Ptr("STK"),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Items) != 2 {
		t.Errorf("items count: got %d, want 2", len(result.Items))
	}
	if result.NextCursor == nil || *result.NextCursor != "cursor_abc" {
		t.Errorf("next_cursor: got %v", result.NextCursor)
	}
}

// ── Payment Wallet Channels ───────────────────────────────────────────────────

func TestCreateChannel(t *testing.T) {
	client, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method: got %s, want POST", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, okJSON(map[string]any{"id": "ch_001", "type": "PAYBILL", "shortcode": "123456"}))
	})

	result, err := client.CreateChannel(ctx, palpluss.CreateChannelParams{
		Type:      "PAYBILL",
		Shortcode: "123456",
		Name:      "My Paybill",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.ID != "ch_001" {
		t.Errorf("id: got %s, want ch_001", result.ID)
	}
}

func TestUpdateChannel(t *testing.T) {
	client, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch {
			t.Errorf("method: got %s, want PATCH", r.Method)
		}
		if r.URL.Path != "/payment-wallet/channels/ch_001" {
			t.Errorf("path: got %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, okJSON(map[string]any{"id": "ch_001", "name": "Updated Name"}))
	})

	result, err := client.UpdateChannel(ctx, "ch_001", palpluss.UpdateChannelParams{
		Name: palpluss.Ptr("Updated Name"),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Name != "Updated Name" {
		t.Errorf("name: got %s", result.Name)
	}
}

func TestDeleteChannel(t *testing.T) {
	client, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("method: got %s, want DELETE", r.Method)
		}
		w.WriteHeader(http.StatusNoContent)
	})

	err := client.DeleteChannel(ctx, "ch_001")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// ── Error handling ────────────────────────────────────────────────────────────

func TestAPIErrorOn4xx(t *testing.T) {
	client, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintln(w, errJSON(400, "Invalid amount", "INVALID_AMOUNT"))
	})

	_, err := client.StkPush(ctx, palpluss.StkPushParams{Amount: -1, Phone: "254712345678"})
	if err == nil {
		t.Fatal("expected error")
	}

	apiErr, ok := err.(*palpluss.APIError)
	if !ok {
		t.Fatalf("expected *palpluss.APIError, got %T", err)
	}
	if apiErr.HTTPStatus != 400 {
		t.Errorf("status: got %d, want 400", apiErr.HTTPStatus)
	}
	if apiErr.ErrorCode != "INVALID_AMOUNT" {
		t.Errorf("code: got %s, want INVALID_AMOUNT", apiErr.ErrorCode)
	}
	if apiErr.Message != "Invalid amount" {
		t.Errorf("message: got %s", apiErr.Message)
	}
}

func TestRateLimitErrorOn429(t *testing.T) {
	client, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Retry-After", "30")
		w.WriteHeader(http.StatusTooManyRequests)
		fmt.Fprintln(w, errJSON(429, "Too many requests", "RATE_LIMIT"))
	})

	// Disable auto-retry so we get the error directly.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Retry-After", "30")
		w.WriteHeader(http.StatusTooManyRequests)
		fmt.Fprintln(w, errJSON(429, "Too many requests", "RATE_LIMIT"))
	}))
	t.Cleanup(srv.Close)
	_ = client

	c, err := palpluss.New("pk_test",
		palpluss.WithBaseURL(srv.URL),
		palpluss.WithAutoRetryOnRateLimit(false),
	)
	if err != nil {
		t.Fatal(err)
	}

	_, err = c.GetServiceBalance(ctx)
	if err == nil {
		t.Fatal("expected error")
	}

	rlErr, ok := err.(*palpluss.RateLimitError)
	if !ok {
		t.Fatalf("expected *palpluss.RateLimitError, got %T", err)
	}
	if rlErr.HTTPStatus != 429 {
		t.Errorf("status: got %d, want 429", rlErr.HTTPStatus)
	}
	if rlErr.ErrorCode != "RATE_LIMIT" {
		t.Errorf("code: got %s", rlErr.ErrorCode)
	}
	if rlErr.RetryAfter != 30 {
		t.Errorf("retryAfter: got %d, want 30", rlErr.RetryAfter)
	}
}

func TestRetriesOn429ThenSucceeds(t *testing.T) {
	attempts := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts == 1 {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "0")
			w.WriteHeader(http.StatusTooManyRequests)
			fmt.Fprintln(w, errJSON(429, "rate limited", "RATE_LIMIT"))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, okJSON(map[string]any{"walletId": "w1", "currency": "KES", "availableBalance": 100.0}))
	}))
	t.Cleanup(srv.Close)

	c, err := palpluss.New("pk_test",
		palpluss.WithBaseURL(srv.URL),
		palpluss.WithAutoRetryOnRateLimit(true),
		palpluss.WithMaxRetries(3),
	)
	if err != nil {
		t.Fatal(err)
	}

	result, err := c.GetServiceBalance(ctx)
	if err != nil {
		t.Fatalf("unexpected error after retry: %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if attempts != 2 {
		t.Errorf("attempts: got %d, want 2", attempts)
	}
}
