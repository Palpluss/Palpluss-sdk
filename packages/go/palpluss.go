// Package palpluss is the official Go SDK for the PalPluss payments API.
//
// Basic usage:
//
//	client, err := palpluss.New("pk_live_...")
//	if err != nil {
//	    log.Fatal(err)
//	}
//	result, err := client.StkPush(ctx, palpluss.StkPushParams{
//	    Amount: 500,
//	    Phone:  "254712345678",
//	})
package palpluss

import (
	"context"
	"crypto/rand"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"time"
)

const defaultBaseURL = "https://api.palpluss.com/v1"

// Client is the PalPluss API client.
type Client struct {
	t *transport
}

type clientConfig struct {
	baseURL    string
	timeout    time.Duration
	autoRetry  bool
	maxRetries int
}

// Option configures the Client.
type Option func(*clientConfig)

// WithBaseURL sets a custom API base URL (overrides PALPLUSS_BASE_URL env var).
func WithBaseURL(u string) Option {
	return func(c *clientConfig) { c.baseURL = u }
}

// WithTimeout sets the HTTP request timeout (default: 30s).
func WithTimeout(d time.Duration) Option {
	return func(c *clientConfig) { c.timeout = d }
}

// WithAutoRetryOnRateLimit enables or disables automatic retries on HTTP 429
// (default: true).
func WithAutoRetryOnRateLimit(enabled bool) Option {
	return func(c *clientConfig) { c.autoRetry = enabled }
}

// WithMaxRetries sets the maximum number of retry attempts (default: 3).
func WithMaxRetries(n int) Option {
	return func(c *clientConfig) { c.maxRetries = n }
}

// New creates a new PalPluss client.
//
// apiKey may be empty, in which case the PALPLUSS_API_KEY environment variable
// is used. An error is returned if no key is available.
func New(apiKey string, opts ...Option) (*Client, error) {
	if apiKey == "" {
		apiKey = os.Getenv("PALPLUSS_API_KEY")
	}
	if apiKey == "" {
		return nil, fmt.Errorf("palpluss: api_key is required")
	}

	cfg := clientConfig{
		baseURL:    defaultBaseURL,
		timeout:    30 * time.Second,
		autoRetry:  true,
		maxRetries: 3,
	}
	if envURL := os.Getenv("PALPLUSS_BASE_URL"); envURL != "" {
		cfg.baseURL = envURL
	}
	for _, opt := range opts {
		opt(&cfg)
	}

	return &Client{
		t: newTransport(apiKey, cfg.baseURL, cfg.timeout, cfg.autoRetry, cfg.maxRetries),
	}, nil
}

// ── STK Push ──────────────────────────────────────────────────────────────────

// StkPush initiates an STK Push (Lipa na M-Pesa) payment request.
func (c *Client) StkPush(ctx context.Context, params StkPushParams) (*StkInitiateResponse, error) {
	body := map[string]any{
		"amount": params.Amount,
		"phone":  params.Phone,
	}
	if params.AccountReference != nil {
		body["accountReference"] = *params.AccountReference
	}
	if params.TransactionDesc != nil {
		body["transactionDesc"] = *params.TransactionDesc
	}
	if params.ChannelID != nil {
		body["channelId"] = *params.ChannelID
	}
	if params.CallbackURL != nil {
		body["callbackUrl"] = *params.CallbackURL
	}
	if params.CredentialID != nil {
		body["credential_id"] = *params.CredentialID
	}
	return call[StkInitiateResponse](ctx, c.t, "POST", "/payments/stk", body, nil, "")
}

// ── B2C Payout ────────────────────────────────────────────────────────────────

// B2cPayout sends a B2C payout to a phone number.
// A UUID v4 idempotency key is auto-generated if IdempotencyKey is nil.
func (c *Client) B2cPayout(ctx context.Context, params B2cPayoutParams) (*B2cPayoutResponse, error) {
	key := ""
	if params.IdempotencyKey != nil && *params.IdempotencyKey != "" {
		key = *params.IdempotencyKey
	} else {
		key = generateUUIDv4()
	}

	body := map[string]any{
		"amount": params.Amount,
		"phone":  params.Phone,
	}
	if params.Currency != nil {
		body["currency"] = *params.Currency
	}
	if params.Reference != nil {
		body["reference"] = *params.Reference
	}
	if params.Description != nil {
		body["description"] = *params.Description
	}
	if params.ChannelID != nil {
		body["channelId"] = *params.ChannelID
	}
	if params.CredentialID != nil {
		body["credential_id"] = *params.CredentialID
	}
	if params.CallbackURL != nil {
		body["callback_url"] = *params.CallbackURL
	}
	return call[B2cPayoutResponse](ctx, c.t, "POST", "/b2c/payouts", body, nil, key)
}

// ── Service Wallet ────────────────────────────────────────────────────────────

// GetServiceBalance retrieves the service wallet balance.
func (c *Client) GetServiceBalance(ctx context.Context) (*ServiceWalletBalance, error) {
	return call[ServiceWalletBalance](ctx, c.t, "GET", "/wallets/service/balance", nil, nil, "")
}

// ServiceTopup initiates an STK Push to top up the service wallet.
func (c *Client) ServiceTopup(ctx context.Context, params ServiceTopupParams) (*ServiceTopupResponse, error) {
	body := map[string]any{
		"amount": params.Amount,
		"phone":  params.Phone,
	}
	if params.AccountReference != nil {
		body["accountReference"] = *params.AccountReference
	}
	if params.TransactionDesc != nil {
		body["transactionDesc"] = *params.TransactionDesc
	}
	key := ""
	if params.IdempotencyKey != nil {
		key = *params.IdempotencyKey
	}
	return call[ServiceTopupResponse](ctx, c.t, "POST", "/wallets/service/topups", body, nil, key)
}

// ── Transactions ──────────────────────────────────────────────────────────────

// GetTransaction retrieves a single transaction by ID.
func (c *Client) GetTransaction(ctx context.Context, transactionID string) (*Transaction, error) {
	return call[Transaction](ctx, c.t, "GET", "/transactions/"+transactionID, nil, nil, "")
}

// ListTransactions returns a paginated list of transactions.
// All fields on ListTransactionsParams are optional.
func (c *Client) ListTransactions(ctx context.Context, params ListTransactionsParams) (*TransactionListResponse, error) {
	q := url.Values{}
	if params.Limit != nil {
		q.Set("limit", strconv.Itoa(*params.Limit))
	}
	if params.Cursor != nil {
		q.Set("cursor", *params.Cursor)
	}
	if params.Status != nil {
		q.Set("status", *params.Status)
	}
	if params.Type != nil {
		q.Set("type", *params.Type)
	}
	return call[TransactionListResponse](ctx, c.t, "GET", "/transactions", nil, q, "")
}

// ── Payment Wallet Channels ───────────────────────────────────────────────────

// CreateChannel creates a new payment wallet channel.
func (c *Client) CreateChannel(ctx context.Context, params CreateChannelParams) (*PaymentWalletChannel, error) {
	body := map[string]any{
		"type":      params.Type,
		"shortcode": params.Shortcode,
		"name":      params.Name,
	}
	if params.AccountNumber != nil {
		body["accountNumber"] = *params.AccountNumber
	}
	if params.IsDefault != nil {
		body["isDefault"] = *params.IsDefault
	}
	return call[PaymentWalletChannel](ctx, c.t, "POST", "/payment-wallet/channels", body, nil, "")
}

// UpdateChannel updates a payment wallet channel.
// Only non-nil fields in params are sent to the API.
func (c *Client) UpdateChannel(ctx context.Context, channelID string, params UpdateChannelParams) (*PaymentWalletChannel, error) {
	body := map[string]any{}
	if params.Type != nil {
		body["type"] = *params.Type
	}
	if params.Shortcode != nil {
		body["shortcode"] = *params.Shortcode
	}
	if params.Name != nil {
		body["name"] = *params.Name
	}
	if params.AccountNumber != nil {
		body["accountNumber"] = *params.AccountNumber
	}
	if params.IsDefault != nil {
		body["isDefault"] = *params.IsDefault
	}
	return call[PaymentWalletChannel](ctx, c.t, "PATCH", "/payment-wallet/channels/"+channelID, body, nil, "")
}

// DeleteChannel deletes a payment wallet channel.
func (c *Client) DeleteChannel(ctx context.Context, channelID string) error {
	_, err := c.t.do(ctx, "DELETE", "/payment-wallet/channels/"+channelID, nil, nil, "")
	return err
}

// ── Internal helpers ──────────────────────────────────────────────────────────

func generateUUIDv4() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
