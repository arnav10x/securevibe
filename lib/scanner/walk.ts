// Walks the extracted project and decides which files are worth scanning.
// Never follows symlinks, never enters dependency/build directories, and
// enforces the file-count and file-size caps.

import fs from 'node:fs/promises';
import path from 'node:path';
import { IGNORED_DIRS, IGNORED_EXTENSIONS, LIMITS } from './limits';

export interface WalkedFile {
  /** Path relative to the scan root, using forward slashes. */
  relPath: string;
  absPath: string;
  size: number;
}

export interface WalkResult {
  files: WalkedFile[];
  skipped: number;
  /** True if we hit MAX_FILES and stopped early. */
  truncated: boolean;
}

export async function walkDirectory(root: string): Promise<WalkResult> {
  const files: WalkedFile[] = [];
  let skipped = 0;
  let truncated = false;

  async function visit(dir: string): Promise<void> {
    if (truncated) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      skipped++;
      return;
    }
    // Sort for deterministic output (nice for tests and diffing reports).
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (truncated) return;
      const abs = path.join(dir, entry.name);

      if (entry.isSymbolicLink()) {
        skipped++; // never follow links — they can point outside the workspace
        continue;
      }
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) {
          skipped++;
          continue;
        }
        await visit(abs);
        continue;
      }
      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (IGNORED_EXTENSIONS.has(ext)) {
        skipped++;
        continue;
      }

      let stat;
      try {
        stat = await fs.stat(abs);
      } catch {
        skipped++;
        continue;
      }
      if (stat.size > LIMITS.MAX_FILE_BYTES) {
        skipped++;
        continue;
      }

      files.push({
        relPath: path.relative(root, abs).split(path.sep).join('/'),
        absPath: abs,
        size: stat.size,
      });

      if (files.length >= LIMITS.MAX_FILES) {
        truncated = true;
      }
    }
  }

  await visit(root);
  return { files, skipped, truncated };
}
