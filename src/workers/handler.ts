import { createServerClient } from '../lib/supabase/server';
import { readProAnnualPricePaise, buildPublicPlans } from '../lib/billing/plans';
import {
  normalizeSubscriptionRow,
  resolveEntitlements,
  freeSubscription,
} from '../lib/billing/entitlements';
import { checkUsage, windowKeyFor } from '../lib/billing/usage';
import { createRazorpayOrder, isRazorpayConfigured } from '../lib/billing/razorpay';
import { applyCancelAction, type CancelAction } from '../lib/billing/cancellation';
import { processRazorpayWebhook, makeVerifier } from '../lib/billing/webhooks';
import { validateAddDomain, generateVerificationToken } from '../lib/domains/custom';
import { quoteDotCvDomain, isDotCvEnabled, isDotCvPurchaseEnabled } from '../lib/domains/dotcv';
import { parseDotCvInput } from '../lib/domains/validators';
import { createCustomHostname, isCloudflareSaaSConfigured } from '../lib/domains/cloudflare';
import { AIExtractionError, BharatCodeProvider } from '../lib/ai/bharatcode';
import {
  buildProfileBrief,
  buildRecruiterMessages,
  nonEmptySections,
  sanitizeRecruiterAnswer,
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
import type { PlanEntitlements } from '../lib/billing/plans';
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
  BILLING_ENABLED?: string;
  DOMAINS_ENABLED?: string;
  RECRUITER_AI_ENABLED?: string;
  RECRUITER_RATE_LIMITER?: {
    limit: (key: string) => { allowed: boolean; hits: number };
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
  | 'AI_NOT_CONFIGURED'
  | 'AI_PROVIDER_ERROR'
  | 'AI_EMPTY_RESPONSE'
  | 'AI_INVALID_JSON'
  | 'AI_INVALID_RESPONSE'
  | 'EXTRACTION_FAILED'
  | 'RATE_LIMITED'
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
 * Safe feature flags: explicit true/false wins; otherwise enabled only in
 * production. This keeps preview environments from mutating production
 * billing or domain provisioning by accident.
 */
function featureEnabled(
  env: Env,
  flag: 'BILLING_ENABLED' | 'DOMAINS_ENABLED' | 'RECRUITER_AI_ENABLED'
): boolean {
  const raw = getEnvValue(env, flag).toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return getEnvValue(env, 'ENVIRONMENT').toLowerCase() === 'production';
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
    const uint8Array = new Uint8Array(buffer);

    const decoder = new TextDecoder('utf-8', { fatal: false });
    const fullText = decoder.decode(uint8Array);

    const textChunks: string[] = [];
    const streamMatches = fullText.match(/stream\r?\n([\s\S]*?)\r?\nendstream/g);
    if (streamMatches) {
      for (const match of streamMatches) {
        const streamContent = match.replace(/^stream\r?\n/, '').replace(/\r?\nendstream$/, '');
        const cleaned = streamContent
          .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (cleaned.length > 10) {
          textChunks.push(cleaned);
        }
      }
    }

    const extractedText = textChunks.join('\n\n');

    if (extractedText.trim().length < 50) {
      return json(
        { error: 'This PDF appears to be scanned or contains too little readable text.' },
        422,
        origin,
        env,
        { code: 'PDF_NO_TEXT', requestId }
      );
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
  }

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const rate = env.RECRUITER_RATE_LIMITER?.limit?.(`ip:${ip}`);
  if (rate && !rate.allowed) {
    return json({ error: 'Too many questions. Please try again later.' }, 429, origin, env, {
      code: 'RATE_LIMITED',
      requestId,
    });
  }

  const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
  const publishable =
    getEnvValue(env, 'SUPABASE_PUBLISHABLE_KEY') ||
    getEnvValue(env, 'VITE_SUPABASE_PUBLISHABLE_KEY');
  if (!supabaseUrl || !publishable) {
    return json({ error: 'Recruiter AI is not configured' }, 503, origin, env, {
      code: 'SERVER_NOT_CONFIGURED',
      requestId,
    });
  }

  // Publishable key only: the public_profiles view is anon-readable by design.
  const supabase = createServerClient(supabaseUrl, publishable);
  const { data: row } = await supabase
    .from('public_profiles' as never)
    .select('*')
    .eq('username', username)
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

  try {
    const raw = await provider.complete(buildRecruiterMessages(brief, question.question), 400);
    const answer = sanitizeRecruiterAnswer(raw);
    return json({ answer, grounded: true, sections: nonEmptySections(profile) }, 200, origin, env, {
      requestId,
    });
  } catch (err) {
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

    // 4. Storage: remove owned objects while the user still exists. Resolve
    // the user's profile id server-side (never client-supplied); on a retry
    // where the profile is already gone, the sentinel id matches nothing and
    // the (empty) path list is skipped — already-absent is tolerated.
    const { data: profileRow } = await supabase
      .from('profiles' as never)
      .select('id')
      .eq('user_id', userId as never)
      .maybeSingle();
    const profileId = (profileRow as { id?: string } | null)?.id ?? null;

    let paths: string[] = [];
    if (profileId) {
      const { data: storageRows } = await supabase
        .from('resume_sources' as never)
        .select('storage_path')
        .eq('profile_id', profileId as never);
      paths = ((storageRows ?? []) as Array<{ storage_path?: unknown }>)
        .map((r) => (typeof r.storage_path === 'string' ? r.storage_path : ''))
        .filter((p) => p.length > 0 && p.startsWith(`${userId}/`));
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
async function handleSubscriptionCancel(
  request: Request,
  origin: string | null,
  env: Env,
  requestId: string,
  action: CancelAction
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

    const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
    const adminKey = getAdminKey(env);
    if (!supabaseUrl || !adminKey) {
      return json({ error: 'Server configuration error' }, 500, origin, env, {
        code: 'SERVER_NOT_CONFIGURED',
        requestId,
      });
    }

    const supabase = createServerClient(supabaseUrl, adminKey);
    const { data: row } = await supabase
      .from('user_subscriptions' as never)
      .select('*')
      .eq('user_id', auth.userId as never)
      .maybeSingle();

    const record = (row ?? {}) as Record<string, unknown>;
    const result = applyCancelAction(
      {
        plan: typeof record.plan === 'string' ? record.plan : null,
        status: typeof record.status === 'string' ? record.status : null,
        current_period_end:
          typeof record.current_period_end === 'string' ? record.current_period_end : null,
        cancel_at_period_end:
          typeof record.cancel_at_period_end === 'boolean' ? record.cancel_at_period_end : null,
      },
      action
    );

    if (!result.ok || !result.row) {
      const status =
        result.code === 'NOT_PRO'
          ? 409
          : result.code === 'PERIOD_END_MISSING' || result.code === 'CONFLICT'
            ? 409
            : 400;
      return json(
        { error: CANCEL_ERROR_MESSAGES[result.code ?? 'CONFLICT'] },
        status,
        origin,
        env,
        { code: result.code === 'NOT_PRO' ? 'NOT_PRO' : 'CONFLICT', requestId }
      );
    }

    const alreadyApplied =
      typeof record.cancel_at_period_end === 'boolean' &&
      record.cancel_at_period_end === result.row.cancel_at_period_end &&
      record.status === result.row.status;

    const { error: updateError } = await supabase
      .from('user_subscriptions' as never)
      .update({
        status: result.row.status,
        cancel_at_period_end: result.row.cancel_at_period_end,
      } as never)
      .eq('user_id', auth.userId as never);

    if (updateError) {
      console.error(
        JSON.stringify({
          t: 'cancel_update_error',
          id: requestId,
          code: updateError.code || 'INTERNAL',
        })
      );
      return json({ error: 'Failed to update subscription' }, 500, origin, env, {
        code: 'INTERNAL',
        requestId,
      });
    }

    // Entitlements stay Pro until current_period_end; report the honest view.
    return json(
      {
        alreadyApplied,
        subscription: {
          plan: result.row.plan,
          status: result.row.status,
          cancelAtPeriodEnd: result.row.cancel_at_period_end,
          currentPeriodEnd: result.row.current_period_end,
          entitlementsUntil: result.row.cancel_at_period_end ? result.row.current_period_end : null,
        },
      },
      200,
      origin,
      env,
      { requestId }
    );
  } catch {
    console.error(JSON.stringify({ t: 'cancel_error', id: requestId, code: 'INTERNAL' }));
    return json({ error: 'Failed to update subscription' }, 500, origin, env, {
      code: 'INTERNAL',
      requestId,
    });
  }
}

const CANCEL_ERROR_MESSAGES: Record<string, string> = {
  NOT_PRO: 'No paid subscription to cancel.',
  PERIOD_END_MISSING: 'Subscription period information is missing; contact support.',
  CONFLICT: 'Subscription state changed; refresh and try again.',
  ALREADY_CANCELED: 'Already canceled.',
  ALREADY_ACTIVE: 'Subscription is already active.',
};

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

    const metrics = [
      'resume_variants',
      'github_repos',
      'recruiter_ai',
      'tailoring',
      'custom_domains',
    ] as const;
    const usage: Record<
      string,
      { used: number; limit: number; remaining: number; allowed: boolean }
    > = {};

    for (const metric of metrics) {
      const windowKey = windowKeyFor(metric);
      const used = await getUsageCount(env, auth.userId, metric, windowKey);
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
            // Unknown order: provider-side mismatch. Not retryable billing —
            // report clearly and do not mark processed.
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

    const subscription = await getSubscription(env, auth.userId);
    const entitlements = resolveEntitlements(subscription);

    const { count: existingCount } = await supabase
      .from('custom_domains' as never)
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', ownedProfileId as never)
      .neq('status', 'removed' as never);

    const validation = validateAddDomain(
      body.hostname,
      existingCount ?? 0,
      entitlements as PlanEntitlements
    );

    if (!validation.ok || !validation.hostname) {
      return json({ error: validation.error }, 400, origin, env, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }

    const verificationToken = generateVerificationToken();

    const { data: domain, error } = await supabase
      .from('custom_domains' as never)
      .insert({
        profile_id: ownedProfileId,
        hostname: validation.hostname,
        status: 'pending',
        verification_token: verificationToken,
      } as never)
      .select()
      .single();

    if (error || !domain) {
      if (error?.code === '23505') {
        return json({ error: 'Domain already in use' }, 409, origin, env, {
          code: 'BAD_REQUEST',
          requestId,
        });
      }
      console.error(
        JSON.stringify({ t: 'domain_insert_error', id: requestId, code: error?.code || 'INTERNAL' })
      );
      return json({ error: 'Failed to add domain' }, 500, origin, env, {
        code: 'INTERNAL',
        requestId,
      });
    }

    const cloudflareConfig = {
      apiToken: getEnvValue(env, 'CLOUDFLARE_API_TOKEN'),
      accountId: getEnvValue(env, 'CLOUDFLARE_ACCOUNT_ID'),
      zoneId: getEnvValue(env, 'CLOUDFLARE_ZONE_ID'),
    };

    if (isCloudflareSaaSConfigured(cloudflareConfig)) {
      try {
        const hostnameResult = await createCustomHostname(cloudflareConfig, {
          hostname: validation.hostname,
          originHost: getEnvValue(env, 'PLATFORM_PROFILE_ORIGIN') || 'profile.example.com',
        });

        await supabase
          .from('custom_domains' as never)
          .update({
            cloudflare_hostname_id: hostnameResult.id,
            status: hostnameResult.status === 'active' ? 'active' : 'pending_validation',
          } as never)
          .eq('id', (domain as { id: string }).id as never);
      } catch {
        console.error(
          JSON.stringify({ t: 'cloudflare_hostname_error', id: requestId, code: 'CLOUDFLARE' })
        );
      }
    }

    return json(
      {
        id: (domain as { id: string }).id,
        hostname: validation.hostname,
        verificationToken,
        status: 'pending',
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
      { status: 'ok', timestamp: new Date().toISOString() },
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
    return handleSubscriptionCancel(request, origin, env, id, 'cancel');
  }

  if (url.pathname === '/api/billing/subscription/resume' && request.method === 'POST') {
    return handleSubscriptionCancel(request, origin, env, id, 'resume');
  }

  if (url.pathname === '/api/domains/custom' && request.method === 'POST') {
    return handleAddCustomDomain(request, origin, env, id);
  }

  if (url.pathname === '/api/domains/dotcv/quote' && request.method === 'POST') {
    return handleDotCvQuote(request, origin, env, id);
  }

  if (url.pathname === '/api/resume/extract' && request.method === 'POST') {
    return handleResumeExtract(request, origin, env, id);
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

  if (url.pathname === '/api/account/delete' && request.method === 'POST') {
    return handleAccountDelete(request, origin, env, id);
  }

  return json({ error: 'Not Found' }, 404, origin, env, {
    code: 'NOT_FOUND',
    requestId: id || undefined,
  });
}
