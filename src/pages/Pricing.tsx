import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { PublicPlanCard } from '../lib/billing/plans';
import { OG_IMAGE_PATH } from '../lib/seo/meta';
import { usePageMeta } from '../lib/seo/usePageMeta';

function formatPrice(pricePaise: number | null, currency: string): string {
  if (pricePaise === null) return 'Contact sales';
  if (pricePaise === 0) return 'Free';
  const amount = pricePaise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Pricing() {
  const [plans, setPlans] = useState<PublicPlanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  usePageMeta({
    title: 'Pricing — Career Profile',
    description:
      'Free to build your career profile, portfolio, and ATS resume. Pro adds higher limits for active job seekers.',
    canonical: `${origin}/pricing`,
    ogType: 'website',
    ogImage: `${origin}${OG_IMAGE_PATH}`,
  });

  useEffect(() => {
    void fetch('/api/billing/plans')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load plans');
        return res.json() as Promise<{ plans: PublicPlanCard[] }>;
      })
      .then((data) => {
        setPlans(data.plans);
        setLoading(false);
      })
      .catch(() => {
        setError('Unable to load pricing right now.');
        setLoading(false);
      });
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
        <p className="mt-3 text-[var(--muted-foreground)]">
          Start free. Upgrade to Pro for higher limits, custom domains, and more recruiter AI
          questions.
        </p>
      </div>

      {loading && <p className="text-center text-gray-500">Loading plans…</p>}
      {error && <p className="text-center text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.planId}
              className={`rounded-lg border p-6 ${
                plan.planId === 'pro' ? 'border-gray-900 shadow-sm' : 'border-gray-200'
              }`}>
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-lg font-semibold capitalize">{plan.planId}</h2>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {formatPrice(plan.pricePaise, plan.currency)}
                  </div>
                  {plan.billingPeriod === 'year' && plan.pricePaise !== null && (
                    <div className="text-xs text-gray-500">/ 1 year · one-time payment</div>
                  )}
                </div>
              </div>

              <ul className="space-y-2 text-sm text-gray-700 mb-6">
                <li>{plan.entitlements.resumeVariants} resume variants</li>
                <li>{plan.entitlements.githubRepos} GitHub repos</li>
                <li>{plan.entitlements.recruiterAiPerDay} recruiter AI questions / day</li>
                <li>Unlimited deterministic job tailoring</li>
                <li>
                  {plan.entitlements.customDomains} custom domain
                  {plan.entitlements.customDomains === 1 ? '' : 's'}
                </li>
                {plan.planId === 'pro' && (
                  <li className="text-xs text-gray-500">
                    No automatic renewal — buy another year any time
                  </li>
                )}
              </ul>

              <Link
                to={plan.planId === 'pro' ? '/dashboard/billing' : '/signup'}
                className={`block w-full text-center py-2 px-4 rounded-md text-sm ${
                  plan.planId === 'pro'
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}>
                {plan.planId === 'pro' ? 'Upgrade to Pro' : 'Get started'}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
