# PalPluss Python SDK

> **Status: Planned**

The official PalPluss Python SDK is not yet available. It will be published as `palpluss` on PyPI.

## Planned Usage

```python
from palpluss import PalPluss

client = PalPluss(api_key="pk_live_your_api_key")

stk = client.stk_push(
    amount=500,
    phone="254712345678",
    account_reference="ORDER-001",
)
print(stk.transaction_id)
```

## Design Notes

- Will follow the same API contract as the TypeScript SDK
- See [`openapi/palpluss-v1.yaml`](../../openapi/palpluss-v1.yaml) for the full contract
- See [`packages/typescript`](../typescript) as the reference implementation

## Contributing

See [docs/sdk-design-principles.md](../../docs/sdk-design-principles.md) before starting implementation.
