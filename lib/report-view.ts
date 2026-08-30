// Pure view-model helpers for the scan dashboard: how the report's two
// halves become panels, and the hover projection ("fix this signal and
// the score becomes N").
//
// Panels are the structural deductions from SECUREVIBE-GRADING.md —
// largest first, exactly the order the spec prints findings — plus one
// exposure panel for the security findings.

import type { StructureSummary } from '@/lib/scanner/types';

export const EXPOSURE_PANEL = 'exposure';

/** A panel is a structural signal id (e.g. "eyebrow-labels") or exposure. */
export type PanelId = string;

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
 * One group per signal (rule), worst first — used by the exposure panel,
 * where several rules can fire many times each.
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
 * marker sits at the LOWER of structure and exposure. Never an average — an
 * average would let a clean skeleton hide a leaked key.
 */
export function readinessScore(craftScore: number, securityScore: number): number {
  return Math.max(0, Math.min(craftScore, securityScore));
}

/**
 * The structure score if one deduction were fully fixed. The deduction
 * model makes this honest arithmetic: remove the points, cap at 100.
 */
export function projectedStructureScore(structure: StructureSummary, signal: string): number {
  const deduction = structure.deductions.find((d) => d.signal === signal);
  if (!deduction) return structure.score;
  return Math.min(100, structure.score + deduction.points);
}

/**
 * Where the readiness bar lands if one panel were fully fixed. Fixing
 * exposure sends that axis to 100, so readiness becomes the structure
 * score; fixing a signal returns its deducted points.
 */
export function projectedReadiness(
  report: { craftScore: number; securityScore: number; structure?: StructureSummary },
  panel: PanelId,
): number {
  if (panel === EXPOSURE_PANEL) {
    return readinessScore(report.craftScore, 100);
  }
  if (!report.structure) return readinessScore(report.craftScore, report.securityScore);
  return readinessScore(
    projectedStructureScore(report.structure, panel),
    report.securityScore,
  );
}
