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

const CACHE_TTL_MS = 10 * 60 * 1000;

let cachedModels: ModelInfo[] | null = null;
let cachedModelsFetchedAt = 0;

export async function getAvailableModels(): Promise<ModelInfo[]> {
  const now = Date.now();
  if (cachedModels && now - cachedModelsFetchedAt < CACHE_TTL_MS) {
    return cachedModels;
  }

  const baseUrl = process.env.BHARATCODE_BASE_URL || 'https://bharatcode.ai/api/model/v1';
  const apiKey = process.env.BHARATCODE_API_KEY || '';

  if (!apiKey) {
    if (cachedModels) return cachedModels;
    return FALLBACK_MODELS;
  }

  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      if (cachedModels) return cachedModels;
      return FALLBACK_MODELS;
    }

    const raw = (await res.json()) as unknown;
    const parsed = modelsResponseSchema.safeParse(raw);

    if (!parsed.success) {
      if (cachedModels) return cachedModels;
      return FALLBACK_MODELS;
    }

    cachedModels = parsed.data.models;
    cachedModelsFetchedAt = now;
    return cachedModels;
  } catch {
    if (cachedModels) return cachedModels;
    return FALLBACK_MODELS;
  }
}

export async function assertModelAvailable(modelId: string): Promise<ModelInfo> {
  const models = await getAvailableModels();
  const found = models.find((m) => m.id === modelId);

  if (!found) {
    throw new Error(
      `Model "${modelId}" is not available. Available models: ${models.map((m) => m.id).join(', ')}`
    );
  }

  return found;
}

const FALLBACK_MODELS: ModelInfo[] = [
  {
    id: 'deepseek-v4.1-flash',
    name: 'DeepSeek V4.1 Flash',
    maxTokens: 8192,
    contextWindow: 128_000,
    inputCostPer1k: 0,
    outputCostPer1k: 0,
    capabilities: ['chat', 'extraction'],
  },
];
