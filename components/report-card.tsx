// The report card. Two INDEPENDENT scores, never blended, under one plain
// verdict sentence.
//
//   Craft is the headline. Security scanning is a crowded category with
//   well-funded incumbents; judgment in the interface layer is not. This is
//   the number the product exists to produce.
//
//   Exposure is table stakes and a credibility anchor. It stays visible and
//   it never averages into craft: good typography must not hide a leaked
//   key, and a secure app must not be marked up for being safe and dull.
//
// When a proven finding holds a grade down we say so — SSL-Labs style —
// because "capped because a live key is committed" is more useful and more
// shareable than "you lost 37 points". A scan with nothing to look at reads
// "not enough to grade", never a free A+.
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


export function ReportCardPlate({ report }: { report: ReportCard }) {
  const severities: Severity[] = ['critical', 'high', 'medium', 'low'];
  const hasFindings = severities.some((s) => report.tally[s] > 0);
  const noCraftSignal = report.insufficientSignal;
  const worstLayer = report.categories[0];

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
        {/* CRAFT is the headline. Anyone can run a security scanner; the
            question this product exists to answer is whether the interface
            reads as built by someone with judgment. */}
        <div className="flex items-center gap-5 border-r border-[var(--line)] px-6 py-5 sm:px-8">
          <span
            className="display text-7xl leading-none tracking-tight"
            style={{ color: gradeColor(report.craftGrade) }}
          >
            {noCraftSignal ? '—' : report.craftGrade}
          </span>
          <div>
            <p className="label">Craft grade</p>
            <p className="mono-tight mt-1.5 font-mono text-[11px] tabular-nums text-ink-soft">
              {noCraftSignal ? 'not enough to grade' : `${report.craftScore}/100`}
            </p>
            {!noCraftSignal && worstLayer && (
              <p className="mt-1 text-[12px] leading-snug text-ink-mute">
                Weakest: {worstLayer.label.toLowerCase()}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center divide-x divide-[var(--line)] py-4">
          {/* How generated it reads — the number this product is really for */}
          <div className="min-w-44 flex-1 px-5 py-1">
            <p className="mono-tight font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
              Reads as generated
            </p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-well">
              <div
                className="h-full rounded-full bg-ink"
                style={{ width: `${Math.max(report.vibeScore, 2)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-ink-soft">{report.vibeVerdict}</p>
          </div>

          {/* Exposure — table stakes, and the reason to trust the rest */}
          <div className="px-5 py-1">
            <p className="mono-tight font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
              Exposure
            </p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span
                className="display text-3xl tabular-nums"
                style={{ color: gradeColor(report.securityGrade) }}
              >
                {report.securityGrade}
              </span>
              <span className="font-mono text-[10px] text-ink-mute">
                {report.insufficientSignal ? '' : `${report.securityScore}/100`}
              </span>
            </p>
            <p className="mt-1 text-[12px] leading-snug text-ink-mute">
              {hasFindings
                ? severities
                    .filter((s) => report.tally[s] > 0)
                    .map((s) => `${report.tally[s]} ${s}`)
                    .join(' · ')
                : report.insufficientSignal
                  ? '—'
                  : 'nothing found in source'}
            </p>
          </div>
        </div>
      </div>

      {/* Why a grade is capped — the single most useful line when it applies.
          Security caps come from proven findings; the craft cap is the
          accessibility floor, stated rather than hidden in the number. */}
      {(
        [
          ['Craft', report.craftCapReason],
          ['Exposure', report.securityCapReason],
        ] as const
      )
        .filter(([, reason]) => Boolean(reason))
        .map(([which, reason]) => (
          <div key={which} className="rule-hair px-6 py-3 sm:px-8">
            <p className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-soft">
              <span
                className="mt-0.5 shrink-0 rounded px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-white"
                style={{ background: 'var(--color-signal)' }}
              >
                {which} capped
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
              <strong className="font-semibold text-ink">Nothing flagged in the source.</strong>{' '}
              No exposure findings and no craft findings. Read the limits below before treating
              that as a clean bill of health.
            </p>
          )}
        </div>
      )}

      {/* The craft rundown — the seven layers, worst first. This is the
          substance behind the headline grade, so it is labelled and sits
          directly under it rather than reading as a footer. */}
      <div className="rule-hair px-6 pt-4 sm:px-8">
        <p className="label">Where the judgment shows</p>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-6 pb-4 pt-3 sm:grid-cols-4 sm:px-8">
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
