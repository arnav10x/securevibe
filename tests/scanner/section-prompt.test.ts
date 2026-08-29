// The whole-section fix prompt: one bounded instruction per report section,
// asking for the system rather than the instances (SECUREVIBE-UIUX.md 10.2).

import { describe, expect, it } from 'vitest';
import { buildSectionPrompt } from '@/lib/scanner/section-prompt';
import { voiceViolations } from '@/lib/scanner/voice';

const finding = (over: Partial<Parameters<typeof buildSectionPrompt>[0]['groups'][0]['findings'][0]> = {}) => ({
  title: 'Emoji standing in for interface icons',
  explanation: 'Emoji render differently on every operating system.',
  recommendation: 'Replace each emoji with an icon from one consistent set.',
  filePath: 'app/page.tsx',
  lineStart: 12,
  evidenceMasked: '<span>🚀</span>',
  ...over,
});

describe('buildSectionPrompt', () => {
  it('follows the template: context, numbered tasks, constraints, verify', () => {
    const prompt = buildSectionPrompt({
      section: 'Type & copy',
      hint: 'Deliberate type choices and voice',
      groups: [
        { title: 'Emoji standing in for interface icons', count: 2, findings: [finding(), finding({ lineStart: 40 })] },
        { title: 'Superlative-dense marketing voice', count: 1, findings: [finding({ title: 'Superlative-dense marketing voice', filePath: 'app/hero.tsx', lineStart: 3 })] },
      ],
    });
    expect(prompt).toContain('CONTEXT');
    expect(prompt).toContain('3 findings across 2 signals');
    expect(prompt).toContain('1. Emoji standing in for interface icons (2 occurrences)');
    expect(prompt).toContain('app/page.tsx:12, app/page.tsx:40');
    expect(prompt).toContain('2. Superlative-dense marketing voice');
    expect(prompt).toContain('CONSTRAINTS');
    expect(prompt).toContain('Fix the system, not the instances');
    expect(prompt).toContain('VERIFY');
  });

  it('caps listed locations at three, then counts the rest', () => {
    const many = Array.from({ length: 6 }, (_, i) => finding({ lineStart: i + 1 }));
    const prompt = buildSectionPrompt({
      section: 'Type & copy',
      hint: 'x',
      groups: [{ title: 'Emoji standing in for interface icons', count: 6, findings: many }],
    });
    expect(prompt).toContain('app/page.tsx:1, app/page.tsx:2, app/page.tsx:3 and 3 more occurrences');
    expect(prompt).not.toContain('app/page.tsx:4');
  });

  it('pulls per-rule verify steps and never introduces a tell', () => {
    const prompt = buildSectionPrompt({
      section: 'Type & copy',
      hint: 'x',
      groups: [{ title: 'Emoji standing in for interface icons', count: 1, findings: [finding()] }],
    });
    // The real rule of that title defines its own verify step.
    expect(prompt).toContain('Search UI files for emoji characters');
    expect(prompt).toContain('Do not introduce new tells');
  });

  it('keeps the scaffold in the product voice', () => {
    const prompt = buildSectionPrompt({
      section: 'State coverage',
      hint: 'Empty, loading, error, edge cases',
      groups: [
        {
          title: 'Custom signal',
          count: 1,
          findings: [finding({ title: 'Custom signal', explanation: 'A plain reason.', recommendation: 'A plain fix.' })],
        },
      ],
    });
    expect(voiceViolations(prompt)).toEqual([]);
  });
});
