import { describe, it, expect } from 'vitest';
import {
  buildProfileBrief,
  buildRecruiterMessages,
  sanitizeRecruiterAnswer,
  validateRecruiterQuestion,
  nonEmptySections,
  MAX_RECRUITER_BRIEF_CHARS,
  MAX_RECRUITER_ANSWER_CHARS,
  MAX_RECRUITER_QUESTION_CHARS,
  type RecruiterProfileData,
} from '../../lib/ai/recruiter';

const profile: RecruiterProfileData = {
  display_name: 'Ada Lovelace',
  headline: 'Engineer',
  about: 'Notes on computation.',
  location: 'London',
  experiences: [
    {
      company: 'Analytical Engines Ltd',
      role: 'Software Engineer',
      location: 'London',
      start_year: 2021,
      end_year: null,
      is_current: true,
      description: 'Built computation pipelines.',
    },
  ],
  education: [{ institution: 'University of London', degree: 'BSc', start_year: 2017, end_year: 2020 }],
  projects: [{ name: 'Difference Engine CLI', project_url: 'https://github.com/ada/cli' }],
  skills: [{ name: 'TypeScript' }, { name: 'Rust' }],
  links: [{ label: 'LinkedIn', url: 'https://linkedin.com/in/ada' }],
  evidence: [
    {
      evidence_type: 'commit',
      subject: 'fix: parser edge case',
      repository_full_name: 'ada/cli',
      repository_url: 'https://github.com/ada/cli',
      repository_language: 'Rust',
    },
  ],
};

describe('validateRecruiterQuestion', () => {
  it('trims and accepts in-range questions', () => {
    expect(validateRecruiterQuestion('  What did you build? ')).toEqual({
      ok: true,
      question: 'What did you build?',
    });
  });

  it('rejects empty, non-string and over-length questions', () => {
    expect(validateRecruiterQuestion('   ')).toEqual({ ok: false });
    expect(validateRecruiterQuestion(null)).toEqual({ ok: false });
    expect(validateRecruiterQuestion(42)).toEqual({ ok: false });
    expect(validateRecruiterQuestion('x'.repeat(MAX_RECRUITER_QUESTION_CHARS + 1))).toEqual({
      ok: false,
    });
    expect(validateRecruiterQuestion('x'.repeat(MAX_RECRUITER_QUESTION_CHARS)).ok).toBe(true);
  });
});

describe('buildProfileBrief', () => {
  it('renders every non-empty section in stable order', () => {
    const brief = buildProfileBrief(profile);
    expect(brief).toContain('Name: Ada Lovelace');
    expect(brief).toContain('Experience:');
    expect(brief).toContain('Analytical Engines Ltd — Software Engineer (London), 2021–present');
    expect(brief).toContain('Education:');
    expect(brief).toContain('Projects:');
    expect(brief).toContain('Skills: TypeScript, Rust');
    expect(brief).toContain('Links: LinkedIn https://linkedin.com/in/ada');
    expect(brief).toContain('Public evidence (verified source records):');
    expect(brief).toContain('[commit] fix: parser edge case (ada/cli, Rust)');
  });

  it('omits empty sections entirely', () => {
    const brief = buildProfileBrief({
      display_name: 'Ada',
      headline: null,
      about: null,
      location: null,
      experiences: [],
      education: [],
      projects: [],
      skills: [],
      links: [],
      evidence: [],
    });
    expect(brief).not.toContain('Experience:');
    expect(brief).not.toContain('Education:');
    expect(brief).not.toContain('Public evidence');
  });

  it('hard-caps the brief so prompt injection via a huge profile is bounded', () => {
    const huge: RecruiterProfileData = {
      ...profile,
      about: 'word '.repeat(5000),
      skills: Array.from({ length: 300 }, (_, i) => ({ name: `skill-${i}` })),
    };
    const brief = buildProfileBrief(huge);
    expect(brief.length).toBeLessThanOrEqual(MAX_RECRUITER_BRIEF_CHARS + 64);
    expect(brief).toContain('[profile data truncated]');
  });
});

describe('buildRecruiterMessages', () => {
  it('separates the grounded system prompt from the profile data + question', () => {
    const messages = buildRecruiterMessages(buildProfileBrief(profile), 'What did you build?');
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('STRICT GROUNDING RULES');
    expect(messages[0].content).toContain('not in this profile');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('PROFILE DATA:');
    expect(messages[1].content).toContain('QUESTION:');
    expect(messages[1].content).toContain('What did you build?');
  });
});

describe('sanitizeRecruiterAnswer', () => {
  it('collapses whitespace and trims', () => {
    expect(sanitizeRecruiterAnswer('  Hello\n\nworld  ')).toBe('Hello world');
  });

  it('strips prompt fragments and markdown the model might leak', () => {
    const dirty =
      'Answer. ```json\n{"x":1}\n```\nSTRICT GROUNDING RULES:\n1. do not invent things';
    const clean = sanitizeRecruiterAnswer(dirty);
    expect(clean).not.toContain('STRICT GROUNDING');
    expect(clean).not.toContain('```');
    expect(clean.startsWith('Answer.')).toBe(true);
  });

  it('caps the answer length at a word boundary', () => {
    const long = sanitizeRecruiterAnswer(`w `.repeat(MAX_RECRUITER_ANSWER_CHARS));
    expect(long.length).toBeLessThanOrEqual(MAX_RECRUITER_ANSWER_CHARS);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('nonEmptySections', () => {
  it('lists only sections that actually have content', () => {
    expect(nonEmptySections(profile)).toEqual([
      'basics',
      'experience',
      'education',
      'projects',
      'skills',
      'links',
      'evidence',
    ]);
    expect(
      nonEmptySections({ ...profile, display_name: null, about: null, headline: null, location: null })
    ).not.toContain('basics');
  });
});
