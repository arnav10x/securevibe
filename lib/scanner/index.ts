// The scanner orchestrator: point it at a directory, get back findings.
//
//   const result = await scanDirectory('/tmp/some-extracted-project');
//
// It never executes the code it scans, never sends file contents anywhere,
// and returns only findings (path, line, masked evidence, explanations).

import fs from 'node:fs/promises';
import type { Finding, ScannerOptions, ScanResult, Severity } from './types';
import { LIMITS } from './limits';
import { walkDirectory } from './walk';
import { looksBinary } from './util';
import { checkSecretsInFile } from './checks/secrets';
import { checkPlatformConfigInFile } from './checks/platform-config';
import { checkCodePatternsInFile } from './checks/code-patterns';
import { checkDependencies } from './checks/dependencies';

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function scanDirectory(
  rootDir: string,
  options: ScannerOptions = {},
): Promise<ScanResult> {
  const startedAt = Date.now();
  const timeBudgetMs = options.timeBudgetMs ?? LIMITS.SCAN_TIME_BUDGET_MS;
  const notes: string[] = [];

  const walk = await walkDirectory(rootDir);
  if (walk.truncated) {
    notes.push(
      `Project has more than ${LIMITS.MAX_FILES} files; only the first ` +
        `${LIMITS.MAX_FILES} were scanned.`,
    );
  }

  const findings: Finding[] = [];
  const manifestContents: { file: (typeof walk.files)[number]; content: string }[] = [];
  let filesScanned = 0;
  let skippedBinary = 0;
  let totalBytes = 0;
  let timedOut = false;

  for (const file of walk.files) {
    if (Date.now() - startedAt > timeBudgetMs) {
      timedOut = true;
      break;
    }

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(file.absPath);
    } catch {
      continue;
    }
    if (looksBinary(buffer)) {
      skippedBinary++;
      continue;
    }

    const content = buffer.toString('utf8');
    filesScanned++;
    totalBytes += buffer.length;

    findings.push(...checkSecretsInFile(file.relPath, content));
    findings.push(...checkPlatformConfigInFile(file.relPath, content));
    findings.push(...checkCodePatternsInFile(file.relPath, content));

    // Remember dependency manifests for the registry check below.
    const base = file.relPath.split('/').pop()?.toLowerCase() ?? '';
    if (base === 'package.json' || /^requirements[^/]*\.txt$/.test(base)) {
      manifestContents.push({ file, content });
    }
  }

  if (timedOut) {
    notes.push('Scan time budget reached; results may be partial.');
  }

  const deps = await checkDependencies(manifestContents, options);
  findings.push(...deps.findings);
  if (deps.lookupFailures > 0) {
    notes.push(
      `${deps.lookupFailures} package registry lookups failed (network); ` +
        'those packages were not assessed.',
    );
  }

  findings.sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return (a.filePath ?? '').localeCompare(b.filePath ?? '');
  });

  return {
    findings,
    stats: {
      filesScanned,
      filesSkipped: walk.skipped + skippedBinary,
      totalBytes,
      durationMs: Date.now() - startedAt,
      packagesChecked: deps.packagesChecked,
      packageLookupFailures: deps.lookupFailures,
      notes,
    },
  };
}

export * from './types';
export { LIMITS } from './limits';
export { withWorkspace, createWorkspace } from './acquire/workspace';
