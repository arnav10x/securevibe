// The teaser gate: medium/low findings pass through in full; critical and
// high findings are stripped to severity + check type before they can ever
// reach a browser. These tests exist so the seal cannot quietly leak a
// field in a future refactor.

import { describe, expect, it } from 'vitest';
import { partitionFindings, redactStats, type FindingRow } from '@/lib/teaser';
import { parseClaimCookie } from '@/lib/anon';

function row(overrides: Partial<FindingRow>): FindingRow {
  return {
    id: 'f-' + Math.random().toString(36).slice(2, 8),
    check_type: 'secret',
    severity: 'medium',
    title: 'A finding title',
    explanation: 'Why it matters.',
    file_path: 'src/app.ts',
    line_start: 12,
    evidence_masked: 'const key = sk_live_1***',
    recommendation: 'Rotate the key.',
    ...overrides,
  };
}

describe('partitionFindings (the teaser seal)', () => {
  it('opens medium/low findings in full and seals critical/high', () => {
    const { tally, unlocked, locked } = partitionFindings([
      row({ severity: 'critical', title: 'Stripe live key' }),
      row({ severity: 'high', title: 'Token in code' }),
      row({ severity: 'medium', title: 'CORS wildcard' }),
      row({ severity: 'low', title: 'Old package' }),
    ]);

    expect(tally).toEqual({ critical: 1, high: 1, medium: 1, low: 1 });
    expect(unlocked.map((f) => f.title)).toEqual(['CORS wildcard', 'Old package']);
    expect(locked).toHaveLength(2);
  });

  it('never lets sealed findings carry anything beyond severity + check type', () => {
    const { locked } = partitionFindings([
      row({ severity: 'critical', title: 'SECRET TITLE', file_path: 'secret/path.ts' }),
      row({ severity: 'high', check_type: 'platform_config' }),
    ]);

    for (const sealed of locked) {
      // Exactly these two keys — a leaked title/path/evidence fails loudly.
      expect(Object.keys(sealed).sort()).toEqual(['checkType', 'severity']);
    }
  });

  it('keeps full detail (masked evidence included) on open findings', () => {
    const { unlocked } = partitionFindings([row({ severity: 'medium' })]);
    expect(unlocked[0]).toMatchObject({
      severity: 'medium',
      checkType: 'secret',
      filePath: 'src/app.ts',
      lineStart: 12,
      evidenceMasked: 'const key = sk_live_1***',
      recommendation: 'Rotate the key.',
    });
  });

  it('orders both groups worst-first', () => {
    const { unlocked, locked } = partitionFindings([
      row({ severity: 'low', title: 'low one' }),
      row({ severity: 'high' }),
      row({ severity: 'medium', title: 'medium one' }),
      row({ severity: 'critical' }),
    ]);
    expect(locked.map((f) => f.severity)).toEqual(['critical', 'high']);
    expect(unlocked.map((f) => f.severity)).toEqual(['medium', 'low']);
  });

  it('handles an empty report', () => {
    const { tally, unlocked, locked } = partitionFindings([]);
    expect(tally).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
    expect(unlocked).toEqual([]);
    expect(locked).toEqual([]);
  });
});

describe('redactStats seals the structure summary', () => {
  const stats = {
    filesScanned: 12,
    report: {
      craftScore: 40,
      structure: {
        applicable: true,
        score: 40,
        deductions: [
          {
            signal: 'social-proof',
            name: 'Social proof structure',
            points: 16,
            found: 'the full citation with file paths',
            why: 'the reasoning',
            fixPrompt: 'the paid deliverable',
            filePath: 'app/page.tsx',
            evidence: 'testimonials[3]',
          },
        ],
      },
    },
  };

  it('keeps the ledger (name, points) and strips the detail', () => {
    const redacted = redactStats(stats) as typeof stats;
    const d = redacted.report.structure.deductions[0] as Record<string, unknown>;
    expect(d.signal).toBe('social-proof');
    expect(d.name).toBe('Social proof structure');
    expect(d.points).toBe(16);
    expect(d.found).toBeUndefined();
    expect(d.why).toBeUndefined();
    expect(d.fixPrompt).toBeUndefined();
    expect(d.filePath).toBeUndefined();
    expect(d.evidence).toBeUndefined();
  });

  it('leaves the original object untouched and passes through odd shapes', () => {
    redactStats(stats);
    expect(stats.report.structure.deductions[0].fixPrompt).toBe('the paid deliverable');
    expect(redactStats({})).toEqual({});
    expect(redactStats({ report: {} })).toEqual({ report: {} });
  });
});

describe('parseClaimCookie', () => {
  it('splits "<scanId>.<token>" on the first dot', () => {
    expect(parseClaimCookie('abc-123.tok-456')).toEqual({ scanId: 'abc-123', token: 'tok-456' });
  });

  it('rejects malformed values', () => {
    expect(parseClaimCookie(undefined)).toBeNull();
    expect(parseClaimCookie('')).toBeNull();
    expect(parseClaimCookie('no-dot')).toBeNull();
    expect(parseClaimCookie('.starts-with-dot')).toBeNull();
    expect(parseClaimCookie('ends-with-dot.')).toBeNull();
  });
});
