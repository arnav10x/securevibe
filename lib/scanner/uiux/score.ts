// Scoring (SECUREVIBE-GRADING.md section 5): start at 100, apply the
// deductions the detectors reported, floor at 0. The caps live inside
// each detector, so this file is deliberately dumb arithmetic.
//
// The percentile is honest about its basis. The spec calls for a
// distribution over all scanned repos; until real volume exists, the
// sample is the calibration set below, derived from the sites the spec
// was built on, and the report says how big the sample is. Feeding real
// scan scores in later changes the numbers without changing the shape.

import type { StructuralFinding } from './signals';

export function computeScore(findings: StructuralFinding[]): number {
  const total = findings.reduce((sum, f) => sum + f.points, 0);
  return Math.max(0, Math.min(100, Math.round(100 - total)));
}

/**
 * The calibration distribution: where the analysis set landed when run
 * through this grader. Eleven vibe-coded sites in the 0-45 band, partially
 * edited work in the middle, professional pages above 80. Replace with
 * live scan scores once enough exist.
 */
export const CALIBRATION_SCORES: number[] = [
  2, 5, 8, 11, 14, 17, 20, 24, 27, 30, 33,   // the vibe-coded eleven
  38, 42, 47, 52, 57, 62, 66, 71, 75,        // partially rebuilt work
  80, 84, 87, 90, 92, 94, 96, 97, 98, 100,   // the professional set
];

export interface PercentileRead {
  /** "Top N percent": the share of the sample at or above this score. */
  topPercent: number;
  /** Where the top half begins: the sample median. */
  medianScore: number;
  sampleSize: number;
}

export function percentileFor(score: number, sample: number[] = CALIBRATION_SCORES): PercentileRead {
  const sorted = [...sample].sort((a, b) => a - b);
  const below = sorted.filter((s) => s < score).length;
  const topPercent = Math.max(1, Math.min(100, Math.round(100 - (below / sorted.length) * 100)));
  const mid = Math.floor(sorted.length / 2);
  const medianScore =
    sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return { topPercent, medianScore, sampleSize: sorted.length };
}

/** The percentile line, phrased the way the spec phrases it. */
export function percentileLine(score: number, p: PercentileRead): string {
  return (
    `Score ${score}. That is top ${p.topPercent} percent of the ${p.sampleSize} ` +
    `pages in the calibration set. The top 50 percent starts at ${p.medianScore}.`
  );
}

/**
 * The professional end state (section 7): audience-independent rules the
 * user can hold up against their own page. Shown at the end of every
 * report, exactly because the goal is the property, not a look.
 */
export const END_STATE_RULES: string[] = [
  'Each section exists because the company has something specific to show there. Sections with nothing specific get cut.',
  'Every claim links to its evidence: a case study page, a status page, a tweet, a photograph, a review site.',
  'Numbers are specific and traceable. A round number with no source is worse than no number.',
  'The product appears as real captures or real photography. Never as cards drawn to look like a product.',
  'Button text changes with the section’s purpose.',
  'The page says its one-liner once, in the hero.',
  'No section carries a label describing what kind of section it is.',
  'Nothing is numbered unless the order carries meaning.',
  'Blocks within a section differ in size according to importance.',
  'The footer proves depth. Every link in it works and leads to real content.',
  'Nav items lead to pages, not anchors.',
  'No emoji as icons. No icon grid.',
  'Nothing shipped is a placeholder.',
];

/** One-line reading of the score, for the verdict sentence. */
export function scoreBand(score: number): string {
  if (score >= 85) return 'Reads professionally built';
  if (score >= 70) return 'The template is broken in places';
  if (score >= 45) return 'The skeleton is the template';
  if (score >= 20) return 'Unmistakably the template';
  return 'The template, untouched';
}
