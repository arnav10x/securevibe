// The finding accordion: one line when closed — severity, title, file —
// so a report reads as a scannable list; click to open the evidence, the
// why, and the fix. Native <details>, so it works without any JavaScript
// and stays a server component.

import { SeverityBadge } from '@/components/ui';
import { IconChevronDown } from '@/components/icons';

export const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--color-critical)',
  high: 'var(--color-high)',
  medium: 'var(--color-medium)',
  low: 'var(--color-low)',
};

export interface FindingView {
  id: string;
  severity: string;
  title: string;
  filePath: string | null;
  lineStart: number | null;
  evidenceMasked: string | null;
  explanation: string;
  recommendation: string;
  confidence?: string;
}

/** How sure we are, in words the reader can weigh. */
const CONFIDENCE_LABEL: Record<string, { label: string; title: string }> = {
  verified: { label: 'Verified', title: 'A fact we can stand behind (e.g. a known CVE or a decoded key).' },
  likely: { label: 'Likely', title: 'A strong pattern reaching real danger, but not proven.' },
  heuristic: { label: 'Heuristic', title: 'A pattern-match worth a look — treat as a hint, not a verdict.' },
};

/**
 * A ready-to-paste prompt for the user's AI coding tool — the way a
 * non-technical founder actually fixes things. Built purely from the finding.
 */
export function fixPrompt(f: FindingView): string {
  const where = f.filePath ? `${f.filePath}${f.lineStart ? `:${f.lineStart}` : ''}` : 'my project';
  return [
    `Fix this security issue in ${where}.`,
    ``,
    `Problem: ${f.title}`,
    `Why it matters: ${f.explanation}`,
    `How to fix it: ${f.recommendation}`,
    ``,
    `Make the change, then explain in plain English what you changed and why.`,
  ].join('\n');
}

export function FindingAccordion({
  finding: f,
  number,
  defaultOpen = false,
  whyLabel = 'Why this matters',
  typeLabel,
}: {
  finding: FindingView;
  number: number;
  defaultOpen?: boolean;
  whyLabel?: string;
  /** Small origin tag on the row, e.g. "Design" or "Secrets". */
  typeLabel?: string;
}) {
  const color = SEVERITY_COLOR[f.severity] ?? SEVERITY_COLOR.low;
  const fileShort = f.filePath?.split('/').pop() ?? null;

  return (
    <details
      id={`finding-${number}`}
      open={defaultOpen}
      className="plate plate--plain group overflow-hidden"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <summary className="flex cursor-pointer select-none items-center gap-3 px-4 py-3.5 transition-colors hover:bg-well sm:px-5 [&::-webkit-details-marker]:hidden [&::marker]:content-none">
        <span className="shrink-0">
          <SeverityBadge severity={f.severity} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-ink">
          {f.title}
        </span>
        {f.confidence && CONFIDENCE_LABEL[f.confidence] && (
          <span
            title={CONFIDENCE_LABEL[f.confidence].title}
            className="mono-tight hidden shrink-0 rounded px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.14em] sm:block"
            style={{
              color: f.confidence === 'verified' ? 'var(--color-safe)' : 'var(--color-ink-mute)',
              border: `1px solid ${f.confidence === 'verified' ? 'color-mix(in srgb, var(--color-safe) 45%, transparent)' : 'var(--line-strong)'}`,
            }}
          >
            {CONFIDENCE_LABEL[f.confidence].label}
          </span>
        )}
        {typeLabel && (
          <span className="mono-tight hidden shrink-0 rounded border border-[var(--line-strong)] px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-mute md:block">
            {typeLabel}
          </span>
        )}
        {fileShort && (
          <span className="mono-tight hidden max-w-44 shrink-0 truncate font-mono text-[10px] text-ink-mute sm:block">
            {fileShort}
            {f.lineStart ? `:${f.lineStart}` : ''}
          </span>
        )}
        <span className="mono-tight hidden shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute sm:block">
          {String(number).padStart(2, '0')}
        </span>
        <IconChevronDown className="h-4 w-4 shrink-0 text-ink-mute transition-transform duration-200 group-open:rotate-180" />
      </summary>

      <div className="border-t border-[var(--line)] px-4 pb-5 pt-4 sm:px-5">
        {f.filePath && (
          <p className="mono-tight break-all font-mono text-xs text-ink-mute">
            {f.filePath}
            {f.lineStart ? `:${f.lineStart}` : ''}
          </p>
        )}
        {f.evidenceMasked && (
          <pre className="readout mt-3 overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed text-ink-soft">
            {f.evidenceMasked}
          </pre>
        )}
        <div className="mt-4 space-y-4 text-sm leading-relaxed">
          <div className="border-l-2 pl-4" style={{ borderColor: `color-mix(in srgb, ${color} 60%, transparent)` }}>
            <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color }}>
              {whyLabel}
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

        {/* Ready-to-paste prompt for the user's AI coding tool */}
        <details className="mt-4">
          <summary className="mono-tight cursor-pointer select-none font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-mute hover:text-ink">
            Fix prompt — paste into Cursor / Lovable / Claude
          </summary>
          <pre className="readout mt-2.5 overflow-x-auto whitespace-pre-wrap px-4 py-3 font-mono text-[11px] leading-relaxed text-ink-soft">
            {fixPrompt(f)}
          </pre>
        </details>
      </div>
    </details>
  );
}

/** Maps a snake_case DB findings row to the accordion's camelCase view. */
export function toFindingView(row: {
  id: string;
  severity: string;
  title: string;
  explanation: string;
  recommendation: string;
  file_path: string | null;
  line_start: number | null;
  evidence_masked: string | null;
  confidence?: string;
}): FindingView {
  return {
    id: row.id,
    severity: row.severity,
    title: row.title,
    filePath: row.file_path,
    lineStart: row.line_start,
    evidenceMasked: row.evidence_masked,
    explanation: row.explanation,
    recommendation: row.recommendation,
    confidence: row.confidence,
  };
}
