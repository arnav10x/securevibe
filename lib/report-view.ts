// Pure view-model helpers for the scan dashboard: which panel a finding
// belongs to, how findings group into signals inside a panel, and the
// hover projection ("fix this dimension and the score becomes N").
//
// Panels are the eight scored dimensions from SECUREVIBE-UIUX.md plus
// exposure. Rule ids carry the mapping as a prefix; rows written before
// rule_id existed fall back to title matching.

import { DESIGN_RULES } from '@/lib/scanner/rules/design-rules';
import {
  DIMENSIONS,
  projectDimensionFixed,
  type CraftInput,
  type DimensionId,
} from '@/lib/scanner/craft-score';

export type PanelId = DimensionId | 'exposure';

/** Ring order: the eight dimensions, then exposure. */
export const PANEL_ORDER: { id: PanelId; label: string; hint: string }[] = [
  ...DIMENSIONS.map((d) => ({ id: d.id as PanelId, label: d.label, hint: d.hint })),
  { id: 'exposure', label: 'Exposure', hint: 'Keys, injections, open databases' },
];

const PREFIX_TO_DIM: Record<string, DimensionId> = {
  tokens: 'system',
  states: 'states',
  type: 'typography',
  motion: 'motion',
  layout: 'layout',
  copy: 'evidence',
  evidence: 'evidence',
  a11y: 'accessibility',
};

/** Rules whose home differs from their id prefix. */
const RULE_DIM = new Map<string, DimensionId>(DESIGN_RULES.map((r) => [r.id, r.layer]));
const TITLE_DIM = new Map<string, DimensionId>(DESIGN_RULES.map((r) => [r.title, r.layer]));

/**
 * Legacy fallback for findings saved before rule_id was persisted: the
 * aggregate rules build titles dynamically, so match on their stable parts.
 */
const LEGACY_TITLE_PATTERNS: [RegExp, DimensionId][] = [
  [/corner radii|shadow depths|kit components|icons drawn|framework defaults|made per element/i, 'system'],
  [/gradient|blur orbs|luminance/i, 'color'],
  [/spacing value|pixel spacing|page sequence|responsive breakpoints|holds the whole page|fixed pixel width|fixed height|same length|client-rendered/i, 'layout'],
  [/empty case|pending state anywhere|error boundary|timer, not a request|caught and discarded/i, 'states'],
  [/typeface|typographic|weight range|legibility floor|font size|emoji|superlative|closing pitch|mechanism/i, 'typography'],
  [/hover or press|pending feedback|reduced-motion|transition-all|slower than the usable/i, 'motion'],
  [/alt text|says nothing|focus outline|tabindex|pinch-zoom|language never declared|heading levels|only label|non-interactive element/i, 'accessibility'],
];

export function panelForFinding(f: {
  checkType?: string | null;
  ruleId?: string | null;
  title: string;
}): PanelId {
  if (f.checkType && f.checkType !== 'design') return 'exposure';

  if (f.ruleId) {
    const exact = RULE_DIM.get(f.ruleId);
    if (exact) return exact;
    const mapped = PREFIX_TO_DIM[f.ruleId.split('-')[0]];
    if (mapped) return mapped;
  }
  const byTitle = TITLE_DIM.get(f.title);
  if (byTitle) return byTitle;
  for (const [re, dim] of LEGACY_TITLE_PATTERNS) {
    if (re.test(f.title)) return dim;
  }
  // The evidence dimension carries the most content rules; least-wrong home.
  return 'evidence';
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
 * categorization the panel shows: a dimension opens into its signals, and
 * a signal opens into its occurrences.
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

/** The stored scoring input, as it rides in report.craftDetail. */
export interface CraftDetail {
  positives: { id: string; label: string; dimension: string; points: number }[];
  tells: string[];
  ceilings: { max: number; reason: string; dimension: string }[];
  dimensionCaps: Partial<Record<string, number>>;
}

/**
 * Where the readiness bar lands if one dimension were fully fixed. Fixing
 * a dimension earns its full budget, drops its tells from the density
 * count, and lifts any ceiling it owns. Fixing exposure sends that axis
 * to 100, so readiness becomes the craft score.
 */
export function projectedReadiness(
  report: {
    craftScore: number;
    securityScore: number;
    craftDetail?: CraftDetail;
  },
  panel: PanelId,
): number {
  if (panel === 'exposure') {
    return readinessScore(report.craftScore, 100);
  }
  const detail = report.craftDetail;
  if (!detail) return readinessScore(report.craftScore, report.securityScore);
  const input: CraftInput = {
    positives: detail.positives.map((p) => ({ ...p, dimension: p.dimension as DimensionId })),
    tells: detail.tells,
    ceilings: detail.ceilings.map((c) => ({ ...c, dimension: c.dimension as DimensionId })),
    dimensionCaps: detail.dimensionCaps as CraftInput['dimensionCaps'],
  };
  const projectedCraft = projectDimensionFixed(input, panel);
  return readinessScore(projectedCraft, report.securityScore);
}
