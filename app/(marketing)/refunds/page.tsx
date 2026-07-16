import { LegalPage } from '@/components/legal';

export const metadata = {
  title: 'Refund Policy',
  description: 'Straightforward refunds for SecureVibe Pro.',
};

export default function RefundsPage() {
  return (
    <LegalPage title="Refund Policy" updated="July 15, 2026">
      <p>We keep this simple, because refund fights aren&apos;t worth anyone&apos;s time.</p>

      <h2>14-day money-back guarantee</h2>
      <p>
        If SecureVibe Pro isn&apos;t what you hoped, email us within <strong>14 days of your
        first subscription payment</strong> and we&apos;ll refund it in full — no questions
        beyond &quot;anything we could have done better?&quot;. This applies to your first
        payment; renewals are covered by cancellation below.
      </p>

      <h2>Cancelling</h2>
      <p>
        You can cancel anytime from your account page (via Stripe&apos;s billing portal). Your
        Pro access continues until the end of the period you already paid for, and you simply
        aren&apos;t charged again. We don&apos;t prorate partial months on renewals.
      </p>

      <h2>Billing mistakes</h2>
      <p>
        Charged in error — duplicate payment, charged after cancelling, anything that looks
        wrong? Tell us and we&apos;ll refund it promptly, whatever the date.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Email{' '}
        <a href="mailto:billing@securevibe.app" className="hover:underline">
          billing@securevibe.app
        </a>{' '}
        from your account email. Refunds are issued to the original payment method via Stripe
        and typically appear within 5–10 business days, depending on your bank.
      </p>
    </LegalPage>
  );
}
