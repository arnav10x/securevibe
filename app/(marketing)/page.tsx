// The landing page, set like an engraved security document — because
// that's what the product mints: a report you can trust. The scanner
// itself sits directly under the hero (the scan desk): paste a repo,
// run a pass, read the verdict. What follows is the ledger: what the
// scanner checks, the detection registry, the deletion promise, the
// rate card as share certificates, the appendix.

import Link from 'next/link';
import { ButtonLink } from '@/components/ui';
import { Magnetic, Reveal, ScrollRail } from '@/components/fx';
import { GuillocheField } from '@/components/guilloche';
import { BrandBelt } from '@/components/brand-logos';
import { DeletionRig } from '@/components/deletion-rig';
import { ScanConsole } from '@/components/scan-console';
import { Faq } from '@/components/faq';
import {
  IconArrowRight,
  IconBraces,
  IconCheck,
  IconClock,
  IconDatabase,
  IconKey,
  IconLayout,
  IconLock,
  IconScan,
} from '@/components/icons';

// The seven craft layers as ledger entries, in the order they carry weight
// in the score, plus exposure as the eighth. Craft is the product; security
// is table stakes and the reason to trust the rest.
const CHECKS = [
  {
    icon: IconLayout,
    fig: '01',
    name: 'Design tokens',
    title: 'Whether a design system exists at all',
    body: 'A design system is a set of decisions. When there is no theme, no custom properties and no token file, every color and radius comes from the framework defaults every other project also ships. Absence is the tell.',
    detects: ['No theme extension', 'Defaults used ad hoc', 'One radius everywhere', 'Multi-hue gradients'],
    severity: '22% of craft',
  },
  {
    icon: IconScan,
    fig: '02',
    name: 'State coverage',
    title: 'Empty, loading, error, offline',
    body: 'Models generate the happy path completely and reliably. Everything else is absent or a placeholder: lists that never handle zero items, spinners driven by a timer, errors swallowed whole, and no error boundary anywhere in the tree.',
    detects: ['No empty states', 'No pending feedback', 'Errors discarded', 'No error boundary'],
    severity: '20% of craft',
  },
  {
    icon: IconBraces,
    fig: '03',
    name: 'Typography',
    title: 'A scale, or sizes picked per element',
    body: 'Size hierarchy is a formula and models produce it perfectly. Attention hierarchy is a judgment and they do not. We check whether the type came from a scale, whether the weight range can build hierarchy without shouting, and whether anything is unreadable.',
    detects: ['One face doing every job', 'Off-scale one-off sizes', 'Bold-and-normal only', 'Below the legibility floor'],
    severity: '15% of craft',
  },
  {
    icon: IconScan,
    fig: '04',
    name: 'Interaction & motion',
    title: 'Whether the interface answers you',
    body: 'A control that does not respond feels dead in a way people register without being able to name. We look for hover and press feedback, pending states on submits, motion that carries information, and durations inside the usable band.',
    detects: ['No hover or press state', 'Forms with no pending state', 'transition-all everywhere', 'Reduced motion ignored'],
    severity: '13% of craft',
  },
  {
    icon: IconLayout,
    fig: '05',
    name: 'Structural layout',
    title: 'Designed against a content model, or one example',
    body: 'The canonical generated page runs hero, feature grid, testimonials, pricing, call to action, with nothing in the sequence specific to this product. Fixed heights on variable content are the direct fingerprint of designing against one hardcoded example.',
    detects: ['The template sequence', 'Fixed heights on content', 'No responsive judgment', 'One file holds the page'],
    severity: '12% of craft',
  },
  {
    icon: IconBraces,
    fig: '06',
    name: 'Copy & content',
    title: 'Voice, specificity, and honest claims',
    body: 'Copy tells as loudly as pixels. Invented user counts and testimonials are the fastest credibility destroyer a page can carry, and they are a real legal exposure. Superlatives are the statistical average of all marketing text, so readers discount them.',
    detects: ['Fabricated social proof', 'Placeholder latin', 'Superlative-dense voice', 'Links that go nowhere'],
    severity: '10% of craft',
  },
  {
    icon: IconKey,
    fig: '07',
    name: 'Accessibility floor',
    title: 'A floor, not a gradient',
    body: 'Below the floor we cap the craft grade no matter what else is true, because an interface keyboard users cannot operate is not well designed however it photographs. Focus styles, semantics, labels, contrast, and zoom.',
    detects: ['Focus outline removed', 'Click handlers on divs', 'Placeholder as the only label', 'Contrast below 4.5:1'],
    severity: 'Caps the grade',
  },
  {
    icon: IconDatabase,
    fig: '08',
    name: 'Exposure',
    title: 'Security, as table stakes',
    body: 'Committed keys, databases without row-level security, packages that do not exist, and the injection surfaces AI-generated code produces most. Scored separately and never averaged into craft: good typography must not hide a leaked key.',
    detects: ['sk_live keys & .env files', 'RLS disabled', 'Hallucinated packages', 'Known CVEs via OSV'],
    severity: 'Scored separately',
  },
];

// The detection registry, excerpted. Craft tells lead; exposure follows.
// Dense on purpose: a list you can check against your own repo persuades
// where a claim about accuracy does not.
const REGISTRY: { sev: 'critical' | 'high' | 'medium'; name: string }[] = [
  { sev: 'high', name: 'No design tokens anywhere' },
  { sev: 'high', name: 'The canonical generated page sequence' },
  { sev: 'high', name: 'Lists that never render empty' },
  { sev: 'high', name: 'No error boundary in the tree' },
  { sev: 'high', name: 'Loading states driven by setTimeout' },
  { sev: 'high', name: '"Trusted by 10,000+" invented claims' },
  { sev: 'high', name: 'Login forms that never authenticate' },
  { sev: 'high', name: 'Focus outlines removed, nothing added' },
  { sev: 'medium', name: 'Multi-hue gradient surfaces' },
  { sev: 'medium', name: 'Emoji standing in for icons' },
  { sev: 'medium', name: 'Fabricated testimonials' },
  { sev: 'medium', name: 'Forms that submit with no feedback' },
  { sev: 'medium', name: 'Click handlers on plain divs' },
  { sev: 'medium', name: 'One spacing value doing every job' },
  { sev: 'medium', name: 'Placeholder legal pages' },
  { sev: 'critical', name: 'sk_live_… Stripe secret keys' },
  { sev: 'critical', name: 'Supabase service-role keys' },
  { sev: 'critical', name: 'RLS disabled on user tables' },
  { sev: 'high', name: 'Package names that do not exist' },
  { sev: 'high', name: 'Known CVEs in your dependencies' },
];

const SEVERITY_DOT: Record<string, string> = {
  critical: 'var(--color-critical)',
  high: 'var(--color-high)',
  medium: 'var(--color-medium)',
};

const FAQ_ITEMS = [
  {
    q: 'Do you keep my source code?',
    a: 'No. Your code lives in an isolated temporary workspace only while the scan runs — typically under a minute — and is permanently deleted the moment the report is ready, even if the scan fails. We keep only the findings: file names, line numbers, and a single masked line of context per issue. Every report shows the exact deletion timestamp.',
  },
  {
    q: 'What does the instant scan show without an account?',
    a: 'Your craft grade, how generated it reads, the exposure grade, plus every medium and low-severity finding with its fix. Critical and high-severity findings come back sealed — you can see how many exist and which check found them, but their contents open only with a free account. The scan you ran attaches to your new account automatically.',
  },
  {
    q: 'Is my code used to train AI models?',
    a: 'Never. The scanner is a deterministic analysis engine — your code is not sent to any AI model, ours or anyone else’s, for any purpose.',
  },
  {
    q: 'Do you run my code?',
    a: 'No. The audit is static analysis only — it reads your files, it never executes them. That protects you and us.',
  },
  {
    q: 'What can I scan?',
    a: 'Instantly: any public GitHub repository. With a free account: also a .zip upload of your project — up to 50 MB and 5,000 files. Private-repo support via GitHub integration is on the roadmap.',
  },
  {
    q: 'Is this just taste? Why should I trust the grade?',
    a: 'The grade never comes from an opinion about whether your design is nice. Every finding is a named signal with a file-and-line citation you can check in ten seconds, and the score is computed in code from those findings. We never flag a color, a typeface, a framework, or a named style, and we never compare your product to some big company\u2019s. Read the methodology and the list of things we refuse to flag.',
  },
  {
    q: 'What do I actually do with a finding?',
    a: 'Every finding ships with a copy-pasteable prompt written for your own coding agent: the file, the current state, the target state, what must not change, and the check that confirms it landed. Paste it into Cursor, Claude Code, or Lovable and the fix usually happens on the first try. For leaked secrets the rule is different: rotate the key, because deleting the file does not remove it from git history.',
  },
  {
    q: 'How do I cancel?',
    a: 'One click from your account page, via Stripe’s billing portal. You keep Pro access until the end of the period you paid for. First subscription payment comes with a 14-day money-back guarantee.',
  },
];

const RAIL_STOPS = [
  { id: 'top', label: 'Top' },
  { id: 'scan-desk', label: 'Scan desk' },
  { id: 'checks', label: 'Checks' },
  { id: 'registry', label: 'Registry' },
  { id: 'promise', label: 'Promise' },
  { id: 'pricing', label: 'Rates' },
  { id: 'faq', label: 'FAQ' },
];

function SectionHead({ n, title, center }: { n: string; title: string; center?: boolean }) {
  return (
    <Reveal>
      <div className={`pt-4 ${center ? 'rule-index rule-index--center text-center' : 'rule-index'}`}>
        <p className={`label ${center ? 'justify-center' : ''}`}>
          No. {n} — {title}
        </p>
      </div>
    </Reveal>
  );
}

export default function LandingPage() {
  return (
    <div className="overflow-x-clip">
      <ScrollRail stops={RAIL_STOPS} invertOn="promise" />

      {/* ================= Hero ================= */}
      <section id="top" className="relative overflow-hidden scroll-mt-24">
        <div aria-hidden className="graph graph--fade" />

        <div className="relative mx-auto w-full max-w-6xl px-4 pb-14 pt-16 sm:px-6 lg:pb-20 lg:pt-24">
          {/* The engraved rosette, turning whole in the open right half */}
          <GuillocheField
            size={540}
            fade={[66, 100]}
            opacity={0.85}
            parallax
            className="-right-10 top-1/2 hidden -translate-y-1/2 md:block xl:right-0"
          />
          <div className="max-w-3xl">
            <Reveal>
              <p className="label">Design audit · for AI-built products</p>
            </Reveal>
            <Reveal delay={90}>
              <h1 className="display mt-6 text-[clamp(2.6rem,6vw,4.6rem)]">
                Your AI built the app.
                <br />
                <em>Can everyone tell?</em>
              </h1>
            </Reveal>
            <Reveal delay={180}>
              <p className="prose-serif mt-6 max-w-xl text-lg text-ink-soft">
                Generic design became free in 2026, so generic design is now worth close to
                nothing. Paste a repo and see, with evidence, exactly what marks your product
                as machine-built{' '}
                <strong className="font-semibold text-ink">
                  to anyone with taste.
                </strong>{' '}
                About a minute, no signup, source destroyed the moment the report exists.
              </p>
            </Reveal>
            <Reveal delay={260}>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Magnetic>
                  <ButtonLink href="#scan-desk" className="px-7 py-3.5 text-[15px]">
                    Scan my code now
                    <IconArrowRight className="h-4 w-4 rotate-90" />
                  </ButtonLink>
                </Magnetic>
                <ButtonLink href="/signup" variant="secondary" className="px-6 py-3.5 text-[15px]">
                  Create free account
                </ButtonLink>
              </div>
            </Reveal>
            <Reveal delay={340}>
              <p className="mono-tight mt-8 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute">
                7 craft layers · security included · 0 bytes of code retained
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= The conveyor belt ================= */}
      <section aria-label="AI coding tools SecureVibe scans" className="border-y border-[var(--line)] py-8">
        <Reveal>
          <p className="label label--bare justify-center">
            Scans what the AI builders build
          </p>
        </Reveal>
        <Reveal delay={100}>
          <div className="mt-6">
            <BrandBelt />
          </div>
        </Reveal>
      </section>

      {/* ================= The scan desk ================= */}
      <section id="scan-desk" className="scroll-mt-24 pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHead n="00" title="The scan desk — live" />
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <Reveal delay={80}>
              <h2 className="display max-w-2xl text-[clamp(1.9rem,3.8vw,2.9rem)]">
                Paste a repo. <em>Get a verdict.</em>
              </h2>
            </Reveal>
            <Reveal delay={140}>
              <p className="prose-serif max-w-sm text-[15px] text-ink-soft">
                Medium &amp; low findings are free to read. Critical &amp; high come back{' '}
                <strong className="font-semibold text-ink">sealed</strong> — a free
                account breaks the seal.
              </p>
            </Reveal>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_280px] lg:gap-10">
            <Reveal delay={120} className="min-w-0">
              <ScanConsole />
            </Reveal>

            {/* The desk's side panel: procedure + promise, at a glance */}
            <Reveal delay={220}>
              <div className="space-y-7 lg:pt-1">
                <div>
                  <p className="label label--bare">Procedure</p>
                  <ol className="mt-3 space-y-3 border-l border-[var(--line)] pl-4 text-sm leading-relaxed text-ink-soft">
                    <li>
                      <span className="mono-tight mr-2 font-mono text-[10px] text-verdant-ink">01</span>
                      Paste a public repo URL — or a .zip with a free account
                    </li>
                    <li>
                      <span className="mono-tight mr-2 font-mono text-[10px] text-verdant-ink">02</span>
                      Eight layers scored in an isolated workspace; nothing executes
                    </li>
                    <li>
                      <span className="mono-tight mr-2 font-mono text-[10px] text-verdant-ink">03</span>
                      Verdict in ≈60s — source destroyed, timestamp on the report
                    </li>
                  </ol>
                </div>
                <div>
                  <p className="label label--bare">Standing promise</p>
                  <ul className="mt-3 space-y-2.5 text-sm text-ink-soft">
                    <li className="flex items-center gap-2.5">
                      <IconLock className="h-4 w-4 shrink-0 text-verdant-ink" /> Never stored,
                      never executed
                    </li>
                    <li className="flex items-center gap-2.5">
                      <IconCheck className="h-4 w-4 shrink-0 text-verdant-ink" /> Never shown to
                      any AI model
                    </li>
                    <li className="flex items-center gap-2.5">
                      <IconClock className="h-4 w-4 shrink-0 text-verdant-ink" /> Deleted on
                      success <em className="italic">and</em> failure
                    </li>
                  </ul>
                  <p className="mt-4 text-sm">
                    <Link href="#promise" className="u-link inline-flex items-center gap-1.5 text-ink-soft">
                      How deletion works <IconArrowRight className="h-3.5 w-3.5 rotate-90" />
                    </Link>
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= The ledger of checks ================= */}
      <section id="checks" className="scroll-mt-24 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHead n="01" title="What the audit grades" />
          <Reveal delay={80}>
            <h2 className="display mt-6 max-w-3xl text-[clamp(1.9rem,3.8vw,2.9rem)]">
              Why AI-built products get discounted — <em>before anyone reads a word.</em>
            </h2>
          </Reveal>

          {/* Ledger rows: one ruled table, data on the right */}
          <div className="mt-12 border-t border-[var(--line-strong)]">
            {CHECKS.map((check, i) => (
              <Reveal key={check.fig} delay={i * 90}>
                <div className="group grid gap-x-8 gap-y-4 border-b border-[var(--line)] py-8 transition-colors duration-200 hover:bg-sheet sm:grid-cols-[150px_1fr] lg:grid-cols-[150px_1.2fr_0.8fr]">
                  <div className="flex items-start gap-5 sm:flex-col">
                    <span className="display text-[2.6rem] leading-none text-ink/15 transition-colors duration-300 group-hover:text-ink/45">
                      {check.fig}
                    </span>
                    <p className="mono-tight flex items-center gap-2 pt-2 font-mono text-[10px] uppercase leading-loose tracking-[0.18em] text-ink-mute sm:pt-0">
                      <check.icon className="h-4 w-4 shrink-0 text-verdant-ink" />
                      {check.name}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold tracking-tight">{check.title}</h3>
                    <p className="prose-serif mt-2 max-w-xl text-[15px] text-ink-soft">
                      {check.body}
                    </p>
                  </div>
                  <div className="lg:border-l lg:border-[var(--line)] lg:pl-8">
                    <dl className="space-y-3">
                      <div>
                        <dt className="mono-tight font-mono text-[9px] uppercase tracking-[0.18em] text-ink-mute">
                          Detects
                        </dt>
                        <dd className="mt-1.5 flex flex-wrap gap-1.5">
                          {check.detects.map((d) => (
                            <span
                              key={d}
                              className="mono-tight rounded-full border border-[var(--line-strong)] bg-sheet px-2.5 py-0.5 font-mono text-[10px] text-ink-soft"
                            >
                              {d}
                            </span>
                          ))}
                        </dd>
                      </div>
                      <div>
                        <dt className="mono-tight font-mono text-[9px] uppercase tracking-[0.18em] text-ink-mute">
                          Severity range
                        </dt>
                        <dd className="mono-tight mt-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ink">
                          {check.severity}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= Detection registry ================= */}
      <section id="registry" className="scroll-mt-24 pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHead n="02" title="Detection registry — excerpt" />
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <Reveal delay={80}>
              <h2 className="display max-w-2xl text-[clamp(1.9rem,3.8vw,2.9rem)]">
                The specific mistakes, <em>by name.</em>
              </h2>
            </Reveal>
            <Reveal delay={140}>
              <p className="prose-serif max-w-sm text-[15px] text-ink-soft">
                An excerpt from the pattern registry the scanner runs on every pass — updated as
                AI coding tools invent new ways to get you breached.
              </p>
            </Reveal>
          </div>

          <Reveal delay={120}>
            <div className="plate mt-10 grid overflow-hidden sm:grid-cols-2 lg:grid-cols-4">
              {REGISTRY.map((item, i) => (
                <div
                  key={item.name}
                  className={[
                    'flex items-center gap-2.5 px-4 py-3.5',
                    i % 2 === 1 ? 'sm:border-l sm:border-[var(--line)]' : '',
                    'lg:border-l lg:border-[var(--line)] lg:first:border-l-0',
                    i >= 2 ? 'border-t border-[var(--line)] sm:border-t' : 'border-t sm:border-t-0',
                    i < 2 ? 'border-t-0' : '',
                    i < 4 ? 'lg:border-t-0' : '',
                    i % 4 === 0 ? 'lg:border-l-0' : '',
                  ].join(' ')}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: SEVERITY_DOT[item.sev] }}
                  />
                  <span className="mono-tight font-mono text-[11.5px] leading-snug text-ink-soft">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={180}>
            <p className="mono-tight mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: SEVERITY_DOT.critical }} />{' '}
                critical
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: SEVERITY_DOT.high }} /> high
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: SEVERITY_DOT.medium }} />{' '}
                medium
              </span>
              <span className="ml-auto">+ the rest of the registry, on every scan</span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ================= The promise ================= */}
      <section id="promise" className="scroll-mt-24">
        <div aria-hidden className="hazard-rule" />
        <div className="relative overflow-hidden bg-ultra py-20 text-bone">
          {/* Engraving turning behind the promise */}
          <GuillocheField
            size={720}
            fade={[55, 98]}
            opacity={0.3}
            className="-left-64 top-1/2 hidden -translate-y-1/2 lg:block"
          />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
              <div>
                <Reveal>
                  <p className="label label--bone">No. 03 — The core promise</p>
                </Reveal>
                <Reveal delay={90}>
                  <h2 className="display mt-6 text-[clamp(2.2rem,4.6vw,3.6rem)] text-bone">
                    Deleted. <em className="!text-bone/55">Actually deleted.</em>
                  </h2>
                </Reveal>
                <Reveal delay={180}>
                  <p className="prose-serif mt-6 max-w-xl text-base text-bone/85 sm:text-lg">
                    Every scan runs in an isolated temporary workspace that is destroyed the
                    moment your report is ready — on success <em className="italic">and</em> on
                    failure. Your source is never stored, never executed, and never used to
                    train any AI model.
                  </p>
                </Reveal>
                <Reveal delay={260}>
                  <p className="prose-serif mt-7 text-xl italic text-bone">
                    The only thing that survives the scan is your report.
                  </p>
                </Reveal>
                <Reveal delay={330}>
                  <p className="mt-7 text-sm">
                    <Link
                      href="/privacy"
                      className="u-link inline-flex items-center gap-1.5 text-bone hover:!text-verdant-soft"
                    >
                      Read the full privacy policy <IconArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </p>
                </Reveal>
              </div>

              <Reveal delay={200}>
                <DeletionRig />
                {/* The purge ledger — a receipt from the rig above */}
                <div className="mono-tight mx-auto mt-6 max-w-md rounded-xl border border-[var(--line-bone)] bg-ultra-deep px-5 py-4 font-mono text-[10px] leading-loose text-bone/75 sm:text-[11px]">
                  <p>
                    <span className="text-bone/45">workspace</span> 4f82…9c3a{' '}
                    <span className="text-bone/45">· created</span> 09:40:26
                  </p>
                  <p>
                    <span className="text-bone/45">report</span> ready{' '}
                    <span className="text-bone/45">· findings kept:</span> 3
                  </p>
                  <p className="flex flex-wrap items-center gap-x-2">
                    <span className="text-bone/45">workspace</span>
                    <span className="line-through decoration-signal decoration-2">4f82…9c3a</span>
                    <span className="text-bone/45">· destroyed</span> 09:41:07
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
        <div aria-hidden className="hazard-rule" />
      </section>

      {/* ================= Pricing — the certificates ================= */}
      <section id="pricing" className="scroll-mt-24 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHead n="04" title="The rate card" center />
          <Reveal delay={80}>
            <h2 className="display mx-auto mt-6 max-w-xl text-center text-[clamp(1.9rem,3.8vw,2.9rem)]">
              Simple pricing. <em>No surprises.</em>
            </h2>
          </Reveal>

          <div className="mx-auto mt-14 grid max-w-3xl gap-8 sm:grid-cols-2 sm:gap-6">
            <Reveal delay={120}>
              <div className="ticket flex h-full flex-col">
                <div className="px-7 pb-6 pt-8">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="label label--bare">Free</p>
                    <p className="mono-tight font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute">
                      Series F · 3 scans/mo
                    </p>
                  </div>
                  <p className="display mt-4 text-5xl">
                    $0
                    <span className="ml-1.5 align-baseline font-mono text-xs font-medium normal-case tracking-[0.1em] text-ink-mute">
                      /month
                    </span>
                  </p>
                </div>
                <div className="ticket-perf mx-6" />
                <div className="flex flex-1 flex-col px-7 pb-8 pt-6">
                  <ul className="space-y-3 text-sm text-ink-soft">
                    {[
                      '3 scans per month + zip uploads',
                      'Full reports — nothing sealed',
                      'All seven craft layers + exposure',
                      'Same code-deletion guarantee',
                    ].map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-verdant-ink" /> {feat}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-8">
                    <ButtonLink href="/signup" variant="secondary" className="w-full">
                      Start free
                    </ButtonLink>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="ticket relative flex h-full flex-col border-ink/35 shadow-[0_1px_2px_rgba(19,19,19,0.06),0_18px_44px_-18px_rgba(19,19,19,0.4)]">
                <span className="absolute -top-3 right-6 z-10 rounded-full bg-ink px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-paper shadow-[0_2px_6px_rgba(19,19,19,0.35)]">
                  Recommended
                </span>
                <div className="px-7 pb-6 pt-8">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="label">Pro</p>
                    <p className="mono-tight font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute">
                      Series P · unlimited
                    </p>
                  </div>
                  <p className="display mt-4 text-5xl">
                    $9
                    <span className="ml-1.5 align-baseline font-mono text-xs font-medium normal-case tracking-[0.1em] text-ink-mute">
                      /month
                    </span>
                  </p>
                </div>
                <div className="ticket-perf mx-6" />
                <div className="flex flex-1 flex-col px-7 pb-8 pt-6">
                  <ul className="space-y-3 text-sm text-ink-soft">
                    {[
                      'Unlimited scans',
                      'Scan after every change with confidence',
                      'Cancel anytime, keep access to period end',
                      '14-day money-back guarantee',
                    ].map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-verdant-ink" /> {feat}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-8">
                    <ButtonLink href="/signup" className="w-full">
                      Go Pro
                    </ButtonLink>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= FAQ (the appendix) ================= */}
      <section id="faq" className="scroll-mt-24 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionHead n="05" title="Appendix — questions" center />
          <Reveal delay={80}>
            <h2 className="display mx-auto mt-6 max-w-xl text-center text-[clamp(1.9rem,3.8vw,2.9rem)]">
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
      <section className="relative overflow-hidden py-24">
        <GuillocheField
          size={560}
          fade={[45, 95]}
          opacity={0.35}
          className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Reveal>
            <div className="mx-auto mb-8 w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element -- static svg */}
              <img src="/logo.svg" alt="" aria-hidden className="h-24 w-24" />
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="display text-[clamp(2.3rem,5.2vw,4rem)]">
              Launch like someone <em>checked.</em>
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="prose-serif mx-auto mt-6 max-w-xl text-lg text-ink-soft">
              The scanner is one scroll up. Better you find it than an attacker.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-9 flex justify-center">
              <Magnetic>
                <ButtonLink href="#scan-desk" className="px-8 py-4 text-[15px]">
                  Run a free scan
                  <IconArrowRight className="h-4 w-4" />
                </ButtonLink>
              </Magnetic>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <p className="label label--bare mt-6 justify-center">
              No signup for public repos · nothing installed
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
