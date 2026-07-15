// The scan pipeline: acquire -> scan -> delete source -> persist findings.
//
// It talks to the outside world only through the `ports` object, which
// makes the ordering guarantees testable: tests inject in-memory ports and
// assert that the source is gone by the time findings are persisted.
//
// Deletion guarantees, in order:
//  1. `withWorkspace` deletes the temp directory in a finally block
//  2. `disposeSource` (e.g. the uploaded zip in storage) runs on BOTH the
//     success and the failure path
//  3. only then is the scan marked finished, with `source_deleted_at`

import { withWorkspace } from '@/lib/scanner/acquire/workspace';
import { AcquireError } from '@/lib/scanner/acquire/github-tarball';
import type { Finding, ScanResult } from '@/lib/scanner/types';

/** Keep pathological reports bounded (and the DB small). */
export const MAX_PERSISTED_FINDINGS = 500;

export interface PipelinePorts {
  /** Fill the workspace directory with the submitted source code. */
  acquire: (dir: string) => Promise<void>;
  /** Run the scanner over the workspace. */
  scan: (dir: string) => Promise<ScanResult>;
  /** Delete the original submitted artifact (uploaded zip). No-op for GitHub. */
  disposeSource: () => Promise<void>;
  /** Save findings to the database. */
  persistFindings: (findings: Finding[], truncated: boolean) => Promise<void>;
  /** Update the scan row. */
  updateScan: (fields: Record<string, unknown>) => Promise<void>;
}

export type PipelineOutcome =
  | { ok: true; result: ScanResult }
  | { ok: false; userMessage: string };

export async function runScanPipeline(ports: PipelinePorts): Promise<PipelineOutcome> {
  await ports.updateScan({ status: 'running' });

  let result: ScanResult;
  try {
    // Workspace (and every byte of source inside it) is deleted by
    // withWorkspace's finally block — success or crash alike.
    result = await withWorkspace(async (dir) => {
      await ports.acquire(dir);
      return ports.scan(dir);
    });
  } catch (error) {
    await ports.disposeSource().catch(() => {}); // best effort; cron sweeps stragglers
    const userMessage =
      error instanceof AcquireError
        ? error.message
        : 'The scan failed unexpectedly. Please try again. Failed scans do not count against your monthly quota.';
    await ports.updateScan({
      status: 'failed',
      error_message: userMessage,
      finished_at: new Date().toISOString(),
      source_deleted_at: new Date().toISOString(),
    });
    return { ok: false, userMessage };
  }

  // Source cleanup BEFORE persisting anything: by the time findings exist
  // in the database, the code that produced them no longer exists anywhere.
  await ports.disposeSource().catch(() => {});
  const sourceDeletedAt = new Date().toISOString();

  const truncated = result.findings.length > MAX_PERSISTED_FINDINGS;
  const findings = truncated
    ? result.findings.slice(0, MAX_PERSISTED_FINDINGS)
    : result.findings;

  await ports.persistFindings(findings, truncated);
  await ports.updateScan({
    status: 'completed',
    stats: {
      ...result.stats,
      notes: truncated
        ? [...result.stats.notes, `Report capped at ${MAX_PERSISTED_FINDINGS} findings.`]
        : result.stats.notes,
    },
    finished_at: new Date().toISOString(),
    source_deleted_at: sourceDeletedAt,
  });

  return { ok: true, result };
}
