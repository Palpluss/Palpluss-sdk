export class PalPlussApiError extends Error {
  public readonly name = 'PalPlussApiError';
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly details: Record<string, unknown>;
  public readonly requestId: string | undefined;

  constructor(
    message: string,
    code: string,
    httpStatus: number,
    details: Record<string, unknown> = {},
    requestId?: string,
  ) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    this.requestId = requestId;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static fromResponse(
    httpStatus: number,
    errorBody: { message: string; code: string; details?: Record<string, unknown> },
    requestId?: string,
  ): PalPlussApiError {
    if (httpStatus === 429) {
      return new RateLimitError(
        errorBody.message,
        errorBody.code,
        errorBody.details ?? {},
        requestId,
      );
    }
    return new PalPlussApiError(
      errorBody.message,
      errorBody.code,
      httpStatus,
      errorBody.details ?? {},
      requestId,
    );
  }
}

export class RateLimitError extends PalPlussApiError {
  public retryAfter: number | undefined;

  constructor(
    message: string,
    code: string,
    details: Record<string, unknown> = {},
    requestId?: string,
    retryAfter?: number,
  ) {
    super(message, code, 429, details, requestId);
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
