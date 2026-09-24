import type { ProfileWithRelations } from './repository';

export interface CompletionItem {
  label: string;
  completed: boolean;
}

export interface CompletionSummary {
  items: CompletionItem[];
  completedCount: number;
  percentage: number;
}

/**
 * Single source of truth for profile completion.
 * "Profile basics" is satisfied when the profile has a display name,
 * which is exactly what onboarding collects as required input.
 */
export function profileCompletion(profile: ProfileWithRelations): CompletionSummary {
  const items: CompletionItem[] = [
    { label: 'Profile basics', completed: !!profile.display_name },
    { label: 'Experience', completed: profile.experiences.length > 0 },
    { label: 'Education', completed: profile.education.length > 0 },
    { label: 'Skills', completed: profile.skills.length > 0 },
    { label: 'Links', completed: profile.links.length > 0 },
  ];
  const completedCount = items.filter((item) => item.completed).length;
  return {
    items,
    completedCount,
    percentage: Math.round((completedCount / items.length) * 100),
  };
}
