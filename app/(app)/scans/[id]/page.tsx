// The scan report page: findings grouped by severity, plain-English
// explanations, and the "source deleted at" trust stamp.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Alert, Card, SeverityBadge } from '@/components/ui';
import { AutoRefresh } from '@/components/auto-refresh';
import {
  IconArchive,
  IconArrowRight,
  IconGitHub,
  IconLock,
  IconSparkle,
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

// Left-edge accent colors for finding cards, keyed by severity.
const SEVERITY_EDGE: Record<string, string> = {
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

  return (
    <div>
      {inFlight && <AutoRefresh />}

      <div className="mb-4 text-sm">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-fg-mute transition-colors hover:text-fg"
        >
          <IconArrowRight className="h-3.5 w-3.5 rotate-180" />
          All scans
        </Link>
      </div>

      <div className="flex items-start gap-3.5">
        <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-ink-800 text-fg-dim">
          {scan.source_type === 'github' ? (
            <IconGitHub className="h-5 w-5" />
          ) : (
            <IconArchive className="h-5 w-5" />
          )}
        </span>
        <div className="min-w-0">
          <h1 className="display break-all text-2xl sm:text-3xl">{scan.source_ref}</h1>
          <p className="mt-1.5 font-mono text-xs text-fg-mute">
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
      </div>

      {scan.source_deleted_at && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-signal/30 bg-signal/10 px-3.5 py-1.5 text-xs leading-relaxed text-signal-bright">
          <IconLock className="h-3.5 w-3.5 shrink-0 text-signal" />
          Your source code was permanently deleted at{' '}
          {new Date(scan.source_deleted_at).toLocaleString()} — we keep findings only.
        </p>
      )}

      <div className="mt-9 space-y-9">
        {inFlight && (
          <Card className="py-12 text-center">
            <div className="relative mx-auto h-16 w-16">
              <span className="absolute inset-0 animate-ping rounded-2xl border border-signal/40 [animation-duration:2s]" />
              <span className="absolute inset-0 grid place-items-center rounded-2xl border border-signal/40 bg-signal/10 text-signal">
                <LogoMark className="h-7 w-7" />
              </span>
            </div>
            <p className="mt-5 font-medium">Scan in progress…</p>
            <p className="mt-1.5 text-sm text-fg-dim">This page refreshes automatically.</p>
          </Card>
        )}

        {scan.status === 'failed' && (
          <Alert tone="error">
            <strong>This scan failed.</strong> {scan.error_message ?? 'Please try again.'}
          </Alert>
        )}

        {scan.status === 'completed' && (findings ?? []).length === 0 && (
          <Card className="py-14 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-signal/25 bg-signal/10 text-signal shadow-[0_0_36px_rgba(54,226,168,0.25)]">
              <IconSparkle className="h-7 w-7" />
            </span>
            <h2 className="mt-5 text-xl font-semibold tracking-tight">
              No issues found by our checks
            </h2>
            <p className="mx-auto mt-2.5 max-w-lg text-sm leading-relaxed text-fg-dim">
              None of our four checks (secrets, platform configuration, dependencies, insecure
              patterns) flagged anything. Remember: automated checks can&apos;t prove an app is
              secure — this is a good sign, not a guarantee.
            </p>
          </Card>
        )}

        {scan.status === 'completed' && (findings ?? []).length > 0 && (
          <>
            {/* Severity summary strip */}
            <div className="glass flex flex-wrap gap-x-8 gap-y-4 rounded-2xl px-6 py-5">
              {SEVERITIES.map((sev) => {
                const count = grouped.get(sev)?.length ?? 0;
                if (count === 0) return null;
                return (
                  <span key={sev} className="flex items-center gap-3">
                    <span
                      className="text-3xl font-semibold tabular-nums tracking-tight"
                      style={{ color: SEVERITY_EDGE[sev] }}
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
                  <div className="mb-1.5 flex items-center gap-3">
                    <SeverityBadge severity={sev} />
                    <h2 className="text-lg font-semibold capitalize tracking-tight">
                      {sev} — {items.length}
                    </h2>
                  </div>
                  <p className="mb-5 text-sm text-fg-dim">{SEVERITY_INTROS[sev]}</p>
                  <div className="space-y-4">
                    {items.map((f) => (
                      <div
                        key={f.id}
                        className="glass rounded-2xl p-6"
                        style={{
                          borderLeft: `2px solid color-mix(in srgb, ${SEVERITY_EDGE[sev]} 55%, transparent)`,
                        }}
                      >
                        <h3 className="font-semibold tracking-tight text-fg">{f.title}</h3>
                        {f.file_path && (
                          <p className="mt-1.5 font-mono text-xs text-fg-mute">
                            {f.file_path}
                            {f.line_start ? `:${f.line_start}` : ''}
                          </p>
                        )}
                        {f.evidence_masked && (
                          <pre className="mt-4 overflow-x-auto rounded-xl border border-[var(--line)] bg-ink px-4 py-3 font-mono text-xs leading-relaxed text-fg-dim">
                            {f.evidence_masked}
                          </pre>
                        )}
                        <div className="mt-5 space-y-4 text-sm leading-relaxed">
                          <div>
                            <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-mute">
                              Why this matters
                            </p>
                            <p className="text-fg-dim">{f.explanation}</p>
                          </div>
                          <div>
                            <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-signal">
                              How to fix it
                            </p>
                            <p className="text-fg-dim">{f.recommendation}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
