// The report card: the letter grade, the two scores behind it, the vibe
// meter, and the per-category rundown. Pure render — everything shown is
// derived server-side by the scanner and stored in scans.stats.report.
//
// Shared by the full report (/scans/[id]) and the public preview (/r/[id]):
// the grade itself is always free to see; the findings behind it follow
// each page's own gating.

import type { ReportCard } from '@/lib/scanner/types';

/** How loudly the repo reads as unedited AI output, in plain words. */
function vibeVerdict(score: number): string {
  if (score >= 80) return 'Unmistakably vibe coded';
  if (score >= 50) return 'Clearly template-flavored';
  if (score >= 20) return 'A few template tells';
  return 'Reads hand-built';
}

/** Color only ever means something functional: cleared, or hazard. */
function gradeColor(score: number): string {
  if (score >= 90) return 'var(--color-safe)';
  if (score < 63) return 'var(--color-signal)';
  return 'var(--color-ink)';
}

function ScoreCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-5 py-1">
      <p className="mono-tight font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
        {label}
      </p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="display text-3xl tabular-nums text-ink">{value}</span>
        <span className="font-mono text-[10px] text-ink-mute">/100</span>
      </p>
    </div>
  );
}

export function ReportCardPlate({ report }: { report: ReportCard }) {
  return (
    <div className="plate overflow-hidden">
      <div className="flex flex-wrap items-stretch">
        {/* The grade itself — the headline of the whole report */}
        <div className="flex items-center gap-5 border-r border-[var(--line)] px-6 py-5 sm:px-8">
          <span
            className="display text-7xl leading-none tracking-tight"
            style={{ color: gradeColor(report.score) }}
          >
            {report.grade}
          </span>
          <div>
            <p className="label">Repo grade</p>
            <p className="mono-tight mt-1.5 font-mono text-[11px] tabular-nums text-ink-soft">
              {report.score}/100 overall
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center divide-x divide-[var(--line)] py-4">
          <ScoreCell label="Security" value={report.securityScore} />
          <ScoreCell label="Design craft" value={report.designScore} />
          <div className="min-w-44 flex-1 px-5 py-1">
            <p className="mono-tight font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
              Vibe meter
            </p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-well">
              <div
                className="h-full rounded-full bg-ink"
                style={{ width: `${Math.max(report.vibeScore, 2)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-ink-soft">
              {vibeVerdict(report.vibeScore)}
            </p>
          </div>
        </div>
      </div>

      {/* The rundown — every design area, worst first */}
      <div className="rule-hair grid grid-cols-2 gap-x-6 gap-y-3 px-6 py-4 sm:grid-cols-4 sm:px-8">
        {report.categories.map((cat) => (
          <div key={cat.id}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-medium text-ink-soft">{cat.label}</span>
              <span className="mono-tight font-mono text-[11px] tabular-nums text-ink">
                {cat.score}
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-well">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(cat.score, 2)}%`,
                  background: cat.score < 63 ? 'var(--color-signal)' : 'var(--color-ink)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
