import Link from 'next/link';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';
import { ButtonLink, Card, SeverityBadge } from '@/components/ui';
import { FREE_SCANS_PER_MONTH, startOfMonthUtc } from '@/lib/quota';
import {
  IconArchive,
  IconArrowUpRight,
  IconBraces,
  IconCheck,
  IconClock,
  IconCrosshair,
  IconDatabase,
  IconGitHub,
  IconAlertTriangle,
  IconKey,
  IconLock,
  IconPlus,
  IconLayout,
  IconScan,
  IconSparkle,
} from '@/components/icons';

export const metadata = { title: 'Dashboard' };

const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--color-critical)',
  high: 'var(--color-high)',
  medium: 'var(--color-medium)',
  low: 'var(--color-low)',
};

// Every scan runs all five checks — shown so the product's breadth is
// visible from the dashboard, not just from a finished report.
const COVERAGE = [
  { icon: IconKey, name: 'Secrets', what: 'Exposed keys & credentials' },
  { icon: IconDatabase, name: 'Platform config', what: 'Open databases, RLS off' },
  { icon: IconBraces, name: 'Code patterns', what: 'Injection, eval, TLS off' },
  { icon: IconScan, name: 'Dependencies', what: 'Fake & risky packages' },
  { icon: IconLayout, name: 'Design audit', what: 'Vibe tells, UX craft, repo grade' },
];

// The launch drill: the habits that actually keep an AI-built app safe.
const DRILL = [
  ['Re-scan after every big AI editing session', 'New code means new mistakes — a scan takes a minute.'],
  ['Rotate any key a scan flags, immediately', 'Deleting the file is not enough; git history remembers.'],
  ['Turn on Row Level Security for every user table', 'The single most common hole in AI-built apps.'],
  ['Scan one last time before you launch or share the repo', 'Bots read public repos within minutes.'],
] as const;

// Status → a small chip, set in instrument caps.
function StatusChip({ status }: { status: string }) {
  const styles: Record<string, { label: string; classes: string; icon: ReactNode }> = {
    queued: {
      label: 'Queued',
      classes: 'text-ink-mute border-[var(--line-strong)]',
      icon: <IconClock className="h-3 w-3" />,
    },
    running: {
      label: 'Scanning',
      classes: 'text-verdant-ink border-verdant/60',
      icon: (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full bg-verdant [animation:ping-square_1.4s_ease-out_infinite]" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-verdant" />
        </span>
      ),
    },
    completed: {
      label: 'Report ready',
      classes: 'text-safe border-safe/60',
      icon: <IconCheck className="h-3 w-3" />,
    },
    failed: {
      label: 'Failed',
      classes: 'text-high border-high/60',
      icon: <IconAlertTriangle className="h-3 w-3" />,
    },
  };
  const s = styles[status] ?? styles.queued;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${s.classes}`}
    >
      {s.icon}
      {s.label}
    </span>
  );
}

function StatTile({
  label,
  children,
  foot,
}: {
  label: string;
  children: ReactNode;
  foot?: ReactNode;
}) {
  return (
    <div className="plate plate--plain p-5">
      <p className="mono-tight font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-mute">
        {label}
      </p>
      <div className="mt-2.5 flex items-baseline gap-2">{children}</div>
      {foot && <div className="mt-2 text-[12px] leading-relaxed text-ink-mute">{foot}</div>}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: scans }, { count: usedThisMonth }, { count: totalScans }] =
    await Promise.all([
      supabase.from('profiles').select('plan').eq('id', user!.id).single(),
      supabase
        .from('scans')
        .select('id, source_ref, source_type, status, created_at, stats')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('scans')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'failed')
        .gte('created_at', startOfMonthUtc().toISOString()),
      supabase.from('scans').select('id', { count: 'exact', head: true }),
    ]);

  const plan = profile?.plan ?? 'free';
  const used = usedThisMonth ?? 0;
  const outOfScans = plan === 'free' && used >= FREE_SCANS_PER_MONTH;

  // Findings counts per scan for the severity chips — and, summed,
  // the posture tiles up top.
  const scanIds = (scans ?? []).map((s) => s.id);
  const severityByScan = new Map<string, Record<string, number>>();
  if (scanIds.length > 0) {
    const { data: findingRows } = await supabase
      .from('findings')
      .select('scan_id, severity')
      .in('scan_id', scanIds);
    for (const row of findingRows ?? []) {
      const counts = severityByScan.get(row.scan_id) ?? {};
      counts[row.severity] = (counts[row.severity] ?? 0) + 1;
      severityByScan.set(row.scan_id, counts);
    }
  }
  const totalBySeverity: Record<string, number> = {};
  for (const counts of severityByScan.values()) {
    for (const [sev, n] of Object.entries(counts)) {
      totalBySeverity[sev] = (totalBySeverity[sev] ?? 0) + n;
    }
  }
  const totalFindings = Object.values(totalBySeverity).reduce((a, b) => a + b, 0);
  const hasScans = (scans ?? []).length > 0;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="label">Overview</p>
          <h1 className="display mt-3 text-3xl">Your security desk</h1>
          <div className="mt-3.5 text-sm text-ink-soft">
            {plan === 'pro' ? (
              <p className="flex items-center gap-2.5">
                <span className="rounded-full border border-safe/60 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-safe">
                  Pro
                </span>
                Unlimited scans · {used} run this month
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Free plan — {used} of {FREE_SCANS_PER_MONTH} scans used this month
                </span>
                {/* Quota as cells, spent left to right */}
                <span
                  className="flex gap-1"
                  role="img"
                  aria-label={`${used} of ${FREE_SCANS_PER_MONTH} free scans used`}
                >
                  {Array.from({ length: FREE_SCANS_PER_MONTH }, (_, i) => (
                    <span
                      key={i}
                      className={`h-3 w-4 rounded border border-ink/60 ${
                        i < used ? 'bg-ink' : 'bg-sheet'
                      }`}
                    />
                  ))}
                </span>
              </div>
            )}
          </div>
        </div>
        <ButtonLink href="/scans/new">
          <IconPlus className="h-4 w-4" /> New scan
        </ButtonLink>
      </div>

      {outOfScans && (
        <Card className="mb-6 border-l-[3px] border-l-signal">
          <p className="text-sm leading-relaxed text-ink-soft">
            You&apos;ve used all {FREE_SCANS_PER_MONTH} free scans this month.{' '}
            <Link href="/account" className="u-link font-semibold text-verdant-ink">
              Upgrade to Pro
            </Link>{' '}
            for unlimited scans, or come back on the 1st.
          </p>
        </Card>
      )}

      {/* ---- Posture tiles ---- */}
      {hasScans && (
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Scans on record"
            foot={`Last: ${new Date(scans![0].created_at).toLocaleDateString()}`}
          >
            <span className="display text-3xl tabular-nums">{totalScans ?? scans!.length}</span>
          </StatTile>
          <StatTile
            label="Findings surfaced"
            foot={
              totalFindings > 0 ? (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {SEVERITIES.map((sev) =>
                    totalBySeverity[sev] ? (
                      <span key={sev} className="flex items-center gap-1 tabular-nums">
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: SEVERITY_COLOR[sev] }}
                        />
                        {totalBySeverity[sev]} {sev}
                      </span>
                    ) : null,
                  )}
                </span>
              ) : (
                'Nothing flagged so far — keep scanning'
              )
            }
          >
            <span className="display text-3xl tabular-nums">{totalFindings}</span>
          </StatTile>
          <StatTile
            label="Checks per scan"
            foot="Secrets · config · patterns · dependencies · design"
          >
            <span className="display text-3xl tabular-nums">5</span>
          </StatTile>
          <StatTile
            label="Your code we keep"
            foot={
              <span className="flex items-center gap-1.5 text-safe">
                <IconLock className="h-3.5 w-3.5" /> Deleted after every scan
              </span>
            }
          >
            <span className="display text-3xl tabular-nums">0</span>
            <span className="font-mono text-xs text-ink-mute">bytes</span>
          </StatTile>
        </div>
      )}

      {/* ---- Scan log ---- */}
      {!hasScans ? (
        <Card className="py-14 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-[1.5px] border-ink/40 text-ink">
            <IconCrosshair className="h-7 w-7" />
          </span>
          <h2 className="display mt-6 text-2xl">No scans on record</h2>
          <p className="prose-serif mx-auto mt-3 max-w-md text-[15px] text-ink-soft">
            Point SecureVibe at a public GitHub repo or upload a zip of your project, and get a
            plain-English craft and exposure report in about a minute.
          </p>
          <div className="mt-6 flex justify-center">
            <ButtonLink href="/scans/new">Run your first scan</ButtonLink>
          </div>
        </Card>
      ) : (
        <>
          <p className="label label--bare mb-3">Scan log</p>
          <div className="plate overflow-hidden">
            <ul className="divide-y divide-[var(--line)]">
              {(scans ?? []).map((scan, idx) => {
                const counts = severityByScan.get(scan.id) ?? {};
                return (
                  <li key={scan.id}>
                    <Link
                      href={`/scans/${scan.id}`}
                      className="group block px-4 py-4 transition-colors duration-150 hover:bg-paper sm:px-5"
                    >
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <span className="mono-tight w-8 shrink-0 font-mono text-xs text-ink-mute tabular-nums">
                          {String((scans ?? []).length - idx).padStart(2, '0')}
                        </span>
                        <span className="flex min-w-0 items-center gap-2.5 font-medium">
                          <span className="shrink-0 text-ink-mute">
                            {scan.source_type === 'github' ? (
                              <IconGitHub className="h-4 w-4" />
                            ) : (
                              <IconArchive className="h-4 w-4" />
                            )}
                          </span>
                          <span className="truncate">{scan.source_ref}</span>
                        </span>
                        <StatusChip status={scan.status} />
                        <span className="mono-tight ml-auto flex items-center gap-2 font-mono text-xs text-ink-mute">
                          {new Date(scan.created_at).toLocaleString()}
                          <IconArrowUpRight className="h-3.5 w-3.5 text-verdant-ink opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                        </span>
                      </div>
                      {scan.status === 'completed' && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-12">
                          {SEVERITIES.map((sev) =>
                            counts[sev] ? (
                              <span key={sev} className="flex items-center gap-1.5 text-sm">
                                <SeverityBadge severity={sev} />
                                <span className="text-ink-soft">{counts[sev]}</span>
                              </span>
                            ) : null,
                          )}
                          {Object.keys(counts).length === 0 && (
                            <span className="flex items-center gap-1.5 text-sm text-safe">
                              <IconSparkle className="h-4 w-4" /> No issues found by our checks
                            </span>
                          )}
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}

      {/* ---- The launch drill + what every scan covers ---- */}
      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        <div className="plate plate--plain p-6">
          <p className="label label--bare">The launch drill</p>
          <p className="prose-serif mt-2 text-[14px] text-ink-soft">
            The four habits that keep an AI-built app safe between audits.
          </p>
          <ol className="mt-4 space-y-3.5">
            {DRILL.map(([habit, why], i) => (
              <li key={habit} className="flex gap-3 text-sm leading-relaxed">
                <span className="mono-tight mt-0.5 shrink-0 font-mono text-xs font-semibold tabular-nums text-ink-mute">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>
                  <span className="font-medium text-ink">{habit}.</span>{' '}
                  <span className="text-ink-soft">{why}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="plate plate--plain p-6">
          <p className="label label--bare">Every scan covers</p>
          <p className="prose-serif mt-2 text-[14px] text-ink-soft">
            All five checks run on every pass — nothing to configure.
          </p>
          <ul className="mt-4 space-y-3.5">
            {COVERAGE.map((check) => (
              <li key={check.name} className="flex items-center gap-3 text-sm">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--line-strong)] text-ink">
                  <check.icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="font-medium text-ink">{check.name}</span>
                  <span className="text-ink-mute"> — {check.what}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-[var(--line)] pt-4 text-[13px] leading-relaxed text-ink-soft">
            The registry behind these checks grows as AI tools invent new mistakes — your next
            scan always runs the latest patterns.{' '}
            <Link href="/#registry" className="u-link">
              See the registry
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
