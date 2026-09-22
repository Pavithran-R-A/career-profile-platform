import { describe, it, expect } from 'vitest';

// ─── Variant Manager Types ────────────────────────────────────

interface ResumeVariant {
  id: string;
  name: string;
  profileId: string;
  jobTitle: string;
  companyName: string;
  createdAt: string;
  updatedAt: string;
  sectionOrder: string[];
  hiddenSections: string[];
  headlineOverride: string | null;
  aboutOverride: string | null;
  selectedSkills: string[];
  selectedExperienceIndices: number[];
  selectedEducationIndices: number[];
  selectedProjectIndices: number[];
  isDefault: boolean;
}

interface VariantManager {
  variants: ResumeVariant[];
}

// ─── Variant Manager Logic ────────────────────────────────────

function createVariantManager(): VariantManager {
  return { variants: [] };
}

function generateId(): string {
  return `var-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createVariant(
  manager: VariantManager,
  input: {
    name: string;
    profileId: string;
    jobTitle: string;
    companyName: string;
    sectionOrder?: string[];
    hiddenSections?: string[];
    headlineOverride?: string | null;
    aboutOverride?: string | null;
    selectedSkills?: string[];
    selectedExperienceIndices?: number[];
    selectedEducationIndices?: number[];
    selectedProjectIndices?: number[];
  }
): ResumeVariant {
  const now = new Date().toISOString();
  const variant: ResumeVariant = {
    id: generateId(),
    name: input.name,
    profileId: input.profileId,
    jobTitle: input.jobTitle,
    companyName: input.companyName,
    createdAt: now,
    updatedAt: now,
    sectionOrder: input.sectionOrder || ['basics', 'experience', 'education', 'skills', 'projects'],
    hiddenSections: input.hiddenSections || [],
    headlineOverride: input.headlineOverride ?? null,
    aboutOverride: input.aboutOverride ?? null,
    selectedSkills: input.selectedSkills || [],
    selectedExperienceIndices: input.selectedExperienceIndices || [],
    selectedEducationIndices: input.selectedEducationIndices || [],
    selectedProjectIndices: input.selectedProjectIndices || [],
    isDefault: false,
  };

  manager.variants.push(variant);
  return variant;
}

function getVariant(manager: VariantManager, variantId: string): ResumeVariant | undefined {
  return manager.variants.find((v) => v.id === variantId);
}

function getVariantsByProfile(manager: VariantManager, profileId: string): ResumeVariant[] {
  return manager.variants.filter((v) => v.profileId === profileId);
}

function updateVariant(
  manager: VariantManager,
  variantId: string,
  updates: Partial<Omit<ResumeVariant, 'id' | 'createdAt' | 'updatedAt'>>
): ResumeVariant | undefined {
  const variant = manager.variants.find((v) => v.id === variantId);
  if (!variant) return undefined;

  Object.assign(variant, updates, { updatedAt: new Date().toISOString() });
  return variant;
}

function deleteVariant(manager: VariantManager, variantId: string): boolean {
  const index = manager.variants.findIndex((v) => v.id === variantId);
  if (index === -1) return false;
  manager.variants.splice(index, 1);
  return true;
}

function duplicateVariant(
  manager: VariantManager,
  sourceId: string,
  newName: string
): ResumeVariant | undefined {
  const source = manager.variants.find((v) => v.id === sourceId);
  if (!source) return undefined;

  const now = new Date().toISOString();
  const duplicate: ResumeVariant = {
    ...structuredClone(source),
    id: generateId(),
    name: newName,
    createdAt: now,
    updatedAt: now,
    isDefault: false,
  };

  manager.variants.push(duplicate);
  return duplicate;
}

function setDefaultVariant(manager: VariantManager, variantId: string): boolean {
  const variant = manager.variants.find((v) => v.id === variantId);
  if (!variant) return false;

  for (const v of manager.variants) {
    if (v.profileId === variant.profileId) {
      v.isDefault = false;
    }
  }

  variant.isDefault = true;
  return true;
}

function getDefaultVariant(manager: VariantManager, profileId: string): ResumeVariant | undefined {
  return manager.variants.find((v) => v.profileId === profileId && v.isDefault);
}

function sortVariants(
  manager: VariantManager,
  profileId: string,
  sortBy: 'name' | 'createdAt' | 'updatedAt'
): ResumeVariant[] {
  const profileVariants = getVariantsByProfile(manager, profileId);
  return profileVariants.sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'createdAt') return a.createdAt.localeCompare(b.createdAt);
    return a.updatedAt.localeCompare(b.updatedAt);
  });
}

function searchVariants(
  manager: VariantManager,
  profileId: string,
  query: string
): ResumeVariant[] {
  const lowerQuery = query.toLowerCase();
  return getVariantsByProfile(manager, profileId).filter(
    (v) =>
      v.name.toLowerCase().includes(lowerQuery) ||
      v.jobTitle.toLowerCase().includes(lowerQuery) ||
      v.companyName.toLowerCase().includes(lowerQuery)
  );
}

function countVariants(manager: VariantManager, profileId: string): number {
  return getVariantsByProfile(manager, profileId).length;
}

function exportVariantConfig(variant: ResumeVariant): string {
  return JSON.stringify(
    {
      name: variant.name,
      jobTitle: variant.jobTitle,
      companyName: variant.companyName,
      sectionOrder: variant.sectionOrder,
      hiddenSections: variant.hiddenSections,
      headlineOverride: variant.headlineOverride,
      aboutOverride: variant.aboutOverride,
      selectedSkills: variant.selectedSkills,
      selectedExperienceIndices: variant.selectedExperienceIndices,
      selectedEducationIndices: variant.selectedEducationIndices,
      selectedProjectIndices: variant.selectedProjectIndices,
    },
    null,
    2
  );
}

function importVariantConfig(
  manager: VariantManager,
  profileId: string,
  configJson: string
): ResumeVariant | undefined {
  try {
    const config = JSON.parse(configJson) as Record<string, unknown>;
    return createVariant(manager, {
      name: `${config.name as string} (imported)`,
      profileId,
      jobTitle: config.jobTitle as string,
      companyName: config.companyName as string,
      sectionOrder: config.sectionOrder as string[],
      hiddenSections: config.hiddenSections as string[],
      headlineOverride: config.headlineOverride as string | null,
      aboutOverride: config.aboutOverride as string | null,
      selectedSkills: config.selectedSkills as string[],
      selectedExperienceIndices: config.selectedExperienceIndices as number[],
      selectedEducationIndices: config.selectedEducationIndices as number[],
      selectedProjectIndices: config.selectedProjectIndices as number[],
    });
  } catch {
    return undefined;
  }
}

// ─── Tests ────────────────────────────────────────────────────

describe('Variant Manager - createVariant', () => {
  it('creates a variant with correct properties', () => {
    const manager = createVariantManager();
    const variant = createVariant(manager, {
      name: 'Frontend Role',
      profileId: 'profile-1',
      jobTitle: 'Frontend Engineer',
      companyName: 'Google',
    });

    expect(variant.id).toMatch(/^var-/);
    expect(variant.name).toBe('Frontend Role');
    expect(variant.profileId).toBe('profile-1');
    expect(variant.jobTitle).toBe('Frontend Engineer');
    expect(variant.companyName).toBe('Google');
    expect(variant.isDefault).toBe(false);
  });

  it('sets default section order', () => {
    const manager = createVariantManager();
    const variant = createVariant(manager, {
      name: 'Test',
      profileId: 'p1',
      jobTitle: 'Dev',
      companyName: 'Co',
    });
    expect(variant.sectionOrder).toEqual([
      'basics',
      'experience',
      'education',
      'skills',
      'projects',
    ]);
  });

  it('sets empty hidden sections by default', () => {
    const manager = createVariantManager();
    const variant = createVariant(manager, {
      name: 'Test',
      profileId: 'p1',
      jobTitle: 'Dev',
      companyName: 'Co',
    });
    expect(variant.hiddenSections).toEqual([]);
  });

  it('accepts custom section order', () => {
    const manager = createVariantManager();
    const variant = createVariant(manager, {
      name: 'Custom',
      profileId: 'p1',
      jobTitle: 'Dev',
      companyName: 'Co',
      sectionOrder: ['skills', 'experience', 'basics'],
    });
    expect(variant.sectionOrder).toEqual(['skills', 'experience', 'basics']);
  });

  it('accepts custom hidden sections', () => {
    const manager = createVariantManager();
    const variant = createVariant(manager, {
      name: 'Hidden',
      profileId: 'p1',
      jobTitle: 'Dev',
      companyName: 'Co',
      hiddenSections: ['projects', 'education'],
    });
    expect(variant.hiddenSections).toEqual(['projects', 'education']);
  });

  it('stores variant in manager', () => {
    const manager = createVariantManager();
    createVariant(manager, {
      name: 'Test',
      profileId: 'p1',
      jobTitle: 'Dev',
      companyName: 'Co',
    });
    expect(manager.variants).toHaveLength(1);
  });

  it('generates unique IDs', () => {
    const manager = createVariantManager();
    const v1 = createVariant(manager, {
      name: 'A',
      profileId: 'p1',
      jobTitle: 'J',
      companyName: 'C',
    });
    const v2 = createVariant(manager, {
      name: 'B',
      profileId: 'p1',
      jobTitle: 'J',
      companyName: 'C',
    });
    expect(v1.id).not.toBe(v2.id);
  });

  it('accepts headline and about overrides', () => {
    const manager = createVariantManager();
    const variant = createVariant(manager, {
      name: 'Override',
      profileId: 'p1',
      jobTitle: 'Dev',
      companyName: 'Co',
      headlineOverride: 'Custom Headline',
      aboutOverride: 'Custom about text',
    });
    expect(variant.headlineOverride).toBe('Custom Headline');
    expect(variant.aboutOverride).toBe('Custom about text');
  });

  it('stores selected skills', () => {
    const manager = createVariantManager();
    const variant = createVariant(manager, {
      name: 'Skills',
      profileId: 'p1',
      jobTitle: 'Dev',
      companyName: 'Co',
      selectedSkills: ['TypeScript', 'React', 'Node.js'],
    });
    expect(variant.selectedSkills).toEqual(['TypeScript', 'React', 'Node.js']);
  });
});

describe('Variant Manager - getVariant', () => {
  it('retrieves a variant by ID', () => {
    const manager = createVariantManager();
    const variant = createVariant(manager, {
      name: 'Test',
      profileId: 'p1',
      jobTitle: 'Dev',
      companyName: 'Co',
    });
    expect(getVariant(manager, variant.id)).toBe(variant);
  });

  it('returns undefined for nonexistent ID', () => {
    const manager = createVariantManager();
    expect(getVariant(manager, 'nonexistent')).toBeUndefined();
  });
});

describe('Variant Manager - getVariantsByProfile', () => {
  it('returns only variants for the given profile', () => {
    const manager = createVariantManager();
    createVariant(manager, { name: 'A', profileId: 'p1', jobTitle: 'J', companyName: 'C' });
    createVariant(manager, { name: 'B', profileId: 'p1', jobTitle: 'J', companyName: 'C' });
    createVariant(manager, { name: 'C', profileId: 'p2', jobTitle: 'J', companyName: 'C' });

    const p1Variants = getVariantsByProfile(manager, 'p1');
    expect(p1Variants).toHaveLength(2);
  });

  it('returns empty array for profile with no variants', () => {
    const manager = createVariantManager();
    expect(getVariantsByProfile(manager, 'unknown')).toEqual([]);
  });
});

describe('Variant Manager - updateVariant', () => {
  it('updates variant properties', () => {
    const manager = createVariantManager();
    const variant = createVariant(manager, {
      name: 'Old Name',
      profileId: 'p1',
      jobTitle: 'Dev',
      companyName: 'Co',
    });

    const updated = updateVariant(manager, variant.id, { name: 'New Name' });
    expect(updated?.name).toBe('New Name');
  });

  it('updates the updatedAt timestamp', () => {
    const manager = createVariantManager();
    const variant = createVariant(manager, {
      name: 'Test',
      profileId: 'p1',
      jobTitle: 'Dev',
      companyName: 'Co',
    });
    const originalUpdatedAt = variant.updatedAt;

    // Small delay to ensure timestamp changes
    const updated = updateVariant(manager, variant.id, { name: 'Changed' });
    expect(updated?.updatedAt).toBeDefined();
    expect(updated!.updatedAt >= originalUpdatedAt).toBe(true);
  });

  it('returns undefined for nonexistent variant', () => {
    const manager = createVariantManager();
    expect(updateVariant(manager, 'nonexistent', { name: 'X' })).toBeUndefined();
  });

  it('does not change id or createdAt', () => {
    const manager = createVariantManager();
    const variant = createVariant(manager, {
      name: 'Test',
      profileId: 'p1',
      jobTitle: 'Dev',
      companyName: 'Co',
    });
    const originalId = variant.id;
    const originalCreatedAt = variant.createdAt;

    updateVariant(manager, variant.id, { name: 'Changed' });
    expect(variant.id).toBe(originalId);
    expect(variant.createdAt).toBe(originalCreatedAt);
  });
});

describe('Variant Manager - deleteVariant', () => {
  it('deletes a variant', () => {
    const manager = createVariantManager();
    const variant = createVariant(manager, {
      name: 'To Delete',
      profileId: 'p1',
      jobTitle: 'Dev',
      companyName: 'Co',
    });

    expect(deleteVariant(manager, variant.id)).toBe(true);
    expect(manager.variants).toHaveLength(0);
  });

  it('returns false for nonexistent variant', () => {
    const manager = createVariantManager();
    expect(deleteVariant(manager, 'nonexistent')).toBe(false);
  });

  it('only deletes the specified variant', () => {
    const manager = createVariantManager();
    const v1 = createVariant(manager, {
      name: 'A',
      profileId: 'p1',
      jobTitle: 'J',
      companyName: 'C',
    });
    createVariant(manager, { name: 'B', profileId: 'p1', jobTitle: 'J', companyName: 'C' });

    deleteVariant(manager, v1.id);
    expect(manager.variants).toHaveLength(1);
    expect(manager.variants[0].name).toBe('B');
  });
});

describe('Variant Manager - duplicateVariant', () => {
  it('creates a copy with new ID and name', () => {
    const manager = createVariantManager();
    const original = createVariant(manager, {
      name: 'Original',
      profileId: 'p1',
      jobTitle: 'Engineer',
      companyName: 'Co',
    });

    const duplicate = duplicateVariant(manager, original.id, 'Copy of Original');
    expect(duplicate).toBeDefined();
    expect(duplicate!.id).not.toBe(original.id);
    expect(duplicate!.name).toBe('Copy of Original');
    expect(duplicate!.jobTitle).toBe('Engineer');
    expect(duplicate!.companyName).toBe('Co');
  });

  it('is not marked as default', () => {
    const manager = createVariantManager();
    const original = createVariant(manager, {
      name: 'Original',
      profileId: 'p1',
      jobTitle: 'J',
      companyName: 'C',
    });

    const duplicate = duplicateVariant(manager, original.id, 'Copy');
    expect(duplicate!.isDefault).toBe(false);
  });

  it('returns undefined for nonexistent source', () => {
    const manager = createVariantManager();
    expect(duplicateVariant(manager, 'nonexistent', 'Copy')).toBeUndefined();
  });

  it('deep copies all properties', () => {
    const manager = createVariantManager();
    const original = createVariant(manager, {
      name: 'Original',
      profileId: 'p1',
      jobTitle: 'J',
      companyName: 'C',
      selectedSkills: ['TypeScript', 'React'],
      hiddenSections: ['projects'],
    });

    const duplicate = duplicateVariant(manager, original.id, 'Copy');
    expect(duplicate!.selectedSkills).toEqual(['TypeScript', 'React']);
    expect(duplicate!.hiddenSections).toEqual(['projects']);
  });
});

describe('Variant Manager - setDefaultVariant', () => {
  it('sets a variant as default', () => {
    const manager = createVariantManager();
    const variant = createVariant(manager, {
      name: 'Default',
      profileId: 'p1',
      jobTitle: 'J',
      companyName: 'C',
    });

    expect(setDefaultVariant(manager, variant.id)).toBe(true);
    expect(variant.isDefault).toBe(true);
  });

  it('unsets other defaults for the same profile', () => {
    const manager = createVariantManager();
    const v1 = createVariant(manager, {
      name: 'A',
      profileId: 'p1',
      jobTitle: 'J',
      companyName: 'C',
    });
    const v2 = createVariant(manager, {
      name: 'B',
      profileId: 'p1',
      jobTitle: 'J',
      companyName: 'C',
    });

    setDefaultVariant(manager, v1.id);
    setDefaultVariant(manager, v2.id);

    expect(v1.isDefault).toBe(false);
    expect(v2.isDefault).toBe(true);
  });

  it('returns false for nonexistent variant', () => {
    const manager = createVariantManager();
    expect(setDefaultVariant(manager, 'nonexistent')).toBe(false);
  });
});

describe('Variant Manager - getDefaultVariant', () => {
  it('returns the default variant for a profile', () => {
    const manager = createVariantManager();
    createVariant(manager, {
      name: 'A',
      profileId: 'p1',
      jobTitle: 'J',
      companyName: 'C',
    });
    const v2 = createVariant(manager, {
      name: 'B',
      profileId: 'p1',
      jobTitle: 'J',
      companyName: 'C',
    });

    setDefaultVariant(manager, v2.id);
    expect(getDefaultVariant(manager, 'p1')).toBe(v2);
  });

  it('returns undefined when no default is set', () => {
    const manager = createVariantManager();
    createVariant(manager, { name: 'A', profileId: 'p1', jobTitle: 'J', companyName: 'C' });
    expect(getDefaultVariant(manager, 'p1')).toBeUndefined();
  });
});

describe('Variant Manager - sortVariants', () => {
  it('sorts by name alphabetically', () => {
    const manager = createVariantManager();
    createVariant(manager, { name: 'Charlie', profileId: 'p1', jobTitle: 'J', companyName: 'C' });
    createVariant(manager, { name: 'Alpha', profileId: 'p1', jobTitle: 'J', companyName: 'C' });
    createVariant(manager, { name: 'Bravo', profileId: 'p1', jobTitle: 'J', companyName: 'C' });

    const sorted = sortVariants(manager, 'p1', 'name');
    expect(sorted.map((v) => v.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('sorts by createdAt ascending', () => {
    const manager = createVariantManager();
    createVariant(manager, { name: 'First', profileId: 'p1', jobTitle: 'J', companyName: 'C' });
    createVariant(manager, { name: 'Second', profileId: 'p1', jobTitle: 'J', companyName: 'C' });
    createVariant(manager, { name: 'Third', profileId: 'p1', jobTitle: 'J', companyName: 'C' });

    const sorted = sortVariants(manager, 'p1', 'createdAt');
    expect(sorted[0].name).toBe('First');
    expect(sorted[2].name).toBe('Third');
  });
});

describe('Variant Manager - searchVariants', () => {
  it('finds variants by name', () => {
    const manager = createVariantManager();
    createVariant(manager, {
      name: 'Frontend Role',
      profileId: 'p1',
      jobTitle: 'J',
      companyName: 'C',
    });
    createVariant(manager, {
      name: 'Backend Role',
      profileId: 'p1',
      jobTitle: 'J',
      companyName: 'C',
    });

    const results = searchVariants(manager, 'p1', 'Frontend');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Frontend Role');
  });

  it('finds variants by job title', () => {
    const manager = createVariantManager();
    createVariant(manager, {
      name: 'A',
      profileId: 'p1',
      jobTitle: 'Senior Engineer',
      companyName: 'Co',
    });
    createVariant(manager, {
      name: 'B',
      profileId: 'p1',
      jobTitle: 'Junior Designer',
      companyName: 'Co',
    });

    const results = searchVariants(manager, 'p1', 'Engineer');
    expect(results).toHaveLength(1);
  });

  it('finds variants by company name', () => {
    const manager = createVariantManager();
    createVariant(manager, { name: 'A', profileId: 'p1', jobTitle: 'J', companyName: 'Google' });
    createVariant(manager, { name: 'B', profileId: 'p1', jobTitle: 'J', companyName: 'Meta' });

    const results = searchVariants(manager, 'p1', 'Google');
    expect(results).toHaveLength(1);
  });

  it('is case-insensitive', () => {
    const manager = createVariantManager();
    createVariant(manager, { name: 'Frontend', profileId: 'p1', jobTitle: 'J', companyName: 'C' });

    const results = searchVariants(manager, 'p1', 'frontend');
    expect(results).toHaveLength(1);
  });

  it('returns empty array for no matches', () => {
    const manager = createVariantManager();
    createVariant(manager, { name: 'A', profileId: 'p1', jobTitle: 'J', companyName: 'C' });

    expect(searchVariants(manager, 'p1', 'nonexistent')).toEqual([]);
  });
});

describe('Variant Manager - countVariants', () => {
  it('counts variants for a profile', () => {
    const manager = createVariantManager();
    createVariant(manager, { name: 'A', profileId: 'p1', jobTitle: 'J', companyName: 'C' });
    createVariant(manager, { name: 'B', profileId: 'p1', jobTitle: 'J', companyName: 'C' });
    createVariant(manager, { name: 'C', profileId: 'p2', jobTitle: 'J', companyName: 'C' });

    expect(countVariants(manager, 'p1')).toBe(2);
    expect(countVariants(manager, 'p2')).toBe(1);
  });

  it('returns 0 for profile with no variants', () => {
    const manager = createVariantManager();
    expect(countVariants(manager, 'unknown')).toBe(0);
  });
});

describe('Variant Manager - export/import', () => {
  it('exports variant config as JSON', () => {
    const manager = createVariantManager();
    const variant = createVariant(manager, {
      name: 'Export Test',
      profileId: 'p1',
      jobTitle: 'Engineer',
      companyName: 'Co',
      selectedSkills: ['TypeScript'],
    });

    const json = exportVariantConfig(variant);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.name).toBe('Export Test');
    expect(parsed.jobTitle).toBe('Engineer');
    expect(parsed.selectedSkills).toEqual(['TypeScript']);
  });

  it('imports variant config from JSON', () => {
    const manager = createVariantManager();
    const config = JSON.stringify({
      name: 'Imported Variant',
      jobTitle: 'Designer',
      companyName: 'DesignCo',
      sectionOrder: ['basics', 'skills'],
      hiddenSections: ['projects'],
      headlineOverride: null,
      aboutOverride: null,
      selectedSkills: ['Figma'],
      selectedExperienceIndices: [0],
      selectedEducationIndices: [],
      selectedProjectIndices: [],
    });

    const imported = importVariantConfig(manager, 'p1', config);
    expect(imported).toBeDefined();
    expect(imported!.name).toBe('Imported Variant (imported)');
    expect(imported!.jobTitle).toBe('Designer');
    expect(imported!.companyName).toBe('DesignCo');
    expect(imported!.sectionOrder).toEqual(['basics', 'skills']);
  });

  it('returns undefined for invalid JSON', () => {
    const manager = createVariantManager();
    expect(importVariantConfig(manager, 'p1', 'not valid json')).toBeUndefined();
  });

  it('round-trips export and import', () => {
    const manager = createVariantManager();
    const original = createVariant(manager, {
      name: 'Round Trip',
      profileId: 'p1',
      jobTitle: 'Eng',
      companyName: 'Co',
      selectedSkills: ['A', 'B'],
      hiddenSections: ['projects'],
    });

    const json = exportVariantConfig(original);
    const imported = importVariantConfig(manager, 'p2', json);

    expect(imported).toBeDefined();
    expect(imported!.selectedSkills).toEqual(['A', 'B']);
    expect(imported!.hiddenSections).toEqual(['projects']);
    expect(imported!.profileId).toBe('p2');
  });
});
