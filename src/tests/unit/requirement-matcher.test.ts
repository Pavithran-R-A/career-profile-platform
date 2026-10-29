import { describe, it, expect } from 'vitest';
import { matchRequirements, MatchStrength } from '../../lib/resume/requirement-matcher';
import {
  JobRequirementCategory,
  JobRequirementPriority,
  type JobRequirement,
  type ParsedJob,
} from '../../lib/resume/job-parser';
import type { ProfileWithRelations } from '../../lib/profiles/repository';
import { makeTemplateProfileFixture } from './fixtures/template-profile';

// Behavioral tests against the SHIPPED matcher (audit 2026-10-27: the
// previous version of this file reimplemented the matcher locally and tested
// the copy — it stayed green no matter what the production module did).

const PROFILE: ProfileWithRelations = makeTemplateProfileFixture();

function requirement(
  text: string,
  category: JobRequirementCategory,
  priority: JobRequirementPriority = JobRequirementPriority.required
): JobRequirement {
  return {
    text,
    category,
    priority,
    keywords: [text.toLowerCase()],
    normalized: text.toLowerCase(),
  };
}

function parsedJob(...requirements: JobRequirement[]): ParsedJob {
  return {
    title: 'Engineer',
    company: null,
    location: null,
    remote: null,
    salaryRange: null,
    summary: null,
    requirements,
    rawText: requirements.map((r) => r.text).join('\n'),
    parsedAt: '2026-10-27T00:00:00.000Z',
  };
}

describe('matchRequirements (production module)', () => {
  it('matches a required skill the profile actually has, with evidence', () => {
    const result = matchRequirements(
      parsedJob(requirement('TypeScript', JobRequirementCategory.skill)),
      PROFILE
    );
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].strength).toBe(MatchStrength.exact);
    expect(result.matches[0].matchedEvidence.length).toBeGreaterThan(0);
    expect(result.summary.unmatched).toBe(0);
  });

  it('leaves a required skill the profile lacks as an unmatched gap', () => {
    const result = matchRequirements(
      parsedJob(requirement('Kubernetes cluster administration', JobRequirementCategory.skill)),
      PROFILE
    );
    expect(result.matches[0].strength).toBe(MatchStrength.none);
    expect(result.matches[0].matchedEvidence).toEqual([]);
    expect(result.gaps.map((g) => g.text)).toContain('Kubernetes cluster administration');
  });

  it('does NOT report preferred requirements as gaps when unmatched', () => {
    const result = matchRequirements(
      parsedJob(
        requirement('Kubernetes', JobRequirementCategory.skill, JobRequirementPriority.preferred)
      ),
      PROFILE
    );
    expect(result.matches[0].strength).toBe(MatchStrength.none);
    expect(result.gaps).toEqual([]);
    expect(result.summary.unmatched).toBe(1);
  });

  it('scores experience requirements against real profile tenure', () => {
    const result = matchRequirements(
      parsedJob(requirement('3+ years professional experience', JobRequirementCategory.experience)),
      PROFILE
    );
    // Fixture: Senior Developer since 2020, current — well over 3 years.
    expect(result.matches[0].strength).toBe(MatchStrength.exact);
    expect(result.matches[0].matchedEvidence.join(' ')).toMatch(/years/i);
  });

  it('matches education requirements from the profile education section', () => {
    const result = matchRequirements(
      parsedJob(requirement('Computer Science degree', JobRequirementCategory.education)),
      PROFILE
    );
    expect(result.matches[0].strength).not.toBe(MatchStrength.none);
    expect(result.matches[0].matchedEvidence.length).toBeGreaterThan(0);
  });

  it('classifies strengths into the shipped tiers', () => {
    const result = matchRequirements(
      parsedJob(
        requirement('TypeScript', JobRequirementCategory.skill),
        requirement('Kubernetes', JobRequirementCategory.skill),
        requirement('Rust systems programming', JobRequirementCategory.skill)
      ),
      PROFILE
    );
    const strengths = result.matches.map((m) => m.strength);
    expect(strengths).toContain(MatchStrength.exact);
    expect(strengths).toContain(MatchStrength.none);
    for (const s of strengths) {
      expect(Object.values(MatchStrength)).toContain(s);
    }
  });

  it('produces internally consistent summary counts', () => {
    const result = matchRequirements(
      parsedJob(
        requirement('TypeScript', JobRequirementCategory.skill),
        requirement('Kubernetes', JobRequirementCategory.skill, JobRequirementPriority.preferred),
        requirement('Computer Science degree', JobRequirementCategory.education)
      ),
      PROFILE
    );
    const { matched, partialMatched, unmatched, totalRequirements } = result.summary;
    expect(totalRequirements).toBe(3);
    expect(matched + partialMatched + unmatched).toBe(totalRequirements);
    const categoryTotal = Object.values(result.summary.byCategory).reduce(
      (sum, c) => sum + c.total,
      0
    );
    expect(categoryTotal).toBe(totalRequirements);
  });

  it('aggregates byCategory with matched <= total per category', () => {
    const result = matchRequirements(
      parsedJob(
        requirement('TypeScript', JobRequirementCategory.skill),
        requirement('React', JobRequirementCategory.skill),
        requirement('Computer Science degree', JobRequirementCategory.education)
      ),
      PROFILE
    );
    const skill = result.summary.byCategory[JobRequirementCategory.skill];
    expect(skill.total).toBe(2);
    expect(skill.matched).toBeLessThanOrEqual(skill.total);
    expect(result.summary.byCategory[JobRequirementCategory.education].total).toBe(1);
  });

  it('returns gap suggestions for unmatched requirements', () => {
    const result = matchRequirements(
      parsedJob(requirement('Kubernetes cluster administration', JobRequirementCategory.skill)),
      PROFILE
    );
    expect(result.matches[0].gapSuggestions.length).toBeGreaterThan(0);
  });

  it('handles an empty requirement list without throwing', () => {
    const result = matchRequirements(parsedJob(), PROFILE);
    expect(result.matches).toEqual([]);
    expect(result.gaps).toEqual([]);
    expect(result.summary.totalRequirements).toBe(0);
  });

  it('does not mutate the parsed job input', () => {
    const job = parsedJob(requirement('TypeScript', JobRequirementCategory.skill));
    const snapshot = JSON.parse(JSON.stringify(job)) as ParsedJob;
    matchRequirements(job, PROFILE);
    expect(job).toEqual(snapshot);
  });
});
