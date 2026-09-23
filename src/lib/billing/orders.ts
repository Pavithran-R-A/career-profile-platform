export type OrderStatus = 'created' | 'paid' | 'failed' | 'canceled' | 'refunded';

export interface BillingOrder {
  id: string;
  userId: string;
  planId: 'pro';
  amountPaise: number;
  currency: string;
  status: OrderStatus;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  createdAt: string;
  paidAt: string | null;
}

const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  created: ['paid', 'failed', 'canceled'],
  paid: ['refunded'],
  failed: [],
  canceled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function applyTransition(
  order: BillingOrder,
  to: OrderStatus,
  now = new Date()
): BillingOrder {
  if (!canTransition(order.status, to)) {
    throw new Error(`Invalid order transition: ${order.status} -> ${to}`);
  }
  return {
    ...order,
    status: to,
    paidAt: to === 'paid' ? now.toISOString() : order.paidAt,
  };
}

export function isPaid(order: Pick<BillingOrder, 'status'>): boolean {
  return order.status === 'paid';
}

export function createLocalOrder(input: {
  id: string;
  userId: string;
  amountPaise: number;
  currency: string;
  now?: Date;
}): BillingOrder {
  if (input.amountPaise <= 0) {
    throw new Error('Order amount must be positive');
  }
  const now = input.now ?? new Date();
  return {
    id: input.id,
    userId: input.userId,
    planId: 'pro',
    amountPaise: input.amountPaise,
    currency: input.currency,
    status: 'created',
    razorpayOrderId: null,
    razorpayPaymentId: null,
    createdAt: now.toISOString(),
    paidAt: null,
  };
}
