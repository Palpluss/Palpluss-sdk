# PalPluss Go SDK

> **Status: Planned**

The official PalPluss Go SDK is not yet available. It will be published as `github.com/palpluss/palpluss-go`.

## Planned Usage

```go
package main

import (
    "fmt"
    palpluss "github.com/palpluss/palpluss-go"
)

func main() {
    client := palpluss.New("pk_live_your_api_key")

    stk, err := client.StkPush(palpluss.StkPushRequest{
        Amount: 500,
        Phone:  "254712345678",
        AccountReference: "ORDER-001",
    })
    if err != nil {
        panic(err)
    }

    fmt.Println(stk.TransactionID)
}
```

## Design Notes

- Will follow the same API contract as the TypeScript SDK
- See [`openapi/palpluss-v1.yaml`](../../openapi/palpluss-v1.yaml) for the full contract
- See [`packages/typescript`](../typescript) as the reference implementation

## Contributing

See [docs/sdk-design-principles.md](../../docs/sdk-design-principles.md) before starting implementation.
