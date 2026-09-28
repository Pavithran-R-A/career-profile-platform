// Browser-side client for the public recruiter-ask API.
// Same contract as the worker: grounded answers only, sections cited.

export interface RecruiterConfig {
  enabled: boolean;
  aiConfigured: boolean;
  maxQuestionChars: number;
}

export interface RecruiterAnswer {
  answer: string;
  grounded: boolean;
  sections: string[];
}

export const DEFAULT_CONFIG: RecruiterConfig = {
  enabled: false,
  aiConfigured: false,
  maxQuestionChars: 400,
};

export async function fetchRecruiterConfig(): Promise<RecruiterConfig> {
  const res = await fetch('/api/recruiter/config');
  if (!res.ok) return DEFAULT_CONFIG;
  const body = (await res.json()) as Partial<RecruiterConfig>;
  return {
    enabled: body.enabled === true,
    aiConfigured: body.aiConfigured === true,
    maxQuestionChars: typeof body.maxQuestionChars === 'number' ? body.maxQuestionChars : 400,
  };
}

export type AskFailureCode =
  | 'BAD_REQUEST'
  | 'PROFILE_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'AI_NOT_CONFIGURED'
  | 'SERVER_NOT_CONFIGURED'
  | 'NETWORK'
  | 'UNKNOWN';

export class RecruiterAskError extends Error {
  code: AskFailureCode;
  retryAfterSeconds: number | null;

  constructor(code: AskFailureCode, message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function askRecruiterQuestion(
  username: string,
  question: string
): Promise<RecruiterAnswer> {
  let res: Response;
  try {
    res = await fetch('/api/recruiter/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, question }),
    });
  } catch {
    throw new RecruiterAskError('NETWORK', 'Network problem — check your connection and retry.');
  }

  const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };

  if (!res.ok) {
    const payload = body as { error?: string; code?: string };
    const code = (payload.code ?? 'UNKNOWN') as AskFailureCode;
    const retryAfter = res.headers.get('retry-after');
    throw new RecruiterAskError(
      code,
      payload.error || 'The assistant could not answer right now.',
      retryAfter ? Number(retryAfter) : null
    );
  }

  const data = body as unknown as RecruiterAnswer;
  if (typeof data.answer !== 'string') {
    throw new RecruiterAskError('UNKNOWN', 'The assistant returned an unexpected response.');
  }
  return {
    answer: data.answer,
    grounded: data.grounded !== false,
    sections: Array.isArray(data.sections) ? data.sections : [],
  };
}

export const SECTION_LABELS: Record<string, string> = {
  basics: 'About',
  experience: 'Experience',
  education: 'Education',
  projects: 'Projects',
  skills: 'Skills',
  links: 'Links',
  evidence: 'Public evidence',
};

export function sectionLabel(key: string): string {
  return SECTION_LABELS[key] ?? key;
}
