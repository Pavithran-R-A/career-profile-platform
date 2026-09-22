import { describe, it, expect, vi, beforeEach } from "vitest";

type GetAvailableModelsFn = typeof import("../../lib/ai/catalog").getAvailableModels;
type AssertModelAvailableFn = typeof import("../../lib/ai/catalog").assertModelAvailable;

let getAvailableModels: GetAvailableModelsFn;
let assertModelAvailable: AssertModelAvailableFn;

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  const mod = await import("../../lib/ai/catalog");
  getAvailableModels = mod.getAvailableModels;
  assertModelAvailable = mod.assertModelAvailable;
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

  it('returns fallback when no API key', async () => {
    delete process.env.BHARATCODE_API_KEY;
    const models = await getAvailableModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].id).toBe('deepseek-v4.1-flash');
  });

  it('returns fallback on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    process.env.BHARATCODE_API_KEY = 'test-key';
    const models = await getAvailableModels();
    expect(models.length).toBeGreaterThan(0);
  });

  it('returns fallback on non-200 response', async () => {
    mockFetch({ error: 'unauthorized' }, 401);
    process.env.BHARATCODE_API_KEY = 'test-key';
    const models = await getAvailableModels();
    expect(models.length).toBeGreaterThan(0);
  });

  it('returns fallback on invalid schema', async () => {
    mockFetch({ models: 'not-an-array' });
    process.env.BHARATCODE_API_KEY = 'test-key';
    const models = await getAvailableModels();
    expect(models.length).toBeGreaterThan(0);
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

  it('throws when model not found', async () => {
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
    await expect(assertModelAvailable('nonexistent')).rejects.toThrow(
      'Model "nonexistent" is not available'
    );
  });
});
