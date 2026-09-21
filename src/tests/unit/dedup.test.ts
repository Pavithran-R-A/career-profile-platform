import { describe, it, expect } from 'vitest';

interface DedupSkill {
  name: string;
  evidenceCount: number;
}

interface DedupLink {
  label: string;
  url: string;
}

function dedupSkills(skills: DedupSkill[]): DedupSkill[] {
  const seen = new Map<string, DedupSkill>();
  for (const skill of skills) {
    const key = skill.name.trim().toLowerCase();
    const existing = seen.get(key);
    if (existing) {
      existing.evidenceCount += skill.evidenceCount;
    } else {
      seen.set(key, { ...skill, name: skill.name.trim() });
    }
  }
  return Array.from(seen.values());
}

function dedupLinks(links: DedupLink[]): DedupLink[] {
  const seen = new Set<string>();
  const result: DedupLink[] = [];
  for (const link of links) {
    const key = link.url.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(link);
    }
  }
  return result;
}

describe('Skill deduplication', () => {
  it('deduplicates skills by name (case-insensitive)', () => {
    const skills: DedupSkill[] = [
      { name: 'TypeScript', evidenceCount: 2 },
      { name: 'typescript', evidenceCount: 1 },
      { name: 'TYPESCRIPT', evidenceCount: 3 },
    ];
    const result = dedupSkills(skills);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('TypeScript');
    expect(result[0].evidenceCount).toBe(6);
  });

  it('preserves distinct skills', () => {
    const skills: DedupSkill[] = [
      { name: 'TypeScript', evidenceCount: 1 },
      { name: 'Python', evidenceCount: 2 },
    ];
    const result = dedupSkills(skills);
    expect(result).toHaveLength(2);
  });

  it('trims whitespace from skill names', () => {
    const skills: DedupSkill[] = [{ name: '  React  ', evidenceCount: 1 }];
    const result = dedupSkills(skills);
    expect(result[0].name).toBe('React');
  });

  it('handles empty array', () => {
    expect(dedupSkills([])).toEqual([]);
  });

  it('handles single skill', () => {
    const result = dedupSkills([{ name: 'Go', evidenceCount: 5 }]);
    expect(result).toHaveLength(1);
    expect(result[0].evidenceCount).toBe(5);
  });
});

describe('Link deduplication', () => {
  it('deduplicates links by URL', () => {
    const links: DedupLink[] = [
      { label: 'GitHub', url: 'https://github.com/alice' },
      { label: 'My GitHub', url: 'https://github.com/alice' },
    ];
    const result = dedupLinks(links);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('GitHub');
  });

  it('deduplicates links by URL case-insensitively', () => {
    const links: DedupLink[] = [
      { label: 'GitHub', url: 'https://GitHub.com/Alice' },
      { label: 'GitHub2', url: 'https://github.com/alice' },
    ];
    const result = dedupLinks(links);
    expect(result).toHaveLength(1);
  });

  it('preserves distinct links', () => {
    const links: DedupLink[] = [
      { label: 'GitHub', url: 'https://github.com/alice' },
      { label: 'LinkedIn', url: 'https://linkedin.com/in/alice' },
    ];
    const result = dedupLinks(links);
    expect(result).toHaveLength(2);
  });

  it('handles empty array', () => {
    expect(dedupLinks([])).toEqual([]);
  });

  it('handles single link', () => {
    const result = dedupLinks([{ label: 'Blog', url: 'https://alice.dev' }]);
    expect(result).toHaveLength(1);
  });

  it('keeps first occurrence when URLs match', () => {
    const links: DedupLink[] = [
      { label: 'First', url: 'https://example.com' },
      { label: 'Second', url: 'https://example.com' },
    ];
    const result = dedupLinks(links);
    expect(result[0].label).toBe('First');
  });
});
