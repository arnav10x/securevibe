// Scans the deliberately vulnerable fixture app and asserts every planted
// issue is caught — and that no unmasked secret leaks into the findings.

import { beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanDirectory } from '@/lib/scanner';
import type { Finding, ScanResult } from '@/lib/scanner';
import { fakeRegistryFetch, FIXED_NOW } from './helpers';

const FIXTURE = path.join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../fixtures/vulnerable-app',
);

let result: ScanResult;

beforeAll(async () => {
  result = await scanDirectory(FIXTURE, {
    fetchImpl: fakeRegistryFetch,
    now: FIXED_NOW,
  });
});

function findByTitle(fragment: string): Finding | undefined {
  return result.findings.find((f) => f.title.toLowerCase().includes(fragment.toLowerCase()));
}

describe('vulnerable fixture: secrets check', () => {
  it('flags the committed .env file itself', () => {
    const f = findByTitle('committed to the repository');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('critical');
  });

  it('flags the AWS access key', () => {
    expect(findByTitle('AWS access key')).toBeDefined();
  });

  it('flags the Stripe live key', () => {
    expect(findByTitle('Stripe LIVE secret key')).toBeDefined();
  });

  it('flags the database connection string', () => {
    expect(findByTitle('connection string with password')).toBeDefined();
  });

  it('flags Google, GitHub and Anthropic keys', () => {
    expect(findByTitle('Google API key')).toBeDefined();
    expect(findByTitle('GitHub token')).toBeDefined();
    expect(findByTitle('Anthropic API key')).toBeDefined();
  });

  it('flags a generic high-entropy credential assignment', () => {
    expect(findByTitle('Possible hardcoded credential')).toBeDefined();
  });
});

describe('vulnerable fixture: platform config check', () => {
  it('flags wide-open Firestore rules as critical', () => {
    const f = findByTitle('Firebase rules allow public access');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('critical');
    expect(f!.filePath).toBe('firestore.rules');
  });

  it('flags wide-open Realtime Database rules', () => {
    expect(findByTitle('Realtime Database is publicly')).toBeDefined();
  });

  it('flags disabled Row Level Security', () => {
    expect(findByTitle('Row Level Security is explicitly disabled')).toBeDefined();
  });

  it('flags the USING (true) write policy', () => {
    expect(findByTitle('writable by everyone')).toBeDefined();
  });
});

describe('vulnerable fixture: dependency check', () => {
  it('flags the nonexistent npm package (slopsquatting)', () => {
    const f = findByTitle('securevibe-test-nonexistent-pkg-8f3k2');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('high');
    expect(f!.explanation).toContain('slopsquatting');
  });

  it('flags the nonexistent PyPI package', () => {
    expect(findByTitle('securevibe-fake-pypi-pkg-9q1z')).toBeDefined();
  });

  it('does NOT flag real packages (react, requests)', () => {
    expect(findByTitle('"react"')).toBeUndefined();
    expect(findByTitle('"requests"')).toBeUndefined();
  });
});

describe('vulnerable fixture: insecure pattern check', () => {
  it('flags eval() on dynamic values in JS and Python', () => {
    const evals = result.findings.filter((f) => f.title.includes('eval()'));
    const files = new Set(evals.map((f) => f.filePath));
    expect(files.has('server.js')).toBe(true);
    expect(files.has('app.py')).toBe(true);
  });

  it('flags SQL built by concatenation and template strings', () => {
    expect(findByTitle('string concatenation')).toBeDefined();
    expect(findByTitle('template-string interpolation')).toBeDefined();
  });

  it('flags the Python f-string SQL query', () => {
    expect(findByTitle('f-string')).toBeDefined();
  });

  it('flags disabled TLS verification in JS and Python', () => {
    expect(findByTitle('TLS certificate verification is disabled')).toBeDefined();
    expect(findByTitle('verify=False')).toBeDefined();
  });

  it('flags browser-storage auth state', () => {
    expect(findByTitle('browser storage')).toBeDefined();
  });

  it('flags the hardcoded password comparison', () => {
    expect(findByTitle('hardcoded value')).toBeDefined();
  });
});

describe('report quality and privacy', () => {
  it('covers all four check types', () => {
    const types = new Set(result.findings.map((f) => f.checkType));
    expect(types).toEqual(
      new Set(['secret', 'platform_config', 'dependency', 'insecure_pattern']),
    );
  });

  it('every finding has an explanation and a recommendation', () => {
    for (const f of result.findings) {
      expect(f.explanation.length, f.title).toBeGreaterThan(40);
      expect(f.recommendation.length, f.title).toBeGreaterThan(20);
    }
  });

  it('NEVER leaks a full secret value into any finding field', () => {
    const secrets = [
      'sk_live_EXAMPLEnotreal1234',
      'AKIAIOSFODNN7EXAMPLE',
      'SuperSecret123',
      'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      'sk-ant-api03-FAKEFAKEFAKEFAKEFAKEFAKE',
      'AIzaSyFAKE_FAKE_FAKE_FAKE_FAKE_FAKE_123',
      'q9X2mZ7LpR4vT8wN3bK6',
    ];
    const everything = JSON.stringify(result);
    for (const secret of secrets) {
      expect(everything, `full secret should be masked: ${secret}`).not.toContain(secret);
    }
  });

  it('evidence lines are short and single-line', () => {
    for (const f of result.findings) {
      if (!f.evidenceMasked) continue;
      expect(f.evidenceMasked.length).toBeLessThanOrEqual(160);
      expect(f.evidenceMasked).not.toContain('\n');
    }
  });

  it('findings are sorted most-severe first', () => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    for (let i = 1; i < result.findings.length; i++) {
      expect(order[result.findings[i - 1].severity]).toBeLessThanOrEqual(
        order[result.findings[i].severity],
      );
    }
  });

  it('reports sane stats', () => {
    expect(result.stats.filesScanned).toBeGreaterThan(5);
    expect(result.stats.packagesChecked).toBe(4); // react, fake-npm, requests, fake-pypi
    expect(result.stats.packageLookupFailures).toBe(0);
  });
});
