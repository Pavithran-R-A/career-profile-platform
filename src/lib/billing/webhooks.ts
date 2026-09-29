// Razorpay webhook processing — real provider contract.
//
// Event id:      x-razorpay-event-id header (NOT a synthetic payload.id).
// Signature:     HMAC-SHA256 over the EXACT raw request body.
// Payload shape: { event, payload: { payment: { entity }, order: { entity } } }
//                — payment and order details live under `.entity`.
//
// Processing order:
//   1. signature validation (raw body)
//   2. structural validation (JSON, entity shapes)
//   3. event id validation (header)
//   4. durable claim/process via the DB ledger + transactional RPC — a failed
//      activation leaves the event retryable; only a processed event is
//      idempotent.
import { verifyWebhookSignature } from './razorpay';

export interface WebhookProcessResult {
  status: number;
  body: { ok: boolean; error?: string; skipped?: boolean; result?: string };
}

export interface WebhookDeps {
  verifySignature(rawBody: string, signature: string): boolean;
  /** Marks an event as being processed; returns false when it is already terminally processed. */
  beginEvent(eventId: string, eventType: string | null): Promise<boolean>;
  /** Transactional activation + ledger completion. Must be idempotent per event. */
  applyPayment(input: {
    eventId: string;
    eventType: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
  }): Promise<{ ok: true; result: string } | { ok: false; retryable: boolean }>;
}

const SUPPORTED_PAYMENT_EVENTS = new Set(['payment.captured', 'order.paid']);

export function extractEventIdHeader(headers: Headers): string | null {
  return headers.get('x-razorpay-event-id');
}

export interface RazorpayEventEntities {
  eventType: string | null;
  paymentId: string | null;
  orderId: string | null;
}

/**
 * Parses the documented Razorpay webhook shape. The payment lives at
 * payload.payment.entity and the order at payload.order.entity; the order id
 * for an activation comes from order.entity.id, falling back to
 * payment.entity.order_id (payment.captured carries both objects).
 */
export function extractEvent(payload: unknown): RazorpayEventEntities {
  if (!payload || typeof payload !== 'object') {
    return { eventType: null, paymentId: null, orderId: null };
  }

  const record = payload as Record<string, unknown>;
  const eventType = typeof record.event === 'string' ? record.event : null;

  const payloadObj =
    typeof record.payload === 'object' && record.payload !== null
      ? (record.payload as Record<string, unknown>)
      : {};
  const paymentContainer =
    typeof payloadObj.payment === 'object' && payloadObj.payment !== null
      ? (payloadObj.payment as Record<string, unknown>)
      : {};
  const orderContainer =
    typeof payloadObj.order === 'object' && payloadObj.order !== null
      ? (payloadObj.order as Record<string, unknown>)
      : {};
  const paymentEntity =
    typeof paymentContainer.entity === 'object' && paymentContainer.entity !== null
      ? (paymentContainer.entity as Record<string, unknown>)
      : {};
  const orderEntity =
    typeof orderContainer.entity === 'object' && orderContainer.entity !== null
      ? (orderContainer.entity as Record<string, unknown>)
      : {};

  const paymentId =
    typeof paymentEntity.id === 'string' && paymentEntity.id.length > 0 ? paymentEntity.id : null;
  const paymentOrderId =
    typeof paymentEntity.order_id === 'string' && paymentEntity.order_id.length > 0
      ? paymentEntity.order_id
      : null;
  const orderEntityId =
    typeof orderEntity.id === 'string' && orderEntity.id.length > 0 ? orderEntity.id : null;

  const orderId = orderEntityId ?? paymentOrderId;

  return { eventType, paymentId, orderId };
}

export async function processRazorpayWebhook(input: {
  rawBody: string;
  signature: string;
  eventIdHeader: string | null;
  deps: WebhookDeps;
}): Promise<WebhookProcessResult> {
  const { rawBody, signature, eventIdHeader, deps } = input;

  // 1. Signature first — always over the exact raw body.
  if (!signature) {
    return { status: 401, body: { ok: false, error: 'Missing signature' } };
  }
  if (!deps.verifySignature(rawBody, signature)) {
    return { status: 401, body: { ok: false, error: 'Invalid signature' } };
  }

  // 2. Structural validation.
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { ok: false, error: 'Invalid JSON' } };
  }

  // 3. Event id from the verified provider header — not from the payload.
  const eventId = eventIdHeader && eventIdHeader.trim().length > 0 ? eventIdHeader.trim() : null;
  if (!eventId) {
    return { status: 400, body: { ok: false, error: 'Missing event id header' } };
  }

  const parsed = extractEvent(payload);
  const eventType = parsed.eventType;
  if (!eventType) {
    return { status: 400, body: { ok: false, error: 'Missing event type' } };
  }

  if (!SUPPORTED_PAYMENT_EVENTS.has(eventType)) {
    // Acknowledge untracked event types without acting on them.
    return { status: 200, body: { ok: true, skipped: true } };
  }

  if (!parsed.orderId || !parsed.paymentId) {
    // Documented paid-event payloads always carry both entities; anything
    // else is a structural mismatch, not a billing action.
    return { status: 400, body: { ok: false, error: 'Missing payment or order id' } };
  }

  // 4. Durable claim + transactional activation. A false beginEvent means the
  // event already completed in an earlier attempt; anything thrown from
  // applyPayment marks the attempt failed and leaves the event retryable.
  let claimed: boolean;
  try {
    claimed = await deps.beginEvent(eventId, eventType);
  } catch {
    return { status: 500, body: { ok: false, error: 'Webhook processing failed' } };
  }
  if (!claimed) {
    return { status: 200, body: { ok: true, skipped: true } };
  }

  const applied = await deps.applyPayment({
    eventId,
    eventType,
    razorpayOrderId: parsed.orderId,
    razorpayPaymentId: parsed.paymentId,
  });

  if (!applied.ok) {
    return {
      status: 500,
      body: { ok: false, error: 'Webhook processing failed; retry accepted' },
    };
  }

  return { status: 200, body: { ok: true, result: applied.result } };
}

export function makeVerifier(
  webhookSecret: string
): (rawBody: string, signature: string) => boolean {
  return (rawBody, signature) => verifyWebhookSignature({ rawBody, signature, webhookSecret });
}
