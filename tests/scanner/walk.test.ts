import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { walkDirectory } from '@/lib/scanner/walk';
import { withWorkspace } from '@/lib/scanner/acquire/workspace';

describe('walkDirectory', () => {
  it('skips node_modules, .git, binaries and huge files', async () => {
    await withWorkspace(async (dir) => {
      await fs.mkdir(path.join(dir, 'node_modules/some-pkg'), { recursive: true });
      await fs.mkdir(path.join(dir, '.git'), { recursive: true });
      await fs.mkdir(path.join(dir, 'src'), { recursive: true });

      await fs.writeFile(path.join(dir, 'node_modules/some-pkg/index.js'), 'eval(x)');
      await fs.writeFile(path.join(dir, '.git/config'), 'token = abc');
      await fs.writeFile(path.join(dir, 'src/app.js'), 'const a = 1;');
      await fs.writeFile(path.join(dir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      await fs.writeFile(path.join(dir, 'huge.js'), 'x'.repeat(2 * 1024 * 1024)); // 2MB

      const result = await walkDirectory(dir);
      const paths = result.files.map((f) => f.relPath);

      expect(paths).toContain('src/app.js');
      expect(paths.some((p) => p.startsWith('node_modules'))).toBe(false);
      expect(paths.some((p) => p.startsWith('.git'))).toBe(false);
      expect(paths).not.toContain('logo.png');
      expect(paths).not.toContain('huge.js');
      expect(result.skipped).toBeGreaterThan(0);
    });
  });

  it('never follows symlinks', async () => {
    await withWorkspace(async (dir) => {
      await fs.writeFile(path.join(dir, 'real.js'), 'const a = 1;');
      try {
        await fs.symlink('/etc', path.join(dir, 'link-to-etc'));
      } catch {
        return; // platform doesn't allow symlink creation; nothing to test
      }
      const result = await walkDirectory(dir);
      const paths = result.files.map((f) => f.relPath);
      expect(paths).toEqual(['real.js']);
    });
  });
});
