import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { ProfileService } from '../lib/profiles/service';
import { isHttpUrl, sanitizeUrl } from '../lib/validators/url';
import { getSupabaseClient } from '../lib/supabase/client';
import { formatDateRange, isDateRangeInvalid } from '../lib/profiles/date-format';
import { getPreferences, type ProfilePreferences } from '../lib/profiles/preferences';
import { LinkIcon } from '../components/portfolio/links';
import { TemplateCanvas } from '../components/portfolio/TemplateCanvas';
import { useNoindexMeta } from '../lib/seo/usePageMeta';
import { track } from '../lib/analytics/events';
import type { ProfileWithRelations, AchievementRow } from '../lib/profiles/repository';

type EditSection =
  'basics' | 'experience' | 'education' | 'projects' | 'skills' | 'links' | 'achievements';

const INPUT =
  'w-full px-3 py-2 border border-[var(--border-strong)] rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DATE_FIELD_LABELS: Record<string, string> = {
  startMonth: 'Start month',
  startYear: 'Start year',
  endMonth: 'End month',
  endYear: 'End year',
};

function MonthSelect({
  id,
  name,
  defaultValue,
  disabled,
}: {
  id: string;
  name: string;
  defaultValue?: number | null;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium mb-1 text-[var(--muted-foreground)]">
        {DATE_FIELD_LABELS[name] ?? name}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue ?? ''}
        disabled={disabled}
        className={`${INPUT} disabled:opacity-50`}
        aria-label={name}>
        <option value="">Month</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>
            {m.slice(0, 3)}
          </option>
        ))}
      </select>
    </div>
  );
}

function YearInput({
  id,
  name,
  defaultValue,
  required,
  disabled,
}: {
  id: string;
  name: string;
  defaultValue?: number | null;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium mb-1 text-[var(--muted-foreground)]">
        {DATE_FIELD_LABELS[name] ?? name}
      </label>
      <input
        id={id}
        name={name}
        type="number"
        min="1900"
        max="2099"
        required={required}
        defaultValue={defaultValue ?? ''}
        disabled={disabled}
        placeholder="Year"
        className={`${INPUT} disabled:opacity-50`}
      />
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium mb-1 text-[var(--foreground)]">
        {label}
      </label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

function CardActions({
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  deleteLabel,
  canMoveUp,
  canMoveDown,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  deleteLabel: string;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {onMoveUp && (
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          aria-label="Move up"
          className="w-8 h-8 rounded-md text-[var(--faint-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)] disabled:opacity-30 disabled:pointer-events-none">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="mx-auto">
            <path
              d="m6 15 6-6 6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      {onMoveDown && (
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          aria-label="Move down"
          className="w-8 h-8 rounded-md text-[var(--faint-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)] disabled:opacity-30 disabled:pointer-events-none">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="mx-auto">
            <path
              d="m6 9 6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      <button
        type="button"
        onClick={onEdit}
        className="h-8 px-3 rounded-md text-xs font-semibold border border-[var(--border-strong)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]">
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={deleteLabel}
        className="w-8 h-8 rounded-md text-[var(--faint-foreground)] hover:bg-[var(--danger-surface)] hover:text-[var(--danger)]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="mx-auto">
          <path
            d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

function EmptyState({ title, body, cta }: { title: string; body: string; cta: string }) {
  return (
    <div className="border border-dashed border-[var(--border-strong)] rounded-xl p-6 mb-6 bg-white">
      <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
      <p className="text-sm text-[var(--muted-foreground)] mt-1 leading-relaxed">{body}</p>
      <p className="text-xs text-[var(--faint-foreground)] mt-3">↓ {cta}</p>
    </div>
  );
}

type EditingKey = `${EditSection}:${string}`;

export default function ProfileEditor() {
  const auth = useAuth();
  const navigate = useNavigate();
  useNoindexMeta('Edit profile — Career Profile');
  const [profile, setProfile] = useState<ProfileWithRelations | null>(null);
  const [achievements, setAchievements] = useState<AchievementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<EditSection>('basics');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingKey | null>(null);
  const [preferences, setPreferences] = useState<ProfilePreferences | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showAllExperiences, setShowAllExperiences] = useState(false);
  const [addExpCurrent, setAddExpCurrent] = useState(false);
  const EXP_COLLAPSE = 5;

  const profileService = new ProfileService();

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [previewOpen]);

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 2600);
  };

  useEffect(() => {
    if (auth.status === 'authenticated') {
      void profileService.getProfile(auth.user.id).then((p) => {
        setProfile(p);
        setLoading(false);
        if (p) {
          void getPreferences(p.id)
            .then(setPreferences)
            .catch(() => setPreferences(null));
          void supabase
            .from('profile_achievements')
            .select('*')
            .eq('profile_id', p.id)
            .order('sort_order')
            .then(({ data }) => setAchievements((data as AchievementRow[]) ?? []));
        }
      });
    }
  }, [auth]);

  useEffect(() => {
    if (auth.status === 'unauthenticated') {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (auth.status === 'unauthenticated' && !loading) {
      void navigate('/login');
    }
  }, [auth, loading, navigate]);

  useEffect(() => {
    if (!loading && auth.status === 'authenticated' && !profile) {
      void navigate('/onboarding');
    }
  }, [loading, auth, profile, navigate]);

  // Funnel: any section save that changes the row counts as a profile update.
  const lastUpdatedAt = useRef<string | null>(null);
  useEffect(() => {
    if (!profile) {
      lastUpdatedAt.current = null;
      return;
    }
    if (lastUpdatedAt.current && profile.updated_at !== lastUpdatedAt.current) {
      track('profile_updated', { source: 'profile_editor' });
    }
    lastUpdatedAt.current = profile.updated_at;
  }, [profile]);

  if (auth.status === 'loading' || loading) {
    return (
      <div className="page-shell">
        <div className="space-y-4" role="status" aria-label="Loading profile editor">
          <div className="skeleton h-8 w-48" />
          <div className="flex gap-6">
            <div className="skeleton h-40 w-40 hidden md:block" />
            <div className="flex-1 space-y-3">
              <div className="skeleton h-6 w-40" />
              <div className="skeleton h-28 w-full" />
              <div className="skeleton h-28 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (auth.status === 'unauthenticated' || !profile) {
    return null;
  }

  const supabase = getSupabaseClient();

  // ── Generic row operations (owner RLS policies cover update/delete) ──

  type RowTable = 'experience' | 'education' | 'projects' | 'links';
  const TABLE_META: Record<RowTable, { table: string; label: string }> = {
    experience: { table: 'profile_experiences', label: 'experience' },
    education: { table: 'profile_education', label: 'education' },
    projects: { table: 'profile_projects', label: 'project' },
    links: { table: 'profile_links', label: 'link' },
  };

  const rowsOf = (t: RowTable) => {
    if (t === 'experience') return profile.experiences;
    if (t === 'education') return profile.education;
    if (t === 'projects') return profile.projects;
    return profile.links;
  };

  const handleMove = async (t: RowTable, index: number, dir: -1 | 1) => {
    const rows = [...rowsOf(t)];
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    setSaving(true);
    setError(null);
    try {
      const a = rows[index];
      const b = rows[target];
      const aOrder = b.sort_order;
      const bOrder = a.sort_order;
      const tableName = TABLE_META[t].table;
      const { error: e1 } = await supabase
        .from(tableName as never)
        .update({ sort_order: aOrder } as never)
        .eq('id', a.id as never);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from(tableName as never)
        .update({ sort_order: bOrder } as never)
        .eq('id', b.id as never);
      if (e2) throw e2;
      [rows[index], rows[target]] = [rows[target], rows[index]];
      rows.forEach((r, i) => (r.sort_order = i));
      if (t === 'experience') setProfile({ ...profile, experiences: rows as never });
      if (t === 'education') setProfile({ ...profile, education: rows as never });
      if (t === 'projects') setProfile({ ...profile, projects: rows as never });
      if (t === 'links') setProfile({ ...profile, links: rows as never });
    } catch {
      setError("We couldn't reorder this entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleRowUpdate = async (t: RowTable, id: string, payload: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from(TABLE_META[t].table as never)
        .update(payload as never)
        .eq('id', id as never);
      if (err) throw err;
      const updated = rowsOf(t).map((r) => (r.id === id ? { ...r, ...payload } : r));
      if (t === 'experience') setProfile({ ...profile, experiences: updated as never });
      if (t === 'education') setProfile({ ...profile, education: updated as never });
      if (t === 'projects') setProfile({ ...profile, projects: updated as never });
      if (t === 'links') setProfile({ ...profile, links: updated as never });
      setEditing(null);
      flashSuccess('Changes saved.');
    } catch {
      setError("We couldn't save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleBasicsUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const updates = {
      display_name: formData.get('displayName') as string,
      headline: formData.get('headline') as string,
      about: formData.get('about') as string,
      location: formData.get('location') as string,
    };

    try {
      await profileService.updateProfile(profile.id, updates);
      setProfile({ ...profile, ...updates });
      flashSuccess('Profile updated.');
    } catch {
      setError("We couldn't update your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleExperienceAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const isCurrent = fd.get('isCurrent') === 'on';
    const startYear = parseInt(fd.get('startYear') as string);
    const startMonth = fd.get('startMonth') ? parseInt(fd.get('startMonth') as string) : null;
    const endYear = fd.get('endYear') ? parseInt(fd.get('endYear') as string) : null;
    const endMonth = fd.get('endMonth') ? parseInt(fd.get('endMonth') as string) : null;
    if (isDateRangeInvalid({ startYear, startMonth, endYear, endMonth, current: isCurrent })) {
      setError('Start date must be on or before the end date.');
      setSaving(false);
      return;
    }
    const newExperience = {
      profile_id: profile.id,
      company: fd.get('company') as string,
      role: fd.get('role') as string,
      location: (fd.get('location') as string) || null,
      start_year: startYear,
      start_month: startMonth,
      end_year: endYear,
      end_month: endMonth,
      is_current: isCurrent,
      description: (fd.get('description') as string) || null,
      sort_order: profile.experiences.length,
    };

    try {
      const { data, error } = await supabase
        .from('profile_experiences')
        .insert(newExperience)
        .select()
        .single();
      if (error) throw error;
      setProfile({ ...profile, experiences: [...profile.experiences, data] });
      (e.target as HTMLFormElement).reset();
      setAddExpCurrent(false);
      setShowAllExperiences(true);
      flashSuccess('Experience added.');
    } catch {
      setError("We couldn't add this experience. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleExperienceDelete = async (experienceId: string) => {
    if (!confirm('Delete this experience? This can’t be undone.')) return;
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase.from('profile_experiences').delete().eq('id', experienceId);
      if (error) throw error;
      setProfile({
        ...profile,
        experiences: profile.experiences.filter((x) => x.id !== experienceId),
      });
      flashSuccess('Experience removed.');
    } catch {
      setError("We couldn't delete this experience. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleEducationAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const row = {
      profile_id: profile.id,
      institution: fd.get('institution') as string,
      degree: (fd.get('degree') as string) || null,
      field_of_study: (fd.get('fieldOfStudy') as string) || null,
      start_year: fd.get('startYear') ? parseInt(fd.get('startYear') as string) : null,
      start_month: fd.get('startMonth') ? parseInt(fd.get('startMonth') as string) : null,
      end_year: fd.get('endYear') ? parseInt(fd.get('endYear') as string) : null,
      end_month: fd.get('endMonth') ? parseInt(fd.get('endMonth') as string) : null,
      description: (fd.get('description') as string) || null,
      sort_order: profile.education.length,
    };
    try {
      const { data, error } = await supabase
        .from('profile_education')
        .insert(row as never)
        .select()
        .single();
      if (error) throw error;
      setProfile({ ...profile, education: [...profile.education, data] });
      (e.target as HTMLFormElement).reset();
      flashSuccess('Education added.');
    } catch {
      setError("We couldn't add this education entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleEducationDelete = async (educationId: string) => {
    if (!confirm('Delete this education entry? This can’t be undone.')) return;
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase.from('profile_education').delete().eq('id', educationId);
      if (error) throw error;
      setProfile({ ...profile, education: profile.education.filter((x) => x.id !== educationId) });
      flashSuccess('Education removed.');
    } catch {
      setError("We couldn't delete this entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleProjectAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const row = {
      profile_id: profile.id,
      name: fd.get('name') as string,
      description: (fd.get('description') as string) || null,
      project_url: (fd.get('projectUrl') as string) || null,
      repository_url: (fd.get('repositoryUrl') as string) || null,
      sort_order: profile.projects.length,
    };
    try {
      const { data, error } = await supabase
        .from('profile_projects')
        .insert(row as never)
        .select()
        .single();
      if (error) throw error;
      setProfile({ ...profile, projects: [...profile.projects, data] });
      (e.target as HTMLFormElement).reset();
      flashSuccess('Project added.');
    } catch {
      setError("We couldn't add this project. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleProjectDelete = async (projectId: string) => {
    if (!confirm('Delete this project? This can’t be undone.')) return;
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase.from('profile_projects').delete().eq('id', projectId);
      if (error) throw error;
      setProfile({ ...profile, projects: profile.projects.filter((x) => x.id !== projectId) });
      flashSuccess('Project removed.');
    } catch {
      setError("We couldn't delete this project. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSkillAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const rawSkill = fd.get('name');
    const skillName = (typeof rawSkill === 'string' ? rawSkill : '').trim();
    if (profile.skills.some((s) => s.name.toLowerCase() === skillName.toLowerCase())) {
      setError(`You already have “${skillName}” in your skills.`);
      setSaving(false);
      return;
    }
    const row = {
      profile_id: profile.id,
      name: skillName,
      category: (fd.get('category') as string) || null,
      sort_order: profile.skills.length,
    };
    try {
      const { data, error } = await supabase
        .from('profile_skills')
        .insert(row as never)
        .select()
        .single();
      if (error) throw error;
      setProfile({ ...profile, skills: [...profile.skills, data] });
      (e.target as HTMLFormElement).reset();
      flashSuccess('Skill added.');
    } catch {
      setError("We couldn't add this skill. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSkillDelete = async (skillId: string) => {
    if (!confirm('Remove this skill?')) return;
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase.from('profile_skills').delete().eq('id', skillId);
      if (error) throw error;
      setProfile({ ...profile, skills: profile.skills.filter((x) => x.id !== skillId) });
      flashSuccess('Skill removed.');
    } catch {
      setError("We couldn't remove this skill. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLinkAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const rawLink = fd.get('url');
    const linkUrl = (typeof rawLink === 'string' ? rawLink : '').trim();
    if (!isHttpUrl(linkUrl)) {
      setError('Links must be a full http:// or https:// address.');
      setSaving(false);
      return;
    }
    const row = {
      profile_id: profile.id,
      label: fd.get('label') as string,
      url: linkUrl,
      sort_order: profile.links.length,
    };
    try {
      const { data, error } = await supabase
        .from('profile_links')
        .insert(row as never)
        .select()
        .single();
      if (error) throw error;
      setProfile({ ...profile, links: [...profile.links, data] });
      (e.target as HTMLFormElement).reset();
      flashSuccess('Link added.');
    } catch {
      setError("We couldn't add this link. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLinkDelete = async (linkId: string) => {
    if (!confirm('Remove this link?')) return;
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase.from('profile_links').delete().eq('id', linkId);
      if (error) throw error;
      setProfile({ ...profile, links: profile.links.filter((x) => x.id !== linkId) });
      flashSuccess('Link removed.');
    } catch {
      setError("We couldn't remove this link. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Achievements (owner-curated; public only when is_public is set) ──

  const handleAchievementAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const sourceUrl = ((fd.get('sourceUrl') as string) || '').trim();
    if (sourceUrl && !isHttpUrl(sourceUrl)) {
      setError('The source must be a full http:// or https:// address.');
      setSaving(false);
      return;
    }
    const row = {
      profile_id: profile.id,
      title: ((fd.get('title') as string) || '').trim(),
      description: (fd.get('description') as string) || null,
      metric_text: (fd.get('metricText') as string) || null,
      timeframe: (fd.get('timeframe') as string) || null,
      source_url: sourceUrl || null,
      is_featured: fd.get('featured') === 'on',
      is_public: fd.get('isPublic') === 'on',
      sort_order: achievements.length,
    };
    try {
      const { data, error } = await supabase
        .from('profile_achievements')
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      setAchievements([...achievements, data as AchievementRow]);
      (e.target as HTMLFormElement).reset();
      flashSuccess('Achievement added.');
    } catch {
      setError("We couldn't add this achievement. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAchievementDelete = async (id: string) => {
    if (!confirm('Delete this achievement? This can’t be undone.')) return;
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase.from('profile_achievements').delete().eq('id', id);
      if (error) throw error;
      setAchievements(achievements.filter((a) => a.id !== id));
      flashSuccess('Achievement removed.');
    } catch {
      setError("We couldn't delete this achievement. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAchievementMove = async (index: number, dir: -1 | 1) => {
    const rows = [...achievements];
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    setSaving(true);
    setError(null);
    try {
      const a = rows[index];
      const b = rows[target];
      const { error: e1 } = await supabase
        .from('profile_achievements')
        .update({ sort_order: b.sort_order })
        .eq('id', a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from('profile_achievements')
        .update({ sort_order: a.sort_order })
        .eq('id', b.id);
      if (e2) throw e2;
      [rows[index], rows[target]] = [rows[target], rows[index]];
      rows.forEach((r, i) => (r.sort_order = i));
      setAchievements(rows);
    } catch {
      setError("We couldn't reorder this achievement. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const sections: { id: EditSection; label: string }[] = [
    { id: 'basics', label: 'Basics' },
    { id: 'experience', label: 'Experience' },
    { id: 'education', label: 'Education' },
    { id: 'projects', label: 'Projects' },
    { id: 'skills', label: 'Skills' },
    { id: 'links', label: 'Links' },
    { id: 'achievements', label: 'Achievements' },
  ];

  const isEditing = (key: EditingKey) => editing === key;
  const experienceRows = profile
    ? profile.experiences
        .map((exp, idx) => ({ exp, idx }))
        .filter((_, i) => showAllExperiences || i < EXP_COLLAPSE)
    : [];
  const toggleEdit = (key: EditingKey) => setEditing(editing === key ? null : key);

  const previewProps = preferences
    ? {
        accentKey: preferences.accent_key,
        sectionOrder: preferences.section_order,
        hiddenSections: preferences.hidden_sections,
      }
    : undefined;

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="page-title">Edit profile</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            aria-expanded={previewOpen}
            className="xl:hidden btn btn-secondary !min-h-[40px] !py-2 text-sm">
            Preview
          </button>
          <button onClick={() => void navigate('/dashboard')} className="link-quiet text-sm">
            ← Back to dashboard
          </button>
        </div>
      </div>

      <div role="alert" aria-live="assertive">
        {error && <div className="alert alert-error mb-5">{error}</div>}
      </div>
      <div role="status" aria-live="polite">
        {success && <div className="alert alert-success mb-5">{success}</div>}
      </div>

      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        <nav className="md:w-44 flex-shrink-0" aria-label="Profile sections">
          <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible -mx-1 px-1 md:mx-0 md:px-0 pb-2 md:pb-0 md:sticky md:top-20">
            {sections.map((section) => (
              <li key={section.id} className="shrink-0">
                <button
                  onClick={() => {
                    setActiveSection(section.id);
                    setEditing(null);
                  }}
                  aria-current={activeSection === section.id ? 'page' : undefined}
                  className={`side-nav-link min-h-[44px] md:min-h-0 ${activeSection === section.id ? 'side-nav-link-active' : ''}`}>
                  {section.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex-1 min-w-0">
          {activeSection === 'basics' && (
            <form onSubmit={(e) => void handleBasicsUpdate(e)} className="space-y-4 card card-pad">
              <div>
                <h2 className="section-title">Basic information</h2>
                <p className="text-sm text-[var(--muted-foreground)] mt-1">
                  The headline of your career story — shown across your portfolio and resume.
                </p>
              </div>
              <Field
                label="Display name"
                htmlFor="displayName"
                hint="Shown as the title of your public profile.">
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  defaultValue={profile.display_name || ''}
                  required
                  maxLength={255}
                  className={INPUT}
                />
              </Field>
              <Field
                label="Headline"
                htmlFor="headline"
                hint="One line about your focus — e.g. “Senior Software Engineer · Data Platforms”.">
                <input
                  id="headline"
                  name="headline"
                  type="text"
                  defaultValue={profile.headline || ''}
                  maxLength={255}
                  placeholder="e.g., Senior Software Engineer"
                  className={INPUT}
                />
              </Field>
              <Field
                label="About"
                htmlFor="about"
                hint="2–4 sentences on your focus, strengths and the work you're proud of.">
                <textarea
                  id="about"
                  name="about"
                  defaultValue={profile.about || ''}
                  rows={5}
                  maxLength={2000}
                  placeholder="What should a recruiter know about you in under a minute?"
                  className={INPUT}
                />
              </Field>
              <Field label="Location" htmlFor="location" hint="City and country, or “Remote”.">
                <input
                  id="location"
                  name="location"
                  type="text"
                  defaultValue={profile.location || ''}
                  placeholder="e.g., Berlin, Germany"
                  className={INPUT}
                />
              </Field>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          )}

          {activeSection === 'experience' && (
            <div>
              <h2 className="section-title mb-1">Experience</h2>
              <p className="text-sm text-[var(--muted-foreground)] mb-5">
                Roles recruiters care about most. Lead with impact, not task lists.
              </p>

              {profile.experiences.length === 0 ? (
                <EmptyState
                  title="No roles yet"
                  body="Experience is the first thing recruiters scan. Add where you've worked and what you shipped."
                  cta="Add your first role below"
                />
              ) : (
                <>
                  <div className="space-y-3 mb-6">
                    {experienceRows.map(({ exp, idx }) =>
                      isEditing(`experience:${exp.id}`) ? (
                        <form
                          key={exp.id}
                          onSubmit={(e) => {
                            e.preventDefault();
                            const fd = new FormData(e.currentTarget);
                            const isCurrent = fd.get('isCurrent') === 'on';
                            const sy = parseInt(fd.get('startYear') as string);
                            const sm = fd.get('startMonth')
                              ? parseInt(fd.get('startMonth') as string)
                              : null;
                            const ey = fd.get('endYear')
                              ? parseInt(fd.get('endYear') as string)
                              : null;
                            const em = fd.get('endMonth')
                              ? parseInt(fd.get('endMonth') as string)
                              : null;
                            if (
                              isDateRangeInvalid({
                                startYear: sy,
                                startMonth: sm,
                                endYear: ey,
                                endMonth: em,
                                current: isCurrent,
                              })
                            ) {
                              setError('Start date must be on or before the end date.');
                              return;
                            }
                            void handleRowUpdate('experience', exp.id, {
                              company: fd.get('company') as string,
                              role: fd.get('role') as string,
                              location: (fd.get('location') as string) || null,
                              start_year: sy,
                              start_month: sm,
                              end_year: ey,
                              end_month: em,
                              is_current: isCurrent,
                              description: (fd.get('description') as string) || null,
                            });
                          }}
                          className="card card-pad border-[var(--accent)] space-y-4">
                          <p className="text-sm font-semibold text-[var(--accent)]">Editing role</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Role" htmlFor={`exp-role-${exp.id}`}>
                              <input
                                id={`exp-role-${exp.id}`}
                                name="role"
                                defaultValue={exp.role}
                                required
                                className={INPUT}
                              />
                            </Field>
                            <Field label="Company" htmlFor={`exp-company-${exp.id}`}>
                              <input
                                id={`exp-company-${exp.id}`}
                                name="company"
                                defaultValue={exp.company}
                                required
                                className={INPUT}
                              />
                            </Field>
                          </div>
                          <Field label="Location" htmlFor={`exp-location-${exp.id}`}>
                            <input
                              id={`exp-location-${exp.id}`}
                              name="location"
                              defaultValue={exp.location || ''}
                              className={INPUT}
                            />
                          </Field>
                          <fieldset className="border-0 p-0 m-0">
                            <legend className="field-label">Dates</legend>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <MonthSelect
                                id={`exp-sm-${exp.id}`}
                                name="startMonth"
                                defaultValue={exp.start_month}
                              />
                              <YearInput
                                id={`exp-sy-${exp.id}`}
                                name="startYear"
                                defaultValue={exp.start_year}
                                required
                              />
                              <MonthSelect
                                id={`exp-em-${exp.id}`}
                                name="endMonth"
                                defaultValue={exp.end_month}
                                disabled={exp.is_current}
                              />
                              <YearInput
                                id={`exp-ey-${exp.id}`}
                                name="endYear"
                                defaultValue={exp.end_year}
                                disabled={exp.is_current}
                              />
                            </div>
                            <label className="flex items-center gap-2 mt-3 text-sm text-[var(--muted-foreground)]">
                              <input
                                type="checkbox"
                                name="isCurrent"
                                defaultChecked={exp.is_current}
                                className="h-4 w-4"
                              />
                              I currently work here
                            </label>
                          </fieldset>
                          <Field label="Description" htmlFor={`exp-desc-${exp.id}`}>
                            <textarea
                              id={`exp-desc-${exp.id}`}
                              name="description"
                              rows={3}
                              defaultValue={exp.description || ''}
                              className={INPUT}
                            />
                          </Field>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={saving}
                              className="btn btn-primary !min-h-[40px] !py-2 text-sm">
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditing(null)}
                              className="btn btn-ghost !min-h-[40px] !py-2 text-sm">
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <article key={exp.id} className="card card-pad">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="text-[15px] font-semibold text-[var(--ink)]">
                                {exp.role}
                              </h3>
                              <p className="text-sm text-[var(--accent)] font-medium">
                                {exp.company}
                              </p>
                              <p className="text-xs text-[var(--faint-foreground)] mt-0.5">
                                {formatDateRange({
                                  startYear: exp.start_year,
                                  startMonth: exp.start_month,
                                  endYear: exp.end_year,
                                  endMonth: exp.end_month,
                                  current: exp.is_current,
                                })}
                                {exp.location ? ` · ${exp.location}` : ''}
                              </p>
                            </div>
                            <CardActions
                              onEdit={() => toggleEdit(`experience:${exp.id}`)}
                              onDelete={() => void handleExperienceDelete(exp.id)}
                              onMoveUp={() => void handleMove('experience', idx, -1)}
                              onMoveDown={() => void handleMove('experience', idx, 1)}
                              canMoveUp={idx > 0}
                              canMoveDown={idx < profile.experiences.length - 1}
                              deleteLabel={`Delete ${exp.role} at ${exp.company}`}
                            />
                          </div>
                          {exp.description && (
                            <p className="text-sm text-[var(--muted-foreground)] mt-2 leading-relaxed">
                              {exp.description}
                            </p>
                          )}
                        </article>
                      )
                    )}
                  </div>
                  {profile.experiences.length > EXP_COLLAPSE && (
                    <button
                      type="button"
                      onClick={() => setShowAllExperiences((v) => !v)}
                      aria-expanded={showAllExperiences}
                      className="btn btn-secondary !min-h-[40px] !py-2 text-sm w-full sm:w-auto">
                      {showAllExperiences
                        ? 'Show fewer roles'
                        : `Show all ${profile.experiences.length} roles`}
                    </button>
                  )}
                </>
              )}

              <form
                onSubmit={(e) => void handleExperienceAdd(e)}
                className="card card-pad space-y-4">
                <h3 className="text-sm font-semibold text-[var(--ink)]">Add experience</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Role" htmlFor="exp-new-role">
                    <input id="exp-new-role" name="role" type="text" required className={INPUT} />
                  </Field>
                  <Field label="Company" htmlFor="exp-new-company">
                    <input
                      id="exp-new-company"
                      name="company"
                      type="text"
                      required
                      className={INPUT}
                    />
                  </Field>
                </div>
                <Field label="Location" htmlFor="exp-new-location">
                  <input id="exp-new-location" name="location" type="text" className={INPUT} />
                </Field>
                <fieldset className="border-0 p-0 m-0">
                  <legend className="field-label">Dates</legend>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MonthSelect id="exp-new-sm" name="startMonth" />
                    <YearInput id="exp-new-sy" name="startYear" required />
                    <MonthSelect id="exp-new-em" name="endMonth" disabled={addExpCurrent} />
                    <YearInput id="exp-new-ey" name="endYear" disabled={addExpCurrent} />
                  </div>
                  <label className="flex items-center gap-2 mt-3 text-sm text-[var(--muted-foreground)]">
                    <input
                      type="checkbox"
                      name="isCurrent"
                      checked={addExpCurrent}
                      onChange={(e) => setAddExpCurrent(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Current position
                  </label>
                </fieldset>
                <Field
                  label="Description"
                  htmlFor="exp-new-desc"
                  hint="Impact, scope, technologies — a few lines.">
                  <textarea id="exp-new-desc" name="description" rows={3} className={INPUT} />
                </Field>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Adding…' : 'Add experience'}
                </button>
              </form>
            </div>
          )}

          {activeSection === 'education' && (
            <div>
              <h2 className="section-title mb-1">Education</h2>
              <p className="text-sm text-[var(--muted-foreground)] mb-5">
                Degrees, bootcamps and certifications that support your story.
              </p>

              {profile.education.length === 0 ? (
                <EmptyState
                  title="No education added"
                  body="Even short programs add credibility — include schools, bootcamps or certificates."
                  cta="Add an entry below"
                />
              ) : (
                <div className="space-y-3 mb-6">
                  {profile.education.map((edu, idx) =>
                    isEditing(`education:${edu.id}`) ? (
                      <form
                        key={edu.id}
                        onSubmit={(e) => {
                          e.preventDefault();
                          const fd = new FormData(e.currentTarget);
                          void handleRowUpdate('education', edu.id, {
                            institution: fd.get('institution') as string,
                            degree: (fd.get('degree') as string) || null,
                            field_of_study: (fd.get('fieldOfStudy') as string) || null,
                            start_year: fd.get('startYear')
                              ? parseInt(fd.get('startYear') as string)
                              : null,
                            start_month: fd.get('startMonth')
                              ? parseInt(fd.get('startMonth') as string)
                              : null,
                            end_year: fd.get('endYear')
                              ? parseInt(fd.get('endYear') as string)
                              : null,
                            end_month: fd.get('endMonth')
                              ? parseInt(fd.get('endMonth') as string)
                              : null,
                            description: (fd.get('description') as string) || null,
                          });
                        }}
                        className="card card-pad border-[var(--accent)] space-y-4">
                        <p className="text-sm font-semibold text-[var(--accent)]">Editing entry</p>
                        <Field label="Institution" htmlFor={`edu-inst-${edu.id}`}>
                          <input
                            id={`edu-inst-${edu.id}`}
                            name="institution"
                            defaultValue={edu.institution}
                            required
                            className={INPUT}
                          />
                        </Field>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Field label="Degree" htmlFor={`edu-degree-${edu.id}`}>
                            <input
                              id={`edu-degree-${edu.id}`}
                              name="degree"
                              defaultValue={edu.degree || ''}
                              className={INPUT}
                            />
                          </Field>
                          <Field label="Field of study" htmlFor={`edu-field-${edu.id}`}>
                            <input
                              id={`edu-field-${edu.id}`}
                              name="fieldOfStudy"
                              defaultValue={edu.field_of_study || ''}
                              className={INPUT}
                            />
                          </Field>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <MonthSelect
                            id={`edu-sm-${edu.id}`}
                            name="startMonth"
                            defaultValue={edu.start_month}
                          />
                          <YearInput
                            id={`edu-sy-${edu.id}`}
                            name="startYear"
                            defaultValue={edu.start_year}
                          />
                          <MonthSelect
                            id={`edu-em-${edu.id}`}
                            name="endMonth"
                            defaultValue={edu.end_month}
                          />
                          <YearInput
                            id={`edu-ey-${edu.id}`}
                            name="endYear"
                            defaultValue={edu.end_year}
                          />
                        </div>
                        <Field label="Description" htmlFor={`edu-desc-${edu.id}`}>
                          <textarea
                            id={`edu-desc-${edu.id}`}
                            name="description"
                            rows={2}
                            defaultValue={edu.description || ''}
                            className={INPUT}
                          />
                        </Field>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={saving}
                            className="btn btn-primary !min-h-[40px] !py-2 text-sm">
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="btn btn-ghost !min-h-[40px] !py-2 text-sm">
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <article key={edu.id} className="card card-pad">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-[15px] font-semibold text-[var(--ink)]">
                              {edu.institution}
                            </h3>
                            <p className="text-sm text-[var(--muted-foreground)]">
                              {[edu.degree, edu.field_of_study].filter(Boolean).join(' — ')}
                            </p>
                            <p className="text-xs text-[var(--faint-foreground)] mt-0.5">
                              {formatDateRange({
                                startYear: edu.start_year,
                                startMonth: edu.start_month,
                                endYear: edu.end_year,
                                endMonth: edu.end_month,
                                current: !edu.end_year,
                              })}
                            </p>
                          </div>
                          <CardActions
                            onEdit={() => toggleEdit(`education:${edu.id}`)}
                            onDelete={() => void handleEducationDelete(edu.id)}
                            onMoveUp={() => void handleMove('education', idx, -1)}
                            onMoveDown={() => void handleMove('education', idx, 1)}
                            canMoveUp={idx > 0}
                            canMoveDown={idx < profile.education.length - 1}
                            deleteLabel={`Delete ${edu.institution}`}
                          />
                        </div>
                        {edu.description && (
                          <p className="text-sm text-[var(--muted-foreground)] mt-2">
                            {edu.description}
                          </p>
                        )}
                      </article>
                    )
                  )}
                </div>
              )}

              <form
                onSubmit={(e) => void handleEducationAdd(e)}
                className="card card-pad space-y-4">
                <h3 className="text-sm font-semibold text-[var(--ink)]">Add education</h3>
                <Field label="Institution" htmlFor="edu-new-inst">
                  <input
                    id="edu-new-inst"
                    name="institution"
                    type="text"
                    required
                    className={INPUT}
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Degree" htmlFor="edu-new-degree">
                    <input id="edu-new-degree" name="degree" type="text" className={INPUT} />
                  </Field>
                  <Field label="Field of study" htmlFor="edu-new-field">
                    <input id="edu-new-field" name="fieldOfStudy" type="text" className={INPUT} />
                  </Field>
                </div>
                <fieldset className="border-0 p-0 m-0">
                  <legend className="field-label">Dates</legend>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MonthSelect id="edu-new-sm" name="startMonth" />
                    <YearInput id="edu-new-sy" name="startYear" />
                    <MonthSelect id="edu-new-em" name="endMonth" />
                    <YearInput id="edu-new-ey" name="endYear" />
                  </div>
                </fieldset>
                <Field label="Description" htmlFor="edu-new-desc">
                  <textarea id="edu-new-desc" name="description" rows={2} className={INPUT} />
                </Field>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Adding…' : 'Add education'}
                </button>
              </form>
            </div>
          )}

          {activeSection === 'projects' && (
            <div>
              <h2 className="section-title mb-1">Projects</h2>
              <p className="text-sm text-[var(--muted-foreground)] mb-5">
                Proof you can ship — link the live version and the code.
              </p>

              {profile.projects.length === 0 ? (
                <EmptyState
                  title="No projects yet"
                  body="Projects show what you actually build. Even one strong project with a live link makes a difference."
                  cta="Add a project below"
                />
              ) : (
                <div className="space-y-3 mb-6">
                  {profile.projects.map((project, idx) =>
                    isEditing(`projects:${project.id}`) ? (
                      <form
                        key={project.id}
                        onSubmit={(e) => {
                          e.preventDefault();
                          const fd = new FormData(e.currentTarget);
                          void handleRowUpdate('projects', project.id, {
                            name: fd.get('name') as string,
                            description: (fd.get('description') as string) || null,
                            project_url: (fd.get('projectUrl') as string) || null,
                            repository_url: (fd.get('repositoryUrl') as string) || null,
                          });
                        }}
                        className="card card-pad border-[var(--accent)] space-y-4">
                        <p className="text-sm font-semibold text-[var(--accent)]">
                          Editing project
                        </p>
                        <Field label="Name" htmlFor={`proj-name-${project.id}`}>
                          <input
                            id={`proj-name-${project.id}`}
                            name="name"
                            defaultValue={project.name}
                            required
                            className={INPUT}
                          />
                        </Field>
                        <Field label="Description" htmlFor={`proj-desc-${project.id}`}>
                          <textarea
                            id={`proj-desc-${project.id}`}
                            name="description"
                            rows={3}
                            defaultValue={project.description || ''}
                            className={INPUT}
                          />
                        </Field>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Field label="Project URL" htmlFor={`proj-url-${project.id}`}>
                            <input
                              id={`proj-url-${project.id}`}
                              name="projectUrl"
                              type="url"
                              defaultValue={project.project_url || ''}
                              className={INPUT}
                            />
                          </Field>
                          <Field label="Repository URL" htmlFor={`proj-repo-${project.id}`}>
                            <input
                              id={`proj-repo-${project.id}`}
                              name="repositoryUrl"
                              type="url"
                              defaultValue={project.repository_url || ''}
                              className={INPUT}
                            />
                          </Field>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={saving}
                            className="btn btn-primary !min-h-[40px] !py-2 text-sm">
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="btn btn-ghost !min-h-[40px] !py-2 text-sm">
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <article key={project.id} className="card card-pad">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                aria-hidden="true"
                                className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                                  <path
                                    d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                  />
                                </svg>
                              </span>
                              <h3 className="text-[15px] font-semibold text-[var(--ink)] truncate">
                                {project.name}
                              </h3>
                            </div>
                            {project.description && (
                              <p className="text-sm text-[var(--muted-foreground)] mt-2 leading-relaxed">
                                {project.description}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-xs font-medium">
                              {project.project_url && (
                                <a
                                  href={sanitizeUrl(project.project_url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline">
                                  Live ↗
                                </a>
                              )}
                              {project.repository_url && (
                                <a
                                  href={sanitizeUrl(project.repository_url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[var(--muted-foreground)] hover:text-[var(--ink)] hover:underline">
                                  <LinkIcon label="GitHub" url={project.repository_url} size={13} />
                                  Source
                                </a>
                              )}
                            </div>
                          </div>
                          <CardActions
                            onEdit={() => toggleEdit(`projects:${project.id}`)}
                            onDelete={() => void handleProjectDelete(project.id)}
                            onMoveUp={() => void handleMove('projects', idx, -1)}
                            onMoveDown={() => void handleMove('projects', idx, 1)}
                            canMoveUp={idx > 0}
                            canMoveDown={idx < profile.projects.length - 1}
                            deleteLabel={`Delete project ${project.name}`}
                          />
                        </div>
                      </article>
                    )
                  )}
                </div>
              )}

              <form onSubmit={(e) => void handleProjectAdd(e)} className="card card-pad space-y-4">
                <h3 className="text-sm font-semibold text-[var(--ink)]">Add project</h3>
                <Field label="Name" htmlFor="proj-new-name">
                  <input id="proj-new-name" name="name" type="text" required className={INPUT} />
                </Field>
                <Field
                  label="Description"
                  htmlFor="proj-new-desc"
                  hint="What it does and why it matters — one or two lines.">
                  <textarea id="proj-new-desc" name="description" rows={3} className={INPUT} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Project URL" htmlFor="proj-new-url">
                    <input
                      id="proj-new-url"
                      name="projectUrl"
                      type="url"
                      placeholder="https://"
                      className={INPUT}
                    />
                  </Field>
                  <Field label="Repository URL" htmlFor="proj-new-repo">
                    <input
                      id="proj-new-repo"
                      name="repositoryUrl"
                      type="url"
                      placeholder="https://github.com/…"
                      className={INPUT}
                    />
                  </Field>
                </div>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Adding…' : 'Add project'}
                </button>
              </form>
            </div>
          )}

          {activeSection === 'skills' && (
            <div>
              <h2 className="section-title mb-1">Skills</h2>
              <p className="text-sm text-[var(--muted-foreground)] mb-5">
                The tools and technologies you actually use — they surface in job matching and on
                your portfolio.
              </p>

              {profile.skills.length === 0 ? (
                <EmptyState
                  title="No skills yet"
                  body="Skills help recruiters and job tailoring find the match between you and a role."
                  cta="Add your first skill below"
                />
              ) : (
                <div className="flex flex-wrap gap-2 mb-6">
                  {profile.skills.map((skill) => (
                    <span key={skill.id} className="chip !py-1.5 !pr-1.5 gap-1.5">
                      {skill.name}
                      {skill.category && (
                        <span className="text-[10px] uppercase tracking-wide text-[var(--faint-foreground)]">
                          {skill.category}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleSkillDelete(skill.id)}
                        aria-label={`Remove skill ${skill.name}`}
                        className="w-6 h-6 -mr-1 rounded-full text-[var(--faint-foreground)] hover:bg-[var(--danger-surface)] hover:text-[var(--danger)] inline-flex items-center justify-center">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M6 6l12 12M18 6 6 18"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <form onSubmit={(e) => void handleSkillAdd(e)} className="card card-pad space-y-4">
                <h3 className="text-sm font-semibold text-[var(--ink)]">Add skill</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Skill name" htmlFor="skill-new-name">
                    <input id="skill-new-name" name="name" type="text" required className={INPUT} />
                  </Field>
                  <Field
                    label="Category"
                    htmlFor="skill-new-cat"
                    hint="Optional grouping — e.g., Languages, Cloud.">
                    <input
                      id="skill-new-cat"
                      name="category"
                      type="text"
                      placeholder="e.g., Languages"
                      className={INPUT}
                    />
                  </Field>
                </div>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Adding…' : 'Add skill'}
                </button>
              </form>
            </div>
          )}

          {activeSection === 'links' && (
            <div>
              <h2 className="section-title mb-1">Links</h2>
              <p className="text-sm text-[var(--muted-foreground)] mb-5">
                Where recruiters can verify and explore further — GitHub, LinkedIn, your own site.
              </p>

              {profile.links.length === 0 ? (
                <EmptyState
                  title="No links yet"
                  body="A GitHub or portfolio link turns claims into evidence visitors can check."
                  cta="Add a link below"
                />
              ) : (
                <div className="space-y-3 mb-6">
                  {profile.links.map((link, idx) =>
                    isEditing(`links:${link.id}`) ? (
                      <form
                        key={link.id}
                        onSubmit={(e) => {
                          e.preventDefault();
                          const fd = new FormData(e.currentTarget);
                          const rawUrl = fd.get('url');
                          const url = (typeof rawUrl === 'string' ? rawUrl : '').trim();
                          if (!isHttpUrl(url)) {
                            setError('Links must be a full http:// or https:// address.');
                            return;
                          }
                          void handleRowUpdate('links', link.id, {
                            label: fd.get('label') as string,
                            url,
                          });
                        }}
                        className="card card-pad border-[var(--accent)] space-y-4">
                        <p className="text-sm font-semibold text-[var(--accent)]">Editing link</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Field label="Label" htmlFor={`link-label-${link.id}`}>
                            <input
                              id={`link-label-${link.id}`}
                              name="label"
                              defaultValue={link.label}
                              required
                              className={INPUT}
                            />
                          </Field>
                          <Field label="URL" htmlFor={`link-url-${link.id}`}>
                            <input
                              id={`link-url-${link.id}`}
                              name="url"
                              type="url"
                              defaultValue={link.url}
                              required
                              className={INPUT}
                            />
                          </Field>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={saving}
                            className="btn btn-primary !min-h-[40px] !py-2 text-sm">
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="btn btn-ghost !min-h-[40px] !py-2 text-sm">
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <article key={link.id} className="card card-pad">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              aria-hidden="true"
                              className="w-9 h-9 rounded-lg bg-[var(--surface-muted)] text-[var(--ink)] flex items-center justify-center shrink-0">
                              <LinkIcon label={link.label} url={link.url} size={16} />
                            </span>
                            <div className="min-w-0">
                              <h3 className="text-[15px] font-semibold text-[var(--ink)]">
                                {link.label}
                              </h3>
                              <a
                                href={sanitizeUrl(link.url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[var(--muted-foreground)] hover:text-[var(--accent)] truncate block max-w-[40ch]">
                                {link.url}
                              </a>
                            </div>
                          </div>
                          <CardActions
                            onEdit={() => toggleEdit(`links:${link.id}`)}
                            onDelete={() => void handleLinkDelete(link.id)}
                            onMoveUp={() => void handleMove('links', idx, -1)}
                            onMoveDown={() => void handleMove('links', idx, 1)}
                            canMoveUp={idx > 0}
                            canMoveDown={idx < profile.links.length - 1}
                            deleteLabel={`Remove link ${link.label}`}
                          />
                        </div>
                      </article>
                    )
                  )}
                </div>
              )}

              <form onSubmit={(e) => void handleLinkAdd(e)} className="card card-pad space-y-4">
                <h3 className="text-sm font-semibold text-[var(--ink)]">Add link</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Label" htmlFor="link-new-label">
                    <input
                      id="link-new-label"
                      name="label"
                      type="text"
                      required
                      placeholder="e.g., LinkedIn, GitHub"
                      className={INPUT}
                    />
                  </Field>
                  <Field label="URL" htmlFor="link-new-url">
                    <input
                      id="link-new-url"
                      name="url"
                      type="url"
                      required
                      placeholder="https://"
                      className={INPUT}
                    />
                  </Field>
                </div>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Adding…' : 'Add link'}
                </button>
              </form>
            </div>
          )}

          {activeSection === 'achievements' && (
            <div>
              <h2 className="section-title mb-1">Achievements</h2>
              <p className="text-sm text-[var(--muted-foreground)] mb-5">
                Concrete wins worth bragging about — what you did, how, and what changed. Featured
                achievements lead your public portfolio's "Featured work" section.
              </p>

              {achievements.length === 0 ? (
                <EmptyState
                  title="No achievements yet"
                  body="Capture a win while it's fresh: the result, the number, the timeframe. These become the strongest part of your portfolio."
                  cta="Add an achievement below"
                />
              ) : (
                <div className="space-y-3 mb-6">
                  {achievements.map((a, idx) => (
                    <article key={a.id} className="card card-pad">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[15px] font-semibold text-[var(--ink)]">{a.title}</h3>
                          {a.metric_text && (
                            <p
                              className="text-sm font-medium mt-0.5"
                              style={{ color: 'var(--accent-text)' }}>
                              {a.metric_text}
                            </p>
                          )}
                          {a.description && (
                            <p className="text-sm text-[var(--muted-foreground)] mt-1.5 leading-relaxed">
                              {a.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[11px]">
                            {a.timeframe && (
                              <span className="status-chip !text-[10px]">{a.timeframe}</span>
                            )}
                            {a.is_featured && (
                              <span className="status-chip status-chip-live !text-[10px]">
                                Featured
                              </span>
                            )}
                            <span className="text-[var(--faint-foreground)]">
                              {a.is_public
                                ? 'Public on your portfolio'
                                : 'Private (never shown publicly)'}
                            </span>
                            {a.source_url && (
                              <a
                                href={sanitizeUrl(a.source_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--muted-foreground)] hover:text-[var(--accent)] underline underline-offset-2">
                                Source
                              </a>
                            )}
                          </div>
                        </div>
                        <CardActions
                          onEdit={() => toggleEdit(`achievements:${a.id}`)}
                          onDelete={() => void handleAchievementDelete(a.id)}
                          onMoveUp={() => void handleAchievementMove(idx, -1)}
                          onMoveDown={() => void handleAchievementMove(idx, 1)}
                          canMoveUp={idx > 0}
                          canMoveDown={idx < achievements.length - 1}
                          deleteLabel={`Delete achievement ${a.title}`}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <form
                onSubmit={(e) => void handleAchievementAdd(e)}
                className="card card-pad space-y-4">
                <h3 className="text-sm font-semibold text-[var(--ink)]">Add achievement</h3>
                <Field
                  label="Title"
                  htmlFor="ach-new-title"
                  hint="What did you accomplish? e.g. “Led migration to a zero-downtime deploy pipeline”.">
                  <input
                    id="ach-new-title"
                    name="title"
                    type="text"
                    required
                    maxLength={200}
                    className={INPUT}
                  />
                </Field>
                <Field
                  label="Result (optional)"
                  htmlFor="ach-new-metric"
                  hint="What changed — in your own words. No need to invent numbers.">
                  <input
                    id="ach-new-metric"
                    name="metricText"
                    type="text"
                    maxLength={300}
                    placeholder="e.g., Deploys went from weekly and risky to daily and boring"
                    className={INPUT}
                  />
                </Field>
                <Field label="How (optional)" htmlFor="ach-new-desc">
                  <textarea
                    id="ach-new-desc"
                    name="description"
                    rows={3}
                    maxLength={2000}
                    className={INPUT}
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Timeframe (optional)" htmlFor="ach-new-time">
                    <input
                      id="ach-new-time"
                      name="timeframe"
                      type="text"
                      maxLength={60}
                      placeholder="e.g., Q2 2026, 6 weeks"
                      className={INPUT}
                    />
                  </Field>
                  <Field label="Source URL (optional)" htmlFor="ach-new-source">
                    <input
                      id="ach-new-source"
                      name="sourceUrl"
                      type="url"
                      maxLength={500}
                      placeholder="https://"
                      className={INPUT}
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-5">
                  <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                    <input type="checkbox" name="featured" className="h-4 w-4" />
                    Featured (shows first, in "Featured work")
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                    <input type="checkbox" name="isPublic" className="h-4 w-4" />
                    Public on my portfolio
                  </label>
                </div>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Adding…' : 'Add achievement'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Live portfolio preview — sticky on wide desktop */}
        <aside
          className="hidden xl:block w-[360px] flex-shrink-0"
          aria-label="Live portfolio preview">
          <div className="sticky top-24">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--faint-foreground)]">
                Live preview
              </p>
              <Link
                to="/dashboard/appearance"
                className="text-xs font-semibold link-underline"
                style={{ color: 'var(--accent-text)' }}>
                Appearance
              </Link>
            </div>
            <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-warm)]">
                <span className="w-2 h-2 rounded-full bg-[#ff5f57]" aria-hidden="true" />
                <span className="w-2 h-2 rounded-full bg-[#febc2e]" aria-hidden="true" />
                <span className="w-2 h-2 rounded-full bg-[#28c840]" aria-hidden="true" />
                <span className="ml-1.5 text-[10px] text-[var(--faint-foreground)] truncate">
                  /u/{profile.username}
                </span>
              </div>
              <TemplateCanvas
                templateKey={preferences?.template_key || 'minimal'}
                profile={profile}
                preferences={previewProps}
                scale={0.46}
                height={430}
                label="Live portfolio preview"
              />
            </div>
            <p className="mt-3 text-xs text-[var(--faint-foreground)]">
              Updates as you edit. Recruiters see this.
            </p>
          </div>
        </aside>
      </div>

      {/* Mobile / tablet preview sheet */}
      {previewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Live portfolio preview"
          className="fixed inset-0 z-50 bg-[var(--background)] flex flex-col xl:hidden">
          <div className="flex items-center justify-between px-4 sm:px-6 h-16 border-b border-[var(--border)] bg-white">
            <p className="text-sm font-semibold text-[var(--ink)]">Live preview</p>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              autoFocus
              className="btn btn-secondary !min-h-[40px] !py-2 text-sm">
              Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-white shadow-[var(--shadow-card)] max-w-2xl mx-auto">
              <TemplateCanvas
                templateKey={preferences?.template_key || 'minimal'}
                profile={profile}
                preferences={previewProps}
                scale={0.6}
                height={520}
                label="Live portfolio preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
