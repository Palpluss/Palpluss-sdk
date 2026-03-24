import { PalPlussApiError, RateLimitError } from './errors.js';

export interface HttpTransportOptions {
  apiKey: string;
  baseUrl: string;
  timeout?: number;
  autoRetryOnRateLimit?: boolean;
  maxRetries?: number;
}

export interface RequestOptions {
  body?: Record<string, unknown>;
  query?: Record<string, string | number | undefined>;
  idempotencyKey?: string;
  requestId?: string;
}

export class HttpTransport {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly autoRetryOnRateLimit: boolean;
  private readonly maxRetries: number;
  private readonly authHeader: string;

  constructor(options: HttpTransportOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.timeout = options.timeout ?? 30_000;
    this.autoRetryOnRateLimit = options.autoRetryOnRateLimit ?? true;
    this.maxRetries = options.maxRetries ?? 3;
    this.authHeader = 'Basic ' + Buffer.from(this.apiKey + ':').toString('base64');
  }

  async request<T>(
    method: string,
    path: string,
    options?: RequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path, options?.query);
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      Accept: 'application/json',
    };

    if (options?.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    if (options?.requestId) {
      headers['x-request-id'] = options.requestId;
    }

    let body: string | undefined;
    if (options?.body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    let attempt = 0;
    while (true) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      let response: Response;
      try {
        response = await fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new PalPlussApiError(
            'Request timed out',
            'TIMEOUT',
            0,
            {},
            undefined,
          );
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return undefined as T;
      }

      // Handle rate limiting with auto-retry
      if (response.status === 429 && this.autoRetryOnRateLimit && attempt < this.maxRetries) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 1;
        await this.sleep(retryAfter * 1000);
        attempt++;
        continue;
      }

      const responseBody = await response.json() as Record<string, unknown>;
      const requestId = (responseBody.requestId as string) ?? undefined;

      if (!response.ok || responseBody.success === false) {
        const error = responseBody.error as {
          message: string;
          code: string;
          details?: Record<string, unknown>;
        };

        const apiError = PalPlussApiError.fromResponse(
          response.status,
          error,
          requestId,
        );

        // Attach retryAfter to RateLimitError
        if (apiError instanceof RateLimitError) {
          const retryAfterHeader = response.headers.get('Retry-After');
          if (retryAfterHeader) {
            apiError.retryAfter = parseInt(retryAfterHeader, 10);
          }
        }

        throw apiError;
      }

      return responseBody.data as T;
    }
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | undefined>,
  ): string {
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    const url = new URL(this.baseUrl + cleanPath);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
