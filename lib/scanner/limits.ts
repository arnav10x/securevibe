// Every hard limit in one place, so there is exactly one file to edit when
// we decide to raise them. These caps keep scans inside the free-tier
// serverless budget and protect us from hostile inputs (zip bombs etc).

export const LIMITS = {
  /** Max size of a downloaded repo tarball or uploaded zip (compressed). */
  MAX_ARCHIVE_BYTES: 50 * 1024 * 1024, // 50 MB

  /** Max total size once extracted — defends against zip/tar bombs. */
  MAX_UNCOMPRESSED_BYTES: 200 * 1024 * 1024, // 200 MB

  /** Max number of files we will extract and consider. */
  MAX_FILES: 5_000,

  /** Files bigger than this are skipped (almost certainly assets, not code). */
  MAX_FILE_BYTES: 1 * 1024 * 1024, // 1 MB

  /** Stop scanning files after this long and return partial results. */
  SCAN_TIME_BUDGET_MS: 4 * 60 * 1000, // 4 minutes (route allows 5)

  /** Max package.json / requirements.txt files we will check per scan. */
  MAX_MANIFESTS: 10,

  /** Max packages to look up against registries per scan. */
  MAX_PACKAGES: 300,

  /** Registry lookups running at the same time. */
  REGISTRY_CONCURRENCY: 6,

  /** Timeout for a single registry HTTP request. */
  REGISTRY_TIMEOUT_MS: 8_000,
} as const;

/** Directories that never contain the user's own code. */
export const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  '.svelte-kit',
  'dist',
  'build',
  'out',
  'coverage',
  'vendor',
  '.venv',
  'venv',
  '__pycache__',
  '.turbo',
  '.vercel',
  '.cache',
]);

/** File extensions we never scan (binary/media/fonts). */
export const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.avif',
  '.mp3', '.mp4', '.mov', '.avi', '.webm', '.wav', '.ogg',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.zip', '.gz', '.tar', '.rar', '.7z', '.br',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm',
  '.pyc', '.class', '.jar',
]);
