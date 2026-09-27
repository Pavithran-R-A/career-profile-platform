import { createServerClient } from '../lib/supabase/server';
import { readProAnnualPricePaise, buildPublicPlans } from '../lib/billing/plans';
import {
  normalizeSubscriptionRow,
  resolveEntitlements,
  freeSubscription,
} from '../lib/billing/entitlements';
import { checkUsage, windowKeyFor } from '../lib/billing/usage';
import { createRazorpayOrder, isRazorpayConfigured } from '../lib/billing/razorpay';
import { processRazorpayWebhook, makeVerifier } from '../lib/billing/webhooks';
import { validateAddDomain, buildVerificationToken } from '../lib/domains/custom';
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
  | 'PROFILE_NOT_FOUND';

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
function featureEnabled(env: Env, flag: 'BILLING_ENABLED' | 'DOMAINS_ENABLED'): boolean {
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
      ? { ...(typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}), ...(extras.code ? { code: extras.code } : {}), ...(extras.requestId ? { requestId: extras.requestId } : {}) }
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
      source_url: typeof ev.source_url === 'string' && isHttpUrl(ev.source_url) ? ev.source_url : null,
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
    return json(
      { answer, grounded: true, sections: nonEmptySections(profile) },
      200,
      origin,
      env,
      { requestId }
    );
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

// ─── Billing helpers ────────────────────────────────────────────

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

async function handleGetPlans(origin: string | null, env: Env, requestId: string): Promise<Response> {
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
  if (!auth) return json({ error: 'Unauthorized' }, 401, origin, env, {
    code: 'UNAUTHORIZED',
    requestId,
  });

  try {
    const subscription = await getSubscription(env, auth.userId);
    const entitlements = resolveEntitlements(subscription);

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
  if (!auth) return json({ error: 'Unauthorized' }, 401, origin, env, {
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
      deps: {
        verifySignature: makeVerifier(webhookSecret),
        claimEvent: async (eventId: string) => {
          const { error } = await supabase
            .from('billing_webhook_events' as never)
            .insert({ event_id: eventId } as never);
          if (error) {
            if (error.code === '23505') return false;
          }
          return true;
        },
        markOrderPaid: async ({ razorpayOrderId, razorpayPaymentId }) => {
          const { error } = await supabase
            .from('billing_orders' as never)
            .update({
              status: 'paid',
              razorpay_payment_id: razorpayPaymentId,
              paid_at: new Date().toISOString(),
            } as never)
            .eq('razorpay_order_id', razorpayOrderId as never);

          if (error) {
            console.error(
              JSON.stringify({ t: 'order_paid_error', id: requestId, code: 'ORDER_UPDATE_FAILED' })
            );
            throw new Error('ORDER_UPDATE_FAILED');
          }

          const { data: order } = await supabase
            .from('billing_orders' as never)
            .select('user_id')
            .eq('razorpay_order_id', razorpayOrderId as never)
            .maybeSingle();

          const userId = (order as { user_id?: string } | null)?.user_id;
          if (!userId) return;

          const periodEnd = new Date();
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);

          const { error: subError } = await supabase.from('user_subscriptions' as never).upsert({
            user_id: userId,
            plan: 'pro',
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: periodEnd.toISOString(),
            provider: 'razorpay',
          } as never);

          if (subError) {
            console.error(
              JSON.stringify({ t: 'subscription_error', id: requestId, code: subError.code || 'INTERNAL' })
            );
          }
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
  if (!auth) return json({ error: 'Unauthorized' }, 401, origin, env, {
    code: 'UNAUTHORIZED',
    requestId,
  });

  try {
    if (!featureEnabled(env, 'DOMAINS_ENABLED')) {
      return json({ error: 'Custom domains are not available in this environment.' }, 503, origin, env, {
        code: 'FEATURE_DISABLED',
        requestId,
      });
    }

    const body = (await request.json()) as { hostname?: string; profileId?: string };
    if (!body.hostname || !body.profileId) {
      return json({ error: 'hostname and profileId are required' }, 400, origin, env, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }

    const subscription = await getSubscription(env, auth.userId);
    const entitlements = resolveEntitlements(subscription);

    const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
    const adminKey = getAdminKey(env);
    if (!supabaseUrl || !adminKey) {
      return json({ error: 'Server configuration error' }, 500, origin, env, {
        code: 'SERVER_NOT_CONFIGURED',
        requestId,
      });
    }

    const supabase = createServerClient(supabaseUrl, adminKey);

    const { count: existingCount } = await supabase
      .from('custom_domains' as never)
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', body.profileId as never)
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

    const verificationToken = buildVerificationToken(
      validation.hostname,
      getEnvValue(env, 'RATE_LIMIT_KEY_SECRET') || 'cv'
    );

    const { data: domain, error } = await supabase
      .from('custom_domains' as never)
      .insert({
        profile_id: body.profileId,
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
        console.error(JSON.stringify({ t: 'cloudflare_hostname_error', id: requestId, code: 'CLOUDFLARE' }));
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
  if (!auth) return json({ error: 'Unauthorized' }, 401, origin, env, {
    code: 'UNAUTHORIZED',
    requestId,
  });

  try {
    if (!featureEnabled(env, 'DOMAINS_ENABLED')) {
      return json({ error: 'Domain registration is not available in this environment.' }, 503, origin, env, {
        code: 'FEATURE_DISABLED',
        requestId,
      });
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

  if (url.pathname === '/api/domains/custom' && request.method === 'POST') {
    return handleAddCustomDomain(request, origin, env, id);
  }

  if (url.pathname === '/api/domains/dotcv/quote' && request.method === 'POST') {
    return handleDotCvQuote(request, origin, env, id);
  }

  if (url.pathname === '/api/resume/extract' && request.method === 'POST') {
    return handleResumeExtract(request, origin, env, id);
  }

  if (url.pathname === '/api/recruiter/ask' && request.method === 'POST') {
    return handleRecruiterAsk(request, origin, env, id);
  }

  return json({ error: 'Not Found' }, 404, origin, env, {
    code: 'NOT_FOUND',
    requestId: id || undefined,
  });
}
