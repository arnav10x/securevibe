import Link from 'next/link';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';
import { ButtonLink, Card, SeverityBadge } from '@/components/ui';
import { FREE_SCANS_PER_MONTH, startOfMonthUtc } from '@/lib/quota';
import {
  IconArchive,
  IconArrowUpRight,
  IconCheck,
  IconClock,
  IconGitHub,
  IconAlertTriangle,
  IconPlus,
  IconScan,
  IconSparkle,
} from '@/components/icons';

export const metadata = { title: 'Dashboard' };

// Status → label + glyph, all drawn from the severity/signal palette.
function StatusChip({ status }: { status: string }) {
  const styles: Record<string, { label: string; classes: string; icon: ReactNode }> = {
    queued: {
      label: 'Queued',
      classes: 'text-fg-mute border-[var(--line)]',
      icon: <IconClock className="h-3.5 w-3.5" />,
    },
    running: {
      label: 'Scanning…',
      classes: 'text-signal border-signal/30 bg-signal/10',
      icon: (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
        </span>
      ),
    },
    completed: {
      label: 'Completed',
      classes: 'text-fg-dim border-[var(--line)]',
      icon: <IconCheck className="h-3.5 w-3.5 text-signal" />,
    },
    failed: {
      label: 'Failed',
      classes: 'text-high border-high/30 bg-high/10',
      icon: <IconAlertTriangle className="h-3.5 w-3.5" />,
    },
  };
  const s = styles[status] ?? styles.queued;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${s.classes}`}
    >
      {s.icon}
      {s.label}
    </span>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: scans }, { count: usedThisMonth }] = await Promise.all([
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
  ]);

  const plan = profile?.plan ?? 'free';
  const used = usedThisMonth ?? 0;
  const outOfScans = plan === 'free' && used >= FREE_SCANS_PER_MONTH;
  const quotaPct = Math.min((used / FREE_SCANS_PER_MONTH) * 100, 100);

  // Findings counts per scan for the severity chips.
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

  return (
    <div>
      <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="kicker">Command deck</p>
          <h1 className="display mt-2 text-3xl">Your scans</h1>
          <div className="mt-3 text-sm text-fg-dim">
            {plan === 'pro' ? (
              <p>
                <span className="mr-2 rounded-full border border-signal/30 bg-signal/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-signal">
                  Pro
                </span>
                Unlimited scans · {used} run this month
              </p>
            ) : (
              <div className="flex items-center gap-3">
                <span>
                  Free plan — {used} of {FREE_SCANS_PER_MONTH} scans used this month
                </span>
                <span
                  className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-700"
                  role="img"
                  aria-label={`${used} of ${FREE_SCANS_PER_MONTH} free scans used`}
                >
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-signal-deep to-signal transition-[width] duration-700"
                    style={{ width: `${quotaPct}%` }}
                  />
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
        <Card className="mb-6 border-signal/30">
          <p className="text-sm leading-relaxed text-fg-dim">
            You&apos;ve used all {FREE_SCANS_PER_MONTH} free scans this month.{' '}
            <Link
              href="/account"
              className="font-semibold text-signal transition-colors hover:text-signal-bright"
            >
              Upgrade to Pro
            </Link>{' '}
            for unlimited scans, or come back on the 1st.
          </p>
        </Card>
      )}

      {(scans ?? []).length === 0 ? (
        <Card className="py-14 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-signal/25 bg-signal/10 text-signal shadow-[0_0_32px_rgba(54,226,168,0.2)]">
            <IconScan className="h-7 w-7" />
          </span>
          <h2 className="mt-5 text-xl font-semibold tracking-tight">No scans yet</h2>
          <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-fg-dim">
            Point SecureVibe at a public GitHub repo or upload a zip of your project, and get a
            plain-English security report in about a minute.
          </p>
          <div className="mt-6">
            <ButtonLink href="/scans/new">Run your first scan</ButtonLink>
          </div>
        </Card>
      ) : (
        <ul className="space-y-3">
          {(scans ?? []).map((scan) => {
            const counts = severityByScan.get(scan.id) ?? {};
            return (
              <li key={scan.id}>
                <Link
                  href={`/scans/${scan.id}`}
                  className="glass group block rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--line-strong)]"
                >
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="flex min-w-0 items-center gap-2.5 font-medium">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--line)] bg-ink-800 text-fg-dim">
                        {scan.source_type === 'github' ? (
                          <IconGitHub className="h-4 w-4" />
                        ) : (
                          <IconArchive className="h-4 w-4" />
                        )}
                      </span>
                      <span className="truncate">{scan.source_ref}</span>
                    </span>
                    <StatusChip status={scan.status} />
                    <span className="ml-auto flex items-center gap-2 font-mono text-xs text-fg-mute">
                      {new Date(scan.created_at).toLocaleString()}
                      <IconArrowUpRight className="h-3.5 w-3.5 text-signal opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                    </span>
                  </div>
                  {scan.status === 'completed' && (
                    <div className="mt-3.5 flex flex-wrap items-center gap-2 pl-[42px]">
                      {(['critical', 'high', 'medium', 'low'] as const).map((sev) =>
                        counts[sev] ? (
                          <span key={sev} className="flex items-center gap-1.5 text-sm">
                            <SeverityBadge severity={sev} />
                            <span className="text-fg-dim">{counts[sev]}</span>
                          </span>
                        ) : null,
                      )}
                      {Object.keys(counts).length === 0 && (
                        <span className="flex items-center gap-1.5 text-sm text-signal">
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
      )}
    </div>
  );
}
