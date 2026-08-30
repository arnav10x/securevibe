'use client';

// The scan dashboard, laid out by the product's own attention rules
// (SECUREVIBE.md Part 2):
//
//   ONE focal point per view (2.1, 2.3). The verdict sentence is it: the
//   largest type on the page, isolated by whitespace, read first. Every
//   other element is deliberately quieter, because emphasis is zero-sum —
//   "discriminability requires suppression, not addition."
//
//   Red has ONE job (2.10): points being lost. Deductions and severity
//   marks are red; nothing decorative is. When something on this page is
//   red, it costs.
//
//   Proximity does the grouping (2.2): tight gaps inside a card, wide
//   gaps between cards, so the verdict band and the work area read as
//   two thoughts, not five widgets.
//
// Structure per SECUREVIBE-GRADING.md section 6: deductions ordered
// largest first, each with what we found, why it reads as vibe coded,
// and a paste-ready fix prompt. Then the dialect line, the percentile
// line, and the professional end state.

import { useMemo, useState } from 'react';
import type { ReportCard, StructureDeduction } from '@/lib/scanner/types';
import { isTestPath } from '@/lib/scanner/util';
import { END_STATE_RULES } from '@/lib/scanner/uiux/score';
import {
  EXPOSURE_PANEL,
  groupBySignal,
  projectedReadiness,
  readinessScore,
  type PanelId,
  type SignalGroup,
} from '@/lib/report-view';
import { SeverityBadge } from '@/components/ui';
import { IconChevronDown } from '@/components/icons';
import { fixPrompt, SEVERITY_COLOR, type FindingView } from '@/components/findings';
import { GuillocheField } from '@/components/guilloche';

/** Red means "costing you points" and nothing else. */
const WEAK = 63;
function scoreColor(score: number): string {
  return score < WEAK ? 'var(--color-signal)' : 'var(--color-ink)';
}

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M6 21V3" strokeLinecap="round" />
      <path d="M6 4h11.5l-2.6 3.5 2.6 3.5H6" fill="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

// ─────────────── card 1: the verdict, then the evidence ────────────────

function VerdictCard({
  report,
  preview,
}: {
  report: ReportCard;
  /** Projected readiness while a row is hovered; null when idle. */
  preview: number | null;
}) {
  const structure = report.structure;
  const craft = report.craftScore;
  const exposure = report.securityScore;
  const ready = readinessScore(craft, exposure);
  const craftIsLower = craft <= exposure;
  const clamp = (v: number) => Math.min(Math.max(v, 1.5), 98.5);
  const gain = preview !== null && preview > ready ? preview - ready : 0;

  const chips: { label: string; strong?: boolean }[] = [];
  if (structure?.applicable) {
    chips.push({ label: `Top ${structure.percentile.topPercent}%`, strong: true });
    if (structure.scriptMatch.matched > 0) {
      chips.push({
        label: `Template script ${structure.scriptMatch.matched}/${structure.scriptMatch.total}`,
      });
    }
    if (structure.dialect) chips.push({ label: `Dialect ${structure.dialect}` });
  }

  return (
    <div className="relative overflow-hidden px-6 pb-5 pt-4 sm:px-8">
      {/* The house engraving, faint, behind the verdict — the one branded
          surface in the app. Masked so it never competes with the text. */}
      <GuillocheField
        size={360}
        fade={[40, 95]}
        opacity={0.3}
        className="-right-24 -top-24 hidden sm:block"
      />

      <div className="relative">
        <p className="label">Verdict</p>

        {/* The one focal element on the page. */}
        {report.verdict && (
          <p className="prose-serif mt-2.5 max-w-3xl text-[19px] leading-snug text-ink sm:text-[22px]">
            {report.verdict}
          </p>
        )}

        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((c) => (
              <span
                key={c.label}
                className={`mono-tight rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${
                  c.strong
                    ? 'border-ink bg-ink text-paper'
                    : 'border-[var(--line-strong)] text-ink-soft'
                }`}
              >
                {c.label}
              </span>
            ))}
          </div>
        )}

        {/* The evidence line: quiet, single-voice. */}
        <div className="mt-7 flex items-center gap-5 sm:gap-7">
          <p className="shrink-0">
            <span className="display text-3xl leading-none tabular-nums text-ink">{ready}</span>
            <span className="display ml-0.5 text-lg text-ink-mute">%</span>
          </p>

          <div className="relative min-w-0 flex-1">
            <div className="relative h-2.5 rounded-full bg-well shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-ink transition-[width] duration-200 ease-out motion-reduce:transition-none"
                style={{ width: `${ready}%` }}
              />
              {gain > 0 && (
                <div
                  className="absolute inset-y-0 rounded-r-full bg-ink/25 transition-[width,left] duration-200 ease-out motion-reduce:transition-none"
                  style={{ left: `${ready}%`, width: `${gain}%` }}
                />
              )}

              {/* You are here: the lower score, the only chip. */}
              <div
                className="absolute bottom-full mb-1.5 -translate-x-1/2"
                style={{ left: `${clamp(ready)}%` }}
              >
                <div className="flex flex-col items-center">
                  <span className="mono-tight whitespace-nowrap rounded bg-ink px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-paper">
                    {craftIsLower ? 'Structure' : 'Exposure'} {ready}%
                  </span>
                  <span className="h-1.5 w-px bg-ink" aria-hidden />
                </div>
              </div>

              {/* The projected gain, while hovering a row. */}
              {gain >= 4 && preview !== null && (
                <span
                  className="mono-tight absolute bottom-full mb-2 -translate-x-1/2 whitespace-nowrap font-mono text-[9.5px] font-semibold tabular-nums text-ink-soft"
                  style={{ left: `${clamp(preview)}%` }}
                >
                  +{gain}%
                </span>
              )}

              {/* The other axis: a tick, not a competitor. */}
              <div
                className="absolute top-full mt-1.5 -translate-x-1/2"
                style={{ left: `${clamp(craftIsLower ? exposure : craft)}%` }}
              >
                <div className="flex flex-col items-center">
                  <span className="h-1.5 w-px bg-[var(--line-strong)]" aria-hidden />
                  <span className="mono-tight whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute">
                    {craftIsLower ? 'Exposure' : 'Structure'} {craftIsLower ? exposure : craft}%
                  </span>
                </div>
              </div>

              <FlagIcon className="absolute -right-1 bottom-full mb-1.5 h-3.5 w-3.5 text-ink-mute" />
            </div>
          </div>
        </div>

        <p className="mt-4 text-[12px] leading-relaxed text-ink-mute sm:mt-3">
          Distance to production, set by the lower axis — never an average. Hover a finding to
          preview the points it returns.
        </p>
      </div>
    </div>
  );
}

// ─────────────── the exposure gauge (unchanged mechanics) ──────────────

function Gauge({ score, small = false }: { score: number | null; small?: boolean }) {
  const R = 30;
  const C = Math.PI * R; // half circle
  const value = score ?? 0;
  return (
    <span className={`relative inline-block ${small ? 'h-[30px] w-[50px]' : 'h-[46px] w-[76px]'}`}>
      <svg viewBox="0 0 72 42" className="h-auto w-full">
        <path
          d="M 6 36 A 30 30 0 0 1 66 36"
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {score !== null && value > 0 && (
          <path
            d="M 6 36 A 30 30 0 0 1 66 36"
            fill="none"
            stroke={scoreColor(value)}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - value / 100)}
          />
        )}
      </svg>
      <span
        className={`display absolute inset-x-0 bottom-0 text-center leading-none tabular-nums ${small ? 'text-[12px]' : 'text-[17px]'}`}
        style={{ color: score !== null && value < WEAK ? 'var(--color-signal)' : 'var(--color-ink)' }}
      >
        {score === null ? '—' : (
          <>
            {value}
            <span className={small ? 'text-[8px]' : 'text-[10px]'}>%</span>
          </>
        )}
      </span>
    </span>
  );
}

// ─────────────── copy-to-clipboard for a fix prompt ────────────────────

function CopyPrompt({ prompt }: { prompt: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setState('copied');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      // Clipboard can be blocked (permissions, embedded webviews). Open the
      // preview so the text is selectable instead of failing silently.
      setState('manual');
    }
  };
  return (
    <div className="mt-3 rounded-xl border border-[var(--line)] bg-sheet">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
        <p className="text-[12.5px] leading-snug text-ink-soft">
          <span className="font-semibold text-ink">Fix prompt</span> — paste into your AI tool.
        </p>
        <button
          type="button"
          onClick={copy}
          className="mono-tight shrink-0 cursor-pointer rounded-full border border-ink bg-ink px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-paper transition-colors hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          {state === 'copied' ? 'Copied' : 'Copy prompt'}
        </button>
      </div>
      <div className="border-t border-[var(--line)] px-3.5 py-3">
        {state === 'manual' && (
          <p className="mono-tight mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
            Copy blocked. Select the text below
          </p>
        )}
        <pre className="readout w-0 min-w-full overflow-x-auto whitespace-pre-wrap px-4 py-3 font-mono text-[11px] leading-relaxed text-ink-soft">
          {prompt}
        </pre>
      </div>
    </div>
  );
}

// ─────────────── one structural deduction, in the spec's format ────────

function DeductionDetail({
  deduction,
  projected,
  score,
}: {
  deduction: StructureDeduction;
  projected: number | null;
  score: number;
}) {
  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight text-ink">
            {deduction.name}
            <span
              className="mono-tight ml-2.5 align-middle font-mono text-[12px] font-semibold tabular-nums"
              style={{ color: 'var(--color-signal)' }}
            >
              −{deduction.points} points
            </span>
          </h2>
          {projected !== null && projected > score && (
            <p className="mt-0.5 text-[12.5px] text-ink-mute">
              Fixing this takes the structure score from {score} to {projected}.
            </p>
          )}
        </div>
      </div>

      {deduction.filePath && (
        <p className="mono-tight mt-3 break-all font-mono text-xs text-ink-mute">
          {deduction.filePath}
          {deduction.lineStart ? `:${deduction.lineStart}` : ''}
        </p>
      )}
      {deduction.evidence && (
        <pre className="readout mt-2.5 w-0 min-w-full overflow-x-auto px-4 py-2.5 font-mono text-xs leading-relaxed text-ink-soft">
          {deduction.evidence}
        </pre>
      )}

      <div className="mt-4 space-y-4 text-sm leading-relaxed">
        <div
          className="border-l-2 pl-4"
          style={{ borderColor: 'color-mix(in srgb, var(--color-signal) 60%, transparent)' }}
        >
          <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--color-signal)' }}>
            What we found
          </p>
          <p className="prose-serif text-[14.5px] text-ink-soft">{deduction.found}</p>
        </div>
        <div className="border-l-2 border-[var(--line-strong)] pl-4">
          <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-mute">
            Why it reads as vibe coded
          </p>
          <p className="prose-serif text-[14.5px] text-ink-soft">{deduction.why}</p>
        </div>
      </div>

      <CopyPrompt prompt={deduction.fixPrompt} />
    </div>
  );
}

// ─────────────── exposure occurrences (unchanged mechanics) ────────────

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
  const structure = report.structure;
  const deductions = structure?.applicable ? structure.deductions : [];

  const { exposureFindings, testOnly } = useMemo(() => {
    const exposureFindings: FindingView[] = [];
    const testOnly: FindingView[] = [];
    for (const f of findings) {
      if (f.checkType === 'design') continue; // rendered from the structure summary
      if (f.filePath && isTestPath(f.filePath)) testOnly.push(f);
      else exposureFindings.push(f);
    }
    return { exposureFindings, testOnly };
  }, [findings]);

  // Start on the largest deduction; exposure when there are none.
  const [active, setActive] = useState<PanelId>(() =>
    deductions.length > 0 ? deductions[0].signal : EXPOSURE_PANEL,
  );
  const [hovered, setHovered] = useState<PanelId | null>(null);

  const ready = readinessScore(report.craftScore, report.securityScore);
  const projectFor = (id: PanelId): number | null => {
    if (report.insufficientSignal) return null;
    if (id === EXPOSURE_PANEL && exposureFindings.length === 0) return null;
    return projectedReadiness(report, id);
  };
  const preview = hovered ? projectFor(hovered) : null;

  const selectPanel = (id: PanelId) => {
    setActive(id);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      requestAnimationFrame(() => {
        document.getElementById('scan-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const activeDeduction = deductions.find((d) => d.signal === active) ?? null;
  const exposureGroups = groupBySignal(exposureFindings);
  const activeProjectedStructure =
    activeDeduction && structure
      ? Math.min(100, structure.score + activeDeduction.points)
      : null;

  return (
    <div className="space-y-5">
      {/* 1 ── the verdict, then the readiness evidence */}
      <section className="plate overflow-visible">
        <VerdictCard report={report} preview={preview} />
      </section>

      {/* When the repo has no marketing page, say so instead of grading. */}
      {structure && !structure.applicable && (
        <section className="plate overflow-hidden px-6 py-4 sm:px-8">
          <p className="text-[13.5px] leading-relaxed text-ink-soft">
            <span className="font-semibold text-ink">UI/UX not graded.</span>{' '}
            {structure.notApplicableReason}
          </p>
        </section>
      )}

      {/* 2 ── master-detail: the deduction ledger beside the reading pane. */}
      <div className="space-y-5 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-5 lg:space-y-0">
        <div className="sticky top-14 z-30 lg:top-24">
          <section className="plate overflow-hidden">
            <div className="hidden flex-wrap items-baseline justify-between gap-2 border-b border-[var(--line)] px-5 py-3 sm:px-6 lg:flex">
              <p className="label">The deduction ledger</p>
              {structure?.applicable && (
                <p className="mono-tight font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  100 − {100 - structure.score} = {structure.score}
                </p>
              )}
            </div>

            {/* On phones the ledger is ONE swipeable row pinned under the
                header. Tapping a chip jumps to its finding. */}
            <div
              className="flex w-0 min-w-full snap-x overflow-x-auto lg:hidden"
              role="tablist"
              aria-label="Report findings"
            >
              {deductions.map((d) => {
                const isActive = active === d.signal;
                return (
                  <button
                    key={d.signal}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => selectPanel(d.signal)}
                    className={`flex w-[104px] shrink-0 snap-start cursor-pointer flex-col items-center gap-1 border-r border-[var(--line)] px-2 pb-2.5 pt-3 transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink ${
                      isActive ? 'bg-well' : ''
                    }`}
                    style={isActive ? { boxShadow: 'inset 0 -3px 0 var(--color-ink)' } : undefined}
                  >
                    <span
                      className="display text-[17px] leading-none tabular-nums"
                      style={{ color: d.points >= 8 ? 'var(--color-signal)' : 'var(--color-ink)' }}
                    >
                      −{d.points}
                    </span>
                    <span className="w-full text-center text-[10.5px] font-semibold leading-tight tracking-tight text-ink line-clamp-2">
                      {d.name}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                role="tab"
                aria-selected={active === EXPOSURE_PANEL}
                onClick={() => selectPanel(EXPOSURE_PANEL)}
                className={`flex w-[104px] shrink-0 snap-start cursor-pointer flex-col items-center gap-1 border-r border-[var(--line)] px-2 pb-2.5 pt-3 transition-colors last:border-r-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink ${
                  active === EXPOSURE_PANEL ? 'bg-well' : ''
                } ${exposureFindings.length === 0 ? 'opacity-45' : ''}`}
                style={active === EXPOSURE_PANEL ? { boxShadow: 'inset 0 -3px 0 var(--color-ink)' } : undefined}
              >
                <Gauge score={report.insufficientSignal ? null : report.securityScore} small />
                <span className="w-full truncate text-center text-[10.5px] font-semibold leading-tight tracking-tight text-ink">
                  Exposure
                </span>
              </button>
            </div>

            {/* The ledger as compact rows: always in view while the finding
                scrolls, so switching is one click, not a round trip. */}
            <div className="hidden lg:block" role="tablist" aria-label="Report findings">
              {deductions.length === 0 && structure?.applicable && (
                <p className="px-4 py-3 text-[12.5px] leading-relaxed text-ink-soft">
                  No structural tells found. The score holds at {structure.score}.
                </p>
              )}
              {deductions.map((d) => {
                const isActive = active === d.signal;
                const rowProjection = hovered === d.signal ? projectFor(d.signal) : null;
                return (
                  <button
                    key={d.signal}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => selectPanel(d.signal)}
                    onMouseEnter={() => setHovered(d.signal)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(d.signal)}
                    onBlur={() => setHovered(null)}
                    className={`flex w-full cursor-pointer items-center gap-3 border-b border-[var(--line)] px-4 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink ${
                      isActive ? 'bg-well' : 'hover:bg-sheet'
                    }`}
                    style={isActive ? { boxShadow: 'inset 3px 0 0 var(--color-ink)' } : undefined}
                  >
                    <span
                      className="display w-9 shrink-0 text-right text-[15px] leading-none tabular-nums"
                      style={{ color: d.points >= 8 ? 'var(--color-signal)' : 'var(--color-ink)' }}
                    >
                      −{d.points}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold leading-tight tracking-tight text-ink">
                        {d.name}
                      </span>
                      {d.filePath && (
                        <span className="mono-tight block truncate font-mono text-[9.5px] text-ink-mute">
                          {d.filePath.split('/').slice(-2).join('/')}
                        </span>
                      )}
                    </span>
                    {rowProjection !== null && rowProjection > ready && (
                      <span className="mono-tight shrink-0 font-mono text-[10px] font-semibold tabular-nums text-ink-soft">
                        → {rowProjection}%
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                role="tab"
                aria-selected={active === EXPOSURE_PANEL}
                onClick={() => selectPanel(EXPOSURE_PANEL)}
                onMouseEnter={() => setHovered(EXPOSURE_PANEL)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(EXPOSURE_PANEL)}
                onBlur={() => setHovered(null)}
                className={`flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink ${
                  active === EXPOSURE_PANEL ? 'bg-well' : 'hover:bg-sheet'
                } ${exposureFindings.length === 0 && active !== EXPOSURE_PANEL ? 'opacity-45 hover:opacity-90' : ''}`}
                style={active === EXPOSURE_PANEL ? { boxShadow: 'inset 3px 0 0 var(--color-ink)' } : undefined}
              >
                <Gauge score={report.insufficientSignal ? null : report.securityScore} small />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold leading-tight tracking-tight text-ink">
                    Exposure
                  </span>
                  <span className="mono-tight block font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-mute">
                    {exposureFindings.length === 0
                      ? 'clear'
                      : `${exposureFindings.length} finding${exposureFindings.length === 1 ? '' : 's'}`}
                  </span>
                </span>
              </button>
            </div>
          </section>
        </div>

        {/* The reading column: the finding, then the closing cards. */}
        <div className="space-y-5">
          <section id="scan-panel" className="plate scroll-mt-44 overflow-hidden lg:scroll-mt-24">
            {activeDeduction && structure ? (
              <DeductionDetail
                deduction={activeDeduction}
                projected={activeProjectedStructure}
                score={structure.score}
              />
            ) : (
              <div className="px-4 py-5 sm:px-6">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div>
                    <h2 className="text-[16px] font-semibold tracking-tight text-ink">Exposure</h2>
                    <p className="mt-0.5 text-[12.5px] text-ink-mute">
                      Keys, injections, open databases.
                    </p>
                  </div>
                  <p className="mono-tight font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                    {exposureGroups.length === 0
                      ? 'nothing flagged'
                      : `${exposureGroups.length} signal${exposureGroups.length === 1 ? '' : 's'} · ${exposureFindings.length} finding${exposureFindings.length === 1 ? '' : 's'}`}
                  </p>
                </div>

                {report.securityCapReason && (
                  <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-ink-soft">
                    <span
                      className="mt-0.5 shrink-0 rounded px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-white"
                      style={{ background: 'var(--color-signal)' }}
                    >
                      Capped
                    </span>
                    <span>{report.securityCapReason}</span>
                  </p>
                )}

                {exposureGroups.length === 0 ? (
                  <p className="prose-serif mt-4 text-[15px] text-ink-soft">
                    Nothing flagged in the exposure checks. Read the limits below before treating
                    that as a clean bill of health.
                  </p>
                ) : (
                  <div className="mt-4 space-y-2.5">
                    {exposureGroups.map((g, i) => (
                      <SignalBlock key={g.key} group={g} index={i} defaultOpen={i === 0} />
                    ))}
                  </div>
                )}

                {testOnly.length > 0 && (
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
            )}
          </section>

          {/* 3 ── the dialect and the percentile, as the spec orders them. */}
          {structure?.applicable && (structure.dialectNote || structure.percentileLine) && (
            <section className="plate overflow-hidden px-5 py-4 sm:px-6">
              {structure.dialectNote && (
                <p className="text-[13.5px] leading-relaxed text-ink-soft">
                  <span className="mono-tight mr-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
                    Dialect
                  </span>
                  {structure.dialectNote}
                </p>
              )}
              {structure.percentileLine && (
                <p className={`text-[13.5px] leading-relaxed text-ink-soft ${structure.dialectNote ? 'rule-hair mt-3 pt-3' : ''}`}>
                  <span className="mono-tight mr-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
                    Percentile
                  </span>
                  {structure.percentileLine}
                </p>
              )}
            </section>
          )}

          {/* 4 ── the professional end state: the rules to hold the page
              against once the findings above are closed. */}
          {structure?.applicable && (
            <section className="plate overflow-hidden">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--line)] px-5 py-3 sm:px-6">
                <p className="label">The professional end state</p>
                <p className="mono-tight font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  hold your page against these
                </p>
              </div>
              <ul className="grid grid-cols-1 gap-x-8 gap-y-2 px-5 py-4 sm:grid-cols-2 sm:px-6">
                {END_STATE_RULES.map((rule) => (
                  <li key={rule} className="flex items-start gap-2.5 text-[13px] leading-snug text-ink-soft">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-mute" aria-hidden />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 5 ── the honest footer, collapsed by default */}
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
      </div>
    </div>
  );
}
