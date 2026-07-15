// The scan report page: findings grouped by severity, plain-English
// explanations, and the "source deleted at" trust stamp.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Alert, Card, SeverityBadge } from '@/components/ui';
import { AutoRefresh } from '@/components/auto-refresh';

export const metadata = { title: 'Scan report — SecureVibe' };

const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

const SEVERITY_INTROS: Record<(typeof SEVERITIES)[number], string> = {
  critical: 'Fix these before you launch — they are directly exploitable.',
  high: 'Serious risks. Fix these as soon as you can.',
  medium: 'Weaknesses worth fixing — they make real attacks easier.',
  low: 'Worth reviewing when you get a moment.',
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

      <div className="mb-2 text-sm">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-200">
          ← All scans
        </Link>
      </div>
      <h1 className="text-2xl font-bold break-all">
        {scan.source_type === 'github' ? '📦' : '🗜️'} {scan.source_ref}
      </h1>
      <p className="mt-1 text-sm text-slate-400">
        Scanned {new Date(scan.created_at).toLocaleString()}
        {typeof stats.filesScanned === 'number' && <> · {stats.filesScanned} files</>}
        {typeof stats.packagesChecked === 'number' && stats.packagesChecked > 0 && (
          <> · {stats.packagesChecked} packages checked</>
        )}
        {typeof stats.durationMs === 'number' && <> · {(stats.durationMs / 1000).toFixed(1)}s</>}
      </p>

      {scan.source_deleted_at && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
          🔒 Your source code was permanently deleted at{' '}
          {new Date(scan.source_deleted_at).toLocaleString()} — we keep findings only.
        </p>
      )}

      <div className="mt-8 space-y-8">
        {inFlight && (
          <Card className="text-center">
            <p className="text-3xl" aria-hidden>
              🔎
            </p>
            <p className="mt-2 font-medium">Scan in progress…</p>
            <p className="mt-1 text-sm text-slate-400">This page refreshes automatically.</p>
          </Card>
        )}

        {scan.status === 'failed' && (
          <Alert tone="error">
            <strong>This scan failed.</strong> {scan.error_message ?? 'Please try again.'}
          </Alert>
        )}

        {scan.status === 'completed' && (findings ?? []).length === 0 && (
          <Card className="text-center">
            <p className="text-4xl" aria-hidden>
              ✨
            </p>
            <h2 className="mt-3 text-lg font-semibold">No issues found by our checks</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-400">
              None of our four checks (secrets, platform configuration, dependencies, insecure
              patterns) flagged anything. Remember: automated checks can&apos;t prove an app is
              secure — this is a good sign, not a guarantee.
            </p>
          </Card>
        )}

        {scan.status === 'completed' && (findings ?? []).length > 0 && (
          <>
            <div className="flex flex-wrap gap-3">
              {SEVERITIES.map((sev) => {
                const count = grouped.get(sev)?.length ?? 0;
                return count > 0 ? (
                  <span key={sev} className="flex items-center gap-2 text-sm">
                    <SeverityBadge severity={sev} />
                    <span className="text-slate-300">{count}</span>
                  </span>
                ) : null;
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
                  <div className="mb-1 flex items-center gap-3">
                    <SeverityBadge severity={sev} />
                    <h2 className="text-lg font-semibold capitalize">
                      {sev} — {items.length}
                    </h2>
                  </div>
                  <p className="mb-4 text-sm text-slate-400">{SEVERITY_INTROS[sev]}</p>
                  <div className="space-y-4">
                    {items.map((f) => (
                      <Card key={f.id}>
                        <h3 className="font-semibold text-slate-100">{f.title}</h3>
                        {f.file_path && (
                          <p className="mt-1 font-mono text-xs text-slate-400">
                            {f.file_path}
                            {f.line_start ? `:${f.line_start}` : ''}
                          </p>
                        )}
                        {f.evidence_masked && (
                          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 px-3 py-2 font-mono text-xs text-slate-300">
                            {f.evidence_masked}
                          </pre>
                        )}
                        <div className="mt-4 space-y-3 text-sm leading-relaxed">
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Why this matters
                            </p>
                            <p className="text-slate-300">{f.explanation}</p>
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              How to fix it
                            </p>
                            <p className="text-slate-300">{f.recommendation}</p>
                          </div>
                        </div>
                      </Card>
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
