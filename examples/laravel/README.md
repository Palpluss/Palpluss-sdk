# PalPluss — Laravel / PHP Example

Integration pattern for Laravel until the official PHP SDK is available.

> The official PHP SDK (`palpluss/palpluss-php`) is not yet available. Until it is, use Laravel's HTTP client directly.

## Direct HTTP (Laravel HTTP Client)

```php
// app/Services/PalPlussService.php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Http\Client\Response;

class PalPlussService
{
    private string $baseUrl = 'https://api.palpluss.com/v1';
    private string $authHeader;

    public function __construct()
    {
        $this->authHeader = 'Basic ' . base64_encode(config('services.palpluss.key') . ':');
    }

    public function stkPush(int $amount, string $phone, string $reference = ''): array
    {
        $response = Http::withHeader('Authorization', $this->authHeader)
            ->post("{$this->baseUrl}/payments/stk", [
                'amount'           => $amount,
                'phone'            => $phone,
                'accountReference' => $reference,
            ]);

        $response->throw();

        return $response->json('data');
    }
}
```

```php
// app/Http/Controllers/PaymentController.php
<?php

namespace App\Http\Controllers;

use App\Services\PalPlussService;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(private PalPlussService $palpluss) {}

    public function pay(Request $request)
    {
        $data = $this->palpluss->stkPush(
            amount:    $request->integer('amount'),
            phone:     $request->string('phone'),
            reference: $request->string('reference'),
        );

        return response()->json(['transactionId' => $data['transactionId']]);
    }

    public function webhook(Request $request)
    {
        $payload = $request->json()->all();
        if ($payload['event_type'] === 'transaction.success') {
            logger('Payment received', ['receipt' => $payload['transaction']['mpesa_receipt']]);
        }
        return response()->noContent();
    }
}
```

```php
// config/services.php
'palpluss' => [
    'key' => env('PALPLUSS_API_KEY'),
],
```

## When the PHP SDK is ready

```php
use PalPluss\PalPluss;

$client = new PalPluss(['apiKey' => config('services.palpluss.key')]);
$stk = $client->stkPush(['amount' => 500, 'phone' => '254712345678']);
```
