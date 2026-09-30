import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Domains from '../../pages/Domains';

/**
 * Domains page contract tests. The page must render the PROVIDER'S ACTUAL
 * ownership instructions (realistic Cloudflare shapes), never the obsolete
 * `verification_token`, offer Refresh/Remove/Retry per state, update rows
 * from endpoint responses immediately, and stay mobile-safe with announced
 * copy feedback. (Scenario 10 — cross-user domain id 404 — is enforced
 * server-side and covered in domains-contract.test.ts.)
 */

const stableAuth = {
  status: 'authenticated',
  user: { id: 'user-1', email: 'qa@example.com', emailConfirmed: true },
};

vi.mock('../../lib/auth/context', () => ({ useAuth: () => stableAuth }));

// Mutable per-test state read by the mocked client at call time.
let domainRows: unknown[] = [];

vi.mock('../../lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { user: { id: 'user-1' }, access_token: 'tok-123' } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          neq: () => Promise.resolve({ data: domainRows, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock('../../lib/profiles/service', () => ({
  ProfileService: class {
    getProfile = vi.fn().mockResolvedValue({ id: 'profile-id' });
  },
}));

function renderDomains() {
  return render(<Domains />, {
    wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
  });
}

let clipboardWriteText: ReturnType<typeof vi.fn>;

/** Realistic Cloudflare for SaaS shapes. */
const TXT_DOMAIN = {
  id: 'd1',
  hostname: 'careers.example.io',
  status: 'pending_validation',
  cloudflare_hostname_id: 'cf-hostname-1',
  provider_validation: {
    type: 'txt',
    name: '_cf-custom-domain.careers.example.io',
    value: '6f8fa1e4-0d5a-4b0e-9d1a-cloudflare-verify',
  },
  provider_validation_http: null,
  ssl_status: 'pending_validation',
  ssl_validation_records: [],
  last_error: null,
};

const HTTP_DOMAIN = {
  ...TXT_DOMAIN,
  id: 'd2',
  provider_validation: null,
  provider_validation_http: {
    status: 'pending',
    http_url: 'http://careers.example.io/.well-known/acme-challenge/cf-token',
    http_body: 'cf-http-body-token-9f2c',
  },
};

const ACTIVE_DOMAIN = {
  ...TXT_DOMAIN,
  id: 'd3',
  status: 'active',
  provider_validation: null,
  ssl_status: 'active',
};

const FAILED_DOMAIN = {
  ...TXT_DOMAIN,
  id: 'd4',
  status: 'failed',
  cloudflare_hostname_id: null,
  provider_validation: null,
  ssl_status: null,
  last_error: 'provider_unavailable',
};

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

function fetchRouting(handlers: Record<string, unknown>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const handler = handlers[url];
    if (handler === undefined) throw new Error(`unexpected fetch ${url}`);
    return handler;
  });
}

const BILLING_OK = jsonResponse({
  entitlements: { customDomains: 1 },
  usage: { custom_domains: { allowed: true, used: 0, limit: 1, remaining: 1 } },
});
const BILLING_FULL = jsonResponse({
  entitlements: { customDomains: 1 },
  usage: { custom_domains: { allowed: false, used: 1, limit: 1, remaining: 0 } },
});

describe('Domains page: provider-accurate verification UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    domainRows = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => BILLING_OK)
    );
    clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWriteText },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (navigator as unknown as { clipboard?: unknown }).clipboard;
    vi.restoreAllMocks();
  });

  it('1. renders the provider TXT record exactly (name + value with copy feedback)', async () => {
    domainRows = [TXT_DOMAIN];
    renderDomains();

    expect(await screen.findByText('Add this DNS TXT record')).toBeInTheDocument();
    expect(screen.getByText('_cf-custom-domain.careers.example.io')).toBeInTheDocument();
    expect(screen.getByText('6f8fa1e4-0d5a-4b0e-9d1a-cloudflare-verify')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy name/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy value/i })).toBeInTheDocument();

    // Copy announces success via aria-live without stealing focus.
    fireEvent.click(screen.getByRole('button', { name: /copy value/i }));
    expect(await screen.findByText(/copied to clipboard/i)).toBeInTheDocument();
    expect(clipboardWriteText).toHaveBeenCalledWith('6f8fa1e4-0d5a-4b0e-9d1a-cloudflare-verify');
  });

  it('2. renders HTTP verification instructions exactly (url + body)', async () => {
    domainRows = [HTTP_DOMAIN];
    renderDomains();

    expect(await screen.findByText('HTTP token verification')).toBeInTheDocument();
    expect(
      screen.getByText('http://careers.example.io/.well-known/acme-challenge/cf-token')
    ).toBeInTheDocument();
    expect(screen.getByText('cf-http-body-token-9f2c')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy url/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy body/i })).toBeInTheDocument();
  });

  it('3. never displays the obsolete verification_token', async () => {
    domainRows = [{ ...TXT_DOMAIN, verification_token: 'legacy-should-not-render' }];
    renderDomains();

    await screen.findByText('Add this DNS TXT record');
    expect(screen.queryByText(/legacy-should-not-render/)).not.toBeInTheDocument();
    expect(screen.queryByText(/TXT value:/)).not.toBeInTheDocument();
  });

  it('4. refresh updates a pending_validation row to Active immediately', async () => {
    domainRows = [TXT_DOMAIN];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === '/api/billing/status') return BILLING_FULL;
      if (url === '/api/domains/custom/refresh') {
        // The server persisted the provider state BEFORE responding; the
        // subsequent DB reconcile must agree (active, SSL active).
        domainRows = [
          { ...TXT_DOMAIN, status: 'active', provider_validation: null, ssl_status: 'active' },
        ];
        return jsonResponse({
          id: 'd1',
          hostname: 'careers.example.io',
          status: 'active',
          verification: null,
          sslStatus: 'active',
          sslValidationRecords: [],
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderDomains();
    await screen.findByText('Waiting for DNS verification');

    fireEvent.click(screen.getByRole('button', { name: /refresh status/i }));

    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument());
    expect(screen.queryByText('Waiting for DNS verification')).not.toBeInTheDocument();
    // The separate SSL signal flipped with the provider state.
    expect(screen.getByText('SSL active')).toBeInTheDocument();
    // Refresh carried ONLY the domain id (ownership stays server-side).
    const refreshCall = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls.find(
      ([u]) => String(u).includes('/api/domains/custom/refresh')
    );
    expect(JSON.parse((refreshCall?.[1] as RequestInit).body as string)).toEqual({ id: 'd1' });
  });

  it('5. shows the SSL state separately and truthfully (active ≠ SSL active)', async () => {
    domainRows = [
      {
        ...ACTIVE_DOMAIN,
        ssl_status: 'pending_validation',
        provider_validation: {
          type: 'txt',
          name: '_cf-custom-domain.careers.example.io',
          value: 'v',
        },
      },
    ];
    renderDomains();

    // Hostname Active but SSL still pending: both truths shown separately.
    expect(await screen.findByText('Active')).toBeInTheDocument();
    expect(screen.getByText('SSL pending')).toBeInTheDocument();
  });

  it('6. remove confirms, calls the endpoint, row disappears, usage refreshes', async () => {
    domainRows = [ACTIVE_DOMAIN];
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === '/api/billing/status') return BILLING_OK;
      if (url === '/api/domains/custom/remove') {
        expect(JSON.parse(init?.body as string)).toEqual({ id: 'd3' });
        // Server marked the row removed before responding.
        domainRows = [];
        return jsonResponse({ removed: true });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderDomains();
    await screen.findByText('Active');

    fireEvent.click(screen.getByRole('button', { name: /remove domain/i }));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByText('Active')).not.toBeInTheDocument());
    // Usage reloaded after the row left (frees the quota slot in the UI).
    const billingCalls = (
      fetchMock as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls.filter(([u]) => String(u).includes('/api/billing/status'));
    expect(billingCalls.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/removed. The domain slot is available again/i)).toBeInTheDocument();
  });

  it('7. failed state offers Retry AND Remove (no dead end)', async () => {
    domainRows = [FAILED_DOMAIN];
    renderDomains();

    expect(await screen.findByText('Failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove domain/i })).toBeInTheDocument();
    expect(screen.getByText(/provider_unavailable/)).toBeInTheDocument();
  });

  it('8. retry reuses the normal add flow for the SAME hostname, shows real instructions', async () => {
    domainRows = [FAILED_DOMAIN];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === '/api/billing/status') return BILLING_OK;
      if (url === '/api/domains/custom') {
        // Retry = normal add flow with the SAME hostname (server's atomic RPC
        // re-activates the existing row instead of duplicating it).
        expect(JSON.parse(init?.body as string)).toEqual({ hostname: 'careers.example.io' });
        domainRows = [{ ...FAILED_DOMAIN, status: 'pending_validation' }];
        return jsonResponse({
          id: 'd4',
          hostname: 'careers.example.io',
          status: 'pending_validation',
          verification: {
            method: 'txt',
            record: {
              type: 'txt',
              name: '_cf-custom-domain.careers.example.io',
              value: 'retry-verified-value',
            },
          },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderDomains();
    await screen.findByText('Failed');

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText(/retry started/i)).toBeInTheDocument();
    expect(screen.getByText(/Add the DNS TXT record/)).toBeInTheDocument();
  });

  it('9. quota becomes available after a failed provisioning (0/1 used, add enabled)', async () => {
    domainRows = [FAILED_DOMAIN];
    vi.stubGlobal('fetch', fetchRouting({ '/api/billing/status': BILLING_OK }));
    renderDomains();

    // A failed row does not consume the slot: usage shows 0 / 1 and the add
    // form accepts a new hostname, so failure never dead-ends the quota.
    expect(await screen.findByText('0 / 1')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('careers.yourname.com') as HTMLInputElement;
    expect(input).toBeEnabled();
    fireEvent.change(input, { target: { value: 'retry-new.example.io' } });
    expect(screen.getByRole('button', { name: /add domain/i })).toBeEnabled();
  });

  it('11. mobile: long DNS values wrap via overflow-wrap:anywhere (390x844-safe mechanism)', async () => {
    domainRows = [
      {
        ...TXT_DOMAIN,
        provider_validation: {
          type: 'txt',
          name: '_cf-custom-domain.careers.very-long-hostname-subdomain.example.io',
          value:
            'cf-verify-8f14e45fceea167a5a36dedd4bea2543-cf-verify-8f14e45fceea167a5a36dedd4bea2543',
        },
      },
    ];
    const { container } = renderDomains();
    await screen.findByText('Add this DNS TXT record');

    // jsdom loads no Tailwind stylesheet, so assert the mobile-safety
    // MECHANISM in the markup: every rendered DNS value must carry the
    // `[overflow-wrap:anywhere]` utility (or a scrollable code region),
    // which prevents horizontal overflow at 390x844/360x800.
    const codes = container.querySelectorAll('code');
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      const wraps = code.className.includes('overflow-wrap:anywhere');
      expect(wraps).toBe(true);
    }
  });

  it('12. provider error copy is customer-safe (no raw provider internals)', async () => {
    domainRows = [
      {
        ...FAILED_DOMAIN,
        provider_error: 'Domain provider is temporarily unavailable. Please retry.',
      },
    ];
    renderDomains();

    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/cloudflare/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/CLOUDFLARE_/i)).not.toBeInTheDocument();
  });
});
