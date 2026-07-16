import { LegalPage } from '@/components/legal';

export const metadata = {
  title: 'Privacy Policy',
  description: 'How SecureVibe handles your data — and why your source code is never stored.',
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="July 15, 2026">
      <p>
        SecureVibe exists to check code for security problems — so we hold ourselves to a simple
        standard: <strong>we keep as little of your data as possible, for as short a time as
        possible.</strong> This page explains exactly what we collect, what we do with it, and
        what we never do.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>
          <strong>Your source code is permanently deleted immediately after each scan</strong> —
          on success and on failure alike. It is processed in an isolated temporary workspace
          that is destroyed the moment your report is ready.
        </li>
        <li>
          <strong>We retain only the findings</strong>: file names, line numbers, one masked
          line of context per issue, and aggregate statistics (file counts, scan duration).
          Secret values are masked before anything is saved.
        </li>
        <li>
          <strong>Your code is never used to train any AI model</strong> — ours or anyone
          else&apos;s — and is never sold, shared, or analyzed for any purpose other than
          producing your report.
        </li>
        <li>
          <strong>Your code is never executed.</strong> Scans are read-only static analysis.
        </li>
      </ul>

      <h2>What we collect and why</h2>
      <h3>Account data</h3>
      <p>
        Your email address and a hashed password (handled by our authentication provider,
        Supabase). Used to sign you in and, occasionally, to send you service emails such as
        password resets. We do not send marketing email without your consent.
      </p>
      <h3>Submitted code (transient)</h3>
      <p>
        When you submit a public GitHub URL, we download the repository into an isolated
        temporary workspace, scan it, and delete it. When you upload a .zip, it is stored in a
        private bucket only you can access, downloaded into the same kind of isolated workspace,
        scanned — and then both the extracted copy and the uploaded .zip are deleted
        immediately. A daily automated sweep additionally removes any upload older than one hour,
        as insurance against interrupted scans. Every report displays the timestamp at which
        your source was destroyed.
      </p>
      <h3>Scan reports</h3>
      <p>
        Findings (issue titles, plain-English explanations, file paths, line numbers, masked
        evidence, recommendations) and aggregate scan statistics. These stay in your account so
        you can revisit reports. Deleting your account deletes them.
      </p>
      <h3>Billing data</h3>
      <p>
        Payments are processed entirely by Stripe. We never see or store your card details — we
        keep only your Stripe customer reference, your plan, and your subscription status.
        Stripe&apos;s own privacy policy applies to the payment itself.
      </p>

      <h2>Cookies</h2>
      <p>
        We use <strong>essential cookies only</strong>: the session cookies required to keep you
        signed in. We run <strong>no analytics trackers and no advertising cookies</strong>, so
        there is no cookie banner to click — there is nothing to consent to.
      </p>

      <h2>Who else touches your data</h2>
      <p>
        Three infrastructure providers, each seeing only what their role requires: Supabase
        (database, authentication, transient upload storage), Vercel (application hosting — the
        temporary scan workspaces live and die inside its ephemeral compute), and Stripe
        (payments). We also query the public npm and PyPI registries to verify package names —
        those requests contain package names from your dependency list, never your code.
      </p>

      <h2>Data retention &amp; deletion</h2>
      <ul>
        <li>Source code: deleted immediately after each scan (see above).</li>
        <li>Uploaded .zip files: deleted immediately after the scan; swept hourly if orphaned.</li>
        <li>Reports and account data: kept until you delete them or close your account.</li>
        <li>
          To close your account and erase everything, email{' '}
          <a href="mailto:privacy@securevibe.app" className="hover:underline">
            privacy@securevibe.app
          </a>
          . We complete deletion within 30 days.
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>
        Depending on where you live (e.g. GDPR in the EU, CCPA in California), you may have the
        right to access, correct, export, or erase your personal data. Email us and we&apos;ll
        honor it — we extend these rights to all users regardless of location, because it&apos;s
        less bookkeeping and more fair.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy in a way that matters, we&apos;ll email account holders before
        it takes effect. The &quot;last updated&quot; date at the top always reflects the current
        version.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions:{' '}
        <a href="mailto:privacy@securevibe.app" className="hover:underline">
          privacy@securevibe.app
        </a>
      </p>
    </LegalPage>
  );
}
