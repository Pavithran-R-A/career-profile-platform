import { Link } from 'react-router';
import { useAuth } from '../../lib/auth/context';
import { HeroProductComposition } from './HeroProductComposition';

const TRUST = ['Free to start', 'Export your resume anytime', 'Yours to publish when ready'];

export function Hero() {
  const auth = useAuth();
  const primaryTo = auth.status === 'authenticated' ? '/dashboard/resume' : '/signup';
  const primaryLabel = auth.status === 'authenticated' ? 'Import your CV' : 'Import your CV';

  return (
    <section className="relative overflow-hidden">
      {/* subtle grid lines */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-[0.5]"
        style={{
          backgroundImage:
            'linear-gradient(rgb(12 28 48 / 0.045) 1px, transparent 1px), linear-gradient(90deg, rgb(12 28 48 / 0.045) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
        }}
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-14 sm:pt-20 pb-20 sm:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-14 items-center">
          <div>
            <p className="t-eyebrow rise">CareerProfile Go — your career, ready to go</p>
            <h1 className="t-hero mt-5 rise rise-1">
              Your career, turned into a profile{' '}
              <span className="t-accent-phrase">recruiters remember.</span>
            </h1>
            <p className="t-lead mt-6 max-w-xl rise rise-2">
              Save your CV, build your career profile, export an ATS-ready resume and share your
              portfolio. Tailor it to your next job — automatic CV extraction is available only when
              the service is enabled.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3 rise rise-3">
              <Link
                to={primaryTo}
                className="btn w-full sm:w-auto !min-h-[52px] !px-7 !text-base"
                style={{ background: 'var(--accent)', color: 'white' }}>
                {primaryLabel}
              </Link>
              <Link
                to="/#templates"
                className="btn btn-secondary w-full sm:w-auto !min-h-[52px] !px-7 !text-base">
                See a live profile
              </Link>
            </div>

            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 rise rise-4">
              {TRUST.map((t) => (
                <li
                  key={t}
                  className="flex items-center gap-2 text-[13px] text-[var(--muted-foreground)]">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="7.25" stroke="var(--teal)" strokeWidth="1.5" />
                    <path
                      d="M4.75 8.25 7 10.5l4.25-5"
                      stroke="var(--teal)"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="rise rise-2 lg:mt-4">
            <HeroProductComposition />
          </div>
        </div>
      </div>
    </section>
  );
}
