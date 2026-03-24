# PalPluss Go SDK

Official Go SDK for the [PalPluss](https://palpluss.com) payment API.

## Requirements

- Go 1.21+

## Installation

```bash
go get github.com/palpluss/palpluss-go
```

## Quick Start

```go
package main

import (
    "context"
    "fmt"
    "log"

    palpluss "github.com/palpluss/palpluss-go"
)

func main() {
    client, err := palpluss.New("pk_live_...")
    if err != nil {
        log.Fatal(err)
    }

    result, err := client.StkPush(context.Background(), palpluss.StkPushParams{
        Amount: 500,
        Phone:  "254712345678",
    })
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(result.TransactionID)
}
```

The API key can also be set via the `PALPLUSS_API_KEY` environment variable:

```go
client, err := palpluss.New("") // reads PALPLUSS_API_KEY from env
```

## Configuration

```go
client, err := palpluss.New(
    "pk_live_...",
    palpluss.WithTimeout(30 * time.Second),      // default: 30s
    palpluss.WithAutoRetryOnRateLimit(true),      // default: true
    palpluss.WithMaxRetries(3),                   // default: 3
    palpluss.WithBaseURL("https://custom.url/v1"), // override base URL
)
```

## Optional Parameters

Use `palpluss.Ptr` to pass optional fields inline:

```go
result, err := client.StkPush(ctx, palpluss.StkPushParams{
    Amount:           500,
    Phone:            "254712345678",
    AccountReference: palpluss.Ptr("ORDER-001"),
    TransactionDesc:  palpluss.Ptr("Order payment"),
})
```

## Methods

All methods accept `context.Context` as the first argument.

### STK Push

```go
result, err := client.StkPush(ctx, palpluss.StkPushParams{
    Amount:           500,
    Phone:            "254712345678",
    AccountReference: palpluss.Ptr("ORDER-001"),   // optional
    TransactionDesc:  palpluss.Ptr("Payment"),      // optional
    ChannelID:        palpluss.Ptr("ch_abc"),        // optional
    CallbackURL:      palpluss.Ptr("https://..."),   // optional
    CredentialID:     palpluss.Ptr("cred_abc"),      // optional
})
// result.TransactionID, result.Status, ...
```

### B2C Payout

```go
result, err := client.B2cPayout(ctx, palpluss.B2cPayoutParams{
    Amount:         1000,
    Phone:          "254712345678",
    Currency:       palpluss.Ptr("KES"),              // optional
    Reference:      palpluss.Ptr("PAYOUT-001"),       // optional
    Description:    palpluss.Ptr("Salary payment"),   // optional
    IdempotencyKey: palpluss.Ptr("uuid-..."),         // optional — auto-generated UUID v4 if nil
})
```

### Service Wallet

```go
// Get balance
balance, err := client.GetServiceBalance(ctx)
// balance.AvailableBalance, balance.Currency

// Top up
topup, err := client.ServiceTopup(ctx, palpluss.ServiceTopupParams{
    Amount:           500,
    Phone:            "254712345678",
    AccountReference: palpluss.Ptr("REF-001"),  // optional
    TransactionDesc:  palpluss.Ptr("Top up"),   // optional
    IdempotencyKey:   palpluss.Ptr("uuid-..."), // optional
})
```

### Transactions

```go
// Get single transaction
txn, err := client.GetTransaction(ctx, "txn_abc123")

// List transactions
list, err := client.ListTransactions(ctx, palpluss.ListTransactionsParams{
    Limit:  palpluss.Ptr(20),           // optional
    Cursor: palpluss.Ptr("cursor_abc"), // optional — pagination
    Status: palpluss.Ptr("SUCCESS"),    // optional
    Type:   palpluss.Ptr("STK"),        // optional — "STK" or "B2C"
})
// list.Items, list.NextCursor
```

### Payment Wallet Channels

```go
// Create
ch, err := client.CreateChannel(ctx, palpluss.CreateChannelParams{
    Type:          "PAYBILL",              // "PAYBILL", "TILL", or "SHORTCODE"
    Shortcode:     "123456",
    Name:          "My Paybill",
    AccountNumber: palpluss.Ptr("ACC-01"), // optional
    IsDefault:     palpluss.Ptr(true),     // optional
})

// Update
ch, err = client.UpdateChannel(ctx, "ch_001", palpluss.UpdateChannelParams{
    Name: palpluss.Ptr("Updated Name"),    // all fields optional
})

// Delete
err = client.DeleteChannel(ctx, "ch_001")
```

### Webhooks

```go
import palpluss "github.com/palpluss/palpluss-go"

// In your webhook HTTP handler:
payload, err := palpluss.ParseWebhookPayload(requestBody)
if err != nil {
    http.Error(w, err.Error(), http.StatusBadRequest)
    return
}

fmt.Println(payload.EventType)              // e.g. "transaction.success"
fmt.Println(payload.Transaction.ID)         // transaction ID
fmt.Println(payload.Transaction.Status)     // transaction status
```

Valid event types: `transaction.success`, `transaction.failed`, `transaction.cancelled`,
`transaction.expired`, `transaction.updated`.

## Error Handling

```go
import palpluss "github.com/palpluss/palpluss-go"

result, err := client.StkPush(ctx, params)
if err != nil {
    var rlErr *palpluss.RateLimitError
    var apiErr *palpluss.APIError

    switch {
    case errors.As(err, &rlErr):
        fmt.Printf("rate limited, retry after %ds\n", rlErr.RetryAfter)
    case errors.As(err, &apiErr):
        fmt.Printf("API error [%s] HTTP %d: %s\n",
            apiErr.ErrorCode, apiErr.HTTPStatus, apiErr.Message)
        // apiErr.RequestID — request ID from the API response
        // apiErr.Details   — additional error context
    default:
        fmt.Printf("unexpected error: %v\n", err)
    }
}
```

## Development

```bash
# Run tests
go test ./...

# Run tests with verbose output
go test ./... -v

# Run with race detector
go test ./... -race
```
