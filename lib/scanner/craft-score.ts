// The craft scoring engine, per SECUREVIBE-UIUX.md Part 6 as revised by
// Part 12. Three moves, in order:
//
//   1. EARNED FROM ZERO. Eight dimensions, 100 points total. Points exist
//      only where positive evidence of a decision exists in source.
//      Absence of a token layer is not a small penalty. It is zero of the
//      18 available.
//   2. CEILINGS. Certain absences bound how good the work can possibly
//      be. A repo can hit several; it takes the LOWEST, never the sum.
//   3. TELL-DENSITY MULTIPLIER. Count distinct generic-default tells.
//      Generation-two tells weigh 1.5, an internal contradiction 2.0.
//      This is the distinctiveness term and the largest correction to
//      over-scoring.
//
// Everything here is arithmetic over what the analyzer detected. No model
// judges anything, and the numbers only move when cited evidence moves.

export type DimensionId =
  | 'system'
  | 'typography'
  | 'color'
  | 'layout'
  | 'motion'
  | 'states'
  | 'accessibility'
  | 'evidence';

/** The eight dimensions and their point budgets (Part 12.2). */
export const DIMENSIONS: { id: DimensionId; label: string; max: number; hint: string }[] = [
  { id: 'system', label: 'Design system', max: 18, hint: 'Does a token layer exist, and is it used' },
  { id: 'typography', label: 'Type & copy', max: 10, hint: 'Deliberate type choices and voice' },
  { id: 'color', label: 'Color & contrast', max: 10, hint: 'Semantic color, verified contrast' },
  { id: 'layout', label: 'Layout intent', max: 10, hint: 'Variation with purpose, responsive decisions' },
  { id: 'motion', label: 'Interaction', max: 12, hint: 'States, feedback, purposeful animation' },
  { id: 'states', label: 'State coverage', max: 13, hint: 'Empty, loading, error, edge cases' },
  { id: 'accessibility', label: 'Accessibility', max: 12, hint: 'Focus, semantics, labels, keyboard' },
  { id: 'evidence', label: 'Operational proof', max: 15, hint: 'Signs a real operation stands behind this' },
];

export const DIMENSION_MAX: Record<DimensionId, number> = Object.fromEntries(
  DIMENSIONS.map((d) => [d.id, d.max]),
) as Record<DimensionId, number>;

/** A positive signal: earned points, with the evidence that earned them. */
export interface PositiveSignal {
  id: string;
  label: string;
  dimension: DimensionId;
  points: number;
  evidence?: string;
}

/** A ceiling in force: the score cannot exceed `max` until `reason` is fixed. */
export interface Ceiling {
  max: number;
  reason: string;
  /** Fixing this dimension lifts the ceiling (drives the hover projection). */
  dimension: DimensionId;
}

/**
 * Tell weights (Part 12.6): generation-one tells 1.0, generation-two 1.5,
 * an internal contradiction 2.0. Distinct tells, never repeated instances.
 */
export const TELL_WEIGHTS: Record<string, number> = {
  // generation one
  'T-NO-TOKENS': 1,
  'T-DEFAULT-PALETTE': 1,
  'T-GRADIENT-DEFAULT': 1,
  'T-DEFAULT-TYPEFACE': 1,
  'T-EMOJI-ICON': 1,
  'T-PLACEHOLDER-SOCIAL': 1,
  'T-VAGUE-COPY': 1,
  'T-UNIFORM-COPY-LENGTH': 1,
  'T-NO-FOCUS': 1,
  'T-NO-EMPTY': 1,
  'T-NO-ERROR': 1,
  'T-DEAD-INTERACTION': 1,
  'T-DIV-BUTTON': 1,
  'T-NO-MOTION-PREF': 1,
  'T-UNIFORM-RHYTHM': 1,
  'T-NO-MOBILE-PRIORITY': 1,
  'T-NO-RESPONSIVE': 1,
  'T-VIEWPORT-LOCK': 1,
  // generation two
  'T2-DOCUMENT-COSPLAY': 1.5,
  'T2-EMPTY-SHELL': 1.5,
  'T2-BUILDER-FINGERPRINT': 1.5,
  'T2-DEAD-SCAFFOLD': 1.5,
  'T2-INTERNAL-CONTRADICTION': 2,
};

/** Multiplier from the weighted distinct-tell count (Part 12.6). */
export function tellMultiplier(weightedCount: number): number {
  if (weightedCount <= 1) return 1.0;
  if (weightedCount <= 3) return 0.94;
  if (weightedCount <= 5.5) return 0.86;
  if (weightedCount <= 8) return 0.76;
  if (weightedCount <= 11) return 0.66;
  return 0.56;
}

export function weighTells(tells: Iterable<string>): number {
  let sum = 0;
  for (const t of new Set(tells)) sum += TELL_WEIGHTS[t] ?? 1;
  return sum;
}

/** Percentile bands (Section 6.6). Estimated until real volume replaces it. */
export const BANDS = [
  { min: 89, percentile: 'Top 1%', label: 'Distinctive and complete' },
  { min: 76, percentile: 'Top 5%', label: 'Design-led' },
  { min: 61, percentile: 'Top 15%', label: 'Deliberate throughout, gaps remain' },
  { min: 46, percentile: 'Top 30%', label: 'Real decisions in some areas' },
  { min: 31, percentile: 'Top 50%', label: 'Generated, lightly edited' },
  { min: 16, percentile: 'Bottom 50%', label: 'Generated, unreviewed' },
  { min: 0, percentile: 'Bottom 25%', label: 'Untouched generation' },
] as const;

export function bandFor(score: number): (typeof BANDS)[number] {
  return BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];
}

/** The next band up, for the "fixing the top findings moves you to" line. */
export function nextBandFor(score: number): (typeof BANDS)[number] | null {
  const idx = BANDS.findIndex((b) => score >= b.min);
  return idx > 0 ? BANDS[idx - 1] : null;
}

export interface CraftInput {
  positives: PositiveSignal[];
  /** Distinct tell IDs that fired. */
  tells: string[];
  /** Ceilings triggered by detections. Lowest one binds. */
  ceilings: Ceiling[];
  /** Per-dimension caps from tell effects (e.g. emoji caps typography at 8). */
  dimensionCaps: Partial<Record<DimensionId, number>>;
}

export interface DimensionScore {
  id: DimensionId;
  label: string;
  earned: number;
  max: number;
  /** Tells whose effects touch this dimension, for the hover projection. */
  tells: string[];
}

export interface CraftResult {
  /** Final 0–100 after ceiling and multiplier. */
  score: number;
  raw: number;
  multiplier: number;
  weightedTells: number;
  distinctTells: string[];
  ceiling: Ceiling | null;
  dimensions: DimensionScore[];
  band: string;
  percentile: string;
}

/** Which dimension each tell's density pressure is attributed to (projection). */
export const TELL_DIMENSION: Record<string, DimensionId> = {
  'T-NO-TOKENS': 'system',
  'T-DEFAULT-PALETTE': 'system',
  'T-GRADIENT-DEFAULT': 'color',
  'T-DEFAULT-TYPEFACE': 'typography',
  'T-EMOJI-ICON': 'typography',
  'T-PLACEHOLDER-SOCIAL': 'evidence',
  'T-VAGUE-COPY': 'typography',
  'T-UNIFORM-COPY-LENGTH': 'layout',
  'T-NO-FOCUS': 'accessibility',
  'T-NO-EMPTY': 'states',
  'T-NO-ERROR': 'states',
  'T-DEAD-INTERACTION': 'motion',
  'T-DIV-BUTTON': 'accessibility',
  'T-NO-MOTION-PREF': 'motion',
  'T-UNIFORM-RHYTHM': 'layout',
  'T-NO-MOBILE-PRIORITY': 'layout',
  'T-NO-RESPONSIVE': 'layout',
  'T-VIEWPORT-LOCK': 'accessibility',
  'T2-DOCUMENT-COSPLAY': 'evidence',
  'T2-EMPTY-SHELL': 'layout',
  'T2-BUILDER-FINGERPRINT': 'evidence',
  'T2-DEAD-SCAFFOLD': 'evidence',
  'T2-INTERNAL-CONTRADICTION': 'evidence',
};

export function computeCraft(input: CraftInput): CraftResult {
  const distinct = [...new Set(input.tells)];

  // 1 ── earn from zero, clamped by dimension budgets and tell caps.
  const earned: Record<DimensionId, number> = {
    system: 0, typography: 0, color: 0, layout: 0,
    motion: 0, states: 0, accessibility: 0, evidence: 0,
  };
  for (const p of input.positives) {
    earned[p.dimension] = Math.min(
      earned[p.dimension] + p.points,
      DIMENSION_MAX[p.dimension],
    );
  }
  for (const [dim, cap] of Object.entries(input.dimensionCaps) as [DimensionId, number][]) {
    earned[dim] = Math.min(earned[dim], cap);
  }
  const raw = Object.values(earned).reduce((a, b) => a + b, 0);

  // 2 ── the lowest applicable ceiling binds. Never cumulative.
  const ceiling =
    input.ceilings.length > 0
      ? input.ceilings.reduce((low, c) => (c.max < low.max ? c : low))
      : null;
  const bounded = ceiling ? Math.min(raw, ceiling.max) : raw;

  // 3 ── the distinctiveness term.
  const weightedTells = weighTells(distinct);
  const multiplier = tellMultiplier(weightedTells);
  const score = Math.max(0, Math.min(100, Math.round(bounded * multiplier)));

  const band = bandFor(score);
  return {
    score,
    raw,
    multiplier,
    weightedTells,
    distinctTells: distinct,
    ceiling,
    dimensions: DIMENSIONS.map((d) => ({
      id: d.id,
      label: d.label,
      earned: earned[d.id],
      max: d.max,
      tells: distinct.filter((t) => TELL_DIMENSION[t] === d.id),
    })),
    band: band.label,
    percentile: band.percentile,
  };
}

/**
 * The hover projection: the score if one dimension were fully fixed. Fixing
 * a dimension earns its full budget, drops its tells from the density count,
 * and lifts any ceiling it owns. The honest version of "what do I gain".
 */
export function projectDimensionFixed(input: CraftInput, dim: DimensionId): number {
  const fixedPositives = [
    ...input.positives.filter((p) => p.dimension !== dim),
    { id: '__fixed', label: 'fixed', dimension: dim, points: DIMENSION_MAX[dim] },
  ];
  const caps = { ...input.dimensionCaps };
  delete caps[dim];
  return computeCraft({
    positives: fixedPositives,
    tells: input.tells.filter((t) => TELL_DIMENSION[t] !== dim),
    ceilings: input.ceilings.filter((c) => c.dimension !== dim),
    dimensionCaps: caps,
  }).score;
}
