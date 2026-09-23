import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  getAvailableModels as GetAvailableModelsType,
  assertModelAvailable as AssertModelAvailableType,
  AIModelUnavailableError as AIModelUnavailableErrorType,
} from '../../lib/ai/catalog';

let getAvailableModels: typeof GetAvailableModelsType;
let assertModelAvailable: typeof AssertModelAvailableType;
let AIModelUnavailableError: typeof AIModelUnavailableErrorType;

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status }))
  );
}

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.BHARATCODE_API_KEY;
  delete process.env.BHARATCODE_BASE_URL;
  vi.resetModules();
  const mod = await import('../../lib/ai/catalog');
  getAvailableModels = mod.getAvailableModels;
  assertModelAvailable = mod.assertModelAvailable;
  AIModelUnavailableError = mod.AIModelUnavailableError;
});

describe('getAvailableModels', () => {
  it('returns models from remote API', async () => {
    mockFetch({
      models: [
        {
          id: 'test-model',
          name: 'Test Model',
          maxTokens: 4096,
          contextWindow: 32000,
          inputCostPer1k: 0.01,
          outputCostPer1k: 0.02,
          capabilities: ['chat'],
        },
      ],
    });

    process.env.BHARATCODE_API_KEY = 'test-key';
    const models = await getAvailableModels();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('test-model');
  });

  it('throws AI_MODEL_UNAVAILABLE when no API key', async () => {
    delete process.env.BHARATCODE_API_KEY;
    await expect(getAvailableModels()).rejects.toMatchObject({
      code: 'AI_MODEL_UNAVAILABLE',
    });
  });

  it('throws AI_MODEL_UNAVAILABLE on fetch error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network');
      })
    );
    process.env.BHARATCODE_API_KEY = 'test-key';
    await expect(getAvailableModels()).rejects.toMatchObject({
      code: 'AI_MODEL_UNAVAILABLE',
    });
  });

  it('throws AI_MODEL_UNAVAILABLE on non-200 response', async () => {
    mockFetch({ error: 'unauthorized' }, 401);
    process.env.BHARATCODE_API_KEY = 'test-key';
    await expect(getAvailableModels()).rejects.toMatchObject({
      code: 'AI_MODEL_UNAVAILABLE',
    });
  });

  it('throws AI_MODEL_UNAVAILABLE on invalid schema', async () => {
    mockFetch({ models: 'not-an-array' });
    process.env.BHARATCODE_API_KEY = 'test-key';
    await expect(getAvailableModels()).rejects.toMatchObject({
      code: 'AI_MODEL_UNAVAILABLE',
    });
  });

  it('does not substitute a fallback model list', async () => {
    delete process.env.BHARATCODE_API_KEY;
    await expect(getAvailableModels()).rejects.toBeInstanceOf(AIModelUnavailableError);
  });
});

describe('assertModelAvailable', () => {
  it('returns model when found', async () => {
    mockFetch({
      models: [
        {
          id: 'deepseek-v4.1-flash',
          name: 'DeepSeek V4.1 Flash',
          maxTokens: 8192,
          contextWindow: 128000,
          inputCostPer1k: 0,
          outputCostPer1k: 0,
          capabilities: ['chat'],
        },
      ],
    });
    process.env.BHARATCODE_API_KEY = 'test-key';
    const model = await assertModelAvailable('deepseek-v4.1-flash');
    expect(model.id).toBe('deepseek-v4.1-flash');
  });

  it('throws AI_MODEL_UNAVAILABLE when model not found', async () => {
    mockFetch({
      models: [
        {
          id: 'other-model',
          name: 'Other',
          maxTokens: 4096,
          contextWindow: 32000,
          inputCostPer1k: 0.01,
          outputCostPer1k: 0.02,
          capabilities: ['chat'],
        },
      ],
    });
    process.env.BHARATCODE_API_KEY = 'test-key';
    await expect(assertModelAvailable('nonexistent')).rejects.toMatchObject({
      code: 'AI_MODEL_UNAVAILABLE',
    });
  });

  it('throws AI_MODEL_UNAVAILABLE when catalog unavailable', async () => {
    delete process.env.BHARATCODE_API_KEY;
    await expect(assertModelAvailable('deepseek-v4.1-flash')).rejects.toMatchObject({
      code: 'AI_MODEL_UNAVAILABLE',
    });
  });
});
