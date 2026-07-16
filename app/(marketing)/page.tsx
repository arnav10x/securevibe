// The landing page. One story told in light: an obsidian field, a phosphor
// scan signal, and a hero that *shows* the product doing its job.

import Link from 'next/link';
import { ButtonLink, SeverityBadge } from '@/components/ui';
import { CountUp, Magnetic, Marquee, Reveal, Spotlight, Tilt } from '@/components/fx';
import { SignalField } from '@/components/signal-field';
import { ScanTheater } from '@/components/scan-theater';
import { Faq } from '@/components/faq';
import {
  IconArrowRight,
  IconBraces,
  IconCheck,
  IconClock,
  IconCreditCard,
  IconDatabase,
  IconKey,
  IconLock,
  IconScan,
  IconSparkle,
} from '@/components/icons';

const AI_TOOLS = ['Lovable', 'Bolt', 'Cursor', 'Replit', 'v0', 'Windsurf', 'Claude Code'];

const STEPS = [
  {
    step: '01',
    title: 'Point us at your code',
    body: 'Paste a public GitHub repo URL, or upload a .zip of your project. No installs, no GitHub permissions.',
  },
  {
    step: '02',
    title: 'We scan it — safely',
    body: 'Four security checks run in an isolated workspace. Your code is never executed and never shown to any AI model.',
  },
  {
    step: '03',
    title: 'Read your report, code deleted',
    body: 'Each finding comes with what it means, why it matters, and how to fix it. Your source is permanently deleted the moment the report is ready.',
  },
];

const CHECKS = [
  {
    icon: IconKey,
    engine: 'Engine 01 — Secrets',
    title: 'Exposed secrets & API keys',
    body: 'Stripe keys, AWS credentials, database passwords and .env files committed straight into the code. Bots find these within minutes of a repo going public — and the bill lands on your card.',
  },
  {
    icon: IconDatabase,
    engine: 'Engine 02 — Platform config',
    title: 'Wide-open databases',
    body: 'Supabase tables without Row Level Security and Firebase rules set to "allow everyone". The app works perfectly in the demo — while anyone on the internet can read (or delete) your users\' data.',
  },
  {
    icon: IconBraces,
    engine: 'Engine 03 — Code patterns',
    title: 'Insecure code patterns',
    body: 'SQL queries built by gluing strings together, eval() on user input, disabled HTTPS certificate checks, and "admin" flags stored in the browser where anyone can flip them.',
  },
  {
    icon: (props: React.ComponentProps<'svg'>) => <IconScan {...props} />,
    engine: 'Engine 04 — Dependencies',
    title: 'Fake & risky dependencies',
    body: 'AI tools sometimes invent package names that don\'t exist — and attackers register those names with malware ("slopsquatting"). We verify every dependency against the real npm and PyPI registries.',
  },
];

const FAQ_ITEMS = [
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
];

export default function LandingPage() {
  return (
    <div className="overflow-x-clip">
      {/* ================= Hero ================= */}
      <section className="relative flex min-h-[100svh] items-center pb-16 pt-32 sm:pt-36">
        <SignalField className="absolute inset-0 h-full w-full" />
        <div className="grid-bg absolute inset-0" aria-hidden />
        {/* Fade the aurora into the page bottom */}
        <div
          className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink"
          aria-hidden
        />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          {/* min-w-0 lets both grid columns shrink below their content width
              on small screens (grid items refuse to otherwise). */}
          <div className="min-w-0">
            <Reveal>
              <p className="kicker">Pre-launch security · for AI-built apps</p>
            </Reveal>
            <Reveal delay={90}>
              <h1 className="display mt-5 text-[clamp(2.7rem,6vw,4.6rem)]">
                Your AI built the app.
                <br />
                <em>Did it build it safely?</em>
              </h1>
            </Reveal>
            <Reveal delay={180}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-fg-dim">
                AI coding tools ship fast — and quietly leave API keys in the code, databases
                open to the internet, and dependencies that don&apos;t exist. SecureVibe finds
                those problems and explains them in plain English,{' '}
                <strong className="font-semibold text-fg">before</strong> you launch.
              </p>
            </Reveal>
            <Reveal delay={260}>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Magnetic>
                  <ButtonLink href="/signup" className="px-7 py-3.5 text-base">
                    Scan my app free
                    <IconArrowRight className="h-4 w-4" />
                  </ButtonLink>
                </Magnetic>
                <ButtonLink
                  href="#how-it-works"
                  variant="secondary"
                  className="px-6 py-3.5 text-base"
                >
                  See how it works
                </ButtonLink>
              </div>
            </Reveal>
            <Reveal delay={340}>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-fg-mute">
                <li className="flex items-center gap-2">
                  <IconSparkle className="h-3.5 w-3.5 text-signal" /> 3 free scans a month
                </li>
                <li className="flex items-center gap-2">
                  <IconCreditCard className="h-3.5 w-3.5 text-signal" /> No credit card
                </li>
                <li className="flex items-center gap-2">
                  <IconLock className="h-3.5 w-3.5 text-signal" /> Code deleted right after
                  scanning
                </li>
              </ul>
            </Reveal>
          </div>

          <Reveal delay={200} className="min-w-0">
            <Tilt>
              <ScanTheater />
            </Tilt>
          </Reveal>
        </div>
      </section>

      {/* ================= Tool marquee ================= */}
      <section className="border-y border-[var(--line)] py-6">
        <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-fg-mute">
          Built with any of these? This scan is for you.
        </p>
        <Marquee>
          {AI_TOOLS.map((tool) => (
            <span
              key={tool}
              className="mx-7 flex items-center gap-7 font-mono text-sm uppercase tracking-[0.18em] text-fg-dim"
            >
              {tool}
              <span className="h-1 w-1 rotate-45 bg-signal/60" aria-hidden />
            </span>
          ))}
        </Marquee>
      </section>

      {/* ================= Instrument readout ================= */}
      <section className="mx-auto grid max-w-6xl grid-cols-2 gap-y-10 px-4 py-16 sm:px-6 lg:grid-cols-4">
        {[
          { value: <CountUp to={4} prefix="0" />, label: 'security engines' },
          { value: <CountUp to={60} prefix="≈" suffix="s" />, label: 'to a full report' },
          { value: <span className="text-signal">0</span>, label: 'bytes of code retained' },
          { value: <CountUp to={50} suffix=" MB" />, label: 'max project size' },
        ].map((stat, i) => (
          <Reveal key={stat.label} delay={i * 80} className="text-center">
            <p className="text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
              {stat.value}
            </p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-fg-mute">
              {stat.label}
            </p>
          </Reveal>
        ))}
      </section>

      {/* ================= How it works ================= */}
      <section id="how-it-works" className="scroll-mt-28 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="kicker">How it works</p>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="display mt-4 max-w-2xl text-[clamp(1.9rem,3.8vw,3rem)]">
              Three steps. About a minute. <em>Zero setup.</em>
            </h2>
          </Reveal>

          <div className="relative mt-14 grid gap-5 sm:grid-cols-3">
            {/* Connector line behind the step cards */}
            <div
              aria-hidden
              className="absolute left-[8%] right-[8%] top-9 hidden h-px bg-gradient-to-r from-transparent via-signal/40 to-transparent sm:block"
            />
            {STEPS.map((item, i) => (
              <Reveal key={item.step} delay={i * 120}>
                <Spotlight className="glass relative h-full rounded-2xl p-7">
                  <p className="inline-flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-signal/30 bg-ink font-mono text-lg text-signal shadow-[0_0_24px_rgba(54,226,168,0.15)]">
                    {item.step}
                  </p>
                  <h3 className="mt-6 text-lg font-semibold tracking-tight">{item.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-fg-dim">{item.body}</p>
                </Spotlight>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= The four checks ================= */}
      <section id="checks" className="scroll-mt-28 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="kicker">What we check</p>
          </Reveal>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
            <Reveal delay={80}>
              <h2 className="display max-w-2xl text-[clamp(1.9rem,3.8vw,3rem)]">
                The four ways AI-built apps <em>get breached.</em>
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <p className="max-w-sm text-sm leading-relaxed text-fg-dim">
                These are the most common, most damaging mistakes found in AI-generated apps in
                their first weeks live.
              </p>
            </Reveal>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {CHECKS.map((check, i) => (
              <Reveal key={check.title} delay={(i % 2) * 100}>
                <Spotlight className="glass group h-full rounded-2xl p-7 transition-transform duration-300 hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-xl border border-signal/25 bg-signal/10 text-signal transition-shadow duration-300 group-hover:shadow-[0_0_24px_rgba(54,226,168,0.25)]">
                      <check.icon className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-mute">
                      {check.engine}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight">{check.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-fg-dim">{check.body}</p>
                </Spotlight>
              </Reveal>
            ))}
          </div>

          {/* Sample finding — the report speaks for itself */}
          <div className="mx-auto mt-16 max-w-2xl">
            <Reveal>
              <p className="mb-4 text-center text-sm text-fg-mute">
                Findings look like this — no security degree required:
              </p>
            </Reveal>
            <Reveal delay={100}>
              <div className="glass rounded-2xl p-6 sm:p-7">
                <div className="flex flex-wrap items-center gap-3">
                  <SeverityBadge severity="critical" />
                  <h3 className="font-semibold tracking-tight">
                    Stripe LIVE secret key committed to code
                  </h3>
                </div>
                <p className="mt-2 font-mono text-xs text-fg-mute">config.js:12</p>
                <pre className="mt-4 overflow-x-auto rounded-xl border border-[var(--line)] bg-ink px-4 py-3 font-mono text-xs leading-relaxed text-fg-dim">
                  <span className="text-fg-mute">12 </span>const stripeKey ={' '}
                  <span className="text-[#ffb3b3]">&quot;sk_liv************&quot;</span>;
                </pre>
                <p className="mt-4 text-sm leading-relaxed text-fg-dim">
                  <strong className="font-semibold text-fg">Why this matters:</strong> anyone
                  holding this key can issue refunds, read customer data, and move real money in
                  your Stripe account.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= Deletion guarantee ================= */}
      <section className="relative overflow-hidden py-28">
        <div className="grid-bg absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Reveal>
            <p className="kicker justify-center">The core promise</p>
          </Reveal>
          <Reveal delay={90}>
            <h2 className="display mt-5 text-[clamp(2.4rem,5.5vw,4.2rem)]">
              Deleted. <em>Actually</em> deleted.
            </h2>
          </Reveal>
          <Reveal delay={180}>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-fg-dim sm:text-lg">
              Every scan runs in an isolated temporary workspace that is destroyed the moment
              your report is ready — on success <em className="serif-accent">and</em> on
              failure. We keep only the findings. Your source is never stored, never executed,
              and never used to train any AI model.
            </p>
          </Reveal>

          {/* The purge ledger — an instrument readout of the guarantee */}
          <Reveal delay={260}>
            <div className="glass mx-auto mt-10 max-w-2xl overflow-x-auto rounded-2xl px-5 py-4 text-left font-mono text-xs leading-loose text-fg-dim sm:text-[13px]">
              <p>
                <span className="text-fg-mute">workspace</span> 4f82…9c3a{' '}
                <span className="text-fg-mute">· created</span> 09:40:26
              </p>
              <p>
                <span className="text-fg-mute">report</span> ready{' '}
                <span className="text-fg-mute">· findings kept:</span> 3
              </p>
              <p>
                <span className="text-fg-mute">workspace</span>{' '}
                <span className="text-critical line-through decoration-critical/70">
                  4f82…9c3a
                </span>{' '}
                <span className="text-fg-mute">· destroyed</span> 09:41:07{' '}
                <span className="text-signal">· bytes of source retained: 0</span>
              </p>
            </div>
          </Reveal>

          <Reveal delay={340}>
            <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-x-10 gap-y-3 text-sm text-fg-dim">
              <li className="flex items-center gap-2">
                <IconScan className="h-4 w-4 text-signal" /> Isolated workspace per scan
              </li>
              <li className="flex items-center gap-2">
                <IconCheck className="h-4 w-4 text-signal" /> Deleted on success and failure
              </li>
              <li className="flex items-center gap-2">
                <IconClock className="h-4 w-4 text-signal" /> Timestamp shown in every report
              </li>
            </ul>
          </Reveal>
          <Reveal delay={400}>
            <p className="mt-8 text-sm">
              <Link
                href="/privacy"
                className="inline-flex items-center gap-1.5 text-signal transition-colors hover:text-signal-bright"
              >
                Read the full privacy policy <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ================= Pricing ================= */}
      <section id="pricing" className="scroll-mt-28 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="kicker justify-center text-center">Pricing</p>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="display mx-auto mt-4 max-w-xl text-center text-[clamp(1.9rem,3.8vw,3rem)]">
              Simple pricing. <em>No surprises.</em>
            </h2>
          </Reveal>

          <div className="mx-auto mt-14 grid max-w-3xl gap-5 sm:grid-cols-2">
            <Reveal delay={120}>
              <div className="glass flex h-full flex-col rounded-2xl p-7">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-fg-dim">
                  Free
                </h3>
                <p className="mt-4 text-5xl font-semibold tracking-tight">
                  $0
                  <span className="ml-1 text-base font-normal text-fg-mute">/month</span>
                </p>
                <ul className="mt-7 space-y-3 text-sm text-fg-dim">
                  {[
                    '3 scans per month',
                    'All four security checks',
                    'Full plain-English reports',
                    'Same code-deletion guarantee',
                  ].map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-signal" /> {feat}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 pt-2">
                  <ButtonLink href="/signup" variant="secondary" className="w-full">
                    Start free
                  </ButtonLink>
                </div>
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="beam-border glass flex h-full flex-col rounded-2xl bg-ink-900 p-7">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal">
                    Pro
                  </h3>
                  <span className="rounded-full border border-signal/30 bg-signal/10 px-3 py-1 text-[11px] font-medium text-signal-bright">
                    For launch week &amp; beyond
                  </span>
                </div>
                <p className="mt-4 text-5xl font-semibold tracking-tight">
                  $9
                  <span className="ml-1 text-base font-normal text-fg-mute">/month</span>
                </p>
                <ul className="mt-7 space-y-3 text-sm text-fg-dim">
                  {[
                    'Unlimited scans',
                    'Scan after every change with confidence',
                    'Cancel anytime, keep access to period end',
                    '14-day money-back guarantee',
                  ].map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-signal" /> {feat}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 pt-2">
                  <ButtonLink href="/signup" className="w-full">
                    Go Pro
                  </ButtonLink>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section id="faq" className="scroll-mt-28 py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Reveal>
            <p className="kicker justify-center text-center">Questions, answered</p>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="display mx-auto mt-4 max-w-xl text-center text-[clamp(1.9rem,3.8vw,3rem)]">
              Everything founders <em>ask us.</em>
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <div className="mt-12">
              <Faq items={FAQ_ITEMS} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= Final CTA ================= */}
      <section className="relative overflow-hidden py-32">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(55% 60% at 50% 100%, rgba(54,226,168,0.13), transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Reveal>
            <h2 className="display text-[clamp(2.4rem,5.5vw,4rem)]">
              Launch like someone <em>checked.</em>
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-fg-dim">
              It takes about a minute to find out what your AI left behind. Better you than an
              attacker.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="mt-9">
              <Magnetic>
                <ButtonLink href="/signup" className="px-8 py-4 text-base">
                  Scan my app free
                  <IconArrowRight className="h-4 w-4" />
                </ButtonLink>
              </Magnetic>
            </div>
          </Reveal>
          <Reveal delay={280}>
            <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.2em] text-fg-mute">
              3 free scans a month · no credit card
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
