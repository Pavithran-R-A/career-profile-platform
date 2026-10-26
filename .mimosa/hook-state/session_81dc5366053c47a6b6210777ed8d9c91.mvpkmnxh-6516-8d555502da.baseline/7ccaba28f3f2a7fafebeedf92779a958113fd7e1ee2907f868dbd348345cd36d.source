import { describe, it, expect } from 'vitest';

// ─── Requirement Matcher Types ────────────────────────────────

interface JobRequirement {
  id: string;
  text: string;
  category: 'must_have' | 'nice_to_have' | 'preferred';
}

interface ProfileSkills {
  skills: string[];
  experienceText: string[];
  educationText: string[];
}

interface MatchResult {
  requirementId: string;
  matched: boolean;
  confidence: number;
  matchedFrom: string;
  matchedTerm: string;
}

// ─── Requirement Matcher Logic ────────────────────────────────

function matchRequirement(requirement: JobRequirement, profile: ProfileSkills): MatchResult {
  const lowerReq = requirement.text.toLowerCase();
  let matched = false;
  let confidence = 0;
  let matchedFrom = '';
  let matchedTerm = '';

  for (const skill of profile.skills) {
    const lowerSkill = skill.toLowerCase();
    if (lowerReq.includes(lowerSkill) || lowerSkill.includes(lowerReq)) {
      matched = true;
      confidence = 0.95;
      matchedFrom = 'skill';
      matchedTerm = skill;
      return { requirementId: requirement.id, matched, confidence, matchedFrom, matchedTerm };
    }
  }

  const reqWords = lowerReq.split(/\s+/).filter((w) => w.length > 3);
  for (const word of reqWords) {
    for (const expText of profile.experienceText) {
      if (expText.toLowerCase().includes(word)) {
        matched = true;
        confidence = 0.6;
        matchedFrom = 'experience';
        matchedTerm = word;
        return { requirementId: requirement.id, matched, confidence, matchedFrom, matchedTerm };
      }
    }
    for (const eduText of profile.educationText) {
      if (eduText.toLowerCase().includes(word)) {
        matched = true;
        confidence = 0.5;
        matchedFrom = 'education';
        matchedTerm = word;
        return { requirementId: requirement.id, matched, confidence, matchedFrom, matchedTerm };
      }
    }
  }

  return {
    requirementId: requirement.id,
    matched: false,
    confidence: 0,
    matchedFrom: '',
    matchedTerm: '',
  };
}

function matchAllRequirements(
  requirements: JobRequirement[],
  profile: ProfileSkills
): MatchResult[] {
  return requirements.map((req) => matchRequirement(req, profile));
}

function computeMatchScore(results: MatchResult[]): number {
  if (results.length === 0) return 0;
  const matched = results.filter((r) => r.matched).length;
  return Math.round((matched / results.length) * 100);
}

function categorizeResults(
  requirements: JobRequirement[],
  results: MatchResult[]
): {
  matched: { requirement: JobRequirement; result: MatchResult }[];
  unmatched: { requirement: JobRequirement; result: MatchResult }[];
} {
  const matched: { requirement: JobRequirement; result: MatchResult }[] = [];
  const unmatched: { requirement: JobRequirement; result: MatchResult }[] = [];

  for (let i = 0; i < requirements.length; i++) {
    const pair = { requirement: requirements[i], result: results[i] };
    if (results[i].matched) {
      matched.push(pair);
    } else {
      unmatched.push(pair);
    }
  }

  return { matched, unmatched };
}

function rankByConfidence(results: MatchResult[]): MatchResult[] {
  return [...results].sort((a, b) => b.confidence - a.confidence);
}

function getUnmatchedSkills(requirements: JobRequirement[], results: MatchResult[]): string[] {
  return requirements
    .filter((req, i) => !results[i].matched && req.category === 'must_have')
    .map((req) => req.text);
}

// ─── Test Fixtures ────────────────────────────────────────────

const sampleProfile: ProfileSkills = {
  skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS'],
  experienceText: [
    'Senior Software Engineer at TechCo building distributed systems',
    'Full Stack Developer at StartupInc developing web applications with React and Node.js',
  ],
  educationText: ['B.S. Computer Science at MIT', 'M.S. Software Engineering at Stanford'],
};

const sampleRequirements: JobRequirement[] = [
  { id: 'r1', text: 'TypeScript and React experience', category: 'must_have' },
  { id: 'r2', text: 'Experience with distributed systems', category: 'must_have' },
  { id: 'r3', text: 'Knowledge of PostgreSQL', category: 'must_have' },
  { id: 'r4', text: 'Kubernetes container orchestration', category: 'nice_to_have' },
  { id: 'r5', text: 'CS degree from top university', category: 'nice_to_have' },
  { id: 'r6', text: 'Machine learning experience', category: 'preferred' },
];

// ─── Tests ────────────────────────────────────────────────────

describe('Requirement Matcher - matchRequirement', () => {
  it('matches a skill requirement with exact skill match', () => {
    const req: JobRequirement = { id: 'r1', text: 'TypeScript', category: 'must_have' };
    const result = matchRequirement(req, sampleProfile);
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe(0.95);
    expect(result.matchedFrom).toBe('skill');
    expect(result.matchedTerm).toBe('TypeScript');
  });

  it('matches a requirement with partial skill overlap', () => {
    const req: JobRequirement = { id: 'r1', text: 'React and Node.js', category: 'must_have' };
    const result = matchRequirement(req, sampleProfile);
    expect(result.matched).toBe(true);
    expect(result.matchedFrom).toBe('skill');
  });

  it('matches distributed systems from experience', () => {
    const req: JobRequirement = {
      id: 'r2',
      text: 'Experience with distributed systems',
      category: 'must_have',
    };
    const result = matchRequirement(req, sampleProfile);
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe(0.6);
    expect(result.matchedFrom).toBe('experience');
  });

  it('matches CS degree from education', () => {
    const req: JobRequirement = {
      id: 'r5',
      text: 'Computer Science degree',
      category: 'nice_to_have',
    };
    const result = matchRequirement(req, sampleProfile);
    expect(result.matched).toBe(true);
    expect(result.matchedFrom).toBe('education');
  });

  it('does not match Kubernetes (not in profile)', () => {
    const req: JobRequirement = {
      id: 'r4',
      text: 'Kubernetes container orchestration',
      category: 'nice_to_have',
    };
    const result = matchRequirement(req, sampleProfile);
    expect(result.matched).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('does not match machine learning (not in profile)', () => {
    const req: JobRequirement = {
      id: 'r6',
      text: 'Machine learning experience',
      category: 'preferred',
    };
    const result = matchRequirement(req, sampleProfile);
    expect(result.matched).toBe(false);
  });

  it('returns correct requirementId', () => {
    const req: JobRequirement = { id: 'custom-id', text: 'Docker', category: 'must_have' };
    const result = matchRequirement(req, sampleProfile);
    expect(result.requirementId).toBe('custom-id');
  });
});

describe('Requirement Matcher - matchAllRequirements', () => {
  it('returns results for all requirements', () => {
    const results = matchAllRequirements(sampleRequirements, sampleProfile);
    expect(results).toHaveLength(sampleRequirements.length);
  });

  it('matches skills that are in profile', () => {
    const results = matchAllRequirements(sampleRequirements, sampleProfile);
    const typeScriptResult = results.find((r) => r.requirementId === 'r1');
    expect(typeScriptResult?.matched).toBe(true);
  });

  it('does not match skills not in profile', () => {
    const results = matchAllRequirements(sampleRequirements, sampleProfile);
    const k8sResult = results.find((r) => r.requirementId === 'r4');
    expect(k8sResult?.matched).toBe(false);
  });
});

describe('Requirement Matcher - computeMatchScore', () => {
  it('computes correct match percentage', () => {
    const results: MatchResult[] = [
      { requirementId: '1', matched: true, confidence: 0.9, matchedFrom: 'skill', matchedTerm: '' },
      { requirementId: '2', matched: true, confidence: 0.6, matchedFrom: 'exp', matchedTerm: '' },
      { requirementId: '3', matched: false, confidence: 0, matchedFrom: '', matchedTerm: '' },
    ];
    expect(computeMatchScore(results)).toBe(67);
  });

  it('returns 100 when all match', () => {
    const results: MatchResult[] = [
      { requirementId: '1', matched: true, confidence: 0.9, matchedFrom: 'skill', matchedTerm: '' },
      { requirementId: '2', matched: true, confidence: 0.8, matchedFrom: 'skill', matchedTerm: '' },
    ];
    expect(computeMatchScore(results)).toBe(100);
  });

  it('returns 0 when none match', () => {
    const results: MatchResult[] = [
      { requirementId: '1', matched: false, confidence: 0, matchedFrom: '', matchedTerm: '' },
    ];
    expect(computeMatchScore(results)).toBe(0);
  });

  it('returns 0 for empty results', () => {
    expect(computeMatchScore([])).toBe(0);
  });
});

describe('Requirement Matcher - categorizeResults', () => {
  it('separates matched and unmatched requirements', () => {
    const results = matchAllRequirements(sampleRequirements, sampleProfile);
    const { matched, unmatched } = categorizeResults(sampleRequirements, results);
    expect(matched.length + unmatched.length).toBe(sampleRequirements.length);
    expect(matched.length).toBeGreaterThan(0);
  });

  it('matched results have matched: true', () => {
    const results = matchAllRequirements(sampleRequirements, sampleProfile);
    const { matched } = categorizeResults(sampleRequirements, results);
    for (const m of matched) {
      expect(m.result.matched).toBe(true);
    }
  });

  it('unmatched results have matched: false', () => {
    const results = matchAllRequirements(sampleRequirements, sampleProfile);
    const { unmatched } = categorizeResults(sampleRequirements, results);
    for (const u of unmatched) {
      expect(u.result.matched).toBe(false);
    }
  });
});

describe('Requirement Matcher - rankByConfidence', () => {
  it('sorts results by confidence descending', () => {
    const results: MatchResult[] = [
      { requirementId: '1', matched: true, confidence: 0.5, matchedFrom: 'edu', matchedTerm: '' },
      {
        requirementId: '2',
        matched: true,
        confidence: 0.95,
        matchedFrom: 'skill',
        matchedTerm: '',
      },
      { requirementId: '3', matched: true, confidence: 0.6, matchedFrom: 'exp', matchedTerm: '' },
    ];
    const ranked = rankByConfidence(results);
    expect(ranked[0].confidence).toBe(0.95);
    expect(ranked[1].confidence).toBe(0.6);
    expect(ranked[2].confidence).toBe(0.5);
  });

  it('returns empty array for empty input', () => {
    expect(rankByConfidence([])).toEqual([]);
  });

  it('does not mutate original array', () => {
    const results: MatchResult[] = [
      { requirementId: '1', matched: true, confidence: 0.5, matchedFrom: '', matchedTerm: '' },
      { requirementId: '2', matched: true, confidence: 0.9, matchedFrom: '', matchedTerm: '' },
    ];
    const original = [...results];
    rankByConfidence(results);
    expect(results).toEqual(original);
  });
});

describe('Requirement Matcher - getUnmatchedSkills', () => {
  it('returns unmatched must-have requirement texts', () => {
    const results = matchAllRequirements(sampleRequirements, sampleProfile);
    const unmatched = getUnmatchedSkills(sampleRequirements, results);
    expect(unmatched.length).toBeGreaterThanOrEqual(0);
    for (const text of unmatched) {
      const req = sampleRequirements.find((r) => r.text === text);
      expect(req?.category).toBe('must_have');
    }
  });

  it('excludes nice-to-have and preferred from unmatched', () => {
    const results = matchAllRequirements(sampleRequirements, sampleProfile);
    const unmatched = getUnmatchedSkills(sampleRequirements, results);
    for (const text of unmatched) {
      const req = sampleRequirements.find((r) => r.text === text);
      expect(req?.category).not.toBe('nice_to_have');
      expect(req?.category).not.toBe('preferred');
    }
  });

  it('returns empty when all must-haves match', () => {
    const requirements: JobRequirement[] = [{ id: '1', text: 'TypeScript', category: 'must_have' }];
    const results = matchAllRequirements(requirements, sampleProfile);
    const unmatched = getUnmatchedSkills(requirements, results);
    expect(unmatched).toHaveLength(0);
  });
});
