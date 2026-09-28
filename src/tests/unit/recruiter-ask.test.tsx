import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import RecruiterAsk from '../../components/RecruiterAsk';
import type * as AskModule from '../../lib/recruiter/ask';
import { askRecruiterQuestion, RecruiterAskError, sectionLabel } from '../../lib/recruiter/ask';

// ─── ask client ─────────────────────────────────────────────────

function okResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('askRecruiterQuestion', () => {
  afterEach(() => vi.restoreAllMocks());

  it('posts username + question and returns grounded answer with sections', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        okResponse({ answer: 'They built CLI tools.', grounded: true, sections: ['projects'] })
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await askRecruiterQuestion('ada', 'What did they build?');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/recruiter/ask',
      expect.objectContaining({ method: 'POST' })
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      username: 'ada',
      question: 'What did they build?',
    });
    expect(result.answer).toBe('They built CLI tools.');
    expect(result.sections).toEqual(['projects']);
  });

  it('maps rate limiting to a retryable error with retry-after', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Too many questions.', code: 'RATE_LIMITED' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'retry-after': '30' },
        })
      )
    );
    const err = await askRecruiterQuestion('ada', 'x').catch((e) => e);
    expect(err).toBeInstanceOf(RecruiterAskError);
    expect((err as RecruiterAskError).code).toBe('RATE_LIMITED');
    expect((err as RecruiterAskError).retryAfterSeconds).toBe(30);
  });

  it('maps AI_NOT_CONFIGURED to a truthful unavailable error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: 'Recruiter AI is not configured', code: 'AI_NOT_CONFIGURED' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          )
        )
    );
    const err = await askRecruiterQuestion('ada', 'x').catch((e) => e);
    expect((err as RecruiterAskError).code).toBe('AI_NOT_CONFIGURED');
  });

  it('maps a code-less error body to UNKNOWN', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Unexpected gateway error' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    const err = await askRecruiterQuestion('ada', 'x').catch((e) => e);
    expect((err as RecruiterAskError).code).toBe('UNKNOWN');
  });

  it('survives a network failure without throwing a raw error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')));
    const err = await askRecruiterQuestion('ada', 'x').catch((e) => e);
    expect((err as RecruiterAskError).code).toBe('NETWORK');
  });
});

describe('sectionLabel', () => {
  it('labels known sections and passes unknown keys through', () => {
    expect(sectionLabel('evidence')).toBe('Public evidence');
    expect(sectionLabel('basics')).toBe('About');
    expect(sectionLabel('mystery')).toBe('mystery');
  });
});

// ─── RecruiterAsk component ─────────────────────────────────────

vi.mock('../../lib/recruiter/ask', async (importOriginal) => {
  const actual = await importOriginal<typeof AskModule>();
  return {
    ...actual,
    fetchRecruiterConfig: vi.fn(),
  };
});

import { fetchRecruiterConfig } from '../../lib/recruiter/ask';

const mockConfig = vi.mocked(fetchRecruiterConfig);

describe('RecruiterAsk component', () => {
  beforeEach(() => {
    mockConfig.mockResolvedValue({ enabled: true, aiConfigured: true, maxQuestionChars: 400 });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders nothing while the deployment has the assistant disabled', async () => {
    mockConfig.mockResolvedValue({ enabled: false, aiConfigured: false, maxQuestionChars: 400 });
    const { container } = render(<RecruiterAsk username="ada" />);
    await waitFor(() => expect(mockConfig).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it('shows suggested questions, accepts one, and cites the sections used', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okResponse({
          answer: 'Strongest for backend roles.',
          grounded: true,
          sections: ['experience', 'skills'],
        })
      )
    );
    render(<RecruiterAsk username="ada" />);

    const suggestion = await screen.findByRole('button', {
      name: /strongest for/i,
    });
    fireEvent.click(suggestion);

    expect(await screen.findByText('Strongest for backend roles.')).toBeInTheDocument();
    expect(screen.getByText('Based on')).toBeInTheDocument();
    expect(screen.getByText('Experience')).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();
    // Citation honesty statement present.
    expect(screen.getByText(/anything not in the profile is not answered/i)).toBeInTheDocument();
  });

  it('shows the truthful unavailable state when the AI key is missing', async () => {
    mockConfig.mockResolvedValue({ enabled: true, aiConfigured: false, maxQuestionChars: 400 });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: 'Recruiter AI is not configured', code: 'AI_NOT_CONFIGURED' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          )
        )
    );
    render(<RecruiterAsk username="ada" />);
    const input = await screen.findByLabelText(/your question about this profile/i);
    fireEvent.change(input, { target: { value: 'Hello?' } });
    fireEvent.click(screen.getByRole('button', { name: /^ask$/i }));

    expect(
      await screen.findByText(/assistant is not available on this deployment/i)
    ).toBeInTheDocument();
  });

  it('translates rate limiting into human copy with the retry hint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Too many questions.', code: 'RATE_LIMITED' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'retry-after': '20' },
        })
      )
    );
    render(<RecruiterAsk username="ada" />);
    const input = await screen.findByLabelText(/your question about this profile/i);
    fireEvent.change(input, { target: { value: 'Hello?' } });
    fireEvent.click(screen.getByRole('button', { name: /^ask$/i }));

    expect(await screen.findByText(/too many questions/i)).toBeInTheDocument();
    expect(await screen.findByText(/20s/i)).toBeInTheDocument();
  });

  it('blocks questions above the configured character limit', async () => {
    render(<RecruiterAsk username="ada" />);
    const input = await screen.findByLabelText(/your question about this profile/i);
    fireEvent.change(input, { target: { value: 'x'.repeat(401) } });
    expect(screen.getByRole('button', { name: /^ask$/i })).toBeDisabled();
  });
});
