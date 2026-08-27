// The language filter from SECUREVIBE.md 5.4, enforced as a build gate:
// every user-facing string the scanner ships must pass it. The tool cannot
// flag a superlative it uses itself, and it must never criticize a hue, a
// typeface, or compare a repo to a named company's product.

import { describe, expect, it } from 'vitest';
import { voiceViolations } from '@/lib/scanner/voice';
import { DESIGN_RULES } from '@/lib/scanner/rules/design-rules';
import { assessCraft, assessSecurity, verdictFor } from '@/lib/scanner/grade';
import { buildFixPrompt } from '@/lib/scanner/fix-prompt';

describe('the filter itself', () => {
  it('passes plain declarative prose', () => {
    expect(voiceViolations('The tap target is 18px inside a 48px row.')).toEqual([]);
  });

  it('catches em-dashes, semicolons, and banned terms', () => {
    expect(voiceViolations('This is bad — fix it')).toContainEqual(
      expect.stringContaining('em-dash'),
    );
    expect(voiceViolations('Do this; then that')).toContainEqual(
      expect.stringContaining('semicolon'),
    );
    expect(voiceViolations('A seamless experience')).toContainEqual(
      expect.stringContaining('seamless'),
    );
  });

  it('catches company-product comparisons', () => {
    expect(voiceViolations('Look at Stripe for reference')).toContainEqual(
      expect.stringContaining('stripe'),
    );
  });

  it('catches sentences over 30 words', () => {
    const long = Array.from({ length: 35 }, (_, i) => `word${i}`).join(' ') + '.';
    expect(voiceViolations(long)).toContainEqual(expect.stringContaining('over 30 words'));
  });
});

describe('every shipped rule passes the filter', () => {
  for (const rule of DESIGN_RULES) {
    it(`${rule.id}`, () => {
      const text = [rule.title, rule.explanation, rule.recommendation, rule.verify ?? ''].join('. ');
      expect(voiceViolations(text)).toEqual([]);
    });
  }
});

describe('verdict sentences pass the filter', () => {
  it('all bands', () => {
    const secure = assessSecurity([]);
    const clean = assessCraft([]);
    for (const verdict of [
      verdictFor(clean, secure, false),
      verdictFor(clean, secure, true),
    ]) {
      expect(voiceViolations(verdict)).toEqual([]);
    }
  });
});

describe('fix prompts', () => {
  it('follow the 4.2 template with context, constraints, and a verify step', () => {
    const prompt = buildFixPrompt({
      title: 'Focus outline removed without a replacement',
      explanation: 'Keyboard users cannot see where they are.',
      recommendation: 'Pair every outline-none with a visible ring.',
      filePath: 'app/page.tsx',
      lineStart: 12,
      evidenceMasked: 'className="outline-none"',
      verify: 'Tab through the page. Focus should be visible on every stop.',
    });
    expect(prompt).toContain('CONTEXT');
    expect(prompt).toContain('app/page.tsx (line 12)');
    expect(prompt).toContain('PROBLEM');
    expect(prompt).toContain('TASK');
    expect(prompt).toContain('CONSTRAINTS');
    expect(prompt).toContain('VERIFY');
    expect(prompt).toContain('Tab through the page');
  });

  it('stays self-contained without a file path', () => {
    const prompt = buildFixPrompt({
      title: 'T',
      explanation: 'E',
      recommendation: 'R',
    });
    expect(prompt).toContain('this project');
    expect(prompt).toContain('VERIFY');
  });
});
