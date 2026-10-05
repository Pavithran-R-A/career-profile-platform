import { usePageMeta } from '../lib/seo/usePageMeta';

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim();

export default function Terms() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  usePageMeta({
    title: 'Terms of Service — CareerProfile Go',
    description:
      'Terms governing use of CareerProfile Go career profiles, resumes, portfolios, integrations, and paid features.',
    canonical: `${origin}/terms`,
  });

  return (
    <article className="page-shell max-w-3xl">
      <p className="t-eyebrow">Legal</p>
      <h1 className="t-display mt-3">Terms of Service</h1>
      <p className="mt-3 text-sm text-[var(--muted-foreground)]">Effective October 4, 2026</p>

      <div className="mt-10 space-y-8 text-[15px] leading-7 text-[var(--foreground)]">
        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Using CareerProfile Go</h2>
          <p className="mt-3">
            CareerProfile Go helps you organize career information, build public profiles and portfolios,
            generate ATS-oriented resumes, tailor career materials, and use optional integrations.
            You are responsible for keeping your account secure and for the information you submit
            or publish.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Your content</h2>
          <p className="mt-3">
            You retain ownership of the career information, documents, project descriptions, links,
            and other content you submit. You give CareerProfile Go the limited permission needed to store,
            process, transform, display, and transmit that content solely to operate the features
            you request.
          </p>
          <p className="mt-3">
            You must have the right to upload and publish the content you provide. Do not use
            CareerProfile Go to impersonate another person, misrepresent credentials, upload unlawful
            material, attack the service, bypass quotas or authorization, or expose information you
            are not entitled to disclose.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">AI and generated material</h2>
          <p className="mt-3">
            AI-assisted extraction or writing can make mistakes. Review generated career information
            before publishing or submitting it. CareerProfile Go is designed to ground outputs in
            information you provide, but you remain responsible for the accuracy of applications,
            resumes, and public statements made in your name.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Connected services</h2>
          <p className="mt-3">
            Optional features can depend on third-party services such as GitHub, payment providers,
            domain providers, infrastructure providers, and AI services. Their availability and
            terms may affect those features. Connecting a third-party account does not transfer
            ownership of that account or its content to CareerProfile Go.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Paid access</h2>
          <p className="mt-3">
            When Pro purchasing is enabled, CareerProfile Go sells a one-time period of annual Pro access.
            It does not automatically renew. The price and included limits shown at checkout are the
            controlling commercial terms for that purchase. Access begins or extends only after the
            server confirms payment.
          </p>
          <p className="mt-3">
            Refund and cancellation handling is described in the Refund &amp; Cancellation Policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Availability and changes</h2>
          <p className="mt-3">
            We work to keep CareerProfile Go available and secure, but uninterrupted operation is not
            guaranteed. Features may change when required for security, provider compatibility,
            legal compliance, or product improvement. Material changes to these terms will be
            reflected by an updated effective date.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">
            Account suspension and deletion
          </h2>
          <p className="mt-3">
            We may restrict access where necessary to prevent abuse, fraud, security incidents, or
            unlawful use. You may request account deletion through the product. Deleting an account
            does not by itself create a refund right for a completed purchase.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Contact</h2>
          <p className="mt-3">
            Questions about these terms can be sent to{' '}
            {supportEmail ? (
              <a className="link" href={`mailto:${supportEmail}`}>
                {supportEmail}
              </a>
            ) : (
              <>the production support address shown on the Contact page once configured</>
            )}
            .
          </p>
        </section>
      </div>
    </article>
  );
}
