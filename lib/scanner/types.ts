// Shared types for the scanner library.
//
// The scanner is a standalone library: it knows nothing about Next.js,
// Supabase, or HTTP. It takes a directory on disk and returns findings.
// That keeps it easy to test and easy to move somewhere else later.

export type Severity = 'critical' | 'high' | 'medium' | 'low';

/**
 * How sure we are a finding is real. This is the difference between a fact
 * and a guess, and it drives the grade: only `verified` findings can force a
 * failing grade, so a noisy regex can never fail an app it can't prove is broken.
 *
 *  - verified   — a fact we can stand behind: a known CVE from a vuln database,
 *                 a decoded service_role JWT, a key whose format is unmistakable,
 *                 a package the registry says does not exist.
 *  - likely     — a strong pattern reaching a real sink, but not proven.
 *  - heuristic  — a regex guess. Worth showing, never worth failing you over.
 */
export type Confidence = 'verified' | 'likely' | 'heuristic';

export type CheckType =
  | 'secret'
  | 'platform_config'
  | 'dependency'
  | 'insecure_pattern'
  | 'design';

export interface Finding {
  checkType: CheckType;
  severity: Severity;
  /** Short human title, e.g. "AWS access key committed to code" */
  title: string;
  /** Plain-English explanation of what this is and why it matters */
  explanation: string;
  /** Path of the file, relative to the scanned project root */
  filePath?: string;
  /** 1-based line number where the issue was found */
  lineStart?: number;
  /**
   * A single line of context with any secret value MASKED.
   * This is the only fragment of the user's code we ever keep.
   */
  evidenceMasked?: string;
  /** What the user should do about it, in plain English */
  recommendation: string;
  /** How sure we are (drives the grade). Defaults to 'heuristic' if unset. */
  confidence?: Confidence;
  /** The rule that produced this, for suppression via .securevibe-ignore. */
  ruleId?: string;
}

export interface ScanStats {
  filesScanned: number;
  filesSkipped: number;
  totalBytes: number;
  durationMs: number;
  packagesChecked: number;
  packageLookupFailures: number;
  /** Human-readable notes, e.g. "scan stopped early: file limit reached" */
  notes: string[];
  /** The graded report card (craft + exposure), when the scan produced one. */
  report?: ReportCard;
}

/**
 * One structural deduction, as stored in the report. Mirrors the spec's
 * output block: name, points, what we found, why it reads as vibe coded,
 * and the paste-ready fix prompt.
 */
export interface StructureDeduction {
  signal: string;
  name: string;
  points: number;
  found: string;
  why: string;
  fixPrompt: string;
  filePath?: string;
  lineStart?: number;
  evidence?: string;
}

/**
 * The UI/UX half of the report, per SECUREVIBE-GRADING.md: start at 100,
 * subtract structural deductions, floor at 0. Prose quality, code
 * quality, and color never move this number.
 */
export interface StructureSummary {
  /** False when the repo has no marketing page; nothing is scored then. */
  applicable: boolean;
  notApplicableReason: string | null;
  score: number;
  /** One-line reading of the score, e.g. "The skeleton is the template". */
  band: string;
  /** Deductions ordered largest first — the report's spine. */
  deductions: StructureDeduction[];
  /** Which AI dialect the paint belongs to. Reported, never deducted. */
  dialect: 'A' | 'B' | null;
  dialectNote: string | null;
  scriptMatch: { matched: number; total: number; sequence: string[] };
  pageFile: string | null;
  percentile: { topPercent: number; medianScore: number; sampleSize: number };
  percentileLine: string;
}

/**
 * The report card stored in scans.stats. Everything here is derived from
 * findings — deleting a finding and re-deriving would give the same card.
 *
 * Security and UI/UX are two INDEPENDENT grades. We never blend them: a
 * security tool must not hide a leaked key behind a clean skeleton, and it
 * must not punish a secure app for looking template-y. The structure score
 * is the headline (it is the wedge); exposure is table stakes and a
 * credibility anchor.
 */
export interface ReportCard {
  // ── Exposure (table stakes, and the credibility anchor) ─────────────
  /** Security letter grade, e.g. "F". "—" when there was too little to grade. */
  securityGrade: string;
  /** 0–100 security score behind the grade. */
  securityScore: number;
  /**
   * When the grade is held down by a proven serious finding, this says why —
   * e.g. "Capped at F: a live secret is committed." null when nothing caps it.
   * Modeled on SSL Labs, where one fatal finding sets the ceiling regardless
   * of how clean everything else is.
   */
  securityCapReason: string | null;
  /**
   * Count of security findings by severity, for the at-a-glance strip.
   * SHIPPED code only — findings in test and fixture files are counted in
   * testOnlyCount instead, because planted test credentials are the fixture
   * working as intended, not an exploitable leak.
   */
  tally: Record<Severity, number>;
  /** Security findings that live in test or fixture files. Reported apart. */
  testOnlyCount: number;
  /** True when code was scanned and zero security findings were filed. */
  clean: boolean;
  /**
   * True when there was almost no code to look at (empty repo, docs-only).
   * A scan with nothing to find is not an A+ — it is "we couldn't tell".
   */
  insufficientSignal: boolean;
  /** Honest, plain-English list of what a source scan cannot see. */
  limitations: string[];

  // ── UI/UX (the headline — does the skeleton read as the template?) ───
  /** Letter grade for the structure score. "—" when not applicable. */
  craftGrade: string;
  /**
   * 0–100 structure score per SECUREVIBE-GRADING.md: 100 minus the
   * structural deductions, floored at 0. The full detail is in
   * `structure`.
   */
  craftScore: number;
  /** The complete UI/UX grading detail. */
  structure: StructureSummary;
  /**
   * The headline verdict: one plain sentence naming what the repo reads
   * as. Never a bare number — a number invites argument, a sentence with
   * cited findings under it does not.
   */
  verdict: string;
  /**
   * 0–100: how strongly the page pattern-matches generated output. The
   * structural deductions, read as a meter (100 − structure score).
   */
  vibeScore: number;
  /** Plain-words reading of the vibe meter. */
  vibeVerdict: string;
  /**
   * Workflow markers found in the repo (agent instruction files, generator
   * fingerprints). Context only — they never move a score. Recorded because
   * a disciplined AI-assisted workflow is worth knowing about, not
   * penalizing.
   */
  provenance: string[];
}

export interface ScanResult {
  findings: Finding[];
  stats: ScanStats;
}

/** What we know about a package after asking the registry. */
export interface PackageInfo {
  existsOnRegistry: boolean;
  /** ISO timestamp of the package's first publish, if known */
  publishedAt?: string;
  weeklyDownloads?: number;
}

export type RegistryName = 'npm' | 'pypi';

/**
 * Optional cache so repeated scans don't re-ask npm/PyPI about the same
 * packages. The app plugs in a database-backed cache; tests use memory.
 */
export interface PackageCache {
  get(registry: RegistryName, name: string): Promise<PackageInfo | null>;
  set(registry: RegistryName, name: string, info: PackageInfo): Promise<void>;
}

export interface ScannerOptions {
  /** Injected fetch so tests can run fully offline. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  packageCache?: PackageCache;
  /** Injected clock for deterministic "package age" tests. */
  now?: () => Date;
  /** Abort the file-scanning loop after this many ms (partial results). */
  timeBudgetMs?: number;
  /**
   * Where the source came from, so we can tell a COMMITTED secret from one
   * that merely sits in an uploaded folder:
   *  - 'github' — the files are a repo tarball, i.e. exactly what git tracks,
   *    so an .env present here really is committed (a verified critical).
   *  - 'zip'    — an arbitrary uploaded folder; we cannot prove what git
   *    tracks, so we fall back to the .gitignore and speak carefully.
   * Defaults to 'zip' (the cautious assumption).
   */
  sourceType?: 'github' | 'zip';
  /** Turn off the network CVE lookup (OSV) — used by offline tests. */
  skipVulnerabilityLookup?: boolean;
}
