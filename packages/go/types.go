package palpluss

// ── Response types ────────────────────────────────────────────────────────────

// StkInitiateResponse is returned by StkPush.
type StkInitiateResponse struct {
	TransactionID      string  `json:"transactionId"`
	TenantID           string  `json:"tenantId"`
	ChannelID          *string `json:"channelId"`
	Type               string  `json:"type"`
	Status             string  `json:"status"`
	Amount             float64 `json:"amount"`
	Currency           string  `json:"currency"`
	Phone              string  `json:"phone"`
	AccountReference   string  `json:"accountReference"`
	TransactionDesc    string  `json:"transactionDesc"`
	ProviderRequestID  string  `json:"providerRequestId"`
	ProviderCheckoutID string  `json:"providerCheckoutId"`
	ResultCode         string  `json:"resultCode"`
	ResultDescription  string  `json:"resultDescription"`
	CreatedAt          string  `json:"createdAt"`
	UpdatedAt          string  `json:"updatedAt"`
}

// B2cPayoutResponse is returned by B2cPayout.
type B2cPayoutResponse struct {
	TransactionID      string  `json:"transactionId"`
	TenantID           string  `json:"tenantId"`
	ChannelID          *string `json:"channelId"`
	Type               string  `json:"type"`
	Status             string  `json:"status"`
	Amount             float64 `json:"amount"`
	Currency           string  `json:"currency"`
	Phone              string  `json:"phone"`
	Reference          *string `json:"reference"`
	Description        *string `json:"description"`
	ProviderRequestID  *string `json:"providerRequestId"`
	ProviderCheckoutID *string `json:"providerCheckoutId"`
	ResultCode         *string `json:"resultCode"`
	ResultDescription  string  `json:"resultDescription"`
	IdempotencyKey     *string `json:"idempotencyKey"`
	CreatedAt          string  `json:"createdAt"`
	UpdatedAt          string  `json:"updatedAt"`
}

// ServiceWalletBalance is returned by GetServiceBalance.
type ServiceWalletBalance struct {
	WalletID         string  `json:"walletId"`
	TenantID         string  `json:"tenantId"`
	Currency         string  `json:"currency"`
	AvailableBalance float64 `json:"availableBalance"`
	LedgerBalance    float64 `json:"ledgerBalance"`
	UpdatedAt        string  `json:"updatedAt"`
}

// ServiceTopupResponse is returned by ServiceTopup.
type ServiceTopupResponse struct {
	TransactionID      string  `json:"transactionId"`
	TenantID           string  `json:"tenantId"`
	Type               string  `json:"type"`
	Status             string  `json:"status"`
	Amount             float64 `json:"amount"`
	Currency           string  `json:"currency"`
	Phone              string  `json:"phone"`
	AccountReference   string  `json:"accountReference"`
	TransactionDesc    string  `json:"transactionDesc"`
	ProviderRequestID  string  `json:"providerRequestId"`
	ProviderCheckoutID string  `json:"providerCheckoutId"`
	ResultCode         string  `json:"resultCode"`
	ResultDescription  string  `json:"resultDescription"`
	IdempotencyKey     *string `json:"idempotencyKey"`
	CreatedAt          string  `json:"createdAt"`
	UpdatedAt          string  `json:"updatedAt"`
}

// Transaction represents a single transaction record.
type Transaction struct {
	TransactionID      string  `json:"transaction_id"`
	TenantID           string  `json:"tenant_id"`
	Type               string  `json:"type"`
	Status             string  `json:"status"`
	Amount             float64 `json:"amount"`
	Currency           string  `json:"currency"`
	PhoneNumber        string  `json:"phone_number"`
	ChannelID          *string `json:"channel_id"`
	ExternalReference  *string `json:"external_reference"`
	CustomerName       *string `json:"customer_name"`
	CallbackURL        *string `json:"callback_url"`
	Provider           string  `json:"provider"`
	ProviderRequestID  *string `json:"provider_request_id"`
	ProviderCheckoutID *string `json:"provider_checkout_id"`
	ResultCode         *string `json:"result_code"`
	ResultDesc         *string `json:"result_desc"`
	CreatedAt          string  `json:"created_at"`
	UpdatedAt          string  `json:"updated_at"`
}

// TransactionListResponse is returned by ListTransactions.
type TransactionListResponse struct {
	Items      []Transaction `json:"items"`
	NextCursor *string       `json:"next_cursor"`
}

// PaymentWalletChannel represents a payment wallet channel.
type PaymentWalletChannel struct {
	ID            string  `json:"id"`
	TenantID      string  `json:"tenantId"`
	Category      string  `json:"category"`
	Type          string  `json:"type"`
	Shortcode     string  `json:"shortcode"`
	Name          string  `json:"name"`
	AccountNumber *string `json:"accountNumber"`
	IsDefault     bool    `json:"isDefault"`
	CreatedAt     string  `json:"createdAt"`
}

// WebhookTransaction is the transaction payload inside a webhook event.
type WebhookTransaction struct {
	ID                 string  `json:"id"`
	TenantID           string  `json:"tenant_id"`
	Type               string  `json:"type"`
	Status             string  `json:"status"`
	Amount             float64 `json:"amount"`
	Currency           string  `json:"currency"`
	PhoneNumber        string  `json:"phone_number"`
	ExternalReference  *string `json:"external_reference"`
	Provider           string  `json:"provider"`
	ProviderRequestID  *string `json:"provider_request_id"`
	ProviderCheckoutID *string `json:"provider_checkout_id"`
	ResultCode         *string `json:"result_code"`
	ResultDesc         *string `json:"result_desc"`
	MpesaReceipt       *string `json:"mpesa_receipt"`
	CreatedAt          string  `json:"created_at"`
	UpdatedAt          string  `json:"updated_at"`
}

// WebhookPayload is the parsed payload of a PalPluss webhook request.
type WebhookPayload struct {
	Event       string             `json:"event"`
	EventType   string             `json:"event_type"`
	Transaction WebhookTransaction `json:"transaction"`
}

// ── Request param types ───────────────────────────────────────────────────────

// StkPushParams holds the parameters for StkPush.
type StkPushParams struct {
	Amount           float64
	Phone            string
	AccountReference *string // optional
	TransactionDesc  *string // optional
	ChannelID        *string // optional
	CallbackURL      *string // optional
	CredentialID     *string // optional
}

// B2cPayoutParams holds the parameters for B2cPayout.
type B2cPayoutParams struct {
	Amount         float64
	Phone          string
	Currency       *string // optional
	Reference      *string // optional
	Description    *string // optional
	ChannelID      *string // optional
	CredentialID   *string // optional
	CallbackURL    *string // optional
	IdempotencyKey *string // optional — auto-generated UUID v4 if nil
}

// ServiceTopupParams holds the parameters for ServiceTopup.
type ServiceTopupParams struct {
	Amount           float64
	Phone            string
	AccountReference *string // optional
	TransactionDesc  *string // optional
	IdempotencyKey   *string // optional
}

// ListTransactionsParams holds the optional filters for ListTransactions.
type ListTransactionsParams struct {
	Limit  *int    // optional
	Cursor *string // optional — pagination cursor
	Status *string // optional — e.g. "SUCCESS", "PENDING"
	Type   *string // optional — "STK" or "B2C"
}

// CreateChannelParams holds the parameters for CreateChannel.
type CreateChannelParams struct {
	Type          string  // "PAYBILL", "TILL", or "SHORTCODE"
	Shortcode     string
	Name          string
	AccountNumber *string // optional
	IsDefault     *bool   // optional
}

// UpdateChannelParams holds the fields to update for UpdateChannel.
// All fields are optional; only non-nil fields are sent to the API.
type UpdateChannelParams struct {
	Type          *string
	Shortcode     *string
	Name          *string
	AccountNumber *string
	IsDefault     *bool
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Ptr returns a pointer to v. Useful for constructing optional param fields inline:
//
//	params := palpluss.StkPushParams{
//	    Amount:           500,
//	    Phone:            "254712345678",
//	    AccountReference: palpluss.Ptr("ORDER-001"),
//	}
func Ptr[T any](v T) *T { return &v }
