// The validation direction from SECUREVIBE-GRADING.md section 8: the
// template fixture must score low and lose its points on structure, the
// professional fixture must score high, and repos with no marketing page
// must not be graded at all. These are the acceptance tests for the
// whole grader; the per-signal detail lives in uiux-signals.test.ts.

import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeFixture, analyzeFiles } from './helpers';

const FIXTURES = path.join(__dirname, '..', 'fixtures');

describe('the vibe-coded fixture (every signal at once)', () => {
  const report = analyzeFixture(path.join(FIXTURES, 'vibe-app'));

  it('is graded, and graded low', () => {
    expect(report.applicable).toBe(true);
    expect(report.pageFile).toBe('app/page.tsx');
    expect(report.score).toBeLessThanOrEqual(25);
  });

  it('finds the template script in canonical order', () => {
    expect(report.scriptMatch.matched).toBeGreaterThanOrEqual(7);
    const script = report.findings.find((f) => f.signal === 'template-script');
    expect(script?.points).toBe(10);
  });

  it('fires the structural signals, not media or color alone', () => {
    const signals = report.findings.map((f) => f.signal);
    for (const expected of [
      'content-as-data',
      'eyebrow-labels',
      'numbered-decor',
      'copy-fingerprints',
      'one-liner-restatement',
      'social-proof',
      'dead-links',
      'stale-copyright',
      'phantom-routes',
      'stat-strip',
      'div-mock-hero',
      'cta-repetition',
      'emoji-icons',
      'feature-grid-uniformity',
      'template-script',
    ]) {
      expect(signals, `expected signal ${expected}`).toContain(expected);
    }
  });

  it('classifies the SaaS dialect and prices the model hexes only with structure', () => {
    expect(report.dialect).toBe('A');
    expect(report.dialectNote).toContain('Dialect A');
    expect(report.dialectNote).toContain('fewer than 5 points');
  });

  it('orders findings by points, largest first', () => {
    const points = report.findings.map((f) => f.points);
    expect([...points].sort((a, b) => b - a)).toEqual(points);
  });

  it('caps content-as-data at 20 and applies per-signal weights', () => {
    const cad = report.findings.find((f) => f.signal === 'content-as-data')!;
    expect(cad.points).toBeGreaterThanOrEqual(4);
    expect(cad.points).toBeLessThanOrEqual(20);
    const eyebrows = report.findings.find((f) => f.signal === 'eyebrow-labels')!;
    expect(eyebrows.points).toBe(10);
  });

  it('every finding carries the four report fields, filled', () => {
    for (const f of report.findings) {
      expect(f.name.length).toBeGreaterThan(3);
      expect(f.found.length).toBeGreaterThan(10);
      expect(f.why.length).toBeGreaterThan(10);
      expect(f.fixPrompt.length).toBeGreaterThan(20);
      expect(f.points).toBeGreaterThan(0);
    }
  });

  it('keeps every fix prompt under 120 words (section 9)', () => {
    for (const f of report.findings) {
      const words = f.fixPrompt.split(/\s+/).filter(Boolean).length;
      expect(words, `${f.signal} prompt has ${words} words`).toBeLessThanOrEqual(120);
    }
  });

  it('fix prompts never suggest a color, font, or gradient change', () => {
    for (const f of report.findings) {
      if (f.signal === 'dialect-hex') continue; // that one names color to forbid it
      expect(f.fixPrompt).not.toMatch(/\b(?:color|colour|font|gradient|palette)\b/i);
    }
  });
});

describe('the professional fixture (section 7 properties)', () => {
  const report = analyzeFixture(path.join(FIXTURES, 'pro-app'));

  it('is graded, and graded high', () => {
    expect(report.applicable).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(85);
  });

  it('does not match the template script', () => {
    const script = report.findings.find((f) => f.signal === 'template-script');
    expect(script).toBeUndefined();
  });

  it('fires none of the heavyweight signals', () => {
    const signals = report.findings.map((f) => f.signal);
    for (const banned of [
      'content-as-data', 'eyebrow-labels', 'numbered-decor', 'social-proof',
      'dead-links', 'phantom-routes', 'no-real-media', 'div-mock-hero',
      'emoji-icons', 'stat-strip',
    ]) {
      expect(signals, `signal ${banned} must not fire`).not.toContain(banned);
    }
  });
});

describe('repos that are not landing pages are not graded', () => {
  it('declines a docs-only repo', () => {
    const report = analyzeFiles({
      'README.md': '# docs',
      'docs/guide.html': '<html><body><h2>Guide</h2><p>Steps.</p></body></html>',
    });
    expect(report.applicable).toBe(false);
    expect(report.notApplicableReason).toMatch(/marketing page/i);
    expect(report.findings).toHaveLength(0);
  });

  it('declines a dashboard app (sidebar chrome, no landing h1)', () => {
    const report = analyzeFiles({
      'app/page.tsx': `
        export default function Dashboard() {
          return (
            <div>
              <aside className="sidebar">
                <a href="/a">A</a><a href="/b">B</a><a href="/c">C</a>
                <a href="/d">D</a><a href="/e">E</a>
              </aside>
              <main>
                <h1>Orders</h1>
                <table><tbody><tr><td>1</td></tr></tbody></table>
                <button>Export</button>
              </main>
            </div>
          );
        }`,
    });
    expect(report.applicable).toBe(false);
  });

  it('declines a Vite mount shell', () => {
    const report = analyzeFiles({
      'index.html':
        '<!doctype html><html><head><title>x</title></head><body><div id="root"></div><script src="/src/main.tsx"></script></body></html>',
    });
    expect(report.applicable).toBe(false);
  });
});

describe('scoring arithmetic', () => {
  it('starts at 100, subtracts, floors at 0', () => {
    const vibe = analyzeFixture(path.join(FIXTURES, 'vibe-app'));
    const total = vibe.findings.reduce((s, f) => s + f.points, 0);
    expect(vibe.score).toBe(Math.max(0, 100 - total));
  });

  it('reports the percentile against the named sample', () => {
    const vibe = analyzeFixture(path.join(FIXTURES, 'vibe-app'));
    expect(vibe.percentileLine).toContain(`Score ${vibe.score}.`);
    expect(vibe.percentile.sampleSize).toBeGreaterThan(0);
    expect(vibe.percentile.topPercent).toBeGreaterThanOrEqual(90);
  });
});
