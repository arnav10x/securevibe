// The dashboard's view-model: findings map to the right ring, signals
// group correctly, and the readiness marker sits at the weaker axis.

import { describe, expect, it } from 'vitest';
import {
  PANEL_ORDER,
  groupBySignal,
  panelForFinding,
  readinessScore,
} from '@/lib/report-view';

describe('panelForFinding', () => {
  it('sends every non-design check to exposure', () => {
    for (const checkType of ['secret', 'platform_config', 'dependency', 'insecure_pattern']) {
      expect(panelForFinding({ checkType, title: 'x' })).toBe('exposure');
    }
  });

  it('maps rule-id prefixes to their layers', () => {
    const cases: [string, string][] = [
      ['tokens-multi-hue-gradient', 'tokens'],
      ['states-no-error-boundary', 'states'],
      ['type-below-floor', 'typography'],
      ['motion-transition-all', 'motion'],
      ['layout-template-sequence', 'layout'],
      ['copy-lorem', 'copy'],
      ['a11y-img-no-alt', 'accessibility'],
    ];
    for (const [ruleId, layer] of cases) {
      expect(panelForFinding({ checkType: 'design', ruleId, title: 'x' })).toBe(layer);
    }
  });

  it('falls back to title matching for rows saved before rule_id existed', () => {
    expect(
      panelForFinding({ checkType: 'design', title: '5 different corner radii' }),
    ).toBe('tokens');
    expect(
      panelForFinding({ checkType: 'design', title: 'Lists render, but never the empty case' }),
    ).toBe('states');
    expect(
      panelForFinding({ checkType: 'design', title: 'Page language never declared' }),
    ).toBe('accessibility');
  });

  it('orders the rings craft-first with exposure last', () => {
    expect(PANEL_ORDER[0].id).toBe('tokens');
    expect(PANEL_ORDER[PANEL_ORDER.length - 1].id).toBe('exposure');
    expect(PANEL_ORDER).toHaveLength(8);
  });
});

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
  it('is the LOWER of craft and exposure, never an average', () => {
    expect(readinessScore(27, 76)).toBe(27);
    expect(readinessScore(90, 40)).toBe(40);
    expect(readinessScore(80, 80)).toBe(80);
  });
});
