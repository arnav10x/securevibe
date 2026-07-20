// Scans the deliberately vibe-coded fixture app and asserts the design
// audit catches every planted tell — and that the report card grades it
// harshly. The clean fixture must stay clean (no design noise on a repo
// with no UI).

import { beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanDirectory } from '@/lib/scanner';
import type { Finding, ScanResult } from '@/lib/scanner';
import { letterGrade, securityScore } from '@/lib/scanner/grade';
import { fakeRegistryFetch, FIXED_NOW } from './helpers';

const FIXTURE = path.join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../fixtures/vibe-app',
);

let result: ScanResult;
let design: Finding[];

beforeAll(async () => {
  result = await scanDirectory(FIXTURE, {
    fetchImpl: fakeRegistryFetch,
    now: FIXED_NOW,
  });
  design = result.findings.filter((f) => f.checkType === 'design');
});

function findByTitle(fragment: string): Finding | undefined {
  return design.find((f) => f.title.toLowerCase().includes(fragment.toLowerCase()));
}

describe('vibe fixture: the dead giveaways', () => {
  it('spots the classic AI landing-page template', () => {
    const f = findByTitle('landing-page template');
    expect(f).toBeDefined();
    expect(f!.filePath).toBe('app/page.tsx');
    expect(f!.explanation).toContain('FAQ');
  });

  it('spots the purple gradient and gradient text', () => {
    expect(findByTitle('purple-gradient')).toBeDefined();
    expect(findByTitle('Gradient text')).toBeDefined();
  });

  it('spots the neon glow orb', () => {
    expect(findByTitle('glow')).toBeDefined();
  });

  it('spots emoji used as interface graphics', () => {
    expect(findByTitle('Emoji')).toBeDefined();
  });

  it('spots the fake user-count claim', () => {
    expect(findByTitle('user-count')).toBeDefined();
  });

  it('spots hardcoded testimonials and placeholder avatars', () => {
    expect(findByTitle('testimonial')).toBeDefined();
    expect(findByTitle('Placeholder image')).toBeDefined();
  });

  it('spots the stock statistics (99.9%, 24/7, 4.9/5)', () => {
    expect(findByTitle('credibility statistics')).toBeDefined();
  });

  it('spots the scaffold title still shipping', () => {
    expect(findByTitle('Scaffold title')).toBeDefined();
  });

  it('spots the placeholder legal page', () => {
    const f = findByTitle('legal');
    expect(f).toBeDefined();
    expect(f!.filePath).toBe('app/privacy/page.tsx');
  });

  it('spots the login form that does not authenticate', () => {
    const f = findByTitle('does not authenticate');
    expect(f).toBeDefined();
    expect(f!.filePath).toBe('app/login/page.tsx');
  });

  it('spots the pricing table with no payment rail', () => {
    expect(findByTitle('no way to pay')).toBeDefined();
  });

  it('spots links to routes that do not exist', () => {
    const f = findByTitle('pages that do not exist');
    expect(f).toBeDefined();
    expect(f!.explanation).toContain('/blog');
    expect(f!.explanation).toContain('/careers');
  });

  it('spots the setTimeout-faked backend and the coming-soon alert', () => {
    expect(findByTitle('Fake loading state')).toBeDefined();
    expect(findByTitle('Coming soon')).toBeDefined();
  });

  it('spots dead links and social stubs', () => {
    expect(findByTitle('goes nowhere')).toBeDefined();
    expect(findByTitle('platform homepage')).toBeDefined();
  });

  it('spots leftover starter assets and the template README', () => {
    expect(findByTitle('Starter-kit assets')).toBeDefined();
    expect(findByTitle('README')).toBeDefined();
  });

  it('spots the AI placeholder comment in the login page', () => {
    expect(findByTitle('placeholder comment')).toBeDefined();
  });
});

describe('vibe fixture: professional-standard rules', () => {
  it('flags four typefaces as a font zoo', () => {
    expect(findByTitle('typefaces')).toBeDefined();
  });

  it('flags zero responsive breakpoints', () => {
    expect(findByTitle('responsive breakpoints')).toBeDefined();
  });

  it('flags disabled pinch-zoom (WCAG 1.4.4)', () => {
    expect(findByTitle('Pinch-zoom')).toBeDefined();
  });

  it('flags the missing html lang attribute', () => {
    expect(findByTitle('language never declared')).toBeDefined();
  });

  it('flags images without alt text', () => {
    expect(findByTitle('without alt')).toBeDefined();
  });

  it('flags the click handler on a plain div', () => {
    expect(findByTitle('non-interactive element')).toBeDefined();
  });

  it('flags low-contrast text pairs', () => {
    expect(findByTitle('Low-contrast')).toBeDefined();
  });

  it('flags lorem ipsum and the generic Submit button', () => {
    expect(findByTitle('Lorem ipsum')).toBeDefined();
    expect(findByTitle('Generic button')).toBeDefined();
  });
});

describe('vibe fixture: the report card', () => {
  it('exists and grades this repo poorly', () => {
    const card = result.stats.report!;
    expect(card).toBeDefined();
    expect(card.designScore).toBeLessThan(50);
    expect(card.vibeScore).toBeGreaterThan(70);
    expect(['D+', 'D', 'D-', 'F']).toContain(card.grade);
  });

  it('scores all eight categories, worst first', () => {
    const card = result.stats.report!;
    expect(card.categories).toHaveLength(8);
    const scores = card.categories.map((c) => c.score);
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
  });

  it('files every design finding under the design check type', () => {
    expect(design.length).toBeGreaterThan(20);
    for (const f of design) {
      expect(f.severity).not.toBe('critical'); // critical is reserved for security
      expect(f.recommendation.length).toBeGreaterThan(20);
    }
  });
});

describe('grading arithmetic', () => {
  it('maps scores to the school scale', () => {
    expect(letterGrade(100)).toBe('A+');
    expect(letterGrade(95)).toBe('A');
    expect(letterGrade(85)).toBe('B');
    expect(letterGrade(70)).toBe('C-');
    expect(letterGrade(59)).toBe('F');
  });

  it('weights security findings by severity', () => {
    const finding = (severity: Finding['severity']): Finding => ({
      checkType: 'secret',
      severity,
      title: 't',
      explanation: 'e',
      recommendation: 'r',
    });
    expect(securityScore([])).toBe(100);
    expect(securityScore([finding('critical')])).toBe(78);
    expect(securityScore([finding('low')])).toBe(99);
  });
});

describe('clean fixture stays clean', () => {
  it('produces no design findings and a perfect design score', async () => {
    const clean = await scanDirectory(
      path.join(fileURLToPath(new URL('.', import.meta.url)), '../fixtures/clean-app'),
      { fetchImpl: fakeRegistryFetch, now: FIXED_NOW },
    );
    expect(clean.findings.filter((f) => f.checkType === 'design')).toHaveLength(0);
    expect(clean.stats.report!.designScore).toBe(100);
    expect(clean.stats.report!.vibeScore).toBe(0);
  });
});
