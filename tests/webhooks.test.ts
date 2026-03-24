import { parseWebhookPayload } from '../src/webhooks';

describe('parseWebhookPayload', () => {
  const validPayload = {
    event: 'transaction.updated',
    event_type: 'transaction.success',
    transaction: {
      id: 'tx-001',
      tenant_id: 'tenant-001',
      type: 'STK',
      status: 'SUCCESS',
      amount: 100,
      currency: 'KES',
      phone_number: '254712345678',
      external_reference: 'REF-001',
      provider: 'MPESA',
      provider_request_id: 'pr-001',
      provider_checkout_id: 'pc-001',
      result_code: '0',
      result_desc: 'Success',
      mpesa_receipt: 'QHK12345AB',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
    },
  };

  it('should parse a valid webhook payload', () => {
    const result = parseWebhookPayload(JSON.stringify(validPayload));
    expect(result.event).toBe('transaction.updated');
    expect(result.event_type).toBe('transaction.success');
    expect(result.transaction.id).toBe('tx-001');
    expect(result.transaction.mpesa_receipt).toBe('QHK12345AB');
  });

  it('should parse all valid event types', () => {
    const eventTypes = [
      'transaction.success',
      'transaction.failed',
      'transaction.cancelled',
      'transaction.expired',
      'transaction.updated',
    ];

    for (const eventType of eventTypes) {
      const payload = { ...validPayload, event_type: eventType };
      const result = parseWebhookPayload(JSON.stringify(payload));
      expect(result.event_type).toBe(eventType);
    }
  });

  it('should throw on invalid JSON', () => {
    expect(() => parseWebhookPayload('not-json')).toThrow('Invalid JSON');
  });

  it('should throw on non-object payload', () => {
    expect(() => parseWebhookPayload('"string"')).toThrow('must be a JSON object');
  });

  it('should throw on unexpected event', () => {
    const payload = { ...validPayload, event: 'unknown.event' };
    expect(() => parseWebhookPayload(JSON.stringify(payload))).toThrow('Unexpected webhook event');
  });

  it('should throw on missing event_type', () => {
    const payload = { event: 'transaction.updated', transaction: validPayload.transaction };
    expect(() => parseWebhookPayload(JSON.stringify(payload))).toThrow('missing event_type');
  });

  it('should throw on unknown event_type', () => {
    const payload = { ...validPayload, event_type: 'transaction.unknown' };
    expect(() => parseWebhookPayload(JSON.stringify(payload))).toThrow('Unknown event_type');
  });

  it('should throw on missing transaction', () => {
    const payload = { event: 'transaction.updated', event_type: 'transaction.success' };
    expect(() => parseWebhookPayload(JSON.stringify(payload))).toThrow('missing transaction');
  });

  it('should throw on missing transaction id', () => {
    const payload = {
      ...validPayload,
      transaction: { ...validPayload.transaction, id: undefined },
    };
    expect(() => parseWebhookPayload(JSON.stringify(payload))).toThrow('missing id');
  });

  it('should throw on missing transaction status', () => {
    const payload = {
      ...validPayload,
      transaction: { ...validPayload.transaction, status: undefined },
    };
    expect(() => parseWebhookPayload(JSON.stringify(payload))).toThrow('missing status');
  });

  it('should handle B2C webhook with null mpesa_receipt', () => {
    const b2cPayload = {
      ...validPayload,
      event_type: 'transaction.success',
      transaction: {
        ...validPayload.transaction,
        type: 'B2C',
        mpesa_receipt: null,
      },
    };
    const result = parseWebhookPayload(JSON.stringify(b2cPayload));
    expect(result.transaction.mpesa_receipt).toBeNull();
    expect(result.transaction.type).toBe('B2C');
  });
});
