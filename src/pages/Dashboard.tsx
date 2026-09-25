import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { ProfileService } from '../lib/profiles/service';
import { profileCompletion } from '../lib/profiles/completion';
import PublishControls from '../components/PublishControls';
import { BrandMark } from '../components/Brand';
import type { ProfileWithRelations } from '../lib/profiles/repository';

const ICONS: Record<string, React.ReactNode> = {
  profile: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.7}
      d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21a8 8 0 0 1 16 0"
    />
  ),
  palette: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.7}
      d="M12 21a9 9 0 1 1 0-18c4.97 0 9 3.58 9 8 0 2.21-1.79 4-4 4h-1.26a1.74 1.74 0 0 0-1.21 2.97c.36.38.57.9.57 1.45A2.58 2.58 0 0 1 12 21Z"
    />
  ),
  eye: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.7}
      d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
    />
  ),
  upload: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.7}
      d="M12 16V4m0 0 4 4m-4-4L8 8M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
    />
  ),
  doc: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.7}
      d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 0v5h5M9 13h6M9 17h6"
    />
  ),
  target: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.7}
      d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0-3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
    />
  ),
};

const ACTION_GROUPS: {
  title: string;
  links: { to: string; label: string; hint: string; icon: string; primary?: boolean }[];
}[] = [
  {
    title: 'Profile',
    links: [
      {
        to: '/dashboard/profile',
        label: 'Edit profile',
        hint: 'Basics, experience, skills and links',
        icon: 'profile',
        primary: true,
      },
      {
        to: '/dashboard/preview',
        label: 'Preview portfolio',
        hint: 'See exactly what visitors see',
        icon: 'eye',
      },
      {
        to: '/dashboard/appearance',
        label: 'Appearance',
        hint: 'Template, accent and section order',
        icon: 'palette',
      },
    ],
  },
  {
    title: 'Resume',
    links: [
      {
        to: '/dashboard/resume',
        label: 'Import resume',
        hint: 'Upload a PDF to start your profile',
        icon: 'upload',
      },
      {
        to: '/dashboard/resume/ats',
        label: 'ATS resume',
        hint: 'Download a parseable PDF',
        icon: 'doc',
      },
      {
        to: '/dashboard/resume/tailor',
        label: 'Job tailoring',
        hint: 'Match your profile to a description',
        icon: 'target',
      },
    ],
  },
];

function ActionIcon({ name, dark }: { name: string; dark?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
        dark ? 'bg-white/15 text-white' : 'bg-[var(--accent-soft)] text-[var(--accent)]'
      }`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        {ICONS[name]}
      </svg>
    </span>
  );
}

function PortfolioHero({
  profile,
  isPublished,
  onPublishChange,
}: {
  profile: ProfileWithRelations;
  isPublished: boolean;
  onPublishChange: (published: boolean) => void;
}) {
  const publicUrl = `${window.location.origin}/u/${profile.username}`;
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (isPublished) {
    return (
      <section
        className="rounded-2xl bg-[#0b1220] text-white p-5 sm:p-6 shadow-[var(--shadow-pop)]"
        aria-label="Your portfolio">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            Live
          </span>
          <span className="text-xs text-white/60">Your portfolio is live</span>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Mini thumbnail */}
          <div className="hidden sm:block w-40 shrink-0 rounded-lg bg-white text-[#0b1220] p-3 border border-white/10">
            <div className="flex items-center gap-1.5">
              <BrandMark size={14} />
              <span className="text-[10px] font-bold truncate">
                {profile.display_name || profile.username}
              </span>
            </div>
            <p className="text-[9px] text-gray-500 mt-1 line-clamp-2 leading-snug">
              {profile.headline || 'Career profile'}
            </p>
            <div className="mt-2 space-y-1" aria-hidden="true">
              <span className="block h-1 w-full rounded bg-gray-100" />
              <span className="block h-1 w-4/5 rounded bg-gray-100" />
              <span className="block h-1 w-3/5 rounded bg-gray-100" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm text-blue-300 truncate" title={publicUrl}>
              {publicUrl.replace(window.location.origin, '')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to={`/u/${profile.username}`}
                className="btn btn-accent !min-h-[40px] !py-2 !px-4 text-sm">
                Open portfolio
              </Link>
              <button
                type="button"
                onClick={() => void copyLink()}
                className="btn !min-h-[40px] !py-2 !px-4 text-sm bg-white/10 text-white border border-white/20 hover:bg-white/15">
                {copied ? 'Copied ✓' : 'Copy link'}
              </button>
              <span role="status" aria-live="polite" className="sr-only">
                {copied ? 'Link copied to clipboard' : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-white/10">
          <PublishControls
            profileId={profile.id}
            isPublished={isPublished}
            onPublishChange={onPublishChange}
            variant="dark"
          />
        </div>
      </section>
    );
  }

  return (
    <section className="card card-pad" aria-label="Your portfolio">
      <div className="flex flex-wrap items-center gap-2">
        <span className="status-chip">Draft</span>
        <span className="text-xs text-[var(--faint-foreground)]">
          Your portfolio is private until you publish
        </span>
      </div>
      <p className="mt-3 text-sm text-[var(--muted-foreground)]">
        Finish your profile, preview how it looks, then publish to get a shareable link.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/dashboard/profile" className="btn btn-primary !min-h-[40px] !py-2 !px-4 text-sm">
          Finish profile
        </Link>
        <Link
          to="/dashboard/preview"
          className="btn btn-secondary !min-h-[40px] !py-2 !px-4 text-sm">
          Preview
        </Link>
      </div>
      <div className="mt-5 pt-4 border-t border-[var(--border)]">
        <PublishControls
          profileId={profile.id}
          isPublished={isPublished}
          onPublishChange={onPublishChange}
        />
      </div>
    </section>
  );
}

export default function Dashboard() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileWithRelations | null>(null);
  const [loading, setLoading] = useState(true);

  const profileService = new ProfileService();

  useEffect(() => {
    if (auth.status === 'authenticated') {
      void profileService.getProfile(auth.user.id).then((p) => {
        setProfile(p);
        setLoading(false);
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

  if (auth.status === 'loading' || loading) {
    return (
      <div className="page-shell">
        <div className="space-y-4" aria-label="Loading dashboard" role="status">
          <div className="skeleton h-8 w-56" />
          <div className="skeleton h-4 w-72" />
          <div className="skeleton h-40 w-full rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
            <div className="skeleton h-56" />
            <div className="skeleton h-56" />
          </div>
        </div>
      </div>
    );
  }

  if (auth.status === 'unauthenticated' || !profile) {
    return null;
  }

  const { items: completionItems, percentage } = profileCompletion(profile);
  const isPublished = profile.visibility === 'published';

  const handleSignOut = () => {
    void auth.signOut();
  };

  const setVisibility = (published: boolean) =>
    setProfile({
      ...profile,
      visibility: published ? 'published' : 'draft',
      published_at: published ? new Date().toISOString() : null,
    });

  return (
    <div className="page-shell">
      <div className="mb-5">
        <p className="text-sm text-[var(--faint-foreground)]">Welcome back,</p>
        <h1 className="page-title">{profile.display_name || profile.username}</h1>
      </div>

      <PortfolioHero profile={profile} isPublished={isPublished} onPublishChange={setVisibility} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
        <section className="card card-pad lg:col-span-3" aria-labelledby="completion-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="completion-heading" className="section-title">
              Profile completion
            </h2>
            <span className="text-sm font-semibold text-[var(--ink)]">{percentage}%</span>
          </div>
          <div
            className="mt-3 h-2 rounded-full bg-[var(--surface-muted)]"
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile completion">
            <div
              className="h-2 rounded-full bg-[var(--ink)] transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <ul className="mt-5 divide-y divide-[var(--border)]">
            {completionItems.map((item) => (
              <li key={item.label} className="flex items-center gap-3 py-2.5 first:pt-0">
                <span
                  aria-hidden="true"
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                    item.completed
                      ? 'bg-[var(--success)] text-white'
                      : 'bg-[var(--surface-muted)] text-[var(--faint-foreground)]'
                  }`}>
                  {item.completed ? '✓' : '·'}
                </span>
                <span
                  className={`text-sm ${item.completed ? 'text-[var(--ink)]' : 'text-[var(--muted-foreground)]'}`}>
                  {item.label}
                </span>
                <span className="ml-auto text-xs font-medium text-[var(--faint-foreground)]">
                  {item.detail}
                </span>
              </li>
            ))}
          </ul>
          {percentage < 100 && (
            <Link to="/dashboard/profile" className="btn btn-primary btn-block mt-6">
              Continue building your profile
            </Link>
          )}
          {percentage === 100 && (
            <p className="mt-5 text-xs text-center text-[var(--success)] font-medium">
              Everything required is in place. Nice work.
            </p>
          )}
        </section>

        <section className="card card-pad lg:col-span-2" aria-labelledby="status-heading">
          <h2 id="status-heading" className="section-title">
            Profile status
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--muted-foreground)]">Username</dt>
              <dd className="font-medium text-[var(--ink)]">@{profile.username}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--muted-foreground)]">Status</dt>
              <dd>
                <span className={`status-chip ${isPublished ? 'status-chip-live' : ''}`}>
                  {profile.visibility}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--muted-foreground)]">Last updated</dt>
              <dd className="text-[var(--ink)]">
                {new Date(profile.updated_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>
          <button onClick={handleSignOut} className="btn btn-secondary btn-block mt-6">
            Sign out
          </button>
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {ACTION_GROUPS.map((group) => (
          <section
            key={group.title}
            className="card card-pad"
            aria-label={`${group.title} actions`}>
            <h2 className="section-title mb-4">{group.title}</h2>
            <div className="space-y-2">
              {group.links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    link.primary
                      ? 'bg-[var(--ink)] text-white border-[var(--ink)] hover:bg-[#1d2939]'
                      : 'bg-white text-[var(--ink)] border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]'
                  }`}>
                  <ActionIcon name={link.icon} dark={link.primary} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold">{link.label}</span>
                    <span
                      className={`block text-xs truncate ${link.primary ? 'text-white/60' : 'text-[var(--faint-foreground)]'}`}>
                      {link.hint}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={link.primary ? 'text-white/50' : 'text-[var(--faint-foreground)]'}>
                    →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
