import type { ProfileWithRelations } from './repository';

export interface CompletionItem {
  label: string;
  completed: boolean;
  detail: string;
}

export interface CompletionSummary {
  items: CompletionItem[];
  completedCount: number;
  percentage: number;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Single source of truth for profile completion.
 * "Profile basics" is satisfied when the profile has a display name,
 * which is exactly what onboarding collects as required input.
 * Each row carries a truthful detail value (counts, not repeated totals).
 */
export function profileCompletion(profile: ProfileWithRelations): CompletionSummary {
  const items: CompletionItem[] = [
    {
      label: 'Profile basics',
      completed: !!profile.display_name,
      detail: profile.display_name ? 'Complete' : 'Add your name',
    },
    {
      label: 'Experience',
      completed: profile.experiences.length > 0,
      detail:
        profile.experiences.length > 0
          ? plural(profile.experiences.length, 'entry', 'entries')
          : 'No entries yet',
    },
    {
      label: 'Education',
      completed: profile.education.length > 0,
      detail:
        profile.education.length > 0
          ? plural(profile.education.length, 'entry', 'entries')
          : 'No entries yet',
    },
    {
      label: 'Skills',
      completed: profile.skills.length > 0,
      detail:
        profile.skills.length > 0 ? plural(profile.skills.length, 'skill', 'skills') : 'None yet',
    },
    {
      label: 'Links',
      completed: profile.links.length > 0,
      detail: profile.links.length > 0 ? plural(profile.links.length, 'link', 'links') : 'None yet',
    },
  ];
  const completedCount = items.filter((item) => item.completed).length;
  return {
    items,
    completedCount,
    percentage: Math.round((completedCount / items.length) * 100),
  };
}
