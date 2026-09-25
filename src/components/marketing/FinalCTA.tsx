import { Link } from 'react-router';
import { useAuth } from '../../lib/auth/context';
import { Reveal } from './Reveal';

export function FinalCTA() {
  const auth = useAuth();
  const primaryTo = auth.status === 'authenticated' ? '/dashboard/resume' : '/signup';

  return (
    <section className="border-t border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
        <Reveal>
          <div
            className="rounded-[28px] px-6 sm:px-14 py-14 sm:py-20 text-center"
            style={{ background: 'var(--navy-surface)' }}>
            <h2
              className="text-white"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.125rem, 1.4rem + 2.8vw, 3.75rem)',
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                fontWeight: 600,
              }}>
              Your career, ready to share.
            </h2>
            <p className="mt-5 text-base sm:text-lg text-white/70 max-w-xl mx-auto leading-relaxed">
              Start with your CV. Leave with a profile, a resume and a link worth sending.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row justify-center gap-3">
              <Link
                to={primaryTo}
                className="btn w-full sm:w-auto"
                style={{ background: 'var(--accent)', color: 'white' }}>
                Import your CV
              </Link>
              <Link
                to="/#templates"
                className="btn w-full sm:w-auto border border-white/25 text-white hover:bg-white/10"
                style={{ background: 'transparent' }}>
                See a live profile
              </Link>
            </div>
            <p className="mt-6 text-xs text-white/50">
              Free to start · Export your resume anytime · Yours to publish when ready
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
