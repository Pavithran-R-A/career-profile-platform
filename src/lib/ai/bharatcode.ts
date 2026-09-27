import type { AIProvider, AIExtractProfileInput, ResumeExtraction } from './provider';
import { resumeExtractionSchema } from './provider';

export type AIExtractionErrorCode =
  | 'AI_NOT_CONFIGURED'
  | 'AI_PROVIDER_ERROR'
  | 'AI_EMPTY_RESPONSE'
  | 'AI_INVALID_JSON'
  | 'AI_INVALID_RESPONSE';

export class AIExtractionError extends Error {
  readonly code: AIExtractionErrorCode;

  constructor(code: AIExtractionErrorCode, message: string) {
    super(message);
    this.name = 'AIExtractionError';
    this.code = code;
  }
}

const EXTRACTION_PROMPT = `You are a resume extraction assistant. Extract structured information from the following resume text.

IMPORTANT RULES:
1. Extract ONLY information explicitly stated in the resume
2. Do NOT invent employers, dates, or credentials
3. Do NOT infer years of experience
4. Do NOT create false claims or exaggerations
5. For unknown values, use null or omit them
6. Preserve uncertainty as warnings

Return a JSON object with this exact structure:
{
  "identity": {
    "displayName": "string or null",
    "headline": "string or null",
    "location": "string or null",
    "about": "string or null (summary/objective if present)"
  },
  "experience": [
    {
      "company": "string",
      "role": "string",
      "location": "string or null",
      "startDate": "string (YYYY-MM or YYYY-MM-DD format if available)",
      "endDate": "string or null (null if current)",
      "isCurrent": boolean,
      "description": "string or null",
      "sourceText": "the exact text from resume that contains this information"
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string or null",
      "fieldOfStudy": "string or null",
      "startDate": "string or null",
      "endDate": "string or null",
      "sourceText": "the exact text from resume that contains this information"
    }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string or null",
      "url": "string (valid URL) or null",
      "technologies": ["array of technology names"],
      "sourceText": "the exact text from resume that contains this information"
    }
  ],
  "skills": [
    {
      "name": "string",
      "sourceText": "the exact text from resume that contains this information"
    }
  ],
  "links": [
    {
      "label": "string (e.g., LinkedIn, GitHub, Portfolio)",
      "url": "string (valid URL)",
      "sourceText": "the exact text from resume that contains this information"
    }
  ],
  "warnings": [
    "any ambiguous or incomplete information that needs review"
  ]
}

RESUME TEXT:
`;

export interface BharatCodeConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function readProcessEnv(name: string): string {
  try {
    if (typeof process !== 'undefined' && process.env && typeof process.env[name] === 'string') {
      return process.env[name];
    }
  } catch {
    // No process object in this runtime.
  }
  return '';
}

export class BharatCodeProvider implements AIProvider {
  readonly name = 'bharatcode';

  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config?: Partial<BharatCodeConfig>) {
    this.apiKey = config?.apiKey ?? readProcessEnv('BHARATCODE_API_KEY');
    this.baseUrl =
      config?.baseUrl ??
      (readProcessEnv('BHARATCODE_BASE_URL') || 'https://bharatcode.ai/api/model/v1');
    this.model = config?.model ?? (readProcessEnv('BHARATCODE_MODEL') || 'deepseek-v4.1-flash');
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async complete(
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    maxTokens = 400
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new AIExtractionError(
        'AI_NOT_CONFIGURED',
        'AI provider is not configured. Set BHARATCODE_API_KEY environment variable.'
      );
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.1,
          max_tokens: maxTokens,
        }),
      });
    } catch {
      throw new AIExtractionError(
        'AI_PROVIDER_ERROR',
        'AI provider request failed'
      );
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new AIExtractionError('AI_PROVIDER_ERROR', `AI provider error (${response.status})`);
    }

    let data: { choices?: Array<{ message?: { content?: string } }> };
    try {
      data = (await response.json()) as typeof data;
    } catch {
      throw new AIExtractionError('AI_PROVIDER_ERROR', 'AI provider response was not valid JSON');
    }

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new AIExtractionError('AI_EMPTY_RESPONSE', 'AI provider returned empty response');
    }
    return content;
  }

  async extractProfile(input: AIExtractProfileInput): Promise<ResumeExtraction> {
    if (!this.isConfigured()) {
      throw new AIExtractionError(
        'AI_NOT_CONFIGURED',
        'AI extraction is not configured. Set BHARATCODE_API_KEY environment variable.'
      );
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a precise resume extraction assistant. Return only valid JSON.',
            },
            {
              role: 'user',
              content: EXTRACTION_PROMPT + input.resumeText,
            },
          ],
          temperature: 0.1,
          max_tokens: 4000,
        }),
      });
    } catch (err) {
      throw new AIExtractionError(
        'AI_PROVIDER_ERROR',
        err instanceof Error ? 'AI provider request failed' : 'AI provider request failed'
      );
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new AIExtractionError('AI_PROVIDER_ERROR', `AI provider error (${response.status})`);
    }

    let data: { choices?: Array<{ message?: { content?: string } }> };
    try {
      data = (await response.json()) as typeof data;
    } catch {
      throw new AIExtractionError('AI_PROVIDER_ERROR', 'AI provider response was not valid JSON');
    }

    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new AIExtractionError('AI_EMPTY_RESPONSE', 'AI provider returned empty response');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new AIExtractionError('AI_INVALID_JSON', 'AI response does not contain valid JSON');
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      throw new AIExtractionError('AI_INVALID_JSON', 'AI response does not contain valid JSON');
    }

    const validated = resumeExtractionSchema.safeParse(parsed);

    if (!validated.success) {
      throw new AIExtractionError(
        'AI_INVALID_RESPONSE',
        'AI response validation failed'
      );
    }

    return validated.data;
  }
}
