// The end-to-end privacy demonstration required by the product spec:
// a full zip -> extract -> scan pipeline run, after which the submitted
// source code no longer exists anywhere on disk — while the findings
// (with masked evidence) survive.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { scanDirectory } from '@/lib/scanner';
import { withWorkspace } from '@/lib/scanner/acquire/workspace';
import { extractZip } from '@/lib/scanner/acquire/zip-extract';
import { fakeRegistryFetch, FIXED_NOW } from './helpers';

const FIXTURE = path.join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../fixtures/vulnerable-app',
);

async function zipUpFixture(): Promise<string> {
  const zip = new AdmZip();
  zip.addLocalFolder(FIXTURE);
  const file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'svtest-del-')), 'upload.zip');
  await fs.writeFile(file, zip.toBuffer());
  return file;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

describe('end-to-end deletion guarantee', () => {
  it('after a successful scan, the extracted source is gone; findings remain', async () => {
    const zipPath = await zipUpFixture();
    let workspaceDir = '';

    const result = await withWorkspace(async (dir) => {
      workspaceDir = dir;
      await extractZip(zipPath, dir);
      // Source exists during the scan...
      expect(await exists(path.join(dir, 'server.js'))).toBe(true);
      return scanDirectory(dir, { fetchImpl: fakeRegistryFetch, now: FIXED_NOW });
    });

    // ...and is permanently deleted afterwards.
    expect(await exists(workspaceDir)).toBe(false);

    // The report survives — findings only, no raw source, secrets masked.
    expect(result.findings.length).toBeGreaterThan(10);
    expect(JSON.stringify(result)).not.toContain('sk_live_EXAMPLEnotreal1234');

    await fs.rm(path.dirname(zipPath), { recursive: true, force: true });
  });

  it('after a FAILED scan, the extracted source is gone too', async () => {
    const zipPath = await zipUpFixture();
    let workspaceDir = '';

    await expect(
      withWorkspace(async (dir) => {
        workspaceDir = dir;
        await extractZip(zipPath, dir);
        throw new Error('simulated mid-scan crash');
      }),
    ).rejects.toThrow('simulated mid-scan crash');

    expect(await exists(workspaceDir)).toBe(false);
    await fs.rm(path.dirname(zipPath), { recursive: true, force: true });
  });
});
