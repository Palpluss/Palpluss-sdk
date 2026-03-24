import { PalPlussApiError, RateLimitError } from '../src/http/errors';

describe('PalPlussApiError', () => {
  it('should construct with all fields', () => {
    const err = new PalPlussApiError('Not found', 'TRANSACTION_NOT_FOUND', 404, {}, 'req-123');
    expect(err.message).toBe('Not found');
    expect(err.code).toBe('TRANSACTION_NOT_FOUND');
    expect(err.httpStatus).toBe(404);
    expect(err.details).toEqual({});
    expect(err.requestId).toBe('req-123');
    expect(err.name).toBe('PalPlussApiError');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PalPlussApiError);
  });

  it('should default details to empty object', () => {
    const err = new PalPlussApiError('Bad request', 'INVALID_PHONE', 400);
    expect(err.details).toEqual({});
    expect(err.requestId).toBeUndefined();
  });

  it('should preserve details', () => {
    const details = { linkedTransactions: 5, linkedCustomers: 3 };
    const err = new PalPlussApiError('In use', 'CHANNEL_IN_USE', 409, details);
    expect(err.details).toEqual(details);
  });

  describe('fromResponse', () => {
    it('should create PalPlussApiError for non-429 status', () => {
      const err = PalPlussApiError.fromResponse(
        401,
        { message: 'Invalid key', code: 'INVALID_API_KEY' },
        'req-1',
      );
      expect(err).toBeInstanceOf(PalPlussApiError);
      expect(err).not.toBeInstanceOf(RateLimitError);
      expect(err.httpStatus).toBe(401);
      expect(err.code).toBe('INVALID_API_KEY');
      expect(err.requestId).toBe('req-1');
    });

    it('should create RateLimitError for 429 status', () => {
      const err = PalPlussApiError.fromResponse(
        429,
        { message: 'Rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' },
        'req-2',
      );
      expect(err).toBeInstanceOf(RateLimitError);
      expect(err).toBeInstanceOf(PalPlussApiError);
      expect(err.httpStatus).toBe(429);
      expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });
});

describe('RateLimitError', () => {
  it('should have retryAfter field', () => {
    const err = new RateLimitError('Rate limit', 'RATE_LIMIT_EXCEEDED', {}, 'req-3', 30);
    expect(err.retryAfter).toBe(30);
    expect(err.httpStatus).toBe(429);
    expect(err).toBeInstanceOf(PalPlussApiError);
    expect(err).toBeInstanceOf(RateLimitError);
  });

  it('should allow undefined retryAfter', () => {
    const err = new RateLimitError('Rate limit', 'RATE_LIMIT_EXCEEDED');
    expect(err.retryAfter).toBeUndefined();
  });
});
