import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { getSupabaseClient } from '../lib/supabase/client';
import type { PlanEntitlements } from '../lib/billing/plans';
import type { SubscriptionState } from '../lib/billing/entitlements';
import type { UsageCheck } from '../lib/billing/usage';
import { useNoindexMeta } from '../lib/seo/usePageMeta';

interface BillingStatus {
  subscription: SubscriptionState;
  entitlements: PlanEntitlements;
  usage: Record<string, UsageCheck>;
  pricePaise: number | null;
  currency: string;
  razorpayConfigured: boolean;
  billingEnabled?: boolean;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void };
  }
}

export default function Billing() {
  useNoindexMeta('Billing — Career Profile');
  const auth = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  // false = not pending; true = activating; 'still_processing' = bounded
  // polling window elapsed (never shown as failure).
  const [paymentPending, setPaymentPending] = useState<boolean | 'still_processing'>(false);

  const loadStatus = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/billing/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load billing status');
      const data = (await res.json()) as BillingStatus;
      setStatus(data);
      setLoading(false);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth.status === 'authenticated') {
      const supabase = getSupabaseClient();
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) void loadStatus(session.access_token);
      });
    }
  }, [auth, loadStatus]);

  useEffect(() => {
    if (auth.status === 'unauthenticated' && !loading) {
      void navigate('/login');
    }
  }, [auth, loading, navigate]);

  const handleUpgrade = async () => {
    if (auth.status !== 'authenticated') return;
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    setCheckoutLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/billing/order', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || 'Failed to create order');
      }

      const order = (await res.json()) as {
        razorpayOrderId: string;
        amountPaise: number;
        currency: string;
        keyId: string;
      };

      if (!window.Razorpay) {
        await loadScript('https://checkout.razorpay.com/v1/checkout.js');
      }

      if (!window.Razorpay) {
        throw new Error('Payment checkout failed to load');
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'Career Profile Platform',
        description: 'Pro — one year of access (one-time payment)',
        order_id: order.razorpayOrderId,
        prefill: { email: auth.user.email },
        theme: { color: '#111827' },
        handler: () => {
          // Webhook activation is ASYNC. Never claim failure because the
          // webhook hasn't landed yet: show a truthful pending state and poll
          // the server-authoritative status for a bounded window. Pro is only
          // ever granted by the server (idempotent webhook RPC).
          setCheckoutLoading(true);
          setPaymentPending(true);
          void (async () => {
            const deadline = Date.now() + 45_000;
            const delays = [2_000, 4_000, 6_000, 8_000, 10_000];
            let i = 0;
            while (Date.now() < deadline) {
              await new Promise((r) => setTimeout(r, delays[Math.min(i, delays.length - 1)]));
              i += 1;
              try {
                const res = await fetch('/api/billing/status', {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                  const data = (await res.json()) as BillingStatus;
                  setStatus(data);
                  if (data.entitlements.planId === 'pro') {
                    setPaymentPending(false);
                    setCheckoutLoading(false);
                    return;
                  }
                }
              } catch {
                // transient — keep polling until the window closes
              }
            }
            // Bounded window elapsed without activation. Do NOT show failure:
            // the payment was received; activation is still processing.
            setPaymentPending('still_processing');
            setCheckoutLoading(false);
          })();
        },

        modal: {
          ondismiss: () => {
            setCheckoutLoading(false);
          },
        },
      });

      rzp.open();
    } catch (err) {
      setError((err as Error).message);
      setCheckoutLoading(false);
    }
  };

  if (auth.status === 'loading' || loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (auth.status === 'unauthenticated' || !status) {
    return null;
  }

  const isPro = status.entitlements.planId === 'pro';
  const accessUntil = status.subscription.currentPeriodEnd
    ? new Date(status.subscription.currentPeriodEnd).toLocaleDateString()
    : null;

  const usageRows = [
    { key: 'resume_variants', label: 'Resume variants', row: status.usage.resume_variants },
    { key: 'github_repos', label: 'GitHub repos', row: status.usage.github_repos },
    { key: 'recruiter_ai', label: 'Recruiter AI (today)', row: status.usage.recruiter_ai },
    { key: 'custom_domains', label: 'Custom domains', row: status.usage.custom_domains },
  ].filter((item) => item.row);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-2">Billing</h1>
        <p className="text-gray-600">Manage your plan, usage, and payment history.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}

      {paymentPending && (
        <div
          role="status"
          className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-md mb-6">
          {paymentPending === 'still_processing'
            ? 'Payment received. Activation is still processing. Refresh shortly.'
            : 'Payment received. Activating Pro…'}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-medium">Current plan</h2>
            <p className="text-sm text-gray-500">
              {isPro
                ? status.subscription.currentPeriodEnd
                  ? `Pro access until ${accessUntil}. One-time payment — no automatic renewal.`
                  : 'Pro access. One-time payment — no automatic renewal.'
                : 'Free plan'}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              isPro ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
            }`}>
            {isPro ? 'Pro' : 'Free'}
          </span>
        </div>

        {!isPro && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Pro — 1 year of access</p>
                <p className="text-sm text-gray-500">
                  {status.pricePaise !== null
                    ? `${(status.pricePaise / 100).toLocaleString('en-IN')} ${status.currency} · one-time payment · no automatic renewal`
                    : 'Price not configured'}
                </p>
              </div>
              <button
                onClick={() => void handleUpgrade()}
                disabled={
                  checkoutLoading || !status.razorpayConfigured || status.pricePaise === null
                }
                className="bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50">
                {checkoutLoading ? 'Opening…' : 'Get Pro'}
              </button>
            </div>
            {!status.razorpayConfigured && (
              <p className="text-xs text-amber-600 mt-2">
                Payment provider is not configured on this environment.
              </p>
            )}
          </div>
        )}

        {isPro && (
          <div className="border-t pt-4">
            <p className="text-sm text-gray-500">
              When your access ends you can purchase another year any time — nothing is deleted and
              there is no automatic charge.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Usage</h2>
        <div className="space-y-3">
          {usageRows.map(({ key, label, row }) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{label}</span>
              <span className="font-medium">
                {row.used} / {row.limit}
                {!row.allowed && <span className="text-red-600 ml-2">limit reached</span>}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">Deterministic job tailoring is unlimited.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">Entitlements</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Resume variants</span>
            <span className="font-medium">{status.entitlements.resumeVariants}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">GitHub repos</span>
            <span className="font-medium">{status.entitlements.githubRepos}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Recruiter AI / day</span>
            <span className="font-medium">{status.entitlements.recruiterAiPerDay}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Job tailoring</span>
            <span className="font-medium">Unlimited</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Custom domains</span>
            <span className="font-medium">{status.entitlements.customDomains}</span>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Link
            to="/pricing"
            className="text-sm border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50">
            View pricing
          </Link>
          <Link
            to="/dashboard/domains"
            className="text-sm border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50">
            Manage domains
          </Link>
        </div>
      </div>
    </div>
  );
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Payment checkout failed to load'));
    document.head.appendChild(script);
  });
}
