// Pure view-model helpers for the scan dashboard: which layer a finding
// belongs to, and how findings group into signals inside a layer.
//
// The dashboard shows one ring per craft layer plus one for exposure, and
// clicking a ring opens that layer's findings grouped by SIGNAL (the rule
// that fired) rather than one long flat list. Grouping needs a stable
// mapping from a persisted finding back to its layer; rule ids carry it as
// a prefix (tokens-, states-, type-...). Rows written before rule_id
// existed fall back to title matching.

import { CRAFT_LAYERS, DESIGN_RULES, type CraftLayerId } from '@/lib/scanner/rules/design-rules';

export type PanelId = CraftLayerId | 'exposure';

/** Ring order: the seven craft layers by weight, then exposure. */
export const PANEL_ORDER: { id: PanelId; label: string }[] = [
  ...CRAFT_LAYERS.map((l) => ({ id: l.id as PanelId, label: l.label })),
  { id: 'exposure', label: 'Exposure' },
];

const PREFIX_TO_LAYER: Record<string, CraftLayerId> = {
  tokens: 'tokens',
  states: 'states',
  type: 'typography',
  motion: 'motion',
  layout: 'layout',
  copy: 'copy',
  a11y: 'accessibility',
};

const TITLE_TO_LAYER = new Map(DESIGN_RULES.map((r) => [r.title, r.layer]));

/**
 * Legacy fallback for findings saved before rule_id was persisted: the
 * aggregate rules build titles dynamically, so match on their stable parts.
 */
const LEGACY_TITLE_PATTERNS: [RegExp, CraftLayerId][] = [
  [/corner radii|shadow depths|spacing value|pixel spacing|kit components|icons drawn|framework defaults|made per element|gradient|blur orbs/i, 'tokens'],
  [/empty case|pending state anywhere|error boundary|timer, not a request|coming soon|caught and discarded/i, 'states'],
  [/typeface|typographic|weight range|legibility floor|font size/i, 'typography'],
  [/hover or press|pending feedback|reduced-motion|transition-all|slower than the usable/i, 'motion'],
  [/page sequence|responsive breakpoints|holds the whole page|fixed pixel width|fixed height/i, 'layout'],
  [/alt text|says nothing|focus outline|tabindex|pinch-zoom|luminance|language never declared|heading levels|only label|non-interactive element/i, 'accessibility'],
];

export function panelForFinding(f: {
  checkType?: string | null;
  ruleId?: string | null;
  title: string;
}): PanelId {
  if (f.checkType && f.checkType !== 'design') return 'exposure';

  if (f.ruleId) {
    const prefix = f.ruleId.split('-')[0];
    const mapped = PREFIX_TO_LAYER[prefix];
    if (mapped) return mapped;
  }
  const byTitle = TITLE_TO_LAYER.get(f.title);
  if (byTitle) return byTitle;
  for (const [re, layer] of LEGACY_TITLE_PATTERNS) {
    if (re.test(f.title)) return layer;
  }
  // Copy carries the most rules; the least-wrong home for an unknown tell.
  return 'copy';
}

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export interface SignalGroup<F> {
  /** Stable key: the rule id when present, else the title. */
  key: string;
  title: string;
  severity: string;
  count: number;
  findings: F[];
}

/**
 * One group per signal (rule), worst first. This is the second layer of
 * categorization the panel shows: a layer opens into its signals, and a
 * signal opens into its occurrences.
 */
export function groupBySignal<
  F extends { ruleId?: string | null; title: string; severity: string },
>(findings: F[]): SignalGroup<F>[] {
  const groups = new Map<string, SignalGroup<F>>();
  for (const f of findings) {
    const key = f.ruleId || f.title;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      existing.findings.push(f);
      if ((SEVERITY_RANK[f.severity] ?? 9) < (SEVERITY_RANK[existing.severity] ?? 9)) {
        existing.severity = f.severity;
      }
    } else {
      groups.set(key, { key, title: f.title, severity: f.severity, count: 1, findings: [f] });
    }
  }
  return [...groups.values()].sort((a, b) => {
    const bySev = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
    if (bySev !== 0) return bySev;
    return b.count - a.count;
  });
}

/**
 * Distance to production: you ship at the pace of the weaker axis, so the
 * marker sits at the LOWER of craft and exposure. Never an average — an
 * average would let good typography hide a leaked key.
 */
export function readinessScore(craftScore: number, securityScore: number): number {
  return Math.max(0, Math.min(craftScore, securityScore));
}
