import { describe, it, expect, vi } from 'vitest';
import {
  verifyPaymentSignature,
  verifyWebhookSignature,
  isRazorpayConfigured,
} from '../../lib/billing/razorpay';
import {
  processRazorpayWebhook,
  makeVerifier,
  extractEventId,
  extractEvent,
} from '../../lib/billing/webhooks';
import { createHmac } from 'crypto';

const KEY_SECRET = 'test_secret_key';
const WEBHOOK_SECRET = 'test_webhook_secret';

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

describe('razorpay signature verification', () => {
  it('valid payment signature passes', () => {
    const orderId = 'order_ABC123';
    const paymentId = 'pay_XYZ789';
    const signature = createHmac('sha256', KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const result = verifyPaymentSignature({
      orderId,
      paymentId,
      signature,
      keySecret: KEY_SECRET,
    });
    expect(result).toBe(true);
  });

  it('invalid payment signature fails', () => {
    const result = verifyPaymentSignature({
      orderId: 'order_ABC123',
      paymentId: 'pay_XYZ789',
      signature: 'invalid_signature_hex',
      keySecret: KEY_SECRET,
    });
    expect(result).toBe(false);
  });

  it('wrong key secret fails', () => {
    const orderId = 'order_ABC123';
    const paymentId = 'pay_XYZ789';
    const signature = createHmac('sha256', 'wrong_secret')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const result = verifyPaymentSignature({
      orderId,
      paymentId,
      signature,
      keySecret: KEY_SECRET,
    });
    expect(result).toBe(false);
  });

  it('valid webhook signature passes', () => {
    const body = JSON.stringify({ id: 'evt_1', event: 'payment.captured' });
    const signature = sign(body, WEBHOOK_SECRET);
    const result = verifyWebhookSignature({
      rawBody: body,
      signature,
      webhookSecret: WEBHOOK_SECRET,
    });
    expect(result).toBe(true);
  });

  it('tampered webhook body fails', () => {
    const body = JSON.stringify({ id: 'evt_1', event: 'payment.captured' });
    const signature = sign(body, WEBHOOK_SECRET);
    const tampered = JSON.stringify({ id: 'evt_1', event: 'order.paid' });
    const result = verifyWebhookSignature({
      rawBody: tampered,
      signature,
      webhookSecret: WEBHOOK_SECRET,
    });
    expect(result).toBe(false);
  });

  it('isRazorpayConfigured requires all fields', () => {
    expect(isRazorpayConfigured({ keyId: 'k', keySecret: 's', webhookSecret: 'w' })).toBe(true);
    expect(isRazorpayConfigured({ keyId: 'k', keySecret: 's', webhookSecret: '' })).toBe(false);
    expect(isRazorpayConfigured({})).toBe(false);
  });
});

describe('webhook processing', () => {
  function makeDeps(overrides: Partial<Parameters<typeof processRazorpayWebhook>[0]['deps']> = {}) {
    return {
      verifySignature: vi.fn().mockReturnValue(true),
      claimEvent: vi.fn().mockResolvedValue(true),
      markOrderPaid: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  it('rejects missing signature', async () => {
    const result = await processRazorpayWebhook({
      rawBody: '{}',
      signature: '',
      deps: makeDeps(),
    });
    expect(result.status).toBe(401);
  });

  it('rejects invalid signature', async () => {
    const deps = makeDeps({ verifySignature: vi.fn().mockReturnValue(false) });
    const result = await processRazorpayWebhook({
      rawBody: '{}',
      signature: 'bad',
      deps,
    });
    expect(result.status).toBe(401);
  });

  it('skips duplicate event (idempotency)', async () => {
    const body = JSON.stringify({
      id: 'evt_dup',
      event: 'payment.captured',
      payload: {
        payment: { id: 'pay_1', notes: { razorpay_order_id: 'order_1' } },
        order: { entity: { id: 'order_1' } },
      },
    });
    const deps = makeDeps({ claimEvent: vi.fn().mockResolvedValue(false) });
    const result = await processRazorpayWebhook({
      rawBody: body,
      signature: 'sig',
      deps,
    });
    expect(result.status).toBe(200);
    expect(result.body.skipped).toBe(true);
    expect(deps.markOrderPaid).not.toHaveBeenCalled();
  });

  it('marks order paid on payment.captured', async () => {
    const body = JSON.stringify({
      id: 'evt_ok',
      event: 'payment.captured',
      payload: {
        payment: { id: 'pay_1' },
        order: { entity: { id: 'order_1' } },
      },
    });
    const deps = makeDeps();
    const result = await processRazorpayWebhook({ rawBody: body, signature: 'sig', deps });
    expect(result.status).toBe(200);
    expect(deps.markOrderPaid).toHaveBeenCalledWith({
      razorpayOrderId: 'order_1',
      razorpayPaymentId: 'pay_1',
      eventPayload: expect.any(Object),
    });
  });

  it('ignores non-payment events', async () => {
    const body = JSON.stringify({ id: 'evt_other', event: 'refund.processed' });
    const deps = makeDeps();
    const result = await processRazorpayWebhook({ rawBody: body, signature: 'sig', deps });
    expect(result.status).toBe(200);
    expect(deps.markOrderPaid).not.toHaveBeenCalled();
  });

  it('rejects invalid JSON', async () => {
    const result = await processRazorpayWebhook({
      rawBody: 'not-json',
      signature: 'sig',
      deps: makeDeps(),
    });
    expect(result.status).toBe(400);
  });

  it('rejects missing event id', async () => {
    const body = JSON.stringify({ event: 'payment.captured' });
    const result = await processRazorpayWebhook({
      rawBody: body,
      signature: 'sig',
      deps: makeDeps(),
    });
    expect(result.status).toBe(400);
  });

  it('makeVerifier produces working verifier', () => {
    const body = JSON.stringify({ id: 'evt_x' });
    const signature = sign(body, WEBHOOK_SECRET);
    const verifier = makeVerifier(WEBHOOK_SECRET);
    expect(verifier(body, signature)).toBe(true);
    expect(verifier(body, 'bad')).toBe(false);
  });

  it('extractEventId reads header', () => {
    const headers = new Headers({ 'x-razorpay-event-id': 'evt_123' });
    expect(extractEventId(headers)).toBe('evt_123');
  });

  it('extractEvent pulls order and payment ids', () => {
    const parsed = extractEvent({
      id: 'evt_1',
      event: 'payment.captured',
      payload: {
        payment: { id: 'pay_1' },
        order: { entity: { id: 'order_1' } },
      },
    });
    expect(parsed.eventId).toBe('evt_1');
    expect(parsed.orderId).toBe('order_1');
    expect(parsed.paymentId).toBe('pay_1');
  });
});
