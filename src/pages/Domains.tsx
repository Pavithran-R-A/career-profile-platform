import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { getSupabaseClient } from '../lib/supabase/client';
import { ProfileService } from '../lib/profiles/service';
import type { ProfileWithRelations } from '../lib/profiles/repository';
import type { PlanEntitlements } from '../lib/billing/plans';
import type { UsageCheck } from '../lib/billing/usage';
import { useNoindexMeta } from '../lib/seo/usePageMeta';

interface CustomDomainItem {
  id: string;
  hostname: string;
  status: string;
  verification_token: string | null;
}

interface DotCvQuoteState {
  domain: string;
  pricePaise: number | null;
  currency: string;
  available: boolean | null;
  source: string;
  label: string;
}

export default function Domains() {
  useNoindexMeta('Custom domain — Career Profile');
  const auth = useAuth();
  const navigate = useNavigate();
  const profileService = new ProfileService();

  const [profile, setProfile] = useState<ProfileWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [entitlements, setEntitlements] = useState<PlanEntitlements | null>(null);
  const [domainUsage, setDomainUsage] = useState<UsageCheck | null>(null);
  const [domains, setDomains] = useState<CustomDomainItem[]>([]);
  const [hostnameInput, setHostnameInput] = useState('');
  const [dotCvInput, setDotCvInput] = useState('');
  const [quote, setQuote] = useState<DotCvQuoteState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [quoting, setQuoting] = useState(false);

  useEffect(() => {
    if (auth.status === 'authenticated') {
      void profileService.getProfile(auth.user.id).then((p) => {
        setProfile(p);
        setLoading(false);
      });
    }
  }, [auth, profileService]);

  useEffect(() => {
    if (auth.status === 'unauthenticated' && !loading) {
      void navigate('/login');
    }
  }, [auth, loading, navigate]);

  const loadBilling = useCallback(async () => {
    if (auth.status !== 'authenticated') return;
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    try {
      const res = await fetch('/api/billing/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        entitlements: PlanEntitlements;
        usage: Record<string, UsageCheck>;
      };
      setEntitlements(data.entitlements);
      setDomainUsage(data.usage.custom_domains ?? null);
    } catch {
      // ignore; UI still usable with defaults
    }
  }, [auth]);

  const loadDomains = useCallback(async () => {
    if (!profile) return;
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('custom_domains' as never)
        .select('*')
        .eq('profile_id', profile.id)
        .neq('status', 'removed' as never);
      setDomains((data as unknown as CustomDomainItem[]) ?? []);
    } catch {
      setDomains([]);
    }
  }, [profile]);

  useEffect(() => {
    void loadBilling();
    void loadDomains();
  }, [loadBilling, loadDomains]);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || auth.status !== 'authenticated') return;
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/domains/custom', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hostname: hostnameInput, profileId: profile.id }),
      });

      const body = (await res.json()) as { error?: string; hostname?: string };
      if (!res.ok) {
        throw new Error(body.error || 'Failed to add domain');
      }

      setSuccess(`Domain ${body.hostname} added. Point DNS as instructed after validation.`);
      setHostnameInput('');
      await loadDomains();
      await loadBilling();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (auth.status !== 'authenticated') return;
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    setQuoting(true);
    setError(null);
    setQuote(null);

    try {
      const res = await fetch('/api/domains/dotcv/quote', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain: dotCvInput }),
      });

      const body = (await res.json()) as { error?: string } & DotCvQuoteState;
      if (!res.ok) {
        throw new Error(body.error || 'Failed to quote domain');
      }

      setQuote(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setQuoting(false);
    }
  };

  if (auth.status === 'loading' || loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (auth.status === 'unauthenticated' || !profile) {
    return null;
  }

  const canAddDomain = domainUsage?.allowed ?? false;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-2">Domains</h1>
        <p className="text-gray-600">
          Connect a custom domain (Pro) or reserve a .cv name when the provider is available.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-6">
          {success}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Custom domains</h2>
          {domainUsage && (
            <span className="text-sm text-gray-500">
              {domainUsage.used} / {domainUsage.limit}
            </span>
          )}
        </div>

        {entitlements && entitlements.customDomains === 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md mb-4 text-sm">
            Custom domains require the Pro plan.{' '}
            <a href="/pricing" className="underline">
              View pricing
            </a>
          </div>
        )}

        <form onSubmit={(e) => void handleAddDomain(e)} className="flex gap-3 mb-4">
          <input
            type="text"
            value={hostnameInput}
            onChange={(e) => setHostnameInput(e.target.value)}
            placeholder="careers.yourname.com"
            disabled={!canAddDomain || submitting}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!canAddDomain || submitting || !hostnameInput.trim()}
            className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-800 disabled:opacity-50">
            {submitting ? 'Adding…' : 'Add domain'}
          </button>
        </form>

        {domains.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {domains.map((domain) => (
              <li key={domain.id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{domain.hostname}</p>
                  {domain.verification_token && (
                    <p className="text-xs text-gray-500 mt-1">
                      TXT value: <code>{domain.verification_token}</code>
                    </p>
                  )}
                </div>
                <span className="capitalize text-gray-500">{domain.status.replace('_', ' ')}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No custom domains yet.</p>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-medium mb-2">.cv domains</h2>
        <p className="text-sm text-gray-500 mb-4">
          .cv registration is optional and disabled by default. Quotes come from the live provider
          when configured — no fixed price is assumed here.
        </p>

        <form onSubmit={(e) => void handleQuote(e)} className="flex gap-3 mb-4">
          <input
            type="text"
            value={dotCvInput}
            onChange={(e) => setDotCvInput(e.target.value)}
            placeholder="yourname.cv"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={quoting || !dotCvInput.trim()}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50">
            {quoting ? 'Checking…' : 'Get quote'}
          </button>
        </form>

        {quote && (
          <div className="bg-gray-50 rounded-md p-4 text-sm">
            <p className="font-medium">{quote.domain}</p>
            {quote.source === 'provider' ? (
              <>
                <p className="text-gray-600 mt-1">
                  {quote.available === false
                    ? 'Not available'
                    : quote.pricePaise !== null
                      ? `${(quote.pricePaise / 100).toLocaleString('en-IN')} ${quote.currency}`
                      : 'Price unavailable — try again later'}
                </p>
                {quote.pricePaise !== null && quote.available !== false && (
                  <p className="text-xs text-gray-500 mt-2">
                    Purchase is disabled until the provider is fully configured
                    (DOTCV_PURCHASE_ENABLED).
                  </p>
                )}
              </>
            ) : (
              <p className="text-gray-600 mt-1">
                .cv provider is not configured. Set DOTCV_ENABLED and provider credentials to enable
                live quotes.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
