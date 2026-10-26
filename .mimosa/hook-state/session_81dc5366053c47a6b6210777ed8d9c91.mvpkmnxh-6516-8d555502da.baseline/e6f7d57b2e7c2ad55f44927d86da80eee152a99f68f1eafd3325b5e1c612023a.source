import { z } from 'zod';

const modelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  maxTokens: z.number().int().positive(),
  contextWindow: z.number().int().positive(),
  inputCostPer1k: z.number().nonnegative(),
  outputCostPer1k: z.number().nonnegative(),
  capabilities: z.array(z.string()),
});

const modelsResponseSchema = z.object({
  models: z.array(modelSchema),
});

export type ModelInfo = z.infer<typeof modelSchema>;

export class AIModelUnavailableError extends Error {
  readonly code = 'AI_MODEL_UNAVAILABLE' as const;

  constructor(modelId?: string) {
    super(
      modelId ? `AI_MODEL_UNAVAILABLE: model "${modelId}" unavailable` : 'AI_MODEL_UNAVAILABLE'
    );
    this.name = 'AIModelUnavailableError';
  }
}

const CACHE_TTL_MS = 10 * 60 * 1000;

let cachedModels: ModelInfo[] | null = null;
let cachedModelsFetchedAt = 0;

export function _resetCatalogCache(): void {
  cachedModels = null;
  cachedModelsFetchedAt = 0;
}

export async function getAvailableModels(): Promise<ModelInfo[]> {
  const now = Date.now();
  if (cachedModels && now - cachedModelsFetchedAt < CACHE_TTL_MS) {
    return cachedModels;
  }

  const baseUrl = process.env.BHARATCODE_BASE_URL || 'https://bharatcode.ai/api/model/v1';
  const apiKey = process.env.BHARATCODE_API_KEY || '';

  if (!apiKey) {
    if (cachedModels) return cachedModels;
    throw new AIModelUnavailableError();
  }

  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      if (cachedModels) return cachedModels;
      throw new AIModelUnavailableError();
    }

    const raw = (await res.json()) as unknown;
    const parsed = modelsResponseSchema.safeParse(raw);

    if (!parsed.success) {
      if (cachedModels) return cachedModels;
      throw new AIModelUnavailableError();
    }

    cachedModels = parsed.data.models;
    cachedModelsFetchedAt = now;
    return cachedModels;
  } catch (err) {
    if (err instanceof AIModelUnavailableError) throw err;
    if (cachedModels) return cachedModels;
    throw new AIModelUnavailableError();
  }
}

export async function assertModelAvailable(modelId: string): Promise<ModelInfo> {
  let models: ModelInfo[];
  try {
    models = await getAvailableModels();
  } catch (err) {
    if (err instanceof AIModelUnavailableError) {
      throw new AIModelUnavailableError(modelId);
    }
    throw err;
  }

  const found = models.find((m) => m.id === modelId);

  if (!found) {
    throw new AIModelUnavailableError(modelId);
  }

  return found;
}
