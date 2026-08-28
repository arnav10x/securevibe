'use client';

// The scan dashboard, laid out by the product's own attention rules
// (SECUREVIBE.md Part 2):
//
//   ONE focal point per view (2.1, 2.3). The verdict sentence is it: the
//   largest type on the page, isolated by whitespace, read first. Every
//   other element is deliberately quieter, because emphasis is zero-sum —
//   "discriminability requires suppression, not addition."
//
//   Red has ONE job (2.10): defect severity. Weak scores and severity
//   marks are red; nothing decorative is. When something on this page is
//   red, it needs fixing.
//
//   The healthy recede so the broken advance (Von Restorff, 3.4): rings
//   with nothing to show sit at low opacity; rings with findings hold
//   full contrast; the weakest carries the only color.
//
//   Proximity does the grouping (2.2): tight gaps inside a card, wide
//   gaps between cards, so the verdict band and the work area read as
//   two thoughts, not five widgets.
//
// Structure: verdict + readiness track, then eight equal rings (seven
// craft layers + exposure) opening a master-detail panel where findings
// group by signal, then occurrence.

import { useMemo, useState } from 'react';
import type { ReportCard } from '@/lib/scanner/types';
import { isTestPath } from '@/lib/scanner/util';
import {
  PANEL_ORDER,
  groupBySignal,
  panelForFinding,
  readinessScore,
  type PanelId,
  type SignalGroup,
} from '@/lib/report-view';
import { SeverityBadge } from '@/components/ui';
import { IconChevronDown } from '@/components/icons';
import { fixPrompt, SEVERITY_COLOR, type FindingView } from '@/components/findings';

/** Red means "needs fixing" and nothing else. */
const WEAK = 63;
function scoreColor(score: number): string {
  return score < WEAK ? 'var(--color-signal)' : 'var(--color-ink)';
}

const BANDS = [
  { from: 0, label: 'Unreviewed' },
  { from: 30, label: 'Reads generated' },
  { from: 55, label: 'Rough edges' },
  { from: 80, label: 'Ship-shape' },
];

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M6 21V3" strokeLinecap="round" />
      <path d="M6 4h11.5l-2.6 3.5 2.6 3.5H6" fill="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

// ─────────────── card 1: the verdict, then the evidence ────────────────

function VerdictCard({ report }: { report: ReportCard }) {
  const craft = report.craftScore;
  const exposure = report.securityScore;
  const ready = readinessScore(craft, exposure);
  const craftIsLower = craft <= exposure;
  const clamp = (v: number) => Math.min(Math.max(v, 1.5), 98.5);

  return (
    <div className="px-6 pb-6 pt-5 sm:px-8">
      <p className="label">Verdict</p>

      {/* The one focal element on the page. */}
      {report.verdict && (
        <p className="prose-serif mt-3 max-w-2xl text-[21px] leading-snug text-ink sm:text-[24px]">
          {report.verdict}
        </p>
      )}

      {/* The evidence line: quiet, single-voice. */}
      <div className="mt-9 flex items-center gap-5 sm:gap-7">
        <p className="shrink-0">
          <span className="display text-3xl leading-none tabular-nums text-ink">{ready}</span>
          <span className="ml-1 font-mono text-[10px] text-ink-mute">/100</span>
        </p>

        <div className="relative min-w-0 flex-1">
          <div className="relative h-[3px] rounded-full bg-well">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-ink"
              style={{ width: `${ready}%` }}
            />
            {[30, 55, 80].map((t) => (
              <span
                key={t}
                className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-[var(--line-strong)]"
                style={{ left: `${t}%` }}
                aria-hidden
              />
            ))}

            {/* You are here: the lower score, the only chip. */}
            <div
              className="absolute bottom-full mb-1 -translate-x-1/2"
              style={{ left: `${clamp(ready)}%` }}
            >
              <div className="flex flex-col items-center">
                <span className="mono-tight whitespace-nowrap rounded bg-ink px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-paper">
                  {craftIsLower ? 'Craft' : 'Exposure'} {ready}
                </span>
                <span className="h-1.5 w-px bg-ink" aria-hidden />
              </div>
            </div>

            {/* The other axis: a tick, not a competitor. */}
            <div
              className="absolute top-full mt-1 -translate-x-1/2"
              style={{ left: `${clamp(craftIsLower ? exposure : craft)}%` }}
            >
              <div className="flex flex-col items-center">
                <span className="h-1.5 w-px bg-[var(--line-strong)]" aria-hidden />
                <span className="mono-tight whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute">
                  {craftIsLower ? 'Exposure' : 'Craft'} {craftIsLower ? exposure : craft}
                </span>
              </div>
            </div>

            <FlagIcon className="absolute -right-1 bottom-full mb-1 h-3.5 w-3.5 text-ink-mute" />
          </div>

          {/* Band scent, desktop only. */}
          <div className="relative mt-7 hidden h-3 sm:block" aria-hidden>
            {BANDS.map((b, i) => {
              const next = BANDS[i + 1]?.from ?? 100;
              return (
                <span
                  key={b.label}
                  className="mono-tight absolute -translate-x-1/2 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute"
                  style={{ left: `${(b.from + next) / 2}%` }}
                >
                  {b.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-4 text-[12.5px] leading-relaxed text-ink-mute sm:mt-2">
        Distance to production. {craftIsLower ? 'Craft' : 'Exposure'} is what holds it back —
        the other axis sits at {craftIsLower ? exposure : craft}. Never an average.
      </p>
    </div>
  );
}

// ─────────────────────────────── rings ─────────────────────────────────

function Ring({ score, quiet }: { score: number | null; quiet: boolean }) {
  const R = 30;
  const C = 2 * Math.PI * R;
  const value = score ?? 0;
  return (
    <span className="relative inline-block h-[72px] w-[72px]">
      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
        <circle cx="36" cy="36" r={R} fill="none" stroke="var(--line-strong)" strokeWidth="5" />
        {score !== null && (
          <circle
            cx="36"
            cy="36"
            r={R}
            fill="none"
            stroke={scoreColor(value)}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - value / 100)}
          />
        )}
      </svg>
      <span
        className="display absolute inset-0 grid place-items-center text-[19px] tabular-nums"
        style={{ color: score !== null && value < WEAK ? 'var(--color-signal)' : 'var(--color-ink)' }}
      >
        {score === null ? '—' : value}
      </span>
      {quiet && <span className="sr-only">clear</span>}
    </span>
  );
}

// ──────────────────────── one signal, expandable ───────────────────────

function Occurrence({ f }: { f: FindingView }) {
  const color = SEVERITY_COLOR[f.severity] ?? SEVERITY_COLOR.low;
  return (
    <div className="rule-hair px-4 py-4 first:border-t-0 sm:px-5">
      {f.filePath && (
        <p className="mono-tight break-all font-mono text-xs text-ink-mute">
          {f.filePath}
          {f.lineStart ? `:${f.lineStart}` : ''}
        </p>
      )}
      {f.evidenceMasked && (
        <pre className="readout mt-2.5 w-0 min-w-full overflow-x-auto px-4 py-2.5 font-mono text-xs leading-relaxed text-ink-soft">
          {f.evidenceMasked}
        </pre>
      )}
      <div className="mt-3.5 space-y-3.5 text-sm leading-relaxed">
        <div className="border-l-2 pl-4" style={{ borderColor: `color-mix(in srgb, ${color} 60%, transparent)` }}>
          <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color }}>
            Why this matters
          </p>
          <p className="prose-serif text-[14.5px] text-ink-soft">{f.explanation}</p>
        </div>
        <div className="border-l-2 border-safe/70 pl-4">
          <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-safe">
            How to fix it
          </p>
          <p className="prose-serif text-[14.5px] text-ink-soft">{f.recommendation}</p>
        </div>
      </div>
      <details className="mt-3.5">
        <summary className="mono-tight cursor-pointer select-none font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-mute hover:text-ink">
          Fix prompt — paste into Cursor / Lovable / Claude
        </summary>
        <pre className="readout mt-2.5 w-0 min-w-full overflow-x-auto whitespace-pre-wrap px-4 py-3 font-mono text-[11px] leading-relaxed text-ink-soft">
          {fixPrompt(f)}
        </pre>
      </details>
    </div>
  );
}

function SignalBlock({
  group,
  index,
  defaultOpen,
}: {
  group: SignalGroup<FindingView>;
  index: number;
  defaultOpen: boolean;
}) {
  const color = SEVERITY_COLOR[group.severity] ?? SEVERITY_COLOR.low;
  const single = group.count === 1 ? group.findings[0] : null;
  const fileHint = single?.filePath ? single.filePath.split('/').slice(-2).join('/') : null;
  return (
    <details
      open={defaultOpen}
      className="plate plate--plain group/signal overflow-hidden"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <summary className="flex cursor-pointer select-none items-center gap-3 px-4 py-3.5 transition-colors hover:bg-well sm:px-5 [&::-webkit-details-marker]:hidden [&::marker]:content-none">
        <span className="shrink-0">
          <SeverityBadge severity={group.severity} />
        </span>
        <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug tracking-tight text-ink line-clamp-1">
          {group.title}
        </span>
        {group.count > 1 && (
          <span className="mono-tight shrink-0 rounded-full border border-[var(--line-strong)] px-2 py-px font-mono text-[10px] font-semibold tabular-nums text-ink-soft">
            ×{group.count}
          </span>
        )}
        {fileHint && (
          <span className="mono-tight hidden max-w-44 shrink-0 truncate font-mono text-[10px] text-ink-mute sm:block">
            {fileHint}
            {single?.lineStart ? `:${single.lineStart}` : ''}
          </span>
        )}
        <span className="mono-tight hidden shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute sm:block">
          {String(index + 1).padStart(2, '0')}
        </span>
        <IconChevronDown className="h-4 w-4 shrink-0 text-ink-mute transition-transform duration-200 group-open/signal:rotate-180" />
      </summary>
      <div className="border-t border-[var(--line)]">
        {group.findings.map((f) => (
          <Occurrence key={f.id} f={f} />
        ))}
      </div>
    </details>
  );
}

// ───────────────────────────── the dashboard ───────────────────────────

export function ScanDashboard({
  report,
  findings,
}: {
  report: ReportCard;
  findings: FindingView[];
}) {
  const { byPanel, testOnly } = useMemo(() => {
    const byPanel = new Map<PanelId, FindingView[]>(PANEL_ORDER.map((p) => [p.id, []]));
    const testOnly: FindingView[] = [];
    for (const f of findings) {
      if (f.filePath && isTestPath(f.filePath)) {
        testOnly.push(f);
        continue;
      }
      byPanel.get(panelForFinding(f))!.push(f);
    }
    return { byPanel, testOnly };
  }, [findings]);

  const scoreFor = (id: PanelId): number | null => {
    if (report.insufficientSignal) return null;
    if (id === 'exposure') return report.securityScore;
    return report.categories.find((c) => c.id === id)?.score ?? null;
  };

  // Start on the layer that needs the most attention: lowest score among
  // layers that actually have findings.
  const [active, setActive] = useState<PanelId>(() => {
    const withFindings = PANEL_ORDER.filter((p) => (byPanel.get(p.id)?.length ?? 0) > 0);
    if (withFindings.length === 0) return PANEL_ORDER[0].id;
    return withFindings.reduce((worst, p) =>
      (scoreFor(p.id) ?? 100) < (scoreFor(worst.id) ?? 100) ? p : worst,
    ).id;
  });

  const activeMeta = PANEL_ORDER.find((p) => p.id === active)!;
  const activeFindings = byPanel.get(active) ?? [];
  const groups = groupBySignal(activeFindings);
  const capReason = active === 'exposure' ? report.securityCapReason : report.craftCapReason;

  return (
    <div className="space-y-5">
      {/* 1 ── the verdict, then the readiness evidence */}
      <section className="plate overflow-visible">
        <VerdictCard report={report} />
      </section>

      {/* 2 ── the rings, and the panel they open */}
      <section className="plate overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--line)] px-5 py-3 sm:px-6">
          <p className="label">Where the judgment shows</p>
          <p className="mono-tight font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
            Select a layer
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4" role="tablist" aria-label="Report areas">
          {PANEL_ORDER.map((p, i) => {
            const count = byPanel.get(p.id)?.length ?? 0;
            const isActive = active === p.id;
            const score = scoreFor(p.id);
            const clear = count === 0;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                title={p.hint}
                onClick={() => setActive(p.id)}
                className={`flex cursor-pointer flex-col items-center gap-1.5 border-b border-[var(--line)] px-3 pb-3.5 pt-4 transition-all focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink ${
                  i % 2 === 0 ? 'border-r' : i % 4 === 1 ? 'sm:border-r' : ''
                } ${isActive ? 'bg-well' : 'hover:bg-sheet'} ${
                  clear && !isActive ? 'opacity-45 hover:opacity-90' : ''
                }`}
                style={isActive ? { boxShadow: 'inset 0 -3px 0 var(--color-ink)' } : undefined}
              >
                <Ring score={score} quiet={clear} />
                <span className="text-[12.5px] font-semibold leading-tight tracking-tight text-ink">
                  {p.label}
                </span>
                {clear ? (
                  <span className="mono-tight flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M2 6.5 5 9l5-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    clear
                  </span>
                ) : (
                  <span className="text-[11.5px] font-semibold tabular-nums text-ink">
                    {count} finding{count === 1 ? '' : 's'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 3 ── the panel: signals in the selected layer */}
        <div className="px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div>
              <h2 className="text-[16px] font-semibold tracking-tight text-ink">
                {activeMeta.label}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-ink-mute">{activeMeta.hint}.</p>
            </div>
            <p className="mono-tight font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
              {groups.length === 0
                ? 'nothing flagged'
                : `${groups.length} signal${groups.length === 1 ? '' : 's'} · ${activeFindings.length} finding${activeFindings.length === 1 ? '' : 's'}`}
            </p>
          </div>

          {capReason && (
            <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-ink-soft">
              <span
                className="mt-0.5 shrink-0 rounded px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-white"
                style={{ background: 'var(--color-signal)' }}
              >
                Capped
              </span>
              <span>{capReason}</span>
            </p>
          )}

          {groups.length === 0 ? (
            <p className="prose-serif mt-4 text-[15px] text-ink-soft">
              Nothing flagged in {activeMeta.label.toLowerCase()}. A quiet panel is the goal —
              pick a ring with findings to see what to fix next.
            </p>
          ) : (
            <div className="mt-4 space-y-2.5">
              {groups.map((g, i) => (
                <SignalBlock key={g.key} group={g} index={i} defaultOpen={i === 0} />
              ))}
            </div>
          )}

          {active === 'exposure' && testOnly.length > 0 && (
            <details className="mt-5">
              <summary className="mono-tight cursor-pointer select-none font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute hover:text-ink">
                {testOnly.length} finding{testOnly.length === 1 ? '' : 's'} in test files — not
                counted against you
              </summary>
              <div className="mt-3 space-y-2.5">
                {groupBySignal(testOnly).map((g, i) => (
                  <SignalBlock key={g.key} group={g} index={i} defaultOpen={false} />
                ))}
              </div>
            </details>
          )}
        </div>
      </section>

      {/* 4 ── the honest footer, collapsed by default */}
      <section className="plate overflow-hidden">
        <details>
          <summary className="mono-tight cursor-pointer select-none px-6 py-3.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute transition-colors hover:text-ink sm:px-8 [&::-webkit-details-marker]:hidden [&::marker]:content-none">
            What this scan can&apos;t see
          </summary>
          <ul className="space-y-1.5 border-t border-[var(--line)] px-6 py-4 sm:px-8">
            {report.limitations.map((l, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-soft">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-mute" />
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </details>
        {report.provenance && report.provenance.length > 0 && (
          <p className="border-t border-[var(--line)] px-6 py-3 text-[12px] leading-relaxed text-ink-mute sm:px-8">
            <span className="font-semibold text-ink-soft">Workflow context (not scored):</span>{' '}
            {report.provenance.join(' · ')}
          </p>
        )}
      </section>
    </div>
  );
}
