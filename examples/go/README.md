# PalPluss — Go Example

Integration pattern until the official Go SDK is available.

> The official Go SDK (`github.com/palpluss/palpluss-go`) is not yet available. Until it is, use `net/http` directly.

## Direct HTTP

```go
package palpluss

import (
    "bytes"
    "encoding/base64"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
)

const baseURL = "https://api.palpluss.com/v1"

type Client struct {
    authHeader string
    http       *http.Client
}

func New(apiKey string) *Client {
    token := base64.StdEncoding.EncodeToString([]byte(apiKey + ":"))
    return &Client{
        authHeader: "Basic " + token,
        http:       &http.Client{},
    }
}

type StkPushRequest struct {
    Amount           int    `json:"amount"`
    Phone            string `json:"phone"`
    AccountReference string `json:"accountReference,omitempty"`
}

type StkPushResponse struct {
    TransactionID string `json:"transactionId"`
    Status        string `json:"status"`
}

func (c *Client) StkPush(req StkPushRequest) (*StkPushResponse, error) {
    body, _ := json.Marshal(req)
    httpReq, _ := http.NewRequest(http.MethodPost, baseURL+"/payments/stk", bytes.NewReader(body))
    httpReq.Header.Set("Authorization", c.authHeader)
    httpReq.Header.Set("Content-Type", "application/json")

    resp, err := c.http.Do(httpReq)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    raw, _ := io.ReadAll(resp.Body)
    if resp.StatusCode >= 400 {
        return nil, fmt.Errorf("palpluss error %d: %s", resp.StatusCode, raw)
    }

    var envelope struct {
        Data StkPushResponse `json:"data"`
    }
    if err := json.Unmarshal(raw, &envelope); err != nil {
        return nil, err
    }
    return &envelope.Data, nil
}
```

```go
// main.go
package main

import (
    "fmt"
    "os"
    "your/module/palpluss"
)

func main() {
    client := palpluss.New(os.Getenv("PALPLUSS_API_KEY"))

    stk, err := client.StkPush(palpluss.StkPushRequest{
        Amount: 500,
        Phone:  "254712345678",
        AccountReference: "ORDER-001",
    })
    if err != nil {
        panic(err)
    }

    fmt.Println("Transaction:", stk.TransactionID)
}
```

## When the Go SDK is ready

```go
import palpluss "github.com/palpluss/palpluss-go"

client := palpluss.New(os.Getenv("PALPLUSS_API_KEY"))
stk, err := client.StkPush(palpluss.StkPushRequest{Amount: 500, Phone: "254712345678"})
```
