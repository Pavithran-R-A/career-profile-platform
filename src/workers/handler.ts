declare const __BUILD_COMMIT_SHA__: string;
import { createHmac } from 'node:crypto';
import { createServerClient } from '../lib/supabase/server';
import { readProAnnualPricePaise, buildPublicPlans, getPlan } from '../lib/billing/plans';
import {
  normalizeSubscriptionRow,
  resolveEntitlements,
  resolvePlan,
  freeSubscription,
} from '../lib/billing/entitlements';
import { checkUsage, windowKeyFor } from '../lib/billing/usage';
import { createRazorpayOrder, isRazorpayConfigured } from '../lib/billing/razorpay';
import { processRazorpayWebhook, makeVerifier } from '../lib/billing/webhooks';
import { validateAddDomain as _validateAddDomain } from '../lib/domains/custom';
void _validateAddDomain;
import { quoteDotCvDomain, isDotCvEnabled, isDotCvPurchaseEnabled } from '../lib/domains/dotcv';
import { parseDotCvInput, validateCustomDomain } from '../lib/domains/validators';
import {
  createCustomHostname,
  getCustomHostname,
  deleteCustomHostname,
  isCloudflareSaaSConfigured,
} from '../lib/domains/cloudflare';
import { resolveGitHubConfig, type GitHubModuleConfig } from '../lib/github/config';
import { AIExtractionError, BharatCodeProvider } from '../lib/ai/bharatcode';
import {
  buildProfileBrief,
  buildRecruiterMessages,
  nonEmptySections,
  parseCitations,
  validateRecruiterQuestion,
  type RecruiterProfileData,
} from '../lib/ai/recruiter';
import { normalizeUsername, validateUsername } from '../lib/validators/username';
import { isHttpUrl } from '../lib/validators/url';
import {
  validateAuthFreshness,
  newDeletionRequest,
  recordAttempt,
  responseForAuthDeleteFailure,
  DELETION_PARTIAL_MESSAGE,
  DELETION_FAILED_MESSAGE,
  type DeletionStage,
} from '../lib/account/deletion';
import { z } from 'zod';
import type { SubscriptionState } from '../lib/billing/entitlements';

export interface Env {
  ENVIRONMENT?: string;
  ALLOWED_ORIGINS?: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  BHARATCODE_API_KEY?: string;
  BHARATCODE_BASE_URL?: string;
  BHARATCODE_MODEL?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  PRO_ANNUAL_PRICE_PAISE?: string;
  CURRENCY?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_ZONE_ID?: string;
  PLATFORM_PROFILE_ORIGIN?: string;
  DOTCV_ENABLED?: string;
  DOTCV_PURCHASE_ENABLED?: string;
  DOTCV_API_BASE_URL?: string;
  DOTCV_API_KEY?: string;
  RATE_LIMIT_KEY_SECRET?: string;
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_APP_CLIENT_ID?: string;
  GITHUB_APP_CLIENT_SECRET?: string;
  GITHUB_STATE_SECRET?: string;
  GITHUB_APP_SLUG?: string;
  BILLING_ENABLED?: string;
  DOMAINS_ENABLED?: string;
  RECRUITER_AI_ENABLED?: string;
  RECRUITER_RATE_LIMITER?: {
    // Cloudflare rate-limiting binding contract: limit() takes { key } and
    // resolves to { success: boolean } (true = allowed).
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  };
}

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'INTERNAL'
  | 'SERVER_NOT_CONFIGURED'
  | 'FEATURE_DISABLED'
  | 'BILLING_NOT_CONFIGURED'
  | 'PRICE_NOT_CONFIGURED'
  | 'RESUME_NOT_FOUND'
  | 'INVALID_STORAGE_PATH'
  | 'DOWNLOAD_FAILED'
  | 'PDF_NO_TEXT'
  | 'PDF_TOO_MANY_PAGES'
  | 'PDF_TEXT_TOO_LONG'
  | 'PDF_MALFORMED'
  | 'AI_NOT_CONFIGURED'
  | 'AI_PROVIDER_ERROR'
  | 'AI_EMPTY_RESPONSE'
  | 'AI_INVALID_JSON'
  | 'AI_INVALID_RESPONSE'
  | 'EXTRACTION_FAILED'
  | 'RATE_LIMITED'
  | 'TOO_MANY_REQUESTS'
  | 'PROFILE_NOT_FOUND'
  | 'NOT_PRO'
  | 'PERIOD_END_MISSING'
  | 'ALREADY_DONE'
  | 'CONFLICT'
  | 'REAUTH_REQUIRED'
  | 'DELETE_FAILED'
  | 'DELETE_PARTIAL';

type EnvStringKey = Exclude<keyof Env, 'RECRUITER_RATE_LIMITER'>;

function getEnvValue(env: Env, key: EnvStringKey): string {
  return env[key] || '';
}

function getAdminKey(env: Env): string {
  return getEnvValue(env, 'SUPABASE_SECRET_KEY') || getEnvValue(env, 'SUPABASE_SERVICE_ROLE_KEY');
}

/**
 * Safe feature flags: EXPLICIT OPT-IN. A missing flag is DISABLED in every
 * environment, so "missing credentials + missing flag" is always a truthful
 * disabled state. Set BILLING_ENABLED=true / DOMAINS_ENABLED=true /
 * RECRUITER_AI_ENABLED=true deliberately to turn a feature on.
 */
function featureEnabled(
  env: Env,
  flag: 'BILLING_ENABLED' | 'DOMAINS_ENABLED' | 'RECRUITER_AI_ENABLED'
): boolean {
  const raw = getEnvValue(env, flag).toLowerCase();
  return raw === 'true' || raw === '1';
}

/**
 * Privacy-preserving recruiter rate-limit key: HMAC(secret, username|ip|
 * rotatingMinute). The binding only ever sees the digest — raw IPs are not
 * stored or logged. Without RATE_LIMIT_KEY_SECRET the documented fallback
 * keeps PROFILE identity in the key (no IP), trading NAT granularity for
 * privacy instead of keying on shared IPs alone.
 */
function recruiterRateLimitKey(username: string, ip: string, secret: string): string {
  const period = Math.floor(Date.now() / 60_000); // rotating 1-minute period
  if (!secret) return `profile:${username}:p${period}`;
  const digest = createHmac('sha256', secret)
    .update(`${username}|${ip}|${period}`)
    .digest('hex')
    .slice(0, 32);
  return `h1:${digest}`;
}

// ─── CORS ───────────────────────────────────────────────────────

function isOriginAllowed(origin: string | null, env: Env): boolean {
  if (!origin) return true;
  const environment = getEnvValue(env, 'ENVIRONMENT').toLowerCase();
  const isDev = environment === 'development' || environment === 'local';

  if (isDev) {
    try {
      const url = new URL(origin);
      const hostname = url.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
        return true;
      }
    } catch {
      return false;
    }
  }

  const allowedRaw = getEnvValue(env, 'ALLOWED_ORIGINS');
  if (!allowedRaw) return false;
  const allowed = allowedRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

function securityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const headers: Record<string, string> = {
    ...securityHeaders(),
    Vary: 'Origin',
  };

  if (origin && isOriginAllowed(origin, env)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] =
      'Content-Type, Authorization, x-razorpay-signature, x-razorpay-event-id';
  }

  return headers;
}

interface JsonExtras {
  code?: ApiErrorCode;
  requestId?: string;
  headers?: Record<string, string>;
}

function json(
  data: unknown,
  status = 200,
  origin?: string | null,
  env?: Env,
  extras?: JsonExtras
): Response {
  const body =
    extras && (extras.code || extras.requestId)
      ? {
          ...(typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}),
          ...(extras.code ? { code: extras.code } : {}),
          ...(extras.requestId ? { requestId: extras.requestId } : {}),
        }
      : data;
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin ?? null, env ?? ({} as Env)),
      ...(extras?.headers ?? {}),
    },
  });
}

// ─── Auth ───────────────────────────────────────────────────────

async function verifyAuth(
  request: Request,
  env: Env
): Promise<{ userId: string; token: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  // VITE_ variants are the same public values under the names this
  // deployment actually provides.
  const supabaseUrl = getEnvValue(env, 'SUPABASE_URL') || getEnvValue(env, 'VITE_SUPABASE_URL');
  const publishableKey =
    getEnvValue(env, 'SUPABASE_PUBLISHABLE_KEY') ||
    getEnvValue(env, 'VITE_SUPABASE_PUBLISHABLE_KEY');

  if (!supabaseUrl || !publishableKey) {
    return null;
  }

  // Fail closed: any auth-server error (non-2xx or network failure) denies
  // the request rather than throwing a 500 with half-verified state.
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: publishableKey,
      },
    });

    if (!response.ok) {
      return null;
    }

    const user = (await response.json()) as { id: string };
    return { userId: user.id, token };
  } catch {
    return null;
  }
}

// ─── GitHub integration (server-side wiring) ──────────────────

/**
 * Immutable per-request GitHub config. Never mutates process.env: one
 * request's environment cannot change another request's configuration.
 */
function ghConfig(env: Env): GitHubModuleConfig {
  return resolveGitHubConfig(env as unknown as Record<string, string>);
}

async function handleGitHubInstallStart(
  request: Request,
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  const auth = await verifyAuth(request, env);
  if (!auth)
    return json({ error: 'Unauthorized' }, 401, origin, env, { code: 'UNAUTHORIZED', requestId });

  {
    const { githubInstallInfo, createSignedState } = await import('../lib/github/server');
    const config = ghConfig(env);
    const info = githubInstallInfo(config);
    if (!info.configured || !info.installUrl) {
      return json({ error: 'GitHub integration is not configured' }, 503, origin, env, {
        code: 'SERVER_NOT_CONFIGURED',
        requestId,
      });
    }
    const state = createSignedState(auth.userId, config);
    return json({ installUrl: info.installUrl, state }, 200, origin, env, { requestId });
  }
}

async function handleGitHubCallback(
  request: Request,
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  const auth = await verifyAuth(request, env);
  if (!auth)
    return json({ error: 'Unauthorized' }, 401, origin, env, { code: 'UNAUTHORIZED', requestId });

  {
    const mod = await import('../lib/github/server');
    const config = ghConfig(env);
    // Flow A (OAuth during install): GitHub's callback carries code + state
    // ONLY. An installation_id is never read from the browser here — the
    // installation is resolved server-side from GET /user/installations.
    const body = (await request.json().catch(() => ({}))) as {
      code?: string;
      state?: string;
    };
    if (!body.state || typeof body.code !== 'string' || body.code.length === 0) {
      return json({ error: 'Missing authorization code or state' }, 400, origin, env, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }
    const stateCheck = mod.verifySignedState(body.state, config, auth.userId);
    if (!stateCheck.ok) {
      return json({ error: 'Invalid or expired installation state' }, 400, origin, env, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }

    // 1. Resolve the caller's single owned profile via the admin client —
    // ownership derived from the principal, never from the request body.
    const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
    const adminKey = getAdminKey(env);
    if (!supabaseUrl || !adminKey) {
      return json({ error: 'Server configuration error' }, 500, origin, env, {
        code: 'SERVER_NOT_CONFIGURED',
        requestId,
      });
    }
    const admin = createServerClient(supabaseUrl, adminKey);
    const { data: profileRows } = await admin
      .from('profiles' as never)
      .select('id')
      .eq('user_id', auth.userId as never);
    const owned = ((profileRows ?? []) as Array<{ id?: unknown }>)
      .map((r) => (typeof r.id === 'string' ? r.id : ''))
      .filter((x) => x.length > 0);
    if (owned.length === 0) {
      return json({ error: 'No profile found for this account' }, 404, origin, env, {
        code: 'PROFILE_NOT_FOUND',
        requestId,
      });
    }
    if (owned.length > 1) {
      return json({ error: 'Multiple profiles found; contact support' }, 409, origin, env, {
        code: 'CONFLICT',
        requestId,
      });
    }
    const profileId = owned[0];

    // 2. Exchange the code and resolve the installation from GitHub's OWN
    // listing of installations accessible to that GitHub App user. Nothing
    // is derived from browser input.
    const resolution = await mod.resolveInstallationForUser(body.code, config);
    switch (resolution.status) {
      case 'error':
        return json({ error: 'GitHub authorization failed' }, 502, origin, env, {
          code: 'BAD_REQUEST',
          requestId,
        });
      case 'no_eligible':
        return json(
          { error: 'No installation of this GitHub App is accessible to your GitHub account' },
          404,
          origin,
          env,
          { code: 'NOT_FOUND', requestId }
        );
      case 'multiple':
        // NEVER guess: hand back the eligible accounts and a signed
        // selection token per installation for the explicit choice round-trip.
        return json(
          {
            status: 'selection_required',
            installations: resolution.installations.map((inst) => ({
              installationId: inst.installationId,
              accountLogin: inst.accountLogin,
              accountType: inst.accountType,
              selectionToken: mod.createSelectionToken(inst.installationId, auth.userId, config),
            })),
          },
          200,
          origin,
          env,
          { requestId }
        );
    }

    // 3. Exactly one eligible installation (already App-JWT cross-verified):
    // persist it. DB is the source of truth.
    const verified = resolution.installation;
    const { error: upsertError } = await admin.from('github_connections' as never).upsert(
      {
        profile_id: profileId,
        installation_id: verified.installationId,
        github_account_id: verified.accountId,
        github_account_login: verified.accountLogin,
        github_account_type: verified.accountType,
        status: 'active',
      } as never,
      { onConflict: 'profile_id' }
    );
    if (upsertError) {
      return json({ error: 'Failed to save connection' }, 500, origin, env, {
        code: 'INTERNAL',
        requestId,
      });
    }

    return json(
      {
        connected: true,
        account: { login: verified.accountLogin, type: verified.accountType },
      },
      200,
      origin,
      env,
      { requestId }
    );
  }
}

/**
 * Explicit selection round-trip when the user's GitHub account can access
 * MORE than one installation of this app. The chosen installation id must
 * arrive inside a server-signed selection token (issued with the choice
 * list) bound to THIS user — a raw browser installation id is not accepted —
 * and the choice is STILL cross-verified with the App JWT (installation must
 * exist on this app and belong to the same GitHub account as the connected
 * user's other installations listing) before persisting.
 */
async function handleGitHubConnectChoose(
  request: Request,
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  const auth = await verifyAuth(request, env);
  if (!auth)
    return json({ error: 'Unauthorized' }, 401, origin, env, { code: 'UNAUTHORIZED', requestId });

  {
    const mod = await import('../lib/github/server');
    const config = ghConfig(env);
    const body = (await request.json().catch(() => ({}))) as {
      selectionToken?: string;
    };
    if (!body.selectionToken) {
      return json({ error: 'selectionToken is required' }, 400, origin, env, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }
    const selection = mod.verifySelectionToken(body.selectionToken, config, auth.userId);
    if (!selection.ok || selection.installationId === undefined) {
      return json({ error: 'Invalid or expired selection token' }, 400, origin, env, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }

    const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
    const adminKey = getAdminKey(env);
    if (!supabaseUrl || !adminKey) {
      return json({ error: 'Server configuration error' }, 500, origin, env, {
        code: 'SERVER_NOT_CONFIGURED',
        requestId,
      });
    }
    const admin = createServerClient(supabaseUrl, adminKey);
    const { data: profileRows } = await admin
      .from('profiles' as never)
      .select('id')
      .eq('user_id', auth.userId as never);
    const owned = ((profileRows ?? []) as Array<{ id?: unknown }>)
      .map((r) => (typeof r.id === 'string' ? r.id : ''))
      .filter((x) => x.length > 0);
    if (owned.length !== 1) {
      return json({ error: 'No profile found for this account' }, 404, origin, env, {
        code: 'PROFILE_NOT_FOUND',
        requestId,
      });
    }

    // Independent App-JWT credential check: the installation must exist on
    // THIS app (its account was already proven to belong to the user's
    // installation list when the signed selection token was issued; the JWT
    // check here re-proves the installation's existence on our app at
    // connect time, keeping the two-credential invariant).
    const verified = await mod.verifyInstallationOnApp(selection.installationId, config);
    if (!verified) {
      return json(
        { error: 'Selected installation is not accessible to your GitHub account' },
        403,
        origin,
        env,
        { code: 'FORBIDDEN', requestId }
      );
    }
    const installation = verified;

    const { error: upsertError } = await admin.from('github_connections' as never).upsert(
      {
        profile_id: owned[0],
        installation_id: installation.installationId,
        github_account_id: installation.accountId,
        github_account_login: installation.accountLogin,
        github_account_type: installation.accountType,
        status: 'active',
      } as never,
      { onConflict: 'profile_id' }
    );
    if (upsertError) {
      return json({ error: 'Failed to save connection' }, 500, origin, env, {
        code: 'INTERNAL',
        requestId,
      });
    }

    return json(
      {
        connected: true,
        account: { login: installation.accountLogin, type: installation.accountType },
      },
      200,
      origin,
      env,
      { requestId }
    );
  }
}

async function handleGitHubSync(
  request: Request,
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  const auth = await verifyAuth(request, env);
  if (!auth)
    return json({ error: 'Unauthorized' }, 401, origin, env, { code: 'UNAUTHORIZED', requestId });

  {
    const { syncConnectionRepositories } = await import('../lib/github/server');
    const config = ghConfig(env);
    const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
    const adminKey = getAdminKey(env);
    if (!supabaseUrl || !adminKey) {
      return json({ error: 'Server configuration error' }, 500, origin, env, {
        code: 'SERVER_NOT_CONFIGURED',
        requestId,
      });
    }
    const admin = createServerClient(supabaseUrl, adminKey);

    // Resolve the caller's single owned profile, then its connection —
    // ownership derived from the authenticated principal only.
    const { data: profileRows } = await admin
      .from('profiles' as never)
      .select('id')
      .eq('user_id', auth.userId as never);
    const owned = ((profileRows ?? []) as Array<{ id?: unknown }>)
      .map((r) => (typeof r.id === 'string' ? r.id : ''))
      .filter((x) => x.length > 0);
    if (owned.length !== 1) {
      return json({ error: 'No profile found for this account' }, 404, origin, env, {
        code: 'PROFILE_NOT_FOUND',
        requestId,
      });
    }
    const { data: connRows } = await admin
      .from('github_connections' as never)
      .select('id, installation_id')
      .eq('profile_id', owned[0] as never)
      .limit(1);
    const connection = ((connRows ?? []) as Array<{ id: string; installation_id: number }>)[0];
    if (!connection) {
      return json({ error: 'GitHub is not connected' }, 404, origin, env, {
        code: 'NOT_FOUND',
        requestId,
      });
    }

    const outcome = await syncConnectionRepositories({
      connectionId: connection.id,
      installationId: Number(connection.installation_id),
      config,
      supabase: admin as never,
    });
    if (!outcome.ok) {
      return json({ error: 'GitHub sync failed' }, 502, origin, env, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }
    return json(outcome, 200, origin, env, { requestId });
  }
}

/**
 * REAL evidence generation for the caller's SELECTED repositories: bounded
 * commits/PRs/issues/releases → production extraction → profile_evidence
 * with is_public=false. The dashboard's "Generate evidence" button calls
 * this; nothing is published automatically.
 */
async function handleGitHubEvidenceGenerate(
  request: Request,
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  const auth = await verifyAuth(request, env);
  if (!auth)
    return json({ error: 'Unauthorized' }, 401, origin, env, { code: 'UNAUTHORIZED', requestId });

  {
    const { generateEvidenceForSelected } = await import('../lib/github/server');
    const config = ghConfig(env);
    const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
    const adminKey = getAdminKey(env);
    if (!supabaseUrl || !adminKey) {
      return json({ error: 'Server configuration error' }, 500, origin, env, {
        code: 'SERVER_NOT_CONFIGURED',
        requestId,
      });
    }
    const admin = createServerClient(supabaseUrl, adminKey);

    const { data: profileRows } = await admin
      .from('profiles' as never)
      .select('id')
      .eq('user_id', auth.userId as never);
    const owned = ((profileRows ?? []) as Array<{ id?: unknown }>)
      .map((r) => (typeof r.id === 'string' ? r.id : ''))
      .filter((x) => x.length > 0);
    if (owned.length !== 1) {
      return json({ error: 'No profile found for this account' }, 404, origin, env, {
        code: 'PROFILE_NOT_FOUND',
        requestId,
      });
    }
    const { data: connRows } = await admin
      .from('github_connections' as never)
      .select('id, installation_id')
      .eq('profile_id', owned[0] as never)
      .limit(1);
    const connection = ((connRows ?? []) as Array<{ id: string; installation_id: number }>)[0];
    if (!connection) {
      return json({ error: 'GitHub is not connected' }, 404, origin, env, {
        code: 'NOT_FOUND',
        requestId,
      });
    }

    const outcome = await generateEvidenceForSelected({
      profileId: owned[0],
      connectionId: connection.id,
      installationId: Number(connection.installation_id),
      config,
      supabase: admin as never,
    });
    if (!outcome.ok) {
      return json({ error: 'Evidence generation failed' }, 502, origin, env, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }
    return json(outcome, 200, origin, env, { requestId });
  }
}

/**
 * Owner-only evidence publish toggle at the SERVER boundary. A private
 * repository's evidence can NEVER be published; public evidence requires
 * repository.show_publicly = true. (The published_evidence view enforces
 * the same rules independently — defense in depth.)
 */
async function handleEvidencePublicToggle(
  request: Request,
  evidenceId: string,
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  const auth = await verifyAuth(request, env);
  if (!auth)
    return json({ error: 'Unauthorized' }, 401, origin, env, { code: 'UNAUTHORIZED', requestId });

  {
    const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
    const adminKey = getAdminKey(env);
    if (!supabaseUrl || !adminKey) {
      return json({ error: 'Server configuration error' }, 500, origin, env, {
        code: 'SERVER_NOT_CONFIGURED',
        requestId,
      });
    }
    const admin = createServerClient(supabaseUrl, adminKey);

    const body = (await request.json().catch(() => ({}))) as { value?: boolean };
    if (typeof body.value !== 'boolean') {
      return json({ error: 'value (boolean) is required' }, 400, origin, env, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }

    // Ownership chain: caller → profile → evidence row.
    const { data: profileRows } = await admin
      .from('profiles' as never)
      .select('id')
      .eq('user_id', auth.userId as never);
    const owned = ((profileRows ?? []) as Array<{ id?: unknown }>)
      .map((r) => (typeof r.id === 'string' ? r.id : ''))
      .filter((x) => x.length > 0);
    if (owned.length !== 1) {
      return json({ error: 'No profile found for this account' }, 404, origin, env, {
        code: 'PROFILE_NOT_FOUND',
        requestId,
      });
    }

    const { data: evidenceRows } = await admin
      .from('profile_evidence' as never)
      .select('id, profile_id, github_repository_id')
      .eq('id', evidenceId as never)
      .limit(1);
    const evidence = (
      (evidenceRows ?? []) as Array<{
        id: string;
        profile_id: string;
        github_repository_id: string | null;
      }>
    )[0];
    if (!evidence) {
      return json({ error: 'Evidence not found' }, 404, origin, env, {
        code: 'NOT_FOUND',
        requestId,
      });
    }
    if (evidence.profile_id !== owned[0]) {
      return json({ error: 'Forbidden' }, 403, origin, env, { code: 'FORBIDDEN', requestId });
    }

    if (body.value) {
      if (!evidence.github_repository_id) {
        return json(
          { error: 'Only repository-backed evidence can be published' },
          400,
          origin,
          env,
          { code: 'BAD_REQUEST', requestId }
        );
      }
      const { data: repoRows } = await admin
        .from('github_repositories' as never)
        .select('id, is_private, show_publicly')
        .eq('id', evidence.github_repository_id as never)
        .limit(1);
      const repo = (
        (repoRows ?? []) as Array<{ id: string; is_private: boolean; show_publicly: boolean }>
      )[0];
      if (!repo) {
        return json({ error: 'Repository not found' }, 404, origin, env, {
          code: 'NOT_FOUND',
          requestId,
        });
      }
      if (repo.is_private) {
        return json(
          { error: 'Private repositories can never be shown publicly' },
          403,
          origin,
          env,
          { code: 'FORBIDDEN', requestId }
        );
      }
      if (!repo.show_publicly) {
        return json({ error: 'Enable "show publicly" on the repository first' }, 403, origin, env, {
          code: 'FORBIDDEN',
          requestId,
        });
      }
    }

    const { error } = await admin
      .from('profile_evidence' as never)
      .update({ is_public: body.value } as never)
      .eq('id', evidence.id as never);
    if (error) {
      return json({ error: 'Failed to update evidence' }, 500, origin, env, {
        code: 'INTERNAL',
        requestId,
      });
    }
    return json({ ok: true, is_public: body.value }, 200, origin, env, { requestId });
  }
}

async function handleGitHubDisconnect(
  request: Request,
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  const auth = await verifyAuth(request, env);
  if (!auth)
    return json({ error: 'Unauthorized' }, 401, origin, env, { code: 'UNAUTHORIZED', requestId });

  {
    const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
    const adminKey = getAdminKey(env);
    if (!supabaseUrl || !adminKey) {
      return json({ error: 'Server configuration error' }, 500, origin, env, {
        code: 'SERVER_NOT_CONFIGURED',
        requestId,
      });
    }
    const admin = createServerClient(supabaseUrl, adminKey);

    const { data: profileRows } = await admin
      .from('profiles' as never)
      .select('id')
      .eq('user_id', auth.userId as never);
    const owned = ((profileRows ?? []) as Array<{ id?: unknown }>)
      .map((r) => (typeof r.id === 'string' ? r.id : ''))
      .filter((x) => x.length > 0);
    if (owned.length !== 1) {
      return json({ error: 'No profile found for this account' }, 404, origin, env, {
        code: 'PROFILE_NOT_FOUND',
        requestId,
      });
    }

    // Cascades github_repositories; profile_evidence rows keep via set null.
    const { error } = await admin
      .from('github_connections' as never)
      .delete()
      .eq('profile_id', owned[0] as never);
    if (error) {
      return json({ error: 'Failed to disconnect GitHub' }, 500, origin, env, {
        code: 'INTERNAL',
        requestId,
      });
    }
    return json({ disconnected: true }, 200, origin, env, { requestId });
  }
}

async function handleGitHubRepoAction(
  request: Request,
  repoId: string,
  action: 'select' | 'public',
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  const auth = await verifyAuth(request, env);
  if (!auth)
    return json({ error: 'Unauthorized' }, 401, origin, env, { code: 'UNAUTHORIZED', requestId });

  {
    const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
    const adminKey = getAdminKey(env);
    if (!supabaseUrl || !adminKey) {
      return json({ error: 'Server configuration error' }, 500, origin, env, {
        code: 'SERVER_NOT_CONFIGURED',
        requestId,
      });
    }
    const admin = createServerClient(supabaseUrl, adminKey);

    // Ownership chain: caller → profile → connection → repository row.
    const { data: profileRows } = await admin
      .from('profiles' as never)
      .select('id')
      .eq('user_id', auth.userId as never);
    const owned = ((profileRows ?? []) as Array<{ id?: unknown }>)
      .map((r) => (typeof r.id === 'string' ? r.id : ''))
      .filter((x) => x.length > 0);
    if (owned.length !== 1) {
      return json({ error: 'No profile found for this account' }, 404, origin, env, {
        code: 'PROFILE_NOT_FOUND',
        requestId,
      });
    }
    const { data: connRows } = await admin
      .from('github_connections' as never)
      .select('id')
      .eq('profile_id', owned[0] as never)
      .limit(1);
    const connection = ((connRows ?? []) as Array<{ id: string }>)[0];
    if (!connection) {
      return json({ error: 'GitHub is not connected' }, 404, origin, env, {
        code: 'NOT_FOUND',
        requestId,
      });
    }

    const { data: repoRows } = await admin
      .from('github_repositories' as never)
      .select('id, is_private, selected_for_evidence, show_publicly')
      .eq('connection_id', connection.id as never)
      .eq('github_repo_id', Number(repoId) as never)
      .limit(1);
    const repo = (
      (repoRows ?? []) as Array<{
        id: string;
        is_private: boolean;
        selected_for_evidence: boolean;
        show_publicly: boolean;
      }>
    )[0];
    if (!repo) {
      return json({ error: 'Repository not found' }, 404, origin, env, {
        code: 'NOT_FOUND',
        requestId,
      });
    }

    const body = (await request.json().catch(() => ({}))) as { value?: boolean };
    if (typeof body.value !== 'boolean') {
      return json({ error: 'value (boolean) is required' }, 400, origin, env, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }

    if (action === 'select') {
      const subscription = await getSubscription(env, auth.userId);
      const entitlements = resolveEntitlements(subscription);

      // ATOMIC quota + mutate: the RPC serializes concurrent selections with
      // an advisory lock, then counts → validates → updates in one
      // transaction, so two simultaneous creates cannot both pass the count.
      // Unselecting always succeeds inside the same RPC.
      const { data: rpcResult, error: rpcError } = await admin.rpc(
        'select_github_repository' as never,
        {
          p_connection_id: connection.id,
          p_repo_id: repo.id,
          p_limit: entitlements.githubRepos,
        } as never
      );
      if (rpcError) {
        return json({ error: 'Failed to update repository' }, 500, origin, env, {
          code: 'INTERNAL',
          requestId,
        });
      }
      if (rpcResult === null || rpcResult === undefined) {
        return json(
          { error: `Plan limit: at most ${entitlements.githubRepos} selected repositories` },
          429,
          origin,
          env,
          { code: 'RATE_LIMITED', requestId }
        );
      }
      return json({ ok: true }, 200, origin, env, { requestId });
    }

    // action === 'public': a private repo can NEVER be public evidence.
    if (body.value && repo.is_private) {
      return json({ error: 'Private repositories cannot be shown publicly' }, 403, origin, env, {
        code: 'FORBIDDEN',
        requestId,
      });
    }
    const { error: updateError } = await admin
      .from('github_repositories' as never)
      .update({ show_publicly: body.value } as never)
      .eq('id', repo.id as never);
    if (updateError) {
      return json({ error: 'Failed to update repository' }, 500, origin, env, {
        code: 'INTERNAL',
        requestId,
      });
    }
    return json({ ok: true }, 200, origin, env, { requestId });
  }
}

async function handleGitHubInstallInfo(
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  {
    const { githubInstallInfo } = await import('../lib/github/server');
    const info = githubInstallInfo(ghConfig(env));
    return json(info, 200, origin, env, { requestId });
  }
}

// ─── Storage authorization ──────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidStoragePath(path: string): boolean {
  if (!path || path.length > 512) return false;
  if (path.includes('..') || path.includes('\\') || path.includes('\0')) return false;
  if (path.startsWith('/') || path.includes('//')) return false;
  if (path.includes('\r') || path.includes('\n') || path.includes('\t')) return false;
  const segments = path.split('/');
  if (segments.length !== 2) return false;
  const [userId, filename] = segments;
  if (!UUID_RE.test(userId)) return false;
  if (!filename.endsWith('.pdf')) return false;
  if (filename.length > 128) return false;
  return true;
}

// ─── Resume Extract ─────────────────────────────────────────────

const MAX_AI_INPUT_CHARS = 40000;

function aiErrorToResponse(
  err: unknown,
  origin: string | null,
  env: Env,
  requestId: string
): Response {
  if (err instanceof AIExtractionError) {
    const status = err.code === 'AI_NOT_CONFIGURED' ? 503 : 502;
    return json({ error: err.message }, status, origin, env, {
      code: err.code,
      requestId,
    });
  }
  return json({ error: 'Extraction failed' }, 500, origin, env, {
    code: 'EXTRACTION_FAILED',
    requestId,
  });
}

async function handleResumeExtract(
  request: Request,
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  const auth = await verifyAuth(request, env);
  if (!auth) {
    return json({ error: 'Unauthorized' }, 401, origin, env, {
      code: 'UNAUTHORIZED',
      requestId,
    });
  }

  try {
    const body = (await request.json()) as { resumeSourceId?: string };
    const { resumeSourceId } = body;

    if (!resumeSourceId) {
      return json({ error: 'resumeSourceId is required' }, 400, origin, env, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }

    const supabaseUrl = getEnvValue(env, 'SUPABASE_URL') || getEnvValue(env, 'VITE_SUPABASE_URL');
    const publishableKey =
      getEnvValue(env, 'SUPABASE_PUBLISHABLE_KEY') ||
      getEnvValue(env, 'VITE_SUPABASE_PUBLISHABLE_KEY');

    if (!supabaseUrl || !publishableKey) {
      return json({ error: 'Server configuration error' }, 500, origin, env, {
        code: 'SERVER_NOT_CONFIGURED',
        requestId,
      });
    }

    // User-scoped client: RLS already restricts rows and storage to the
    // owner, so no service key is required for this endpoint.
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${auth.token}` } },
    });

    const { data: sourceRow, error: sourceError } = await supabase
      .from('resume_sources' as never)
      .select('id, storage_path, profile_id')
      .eq('id', resumeSourceId as never)
      .maybeSingle();

    if (sourceError || !sourceRow) {
      return json({ error: 'Resume source not found' }, 404, origin, env, {
        code: 'RESUME_NOT_FOUND',
        requestId,
      });
    }

    const sourceRecord = sourceRow as { storage_path: string; profile_id: string };

    const { data: profileRow } = await supabase
      .from('profiles' as never)
      .select('user_id')
      .eq('id', sourceRecord.profile_id as never)
      .maybeSingle();

    const profileOwner = (profileRow as { user_id?: string } | null)?.user_id;
    if (!profileOwner || profileOwner !== auth.userId) {
      return json({ error: 'Forbidden' }, 403, origin, env, {
        code: 'FORBIDDEN',
        requestId,
      });
    }

    const storagePath = sourceRecord.storage_path;
    if (!isValidStoragePath(storagePath)) {
      return json({ error: 'Invalid storage path' }, 400, origin, env, {
        code: 'INVALID_STORAGE_PATH',
        requestId,
      });
    }

    if (!storagePath.startsWith(`${auth.userId}/`)) {
      return json({ error: 'Forbidden' }, 403, origin, env, {
        code: 'FORBIDDEN',
        requestId,
      });
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('resumes')
      .download(storagePath);

    if (downloadError || !fileData) {
      return json({ error: 'Failed to download resume' }, 500, origin, env, {
        code: 'DOWNLOAD_FAILED',
        requestId,
      });
    }

    const buffer = await fileData.arrayBuffer();

    // Same trusted extraction boundary as browser upload: unpdf decompresses
    // real PDF content streams (magic bytes, 6 MiB / 20 pages / max-chars
    // bounds and safe errors are enforced inside).
    let extractedText: string;
    try {
      const { extractTextFromPDF } = await import('../lib/resume/pdf');
      const { text } = await extractTextFromPDF(buffer);
      extractedText = text;
    } catch (err) {
      if (err instanceof Error && err.name === 'PDFExtractionError') {
        const kind = (err as { kind?: string }).kind;
        const status = kind === 'too_many_pages' ? 413 : 422;
        const code =
          kind === 'too_many_pages'
            ? 'PDF_TOO_MANY_PAGES'
            : kind === 'no_text'
              ? 'PDF_NO_TEXT'
              : kind === 'too_long'
                ? 'PDF_TEXT_TOO_LONG'
                : 'PDF_MALFORMED';
        return json({ error: err.message }, status, origin, env, { code, requestId });
      }
      throw err;
    }

    const provider = new BharatCodeProvider({
      apiKey: getEnvValue(env, 'BHARATCODE_API_KEY'),
      baseUrl: getEnvValue(env, 'BHARATCODE_BASE_URL') || 'https://bharatcode.ai/api/model/v1',
      model: getEnvValue(env, 'BHARATCODE_MODEL') || 'deepseek-v4.1-flash',
    });

    if (!provider.isConfigured()) {
      return json({ error: 'AI extraction is not configured' }, 503, origin, env, {
        code: 'AI_NOT_CONFIGURED',
        requestId,
      });
    }

    const extraction = await provider.extractProfile({
      resumeText: extractedText.slice(0, MAX_AI_INPUT_CHARS),
    });

    return json(extraction, 200, origin, env, { requestId });
  } catch (err) {
    if (err instanceof AIExtractionError) {
      return aiErrorToResponse(err, origin, env, requestId);
    }
    console.error(JSON.stringify({ t: 'extract_error', id: requestId, code: 'EXTRACTION_FAILED' }));
    return json({ error: 'Extraction failed' }, 500, origin, env, {
      code: 'EXTRACTION_FAILED',
      requestId,
    });
  }
}

// ─── Resume variant persistence (server-owned; quota enforced) ──

async function handleCreateVariant(
  request: Request,
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  const auth = await verifyAuth(request, env);
  if (!auth)
    return json({ error: 'Unauthorized' }, 401, origin, env, { code: 'UNAUTHORIZED', requestId });

  try {
    const body = (await request.json()) as {
      name?: string;
      targetRole?: string | null;
      targetCompany?: string | null;
      jobRequirements?: unknown;
      variantData?: unknown;
    };
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      return json({ error: 'name is required' }, 400, origin, env, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }
    if (!Array.isArray(body.jobRequirements)) {
      return json({ error: 'jobRequirements must be an array' }, 400, origin, env, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }

    const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
    const adminKey = getAdminKey(env);
    if (!supabaseUrl || !adminKey) {
      return json({ error: 'Server configuration error' }, 500, origin, env, {
        code: 'SERVER_NOT_CONFIGURED',
        requestId,
      });
    }
    const admin = createServerClient(supabaseUrl, adminKey);

    // Ownership from the principal; plan decides the variant limit.
    const { data: profileRows } = await admin
      .from('profiles' as never)
      .select('id')
      .eq('user_id', auth.userId as never);
    const owned = ((profileRows ?? []) as Array<{ id?: unknown }>)
      .map((r) => (typeof r.id === 'string' ? r.id : ''))
      .filter((x) => x.length > 0);
    if (owned.length !== 1) {
      return json({ error: 'No profile found for this account' }, 404, origin, env, {
        code: 'PROFILE_NOT_FOUND',
        requestId,
      });
    }

    const subscription = await getSubscription(env, auth.userId);
    const entitlements = resolveEntitlements(subscription);

    const { data: newId, error } = await admin.rpc(
      'create_profile_variant' as never,
      {
        p_profile_id: owned[0],
        p_name: body.name.trim().slice(0, 200),
        p_target_role: body.targetRole ?? null,
        p_target_company: body.targetCompany ?? null,
        p_job_requirements: body.jobRequirements,
        p_variant_data:
          body.variantData && typeof body.variantData === 'object' ? body.variantData : {},
        p_limit: entitlements.resumeVariants,
      } as never
    );

    if (error) {
      console.error(JSON.stringify({ t: 'variant_rpc_error', id: requestId }));
      return json({ error: 'Failed to save variant' }, 500, origin, env, {
        code: 'INTERNAL',
        requestId,
      });
    }
    if (newId === null || newId === undefined) {
      // RPC returns NULL when the plan limit is reached.
      return json(
        { error: `Plan limit: at most ${entitlements.resumeVariants} saved resume variants` },
        429,
        origin,
        env,
        { code: 'RATE_LIMITED', requestId }
      );
    }
    return json({ id: newId }, 200, origin, env, { requestId });
  } catch {
    console.error(JSON.stringify({ t: 'variant_error', id: requestId, code: 'INTERNAL' }));
    return json({ error: 'Failed to save variant' }, 500, origin, env, {
      code: 'INTERNAL',
      requestId,
    });
  }
}

// ─── Recruiter AI (public, strictly profile-grounded) ──────────

const RECRUITER_ASK_SCHEMA = z.object({
  username: z.string().min(2).max(63),
  question: z.string().trim().min(1).max(400),
});

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

function toRecruiterProfileData(row: Record<string, unknown>): RecruiterProfileData {
  return {
    display_name: typeof row.display_name === 'string' ? row.display_name : null,
    headline: typeof row.headline === 'string' ? row.headline : null,
    about: typeof row.about === 'string' ? row.about : null,
    location: typeof row.location === 'string' ? row.location : null,
    experiences: asRecordArray(row.experiences)
      .map((e) => ({
        company: typeof e.company === 'string' ? e.company : '',
        role: typeof e.role === 'string' ? e.role : null,
        location: typeof e.location === 'string' ? e.location : null,
        start_year: typeof e.start_year === 'number' ? e.start_year : null,
        end_year: typeof e.end_year === 'number' ? e.end_year : null,
        is_current: typeof e.is_current === 'boolean' ? e.is_current : null,
        description: typeof e.description === 'string' ? e.description : null,
      }))
      .filter((e) => e.company.length > 0),
    education: asRecordArray(row.education)
      .map((e) => ({
        institution: typeof e.institution === 'string' ? e.institution : '',
        degree: typeof e.degree === 'string' ? e.degree : null,
        field_of_study: typeof e.field_of_study === 'string' ? e.field_of_study : null,
        start_year: typeof e.start_year === 'number' ? e.start_year : null,
        end_year: typeof e.end_year === 'number' ? e.end_year : null,
      }))
      .filter((e) => e.institution.length > 0),
    skills: asRecordArray(row.skills)
      .map((s) => ({
        name: typeof s.name === 'string' ? s.name : '',
        category: typeof s.category === 'string' ? s.category : null,
      }))
      .filter((s) => s.name.length > 0),
    projects: asRecordArray(row.projects)
      .map((p) => ({
        name: typeof p.name === 'string' ? p.name : '',
        description: typeof p.description === 'string' ? p.description : null,
        project_url: typeof p.project_url === 'string' ? p.project_url : null,
        repository_url: typeof p.repository_url === 'string' ? p.repository_url : null,
      }))
      .filter((p) => p.name.length > 0),
    links: asRecordArray(row.links)
      .map((l) => ({
        label: typeof l.label === 'string' && l.label.length > 0 ? l.label : 'Link',
        url: typeof l.url === 'string' ? l.url : '',
      }))
      .filter((l) => isHttpUrl(l.url)),
    evidence: asRecordArray(row.evidence).map((ev) => ({
      evidence_type: typeof ev.evidence_type === 'string' ? ev.evidence_type : 'record',
      subject: typeof ev.subject === 'string' ? ev.subject : null,
      summary: typeof ev.summary === 'string' ? ev.summary : null,
      source_url:
        typeof ev.source_url === 'string' && isHttpUrl(ev.source_url) ? ev.source_url : null,
      repository_full_name:
        typeof ev.repository_full_name === 'string' ? ev.repository_full_name : null,
      repository_url:
        typeof ev.repository_url === 'string' && isHttpUrl(ev.repository_url)
          ? ev.repository_url
          : null,
      repository_language:
        typeof ev.repository_language === 'string' ? ev.repository_language : null,
    })),
  };
}

async function handlePublicProfile(
  usernameInput: string,
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  const username = normalizeUsername(usernameInput);
  const usernameCheck = validateUsername(username);
  if (!usernameCheck.valid) {
    return json({ error: 'Profile not found' }, 404, origin, env, {
      code: 'PROFILE_NOT_FOUND',
      requestId,
    });
  }

  const supabaseUrl = getEnvValue(env, 'SUPABASE_URL') || getEnvValue(env, 'VITE_SUPABASE_URL');
  const adminKey = getAdminKey(env);
  if (!supabaseUrl || !adminKey) {
    return json({ error: 'Public profiles are not configured' }, 503, origin, env, {
      code: 'SERVER_NOT_CONFIGURED',
      requestId,
    });
  }

  const admin = createServerClient(supabaseUrl, adminKey);
  const { data, error } = await admin
    .from('public_profiles' as never)
    .select('*')
    .eq('username', username as never)
    .maybeSingle();

  if (error || !data) {
    return json({ error: 'Profile not found' }, 404, origin, env, {
      code: 'PROFILE_NOT_FOUND',
      requestId,
    });
  }

  return json(data, 200, origin, env, {
    requestId,
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
  });
}

async function handleRecruiterAsk(
  request: Request,
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, origin, env, {
      code: 'BAD_REQUEST',
      requestId,
    });
  }

  const parsed = RECRUITER_ASK_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: 'Provide a username and a question (max 400 characters).' },
      422,
      origin,
      env,
      { code: 'BAD_REQUEST', requestId }
    );
  }

  const username = normalizeUsername(parsed.data.username);
  const usernameCheck = validateUsername(username);
  if (!usernameCheck.valid) {
    return json({ error: usernameCheck.error ?? 'Invalid username' }, 422, origin, env, {
      code: 'BAD_REQUEST',
      requestId,
    });
  }

  const question = validateRecruiterQuestion(parsed.data.question);
  if (!question.ok) {
    return json({ error: 'Question must be 1-400 characters.' }, 422, origin, env, {
      code: 'BAD_REQUEST',
      requestId,
    });
  } // Anti-abuse IP limiter: pre-auth 429s carry their own error code —
  // 'RATE_LIMITED' is reserved for the profile owner's plan quota (post-auth,
  // owner-facing), so callers can tell the two apart. E2E relies on this:
  // a fresh run must never see a limiter trip.
  //
  // Binding contract: limit({ key }) resolves to { success: true } when the
  // call is allowed. (The earlier sync non-awaited `allowed` check was
  // inverted-broken and 429'd EVERY request wherever the binding existed —
  // caught by the e2e exact-404 contract.)
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (env.RECRUITER_RATE_LIMITER) {
    try {
      const rate = await env.RECRUITER_RATE_LIMITER.limit({
        key: recruiterRateLimitKey(username, ip, getEnvValue(env, 'RATE_LIMIT_KEY_SECRET')),
      });
      if (!rate.success) {
        return json({ error: 'Too many questions. Please try again later.' }, 429, origin, env, {
          code: 'TOO_MANY_REQUESTS',
          requestId,
          headers: { 'Retry-After': '60' },
        });
      }
    } catch {
      // Limiter errors must not take the recruiter feature down.
    }
  }

  const supabaseUrl = getEnvValue(env, 'SUPABASE_URL') || getEnvValue(env, 'VITE_SUPABASE_URL');
  const adminKey = getAdminKey(env);
  if (!supabaseUrl || !adminKey) {
    return json({ error: 'Recruiter AI is not configured' }, 503, origin, env, {
      code: 'SERVER_NOT_CONFIGURED',
      requestId,
    });
  }

  // Public projection views are server-only. The privileged credential never
  // leaves the Worker; the view itself still enforces published-only fields.
  const adminClient = createServerClient(supabaseUrl, adminKey);
  const { data: row } = await adminClient
    .from('public_profiles' as never)
    .select('*')
    .eq('username', username as never)
    .maybeSingle();

  if (!row) {
    return json({ error: 'No published profile found for that username' }, 404, origin, env, {
      code: 'PROFILE_NOT_FOUND',
      requestId,
    });
  }

  const profile = toRecruiterProfileData(row as Record<string, unknown>);
  const brief = buildProfileBrief(profile);

  const provider = new BharatCodeProvider({
    apiKey: getEnvValue(env, 'BHARATCODE_API_KEY'),
    baseUrl: getEnvValue(env, 'BHARATCODE_BASE_URL') || 'https://bharatcode.ai/api/model/v1',
    model: getEnvValue(env, 'BHARATCODE_MODEL') || 'deepseek-v4.1-flash',
  });
  if (!provider.isConfigured()) {
    return json({ error: 'Recruiter AI is not configured' }, 503, origin, env, {
      code: 'AI_NOT_CONFIGURED',
      requestId,
    });
  }

  // Subscription quota (distinct from the anti-abuse rate limiter above):
  // the PROFILE OWNER's plan decides the daily AI budget, consumed
  // atomically in the DB so concurrent requests cannot exceed the limit.
  const { data: ownerRow } = await adminClient
    .from('profiles' as never)
    .select('user_id')
    .eq('username', username as never)
    .maybeSingle();
  const ownerId = (ownerRow as { user_id?: string } | null)?.user_id;
  if (!ownerId) {
    return json({ error: 'No published profile found for that username' }, 404, origin, env, {
      code: 'PROFILE_NOT_FOUND',
      requestId,
    });
  }
  const ownerPlan = resolvePlan(await getSubscription(env, ownerId));
  const quotaLimit = getPlan(ownerPlan).recruiterAiPerDay;
  const { data: quotaData, error: quotaError } = await adminClient.rpc(
    'consume_recruiter_quota' as never,
    { p_user_id: ownerId, p_limit: quotaLimit } as never
  );
  if (quotaError) {
    console.error(JSON.stringify({ t: 'recruiter_quota_error', id: requestId }));
    return json({ error: 'Recruiter AI request failed' }, 500, origin, env, {
      code: 'INTERNAL',
      requestId,
    });
  }
  const consumed = quotaData as unknown as number | null;
  if (consumed === null || consumed === undefined) {
    // Profile owner's plan quota for today is exhausted — not the visitor's
    // fault, and not an anti-abuse trip.
    return json(
      {
        error:
          'The daily question limit for this profile has been reached. Please try again tomorrow.',
      },
      429,
      origin,
      env,
      { code: 'RATE_LIMITED', requestId }
    );
  }

  try {
    const raw = await provider.complete(buildRecruiterMessages(brief, question.question), 400);
    // NOTE: quota stays consumed — an answer was produced.
    // Citation semantics: only sections the model actually cited (validated
    // against this profile's real sections) are returned; 'grounded' is true
    // only when at least one valid citation exists. No fabricated citations.
    const available = nonEmptySections(profile);
    const { answer, citationIds } = parseCitations(raw, available);
    const grounded = citationIds.length > 0;
    return json(
      { answer, grounded, citationIds, sections: grounded ? citationIds : [] },
      200,
      origin,
      env,
      { requestId }
    );
  } catch (err) {
    // Fairness: the provider produced NO answer — refund the consumed daily
    // quota (transactionally clamped at zero). Answered requests are never
    // refunded.
    await adminClient.rpc('refund_recruiter_quota' as never, { p_user_id: ownerId } as never);
    if (err instanceof AIExtractionError) {
      return aiErrorToResponse(err, origin, env, requestId);
    }
    console.error(JSON.stringify({ t: 'recruiter_ai_error', id: requestId, code: 'INTERNAL' }));
    return json({ error: 'Recruiter AI request failed' }, 500, origin, env, {
      code: 'INTERNAL',
      requestId,
    });
  }
}

// ─── Account deletion (server-only; admin key never leaves the worker) ──

/**
 * Permanent account deletion for the authenticated user.
 *
 * The steps below span Storage, several tables, and Supabase Auth and CANNOT
 * be one transaction. The design is therefore explicitly IDEMPOTENT and
 * RECOVERABLE rather than atomic:
 *
 *   1. verifyAuth → the caller must hold a valid session.
 *   2. Re-auth freshness: the access token must have been issued within the
 *      last 10 minutes (`iat` claim). This is the "recent authenticated user
 *      confirmation" gate; stale tokens are rejected.
 *   3. A durable pending-deletion marker row is upserted FIRST (attempt N).
 *      It makes an interrupted attempt observable and every retry explicit.
 *   4. Storage objects (resumes bucket, prefix filtered to the verified
 *      `${userId}/`) are removed while the user still exists. Already-absent
 *      objects are tolerated — storage.remove does not fail on missing keys.
 *   5. Non-cascading rows are deleted keyed by the verified userId. "0 rows
 *      affected" (already cleaned by an earlier attempt) is success.
 *   6. Auth admin delete. A 404 (user already deleted by a prior attempt) is
 *      SUCCESS — that is the retry-completion path.
 *
 * If any step fails after earlier steps ran, the marker row records the
 * stage and the customer gets truthful wording: some cleanup may already
 * have completed, please retry. Retrying re-runs the whole plan and safely
 * skips what is already gone.
 *
 * Cross-user isolation: every delete is keyed by the userId verified against
 * the fresh session; the client never supplies an id.
 */
async function handleAccountDelete(
  request: Request,
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  const auth = await verifyAuth(request, env);
  if (!auth)
    return json({ error: 'Unauthorized' }, 401, origin, env, {
      code: 'UNAUTHORIZED',
      requestId,
    });

  const supabaseUrl = getEnvValue(env, 'SUPABASE_URL') || getEnvValue(env, 'VITE_SUPABASE_URL');
  const adminKey = getAdminKey(env);
  if (!supabaseUrl || !adminKey) {
    return json({ error: 'Account deletion is not configured' }, 503, origin, env, {
      code: 'SERVER_NOT_CONFIGURED',
      requestId,
    });
  }

  try {
    // 2. Freshness gate via VERIFIED claims. A publishable-key auth client
    // re-validates the access token against the Auth server, and
    // getClaims() returns signature-verified JWT claims (local WebCrypto
    // for asymmetric signing keys, server verification otherwise). The
    // unverified decoded token is never used for this decision.
    const publishableKey =
      getEnvValue(env, 'SUPABASE_PUBLISHABLE_KEY') ||
      getEnvValue(env, 'VITE_SUPABASE_PUBLISHABLE_KEY');
    if (!publishableKey) {
      return json({ error: 'Account deletion is not configured' }, 503, origin, env, {
        code: 'SERVER_NOT_CONFIGURED',
        requestId,
      });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const authClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${auth.token}` } },
    });

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(auth.token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: 'Unauthorized' }, 401, origin, env, {
        code: 'UNAUTHORIZED',
        requestId,
      });
    }

    const freshness = validateAuthFreshness(claimsData.claims, auth.userId);
    if (!freshness.fresh) {
      return json(
        { error: 'Please sign in again before deleting your account.' },
        401,
        origin,
        env,
        { code: 'REAUTH_REQUIRED', requestId }
      );
    }

    const supabase = createServerClient(supabaseUrl, adminKey);
    const userId = auth.userId;

    // 3. Durable marker: create-or-advance (attempt N on retries). Upsert by
    // the verified userId only; this row is cascade-deleted with the auth
    // user, so a successful deletion leaves no orphan marker.
    const { data: existingMarker } = await supabase
      .from('account_deletion_requests' as never)
      .select('*')
      .eq('user_id', userId as never)
      .maybeSingle();
    const prior = existingMarker as (Record<string, unknown> & { attempts?: number }) | null;
    const marker = recordAttempt(
      prior
        ? {
            user_id: userId,
            stage: (typeof prior.stage === 'string' ? prior.stage : 'requested') as DeletionStage,
            requested_at:
              typeof prior.requested_at === 'string'
                ? prior.requested_at
                : new Date().toISOString(),
            updated_at:
              typeof prior.updated_at === 'string' ? prior.updated_at : new Date().toISOString(),
            completed_at: typeof prior.completed_at === 'string' ? prior.completed_at : null,
            last_error: typeof prior.last_error === 'string' ? prior.last_error : null,
            attempts: typeof prior.attempts === 'number' ? prior.attempts : 1,
          }
        : newDeletionRequest(userId),
      new Date()
    );
    await supabase.from('account_deletion_requests' as never).upsert({
      user_id: userId,
      stage: marker.stage,
      attempts: marker.attempts,
      requested_at: marker.requested_at,
      updated_at: marker.updated_at,
      completed_at: marker.completed_at,
      last_error: null,
    } as never);

    // 4. Storage: remove owned objects while the user still exists. Enumerate
    // the user's own Storage prefix ({userId}/) with pagination so orphaned
    // objects (metadata row already gone) are also deleted. Cross-user
    // isolation is structural: the prefix is derived from auth.userId only.
    const { data: profileRow } = await supabase
      .from('profiles' as never)
      .select('id')
      .eq('user_id', userId as never)
      .maybeSingle();
    const profileId = (profileRow as { id?: string } | null)?.id ?? null;

    const prefix = `${userId}/`;
    const paths: string[] = [];
    const PAGE_LIMIT = 100;
    let offset = 0;
    for (;;) {
      const { data: listed, error: listError } = await supabase.storage
        .from('resumes')
        .list(userId, { limit: PAGE_LIMIT, offset, sortBy: { column: 'name', order: 'asc' } });
      if (listError) {
        console.error(JSON.stringify({ t: 'delete_storage_list_error', id: requestId, offset }));
        await supabase
          .from('account_deletion_requests' as never)
          .update({
            stage: 'requested',
            updated_at: new Date().toISOString(),
            last_error: 'storage_list_failed',
          } as never)
          .eq('user_id', userId as never);
        return json({ error: DELETION_PARTIAL_MESSAGE }, 502, origin, env, {
          code: 'DELETE_PARTIAL',
          requestId,
        });
      }
      const objects = (listed ?? []) as Array<{ name?: unknown }>;
      for (const obj of objects) {
        if (typeof obj.name === 'string' && obj.name.length > 0 && !obj.name.includes('/')) {
          paths.push(`${prefix}${obj.name}`);
        }
      }
      if (objects.length < PAGE_LIMIT) break;
      offset += PAGE_LIMIT;
    }

    if (paths.length > 0) {
      // Already-absent objects do not fail storage.remove; a hard failure
      // here leaves the marker at 'requested' and stays retryable.
      const { error: removeError } = await supabase.storage.from('resumes').remove(paths);
      if (removeError) {
        console.error(
          JSON.stringify({ t: 'delete_storage_error', id: requestId, count: paths.length })
        );
        await supabase
          .from('account_deletion_requests' as never)
          .update({
            stage: 'requested',
            updated_at: new Date().toISOString(),
            last_error: 'storage_remove_failed',
          } as never)
          .eq('user_id', userId as never);
        return json({ error: DELETION_PARTIAL_MESSAGE }, 502, origin, env, {
          code: 'DELETE_PARTIAL',
          requestId,
        });
      }
    }
    await supabase
      .from('account_deletion_requests' as never)
      .update({ stage: 'storage_cleaned', updated_at: new Date().toISOString() } as never)
      .eq('user_id', userId as never);

    // 5. Non-cascading rows: 0 rows affected (already cleaned on a retry)
    // is success. The resume rows are keyed by the server-resolved profile id;
    // if the profile is already gone, there is nothing to delete.
    const { error: subDeleteError } = await supabase
      .from('user_subscriptions' as never)
      .delete()
      .eq('user_id', userId as never);
    let resumeDeleteError: { code?: string } | null = null;
    if (profileId) {
      const { error } = await supabase
        .from('resume_sources' as never)
        .delete()
        .eq('profile_id', profileId as never);
      resumeDeleteError = error;
    }
    if (subDeleteError || resumeDeleteError) {
      console.error(
        JSON.stringify({
          t: 'delete_rows_error',
          id: requestId,
          code: subDeleteError?.code || resumeDeleteError?.code || 'INTERNAL',
        })
      );
      await supabase
        .from('account_deletion_requests' as never)
        .update({
          stage: 'storage_cleaned',
          updated_at: new Date().toISOString(),
          last_error: 'row_delete_failed',
        } as never)
        .eq('user_id', userId as never);
      return json({ error: DELETION_PARTIAL_MESSAGE }, 502, origin, env, {
        code: 'DELETE_PARTIAL',
        requestId,
      });
    }
    await supabase
      .from('account_deletion_requests' as never)
      .update({ stage: 'rows_cleaned', updated_at: new Date().toISOString() } as never)
      .eq('user_id', userId as never);

    // 6. Auth admin delete — cascades profiles, sections, evidence, billing
    // orders, funnel events, achievements, preferences AND the marker row.
    // 404 means a prior attempt already deleted the user: retry succeeded.
    const adminRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminKey}`, apikey: adminKey },
    });

    if (!adminRes.ok && adminRes.status !== 404) {
      console.error(
        JSON.stringify({ t: 'delete_auth_error', id: requestId, status: adminRes.status })
      );
      await supabase
        .from('account_deletion_requests' as never)
        .update({
          stage: 'rows_cleaned',
          updated_at: new Date().toISOString(),
          last_error: 'auth_delete_failed',
        } as never)
        .eq('user_id', userId as never);
      // Truthful: earlier steps already ran; the account is NOT intact.
      const outcome = responseForAuthDeleteFailure(true, adminRes.status);
      return json(outcome.body, outcome.status, origin, env, {
        code: (outcome.code ?? 'DELETE_FAILED') as ApiErrorCode,
        requestId,
      });
    }

    console.log(JSON.stringify({ t: 'account_deleted', id: requestId, attempt: marker.attempts }));
    return json({ deleted: true }, 200, origin, env, { requestId });
  } catch {
    console.error(JSON.stringify({ t: 'delete_error', id: requestId, code: 'INTERNAL' }));
    return json({ error: DELETION_FAILED_MESSAGE }, 500, origin, env, {
      code: 'INTERNAL',
      requestId,
    });
  }
}

// ─── Billing helpers ────────────────────────────────────────────

/**
 * End-of-cycle cancel/resume for the current Pro subscription.
 *
 * Idempotent: repeating an already-applied action returns the current state
 * (code ALREADY_DONE + ok=true semantics are expressed via ok/alreadyApplied).
 * Provider state stays authoritative — a stale row (period already ended) is
 * a CONFLICT, and the webhook path remains the only writer on renewal.
 */
// Billing model is ONE-TIME ANNUAL PRO ACCESS (no auto-renewal mandate), so
// there is nothing to cancel or resume. The legacy routes are kept as an
// explicit 410 so stale clients receive a truthful, non-misleading answer.
async function handleSubscriptionDeprecated(
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  return json(
    {
      error:
        'Subscriptions were replaced by one-time annual Pro access. There is nothing to cancel or resume.',
    },
    410,
    origin,
    env,
    { code: 'FEATURE_DISABLED', requestId }
  );
}

async function getSubscription(env: Env, userId: string): Promise<SubscriptionState> {
  const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
  const adminKey = getAdminKey(env);
  if (!supabaseUrl || !adminKey) return freeSubscription();

  const supabase = createServerClient(supabaseUrl, adminKey);
  const { data } = await supabase
    .from('user_subscriptions' as never)
    .select('*')
    .eq('user_id', userId as never)
    .maybeSingle();

  if (!data) return freeSubscription();
  return normalizeSubscriptionRow(data as Record<string, unknown>);
}

async function getUsageCount(
  env: Env,
  userId: string,
  metric: string,
  windowKey: string
): Promise<number> {
  const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
  const adminKey = getAdminKey(env);
  if (!supabaseUrl || !adminKey) return 0;

  const supabase = createServerClient(supabaseUrl, adminKey);
  const { data } = await supabase
    .from('usage_counters' as never)
    .select('count')
    .eq('user_id', userId as never)
    .eq('metric', metric as never)
    .eq('window_key', windowKey as never)
    .maybeSingle();

  return (data as { count?: number } | null)?.count ?? 0;
}

// ─── Route handlers ─────────────────────────────────────────────

async function handleGetPlans(
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  const price = readProAnnualPricePaise(getEnvValue(env, 'PRO_ANNUAL_PRICE_PAISE'));
  const currency = getEnvValue(env, 'CURRENCY') || 'INR';
  return json({ plans: buildPublicPlans(price, currency) }, 200, origin, env, { requestId });
}

async function handleGetBillingStatus(
  request: Request,
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  const auth = await verifyAuth(request, env);
  if (!auth)
    return json({ error: 'Unauthorized' }, 401, origin, env, {
      code: 'UNAUTHORIZED',
      requestId,
    });

  try {
    const subscription = await getSubscription(env, auth.userId);
    const entitlements = resolveEntitlements(subscription);

    // Pending end-of-cycle cancellation info for the Billing UI.
    let cancelAtPeriodEnd = false;
    {
      const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
      const adminKey = getAdminKey(env);
      if (supabaseUrl && adminKey) {
        const supabase = createServerClient(supabaseUrl, adminKey);
        const { data: subRow } = await supabase
          .from('user_subscriptions' as never)
          .select('cancel_at_period_end')
          .eq('user_id', auth.userId as never)
          .maybeSingle();
        cancelAtPeriodEnd =
          ((subRow as { cancel_at_period_end?: boolean } | null)?.cancel_at_period_end ?? false) ===
          true;
      }
    }

    const metrics = ['resume_variants', 'github_repos', 'recruiter_ai', 'custom_domains'] as const;
    const usage: Record<
      string,
      { used: number; limit: number; remaining: number; allowed: boolean }
    > = {};

    // CANONICAL usage: resume_variants / github_repos / custom_domains are
    // counted from their OWN feature tables (usage_counters rows are not
    // maintained by those paths); recruiter_ai stays on its daily counter.
    let canonicalVariants: number | null = null;
    let canonicalRepos: number | null = null;
    let canonicalDomains: number | null = null;
    {
      const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
      const adminKey = getAdminKey(env);
      if (supabaseUrl && adminKey) {
        const supabase = createServerClient(supabaseUrl, adminKey);
        const { data: profileRows } = await supabase
          .from('profiles' as never)
          .select('id')
          .eq('user_id', auth.userId as never);
        const profileId = ((profileRows ?? []) as Array<{ id?: unknown }>)
          .map((r) => (typeof r.id === 'string' ? r.id : ''))
          .filter((x) => x.length > 0)[0];

        const { count: variantCount } = await supabase
          .from('profile_variants' as never)
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', (profileId ?? '') as never);
        canonicalVariants = variantCount ?? 0;

        if (profileId) {
          const { data: connRows } = await supabase
            .from('github_connections' as never)
            .select('id')
            .eq('profile_id', profileId as never)
            .limit(1);
          const connId = ((connRows ?? []) as Array<{ id?: string }>)[0]?.id;
          if (connId) {
            const { count: repoCount } = await supabase
              .from('github_repositories' as never)
              .select('id', { count: 'exact', head: true })
              .eq('connection_id', connId as never)
              .eq('selected_for_evidence', true as never);
            canonicalRepos = repoCount ?? 0;
          } else {
            canonicalRepos = 0;
          }

          const { count: domainCount } = await supabase
            .from('custom_domains' as never)
            .select('id', { count: 'exact', head: true })
            .eq('profile_id', profileId as never)
            .in('status', ['pending', 'pending_validation', 'active'] as never);
          canonicalDomains = domainCount ?? 0;
        } else {
          canonicalRepos = 0;
          canonicalDomains = 0;
        }
      }
    }

    for (const metric of metrics) {
      const windowKey = windowKeyFor(metric);
      let used = await getUsageCount(env, auth.userId, metric, windowKey);
      if (metric === 'resume_variants' && canonicalVariants !== null) used = canonicalVariants;
      if (metric === 'github_repos' && canonicalRepos !== null) used = canonicalRepos;
      if (metric === 'custom_domains' && canonicalDomains !== null) used = canonicalDomains;
      const check = checkUsage(metric, used, entitlements);
      usage[metric] = check;
    }

    return json(
      {
        subscription,
        entitlements,
        cancelAtPeriodEnd,
        usage,
        pricePaise: readProAnnualPricePaise(getEnvValue(env, 'PRO_ANNUAL_PRICE_PAISE')),
        currency: getEnvValue(env, 'CURRENCY') || 'INR',
        razorpayConfigured: isRazorpayConfigured({
          keyId: getEnvValue(env, 'RAZORPAY_KEY_ID'),
          keySecret: getEnvValue(env, 'RAZORPAY_KEY_SECRET'),
          webhookSecret: getEnvValue(env, 'RAZORPAY_WEBHOOK_SECRET'),
        }),
        billingEnabled: featureEnabled(env, 'BILLING_ENABLED'),
      },
      200,
      origin,
      env,
      { requestId }
    );
  } catch {
    console.error(JSON.stringify({ t: 'billing_status_error', id: requestId, code: 'INTERNAL' }));
    return json({ error: 'Failed to load billing status' }, 500, origin, env, {
      code: 'INTERNAL',
      requestId,
    });
  }
}

async function handleCreateOrder(
  request: Request,
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  const auth = await verifyAuth(request, env);
  if (!auth)
    return json({ error: 'Unauthorized' }, 401, origin, env, {
      code: 'UNAUTHORIZED',
      requestId,
    });

  try {
    if (!featureEnabled(env, 'BILLING_ENABLED')) {
      return json({ error: 'Billing is not available in this environment.' }, 503, origin, env, {
        code: 'FEATURE_DISABLED',
        requestId,
      });
    }

    const amountPaise = readProAnnualPricePaise(getEnvValue(env, 'PRO_ANNUAL_PRICE_PAISE'));
    if (!amountPaise) {
      return json({ error: 'PRO_ANNUAL_PRICE_PAISE not configured' }, 503, origin, env, {
        code: 'PRICE_NOT_CONFIGURED',
        requestId,
      });
    }

    const razorpayConfig = {
      keyId: getEnvValue(env, 'RAZORPAY_KEY_ID'),
      keySecret: getEnvValue(env, 'RAZORPAY_KEY_SECRET'),
      webhookSecret: getEnvValue(env, 'RAZORPAY_WEBHOOK_SECRET'),
    };

    if (!isRazorpayConfigured(razorpayConfig)) {
      return json({ error: 'Billing is not configured' }, 503, origin, env, {
        code: 'BILLING_NOT_CONFIGURED',
        requestId,
      });
    }

    const currency = getEnvValue(env, 'CURRENCY') || 'INR';
    const receipt = `user_${auth.userId}_${Date.now()}`;

    const razorpayOrder = await createRazorpayOrder(razorpayConfig, {
      amount: amountPaise,
      currency,
      receipt,
      notes: { userId: auth.userId, plan: 'pro' },
    });

    const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
    const adminKey = getAdminKey(env);
    if (!supabaseUrl || !adminKey) {
      return json({ error: 'Server configuration error' }, 500, origin, env, {
        code: 'SERVER_NOT_CONFIGURED',
        requestId,
      });
    }

    const supabase = createServerClient(supabaseUrl, adminKey);
    const { data: order, error } = await supabase
      .from('billing_orders' as never)
      .insert({
        user_id: auth.userId,
        plan_id: 'pro',
        amount_paise: amountPaise,
        currency,
        status: 'created',
        razorpay_order_id: razorpayOrder.id,
      } as never)
      .select()
      .single();

    if (error || !order) {
      console.error(
        JSON.stringify({ t: 'order_insert_error', id: requestId, code: error?.code || 'INTERNAL' })
      );
      return json({ error: 'Failed to create order' }, 500, origin, env, {
        code: 'INTERNAL',
        requestId,
      });
    }

    return json(
      {
        orderId: (order as { id: string }).id,
        razorpayOrderId: razorpayOrder.id,
        amountPaise,
        currency,
        keyId: razorpayConfig.keyId,
      },
      200,
      origin,
      env,
      { requestId }
    );
  } catch {
    console.error(JSON.stringify({ t: 'order_create_error', id: requestId, code: 'INTERNAL' }));
    return json({ error: 'Failed to create order' }, 500, origin, env, {
      code: 'INTERNAL',
      requestId,
    });
  }
}

async function handleWebhook(
  request: Request,
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  try {
    if (!featureEnabled(env, 'BILLING_ENABLED')) {
      return json({ error: 'Webhooks are not available in this environment.' }, 503, origin, env, {
        code: 'FEATURE_DISABLED',
        requestId,
      });
    }

    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';
    // Real Razorpay webhooks carry the event id in this header; it is the
    // idempotency key — never a synthetic payload field.
    const eventIdHeader = request.headers.get('x-razorpay-event-id');
    const webhookSecret = getEnvValue(env, 'RAZORPAY_WEBHOOK_SECRET');

    if (!webhookSecret) {
      return json({ error: 'Webhook not configured' }, 503, origin, env, {
        code: 'BILLING_NOT_CONFIGURED',
        requestId,
      });
    }

    const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
    const adminKey = getAdminKey(env);
    if (!supabaseUrl || !adminKey) {
      return json({ error: 'Server configuration error' }, 500, origin, env, {
        code: 'SERVER_NOT_CONFIGURED',
        requestId,
      });
    }

    const supabase = createServerClient(supabaseUrl, adminKey);

    const result = await processRazorpayWebhook({
      rawBody,
      signature,
      eventIdHeader,
      deps: {
        verifySignature: makeVerifier(webhookSecret),
        // A processed event is idempotent; anything else proceeds so failed
        // attempts stay retryable.
        beginEvent: async (eventId, eventType) => {
          const { data, error } = await supabase
            .from('billing_webhook_events' as never)
            .select('status')
            .eq('event_id', eventId as never)
            .maybeSingle();
          if (error) throw new Error('LEDGER_LOOKUP_FAILED');
          const prior = (data as { status?: string } | null)?.status;
          if (prior === 'processed') return false;
          if (prior === 'processing') {
            // A stale 'processing' row (worker died mid-flight) must not block
            // the provider retry forever. Treat it as retryable after a
            // generous grace period.
            return true;
          }
          // Pre-mark the attempt so concurrent duplicates are observable.
          await supabase.from('billing_webhook_events' as never).upsert({
            event_id: eventId,
            event_type: eventType,
            status: 'processing',
          } as never);
          return true;
        },
        // Transactional activation: order paid + Pro entitlement + ledger
        // completion happen inside one DB transaction (process_paid_order_webhook).
        applyPayment: async ({ eventId, eventType, razorpayOrderId, razorpayPaymentId }) => {
          const { data, error } = await supabase.rpc('process_paid_order_webhook', {
            p_event_id: eventId,
            p_event_type: eventType,
            p_razorpay_order_id: razorpayOrderId,
            p_razorpay_payment_id: razorpayPaymentId,
          });
          if (error) {
            console.error(
              JSON.stringify({
                t: 'webhook_apply_error',
                id: requestId,
                code: error.code || 'INTERNAL',
              })
            );
            // Failure inside the transaction rolls everything back: the
            // event stays retryable and a Razorpay retry can re-apply.
            return { ok: false as const, retryable: true };
          }
          const outcome = (data as { status?: string } | null)?.status ?? 'processed';
          if (outcome === 'order_not_found') {
            // Unknown order: the ledger row must NOT stay 'processing' forever.
            // Record an explicit final 'failed' state with a safe reason. The
            // event stays retryable (only 'processed' is terminal), so a
            // legitimate later retry can still re-apply.
            await supabase
              .from('billing_webhook_events' as never)
              .update({ status: 'failed', last_error: 'order_not_found' } as never)
              .eq('event_id', eventId as never);
            console.error(
              JSON.stringify({
                t: 'webhook_order_not_found',
                id: requestId,
                code: 'ORDER_NOT_FOUND',
              })
            );
            return { ok: true as const, result: 'order_not_found' };
          }
          return { ok: true as const, result: outcome };
        },
      },
    });

    return json(result.body, result.status, origin, env, { requestId });
  } catch {
    console.error(JSON.stringify({ t: 'webhook_error', id: requestId, code: 'INTERNAL' }));
    return json({ error: 'Webhook processing failed' }, 500, origin, env, {
      code: 'INTERNAL',
      requestId,
    });
  }
}

async function handleAddCustomDomain(
  request: Request,
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  const auth = await verifyAuth(request, env);
  if (!auth)
    return json({ error: 'Unauthorized' }, 401, origin, env, {
      code: 'UNAUTHORIZED',
      requestId,
    });

  try {
    if (!featureEnabled(env, 'DOMAINS_ENABLED')) {
      return json(
        { error: 'Custom domains are not available in this environment.' },
        503,
        origin,
        env,
        {
          code: 'FEATURE_DISABLED',
          requestId,
        }
      );
    }

    // SECURITY: the browser supplies ONLY { hostname }. Ownership of the
    // profile is derived server-side from the authenticated principal — the
    // admin client below bypasses RLS, so a client-supplied profileId would
    // be a cross-user authorization bypass (IDOR).
    const body = (await request.json()) as { hostname?: string };
    if (!body.hostname) {
      return json({ error: 'hostname is required' }, 400, origin, env, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }

    const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
    const adminKey = getAdminKey(env);
    if (!supabaseUrl || !adminKey) {
      return json({ error: 'Server configuration error' }, 500, origin, env, {
        code: 'SERVER_NOT_CONFIGURED',
        requestId,
      });
    }

    const supabase = createServerClient(supabaseUrl, adminKey);

    // Resolve exactly one profile owned by the authenticated user.
    const { data: profileRows } = await supabase
      .from('profiles' as never)
      .select('id')
      .eq('user_id', auth.userId as never);
    const ownedProfileIds = ((profileRows ?? []) as Array<{ id?: unknown }>)
      .map((r) => (typeof r.id === 'string' ? r.id : ''))
      .filter((id) => id.length > 0);

    if (ownedProfileIds.length === 0) {
      return json({ error: 'No profile found for this account' }, 404, origin, env, {
        code: 'PROFILE_NOT_FOUND',
        requestId,
      });
    }
    if (ownedProfileIds.length > 1) {
      // Ambiguous ownership must never guess; refuse safely.
      return json({ error: 'Multiple profiles found; contact support' }, 409, origin, env, {
        code: 'CONFLICT',
        requestId,
      });
    }
    const ownedProfileId = ownedProfileIds[0];

    const validation = validateCustomDomain(body.hostname);
    if (!validation.valid || !validation.hostname) {
      return json({ error: validation.error }, 400, origin, env, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }

    // Provisioning REQUIRES an explicit platform origin. Enabling domains
    // without PLATFORM_PROFILE_ORIGIN must fail loudly, not provision against
    // a placeholder like profile.example.com.
    const platformOrigin = getEnvValue(env, 'PLATFORM_PROFILE_ORIGIN');
    const cloudflareConfig = {
      apiToken: getEnvValue(env, 'CLOUDFLARE_API_TOKEN'),
      accountId: getEnvValue(env, 'CLOUDFLARE_ACCOUNT_ID'),
      zoneId: getEnvValue(env, 'CLOUDFLARE_ZONE_ID'),
    };
    const provisioning = isCloudflareSaaSConfigured(cloudflareConfig);
    if (provisioning && !platformOrigin) {
      console.error(JSON.stringify({ t: 'domain_origin_missing', id: requestId, code: 'CONFIG' }));
      return json({ error: 'Custom domain provisioning is misconfigured' }, 503, origin, env, {
        code: 'SERVER_NOT_CONFIGURED',
        requestId,
      });
    }

    const subscription = await getSubscription(env, auth.userId);
    const entitlements = resolveEntitlements(subscription);

    // ATOMIC quota + pending insert. Slot-reserving states: pending /
    // pending_validation / active. 'failed' does NOT reserve a slot, so a
    // provider failure never permanently consumes the user's only domain
    // slot, and a hostname that hit a transient error can be retried.
    const { data: newDomainId, error: atomicError } = await supabase.rpc(
      'create_custom_domain_atomic' as never,
      {
        p_profile_id: ownedProfileId,
        p_hostname: validation.hostname,
        p_limit: entitlements.customDomains,
      } as never
    );

    if (atomicError) {
      console.error(
        JSON.stringify({
          t: 'domain_insert_error',
          id: requestId,
          code: atomicError.code || 'INTERNAL',
        })
      );
      return json({ error: 'Failed to add domain' }, 500, origin, env, {
        code: 'INTERNAL',
        requestId,
      });
    }
    if (!newDomainId) {
      const { count: currentCount } = await supabase
        .from('custom_domains' as never)
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', ownedProfileId as never)
        .in('status', ['pending', 'pending_validation', 'active'] as never);
      const limitReached = (currentCount ?? 0) >= entitlements.customDomains;
      return json(
        {
          error: limitReached
            ? entitlements.customDomains === 0
              ? 'Custom domains require the Pro plan'
              : 'Custom domain limit reached'
            : 'Domain already in use',
        },
        limitReached ? 429 : 409,
        origin,
        env,
        { code: limitReached ? 'RATE_LIMITED' : 'BAD_REQUEST', requestId }
      );
    }

    const domainId = newDomainId as unknown as string;

    // Provider lifecycle: pending row → create → save provider id + the
    // provider's OWN validation record → on failure mark failed (slot freed).
    let verification: { method: string; record: Record<string, unknown> | null } | null = null;
    if (provisioning) {
      try {
        const hostnameResult = await createCustomHostname(cloudflareConfig, {
          hostname: validation.hostname,
          originHost: platformOrigin,
        });
        await supabase
          .from('custom_domains' as never)
          .update({
            cloudflare_hostname_id: hostnameResult.id,
            status: hostnameResult.status === 'active' ? 'active' : 'pending_validation',
            verification_token: null,
            provider_validation: hostnameResult.ownership_verification ?? null,
            provider_validation_http: hostnameResult.ownership_verification_http ?? null,
            ssl_status: hostnameResult.sslStatus,
            ssl_validation_records: hostnameResult.sslValidationRecords ?? null,
          } as never)
          .eq('id', domainId as never);
        verification = {
          method: hostnameResult.ownership_verification_http
            ? 'http'
            : hostnameResult.ownership_verification
              ? 'txt'
              : 'none',
          record:
            (hostnameResult.ownership_verification as unknown as Record<string, unknown>) ??
            (hostnameResult.ownership_verification_http as unknown as Record<string, unknown>) ??
            null,
        };
      } catch {
        console.error(
          JSON.stringify({ t: 'cloudflare_hostname_error', id: requestId, code: 'CLOUDFLARE' })
        );
        await supabase.rpc(
          'release_custom_domain_slot' as never,
          {
            p_domain_id: domainId,
            p_safe_error: 'provider_unavailable',
          } as never
        );
        return json(
          {
            id: domainId,
            hostname: validation.hostname,
            status: 'failed',
            error: 'Domain provider is temporarily unavailable. Please retry.',
          },
          502,
          origin,
          env,
          { requestId }
        );
      }
    }

    return json(
      {
        id: domainId,
        hostname: validation.hostname,
        status: provisioning ? 'pending_validation' : 'pending',
        verification,
      },
      201,
      origin,
      env,
      { requestId }
    );
  } catch {
    console.error(JSON.stringify({ t: 'add_domain_error', id: requestId, code: 'INTERNAL' }));
    return json({ error: 'Failed to add domain' }, 500, origin, env, {
      code: 'INTERNAL',
      requestId,
    });
  }
}

/**
 * Refreshes a domain's status from the provider's ACTUAL response (hostname
 * status + ownership verification + SSL state). Never invents tokens.
 */
async function handleRefreshCustomDomain(
  request: Request,
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  const auth = await verifyAuth(request, env);
  if (!auth)
    return json({ error: 'Unauthorized' }, 401, origin, env, { code: 'UNAUTHORIZED', requestId });

  try {
    const body = (await request.json().catch(() => ({}))) as { id?: string };
    if (!body.id) {
      return json({ error: 'id is required' }, 400, origin, env, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }

    const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
    const adminKey = getAdminKey(env);
    if (!supabaseUrl || !adminKey) {
      return json({ error: 'Server configuration error' }, 500, origin, env, {
        code: 'SERVER_NOT_CONFIGURED',
        requestId,
      });
    }
    const supabase = createServerClient(supabaseUrl, adminKey);

    const { data: profileRows } = await supabase
      .from('profiles' as never)
      .select('id')
      .eq('user_id', auth.userId as never);
    const ownedProfileId = ((profileRows ?? []) as Array<{ id?: unknown }>)
      .map((r) => (typeof r.id === 'string' ? r.id : ''))
      .filter((x) => x.length > 0)[0];
    if (!ownedProfileId) {
      return json({ error: 'No profile found for this account' }, 404, origin, env, {
        code: 'PROFILE_NOT_FOUND',
        requestId,
      });
    }

    const { data: domainRows } = await supabase
      .from('custom_domains' as never)
      .select('*')
      .eq('id', body.id as never)
      .eq('profile_id', ownedProfileId as never)
      .limit(1);
    const domain = (domainRows ?? ([] as unknown[]))[0] as
      | {
          id: string;
          profile_id: string;
          hostname: string;
          status: string;
          cloudflare_hostname_id: string | null;
        }
      | undefined;
    if (!domain || domain.profile_id !== ownedProfileId) {
      return json({ error: 'Domain not found' }, 404, origin, env, {
        code: 'NOT_FOUND',
        requestId,
      });
    }

    const cloudflareConfig = {
      apiToken: getEnvValue(env, 'CLOUDFLARE_API_TOKEN'),
      accountId: getEnvValue(env, 'CLOUDFLARE_ACCOUNT_ID'),
      zoneId: getEnvValue(env, 'CLOUDFLARE_ZONE_ID'),
    };

    if (!domain.cloudflare_hostname_id || !isCloudflareSaaSConfigured(cloudflareConfig)) {
      // Nothing provisioned yet: surface the stored state truthfully.
      return json(
        { id: domain.id, hostname: domain.hostname, status: domain.status },
        200,
        origin,
        env,
        { requestId }
      );
    }

    const provider = await getCustomHostname(cloudflareConfig, domain.cloudflare_hostname_id);
    if (!provider) {
      return json({ error: 'Provider lookup failed' }, 502, origin, env, {
        code: 'DOWNLOAD_FAILED' as ApiErrorCode,
        requestId,
      });
    }

    const nextStatus =
      provider.status === 'active'
        ? 'active'
        : provider.status === 'moved'
          ? 'failed'
          : 'pending_validation';
    await supabase
      .from('custom_domains' as never)
      .update({
        status: nextStatus,
        provider_validation: provider.ownership_verification ?? null,
        provider_validation_http: provider.ownership_verification_http ?? null,
        ssl_status: provider.sslStatus,
        ssl_validation_records: provider.sslValidationRecords ?? null,
      } as never)
      .eq('id', domain.id as never);

    return json(
      {
        id: domain.id,
        hostname: domain.hostname,
        status: nextStatus,
        verification:
          provider.ownership_verification ?? provider.ownership_verification_http ?? null,
        sslStatus: provider.sslStatus,
        sslValidationRecords: provider.sslValidationRecords ?? null,
      },
      200,
      origin,
      env,
      { requestId }
    );
  } catch {
    console.error(JSON.stringify({ t: 'domain_refresh_error', id: requestId, code: 'INTERNAL' }));
    return json({ error: 'Failed to refresh domain' }, 500, origin, env, {
      code: 'INTERNAL',
      requestId,
    });
  }
}

/**
 * Removes a domain: deletes the provider resource first (when one exists),
 * then marks the row removed. Failed rows can always be removed.
 */
async function handleRemoveCustomDomain(
  request: Request,
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  const auth = await verifyAuth(request, env);
  if (!auth)
    return json({ error: 'Unauthorized' }, 401, origin, env, { code: 'UNAUTHORIZED', requestId });

  try {
    const body = (await request.json().catch(() => ({}))) as { id?: string };
    if (!body.id) {
      return json({ error: 'id is required' }, 400, origin, env, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }

    const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
    const adminKey = getAdminKey(env);
    if (!supabaseUrl || !adminKey) {
      return json({ error: 'Server configuration error' }, 500, origin, env, {
        code: 'SERVER_NOT_CONFIGURED',
        requestId,
      });
    }
    const supabase = createServerClient(supabaseUrl, adminKey);

    const { data: profileRows } = await supabase
      .from('profiles' as never)
      .select('id')
      .eq('user_id', auth.userId as never);
    const ownedProfileId = ((profileRows ?? []) as Array<{ id?: unknown }>)
      .map((r) => (typeof r.id === 'string' ? r.id : ''))
      .filter((x) => x.length > 0)[0];
    if (!ownedProfileId) {
      return json({ error: 'No profile found for this account' }, 404, origin, env, {
        code: 'PROFILE_NOT_FOUND',
        requestId,
      });
    }

    const { data: domainRows } = await supabase
      .from('custom_domains' as never)
      .select('id, hostname, cloudflare_hostname_id')
      .eq('id', body.id as never)
      .eq('profile_id', ownedProfileId as never)
      .limit(1);
    const domain = (domainRows ?? ([] as unknown[]))[0] as
      { id: string; hostname: string; cloudflare_hostname_id: string | null } | undefined;
    if (!domain) {
      return json({ error: 'Domain not found' }, 404, origin, env, {
        code: 'NOT_FOUND',
        requestId,
      });
    }

    const cloudflareConfig = {
      apiToken: getEnvValue(env, 'CLOUDFLARE_API_TOKEN'),
      accountId: getEnvValue(env, 'CLOUDFLARE_ACCOUNT_ID'),
      zoneId: getEnvValue(env, 'CLOUDFLARE_ZONE_ID'),
    };
    if (domain.cloudflare_hostname_id && isCloudflareSaaSConfigured(cloudflareConfig)) {
      const ok = await deleteCustomHostname(cloudflareConfig, domain.cloudflare_hostname_id);
      if (!ok) {
        return json(
          { error: 'Provider deletion failed; try again before removing locally' },
          502,
          origin,
          env,
          { code: 'INTERNAL', requestId }
        );
      }
    }

    await supabase
      .from('custom_domains' as never)
      .update({ status: 'removed' } as never)
      .eq('id', domain.id as never);

    return json({ removed: true }, 200, origin, env, { requestId });
  } catch {
    console.error(JSON.stringify({ t: 'domain_remove_error', id: requestId, code: 'INTERNAL' }));
    return json({ error: 'Failed to remove domain' }, 500, origin, env, {
      code: 'INTERNAL',
      requestId,
    });
  }
}

async function handleDotCvQuote(
  request: Request,
  origin: string | null,
  env: Env,
  requestId: string
): Promise<Response> {
  const auth = await verifyAuth(request, env);
  if (!auth)
    return json({ error: 'Unauthorized' }, 401, origin, env, {
      code: 'UNAUTHORIZED',
      requestId,
    });

  try {
    if (!featureEnabled(env, 'DOMAINS_ENABLED')) {
      return json(
        { error: 'Domain registration is not available in this environment.' },
        503,
        origin,
        env,
        {
          code: 'FEATURE_DISABLED',
          requestId,
        }
      );
    }

    const body = (await request.json()) as { domain?: string };
    if (!body.domain) {
      return json({ error: 'domain is required' }, 400, origin, env, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }

    const parsed = parseDotCvInput(body.domain);
    if (!parsed) {
      return json({ error: 'Invalid .cv domain' }, 400, origin, env, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }

    const config = {
      enabled: getEnvValue(env, 'DOTCV_ENABLED') === 'true',
      purchaseEnabled: getEnvValue(env, 'DOTCV_PURCHASE_ENABLED') === 'true',
      apiBaseUrl: getEnvValue(env, 'DOTCV_API_BASE_URL'),
      apiKey: getEnvValue(env, 'DOTCV_API_KEY'),
    };

    const quote = await quoteDotCvDomain(config, parsed.fqdn);

    return json(
      {
        ...quote,
        label: parsed.label,
        providerEnabled: isDotCvEnabled(config),
        purchaseEnabled: isDotCvPurchaseEnabled(config),
      },
      200,
      origin,
      env,
      { requestId }
    );
  } catch {
    console.error(JSON.stringify({ t: 'dotcv_quote_error', id: requestId, code: 'INTERNAL' }));
    return json({ error: 'Failed to quote domain' }, 500, origin, env, {
      code: 'INTERNAL',
      requestId,
    });
  }
}

// ─── Router ─────────────────────────────────────────────────────

export async function handleRequest(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  requestId?: string
): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const id = requestId || '';

  if (request.method === 'OPTIONS') {
    if (origin && !isOriginAllowed(origin, env)) {
      return new Response(null, {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...securityHeaders() },
      });
    }
    return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
  }

  if (url.pathname === '/api/health') {
    return json(
      { status: 'ok', timestamp: new Date().toISOString(), buildSha: typeof __BUILD_COMMIT_SHA__ === 'undefined' ? 'unavailable' : __BUILD_COMMIT_SHA__ },
      200,
      origin,
      env,
      id ? { requestId: id } : undefined
    );
  }

  if (url.pathname === '/api/billing/plans' && request.method === 'GET') {
    return handleGetPlans(origin, env, id);
  }

  if (url.pathname === '/api/billing/status' && request.method === 'GET') {
    return handleGetBillingStatus(request, origin, env, id);
  }

  if (url.pathname === '/api/billing/order' && request.method === 'POST') {
    return handleCreateOrder(request, origin, env, id);
  }

  if (url.pathname === '/api/billing/webhook' && request.method === 'POST') {
    return handleWebhook(request, origin, env, id);
  }

  if (url.pathname === '/api/billing/subscription/cancel' && request.method === 'POST') {
    return handleSubscriptionDeprecated(origin, env, id);
  }

  if (url.pathname === '/api/billing/subscription/resume' && request.method === 'POST') {
    return handleSubscriptionDeprecated(origin, env, id);
  }

  if (url.pathname === '/api/github/install/start' && request.method === 'POST') {
    return handleGitHubInstallStart(request, origin, env, id);
  }

  if (url.pathname === '/api/github/callback' && request.method === 'POST') {
    return handleGitHubCallback(request, origin, env, id);
  }

  if (url.pathname === '/api/github/connect/choose' && request.method === 'POST') {
    return handleGitHubConnectChoose(request, origin, env, id);
  }

  if (url.pathname === '/api/github/config' && request.method === 'GET') {
    return handleGitHubInstallInfo(origin, env, id);
  }

  if (url.pathname === '/api/github/sync' && request.method === 'POST') {
    return handleGitHubSync(request, origin, env, id);
  }

  if (url.pathname === '/api/github/evidence/generate' && request.method === 'POST') {
    return handleGitHubEvidenceGenerate(request, origin, env, id);
  }

  const evidencePublic = url.pathname.match(/^\/api\/github\/evidence\/([0-9a-f-]{36})\/public$/);
  if (evidencePublic && request.method === 'POST') {
    return handleEvidencePublicToggle(request, evidencePublic[1], origin, env, id);
  }

  if (url.pathname === '/api/github/disconnect' && request.method === 'POST') {
    return handleGitHubDisconnect(request, origin, env, id);
  }

  const githubRepoAction = url.pathname.match(
    /^\/api\/github\/repositories\/([0-9]+)\/(select|public)$/
  );
  if (githubRepoAction && request.method === 'POST') {
    return handleGitHubRepoAction(
      request,
      githubRepoAction[1],
      githubRepoAction[2] as 'select' | 'public',
      origin,
      env,
      id
    );
  }

  if (url.pathname === '/api/domains/custom' && request.method === 'POST') {
    return handleAddCustomDomain(request, origin, env, id);
  }

  if (url.pathname === '/api/domains/custom/refresh' && request.method === 'POST') {
    return handleRefreshCustomDomain(request, origin, env, id);
  }

  if (url.pathname === '/api/domains/custom/remove' && request.method === 'POST') {
    return handleRemoveCustomDomain(request, origin, env, id);
  }

  if (url.pathname === '/api/domains/dotcv/quote' && request.method === 'POST') {
    return handleDotCvQuote(request, origin, env, id);
  }

  if (url.pathname === '/api/resume/extract' && request.method === 'POST') {
    return handleResumeExtract(request, origin, env, id);
  }

  const publicProfileMatch = url.pathname.match(/^\/api\/public\/profile\/([^/]+)$/);
  if (publicProfileMatch && request.method === 'GET') {
    let username: string;
    try {
      username = decodeURIComponent(publicProfileMatch[1]);
    } catch {
      return json({ error: 'Profile not found' }, 404, origin, env, {
        code: 'PROFILE_NOT_FOUND',
        requestId: id || undefined,
      });
    }
    return handlePublicProfile(username, origin, env, id);
  }

  if (url.pathname === '/api/recruiter/config' && request.method === 'GET') {
    // Public, non-secret config for the recruiter panel on public profiles.
    return json(
      {
        enabled: featureEnabled(env, 'RECRUITER_AI_ENABLED'),
        aiConfigured: Boolean(getEnvValue(env, 'BHARATCODE_API_KEY')),
        maxQuestionChars: 400,
      },
      200,
      origin,
      env,
      id ? { requestId: id } : undefined
    );
  }

  if (url.pathname === '/api/recruiter/ask' && request.method === 'POST') {
    return handleRecruiterAsk(request, origin, env, id);
  }

  if (url.pathname === '/api/tailoring/variant' && request.method === 'POST') {
    return handleCreateVariant(request, origin, env, id);
  }

  if (url.pathname === '/api/account/delete' && request.method === 'POST') {
    return handleAccountDelete(request, origin, env, id);
  }

  return json({ error: 'Not Found' }, 404, origin, env, {
    code: 'NOT_FOUND',
    requestId: id || undefined,
  });
}
