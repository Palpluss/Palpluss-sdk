# PalPluss PHP SDK

> **Status: Planned**

The official PalPluss PHP SDK is not yet available. It will be published as `palpluss/palpluss-php` on Packagist.

## Planned Usage

```php
use PalPluss\PalPluss;

$client = new PalPluss(['apiKey' => 'pk_live_your_api_key']);

$stk = $client->stkPush([
    'amount' => 500,
    'phone'  => '254712345678',
    'accountReference' => 'ORDER-001',
]);

echo $stk->transactionId;
```

### Laravel

```php
// config/services.php
'palpluss' => ['key' => env('PALPLUSS_API_KEY')],

// In a service provider or controller:
$client = new \PalPluss\PalPluss(['apiKey' => config('services.palpluss.key')]);
```

## Design Notes

- Will follow the same API contract as the TypeScript SDK
- See [`openapi/palpluss-v1.yaml`](../../openapi/palpluss-v1.yaml) for the full contract
- See [`packages/typescript`](../typescript) as the reference implementation

## Contributing

See [docs/sdk-design-principles.md](../../docs/sdk-design-principles.md) before starting implementation.
