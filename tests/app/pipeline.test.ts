// App-level deletion guarantee: proves the pipeline deletes ALL source
// (workspace + uploaded artifact) BEFORE findings are persisted, on both
// the success and the failure path.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { runScanPipeline } from '@/lib/pipeline';
import { AcquireError } from '@/lib/scanner/acquire/github-tarball';
import type { Finding, ScanResult } from '@/lib/scanner/types';

const FAKE_RESULT: ScanResult = {
  findings: [
    {
      checkType: 'secret',
      severity: 'critical',
      title: 'test finding',
      explanation: 'x'.repeat(50),
      recommendation: 'y'.repeat(30),
      evidenceMasked: 'API_KEY=abc***',
    },
  ],
  stats: {
    filesScanned: 1,
    filesSkipped: 0,
    totalBytes: 10,
    durationMs: 5,
    packagesChecked: 0,
    packageLookupFailures: 0,
    notes: [],
  },
};

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

describe('runScanPipeline ordering', () => {
  it('deletes workspace and source artifact BEFORE persisting findings', async () => {
    const order: string[] = [];
    let workspaceDir = '';
    let workspaceExistedDuringScan = false;
    let workspaceGoneAtPersistTime = false;
    let disposeCalledBeforePersist = false;
    let disposed = false;
    const updates: Record<string, unknown>[] = [];

    const outcome = await runScanPipeline({
      acquire: async (dir) => {
        order.push('acquire');
        workspaceDir = dir;
        await fs.writeFile(path.join(dir, 'app.js'), 'code');
      },
      scan: async (dir) => {
        order.push('scan');
        workspaceExistedDuringScan = await exists(path.join(dir, 'app.js'));
        return FAKE_RESULT;
      },
      disposeSource: async () => {
        order.push('dispose');
        disposed = true;
      },
      persistFindings: async (findings: Finding[]) => {
        order.push('persist');
        disposeCalledBeforePersist = disposed;
        workspaceGoneAtPersistTime = !(await exists(workspaceDir));
        expect(findings).toHaveLength(1);
      },
      updateScan: async (fields) => {
        order.push(`update:${fields.status ?? 'other'}`);
        updates.push(fields);
      },
    });

    expect(outcome.ok).toBe(true);
    expect(order).toEqual(['update:running', 'acquire', 'scan', 'dispose', 'persist', 'update:completed']);
    expect(workspaceExistedDuringScan).toBe(true);
    expect(workspaceGoneAtPersistTime).toBe(true); // source gone before findings saved
    expect(disposeCalledBeforePersist).toBe(true);

    const final = updates.at(-1)!;
    expect(final.status).toBe('completed');
    expect(final.source_deleted_at).toBeTruthy(); // the trust stamp
  });

  it('on failure: still disposes the source and records a friendly error', async () => {
    let disposed = false;
    let workspaceDir = '';
    const updates: Record<string, unknown>[] = [];

    const outcome = await runScanPipeline({
      acquire: async (dir) => {
        workspaceDir = dir;
        await fs.writeFile(path.join(dir, 'app.js'), 'code');
        throw new AcquireError('That repository is private.');
      },
      scan: async () => {
        throw new Error('should never be reached');
      },
      disposeSource: async () => {
        disposed = true;
      },
      persistFindings: async () => {
        throw new Error('should never persist findings for a failed scan');
      },
      updateScan: async (fields) => {
        updates.push(fields);
      },
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.userMessage).toBe('That repository is private.');
    expect(disposed).toBe(true); // uploaded artifact cleaned up even on failure
    expect(await exists(workspaceDir)).toBe(false); // workspace gone even on failure

    const final = updates.at(-1)!;
    expect(final.status).toBe('failed');
    expect(final.error_message).toBe('That repository is private.');
    expect(final.source_deleted_at).toBeTruthy();
  });

  it('hides internal error details behind a generic message', async () => {
    const outcome = await runScanPipeline({
      acquire: async () => {
        throw new Error('ENOENT: /secret/internal/path exploded');
      },
      scan: async () => FAKE_RESULT,
      disposeSource: async () => {},
      persistFindings: async () => {},
      updateScan: async () => {},
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.userMessage).not.toContain('ENOENT');
      expect(outcome.userMessage).toContain('try again');
    }
  });
});
