// The false-positive guard: a clean, well-behaved app must produce
// ZERO findings. A scanner that cries wolf gets ignored.

import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanDirectory } from '@/lib/scanner';
import { fakeRegistryFetch, FIXED_NOW } from './helpers';

const FIXTURE = path.join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../fixtures/clean-app',
);

describe('clean fixture', () => {
  it('produces zero findings', async () => {
    const result = await scanDirectory(FIXTURE, {
      fetchImpl: fakeRegistryFetch,
      now: FIXED_NOW,
    });
    expect(
      result.findings,
      JSON.stringify(result.findings, null, 2), // show what fired, if anything
    ).toHaveLength(0);
    expect(result.stats.filesScanned).toBeGreaterThan(0);
  });
});
