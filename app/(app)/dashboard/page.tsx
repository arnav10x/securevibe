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
  IconCrosshair,
  IconGitHub,
  IconAlertTriangle,
  IconPlus,
  IconSparkle,
} from '@/components/icons';

export const metadata = { title: 'Dashboard' };

// Status → a small placard, set like everything else in instrument caps.
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
      className={`inline-flex items-center gap-1.5 border-[1.5px] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${s.classes}`}
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
          <p className="label">Scan log</p>
          <h1 className="display mt-3 text-3xl">Your scans</h1>
          <div className="mt-3.5 text-sm text-ink-soft">
            {plan === 'pro' ? (
              <p className="flex items-center gap-2.5">
                <span className="border-[1.5px] border-safe/60 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-safe">
                  Pro
                </span>
                Unlimited scans · {used} run this month
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Free plan — {used} of {FREE_SCANS_PER_MONTH} scans used this month
                </span>
                {/* Quota as fuel cells, spent left to right */}
                <span
                  className="flex gap-1"
                  role="img"
                  aria-label={`${used} of ${FREE_SCANS_PER_MONTH} free scans used`}
                >
                  {Array.from({ length: FREE_SCANS_PER_MONTH }, (_, i) => (
                    <span
                      key={i}
                      className={`h-3 w-4 rounded-sm border border-ink/60 ${
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

      {(scans ?? []).length === 0 ? (
        <Card className="py-14 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-[1.5px] border-ink/40 text-ink">
            <IconCrosshair className="h-7 w-7" />
          </span>
          <h2 className="display mt-6 text-2xl">No scans on record</h2>
          <p className="prose-serif mx-auto mt-3 max-w-md text-[15px] text-ink-soft">
            Point SecureVibe at a public GitHub repo or upload a zip of your project, and get a
            plain-English security report in about a minute.
          </p>
          <div className="mt-6 flex justify-center">
            <ButtonLink href="/scans/new">Run your first scan</ButtonLink>
          </div>
        </Card>
      ) : (
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
                      <span className="mono-tight w-8 shrink-0 font-mono text-[11px] text-ink-mute tabular-nums">
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
                      <span className="mono-tight ml-auto flex items-center gap-2 font-mono text-[11px] text-ink-mute">
                        {new Date(scan.created_at).toLocaleString()}
                        <IconArrowUpRight className="h-3.5 w-3.5 text-verdant-ink opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                      </span>
                    </div>
                    {scan.status === 'completed' && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-12">
                        {(['critical', 'high', 'medium', 'low'] as const).map((sev) =>
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
      )}
    </div>
  );
}
