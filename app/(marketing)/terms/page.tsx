import { LegalPage } from '@/components/legal';

export const metadata = {
  title: 'Terms of Service',
  description: 'The terms that govern your use of SecureVibe.',
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="July 15, 2026">
      <p>
        These terms govern your use of SecureVibe (&quot;the Service&quot;). By creating an
        account or running a scan, you agree to them. We&apos;ve written them to be readable —
        the bolded parts are the ones people most need to understand.
      </p>

      <h2>1. What the Service is (and is not)</h2>
      <p>
        SecureVibe is an <strong>automated code review tool</strong>. It scans submitted code for
        a specific set of common security problems and produces an informational report.
      </p>
      <p>
        <strong>
          SecureVibe does not and cannot guarantee that it will detect all vulnerabilities,
          weaknesses, or defects in your code. A report with no findings does not mean your
          application is secure. The Service is not a security audit, not a penetration test,
          and not a substitute for review by a qualified security professional.
        </strong>{' '}
        Automated checks have inherent limits: they can miss real problems (false negatives) and
        flag things that turn out to be fine (false positives). You remain solely responsible
        for the security of your applications.
      </p>

      <h2>2. Your account</h2>
      <p>
        You must provide accurate information and keep your credentials secure. You are
        responsible for activity under your account. You must be at least 16 years old (or the
        age of digital consent where you live).
      </p>

      <h2>3. Acceptable use</h2>
      <ul>
        <li>
          <strong>Only submit code you have the right to submit</strong> — your own, or code you
          are authorized to analyze. You confirm this for every scan.
        </li>
        <li>Do not submit malware or attempt to attack, overload, or probe the Service itself.</li>
        <li>Do not circumvent scan limits (e.g. by creating many accounts).</li>
        <li>Do not resell or repackage the Service without our written agreement.</li>
      </ul>
      <p>We may suspend accounts that violate these rules.</p>

      <h2>4. Plans, billing, and cancellation</h2>
      <p>
        The Free plan includes 3 scans per calendar month. The Pro plan ($9/month) includes
        unlimited scans, subject to fair-use rate limits. Payments are processed by Stripe;
        subscriptions renew monthly until cancelled. You can cancel anytime from your account
        page — access continues to the end of the paid period. Refunds are described in our{' '}
        <a href="/refunds" className="text-emerald-400 hover:underline">
          Refund Policy
        </a>
        .
      </p>

      <h2>5. Your code and your data</h2>
      <p>
        You retain all rights to code you submit. You grant us only the minimal license needed
        to process it: copying it into an isolated workspace, analyzing it, and generating your
        report — after which the code is permanently deleted, as described in our{' '}
        <a href="/privacy" className="text-emerald-400 hover:underline">
          Privacy Policy
        </a>
        . We never use your code to train AI models.
      </p>

      <h2>6. Disclaimer of warranties</h2>
      <p>
        <strong>
          The Service is provided &quot;as is&quot; and &quot;as available&quot;, without
          warranties of any kind
        </strong>
        , express or implied, including fitness for a particular purpose, accuracy, or
        non-infringement. We do not warrant that the Service will be uninterrupted or
        error-free.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        <strong>
          To the maximum extent permitted by law, SecureVibe and its operator will not be liable
          for any indirect, incidental, special, consequential, or exemplary damages
        </strong>{' '}
        — including losses from security incidents in your applications, lost profits, lost
        data, or business interruption — arising from your use of (or inability to use) the
        Service. Our total aggregate liability for any claim is limited to the amount you paid
        us in the twelve months before the claim arose (or $10 if you paid nothing). Some
        jurisdictions do not allow certain limitations, so parts of this section may not apply
        to you.
      </p>

      <h2>8. Indemnity</h2>
      <p>
        You agree to indemnify us against claims arising from your violation of these terms —
        in particular, submitting code you did not have the right to submit.
      </p>

      <h2>9. Changes to the Service or these terms</h2>
      <p>
        We may modify the Service or these terms. For material changes we&apos;ll email account
        holders at least 14 days before they take effect. Continued use after that constitutes
        acceptance.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about these terms:{' '}
        <a href="mailto:legal@securevibe.app" className="text-emerald-400 hover:underline">
          legal@securevibe.app
        </a>
      </p>
    </LegalPage>
  );
}
