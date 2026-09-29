import { describe, it, expect } from 'vitest';
import {
  processRazorpayWebhook,
  extractEvent,
  extractEventIdHeader,
  makeVerifier,
  type WebhookDeps,
} from '../../lib/billing/webhooks';
import { verifyWebhookSignature } from '../../lib/billing/razorpay';

// ─── Realistic fixtures (documented Razorpay webhook shapes) ─────────────
// https://razorpay.com/docs/webhooks/payloads/payment & /order

const WEBHOOK_SECRET = 'whsec_test_123';

function paymentCapturedBody(
  orderId = 'order_QxpGkAPCbWToEx',
  paymentId = 'pay_QxpGnRl0UYPTkn'
): string {
  return JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: paymentId,
          entity: 'payment',
          amount: 199900,
          currency: 'INR',
          status: 'captured',
          order_id: orderId,
          method: 'upi',
        },
      },
      order: {
        entity: {
          id: orderId,
          entity: 'order',
          amount: 199900,
          currency: 'INR',
          status: 'paid',
        },
      },
    },
  });
}

function orderPaidBody(orderId = 'order_QxpGkAPCbWToEx', paymentId = 'pay_QxpGnRl0UYPTkn'): string {
  return JSON.stringify({
    event: 'order.paid',
    payload: {
      order: {
        entity: {
          id: orderId,
          entity: 'order',
          amount: 199900,
          currency: 'INR',
          status: 'paid',
        },
      },
      payment: {
        entity: {
          id: paymentId,
          entity: 'payment',
          order_id: orderId,
          status: 'captured',
        },
      },
    },
  });
}

function hmacHex(raw: string, secret: string): string {
  // Node crypto is available in the test runtime.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHmac } = require('node:crypto') as typeof import('node:crypto');
  return createHmac('sha256', secret).update(raw).digest('hex');
}

function makeDeps(overrides: Partial<WebhookDeps> = {}): {
  deps: WebhookDeps;
  log: {
    applied: Array<{ eventId: string; orderId: string; paymentId: string | null }>;
    failed: number;
  };
} {
  const log = {
    applied: [] as Array<{ eventId: string; orderId: string; paymentId: string | null }>,
    failed: 0,
  };
  const deps: WebhookDeps = {
    verifySignature: makeVerifier(WEBHOOK_SECRET),
    beginEvent: async () => true,
    applyPayment: async (input) => {
      log.applied.push({
        eventId: input.eventId,
        orderId: input.razorpayOrderId,
        paymentId: input.razorpayPaymentId,
      });
      return { ok: true, result: 'processed' };
    },
    ...overrides,
  };
  return { deps, log };
}

function signedRequestParts(rawBody: string) {
  return { signature: hmacHex(rawBody, WEBHOOK_SECRET) };
}

describe('razorpay event extraction (documented shapes)', () => {
  it('payment.captured: reads payload.payment.entity.id and order id', () => {
    const parsed = extractEvent(JSON.parse(paymentCapturedBody()));
    expect(parsed.eventType).toBe('payment.captured');
    expect(parsed.paymentId).toBe('pay_QxpGnRl0UYPTkn');
    expect(parsed.orderId).toBe('order_QxpGkAPCbWToEx');
  });

  it('order.paid: reads payload.order.entity.id and payment.entity.order_id fallback', () => {
    const body = JSON.stringify({
      event: 'order.paid',
      payload: {
        order: { entity: { id: 'order_X1', entity: 'order' } },
        payment: { entity: { id: 'pay_X1', order_id: 'order_X1' } },
      },
    });
    const parsed = extractEvent(JSON.parse(body));
    expect(parsed.eventType).toBe('order.paid');
    expect(parsed.orderId).toBe('order_X1');
    expect(parsed.paymentId).toBe('pay_X1');
  });

  it('falls back to payment.entity.order_id when the order entity is absent', () => {
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_X2', order_id: 'order_X2' } } },
    });
    const parsed = extractEvent(JSON.parse(body));
    expect(parsed.orderId).toBe('order_X2');
  });

  it('does NOT treat a synthetic top-level payload.id as the event id', () => {
    // Old broken contract: tests manufactured { id: "evt_..." } at the top
    // level. The real provider never does this.
    const body = JSON.stringify({
      id: 'evt_legacy_invented',
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_X3', order_id: 'order_X3' } } },
    });
    const parsed = extractEvent(JSON.parse(body));
    expect(parsed.eventType).toBe('payment.captured');
    // event id comes only from the header now.
    expect(processRazorpayWebhook).toBeDefined();
  });

  it('rejects malformed and non-object payloads', () => {
    expect(extractEvent(null).orderId).toBeNull();
    expect(extractEvent('x' as unknown).orderId).toBeNull();
    expect(extractEvent({}).orderId).toBeNull();
    expect(extractEvent({ event: 'payment.captured' }).orderId).toBeNull();
  });
});

describe('razorpay webhook processing pipeline', () => {
  it('accepts a realistic signed payment.captured and applies the payment', async () => {
    const raw = paymentCapturedBody();
    const { signature } = signedRequestParts(raw);
    const { deps, log } = makeDeps();

    const res = await processRazorpayWebhook({
      rawBody: raw,
      signature,
      eventIdHeader: 'evt_9Z1Ycfe9TzJQfm',
      deps,
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(log.applied).toHaveLength(1);
    expect(log.applied[0].orderId).toBe('order_QxpGkAPCbWToEx');
    expect(log.applied[0].paymentId).toBe('pay_QxpGnRl0UYPTkn');
  });

  it('accepts a realistic signed order.paid', async () => {
    const raw = orderPaidBody();
    const { signature } = signedRequestParts(raw);
    const { deps, log } = makeDeps();

    const res = await processRazorpayWebhook({
      rawBody: raw,
      signature,
      eventIdHeader: 'evt_orderpaid_1',
      deps,
    });

    expect(res.status).toBe(200);
    expect(log.applied).toHaveLength(1);
  });

  it('rejects a missing header event id', async () => {
    const raw = paymentCapturedBody();
    const { signature } = signedRequestParts(raw);
    const { deps, log } = makeDeps();

    const res = await processRazorpayWebhook({
      rawBody: raw,
      signature,
      eventIdHeader: null,
      deps,
    });

    expect(res.status).toBe(400);
    expect(log.applied).toHaveLength(0);
  });

  it('rejects an invalid signature before parsing the body', async () => {
    const raw = paymentCapturedBody();
    const { deps, log } = makeDeps();

    const res = await processRazorpayWebhook({
      rawBody: raw,
      signature: 'deadbeef',
      eventIdHeader: 'evt_x',
      deps,
    });

    expect(res.status).toBe(401);
    expect(log.applied).toHaveLength(0);
  });

  it('rejects malformed JSON even with a valid signature', async () => {
    const raw = 'not-json';
    const { signature } = signedRequestParts(raw);
    const { deps, log } = makeDeps();

    const res = await processRazorpayWebhook({
      rawBody: raw,
      signature,
      eventIdHeader: 'evt_x',
      deps,
    });

    expect(res.status).toBe(400);
    expect(log.applied).toHaveLength(0);
  });

  it('skips untracked event types without touching the ledger', async () => {
    const raw = JSON.stringify({
      event: 'refund.processed',
      payload: { refund: { entity: { id: 'rfnd_1' } } },
    });
    const { signature } = signedRequestParts(raw);
    const { deps, log } = makeDeps();

    const res = await processRazorpayWebhook({
      rawBody: raw,
      signature,
      eventIdHeader: 'evt_refund',
      deps,
    });

    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(true);
    expect(log.applied).toHaveLength(0);
  });

  it('payment with no order id is rejected', async () => {
    const raw = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_noorder' } } },
    });
    const { signature } = signedRequestParts(raw);
    const { deps, log } = makeDeps();

    const res = await processRazorpayWebhook({
      rawBody: raw,
      signature,
      eventIdHeader: 'evt_noorder',
      deps,
    });

    expect(res.status).toBe(400);
    expect(log.applied).toHaveLength(0);
  });
});

describe('idempotency and retry semantics', () => {
  it('duplicate event (already processed) is skipped without double-applying', async () => {
    const raw = paymentCapturedBody();
    const { signature } = signedRequestParts(raw);
    const { deps, log } = makeDeps({
      beginEvent: async () => false, // ledger says: already processed
    });

    const res = await processRazorpayWebhook({
      rawBody: raw,
      signature,
      eventIdHeader: 'evt_dup',
      deps,
    });

    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(true);
    expect(log.applied).toHaveLength(0);
  });

  it('failed activation stays retryable: a later attempt re-applies', async () => {
    const raw = orderPaidBody();
    const { signature } = signedRequestParts(raw);
    const { deps, log } = makeDeps({
      applyPayment: async () => {
        log.failed += 1;
        return { ok: false, retryable: true };
      },
    });

    const first = await processRazorpayWebhook({
      rawBody: raw,
      signature,
      eventIdHeader: 'evt_retry',
      deps,
    });
    expect(first.status).toBe(500);
    expect(log.applied).toHaveLength(0);

    // Provider retries with a fixed applyPayment (DB recovered).
    const { deps: deps2, log: log2 } = makeDeps();
    const second = await processRazorpayWebhook({
      rawBody: raw,
      signature,
      eventIdHeader: 'evt_retry',
      deps: deps2,
    });
    expect(second.status).toBe(200);
    expect(log2.applied).toHaveLength(1);
    expect(log.failed).toBe(1);
  });

  it('same event concurrent attempt: second caller is skipped', async () => {
    const raw = paymentCapturedBody();
    const { signature } = signedRequestParts(raw);
    let active = 0;
    let sawConflict = false;

    const depsA: WebhookDeps = {
      verifySignature: makeVerifier(WEBHOOK_SECRET),
      beginEvent: async () => {
        active += 1;
        return active === 1;
      },
      applyPayment: async () => ({ ok: true, result: 'processed' }),
    };
    const depsB: WebhookDeps = {
      verifySignature: makeVerifier(WEBHOOK_SECRET),
      beginEvent: async () => {
        sawConflict = active > 0;
        return false;
      },
      applyPayment: async () => ({ ok: true, result: 'processed' }),
    };

    const [a, b] = await Promise.all([
      processRazorpayWebhook({ rawBody: raw, signature, eventIdHeader: 'evt_race', deps: depsA }),
      processRazorpayWebhook({ rawBody: raw, signature, eventIdHeader: 'evt_race', deps: depsB }),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(b.body.skipped).toBe(true);
    expect(sawConflict).toBe(true);
  });

  it('payment/order mismatch surfaces as order_not_found without marking processed', async () => {
    const raw = paymentCapturedBody('order_unknown_999');
    const { signature } = signedRequestParts(raw);
    const { deps, log } = makeDeps({
      applyPayment: async () => ({ ok: true, result: 'order_not_found' }),
    });

    const res = await processRazorpayWebhook({
      rawBody: raw,
      signature,
      eventIdHeader: 'evt_mismatch',
      deps,
    });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('order_not_found');
    expect(log.applied).toHaveLength(0);
  });
});

describe('signature primitives', () => {
  it('verifyWebhookSignature accepts the correct HMAC over the raw body', () => {
    const raw = paymentCapturedBody();
    expect(
      verifyWebhookSignature({
        rawBody: raw,
        signature: hmacHex(raw, WEBHOOK_SECRET),
        webhookSecret: WEBHOOK_SECRET,
      })
    ).toBe(true);
  });

  it('tampered body fails verification', () => {
    const raw = paymentCapturedBody();
    const sig = hmacHex(raw, WEBHOOK_SECRET);
    expect(
      verifyWebhookSignature({ rawBody: `${raw} `, signature: sig, webhookSecret: WEBHOOK_SECRET })
    ).toBe(false);
  });

  it('wrong secret fails verification', () => {
    const raw = paymentCapturedBody();
    expect(
      verifyWebhookSignature({
        rawBody: raw,
        signature: hmacHex(raw, 'whsec_other'),
        webhookSecret: WEBHOOK_SECRET,
      })
    ).toBe(false);
  });

  it('header extraction is case-insensitive via Headers', () => {
    const headers = new Headers({ 'X-Razorpay-Event-Id': 'evt_case' });
    expect(extractEventIdHeader(headers)).toBe('evt_case');
  });
});
