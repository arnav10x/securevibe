import Link from 'next/link';
import { ButtonLink, Card, SeverityBadge } from '@/components/ui';

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* ---------- Hero ---------- */}
      <section className="py-16 text-center sm:py-24">
        <p className="mx-auto mb-5 inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-xs font-medium text-emerald-300">
          Built with Lovable, Bolt, Cursor, Replit or v0? This is for you.
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
          Your AI built the app.
          <br />
          <span className="text-emerald-400">Did it build it safely?</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
          AI coding tools ship fast — and quietly leave API keys in the code, databases open to
          the internet, and dependencies that don&apos;t exist. SecureVibe finds those problems
          and explains them in plain English, <strong>before</strong> you launch.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <ButtonLink href="/signup" className="px-6 py-3 text-base">
            Scan my app free
          </ButtonLink>
          <Link href="#how-it-works" className="text-sm text-slate-300 hover:text-white">
            See how it works ↓
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          3 free scans a month · No credit card · Your code is deleted right after scanning
        </p>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how-it-works" className="scroll-mt-20 py-14">
        <h2 className="text-center text-3xl font-bold">How it works</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            {
              step: '1',
              title: 'Point us at your code',
              body: 'Paste a public GitHub repo URL, or upload a .zip of your project. No installs, no GitHub permissions.',
            },
            {
              step: '2',
              title: 'We scan it — safely',
              body: 'Four security checks run in an isolated workspace. Your code is never executed and never shown to any AI model.',
            },
            {
              step: '3',
              title: 'Read your report, code deleted',
              body: 'Each finding comes with what it means, why it matters, and how to fix it. Your source is permanently deleted the moment the report is ready.',
            },
          ].map((item) => (
            <Card key={item.step}>
              <p className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 font-bold text-emerald-400">
                {item.step}
              </p>
              <h3 className="mt-4 font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------- The four checks ---------- */}
      <section id="checks" className="scroll-mt-20 py-14">
        <h2 className="text-center text-3xl font-bold">What we check</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-400">
          The four most common ways AI-generated apps get breached in their first weeks.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <Card>
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden>
                🔑
              </span>
              <h3 className="font-semibold">Exposed secrets &amp; API keys</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Stripe keys, AWS credentials, database passwords and .env files committed straight
              into the code. Bots find these within minutes of a repo going public — and the
              bill lands on your card.
            </p>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden>
                🗄️
              </span>
              <h3 className="font-semibold">Wide-open databases</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Supabase tables without Row Level Security and Firebase rules set to &quot;allow
              everyone&quot;. The app works perfectly in the demo — while anyone on the internet
              can read (or delete) your users&apos; data.
            </p>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden>
                📦
              </span>
              <h3 className="font-semibold">Fake &amp; risky dependencies</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              AI tools sometimes invent package names that don&apos;t exist — and attackers
              register those names with malware (&quot;slopsquatting&quot;). We verify every
              dependency against the real npm and PyPI registries.
            </p>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden>
                🧨
              </span>
              <h3 className="font-semibold">Insecure code patterns</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              SQL queries built by gluing strings together, eval() on user input, disabled
              HTTPS certificate checks, and &quot;admin&quot; flags stored in the browser where
              anyone can flip them.
            </p>
          </Card>
        </div>

        {/* Sample finding */}
        <div className="mx-auto mt-10 max-w-2xl">
          <p className="mb-3 text-center text-sm text-slate-500">
            Findings look like this — no security degree required:
          </p>
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <SeverityBadge severity="critical" />
              <h3 className="font-semibold">Stripe LIVE secret key committed to code</h3>
            </div>
            <p className="mt-1 font-mono text-xs text-slate-400">config.js:12</p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 px-3 py-2 font-mono text-xs text-slate-300">
              const stripeKey = &quot;sk_liv************&quot;;
            </pre>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              <strong>Why this matters:</strong> anyone holding this key can issue refunds, read
              customer data, and move real money in your Stripe account.
            </p>
          </Card>
        </div>
      </section>

      {/* ---------- Privacy promise ---------- */}
      <section className="py-14">
        <Card className="border-emerald-500/30">
          <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
            <span className="text-5xl" aria-hidden>
              🔒
            </span>
            <div>
              <h2 className="text-xl font-bold">Your code is deleted. Actually deleted.</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Every scan runs in an isolated temporary workspace that is destroyed the moment
                your report is ready — on success <em>and</em> on failure. We keep only the
                findings (file names, line numbers, masked evidence). Your source code is never
                stored, never executed, and never used to train any AI model. Each report shows
                the exact timestamp your code was destroyed.
              </p>
              <p className="mt-3 text-sm">
                <Link href="/privacy" className="text-emerald-400 hover:text-emerald-300">
                  Read the full privacy policy →
                </Link>
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* ---------- Pricing ---------- */}
      <section id="pricing" className="scroll-mt-20 py-14">
        <h2 className="text-center text-3xl font-bold">Simple pricing</h2>
        <div className="mx-auto mt-10 grid max-w-3xl gap-6 sm:grid-cols-2">
          <Card>
            <h3 className="text-lg font-semibold">Free</h3>
            <p className="mt-2 text-3xl font-bold">
              $0<span className="text-base font-normal text-slate-400">/month</span>
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-slate-300">
              <li>✅ 3 scans per month</li>
              <li>✅ All four security checks</li>
              <li>✅ Full plain-English reports</li>
              <li>✅ Same code-deletion guarantee</li>
            </ul>
            <div className="mt-6">
              <ButtonLink href="/signup" variant="secondary" className="w-full">
                Start free
              </ButtonLink>
            </div>
          </Card>
          <Card className="border-emerald-500/40">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Pro</h3>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                For launch week &amp; beyond
              </span>
            </div>
            <p className="mt-2 text-3xl font-bold">
              $9<span className="text-base font-normal text-slate-400">/month</span>
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-slate-300">
              <li>✅ Unlimited scans</li>
              <li>✅ Scan after every change with confidence</li>
              <li>✅ Cancel anytime, keep access to period end</li>
              <li>✅ 14-day money-back guarantee</li>
            </ul>
            <div className="mt-6">
              <ButtonLink href="/signup" className="w-full">
                Go Pro
              </ButtonLink>
            </div>
          </Card>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="scroll-mt-20 py-14">
        <h2 className="text-center text-3xl font-bold">Questions, answered</h2>
        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {[
            {
              q: 'Do you keep my source code?',
              a: 'No. Your code lives in an isolated temporary workspace only while the scan runs — typically under a minute — and is permanently deleted the moment the report is ready, even if the scan fails. We keep only the findings: file names, line numbers, and a single masked line of context per issue. Every report shows the exact deletion timestamp.',
            },
            {
              q: 'Is my code used to train AI models?',
              a: 'Never. The scanner is a deterministic analysis engine — your code is not sent to any AI model, ours or anyone else’s, for any purpose.',
            },
            {
              q: 'Do you run my code?',
              a: 'No. SecureVibe performs static analysis only — it reads your files, it never executes them. That protects you and us.',
            },
            {
              q: 'What can I scan?',
              a: 'Any public GitHub repository, or a .zip upload of your project — up to 50 MB and 5,000 files. Private-repo support via GitHub integration is on the roadmap.',
            },
            {
              q: 'Will this find every vulnerability?',
              a: 'No — and be suspicious of any tool that claims otherwise. SecureVibe targets the most common, most damaging mistakes in AI-generated apps. It dramatically improves your odds, but it is not a substitute for a professional security audit.',
            },
            {
              q: 'I found something scary in my report. Now what?',
              a: 'Every finding includes a plain-English fix. The golden rule for leaked secrets: rotate them (get a new key and revoke the old one) — deleting the file is not enough, because git history remembers.',
            },
            {
              q: 'How do I cancel?',
              a: 'One click from your account page, via Stripe’s billing portal. You keep Pro access until the end of the period you paid for. First subscription payment comes with a 14-day money-back guarantee.',
            },
          ].map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-slate-800 bg-slate-900/60 p-5 open:border-slate-600"
            >
              <summary className="cursor-pointer list-none font-medium marker:hidden">
                <span className="mr-2 inline-block text-emerald-400 transition-transform group-open:rotate-90">
                  ▸
                </span>
                {item.q}
              </summary>
              <p className="mt-3 pl-6 text-sm leading-relaxed text-slate-400">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="py-16 text-center">
        <h2 className="text-3xl font-bold">Launch with confidence</h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-400">
          It takes about a minute to find out what your AI left behind. Better you than an
          attacker.
        </p>
        <div className="mt-6">
          <ButtonLink href="/signup" className="px-6 py-3 text-base">
            Scan my app free
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
