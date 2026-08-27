// Turns findings into the report card. Two INDEPENDENT scores, never
// blended, plus a headline verdict derived from the pair:
//
//   Security (exposure) — the credibility anchor. Modeled on how real
//     graders work (SSL Labs, Mozilla Observatory, SonarQube): a weighted
//     hygiene score with diminishing returns, then HARD CAPS. A single
//     PROVEN serious finding sets a ceiling the rest of the report cannot
//     lift, because an attacker exploits your weakest link, not your
//     average. Guesses (heuristics) can shave points but can never fail
//     you — only facts (verified findings) can.
//
//   Craft — how much design and engineering judgment shows after
//     generation. Computed per SECUREVIBE.md 5.3: seven weighted layers,
//     cluster amplification inside each layer (the strongest signal at
//     full weight, each additional one at half, because signals within a
//     layer share one underlying cause), and an accessibility floor that
//     caps the score at 60 when a load-bearing Layer G item fails.
//
// All of it is plain arithmetic, kept in one readable file so the formula
// is easy to explain to a non-technical founder and easy to tune.

import type {
  Confidence,
  DesignCategoryScore,
  Finding,
  ReportCard,
  Severity,
} from './types';
import { CRAFT_LAYERS } from './rules/design-rules';
import type { LayerHit } from './checks/design';
import { isTestPath } from './util';

/** Base points a security finding costs, before confidence/context scaling. */
const SEVERITY_BASE: Record<Severity, number> = {
  critical: 45,
  high: 22,
  medium: 8,
  low: 2,
};

/** A guess costs less than a fact. Verified findings hit at full weight. */
const CONFIDENCE_WEIGHT: Record<Confidence, number> = {
  verified: 1,
  likely: 0.7,
  heuristic: 0.4,
};

/** Findings in test/fixture files count for little and never cap the grade. */
const TEST_PATH_WEIGHT = 0.2;

/**
 * Heuristic (regex-guess) findings, all together, can never remove more than
 * this many points — so a wall of low-confidence noise bottoms out at B-, not
 * F. Facts have no such cap; they are meant to hurt.
 */
const HEURISTIC_DEDUCTION_CAP = 20;

/**
 * What one firing signal costs its layer (each layer is scored 0–100 before
 * weighting). Sized so that one strong signal visibly dents a layer and a
 * cluster of them empties it — evidence accumulates instead of averaging out.
 */
const LAYER_SEVERITY_COST: Record<Severity, number> = {
  critical: 70,
  high: 55,
  medium: 30,
  low: 14,
};

/** The craft ceiling when a load-bearing accessibility item fails. */
const A11Y_FLOOR_CAP = 60;

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

const SECURITY_TYPES = new Set(['secret', 'platform_config', 'dependency', 'insecure_pattern']);

function confidenceOf(f: Finding): Confidence {
  return f.confidence ?? 'heuristic';
}

export interface SecurityAssessment {
  score: number;
  grade: string;
  capReason: string | null;
  tally: Record<Severity, number>;
  /** True when zero security findings were filed against real code. */
  clean: boolean;
}

/**
 * The security half of the report. Exported so it can be unit-tested directly
 * against the worked examples that motivated the rewrite (a committed live key
 * must read F; an empty repo must NOT read A+).
 */
export function assessSecurity(findings: Finding[]): SecurityAssessment {
  const security = findings.filter((f) => SECURITY_TYPES.has(f.checkType));
  const tally: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of security) tally[f.severity]++;

  // ── weighted deductions with diminishing returns per rule ──────────────
  // Repeated hits of the same rule matter less each time (the 20th missing
  // alt tag is not 20x the first). Grouping by ruleId+severity does this.
  const perGroup = new Map<string, number>(); // group key -> times seen
  let factDeduction = 0;
  let heuristicDeduction = 0;

  for (const f of security) {
    const conf = confidenceOf(f);
    const test = f.filePath ? isTestPath(f.filePath) : false;
    const groupKey = `${f.ruleId ?? f.title}:${f.severity}`;
    const seen = perGroup.get(groupKey) ?? 0;
    perGroup.set(groupKey, seen + 1);

    // First occurrence full; each repeat worth 40%, so noise can't dominate.
    const repeatFactor = seen === 0 ? 1 : 0.4;
    const base = SEVERITY_BASE[f.severity] * CONFIDENCE_WEIGHT[conf] * repeatFactor;
    const scaled = base * (test ? TEST_PATH_WEIGHT : 1);

    if (conf === 'heuristic' || test) heuristicDeduction += scaled;
    else factDeduction += scaled;
  }

  heuristicDeduction = Math.min(heuristicDeduction, HEURISTIC_DEDUCTION_CAP);
  let score = Math.max(0, 100 - factDeduction - heuristicDeduction);

  // ── hard caps: only PROVEN, non-test findings can set a ceiling ────────
  let capReason: string | null = null;
  const capCeiling = (max: number, reason: string) => {
    if (score > max) {
      score = max;
      capReason = reason;
    }
  };
  const worstVerified = (sev: Severity): Finding | undefined =>
    security.find(
      (f) => f.severity === sev && confidenceOf(f) === 'verified' && !(f.filePath && isTestPath(f.filePath)),
    );

  const vCrit = worstVerified('critical');
  const vHigh = worstVerified('high');
  if (vCrit) {
    capCeiling(40, `Capped at F: ${lower(vCrit.title)}`);
  } else if (vHigh) {
    capCeiling(76, `Capped at C: ${lower(vHigh.title)}`);
  }

  score = Math.round(score);
  return {
    score,
    grade: letterGrade(score),
    capReason,
    tally,
    clean: security.length === 0,
  };
}

/** Lower-cases the first letter of a title so it reads inside a sentence. */
function lower(title: string): string {
  return title.charAt(0).toLowerCase() + title.slice(1);
}

export interface CraftAssessment {
  score: number;
  grade: string;
  capReason: string | null;
  categories: DesignCategoryScore[];
}

/**
 * The craft score, computed in code from the layer hits — the model (when
 * enabled) and the rules only ever DETECT; nothing here asks anything for a
 * holistic rating. Per layer: the strongest firing signal costs full weight,
 * each additional one half, because signals inside a layer are correlated
 * (one underlying cause should not be billed six times). Layers then combine
 * on the published weights. A failed load-bearing accessibility item caps
 * the whole score at 60, and the cap is stated, never hidden in the number.
 */
export function assessCraft(hits: LayerHit[]): CraftAssessment {
  const categories: DesignCategoryScore[] = [];
  let weighted = 0;

  for (const layer of CRAFT_LAYERS) {
    const layerHits = hits.filter((h) => h.layer === layer.id);
    // Each signal's cost grows a little with repetition, capped at 1.6x.
    const costs = layerHits
      .map((h) => {
        const base = LAYER_SEVERITY_COST[h.severity];
        return Math.min(base * 1.6, base * (1 + (h.count - 1) * 0.15));
      })
      .sort((a, b) => b - a);
    const deduction = costs.reduce((sum, c, i) => sum + (i === 0 ? c : c * 0.5), 0);
    const score = Math.max(0, Math.round(100 - deduction));
    categories.push({
      id: layer.id,
      label: layer.label,
      score,
      findingCount: layerHits.reduce((n, h) => n + h.count, 0),
    });
    weighted += score * layer.weight;
  }

  let score = Math.round(weighted / 100);
  let capReason: string | null = null;
  const floorFail = hits.find((h) => h.loadBearing);
  if (floorFail && score > A11Y_FLOOR_CAP) {
    score = A11Y_FLOOR_CAP;
    capReason =
      `Capped at ${A11Y_FLOOR_CAP}: ${lower(floorFail.title)}. An interface ` +
      'keyboard users cannot operate is not well designed, whatever it looks like.';
  }

  return {
    score,
    grade: letterGrade(score),
    capReason,
    categories: categories.sort((a, b) => a.score - b.score),
  };
}

/** Plain-words reading of the vibe meter. */
function vibeVerdict(score: number): string {
  if (score >= 80) return 'Unmistakably vibe coded';
  if (score >= 50) return 'Clearly template-flavored';
  if (score >= 20) return 'A few template tells';
  return 'Reads hand-built';
}

/**
 * The headline verdict, from the craft/exposure pair (SECUREVIBE.md 5.3).
 * One plain sentence naming what the repo reads as. Never numeric: a number
 * invites argument, a sentence with cited findings under it does not.
 */
export function verdictFor(
  craft: CraftAssessment,
  security: SecurityAssessment,
  insufficientSignal: boolean,
): string {
  if (insufficientSignal) {
    return 'Not enough code to read. Point the scan at the real project.';
  }
  if (craft.score >= 80) {
    if (security.score < 60) return 'Looks finished. It is not safe to ship yet.';
    if (security.score >= 80) return 'Built with judgment. The findings here are refinements.';
    return 'Built with judgment. Close the security findings before shipping.';
  }
  if (craft.score >= 55) {
    const worst = craft.categories[0];
    return `Real work with unfinished edges. The largest gaps are in ${worst.label.toLowerCase()}.`;
  }
  if (craft.score >= 30) {
    return 'Reads as generated. The interface has a type scale and no point of view.';
  }
  return 'Unreviewed output. Nobody has looked at this since the model produced it.';
}

/** The honest "what this scan cannot see" box. Always shown. */
const SOURCE_SCAN_LIMITATIONS = [
  'This reads your source code, not your running app. It cannot confirm ' +
    'whether your live database is actually locked down (Row Level Security). ' +
    'A live-URL scan is what tests that, and it is where most real breaches ' +
    'are caught.',
  'It cannot catch business-logic flaws, one user reading another user’s ' +
    'data, or anything that only shows up at runtime.',
  'It does not render the page, so purely visual judgments (alignment, ' +
    'balance, real contrast on images) are out of scope for now.',
  'A clean result lowers your risk. It is not a guarantee that your app is ' +
    'secure.',
];

export interface ReportMeta {
  /** How many real code files were actually scanned (drives insufficientSignal). */
  codeFilesScanned: number;
}

export function buildReportCard(
  findings: Finding[],
  design: { hits: LayerHit[]; vibeScore: number; provenance: string[] },
  meta: ReportMeta = { codeFilesScanned: 1 },
): ReportCard {
  const sec = assessSecurity(findings);
  const craft = assessCraft(design.hits);
  const insufficientSignal = meta.codeFilesScanned === 0;

  return {
    securityGrade: insufficientSignal ? '—' : sec.grade,
    securityScore: sec.score,
    securityCapReason: sec.capReason,
    tally: sec.tally,
    clean: sec.clean && !insufficientSignal,
    insufficientSignal,
    limitations: SOURCE_SCAN_LIMITATIONS,
    craftGrade: insufficientSignal ? '—' : craft.grade,
    craftScore: craft.score,
    craftCapReason: insufficientSignal ? null : craft.capReason,
    verdict: verdictFor(craft, sec, insufficientSignal),
    vibeScore: design.vibeScore,
    vibeVerdict: vibeVerdict(design.vibeScore),
    categories: craft.categories,
    provenance: design.provenance,
  };
}
