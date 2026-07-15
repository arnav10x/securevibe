// The workspace is the ONLY place submitted code ever touches disk.
//
// This module is the heart of the privacy guarantee:
//  - every scan gets a fresh private temp directory
//  - `withWorkspace` deletes it in a `finally` block, so it is destroyed
//    whether the scan succeeds, fails, or throws
//  - on Vercel this lives in the function's ephemeral /tmp, which the
//    platform itself wipes — a second, independent safety net
//
// tests/scanner/workspace.test.ts proves the deletion behavior for both
// the success and the failure path.

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export interface Workspace {
  dir: string;
  cleanup: () => Promise<void>;
}

export async function createWorkspace(): Promise<Workspace> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'securevibe-scan-'));
  return {
    dir,
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true, maxRetries: 3 });
    },
  };
}

/**
 * Runs `fn` with a fresh temp directory and GUARANTEES it is deleted
 * afterwards, no matter what happened inside.
 */
export async function withWorkspace<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const workspace = await createWorkspace();
  try {
    return await fn(workspace.dir);
  } finally {
    await workspace.cleanup();
  }
}
