import type { AIProvider, AIExtractProfileInput, ResumeExtraction } from './provider';
import { resumeExtractionSchema } from './provider';

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

export class BharatCodeProvider implements AIProvider {
  readonly name = 'bharatcode';

  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.BHARATCODE_API_KEY || '';
    this.baseUrl = process.env.BHARATCODE_BASE_URL || 'https://bharatcode.ai/api/model/v1';
    this.model = process.env.BHARATCODE_MODEL || 'deepseek-v4.1-flash';
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async extractProfile(input: AIExtractProfileInput): Promise<ResumeExtraction> {
    if (!this.isConfigured()) {
      throw new Error('AI provider not configured. Set BHARATCODE_API_KEY environment variable.');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI provider error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('AI provider returned empty response');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI provider response does not contain valid JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const validated = resumeExtractionSchema.safeParse(parsed);

    if (!validated.success) {
      throw new Error(`AI response validation failed: ${validated.error.message}`);
    }

    return validated.data;
  }
}
