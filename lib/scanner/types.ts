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
  /** The graded report card (security + design), when the scan produced one. */
  report?: ReportCard;
}

/** One graded layer of the craft audit, e.g. "Design tokens" or "State coverage". */
export interface DesignCategoryScore {
  id: string;
  /** Display name, e.g. "State coverage" */
  label: string;
  /** 0–100, higher is better */
  score: number;
  findingCount: number;
}

/**
 * The report card stored in scans.stats. Everything here is derived from
 * findings — deleting a finding and re-deriving would give the same card.
 *
 * Security and Craft are two INDEPENDENT grades. We never blend them: a
 * security tool must not hide a leaked key behind good typography, and it
 * must not punish a secure app for looking template-y. The Security grade is
 * the headline; Craft is secondary.
 */
export interface ReportCard {
  // ── Security (the headline) ─────────────────────────────────────────
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

  // ── Craft (secondary — how much judgment shows after generation) ─────
  /** Craft letter grade. */
  craftGrade: string;
  /** 0–100 craft score. */
  craftScore: number;
  /**
   * When the accessibility floor caps the craft score, this says why.
   * An interface keyboard users cannot operate is not well designed,
   * whatever it looks like. null when nothing caps it.
   */
  craftCapReason: string | null;
  /**
   * The headline verdict: one plain sentence naming what the repo reads
   * as, derived from the craft and security scores together. Never a
   * bare number — a number invites argument, a sentence with cited
   * findings under it does not.
   */
  verdict: string;
  /**
   * 0–100: how strongly the project pattern-matches unedited AI-generated
   * output. 0 reads human-crafted; 100 is a wall of template tells.
   */
  vibeScore: number;
  /** Plain-words reading of the vibe meter, e.g. "A few template tells". */
  vibeVerdict: string;
  /** Craft layers with individual scores, worst first. */
  categories: DesignCategoryScore[];
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
  /**
   * Optional model-assisted detection (SECUREVIBE.md stage 5). OFF unless an
   * API key is provided — the scanner is fully deterministic by default and
   * never sends code anywhere. When enabled, only short visible-text
   * excerpts (marketing copy) are sent, one named signal per call, and the
   * model returns binary verdicts with citations — never scores.
   */
  llm?: {
    apiKey: string;
    /** OpenAI-compatible API root; defaults to Groq's free-tier endpoint. */
    baseUrl?: string;
    model?: string;
  };
}
