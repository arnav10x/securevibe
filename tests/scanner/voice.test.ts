// The language filter from SECUREVIBE.md 5.4, enforced as a build gate:
// every user-facing string the scanner ships must pass it. The tool cannot
// flag a superlative it uses itself, and it must never criticize a hue, a
// typeface, or compare a repo to a named company's product.
//
// The structural grader composes its copy from templates plus evidence
// from the scanned page. The templates are what we own, so the suite runs
// the full vibe fixture (every signal firing at once, with neutral
// evidence) and filters every found/why/fix-prompt line it produces.

import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { voiceViolations } from '@/lib/scanner/voice';
import { analyzeFixture } from './helpers';
import { assessSecurity, buildReportCard, verdictFor, vibeVerdict } from '@/lib/scanner/grade';
import { buildFixPrompt } from '@/lib/scanner/fix-prompt';
import { dialectNote } from '@/lib/scanner/uiux/dialect';
import { END_STATE_RULES, scoreBand, percentileLine, percentileFor } from '@/lib/scanner/uiux/score';

const FIXTURES = path.join(__dirname, '..', 'fixtures');

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

describe('every emitted structural finding passes the filter', () => {
  const report = analyzeFixture(path.join(FIXTURES, 'vibe-app'));

  it('the fixture actually exercises the catalog', () => {
    expect(report.findings.length).toBeGreaterThanOrEqual(12);
  });

  for (const field of ['name', 'found', 'why', 'fixPrompt'] as const) {
    it(`filters every finding's ${field}`, () => {
      for (const f of report.findings) {
        // Quoted page evidence is the user's own text, not our voice; the
        // fixture keeps it neutral so template violations still surface.
        expect(voiceViolations(f[field]), `${f.signal} ${field}: ${f[field]}`).toEqual([]);
      }
    });
  }

  it('filters the dialect note, band, and percentile line', () => {
    expect(voiceViolations(report.dialectNote ?? '')).toEqual([]);
    expect(voiceViolations(report.band)).toEqual([]);
    expect(voiceViolations(report.percentileLine)).toEqual([]);
    expect(voiceViolations(dialectNote('B') ?? '')).toEqual([]);
    for (const score of [0, 30, 55, 75, 92]) {
      expect(voiceViolations(scoreBand(score))).toEqual([]);
      expect(voiceViolations(percentileLine(score, percentileFor(score)))).toEqual([]);
    }
  });

  it('filters the professional end state', () => {
    for (const rule of END_STATE_RULES) {
      expect(voiceViolations(rule), rule).toEqual([]);
    }
  });
});

describe('verdict sentences pass the filter', () => {
  it('all paths', () => {
    const secure = assessSecurity([]);
    const report = analyzeFixture(path.join(FIXTURES, 'vibe-app'));
    const notApplicable = { ...report, applicable: false };
    for (const verdict of [
      verdictFor(report, secure, false),
      verdictFor(report, secure, true),
      verdictFor(notApplicable, secure, false),
      verdictFor(report, { ...secure, score: 30 }, false),
    ]) {
      expect(voiceViolations(verdict)).toEqual([]);
    }
    for (const vibe of [0, 30, 60, 90]) {
      expect(voiceViolations(vibeVerdict(vibe))).toEqual([]);
    }
  });

  it('the assembled report card reads clean end to end', () => {
    const structure = analyzeFixture(path.join(FIXTURES, 'vibe-app'));
    const card = buildReportCard([], structure, { codeFilesScanned: 5 });
    expect(voiceViolations(card.verdict)).toEqual([]);
    for (const l of card.limitations) expect(voiceViolations(l)).toEqual([]);
  });
});

describe('security fix prompts', () => {
  it('follow the 4.2 template with context, constraints, and a verify step', () => {
    const prompt = buildFixPrompt({
      title: 'A live key committed to code',
      explanation: 'Anyone reading the repo can bill your account.',
      recommendation: 'Rotate the key and move it to an environment variable.',
      filePath: 'app/config.ts',
      lineStart: 12,
      evidenceMasked: 'const k = "sk_live_**"',
      verify: 'Search the repo for the key prefix. Nothing should match.',
    });
    expect(prompt).toContain('CONTEXT');
    expect(prompt).toContain('app/config.ts (line 12)');
    expect(prompt).toContain('PROBLEM');
    expect(prompt).toContain('TASK');
    expect(prompt).toContain('CONSTRAINTS');
    expect(prompt).toContain('VERIFY');
    expect(prompt).toContain('Search the repo');
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
