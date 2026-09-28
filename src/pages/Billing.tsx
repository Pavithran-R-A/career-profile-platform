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
  cancelAtPeriodEnd?: boolean;
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
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

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
        description: 'Pro plan (annual)',
        order_id: order.razorpayOrderId,
        prefill: { email: auth.user.email },
        theme: { color: '#111827' },
        handler: () => {
          void loadStatus(token).then(() => setCheckoutLoading(false));
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

  const changeSubscription = async (action: 'cancel' | 'resume') => {
    if (auth.status !== 'authenticated') return;
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    setCancelBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/subscription/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Could not update your subscription');
      }
      await loadStatus(token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCancelBusy(false);
      setCancelConfirmOpen(false);
    }
  };

  if (auth.status === 'unauthenticated' || !status) {
    return null;
  }

  const isPro = status.entitlements.planId === 'pro';
  const cancelPending = status.cancelAtPeriodEnd === true;
  const renewDate = status.subscription.currentPeriodEnd
    ? new Date(status.subscription.currentPeriodEnd).toLocaleDateString()
    : null;

  const usageRows = [
    { key: 'resume_variants', label: 'Resume variants', row: status.usage.resume_variants },
    { key: 'github_repos', label: 'GitHub repos', row: status.usage.github_repos },
    { key: 'recruiter_ai', label: 'Recruiter AI (today)', row: status.usage.recruiter_ai },
    { key: 'tailoring', label: 'Job tailoring (month)', row: status.usage.tailoring },
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

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-medium">Current plan</h2>
            <p className="text-sm text-gray-500 capitalize">
              {status.subscription.plan}
              {status.subscription.currentPeriodEnd &&
                ` · renews ${new Date(status.subscription.currentPeriodEnd).toLocaleDateString()}`}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              isPro ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
            }`}>
            {isPro ? 'Pro' : 'Free'}
          </span>
        </div>

        {isPro && cancelPending && (
          <div className="border-t pt-4">
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Cancellation scheduled — Pro stays active through{' '}
              <strong>{renewDate ?? 'the end of your billing cycle'}</strong>, then your account
              moves to the Free plan. Nothing is deleted.
            </p>
            <div className="flex items-center justify-between mt-3">
              <p className="text-sm text-gray-500">
                Changed your mind? Keep Pro and renew as usual.
              </p>
              <button
                onClick={() => void changeSubscription('resume')}
                disabled={cancelBusy}
                className="bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50">
                {cancelBusy ? 'Working…' : 'Resume Pro'}
              </button>
            </div>
          </div>
        )}

        {isPro && !cancelPending && (
          <div className="border-t pt-4">
            {!cancelConfirmOpen ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {renewDate ? `Renews on ${renewDate}.` : 'Annual plan.'} Cancel anytime — you keep
                  Pro until the period ends.
                </p>
                <button
                  onClick={() => setCancelConfirmOpen(true)}
                  disabled={!status.billingEnabled}
                  className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 disabled:opacity-50">
                  Cancel subscription
                </button>
              </div>
            ) : (
              <div
                role="alertdialog"
                aria-label="Confirm cancellation"
                className="border border-amber-200 bg-amber-50 rounded-md p-4">
                <p className="font-medium text-amber-900">Cancel Pro at the end of this cycle?</p>
                <p className="text-sm text-amber-800 mt-1">
                  You keep every Pro feature until{' '}
                  <strong>{renewDate ?? 'the end of your billing cycle'}</strong>. After that your
                  plan becomes Free — your profile, portfolio and resumes stay yours.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => void changeSubscription('cancel')}
                    disabled={cancelBusy}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50">
                    {cancelBusy ? 'Working…' : 'Yes, cancel at period end'}
                  </button>
                  <button
                    onClick={() => setCancelConfirmOpen(false)}
                    disabled={cancelBusy}
                    className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50">
                    Keep Pro
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!isPro && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Pro annual</p>
                <p className="text-sm text-gray-500">
                  {status.pricePaise !== null
                    ? `${(status.pricePaise / 100).toLocaleString('en-IN')} ${status.currency} / year`
                    : 'Price not configured'}
                </p>
              </div>
              <button
                onClick={() => void handleUpgrade()}
                disabled={
                  checkoutLoading || !status.razorpayConfigured || status.pricePaise === null
                }
                className="bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50">
                {checkoutLoading ? 'Opening…' : 'Upgrade to Pro'}
              </button>
            </div>
            {!status.razorpayConfigured && (
              <p className="text-xs text-amber-600 mt-2">
                Payment provider is not configured on this environment.
              </p>
            )}
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
            <span className="text-gray-600">Tailoring / month</span>
            <span className="font-medium">{status.entitlements.tailoringPerMonth}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Custom domains</span>
            <span className="font-medium">{status.entitlements.customDomains}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Branding</span>
            <span className="font-medium">
              {status.entitlements.removeBranding ? 'Removed' : 'Shown'}
            </span>
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
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load payment script'));
    document.body.appendChild(script);
  });
}
