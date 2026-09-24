import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { ProfileService } from '../lib/profiles/service';
import { profileCompletion } from '../lib/profiles/completion';
import PublishControls from '../components/PublishControls';
import type { ProfileWithRelations } from '../lib/profiles/repository';

const ACTION_GROUPS: {
  title: string;
  links: { to: string; label: string; hint: string; primary?: boolean }[];
}[] = [
  {
    title: 'Profile',
    links: [
      {
        to: '/dashboard/profile',
        label: 'Edit profile',
        hint: 'Basics, experience, skills and links',
        primary: true,
      },
      { to: '/dashboard/preview', label: 'Preview portfolio', hint: 'See what visitors will see' },
      { to: '/dashboard/appearance', label: 'Appearance', hint: 'Template, accent and sections' },
    ],
  },
  {
    title: 'Resume',
    links: [
      {
        to: '/dashboard/resume',
        label: 'Import resume',
        hint: 'Upload a PDF to fill your profile',
      },
      { to: '/dashboard/resume/ats', label: 'ATS resume', hint: 'Generate a parseable PDF' },
      { to: '/dashboard/resume/tailor', label: 'Job tailoring', hint: 'Match a job description' },
    ],
  },
];

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="skeleton h-48" />
            <div className="skeleton h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (auth.status === 'unauthenticated' || !profile) {
    return null;
  }

  const { items: completionItems, completedCount, percentage } = profileCompletion(profile);
  const isPublished = profile.visibility === 'published';

  const handleSignOut = () => {
    void auth.signOut();
  };

  return (
    <div className="page-shell">
      <div className="mb-6">
        <p className="text-sm text-gray-500">Welcome back,</p>
        <h1 className="page-title">{profile.display_name || profile.username}</h1>
        <p className="page-subtitle">
          {isPublished
            ? 'Your portfolio is live.'
            : 'Finish the steps below to publish your portfolio.'}
        </p>
      </div>

      {isPublished ? (
        <div className="alert alert-success mb-6 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span aria-hidden="true">●</span>
          <span>
            Published at{' '}
            <Link to={`/u/${profile.username}`} className="font-semibold underline">
              /u/{profile.username}
            </Link>
          </span>
        </div>
      ) : (
        <div className="alert alert-info mb-6">
          Your profile is a draft. Only you can see it until you publish.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className="card card-pad lg:col-span-3" aria-labelledby="completion-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="completion-heading" className="section-title">
              Profile completion
            </h2>
            <span className="text-sm font-semibold text-gray-900">{percentage}%</span>
          </div>
          <div
            className="mt-3 h-2.5 rounded-full bg-gray-200"
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile completion">
            <div
              className="h-2.5 rounded-full bg-gray-900 transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <ul className="mt-5 space-y-2.5">
            {completionItems.map((item) => (
              <li key={item.label} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    item.completed ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                  {item.completed ? '✓' : '·'}
                </span>
                <span className={item.completed ? 'text-gray-900' : 'text-gray-500'}>
                  {item.label}
                </span>
                <span className="ml-auto text-xs text-gray-400">
                  {completedCount}/{completionItems.length}
                </span>
              </li>
            ))}
          </ul>
          {percentage < 100 && (
            <Link to="/dashboard/profile" className="btn btn-primary btn-block mt-6">
              Continue building your profile
            </Link>
          )}
        </section>

        <section className="card card-pad lg:col-span-2" aria-labelledby="status-heading">
          <h2 id="status-heading" className="section-title">
            Profile status
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-500">Username</dt>
              <dd className="font-medium text-gray-900">@{profile.username}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-500">Status</dt>
              <dd>
                <span className={`status-chip ${isPublished ? 'status-chip-live' : ''}`}>
                  {profile.visibility}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-500">Last updated</dt>
              <dd className="text-gray-900">{new Date(profile.updated_at).toLocaleDateString()}</dd>
            </div>
          </dl>
          <div className="mt-6">
            <PublishControls
              profileId={profile.id}
              isPublished={isPublished}
              onPublishChange={(published) =>
                setProfile({
                  ...profile,
                  visibility: published ? 'published' : 'draft',
                })
              }
            />
          </div>
          <button onClick={handleSignOut} className="btn btn-secondary btn-block mt-4">
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
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                    link.primary
                      ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
                      : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50'
                  }`}>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold">{link.label}</span>
                    <span
                      className={`block text-xs truncate ${link.primary ? 'text-gray-300' : 'text-gray-500'}`}>
                      {link.hint}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={link.primary ? 'text-gray-300' : 'text-gray-400'}>
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
