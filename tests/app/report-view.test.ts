// The dashboard's view-model: exposure findings group into signals, the
// readiness marker sits at the weaker axis, and the hover projection is
// the deduction handed back.

import { describe, expect, it } from 'vitest';
import {
  EXPOSURE_PANEL,
  groupBySignal,
  projectedReadiness,
  projectedStructureScore,
  readinessScore,
} from '@/lib/report-view';
import type { StructureSummary } from '@/lib/scanner/types';

describe('groupBySignal', () => {
  const f = (over: Partial<{ ruleId: string; title: string; severity: string }>) => ({
    ruleId: 'r1',
    title: 'T',
    severity: 'low',
    ...over,
  });

  it('groups occurrences of one rule into one signal', () => {
    const groups = groupBySignal([f({}), f({}), f({ ruleId: 'r2', title: 'Other' })]);
    expect(groups).toHaveLength(2);
    const r1 = groups.find((g) => g.key === 'r1')!;
    expect(r1.count).toBe(2);
    expect(r1.findings).toHaveLength(2);
  });

  it('sorts worst severity first and carries the worst severity per group', () => {
    const groups = groupBySignal([
      f({ ruleId: 'a', severity: 'low' }),
      f({ ruleId: 'a', severity: 'high' }),
      f({ ruleId: 'b', severity: 'medium' }),
    ]);
    expect(groups[0].key).toBe('a');
    expect(groups[0].severity).toBe('high');
    expect(groups[1].key).toBe('b');
  });
});

describe('readinessScore', () => {
  it('is the LOWER of structure and exposure, never an average', () => {
    expect(readinessScore(27, 76)).toBe(27);
    expect(readinessScore(90, 40)).toBe(40);
    expect(readinessScore(80, 80)).toBe(80);
  });
});

const structure: StructureSummary = {
  applicable: true,
  notApplicableReason: null,
  score: 40,
  band: 'The skeleton is the template',
  deductions: [
    {
      signal: 'content-as-data',
      name: 'Content-as-data arrays',
      points: 16,
      found: 'x',
      why: 'y',
      fixPrompt: 'z',
    },
    {
      signal: 'eyebrow-labels',
      name: 'Eyebrow labels above headings',
      points: 10,
      found: 'x',
      why: 'y',
      fixPrompt: 'z',
    },
  ],
  dialect: 'A',
  dialectNote: null,
  scriptMatch: { matched: 7, total: 10, sequence: [] },
  pageFile: 'app/page.tsx',
  percentile: { topPercent: 60, medianScore: 55, sampleSize: 30 },
  percentileLine: 'Score 40.',
};

describe('projectedStructureScore (the hover preview math)', () => {
  it('hands the deduction back, capped at 100', () => {
    expect(projectedStructureScore(structure, 'content-as-data')).toBe(56);
    expect(projectedStructureScore(structure, 'eyebrow-labels')).toBe(50);
    expect(projectedStructureScore({ ...structure, score: 95 }, 'content-as-data')).toBe(100);
  });

  it('returns the score unchanged for an unknown signal', () => {
    expect(projectedStructureScore(structure, 'nope')).toBe(40);
  });
});

describe('projectedReadiness', () => {
  const report = { craftScore: 40, securityScore: 76, structure };

  it('fixing a signal moves readiness by its points', () => {
    expect(projectedReadiness(report, 'content-as-data')).toBe(56);
  });

  it('never exceeds the other axis', () => {
    const held = { ...report, securityScore: 45 };
    expect(projectedReadiness(held, 'content-as-data')).toBe(45);
  });

  it('fixing exposure moves readiness to the structure score', () => {
    expect(projectedReadiness(report, EXPOSURE_PANEL)).toBe(40);
    expect(
      projectedReadiness({ ...report, craftScore: 90, securityScore: 40 }, EXPOSURE_PANEL),
    ).toBe(90);
  });

  it('degrades gracefully without a structure summary', () => {
    expect(
      projectedReadiness({ craftScore: 30, securityScore: 80 }, 'anything'),
    ).toBe(30);
  });
});
