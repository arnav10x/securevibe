// Turns findings into the report card. Two INDEPENDENT scores, never
// blended, plus a headline verdict derived from the pair:
//
//   Exposure — the credibility anchor. Modeled on how real graders work
//     (SSL Labs, Mozilla Observatory, SonarQube): a weighted hygiene score
//     with diminishing returns, then HARD CAPS. A single PROVEN serious
//     finding sets a ceiling the rest of the report cannot lift, because an
//     attacker exploits your weakest link, not your average.
//
//   Craft — per SECUREVIBE-UIUX.md, EARNED FROM ZERO across eight
//     dimensions. Points exist only where positive evidence of a decision
//     exists in source. The lowest triggered ceiling bounds the total, and
//     the distinct-tell density multiplier applies last. The score answers
//     one question: how much evidence is there that a person with judgment
//     made decisions here?
//
// All of it is arithmetic, kept readable so the formula is explainable to a
// non-technical founder and stable enough that scores compare over time.

import type {
  Confidence,
  DesignCategoryScore,
  Finding,
  ReportCard,
  Severity,
} from './types';
import {
  computeCraft,
  nextBandFor,
  type CraftInput,
  type CraftResult,
} from './craft-score';
import type { DesignAudit } from './checks/design';
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
  /** Severity counts for SHIPPED code. Test/fixture findings are excluded. */
  tally: Record<Severity, number>;
  /** How many findings landed in test or fixture files. Reported separately. */
  testOnlyCount: number;
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
  // The headline tally counts SHIPPED code only. A test fixture full of
  // planted keys is the fixture doing its job, and counting those as
  // "critical, directly exploitable" is the scanner crying wolf about
  // deliberate test data. They are still reported, in their own group.
  const tally: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  let testOnly = 0;
  for (const f of security) {
    if (f.filePath && isTestPath(f.filePath)) testOnly++;
    else tally[f.severity]++;
  }

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
    testOnlyCount: testOnly,
    clean: security.length - testOnly === 0,
  };
}

/** Lower-cases the first letter of a title so it reads inside a sentence. */
function lower(title: string): string {
  return title.charAt(0).toLowerCase() + title.slice(1);
}

/**
 * The craft score, per SECUREVIBE-UIUX.md: earned from zero, bounded by
 * the lowest ceiling, then multiplied by tell density.
 */
export type CraftAuditInput = Pick<
  DesignAudit,
  'positives' | 'tells' | 'ceilings' | 'dimensionCaps'
>;

export function assessCraft(audit: CraftAuditInput): CraftResult {
  const input: CraftInput = {
    positives: audit.positives,
    tells: audit.tells,
    ceilings: audit.ceilings,
    dimensionCaps: audit.dimensionCaps,
  };
  return computeCraft(input);
}

/** Plain-words reading of the vibe meter. */
function vibeVerdict(score: number): string {
  if (score >= 80) return 'Unmistakably vibe coded';
  if (score >= 50) return 'Clearly template-flavored';
  if (score >= 20) return 'A few template tells';
  return 'Reads hand-built';
}

/**
 * The headline verdict: the band sentence plus the bounded goal. "You are
 * in the top 50%. Fixing the highest-impact findings moves you toward the
 * top 30%." A target, not just a judgment.
 */
export function verdictFor(
  craft: CraftResult,
  security: SecurityAssessment,
  insufficientSignal: boolean,
  craftApplicable: boolean,
): string {
  if (insufficientSignal) {
    return 'Not enough code to read. Point the scan at the real project.';
  }
  if (!craftApplicable) {
    return 'No interface files to read, so this report covers exposure only.';
  }
  const next = nextBandFor(craft.score);
  const base = `${craft.band}. That places this repo in the ${craft.percentile.toLowerCase()} of what we see.`;
  const security_note =
    security.score < 60 ? ' Close the exposure findings before shipping.' : '';
  const target = next
    ? ` Fixing the highest-impact findings below moves it toward the ${next.percentile.toLowerCase()}.`
    : ' The findings below are refinements.';
  return base + target + security_note;
}

/** The honest "what this scan cannot see" box. Always shown. */
const SOURCE_SCAN_LIMITATIONS = [
  'This reads your source code, not your running app. It cannot confirm ' +
    'whether your live database is actually locked down (Row Level Security). ' +
    'A live-URL scan is what tests that, and it is where most real breaches ' +
    'are caught.',
  'It cannot catch business-logic flaws, one user reading another user\u2019s ' +
    'data, or anything that only shows up at runtime.',
  'It does not render the page, so rendered appearance, real contrast in a ' +
    'runtime theme, and performance numbers are out of scope. Nothing here ' +
    'is inferred from a render that never happened.',
  'A clean result lowers your risk. It is not a guarantee that your app is ' +
    'secure.',
];

export interface ReportMeta {
  /** How many real code files were actually scanned (drives insufficientSignal). */
  codeFilesScanned: number;
}

export function buildReportCard(
  findings: Finding[],
  audit: DesignAudit,
  meta: ReportMeta = { codeFilesScanned: 1 },
): ReportCard {
  const sec = assessSecurity(findings);
  const craft = assessCraft(audit);
  const insufficientSignal = meta.codeFilesScanned === 0;
  const craftApplicable = audit.uiFileCount > 0;

  const categories: DesignCategoryScore[] = craft.dimensions
    .map((d) => ({
      id: d.id,
      label: d.label,
      // Categories render as 0-100 gauges; earned/max keeps them comparable.
      score: Math.round((d.earned / d.max) * 100),
      findingCount: 0, // the UI counts findings per panel itself
    }))
    .sort((a, b) => a.score - b.score);

  return {
    securityGrade: insufficientSignal ? '\u2014' : sec.grade,
    securityScore: sec.score,
    securityCapReason: sec.capReason,
    tally: sec.tally,
    testOnlyCount: sec.testOnlyCount,
    clean: sec.clean && !insufficientSignal,
    insufficientSignal,
    limitations: SOURCE_SCAN_LIMITATIONS,
    craftGrade: insufficientSignal || !craftApplicable ? '\u2014' : letterGrade(craft.score),
    craftScore: craftApplicable ? craft.score : 0,
    craftBand: craftApplicable ? craft.band : undefined,
    craftPercentile: craftApplicable ? craft.percentile : undefined,
    craftCapReason:
      craft.ceiling && craft.ceiling.max < craft.raw
        ? `Capped at ${craft.ceiling.max}: ${craft.ceiling.reason}.`
        : null,
    verdict: verdictFor(craft, sec, insufficientSignal, craftApplicable),
    vibeScore: audit.vibeScore,
    vibeVerdict: vibeVerdict(audit.vibeScore),
    categories,
    positives: audit.positives,
    tells: craft.distinctTells,
    tellMultiplier: craft.multiplier,
    categoryFit: audit.categoryFit,
    craftDetail: {
      positives: audit.positives,
      tells: audit.tells,
      ceilings: audit.ceilings,
      dimensionCaps: audit.dimensionCaps,
    },
    provenance: audit.provenance,
  };
}
