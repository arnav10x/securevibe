'use client';

// The findings browser: the severity tally IS the tab bar. Click a colored
// count to see only that severity; open/close all with one tap. A heavy
// report becomes a short triage queue instead of a wall of prose — the
// worst tab is selected for you, everything else waits its turn.

import { useRef, useState } from 'react';
import { SeverityBadge } from '@/components/ui';
import { FindingAccordion, SEVERITY_COLOR, type FindingView } from '@/components/findings';
import { isTestPath } from '@/lib/scanner/util';

const RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const INTRO: Record<string, string> = {
  all: 'Everything the scan found in shipped code, worst first.',
  critical: 'Fix these before you launch — they are directly exploitable.',
  high: 'Serious problems. Fix these as soon as you can.',
  medium: 'Weaknesses worth fixing — they make attacks and bad first impressions easier.',
  low: 'Worth a look when you get a moment.',
  tests: 'Found in test and fixture files. These do not ship to users, and ' +
    'planted test credentials are normal. Worth a glance to confirm each one is deliberate.',
};

export interface BrowserFinding extends FindingView {
  /** Small origin tag shown on the row, e.g. "Design" or "Secrets". */
  typeLabel?: string;
}

export function FindingsBrowser({ findings }: { findings: BrowserFinding[] }) {
  // Worst first; input order breaks ties (sort is stable).
  const sorted = [...findings].sort(
    (a, b) => (RANK[a.severity] ?? 9) - (RANK[b.severity] ?? 9),
  );
  // Findings in test and fixture files get their own tab. A fixture full of
  // planted keys is the fixture doing its job, and listing those first under
  // "directly exploitable" teaches the reader to distrust the whole report.
  const ordered = sorted.filter((f) => !(f.filePath && isTestPath(f.filePath)));
  const testFindings = sorted.filter((f) => f.filePath && isTestPath(f.filePath));

  // Finding numbers are global and stable — the same finding keeps its
  // number on every tab.
  const numbers = new Map([...ordered, ...testFindings].map((f, i) => [f.id, i + 1]));
  const present = (['critical', 'high', 'medium', 'low'] as const).filter((s) =>
    ordered.some((f) => f.severity === s),
  );

  const [tab, setTab] = useState<string>(present[0] ?? (testFindings.length ? 'tests' : 'all'));
  const listRef = useRef<HTMLDivElement>(null);

  const visible =
    tab === 'tests' ? testFindings : tab === 'all' ? ordered : ordered.filter((f) => f.severity === tab);

  const setAll = (open: boolean) => {
    listRef.current?.querySelectorAll('details').forEach((d) => {
      d.open = open;
    });
  };

  return (
    <div>
      {/* Tally-as-tabs */}
      <div className="plate flex flex-wrap items-stretch overflow-hidden">
        {present.map((sev) => {
          const count = ordered.filter((f) => f.severity === sev).length;
          const active = tab === sev;
          return (
            <button
              key={sev}
              type="button"
              onClick={() => setTab(sev)}
              aria-pressed={active}
              className={`flex cursor-pointer items-center gap-2.5 border-r border-[var(--line)] px-4 py-3 transition-colors sm:px-5 ${
                active ? 'bg-well' : 'opacity-50 hover:opacity-100'
              }`}
              style={active ? { boxShadow: `inset 0 -2.5px 0 ${SEVERITY_COLOR[sev]}` } : undefined}
            >
              <span
                className="display text-2xl tabular-nums"
                style={{ color: SEVERITY_COLOR[sev] }}
              >
                {count}
              </span>
              <SeverityBadge severity={sev} />
            </button>
          );
        })}
        {present.length > 1 && (
          <button
            type="button"
            onClick={() => setTab('all')}
            aria-pressed={tab === 'all'}
            className={`flex cursor-pointer items-center gap-2.5 border-r border-[var(--line)] px-4 py-3 transition-colors sm:px-5 ${
              tab === 'all' ? 'bg-well' : 'opacity-50 hover:opacity-100'
            }`}
            style={tab === 'all' ? { boxShadow: 'inset 0 -2.5px 0 var(--color-ink)' } : undefined}
          >
            <span className="display text-2xl tabular-nums text-ink">{ordered.length}</span>
            <span className="mono-tight font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-mute">
              All
            </span>
          </button>
        )}
        {testFindings.length > 0 && (
          <button
            type="button"
            onClick={() => setTab('tests')}
            aria-pressed={tab === 'tests'}
            className={`flex cursor-pointer items-center gap-2.5 border-r border-[var(--line)] px-4 py-3 transition-colors sm:px-5 ${
              tab === 'tests' ? 'bg-well' : 'opacity-50 hover:opacity-100'
            }`}
            style={tab === 'tests' ? { boxShadow: 'inset 0 -2.5px 0 var(--color-ink-mute)' } : undefined}
          >
            <span className="display text-2xl tabular-nums text-ink-mute">
              {testFindings.length}
            </span>
            <span className="mono-tight font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-mute">
              In tests
            </span>
          </button>
        )}
        <div className="mono-tight ml-auto flex items-center gap-1 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
          <button
            type="button"
            onClick={() => setAll(true)}
            className="cursor-pointer rounded px-1.5 py-1 underline decoration-[var(--line-strong)] underline-offset-4 transition-colors hover:text-ink"
          >
            Open all
          </button>
          ·
          <button
            type="button"
            onClick={() => setAll(false)}
            className="cursor-pointer rounded px-1.5 py-1 underline decoration-[var(--line-strong)] underline-offset-4 transition-colors hover:text-ink"
          >
            Close all
          </button>
        </div>
      </div>

      <p className="mono-tight mt-3 px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
        {INTRO[tab]} Click a row for the evidence, the why, and the fix.
      </p>

      {/* key={tab} remounts the list so the first row of each tab starts open */}
      <div ref={listRef} key={tab} className="mt-3 space-y-2.5">
        {visible.map((f, i) => (
          <FindingAccordion
            key={f.id}
            finding={f}
            number={numbers.get(f.id) ?? 0}
            defaultOpen={i === 0}
            typeLabel={f.typeLabel}
          />
        ))}
      </div>
    </div>
  );
}
