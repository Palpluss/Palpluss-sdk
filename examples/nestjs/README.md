# PalPluss — NestJS Example

Using `@palpluss/sdk` in a NestJS service with dependency injection.

## Setup

```bash
npm install @palpluss/sdk
```

## Module + Service

```typescript
// palpluss.module.ts
import { Module } from '@nestjs/common';
import { PalPlussService } from './palpluss.service';

@Module({
  providers: [PalPlussService],
  exports: [PalPlussService],
})
export class PalPlussModule {}
```

```typescript
// palpluss.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PalPluss } from '@palpluss/sdk';

@Injectable()
export class PalPlussService {
  private readonly client: PalPluss;

  constructor(private readonly config: ConfigService) {
    this.client = new PalPluss({
      apiKey: this.config.getOrThrow('PALPLUSS_API_KEY'),
    });
  }

  get payments() {
    return this.client;
  }
}
```

## Controller

```typescript
// payments.controller.ts
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { PalPlussService } from './palpluss.service';
import { PalPlussApiError } from '@palpluss/sdk';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly palpluss: PalPlussService) {}

  @Post('stk')
  @HttpCode(200)
  async stkPush(@Body() body: { phone: string; amount: number; ref: string }) {
    try {
      return await this.palpluss.payments.stkPush({
        amount: body.amount,
        phone: body.phone,
        accountReference: body.ref,
      });
    } catch (err) {
      if (err instanceof PalPlussApiError) {
        throw { statusCode: err.httpStatus, message: err.message, code: err.code };
      }
      throw err;
    }
  }
}
```

## Webhook handler

```typescript
// webhook.controller.ts
import { Body, Controller, Post, RawBodyRequest, Req } from '@nestjs/common';
import { parseWebhookPayload } from '@palpluss/sdk';
import { Request } from 'express';

@Controller('webhook')
export class WebhookController {
  @Post()
  async handle(@Req() req: RawBodyRequest<Request>) {
    const payload = parseWebhookPayload(req.rawBody!.toString());
    // handle payload.event_type ...
    return { received: true };
  }
}
```
