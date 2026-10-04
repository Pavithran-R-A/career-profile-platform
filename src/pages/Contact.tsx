import { usePageMeta } from '../lib/seo/usePageMeta';

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim();
const supportPhone = import.meta.env.VITE_SUPPORT_PHONE?.trim();
const operatorName = import.meta.env.VITE_OPERATOR_NAME?.trim();
const operatorAddress = import.meta.env.VITE_OPERATOR_ADDRESS?.trim();

export default function Contact() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  usePageMeta({
    title: 'Contact — CVentory',
    description: 'Contact CVentory for account, privacy, billing, security, or product support.',
    canonical: `${origin}/contact`,
  });

  return (
    <article className="page-shell max-w-3xl">
      <p className="t-eyebrow">Support</p>
      <h1 className="t-display mt-3">Contact CVentory</h1>
      <p className="t-lead mt-5">
        Get help with your account, billing, privacy, security, profile, resume, or integrations.
      </p>

      <div className="mt-10 grid gap-4">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-[var(--ink)]">Support email</h2>
          {supportEmail ? (
            <a className="link mt-2 inline-block" href={`mailto:${supportEmail}`}>{supportEmail}</a>
          ) : (
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Production support email is not configured yet. This is a release gate and must be configured before public launch.
            </p>
          )}
        </div>

        {supportPhone && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-[var(--ink)]">Phone</h2>
            <a className="link mt-2 inline-block" href={`tel:${supportPhone.replace(/\s+/g, '')}`}>{supportPhone}</a>
          </div>
        )}

        {(operatorName || operatorAddress) && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-[var(--ink)]">Operator</h2>
            {operatorName && <p className="mt-2">{operatorName}</p>}
            {operatorAddress && <p className="mt-1 text-sm text-[var(--muted-foreground)]">{operatorAddress}</p>}
          </div>
        )}
      </div>

      <p className="mt-8 text-sm leading-6 text-[var(--muted-foreground)]">
        For security reports, do not include passwords, private keys, payment-card details, or other secrets in your message.
      </p>
    </article>
  );
}
