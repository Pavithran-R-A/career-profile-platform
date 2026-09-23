import { createHmac, timingSafeEqual } from 'crypto';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

export interface RazorpayOrderRequest {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export function isRazorpayConfigured(config: Partial<RazorpayConfig>): boolean {
  return Boolean(config.keyId && config.keySecret && config.webhookSecret);
}

function basicAuth(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

export async function createRazorpayOrder(
  config: RazorpayConfig,
  request: RazorpayOrderRequest,
  fetchImpl: typeof fetch = fetch
): Promise<RazorpayOrderResponse> {
  if (!isRazorpayConfigured(config)) {
    throw new Error('RAZORPAY_NOT_CONFIGURED');
  }

  const response = await fetchImpl('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(config.keyId, config.keySecret),
    },
    body: JSON.stringify({
      amount: request.amount,
      currency: request.currency,
      receipt: request.receipt,
      notes: request.notes ?? {},
    }),
  });

  if (!response.ok) {
    throw new Error(`RAZORPAY_ORDER_CREATE_FAILED_${response.status}`);
  }

  const data = (await response.json()) as RazorpayOrderResponse;
  if (!data.id || typeof data.amount !== 'number') {
    throw new Error('RAZORPAY_ORDER_INVALID_RESPONSE');
  }

  return data;
}

export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const expected = createHmac('sha256', params.keySecret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest('hex');
  return safeEqualHex(expected, params.signature);
}

export function verifyWebhookSignature(params: {
  rawBody: string;
  signature: string;
  webhookSecret: string;
}): boolean {
  const expected = createHmac('sha256', params.webhookSecret).update(params.rawBody).digest('hex');
  return safeEqualHex(expected, params.signature);
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}
