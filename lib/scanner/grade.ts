// Turns findings into the report card: two 0–100 scores (security and
// design) blended into one letter grade. All of it is plain arithmetic on
// finding counts, kept in one file so the formula is easy to read, easy to
// explain to users, and easy to tune.

import type { Finding, DesignCategoryScore, ReportCard, Severity } from './types';

/**
 * Security score: start at 100, subtract per finding. Weights reflect how
 * we already rank severities everywhere else in the product — one critical
 * costs more than a page of lows.
 */
const SECURITY_PENALTY: Record<Severity, number> = {
  critical: 22,
  high: 12,
  medium: 4,
  low: 1,
};

export function securityScore(findings: Finding[]): number {
  let score = 100;
  for (const f of findings) {
    if (f.checkType === 'design') continue;
    score -= SECURITY_PENALTY[f.severity];
  }
  return Math.max(0, Math.round(score));
}

/** The familiar school scale — instantly readable, slightly brutal. */
export function letterGrade(score: number): string {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 67) return 'D+';
  if (score >= 63) return 'D';
  if (score >= 60) return 'D-';
  return 'F';
}

export function buildReportCard(
  findings: Finding[],
  design: { designScore: number; vibeScore: number; categories: DesignCategoryScore[] },
): ReportCard {
  const sec = securityScore(findings);
  // Reading as template output is itself a design failure that undermines
  // every category at once, so a loud vibe meter drags the design score by
  // up to 25 points on top of the per-category deductions.
  const designScore = Math.max(0, design.designScore - Math.round(design.vibeScore / 4));
  // Half security, half design: the product's promise is that both matter.
  const overall = Math.round(sec * 0.5 + designScore * 0.5);
  return {
    grade: letterGrade(overall),
    score: overall,
    securityScore: sec,
    designScore,
    vibeScore: design.vibeScore,
    categories: [...design.categories].sort((a, b) => a.score - b.score),
  };
}
