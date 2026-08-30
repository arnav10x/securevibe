// Per-signal tests for the SECUREVIBE-GRADING.md catalog, each pinned in
// both directions: the signal fires on the pattern, and the section 8
// false-positive guards keep it quiet on the legitimate cousin. Precision
// that costs recall is not precision, and the reverse holds too.

import { describe, expect, it } from 'vitest';
import { analyzeFiles } from './helpers';
import { scriptLcs } from '@/lib/scanner/uiux/page';

/** A minimal page that passes the marketing guard, with `body` injected. */
function page(body: string, extra: Record<string, string> = {}) {
  return analyzeFiles({
    'app/page.tsx': `
      export default function Home() {
        return (
          <div>
            <header>
              <h1>Ship broken counts to zero</h1>
              <p>Counter reconciles the numbers your team argues about.</p>
              <a href="/pricing">Start a pilot</a>
            </header>
            ${body}
            <footer><a href="/pricing">Pricing</a><p>© 2026 Counter</p></footer>
          </div>
        );
      }`,
    'app/pricing/page.tsx': 'export default function P() { return <h1>Pricing</h1>; }',
    'public/images/product-shot-main.png': '',
    'public/images/team-photo-real.jpg': '',
    'public/images/office-visit.webp': '',
    ...extra,
  });
}

const signals = (r: ReturnType<typeof analyzeFiles>) => r.findings.map((f) => f.signal);
const find = (r: ReturnType<typeof analyzeFiles>, s: string) =>
  r.findings.find((f) => f.signal === s);

describe('3.1 content-as-data arrays', () => {
  it('fires on a section mapped over uniform objects', () => {
    const r = page(`
      <section>
        <h2>What you get</h2>
        <div className="grid">{features.map((f) => <div key={f.title}><h3>{f.title}</h3><p>{f.text}</p></div>)}</div>
      </section>`, {
      'app/data.ts': '',
    });
    // The array lives in the page component's own file for resolution.
    const r2 = analyzeFiles({
      'app/page.tsx': `
        const features = [
          { title: 'A', text: 'aaa' },
          { title: 'B', text: 'bbb' },
          { title: 'C', text: 'ccc' },
        ];
        export default function Home() {
          return (
            <div>
              <header><h1>H</h1><p>Sub</p><a href="/x">Go</a></header>
              <section><h2>What you get</h2>
                <div className="grid">{features.map((f) => <div key={f.title}><h3>{f.title}</h3><p>{f.text}</p></div>)}</div>
              </section>
            </div>
          );
        }`,
    });
    expect(signals(r2)).toContain('content-as-data');
    expect(find(r2, 'content-as-data')!.points).toBe(4);
    void r;
  });

  it('does not count footer link columns as content sections', () => {
    const r = analyzeFiles({
      'app/page.tsx': `
        const columns = [
          { title: 'Product', href: '/pricing' },
          { title: 'Company', href: '/about' },
          { title: 'Legal', href: '/terms' },
        ];
        export default function Home() {
          return (
            <div>
              <header><h1>H</h1><p>Sub</p><a href="/pricing">Go</a></header>
              <section><h2>One thing, laid out by hand.</h2><p>Prose.</p></section>
              <footer>{columns.map((c) => <a key={c.title} href={c.href}>{c.title}</a>)}</footer>
            </div>
          );
        }`,
      'app/pricing/page.tsx': 'export default function P() { return <h1>P</h1>; }',
      'app/about/page.tsx': 'export default function A() { return <h1>A</h1>; }',
      'app/terms/page.tsx': 'export default function T() { return <h1>T</h1>; }',
    });
    expect(signals(r)).not.toContain('content-as-data');
  });
});

describe('3.2 eyebrow labels', () => {
  const eyebrowed = (n: number, total: number) => {
    const sections = Array.from({ length: total }, (_, i) => `
      <section>
        ${i < n ? `<p className="text-xs uppercase tracking-widest">Label ${i}</p>` : ''}
        <h2>Heading number ${i} carries meaning</h2>
        <p>Body copy for the section.</p>
      </section>`).join('\n');
    return page(sections);
  };

  it('deducts 10 above half, 5 above a quarter', () => {
    expect(find(eyebrowed(3, 4), 'eyebrow-labels')!.points).toBe(10);
    expect(find(eyebrowed(2, 6), 'eyebrow-labels')!.points).toBe(5);
  });

  it('stays quiet below the quarter ratio', () => {
    expect(find(eyebrowed(1, 6), 'eyebrow-labels')).toBeUndefined();
  });

  it('excludes breadcrumbs and date stamps', () => {
    const r = page(`
      <section>
        <nav aria-label="breadcrumb"><span className="text-xs uppercase">Home / Docs</span></nav>
        <h2>Docs</h2>
      </section>
      <section>
        <p className="text-xs uppercase tracking-wide">March 2026</p>
        <h2>Changelog entry</h2>
      </section>`);
    expect(find(r, 'eyebrow-labels')).toBeUndefined();
  });
});

describe('3.3 zero-padded counters', () => {
  it('fires on decorative 01 02 03 text', () => {
    const r = page(`
      <section>
        <h2>Our approach</h2>
        <div><span>01</span><h3>Listen</h3></div>
        <div><span>02</span><h3>Build</h3></div>
        <div><span>03</span><h3>Ship</h3></div>
      </section>`);
    expect(find(r, 'numbered-decor')!.points).toBe(8);
  });

  it('leaves plain-digit setup steps alone (section 8 guard)', () => {
    const r = page(`
      <section>
        <h2>Install the CLI</h2>
        <ol>
          <li><h3>1. Install the package</h3><code>npm i counter</code></li>
          <li><h3>2. Add your key</h3><code>counter login</code></li>
          <li><h3>3. Run the first sync</h3><code>counter sync</code></li>
        </ol>
      </section>`);
    expect(find(r, 'numbered-decor')).toBeUndefined();
  });
});

describe('3.4 copy fingerprints and negation headings', () => {
  it('prices each distinct stock phrase at 2, capped at 10', () => {
    const r = page(`
      <section>
        <h2>Simple, transparent pricing</h2>
        <p>No credit card required. 14-day free trial.</p>
        <p>Trusted by teams.</p>
        <h2>How it works</h2>
        <h2>Why choose us</h2>
        <h2>Frequently Asked Questions</h2>
      </section>`);
    expect(find(r, 'copy-fingerprints')!.points).toBe(10);
  });

  it('flags two or more negation-defined headings', () => {
    const r = page(`
      <section><h2>A finding is not a verdict</h2><p>x</p></section>
      <section><h2>A computer, not a sandbox</h2><p>x</p></section>`);
    expect(find(r, 'negation-headings')!.points).toBe(3);
  });

  it('allows one negation heading', () => {
    const r = page('<section><h2>A finding is not a verdict</h2><p>x</p></section>');
    expect(find(r, 'negation-headings')).toBeUndefined();
  });
});

describe('3.5 one-liner restatement', () => {
  it('counts near-duplicate pairs across the four slots', () => {
    const r = analyzeFiles({
      'app/layout.tsx': `
        export const metadata = { description: 'Acme reconciles warehouse counts automatically for your team.' };
        export default function L({ children }) { return <html lang="en"><body>{children}</body></html>; }`,
      'app/page.tsx': `
        export default function Home() {
          return (
            <div>
              <header><h1>H</h1>
                <p>Acme reconciles warehouse counts automatically for your team, every day.</p>
                <a href="/x">Go</a>
              </header>
              <section><h2>Ready to start?</h2>
                <p>Acme reconciles warehouse counts automatically for your team.</p>
                <a href="/x">Go now</a>
              </section>
              <footer><p>Acme reconciles warehouse counts automatically for your team.</p></footer>
            </div>
          );
        }`,
    });
    const f = find(r, 'one-liner-restatement')!;
    expect(f.points).toBe(9); // capped
  });

  it('stays quiet when each slot says something new', () => {
    const r = page('<section><h2>Something else entirely</h2><p>Different words here about reconciliation quality.</p></section>');
    expect(find(r, 'one-liner-restatement')).toBeUndefined();
  });
});

describe('3.6 social proof structure', () => {
  const testimonialPage = (count: number) => analyzeFiles({
    'app/page.tsx': `
      const testimonials = [${Array.from({ length: count }, (_, i) => `
        { quote: 'Great tool for our team. It saves hours.', name: 'Person ${i}', initials: 'P${i}', rating: 5 },`).join('')}
      ];
      export default function Home() {
        return (
          <div>
            <header><h1>H</h1><p>Sub</p><a href="/x">Go</a></header>
            <section><h2>Loved by teams</h2>
              {testimonials.map((t) => <div key={t.name}><p>{t.quote}</p><span>{t.initials}</span></div>)}
            </section>
          </div>
        );
      }`,
  });

  it('prices initials avatars, missing links, flat ratings, equal quotes', () => {
    const f = find(testimonialPage(3), 'social-proof')!;
    // 6 (initials) + 4 (no links) + 3 (all five stars) + 3 (same length) = 16
    expect(f.points).toBe(16);
  });

  it('scales down when there are fewer than three testimonials', () => {
    const f = find(testimonialPage(2), 'social-proof')!;
    expect(f.points).toBeLessThan(16);
  });

  it('needs at least two testimonials to read a pattern at all', () => {
    expect(find(testimonialPage(1), 'social-proof')).toBeUndefined();
  });

  it('accepts sourced testimonials with headshots and links', () => {
    const r = analyzeFiles({
      'app/page.tsx': `
        const testimonials = [
          { quote: 'It works. We measured it twice and the drift was gone within a week.', name: 'A', image: '/images/a.jpg', url: 'https://example.com/case-study' },
          { quote: 'Short one.', name: 'B', image: '/images/b.jpg', url: 'https://example.com/tweet' },
          { quote: 'Three sentences here. Really three. Yes.', name: 'C', image: '/images/c.jpg', url: 'https://example.com/review' },
        ];
        export default function Home() {
          return (
            <div>
              <header><h1>H</h1><p>Sub</p><a href="/x">Go</a></header>
              <section><h2>Customers</h2>
                {testimonials.map((t) => <div key={t.name}><img src={t.image} alt={t.name} /><a href={t.url}>{t.quote}</a></div>)}
              </section>
            </div>
          );
        }`,
      'public/images/a.jpg': '',
      'public/images/b.jpg': '',
      'public/images/c.jpg': '',
    });
    expect(find(r, 'social-proof')).toBeUndefined();
  });

  it('flags a logo cloud of bare strings', () => {
    const r = analyzeFiles({
      'app/page.tsx': `
        const logos = ['Vercafe', 'Loomly', 'Zapster', 'Notionly'];
        export default function Home() {
          return (
            <div>
              <header><h1>H</h1><p>Sub</p><a href="/x">Go</a></header>
              <section><p>Trusted by</p>{logos.map((l) => <span key={l}>{l}</span>)}</section>
            </div>
          );
        }`,
    });
    expect(find(r, 'social-proof')!.points).toBeGreaterThanOrEqual(4);
  });
});

describe('3.7 placeholder residue', () => {
  it('prices dead links at 2 each, capped at 10', () => {
    const r = page(`
      <section>
        <h2>Find us</h2>
        <a href="#">Twitter</a><a href="#">LinkedIn</a><a href="#">GitHub</a>
      </section>`);
    expect(find(r, 'dead-links')!.points).toBe(6);
  });

  it('flags leaked test strings at 5', () => {
    const r = page('<section><h2>Cases Section Test</h2><p>Lorem ipsum dolor sit amet.</p></section>');
    expect(find(r, 'leaked-placeholder')!.points).toBe(10);
  });

  it('flags a copyright two calendar years stale', () => {
    const r = analyzeFiles({
      'app/page.tsx': `
        export default function Home() {
          return (
            <div>
              <header><h1>H</h1><p>Sub</p><a href="/x">Go</a></header>
              <footer><p>© 2024 Counter Inc.</p></footer>
            </div>
          );
        }`,
    });
    expect(find(r, 'stale-copyright')!.points).toBe(3);
  });

  it('accepts last year (a January scan must not cry wolf)', () => {
    const r = analyzeFiles({
      'app/page.tsx': `
        export default function Home() {
          return (
            <div>
              <header><h1>H</h1><p>Sub</p><a href="/x">Go</a></header>
              <footer><p>Established 2020. © 2025 Counter Inc.</p></footer>
            </div>
          );
        }`,
    });
    expect(find(r, 'stale-copyright')).toBeUndefined();
  });

  it('flags nav links to routes that do not exist', () => {
    const r = page(`
      <section>
        <h2>More</h2>
        <a href="/blog">Blog</a><a href="/careers">Careers</a><a href="/docs">Docs</a>
      </section>`);
    expect(find(r, 'phantom-routes')!.points).toBe(9);
  });

  it('does not guess routes when a client router owns them', () => {
    const r = analyzeFiles({
      'src/App.tsx': `
        import { Route } from 'react-router-dom';
        export default function App() {
          return (
            <div>
              <header><h1>H</h1><p>Sub</p><a href="/pricing">Go</a></header>
              <section><h2>More</h2><a href="/blog">Blog</a><a href="/careers">Careers</a></section>
            </div>
          );
        }`,
    });
    expect(find(r, 'phantom-routes')).toBeUndefined();
  });
});

describe('3.8 stat strips', () => {
  it('prices an unsourced all-round strip at 8', () => {
    const r = analyzeFiles({
      'app/page.tsx': `
        const stats = [
          { value: '100+', label: 'Happy clients' },
          { value: '4.9', label: 'Rating' },
          { value: '50+', label: 'Countries' },
        ];
        export default function Home() {
          return (
            <div>
              <header><h1>H</h1><p>Sub</p><a href="/x">Go</a></header>
              <section>{stats.map((s) => <div key={s.label}><p>{s.value}</p><p>{s.label}</p></div>)}</section>
            </div>
          );
        }`,
    });
    expect(find(r, 'stat-strip')!.points).toBe(8);
  });

  it('accepts a strip whose numbers link to their sources', () => {
    const r = analyzeFiles({
      'app/page.tsx': `
        export default function Home() {
          return (
            <div>
              <header><h1>H</h1><p>Sub</p><a href="/x">Go</a></header>
              <section>
                <div><p>99.997%</p><a href="https://status.example.com">uptime, live status</a></div>
                <div><p>1,214</p><a href="/customers">warehouses, listed</a></div>
                <div><p>11 weeks</p><a href="/customers/ferro">to 99.2% at Ferro</a></div>
              </section>
            </div>
          );
        }`,
      'app/customers/page.tsx': 'export default function C() { return <h1>C</h1>; }',
    });
    expect(find(r, 'stat-strip')).toBeUndefined();
  });
});

describe('3.9 screenshots built from divs', () => {
  it('flags a media-free marketing repo', () => {
    const r = analyzeFiles({
      'app/page.tsx': `
        export default function Home() {
          return (
            <div>
              <header><h1>H</h1><p>Sub</p><a href="/x">Go</a></header>
              <section><h2>The product</h2><p>Imagine it.</p></section>
            </div>
          );
        }`,
    });
    expect(find(r, 'no-real-media')!.points).toBe(10);
  });

  it('accepts remote product imagery it cannot audit', () => {
    const r = analyzeFiles({
      'app/page.tsx': `
        export default function Home() {
          return (
            <div>
              <header><h1>H</h1><p>Sub</p><a href="/x">Go</a>
                <img src="https://cdn.example.com/shot1.png" alt="Orders view" />
                <img src="https://cdn.example.com/shot2.png" alt="Queue view" />
                <img src="https://cdn.example.com/shot3.png" alt="Audit view" />
              </header>
            </div>
          );
        }`,
    });
    expect(find(r, 'no-real-media')).toBeUndefined();
  });

  it('flags the hero panel drawn from divs with invented data', () => {
    const r = analyzeFiles({
      'app/page.tsx': `
        export default function Home() {
          return (
            <div>
              <header>
                <h1>H</h1><p>Sub</p><a href="/x">Go</a>
                <div className="rounded-2xl border shadow">
                  <div className="rounded border p-4"><p>Invoice Paid</p><p>+$2,400.00</p></div>
                  <div className="rounded border p-4"><p>Scope Guard</p><p>Active</p></div>
                  <div className="rounded border p-4"><p>Deploys</p><p>Just now</p></div>
                </div>
              </header>
            </div>
          );
        }`,
      'public/images/real-photo-one.png': '',
      'public/images/real-photo-two.png': '',
      'public/images/real-photo-three.png': '',
    });
    expect(find(r, 'div-mock-hero')!.points).toBe(6);
  });
});

describe('3.10 CTA repetition', () => {
  it('flags one action label doing every job', () => {
    const r = page(`
      <section><h2>One</h2><a href="/pricing">Get started</a></section>
      <section><h2>Two</h2><a href="/pricing">Get started</a></section>
      <section><h2>Three</h2><a href="/pricing">Get started</a></section>`);
    expect(find(r, 'cta-repetition')!.points).toBeGreaterThanOrEqual(4);
  });

  it('does not count repeated nav labels as CTAs', () => {
    const r = page(`
      <section><h2>One</h2><a href="/pricing">Pricing</a></section>
      <section><h2>Two</h2><a href="/pricing">Pricing</a></section>
      <section><h2>Three</h2><a href="/pricing">Pricing</a></section>`);
    expect(find(r, 'cta-repetition')).toBeUndefined();
  });
});

describe('3.11 route depth', () => {
  it('flags a single route behind an anchor-link nav', () => {
    const r = analyzeFiles({
      'app/page.tsx': `
        export default function Home() {
          return (
            <div>
              <nav><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></nav>
              <header><h1>H</h1><p>Sub</p><a href="#pricing">Go</a></header>
              <section id="features"><h2>Features</h2></section>
            </div>
          );
        }`,
    });
    expect(find(r, 'route-depth')!.points).toBe(6);
  });

  it('accepts a real multi-page site', () => {
    const r = page('<section><h2>Fine</h2><p>Content.</p></section>');
    expect(find(r, 'route-depth')).toBeUndefined();
  });
});

describe('3.12 emoji and icon grids', () => {
  it('flags emoji standing in for icons', () => {
    const r = page(`
      <section>
        <h2>Features</h2>
        <div><span>⚡</span><h3>Fast</h3></div>
        <div><span>🔒</span><h3>Secure</h3></div>
        <div><span>🚀</span><h3>Scalable</h3></div>
      </section>`);
    expect(find(r, 'emoji-icons')!.points).toBe(6);
  });

  it('flags the icon-in-rounded-square grid', () => {
    const r = analyzeFiles({
      'app/page.tsx': `
        import { Zap, Lock, Rocket } from 'lucide-react';
        export default function Home() {
          return (
            <div>
              <header><h1>H</h1><p>Sub</p><a href="/x">Go</a></header>
              <section>
                <h2>Features</h2>
                <div className="rounded-xl w-12 h-12"><Zap /></div>
                <div className="rounded-xl w-12 h-12"><Lock /></div>
                <div className="rounded-xl w-12 h-12"><Rocket /></div>
              </section>
            </div>
          );
        }`,
    });
    expect(find(r, 'icon-grid')!.points).toBe(4);
  });
});

describe('3.13 feature grid uniformity', () => {
  it('prices each uniform six-card grid at 5', () => {
    const r = analyzeFiles({
      'app/page.tsx': `
        const features = [
          { title: 'A', text: 'a' }, { title: 'B', text: 'b' }, { title: 'C', text: 'c' },
          { title: 'D', text: 'd' }, { title: 'E', text: 'e' }, { title: 'F', text: 'f' },
        ];
        export default function Home() {
          return (
            <div>
              <header><h1>H</h1><p>Sub</p><a href="/x">Go</a></header>
              <section><h2>Features</h2>
                <div className="grid grid-cols-3">{features.map((f) => <div key={f.title}><h3>{f.title}</h3></div>)}</div>
              </section>
            </div>
          );
        }`,
    });
    expect(find(r, 'feature-grid-uniformity')!.points).toBe(5);
  });
});

describe('the template script LCS (section 2)', () => {
  it('measures in-order matches, ignoring skips', () => {
    expect(scriptLcs(['hero', 'stats', 'features', 'faq', 'footer'])).toBe(5);
    expect(scriptLcs(['hero', 'footer'])).toBe(2);
    expect(scriptLcs([])).toBe(0);
  });

  it('does not credit out-of-order sections', () => {
    expect(scriptLcs(['footer', 'faq', 'pricing', 'features', 'hero'])).toBe(1);
  });
});

describe('section 4: dialect membership is reported, never deducted', () => {
  it('names dialect B without charging for the palette alone', () => {
    const r = analyzeFiles({
      'app/page.tsx': `
        export default function Home() {
          return (
            <div>
              <header>
                <h1 className="font-serif">A <span className="font-serif italic">calmer</span> ledger</h1>
                <p>Editorial brands are allowed to exist.</p>
                <a href="/pricing">Start</a>
              </header>
              <section><h2>Hand-laid, specific, sourced.</h2>
                <p className="font-mono uppercase">Ref 11-B</p>
                <p className="font-mono uppercase">Ref 12-C</p>
                <p className="font-mono uppercase">Ref 14-A</p>
              </section>
            </div>
          );
        }`,
      'app/pricing/page.tsx': 'export default function P() { return <h1>P</h1>; }',
      'app/globals.css': 'body { background: #f4f0e7; }',
      'public/images/press-photo-one.jpg': '',
      'public/images/press-photo-two.jpg': '',
      'public/images/press-photo-three.jpg': '',
    });
    expect(r.dialect).toBe('B');
    // The model hex is present, but with fewer than two structural
    // signals it costs nothing: color never lowers the score on its own.
    expect(find(r, 'dialect-hex')).toBeUndefined();
  });

  it('charges the model hex 3 points only alongside structure', () => {
    const r = analyzeFiles({
      'app/page.tsx': `
        const features = [
          { title: 'A', text: 'a' }, { title: 'B', text: 'b' },
          { title: 'C', text: 'c' }, { title: 'D', text: 'd' },
        ];
        export default function Home() {
          return (
            <div>
              <header><h1>H</h1><p>Sub</p><a href="#x">Go</a>
                <p className="text-xs uppercase tracking-widest">The platform</p>
              </header>
              <section>
                <p className="text-xs uppercase tracking-widest">Features</p>
                <h2>Everything you need</h2>
                {features.map((f) => <div key={f.title}><h3>{f.title}</h3></div>)}
              </section>
            </div>
          );
        }`,
      'app/globals.css': ':root { --bg: #f4f0e7; }',
    });
    expect(find(r, 'dialect-hex')?.points).toBe(3);
  });
});
