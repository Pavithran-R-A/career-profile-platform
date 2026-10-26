import type { ATSResumeViewModel } from '../lib/resume/ats-view-model';
import { runATSChecks, type ATSCheckResult } from '../lib/resume/ats-checker';

const SEVERITY_STYLES: Record<ATSCheckResult['severity'], { label: string; cls: string }> = {
  error: {
    label: 'Needs attention',
    cls: 'border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger)]',
  },
  warning: {
    label: 'Needs attention',
    cls: 'border-[var(--warning-border)] bg-[var(--warning-surface)] text-[var(--warning)]',
  },
  info: {
    label: 'Optional improvement',
    cls: 'border-[var(--info-border)] bg-[var(--info-surface)] text-[var(--info)]',
  },
};

/**
 * Deterministic, human-readable resume guidance. Deliberately no numeric
 * score: the checks either pass, need attention, or are optional polish.
 */
export default function ATSGuidance({ viewModel }: { viewModel: ATSResumeViewModel }) {
  const checks = runATSChecks(viewModel);
  const errors = checks.filter((c) => c.severity === 'error');
  const warnings = checks.filter((c) => c.severity === 'warning');
  const infos = checks.filter((c) => c.severity === 'info');

  const healthy = errors.length === 0 && warnings.length === 0;

  return (
    <section className="card card-pad" aria-labelledby="ats-guidance-heading">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 id="ats-guidance-heading" className="section-title">
          Builder guidance
        </h2>
        <span
          className={`status-chip !text-[11px] ${healthy ? 'status-chip-live' : 'status-chip-danger'}`}>
          {healthy
            ? 'Looks good'
            : `${errors.length + warnings.length} item${errors.length + warnings.length === 1 ? '' : 's'} need attention`}
        </span>
      </div>

      {healthy && infos.length === 0 && (
        <p className="text-sm text-[var(--muted-foreground)]">
          Your resume covers what automated parsers look for. Export when you&apos;re ready.
        </p>
      )}

      <ul className="space-y-2.5">
        {[...errors, ...warnings, ...infos].map((check) => {
          const style = SEVERITY_STYLES[check.severity];
          return (
            <li key={check.id} className={`rounded-lg border p-3 ${style.cls}`}>
              <p className="text-[11px] font-bold uppercase tracking-wide">{style.label}</p>
              <p className="text-sm mt-0.5 leading-snug">{check.message}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
