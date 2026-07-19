// The scan report page: an inspection report. Findings grouped by
// severity and filed as numbered items, with the "source destroyed"
// stamp — the product's trust moment — right in the letterhead.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Alert, Card, SeverityBadge } from '@/components/ui';
import { AutoRefresh } from '@/components/auto-refresh';
import { StampIn } from '@/components/fx';
import {
  IconArchive,
  IconArrowRight,
  IconGitHub,
  IconLock,
  LogoMark,
} from '@/components/icons';

export const metadata = { title: 'Scan report' };

const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

const SEVERITY_INTROS: Record<(typeof SEVERITIES)[number], string> = {
  critical: 'Fix these before you launch — they are directly exploitable.',
  high: 'Serious risks. Fix these as soon as you can.',
  medium: 'Weaknesses worth fixing — they make real attacks easier.',
  low: 'Worth reviewing when you get a moment.',
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--color-critical)',
  high: 'var(--color-high)',
  medium: 'var(--color-medium)',
  low: 'var(--color-low)',
};

interface Finding {
  id: string;
  check_type: string;
  severity: string;
  title: string;
  explanation: string;
  file_path: string | null;
  line_start: number | null;
  evidence_masked: string | null;
  recommendation: string;
}

export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: scan } = await supabase
    .from('scans')
    .select('id, source_ref, source_type, status, error_message, stats, source_deleted_at, created_at, finished_at')
    .eq('id', id)
    .maybeSingle();
  if (!scan) notFound();

  const { data: findings } = await supabase
    .from('findings')
    .select('id, check_type, severity, title, explanation, file_path, line_start, evidence_masked, recommendation')
    .eq('scan_id', id);

  const grouped = new Map<string, Finding[]>();
  for (const f of (findings ?? []) as Finding[]) {
    grouped.set(f.severity, [...(grouped.get(f.severity) ?? []), f]);
  }

  const stats = (scan.stats ?? {}) as {
    filesScanned?: number;
    durationMs?: number;
    packagesChecked?: number;
    notes?: string[];
  };
  const inFlight = scan.status === 'queued' || scan.status === 'running';

  // Finding numbers run sequentially through the whole report, worst first.
  const findingNumbers = new Map(
    SEVERITIES.flatMap((sev) => grouped.get(sev) ?? []).map((f, i) => [f.id, i + 1]),
  );

  return (
    <div>
      {inFlight && <AutoRefresh />}

      <div className="mb-5 text-sm">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-ink-mute transition-colors hover:text-ink"
        >
          <IconArrowRight className="h-3.5 w-3.5 rotate-180" />
          All scans
        </Link>
      </div>

      {/* Letterhead */}
      <div className="plate relative px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="label">Security inspection report</p>
            <h1 className="mt-3 flex min-w-0 items-center gap-2.5">
              <span className="shrink-0 text-ink-mute">
                {scan.source_type === 'github' ? (
                  <IconGitHub className="h-5 w-5" />
                ) : (
                  <IconArchive className="h-5 w-5" />
                )}
              </span>
              <span className="mono-tight break-all font-mono text-lg font-semibold text-ink sm:text-xl">
                {scan.source_ref}
              </span>
            </h1>
            <p className="mono-tight mt-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
              Scanned {new Date(scan.created_at).toLocaleString()}
              {typeof stats.filesScanned === 'number' && <> · {stats.filesScanned} files</>}
              {typeof stats.packagesChecked === 'number' && stats.packagesChecked > 0 && (
                <> · {stats.packagesChecked} packages checked</>
              )}
              {typeof stats.durationMs === 'number' && (
                <> · {(stats.durationMs / 1000).toFixed(1)}s</>
              )}
            </p>
          </div>
          <span className="tag tag--ink shrink-0 text-[10px]">
            Report {scan.id.slice(0, 8)}
          </span>
        </div>

        {scan.source_deleted_at && (
          <div className="rule-hair mt-5 pt-4">
            <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px] leading-relaxed text-ink-soft">
              <StampIn>
                <span className="tag tag--safe text-[10px]">
                  <IconLock className="inline-block h-3 w-3 align-[-1.5px]" />
                  Source destroyed
                </span>
              </StampIn>
              <span>
                Your source code was permanently deleted at{' '}
                <strong className="font-semibold text-ink">
                  {new Date(scan.source_deleted_at).toLocaleString()}
                </strong>{' '}
                — we keep findings only.
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 space-y-8">
        {inFlight && (
          <Card className="py-14 text-center">
            <div className="relative mx-auto h-16 w-16">
              <span className="absolute inset-0 rounded-2xl border-[1.5px] border-verdant/60 [animation:ping-square_2s_ease-out_infinite]" />
              <span className="absolute inset-0 grid place-items-center rounded-2xl border-[1.5px] border-ink/40 text-ink">
                <LogoMark className="h-7 w-7" />
              </span>
            </div>
            <p className="mx-auto mt-6 w-fit">
              <span className="tag text-[11px]">Scan in progress</span>
            </p>
            <p className="mt-4 text-sm text-ink-soft">This page refreshes automatically.</p>
          </Card>
        )}

        {scan.status === 'failed' && (
          <Alert tone="error">
            <strong>This scan failed.</strong> {scan.error_message ?? 'Please try again.'}
          </Alert>
        )}

        {scan.status === 'completed' && (findings ?? []).length === 0 && (
          <Card className="py-14 text-center">
            <StampIn>
              <span className="tag tag--safe text-base">Clear · no findings</span>
            </StampIn>
            <p className="prose-serif mx-auto mt-6 max-w-lg text-[15px] text-ink-soft">
              None of our four checks (secrets, platform configuration, dependencies, insecure
              patterns) flagged anything. Remember: automated checks can&apos;t prove an app is
              secure — this is a good sign, not a guarantee.
            </p>
          </Card>
        )}

        {scan.status === 'completed' && (findings ?? []).length > 0 && (
          <>
            {/* The tally — counts per severity, ruled like an instrument row */}
            <div className="plate flex flex-wrap divide-x divide-[var(--line)] px-2 py-4">
              {SEVERITIES.map((sev) => {
                const count = grouped.get(sev)?.length ?? 0;
                if (count === 0) return null;
                return (
                  <span key={sev} className="flex items-center gap-3 px-5 py-1">
                    <span
                      className="display text-3xl tabular-nums"
                      style={{ color: SEVERITY_COLOR[sev] }}
                    >
                      {count}
                    </span>
                    <SeverityBadge severity={sev} />
                  </span>
                );
              })}
            </div>

            {(stats.notes ?? []).map((note) => (
              <Alert key={note} tone="info">
                {note}
              </Alert>
            ))}

            {SEVERITIES.map((sev) => {
              const items = grouped.get(sev);
              if (!items || items.length === 0) return null;
              return (
                <section key={sev}>
                  <div className="rule-index pt-4">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2 className="text-lg font-semibold capitalize tracking-tight">
                        {sev} — {items.length}
                      </h2>
                      <p className="text-sm text-ink-soft">{SEVERITY_INTROS[sev]}</p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-4">
                    {items.map((f) => {
                      const findingNo = findingNumbers.get(f.id) ?? 0;
                      return (
                        <div
                          key={f.id}
                          className="plate plate--plain p-6"
                          style={{
                            borderLeft: `3px solid ${SEVERITY_COLOR[sev]}`,
                          }}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <h3 className="font-semibold tracking-tight text-ink">{f.title}</h3>
                            <span className="mono-tight shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
                              Finding {String(findingNo).padStart(2, '0')}
                            </span>
                          </div>
                          {f.file_path && (
                            <p className="mono-tight mt-1.5 font-mono text-xs text-ink-mute">
                              {f.file_path}
                              {f.line_start ? `:${f.line_start}` : ''}
                            </p>
                          )}
                          {f.evidence_masked && (
                            <pre className="readout mt-4 overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed text-ink-soft">
                              {f.evidence_masked}
                            </pre>
                          )}
                          <div className="mt-5 space-y-4 text-sm leading-relaxed">
                            <div className="border-l-2 border-[var(--line-strong)] pl-4">
                              <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-mute">
                                Why this matters
                              </p>
                              <p className="prose-serif text-[15px] text-ink-soft">{f.explanation}</p>
                            </div>
                            <div className="border-l-2 border-safe/70 pl-4">
                              <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-safe">
                                How to fix it
                              </p>
                              <p className="prose-serif text-[15px] text-ink-soft">{f.recommendation}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            <p className="rule-hair pt-5 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-ink-mute">
              End of report ∎
            </p>
          </>
        )}
      </div>
    </div>
  );
}
