// Shared types for the scanner library.
//
// The scanner is a standalone library: it knows nothing about Next.js,
// Supabase, or HTTP. It takes a directory on disk and returns findings.
// That keeps it easy to test and easy to move somewhere else later.

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type CheckType =
  | 'secret'
  | 'platform_config'
  | 'dependency'
  | 'insecure_pattern';

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
}
