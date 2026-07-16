import { LegalPage } from '@/components/legal';

export const metadata = {
  title: 'Security & Responsible Disclosure',
  description: 'How SecureVibe protects your data, and how to report a vulnerability in SecureVibe itself.',
};

export default function SecurityPage() {
  return (
    <LegalPage title="Security & Responsible Disclosure" updated="July 15, 2026">
      <h2>How we protect your data</h2>
      <ul>
        <li>
          <strong>Minimal retention by design:</strong> submitted source code is processed in an
          isolated, ephemeral workspace and permanently deleted the moment each scan finishes.
          There is no database column where file contents could even be stored.
        </li>
        <li>
          <strong>No code execution:</strong> the scanner reads files; it never runs them.
        </li>
        <li>
          <strong>Row Level Security everywhere:</strong> every database table is protected by
          policies that restrict users to their own data — enforced by the database itself, not
          just application code.
        </li>
        <li>
          <strong>Hosted payment pages:</strong> card details go directly to Stripe and never
          touch our servers.
        </li>
        <li>
          <strong>Least privilege:</strong> scans run with the requesting user&apos;s own
          permissions; elevated database access is reserved for the billing webhook and cleanup
          jobs.
        </li>
      </ul>

      <h2>Found a vulnerability in SecureVibe?</h2>
      <p>
        We&apos;d genuinely like to know — a security tool should hold itself to the standard it
        preaches. Please email{' '}
        <a href="mailto:security@securevibe.app" className="hover:underline">
          security@securevibe.app
        </a>{' '}
        with:
      </p>
      <ul>
        <li>A description of the issue and where you found it</li>
        <li>Steps to reproduce it (proof-of-concept requests or screenshots help a lot)</li>
        <li>What you believe the impact is</li>
        <li>How you&apos;d like to be credited, if you want credit</li>
      </ul>
      <p>
        We&apos;ll acknowledge your report within <strong>72 hours</strong>, keep you updated as
        we investigate, and tell you when it&apos;s fixed. We&apos;re a small bootstrapped
        product without a cash bounty program (yet), but we happily give public credit to
        reporters who want it.
      </p>

      <h2>Safe harbor</h2>
      <p>
        If you make a good-faith effort to follow this policy — testing only against your own
        account and data, not degrading the service for others, not accessing other users&apos;
        data beyond the minimum needed to demonstrate the issue, and giving us reasonable time
        to fix it before public disclosure — <strong>we will not pursue legal action against
        you</strong> for your research. Please avoid automated scanning that generates heavy
        traffic, and never social-engineer our users.
      </p>

      <h2>Out of scope</h2>
      <ul>
        <li>Findings from automated scanners without a demonstrated impact</li>
        <li>Denial of service / volumetric attacks</li>
        <li>Issues in third-party services we use (report those to Supabase, Vercel, or Stripe)</li>
        <li>Missing security headers without an exploitable consequence</li>
      </ul>
    </LegalPage>
  );
}
