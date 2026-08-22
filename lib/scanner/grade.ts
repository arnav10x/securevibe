// Turns findings into the report card. Two INDEPENDENT grades:
//
//   Security — the headline. Modeled on how real graders work (SSL Labs,
//     Mozilla Observatory, SonarQube): a weighted hygiene score with
//     diminishing returns, then HARD CAPS. A single PROVEN serious finding
//     sets a ceiling the rest of the report cannot lift, because an attacker
//     exploits your weakest link, not your average. Guesses (heuristics) can
//     shave points but can never fail you — only facts (verified findings) can.
//
//   Craft — secondary. How finished and original the build looks. Never
//     blended into Security: good typography must not hide a leaked key, and
//     a secure app must not be marked down for looking template-y.
//
// All of it is plain arithmetic, kept in one readable file so the formula is
// easy to explain to a non-technical founder and easy to tune.

import type {
  Confidence,
  DesignCategoryScore,
  Finding,
  ReportCard,
  Severity,
} from './types';
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

/** Plain-words reading of the vibe meter. */
function vibeVerdict(score: number): string {
  if (score >= 80) return 'Unmistakably vibe coded';
  if (score >= 50) return 'Clearly template-flavored';
  if (score >= 20) return 'A few template tells';
  return 'Reads hand-built';
}

/** The honest "what a source scan cannot see" box. Always shown. */
const SOURCE_SCAN_LIMITATIONS = [
  'This reads your source code, not your running app — it cannot confirm ' +
    'whether your live database is actually locked down (Row Level Security). ' +
    'A live-URL scan is what tests that, and it is where most real breaches are caught.',
  'It cannot catch business-logic flaws, one user reading another user’s ' +
    'data, or anything that only shows up at runtime.',
  'A clean result lowers your risk; it is not a guarantee that your app is secure.',
];

export interface ReportMeta {
  /** How many real code files were actually scanned (drives insufficientSignal). */
  codeFilesScanned: number;
}

export function buildReportCard(
  findings: Finding[],
  design: { designScore: number; vibeScore: number; categories: DesignCategoryScore[] },
  meta: ReportMeta = { codeFilesScanned: 1 },
): ReportCard {
  const sec = assessSecurity(findings);
  const insufficientSignal = meta.codeFilesScanned === 0;

  // Reading as unedited template output undermines every craft category at
  // once, so a loud vibe meter drags the craft score by up to 25 points.
  const craftScore = Math.max(0, design.designScore - Math.round(design.vibeScore / 4));

  return {
    securityGrade: insufficientSignal ? '—' : sec.grade,
    securityScore: sec.score,
    securityCapReason: sec.capReason,
    tally: sec.tally,
    clean: sec.clean && !insufficientSignal,
    insufficientSignal,
    limitations: SOURCE_SCAN_LIMITATIONS,
    craftGrade: letterGrade(craftScore),
    craftScore,
    vibeScore: design.vibeScore,
    vibeVerdict: vibeVerdict(design.vibeScore),
    categories: [...design.categories].sort((a, b) => a.score - b.score),
  };
}
