import { usePageMeta } from '../lib/seo/usePageMeta';

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim();

export default function Privacy() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  usePageMeta({
    title: 'Privacy Policy — CareerProfile Go',
    description:
      'How CareerProfile Go collects, uses, protects, publishes, and deletes account and career-profile data.',
    canonical: `${origin}/privacy`,
  });

  return (
    <article className="page-shell max-w-3xl">
      <p className="t-eyebrow">Legal</p>
      <h1 className="t-display mt-3">Privacy Policy</h1>
      <p className="mt-3 text-sm text-[var(--muted-foreground)]">Effective October 4, 2026</p>

      <div className="mt-10 space-y-8 text-[15px] leading-7 text-[var(--foreground)]">
        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">
            What CareerProfile Go processes
          </h2>
          <p className="mt-3">
            CareerProfile Go processes the information you provide to create and operate your
            account and career profile. This can include your sign-in email, CV or resume files,
            profile basics, experience, education, projects, skills, achievements, links, profile
            preferences, and content you choose to publish.
          </p>
          <p className="mt-3">
            If you connect GitHub, CareerProfile Go can process repository and activity data needed
            for the features you choose to use. If paid features are enabled, CareerProfile Go
            stores billing status and payment/order identifiers required to provide access;
            payment-card details are handled by the payment provider and are not stored by
            CareerProfile Go.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">How the information is used</h2>
          <p className="mt-3">
            We use this information to authenticate you, import and structure career information,
            generate and tailor resumes, render your portfolio, provide selected GitHub evidence,
            enforce plan limits, prevent abuse, operate optional AI features, troubleshoot failures,
            and provide support.
          </p>
          <p className="mt-3">
            CareerProfile Go also records limited first-party product events for service improvement
            and funnel debugging. These events are designed not to contain CV document text or other
            document content.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Public profiles and evidence</h2>
          <p className="mt-3">
            Your profile is private unless you publish it. When you publish, the public profile
            fields and links you selected become accessible to anyone with the public URL and may be
            indexed by search engines. GitHub-derived evidence is not public merely because it
            exists: repository and evidence visibility controls must also permit publication.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Service providers</h2>
          <p className="mt-3">
            CareerProfile Go uses infrastructure and service providers to operate the product,
            including database/authentication and storage services, hosting/CDN services, GitHub
            when you connect it, a payment processor when paid features are enabled, and an AI
            provider when AI features are enabled. Providers receive only the information required
            for the relevant service and process it under their own terms and privacy obligations.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Security and retention</h2>
          <p className="mt-3">
            CareerProfile Go uses row-level access controls, server-side authorization, scoped
            public projections, transport encryption, and other technical controls intended to
            protect account data. No online service can promise absolute security.
          </p>
          <p className="mt-3">
            Data is retained while your account is active and as needed to operate the service,
            resolve disputes, meet legal obligations, and maintain security records. Account
            deletion is designed to remove account data and stored resume files through a
            recoverable deletion process. Some processor or legal records may persist for the period
            required by law or legitimate operational obligations.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Your choices</h2>
          <p className="mt-3">
            You can edit your career information, publish or unpublish your profile, control
            eligible evidence visibility, disconnect integrations where supported, and request
            account deletion from the product. Public search-engine copies can take time to
            disappear after you unpublish or delete content.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Contact</h2>
          <p className="mt-3">
            For privacy or account questions,{' '}
            {supportEmail ? (
              <a className="link" href={`mailto:${supportEmail}`}>
                {supportEmail}
              </a>
            ) : (
              <>
                use the CareerProfile Go support contact published on the Contact page once
                production support is configured
              </>
            )}
            .
          </p>
        </section>
      </div>
    </article>
  );
}
