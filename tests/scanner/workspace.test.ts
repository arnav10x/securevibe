// THE deletion-guarantee tests. These prove the privacy promise:
// the temp workspace is destroyed after a scan, on BOTH the success
// path and the failure path.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { withWorkspace, createWorkspace } from '@/lib/scanner/acquire/workspace';

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

describe('workspace deletion guarantee', () => {
  it('deletes the workspace after a successful run', async () => {
    let dirUsed = '';
    await withWorkspace(async (dir) => {
      dirUsed = dir;
      await fs.writeFile(path.join(dir, 'code.js'), 'const x = 1;');
      expect(await exists(path.join(dir, 'code.js'))).toBe(true);
    });
    expect(dirUsed).not.toBe('');
    expect(await exists(dirUsed)).toBe(false); // gone, permanently
  });

  it('deletes the workspace even when the work inside throws', async () => {
    let dirUsed = '';
    await expect(
      withWorkspace(async (dir) => {
        dirUsed = dir;
        await fs.mkdir(path.join(dir, 'nested/deep'), { recursive: true });
        await fs.writeFile(path.join(dir, 'nested/deep/secret.js'), 'oops');
        throw new Error('simulated scanner crash');
      }),
    ).rejects.toThrow('simulated scanner crash');
    expect(await exists(dirUsed)).toBe(false); // still gone
  });

  it('creates isolated, unique directories per scan', async () => {
    const a = await createWorkspace();
    const b = await createWorkspace();
    expect(a.dir).not.toBe(b.dir);
    await a.cleanup();
    await b.cleanup();
    expect(await exists(a.dir)).toBe(false);
    expect(await exists(b.dir)).toBe(false);
  });
});
