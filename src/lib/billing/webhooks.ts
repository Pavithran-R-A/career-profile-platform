import { verifyWebhookSignature } from './razorpay';

export interface WebhookProcessResult {
  status: number;
  body: { ok: boolean; error?: string; skipped?: boolean };
}

export interface WebhookDeps {
  verifySignature(rawBody: string, signature: string): boolean;
  claimEvent(eventId: string): Promise<boolean>;
  markOrderPaid(input: {
    razorpayOrderId: string;
    razorpayPaymentId: string | null;
    eventPayload: unknown;
  }): Promise<void>;
}

export function extractEventId(headers: Headers): string | null {
  return headers.get('x-razorpay-event-id');
}

export function extractEvent(payload: unknown): {
  eventId: string | null;
  eventType: string | null;
  orderId: string | null;
  paymentId: string | null;
} {
  if (!payload || typeof payload !== 'object') {
    return { eventId: null, eventType: null, orderId: null, paymentId: null };
  }

  const record = payload as Record<string, unknown>;
  const eventId = typeof record.id === 'string' ? record.id : null;
  const eventType = typeof record.event === 'string' ? record.event : null;

  const payloadObj = (record.payload ?? {}) as Record<string, unknown>;
  const payment = (payloadObj.payment ?? {}) as Record<string, unknown>;
  const order = (payloadObj.order ?? {}) as Record<string, unknown>;

  const paymentId =
    typeof payment.id === 'string'
      ? payment.id
      : typeof record.payment_id === 'string'
        ? record.payment_id
        : null;
  const orderId =
    typeof order.entity === 'object' && order.entity !== null
      ? (((order.entity as Record<string, unknown>).id as string | null) ?? null)
      : typeof order.id === 'string'
        ? order.id
        : typeof record.order_id === 'string'
          ? record.order_id
          : paymentId
            ? (((payment.notes as Record<string, unknown> | undefined)?.razorpay_order_id as
                string | undefined) ?? null)
            : null;

  return { eventId, eventType, orderId, paymentId };
}

export async function processRazorpayWebhook(input: {
  rawBody: string;
  signature: string;
  deps: WebhookDeps;
}): Promise<WebhookProcessResult> {
  const { rawBody, signature, deps } = input;

  if (!signature) {
    return { status: 401, body: { ok: false, error: 'Missing signature' } };
  }

  if (!deps.verifySignature(rawBody, signature)) {
    return { status: 401, body: { ok: false, error: 'Invalid signature' } };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { ok: false, error: 'Invalid JSON' } };
  }

  const parsed = extractEvent(payload);
  const eventId = parsed.eventId;

  if (!eventId) {
    return { status: 400, body: { ok: false, error: 'Missing event id' } };
  }

  const claimed = await deps.claimEvent(eventId);
  if (!claimed) {
    return { status: 200, body: { ok: true, skipped: true } };
  }

  const isPaymentEvent =
    parsed.eventType === 'payment.captured' || parsed.eventType === 'order.paid';

  if (!isPaymentEvent) {
    return { status: 200, body: { ok: true } };
  }

  if (!parsed.orderId) {
    return { status: 400, body: { ok: false, error: 'Missing order id' } };
  }

  await deps.markOrderPaid({
    razorpayOrderId: parsed.orderId,
    razorpayPaymentId: parsed.paymentId,
    eventPayload: payload,
  });

  return { status: 200, body: { ok: true } };
}

export function makeVerifier(
  webhookSecret: string
): (rawBody: string, signature: string) => boolean {
  return (rawBody, signature) => verifyWebhookSignature({ rawBody, signature, webhookSecret });
}
