// The scan report page: an instrument panel, not a scroll. The letterhead
// carries the "source destroyed" stamp (the product's trust moment); the
// dashboard puts the distance-to-production meter, the eight rings, and
// the per-layer signal panel on one screen.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { ReportCard } from '@/lib/scanner/types';
import { Alert, Card } from '@/components/ui';
import { AutoRefresh } from '@/components/auto-refresh';
import { toFindingView } from '@/components/findings';
import { FindingsBrowser } from '@/components/findings-browser';
import { ScanDashboard } from '@/components/scan-dashboard';
import { StampIn } from '@/components/fx';
import {
  IconArchive,
  IconArrowRight,
  IconGitHub,
  IconLock,
  LogoMark,
} from '@/components/icons';

export const metadata = { title: 'Scan report' };

/** Row origin tags — which of the five checks filed the finding. */
const CHECK_LABELS: Record<string, string> = {
  secret: 'Secrets',
  platform_config: 'Config',
  dependency: 'Deps',
  insecure_pattern: 'Code',
  design: 'Craft',
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
  confidence?: string;
  rule_id?: string | null;
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
    .select('id, check_type, severity, confidence, rule_id, title, explanation, file_path, line_start, evidence_masked, recommendation')
    .eq('scan_id', id);

  // One list, worst first; CRAFT findings lead within a severity band.
  // Craft is what this product is for, and the first finding a reader
  // recognizes as true is what decides whether they believe the rest.
  // The browser tabs and numbers everything from this order.
  const all = (findings ?? []) as Finding[];
  const browserFindings = all
    .sort((a, b) => {
      const aCraft = a.check_type === 'design' ? 0 : 1;
      const bCraft = b.check_type === 'design' ? 0 : 1;
      if (aCraft !== bCraft) return aCraft - bCraft;
      return (a.file_path ?? '').localeCompare(b.file_path ?? '');
    })
    .map((f) => ({
      ...toFindingView(f),
      typeLabel: CHECK_LABELS[f.check_type] ?? f.check_type,
    }));

  const stats = (scan.stats ?? {}) as {
    filesScanned?: number;
    durationMs?: number;
    packagesChecked?: number;
    notes?: string[];
    report?: ReportCard;
  };
  const inFlight = scan.status === 'queued' || scan.status === 'running';

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
            <p className="label">Craft &amp; exposure report</p>
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

        {scan.status === 'completed' && stats.report && (
          <ScanDashboard report={stats.report} findings={browserFindings} />
        )}

        {/* Legacy scans with no report card still get an honest clean note. */}
        {scan.status === 'completed' && !stats.report && all.length === 0 && (
          <Card className="py-14 text-center">
            <StampIn>
              <span className="tag tag--safe text-base">Clear · no findings</span>
            </StampIn>
            <p className="prose-serif mx-auto mt-6 max-w-lg text-[15px] text-ink-soft">
              Nothing flagged across the seven craft layers or the exposure checks. That is
              a good sign, not a guarantee: a static scan cannot see your running app, and it
              cannot judge what a page looks like once it renders.
            </p>
          </Card>
        )}

        {scan.status === 'completed' && (stats.notes ?? []).length > 0 && (
          <details className="px-1">
            <summary className="mono-tight cursor-pointer select-none font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute hover:text-ink">
              Scan notes ({(stats.notes ?? []).length})
            </summary>
            <div className="mt-3 space-y-2">
              {(stats.notes ?? []).map((note) => (
                <Alert key={note} tone="info">
                  {note}
                </Alert>
              ))}
            </div>
          </details>
        )}

        {/* Legacy scans that predate the report card: the old severity queue */}
        {scan.status === 'completed' && !stats.report && all.length > 0 && (
          <FindingsBrowser findings={browserFindings} />
        )}

        {scan.status === 'completed' && all.length > 0 && (
          <p className="rule-hair pt-5 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-ink-mute">
            End of report ∎
          </p>
        )}
      </div>
    </div>
  );
}
