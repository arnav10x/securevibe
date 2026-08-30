// Turns findings into the report card. Two INDEPENDENT scores, never
// blended, plus a headline verdict derived from the pair:
//
//   Exposure — the credibility anchor. Modeled on how real graders work
//     (SSL Labs, Mozilla Observatory, SonarQube): a weighted hygiene score
//     with diminishing returns, then HARD CAPS. A single PROVEN serious
//     finding sets a ceiling the rest of the report cannot lift, because an
//     attacker exploits your weakest link, not your average.
//
//   UI/UX — per SECUREVIBE-GRADING.md: start at 100, subtract the
//     structural deductions the signal catalog found, floor at 0. The
//     score reads the skeleton, not the paint: prose quality, code
//     quality, and color never move it, in either direction.
//
// All of it is arithmetic, kept readable so the formula is explainable to a
// non-technical founder and stable enough that scores compare over time.

import type {
  Confidence,
  Finding,
  ReportCard,
  Severity,
  StructureSummary,
} from './types';
import type { StructureReport } from './uiux';
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

/** Plain-words reading of the vibe meter (100 − structure score). */
export function vibeVerdict(vibe: number): string {
  if (vibe >= 80) return 'Unmistakably vibe coded';
  if (vibe >= 50) return 'Clearly template-flavored';
  if (vibe >= 20) return 'A few template tells';
  return 'Reads hand-built';
}

/**
 * The headline verdict: the band sentence, the percentile line the spec
 * mandates, and the exposure note when it is the thing to fix first.
 */
export function verdictFor(
  structure: StructureReport,
  security: SecurityAssessment,
  insufficientSignal: boolean,
): string {
  if (insufficientSignal) {
    return 'Not enough code to read. Point the scan at the real project.';
  }
  if (!structure.applicable) {
    return 'No marketing page found to grade, so this report covers exposure only.';
  }
  const securityNote =
    security.score < 60 ? ' Close the exposure findings before shipping.' : '';
  return `${structure.band}. ${structure.percentileLine}${securityNote}`;
}

/** The honest "what this scan cannot see" box. Always shown. */
const SOURCE_SCAN_LIMITATIONS = [
  'This reads your source code, not your running app. It cannot confirm ' +
    'whether your live database is actually locked down (Row Level Security). ' +
    'A live-URL scan is what tests that, and it is where most real breaches ' +
    'are caught.',
  'It cannot catch business-logic flaws, one user reading another user’s ' +
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
  /** Workflow markers recorded as context. Never scored. */
  provenance?: string[];
}

/** The stored summary is the analysis result, field for field. */
export function toStructureSummary(structure: StructureReport): StructureSummary {
  return {
    applicable: structure.applicable,
    notApplicableReason: structure.notApplicableReason,
    score: structure.score,
    band: structure.band,
    deductions: structure.findings.map((f) => ({
      signal: f.signal,
      name: f.name,
      points: f.points,
      found: f.found,
      why: f.why,
      fixPrompt: f.fixPrompt,
      filePath: f.filePath,
      lineStart: f.lineStart,
      evidence: f.evidence,
    })),
    dialect: structure.dialect,
    dialectNote: structure.dialectNote,
    scriptMatch: structure.scriptMatch,
    pageFile: structure.pageFile,
    percentile: structure.percentile,
    percentileLine: structure.percentileLine,
  };
}

export function buildReportCard(
  findings: Finding[],
  structure: StructureReport,
  meta: ReportMeta = { codeFilesScanned: 1 },
): ReportCard {
  const sec = assessSecurity(findings);
  const insufficientSignal = meta.codeFilesScanned === 0;
  const applicable = structure.applicable && !insufficientSignal;
  const vibe = applicable ? Math.max(0, 100 - structure.score) : 0;

  return {
    securityGrade: insufficientSignal ? '—' : sec.grade,
    securityScore: sec.score,
    securityCapReason: sec.capReason,
    tally: sec.tally,
    testOnlyCount: sec.testOnlyCount,
    clean: sec.clean && !insufficientSignal,
    insufficientSignal,
    limitations: SOURCE_SCAN_LIMITATIONS,
    craftGrade: applicable ? letterGrade(structure.score) : '—',
    craftScore: applicable ? structure.score : 0,
    structure: toStructureSummary(structure),
    verdict: verdictFor(structure, sec, insufficientSignal),
    vibeScore: vibe,
    vibeVerdict: vibeVerdict(vibe),
    provenance: meta.provenance ?? [],
  };
}
