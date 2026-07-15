// Proves the zip extractor cannot be escaped (zip-slip) or blown up
// (zip bombs), and that a normal zip extracts fine.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { extractZip } from '@/lib/scanner/acquire/zip-extract';
import { withWorkspace } from '@/lib/scanner/acquire/workspace';
import { AcquireError } from '@/lib/scanner/acquire/github-tarball';

async function makeZip(build: (zip: AdmZip) => void): Promise<string> {
  const zip = new AdmZip();
  build(zip);
  const file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'svtest-zip-')), 'test.zip');
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

describe('zip extraction safety', () => {
  it('extracts a normal zip', async () => {
    const zipPath = await makeZip((zip) => {
      zip.addFile('src/index.js', Buffer.from('const a = 1;'));
      zip.addFile('package.json', Buffer.from('{"name":"x"}'));
    });
    await withWorkspace(async (dir) => {
      await extractZip(zipPath, dir);
      expect(await exists(path.join(dir, 'src/index.js'))).toBe(true);
      expect(await exists(path.join(dir, 'package.json'))).toBe(true);
    });
  });

  it('refuses zip-slip entries (../ traversal)', async () => {
    const zipPath = await makeZip((zip) => {
      zip.addFile('../evil.txt', Buffer.from('escaped!'));
      zip.addFile('ok.txt', Buffer.from('fine'));
    });
    await withWorkspace(async (dir) => {
      await extractZip(zipPath, dir);
      expect(await exists(path.join(dir, 'ok.txt'))).toBe(true);
      // The traversal entry must NOT have been written next to the workspace.
      expect(await exists(path.resolve(dir, '../evil.txt'))).toBe(false);
    });
  });

  it('skips absolute-path entries', async () => {
    const zipPath = await makeZip((zip) => {
      zip.addFile('/tmp/svtest-absolute-escape.txt', Buffer.from('escaped!'));
      zip.addFile('ok.txt', Buffer.from('fine'));
    });
    await withWorkspace(async (dir) => {
      await extractZip(zipPath, dir);
      expect(await exists(path.join(dir, 'ok.txt'))).toBe(true);
    });
    expect(await exists('/tmp/svtest-absolute-escape.txt')).toBe(false);
  });

  it('rejects an empty zip with a friendly error', async () => {
    const zipPath = await makeZip(() => {});
    await withWorkspace(async (dir) => {
      await expect(extractZip(zipPath, dir)).rejects.toThrow(AcquireError);
    });
  });

  it('rejects archives that declare an oversized expansion', async () => {
    const zipPath = await makeZip((zip) => {
      // Declare a bogus huge uncompressed size in the header.
      const entryData = Buffer.alloc(1024, 'a');
      zip.addFile('big.txt', entryData);
      zip.getEntries()[0].header.size = 500 * 1024 * 1024; // claim 500MB
    });
    await withWorkspace(async (dir) => {
      await expect(extractZip(zipPath, dir)).rejects.toThrow(/200 MB/);
    });
  });
});
