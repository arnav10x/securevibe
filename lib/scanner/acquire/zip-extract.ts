// Safely extracts an uploaded .zip into the workspace.
//
// Zips are hostile input. This module defends against:
//  - zip-slip: entries named "../../etc/passwd" escaping the workspace
//  - zip bombs: tiny archives that expand to terabytes
//  - symlinks smuggled in to point at files outside the workspace

import fs from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { LIMITS } from '../limits';
import { AcquireError } from './github-tarball';

export async function extractZip(zipPath: string, destDir: string): Promise<void> {
  let zip: AdmZip;
  try {
    zip = new AdmZip(zipPath);
  } catch {
    throw new AcquireError('That file could not be opened as a .zip archive.');
  }

  const entries = zip.getEntries();
  if (entries.length === 0) {
    throw new AcquireError('The zip archive is empty.');
  }
  if (entries.length > LIMITS.MAX_FILES * 2) {
    throw new AcquireError(
      `The zip contains too many files (limit: ${LIMITS.MAX_FILES}).`,
    );
  }

  // First pass: total declared uncompressed size (zip-bomb check #1).
  let declaredTotal = 0;
  for (const entry of entries) {
    declaredTotal += entry.header.size;
    if (declaredTotal > LIMITS.MAX_UNCOMPRESSED_BYTES) {
      throw new AcquireError('The zip expands beyond the 200 MB limit.');
    }
  }

  const resolvedDest = path.resolve(destDir) + path.sep;
  let actualTotal = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const entryName = entry.entryName;
    // Reject anything that could escape the workspace.
    if (
      entryName.includes('..') ||
      entryName.startsWith('/') ||
      entryName.startsWith('\\') ||
      entryName.includes('\0') ||
      /^[A-Za-z]:/.test(entryName) // Windows drive prefix
    ) {
      continue; // skip silently; scanning the rest is still useful
    }

    // Unix mode lives in the top 16 bits of the external attributes.
    // 0xA000 = symlink. We never write symlinks into the workspace.
    const unixMode = entry.header.attr >>> 16;
    if ((unixMode & 0xf000) === 0xa000) continue;

    const target = path.resolve(destDir, entryName);
    if (!target.startsWith(resolvedDest)) continue; // belt and suspenders

    let data: Buffer;
    try {
      data = entry.getData();
    } catch {
      continue; // corrupt entry — skip it
    }

    // Zip-bomb check #2: headers can lie, so count ACTUAL bytes too.
    actualTotal += data.length;
    if (actualTotal > LIMITS.MAX_UNCOMPRESSED_BYTES) {
      throw new AcquireError('The zip expands beyond the 200 MB limit.');
    }
    if (data.length > LIMITS.MAX_FILE_BYTES * 4) continue; // huge single file: skip

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
  }
}
