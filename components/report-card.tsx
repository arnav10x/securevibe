// The report card. Two INDEPENDENT grades: Security is the headline (a
// security tool must not hide a leaked key behind good typography), Craft is
// secondary. When a proven serious finding holds the grade down, we say so —
// SSL-Labs style — because "capped at F because a live key is committed" is
// more useful and more shareable than "you lost 37 points". A scan with
// nothing to look at reads "not enough to grade", never a free A+.
//
// Pure render — everything shown is derived server-side by the scanner and
// stored in scans.stats.report.

import type { ReportCard, Severity } from '@/lib/scanner/types';

/** Color only ever means something functional: cleared, or hazard. */
function gradeColor(grade: string): string {
  if (grade === '—') return 'var(--color-ink-mute)';
  if (/^A/.test(grade) || grade === 'B+') return 'var(--color-safe)';
  if (grade.startsWith('F') || grade.startsWith('D')) return 'var(--color-signal)';
  return 'var(--color-ink)';
}

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: 'var(--color-critical)',
  high: 'var(--color-high)',
  medium: 'var(--color-medium)',
  low: 'var(--color-low)',
};

function ScoreCell({ label, value, suffix = '/100' }: { label: string; value: number | string; suffix?: string }) {
  return (
    <div className="px-5 py-1">
      <p className="mono-tight font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
        {label}
      </p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="display text-3xl tabular-nums text-ink">{value}</span>
        <span className="font-mono text-[10px] text-ink-mute">{suffix}</span>
      </p>
    </div>
  );
}

export function ReportCardPlate({ report }: { report: ReportCard }) {
  const severities: Severity[] = ['critical', 'high', 'medium', 'low'];
  const hasFindings = severities.some((s) => report.tally[s] > 0);

  return (
    <div className="plate overflow-hidden">
      {/* The headline verdict — one plain sentence naming what the repo
          reads as. It leads the report because a sentence with cited
          findings under it persuades where a bare number invites argument. */}
      {report.verdict && (
        <div className="border-b border-[var(--line)] px-6 py-4 sm:px-8">
          <p className="label">Verdict</p>
          <p className="prose-serif mt-1.5 text-[17px] leading-snug text-ink">{report.verdict}</p>
        </div>
      )}
      <div className="flex flex-wrap items-stretch">
        {/* The Security grade — the headline of the whole report */}
        <div className="flex items-center gap-5 border-r border-[var(--line)] px-6 py-5 sm:px-8">
          <span
            className="display text-7xl leading-none tracking-tight"
            style={{ color: gradeColor(report.securityGrade) }}
          >
            {report.securityGrade}
          </span>
          <div>
            <p className="label">Security grade</p>
            <p className="mono-tight mt-1.5 font-mono text-[11px] tabular-nums text-ink-soft">
              {report.insufficientSignal ? 'not enough to grade' : `${report.securityScore}/100`}
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center divide-x divide-[var(--line)] py-4">
          {/* At-a-glance severity tally */}
          <div className="px-5 py-1">
            <p className="mono-tight font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
              Findings
            </p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {hasFindings ? (
                severities
                  .filter((s) => report.tally[s] > 0)
                  .map((s) => (
                    <span key={s} className="flex items-baseline gap-1">
                      <span
                        className="display text-xl tabular-nums"
                        style={{ color: SEVERITY_COLOR[s] }}
                      >
                        {report.tally[s]}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wide text-ink-mute">
                        {s}
                      </span>
                    </span>
                  ))
              ) : (
                <span className="text-[13px] text-ink-soft">
                  {report.insufficientSignal ? '—' : 'none'}
                </span>
              )}
            </div>
          </div>
          <ScoreCell label="Craft" value={report.insufficientSignal && !hasFindings ? '—' : report.craftScore} />
          <div className="min-w-40 flex-1 px-5 py-1">
            <p className="mono-tight font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
              Vibe meter
            </p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-well">
              <div
                className="h-full rounded-full bg-ink"
                style={{ width: `${Math.max(report.vibeScore, 2)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-ink-soft">{report.vibeVerdict}</p>
          </div>
        </div>
      </div>

      {/* Why a grade is capped — the single most useful line when it applies.
          Security caps come from proven findings; the craft cap is the
          accessibility floor, stated rather than hidden in the number. */}
      {[report.securityCapReason, report.craftCapReason].filter(Boolean).map((reason) => (
        <div key={reason} className="rule-hair px-6 py-3 sm:px-8">
          <p className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-soft">
            <span
              className="mt-0.5 shrink-0 rounded px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-white"
              style={{ background: 'var(--color-signal)' }}
            >
              Capped
            </span>
            <span>{reason}</span>
          </p>
        </div>
      ))}

      {/* Insufficient-signal / clean honesty banner */}
      {(report.insufficientSignal || report.clean) && (
        <div className="rule-hair px-6 py-3 text-[13px] leading-relaxed text-ink-soft sm:px-8">
          {report.insufficientSignal ? (
            <p>
              <strong className="font-semibold text-ink">Not enough code to grade.</strong> There
              was little or no source to inspect, so this is not a passing grade — it just means we
              couldn&apos;t tell. Point us at the real project to get a meaningful result.
            </p>
          ) : (
            <p>
              <strong className="font-semibold text-ink">No issues found in source.</strong> Our
              source checks didn&apos;t flag anything — a good sign, but read the limits below.
            </p>
          )}
        </div>
      )}

      {/* The craft rundown — every area, worst first */}
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

      {/* What a source scan cannot see — the honesty box */}
      <div className="rule-hair px-6 py-4 sm:px-8">
        <p className="mono-tight font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
          What this scan can&apos;t see
        </p>
        <ul className="mt-2.5 space-y-1.5">
          {report.limitations.map((l, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-soft">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-mute" />
              <span>{l}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Workflow context — recorded, never scored. A CLAUDE.md marks a
          disciplined workflow, not a defect. */}
      {report.provenance && report.provenance.length > 0 && (
        <div className="rule-hair px-6 py-3 sm:px-8">
          <p className="text-[12px] leading-relaxed text-ink-mute">
            <span className="font-semibold text-ink-soft">Workflow context (not scored):</span>{' '}
            {report.provenance.join(' · ')}
          </p>
        </div>
      )}
    </div>
  );
}
