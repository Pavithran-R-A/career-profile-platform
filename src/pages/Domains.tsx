import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { getSupabaseClient } from '../lib/supabase/client';
import { ProfileService } from '../lib/profiles/service';
import type { ProfileWithRelations } from '../lib/profiles/repository';
import type { PlanEntitlements } from '../lib/billing/plans';
import type { UsageCheck } from '../lib/billing/usage';
import { useNoindexMeta } from '../lib/seo/usePageMeta';

/**
 * Mirrors the real `custom_domains` row as persisted by the worker
 * (supabase/migrations + handleAddCustomDomain). The provider's OWN
 * verification payload is authoritative — the app never invents a DNS value,
 * and the obsolete `verification_token` field is intentionally absent: it is
 * no longer written by the backend and must never be displayed.
 */
interface OwnershipValidationTxt {
  type: 'txt';
  name: string;
  value: string;
}

interface OwnershipValidationHttp {
  status: string;
  http_url?: string;
  http_body?: string;
  [key: string]: unknown;
}

interface CustomDomainItem {
  id: string;
  hostname: string;
  /** DB CHECK constraint: pending | pending_validation | active | failed | removed. */
  status: string;
  cloudflare_hostname_id: string | null;
  provider_validation: OwnershipValidationTxt | null;
  provider_validation_http: OwnershipValidationHttp | null;
  ssl_status: string | null;
  ssl_validation_records: Array<{ type: string; name: string; value: string }> | null;
  last_error: string | null;
  provider_error?: string | null;
}

interface DotCvQuoteState {
  domain: string;
  pricePaise: number | null;
  currency: string;
  available: boolean | null;
  source: string;
  label: string;
}

/** Truthful, customer-facing status labels. */
function statusLabel(status: CustomDomainItem['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'pending_validation':
      return 'Waiting for DNS verification';
    case 'active':
      return 'Active';
    case 'failed':
      return 'Failed';
    case 'removed':
      return 'Removed';
    default:
      return status;
  }
}

function statusTone(status: CustomDomainItem['status']): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'failed':
    case 'removed':
      return 'bg-red-100 text-red-800';
    case 'pending':
    case 'pending_validation':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function sslLabel(sslStatus: string | null): string | null {
  if (!sslStatus) return null;
  if (sslStatus === 'active') return 'SSL active';
  if (sslStatus === 'pending' || sslStatus === 'pending_validation') return 'SSL pending';
  if (sslStatus === 'validation_failed' || sslStatus.startsWith('error')) return 'SSL error';
  return `SSL ${sslStatus.replace(/_/g, ' ')}`;
}

function sslTone(sslStatus: string | null): string {
  if (sslStatus === 'active') return 'bg-green-100 text-green-800';
  if (sslStatus === 'pending' || sslStatus === 'pending_validation') {
    return 'bg-yellow-100 text-yellow-800';
  }
  return 'bg-red-100 text-red-800';
}

/** Shows the provider's verification record with copy buttons (a11y-safe). */
function VerificationInstructions({ domain }: { domain: CustomDomainItem }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = useCallback(async (kind: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      // Screen-reader success feedback without moving focus.
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard unavailable (permissions / http): value stays selectable.
    }
  }, []);

  const txt = domain.provider_validation;
  const http = domain.provider_validation_http;

  if (txt && txt.value) {
    return (
      <div className="mt-2 rounded-md bg-gray-50 border border-gray-200 p-3 text-xs">
        <p className="font-medium text-gray-700">Add this DNS TXT record</p>
        <dl className="mt-2 space-y-2">
          <div>
            <dt className="text-gray-500">Name</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <code className="block max-w-full text-gray-900 [overflow-wrap:anywhere]">
                {txt.name}
              </code>
              <button
                type="button"
                onClick={() => void copy('name', txt.name)}
                className="border border-gray-300 text-gray-700 px-2 py-0.5 rounded hover:bg-gray-100">
                Copy name
              </button>
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Value</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <code className="block max-w-full text-gray-900 [overflow-wrap:anywhere]">
                {txt.value}
              </code>
              <button
                type="button"
                onClick={() => void copy('value', txt.value)}
                className="border border-gray-300 text-gray-700 px-2 py-0.5 rounded hover:bg-gray-100">
                Copy value
              </button>
            </dd>
          </div>
        </dl>
        {/* aria-live feedback: announced without stealing focus. */}
        <p aria-live="polite" className="h-0 overflow-hidden">
          {copied ? `${copied === 'name' ? 'Name' : 'Value'} copied to clipboard` : ''}
        </p>
      </div>
    );
  }

  if (http && (http.http_url || http.http_body)) {
    return (
      <div className="mt-2 rounded-md bg-gray-50 border border-gray-200 p-3 text-xs">
        <p className="font-medium text-gray-700">HTTP token verification</p>
        {http.http_url && (
          <div className="mt-2">
            <p className="text-gray-500">Place this file at</p>
            <code className="block max-w-full text-gray-900 [overflow-wrap:anywhere]">
              {http.http_url}
            </code>
          </div>
        )}
        {http.http_body && (
          <div className="mt-2">
            <p className="text-gray-500">containing exactly</p>
            <code className="block max-w-full text-gray-900 [overflow-wrap:anywhere]">
              {http.http_body}
            </code>
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {http.http_url && (
            <button
              type="button"
              onClick={() => void copy('url', http.http_url ?? '')}
              className="border border-gray-300 text-gray-700 px-2 py-0.5 rounded hover:bg-gray-100">
              Copy URL
            </button>
          )}
          {http.http_body && (
            <button
              type="button"
              onClick={() => void copy('body', http.http_body ?? '')}
              className="border border-gray-300 text-gray-700 px-2 py-0.5 rounded hover:bg-gray-100">
              Copy body
            </button>
          )}
        </div>
        <p aria-live="polite" className="h-0 overflow-hidden">
          {copied
            ? `${copied === 'url' ? 'URL' : copied === 'body' ? 'Body' : 'Value'} copied to clipboard`
            : ''}
        </p>
      </div>
    );
  }

  if (domain.status === 'pending') {
    return (
      <p className="mt-1 text-xs text-gray-500">
        The domain provider is being contacted. Refresh to fetch the verification record.
      </p>
    );
  }

  // pending_validation WITHOUT a provider record: never invent DNS values —
  // tell the truth and offer Refresh to pull the provider's current state.
  return (
    <p className="mt-1 text-xs text-gray-500">
      The verification record has not been returned by the domain provider yet. Use Refresh status
      to fetch it.
    </p>
  );
}

export default function Domains() {
  useNoindexMeta('Custom domain — CVentory');
  const auth = useAuth();
  const navigate = useNavigate();
  // Stable across renders: constructing inside render and using it as an
  // effect dependency re-runs the profile load on every render.
  const profileServiceRef = useRef<ProfileService | null>(null);
  if (!profileServiceRef.current) profileServiceRef.current = new ProfileService();
  const profileService = profileServiceRef.current;

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
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

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

  const authedPost = useCallback(
    async (
      path: string,
      body: unknown
    ): Promise<{ ok: boolean; status: number; data: unknown }> => {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return { ok: false, status: 401, data: { error: 'Not signed in' } };
      try {
        const res = await fetch(path, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          // Ownership is derived server-side from the auth token; the client
          // never supplies a profileId or domain owner (IDOR hardening).
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
      } catch {
        return { ok: false, status: 0, data: { error: 'Network error' } };
      }
    },
    []
  );

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

  /** Renders the provider verification instructions the server returned. */
  const describeVerification = useCallback((record: Record<string, unknown> | null): string => {
    if (!record) return '';
    const txt = record as { type?: string; name?: string; value?: string };
    if (txt.type === 'txt' && txt.name && txt.value) {
      return `Add the DNS TXT record "${txt.name}" with the value shown below.`;
    }
    const http = record as { http_url?: string; http_body?: string };
    if (http.http_url) {
      return 'Complete the HTTP token verification shown below.';
    }
    return '';
  }, []);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || auth.status !== 'authenticated') return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    // The server returns { id, hostname, status, verification } — show the
    // ACTUAL returned instructions immediately, then reconcile from the DB.
    const result = await authedPost('/api/domains/custom', { hostname: hostnameInput });
    try {
      if (!result.ok) {
        const body = result.data as { error?: string };
        throw new Error(body.error || 'Failed to add domain');
      }
      const body = result.data as {
        id: string;
        hostname: string;
        status: string;
        verification: { method: string; record: Record<string, unknown> | null } | null;
        error?: string;
      };
      setHostnameInput('');
      if (body.status === 'failed') {
        setError(
          body.error ||
            'The domain provider is temporarily unavailable. The domain can be retried below.'
        );
      } else {
        const instructions = describeVerification(body.verification?.record ?? null);
        setSuccess(
          instructions
            ? `${body.hostname} added. ${instructions}`
            : `${body.hostname} added. Refresh the domain to fetch its verification record.`
        );
      }
      await loadDomains();
      await loadBilling();
    } catch (err) {
      setError((err as Error).message);
      // A failed provisioning attempt still leaves a retryable row —
      // reconcile so the failed state offers Retry/Remove, never a dead end.
      await loadDomains();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = async (domainId: string) => {
    setError(null);
    setSuccess(null);
    setRefreshingId(domainId);
    try {
      const result = await authedPost('/api/domains/custom/refresh', { id: domainId });
      if (!result.ok) {
        const body = result.data as { error?: string };
        throw new Error(body.error || 'Could not refresh the domain status. Please try again.');
      }
      // Update the row from the returned provider state immediately.
      const body = result.data as {
        id: string;
        hostname: string;
        status: string;
        verification: Record<string, unknown> | null;
        sslStatus: string | null;
        sslValidationRecords: Array<{ type: string; name: string; value: string }> | null;
      };
      setDomains((prev) =>
        prev.map((d) =>
          d.id === body.id
            ? {
                ...d,
                status: body.status,
                provider_validation:
                  body.verification && (body.verification as { type?: string }).type === 'txt'
                    ? (body.verification as unknown as OwnershipValidationTxt)
                    : d.provider_validation,
                provider_validation_http:
                  body.verification && !(body.verification as { type?: string }).type
                    ? (body.verification as OwnershipValidationHttp)
                    : d.provider_validation_http,
                ssl_status: body.sslStatus ?? d.ssl_status,
                ssl_validation_records: body.sslValidationRecords ?? d.ssl_validation_records,
              }
            : d
        )
      );
      // Then reconcile with the canonical DB state.
      await loadDomains();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshingId(null);
    }
  };

  const handleRemove = async (domainId: string, hostname: string) => {
    setError(null);
    setSuccess(null);
    // window.confirm is keyboard-accessible and screen-reader announced.
    const confirmed = window.confirm(
      `Remove ${hostname}? The provider resource is deleted and the domain slot is freed.`
    );
    if (!confirmed) return;
    setRemovingId(domainId);
    try {
      const result = await authedPost('/api/domains/custom/remove', { id: domainId });
      if (!result.ok) {
        const body = result.data as { error?: string };
        throw new Error(body.error || 'Could not remove the domain. Please try again.');
      }
      // Remove it from the visible list and free the quota slot (the server
      // marks the row removed; the browser never deletes DB rows directly).
      setDomains((prev) => prev.filter((d) => d.id !== domainId));
      setSuccess(`${hostname} removed. The domain slot is available again.`);
      await loadBilling();
      await loadDomains();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRemovingId(null);
    }
  };

  const handleRetry = async (domain: CustomDomainItem) => {
    setError(null);
    setSuccess(null);
    setRetryingId(domain.id);
    try {
      // Same normal add flow for the SAME hostname: the server's atomic RPC
      // re-activates the existing failed/removed row (never duplicates it)
      // and runs the normal provider provisioning.
      const result = await authedPost('/api/domains/custom', { hostname: domain.hostname });
      if (!result.ok) {
        const body = result.data as { error?: string };
        throw new Error(body.error || 'Retry failed. Please try again.');
      }
      const body = result.data as {
        id: string;
        hostname: string;
        status: string;
        verification: { method: string; record: Record<string, unknown> | null } | null;
        error?: string;
      };
      if (body.status === 'failed') {
        setError(
          body.error || 'The domain provider is still unavailable. You can retry or remove below.'
        );
      } else {
        const instructions = describeVerification(body.verification?.record ?? null);
        setSuccess(
          instructions
            ? `${body.hostname} retry started. ${instructions}`
            : `${body.hostname} retry started. Refresh the domain to fetch its verification record.`
        );
      }
      await loadDomains();
      await loadBilling();
    } catch (err) {
      setError((err as Error).message);
      await loadDomains();
    } finally {
      setRetryingId(null);
    }
  };

  const handleQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (auth.status !== 'authenticated') return;

    setQuoting(true);
    setError(null);
    setQuote(null);

    const result = await authedPost('/api/domains/dotcv/quote', { domain: dotCvInput });
    try {
      if (!result.ok) {
        const body = result.data as { error?: string };
        throw new Error(body.error || 'Failed to quote domain');
      }
      setQuote(result.data as DotCvQuoteState & { error?: string });
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

      {/* aria-live so async results are announced without stealing focus. */}
      <div aria-live="polite">
        {error && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-6">
            {success}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
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

        <form
          onSubmit={(e) => void handleAddDomain(e)}
          className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            value={hostnameInput}
            onChange={(e) => setHostnameInput(e.target.value)}
            placeholder="careers.yourname.com"
            disabled={!canAddDomain || submitting}
            className="flex-1 min-w-0 border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-50"
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
            {domains.map((domain) => {
              const ssl = sslLabel(domain.ssl_status);
              const providerError = domain.provider_error ?? domain.last_error;
              const busy =
                refreshingId === domain.id || removingId === domain.id || retryingId === domain.id;
              return (
                <li key={domain.id} className="py-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium [overflow-wrap:anywhere]">{domain.hostname}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${statusTone(domain.status)}`}>
                      {statusLabel(domain.status)}
                    </span>
                    {/* SSL is a SEPARATE signal — never equated with hostname status. */}
                    {ssl && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${sslTone(domain.ssl_status)}`}>
                        {ssl}
                      </span>
                    )}
                  </div>

                  {(domain.status === 'pending' || domain.status === 'pending_validation') && (
                    <VerificationInstructions domain={domain} />
                  )}

                  {providerError && (
                    <p className="mt-1 text-xs text-red-600 [overflow-wrap:anywhere]">
                      {providerError}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-2">
                    {(domain.status === 'pending' ||
                      domain.status === 'pending_validation' ||
                      domain.status === 'active') && (
                      <button
                        type="button"
                        onClick={() => void handleRefresh(domain.id)}
                        disabled={busy}
                        className="border border-gray-300 text-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-50 disabled:opacity-50">
                        {refreshingId === domain.id ? 'Refreshing…' : 'Refresh status'}
                      </button>
                    )}
                    {domain.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => void handleRetry(domain)}
                        disabled={busy}
                        className="border border-gray-300 text-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-50 disabled:opacity-50">
                        {retryingId === domain.id ? 'Retrying…' : 'Retry'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleRemove(domain.id, domain.hostname)}
                      disabled={busy}
                      className="border border-red-200 text-red-700 px-2 py-1 rounded text-xs hover:bg-red-50 disabled:opacity-50">
                      {removingId === domain.id ? 'Removing…' : 'Remove domain'}
                    </button>
                  </div>
                </li>
              );
            })}
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

        <form
          onSubmit={(e) => void handleQuote(e)}
          className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            value={dotCvInput}
            onChange={(e) => setDotCvInput(e.target.value)}
            placeholder="yourname.cv"
            className="flex-1 min-w-0 border border-gray-300 rounded-md px-3 py-2 text-sm"
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
            <p className="font-medium [overflow-wrap:anywhere]">{quote.domain}</p>
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
