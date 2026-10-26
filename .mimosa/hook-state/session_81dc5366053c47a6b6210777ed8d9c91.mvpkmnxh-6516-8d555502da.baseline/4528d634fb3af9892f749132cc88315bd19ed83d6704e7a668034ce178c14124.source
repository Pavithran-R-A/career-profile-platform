import { Link } from 'react-router';
import { usePageMeta } from '../lib/seo/usePageMeta';

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim();

export default function RefundPolicy() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  usePageMeta({
    title: 'Refund & Cancellation Policy — CareerProfile Go',
    description:
      'Refund, cancellation, duplicate-charge, and annual Pro access terms for CareerProfile Go.',
    canonical: `${origin}/refund-policy`,
  });

  return (
    <article className="page-shell max-w-3xl">
      <p className="t-eyebrow">Legal</p>
      <h1 className="t-display mt-3">Refund &amp; Cancellation Policy</h1>
      <p className="mt-3 text-sm text-[var(--muted-foreground)]">Effective October 4, 2026</p>

      <div className="mt-10 space-y-8 text-[15px] leading-7 text-[var(--foreground)]">
        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">No automatic renewal</h2>
          <p className="mt-3">
            CareerProfile Go Pro is designed as a one-time purchase for a stated annual access
            period. There is no automatic recurring renewal to cancel. A later purchase, if you
            choose to make one, extends access according to the checkout terms shown at that time.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Payment problems</h2>
          <p className="mt-3">
            If you are charged but Pro access is not activated, or if you believe a payment was
            duplicated or processed in error, contact support promptly with the order/payment
            reference and the account email used for the purchase. We will verify the server-side
            payment record before taking action.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Refund requests</h2>
          <p className="mt-3">
            Refund eligibility is evaluated based on the payment record, service-delivery status,
            the reason for the request, provider constraints, and applicable law. Nothing in this
            policy limits rights that cannot lawfully be excluded. An approved refund is returned
            through the original payment method where supported; bank or payment-provider processing
            time is outside CareerProfile Go's control.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">
            Domains and third-party purchases
          </h2>
          <p className="mt-3">
            If CareerProfile Go later enables domain purchases, registry or provider fees may become
            non-refundable once a registration or provider transaction has been submitted. Any
            provider-specific price and refund limitation will be shown before a live purchase is
            enabled.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Account deletion</h2>
          <p className="mt-3">
            Deleting your CareerProfile Go account stops your use of the service and starts the
            account-data deletion flow, but it does not automatically cancel or refund a completed
            one-time purchase.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Request help</h2>
          <p className="mt-3">
            {supportEmail ? (
              <>
                Email{' '}
                <a className="link" href={`mailto:${supportEmail}`}>
                  {supportEmail}
                </a>{' '}
                with your payment reference.
              </>
            ) : (
              <>
                Use the support details on the{' '}
                <Link className="link" to="/contact">
                  Contact page
                </Link>{' '}
                once production support is configured.
              </>
            )}
          </p>
        </section>
      </div>
    </article>
  );
}
