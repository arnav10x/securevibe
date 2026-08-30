// Parser units for the structural grader: the JSX reader (TypeScript
// compiler API) and the small HTML parser both produce the same element
// tree, and the constructs the grader depends on — mapped arrays,
// conditional branches, component resolution — are made explicit.

import { describe, expect, it } from 'vitest';
import { parseJsxSource } from '@/lib/scanner/uiux/parse-jsx';
import { parseHtml } from '@/lib/scanner/uiux/parse-html';
import { childEls, findAll, findEl, textOf } from '@/lib/scanner/uiux/model';
import { Repo, analyzePage } from '@/lib/scanner/uiux/page';

describe('parseJsxSource', () => {
  it('reads components, attributes, classes, and text', () => {
    const parsed = parseJsxSource(
      'app/page.tsx',
      `export default function Home() {
        return (
          <main className="dark wide">
            <h1 id="top">Hello there</h1>
            <a href="/pricing">Rates</a>
          </main>
        );
      }`,
    );
    const root = parsed.components.get('Home')![0];
    expect(root.tag).toBe('main');
    expect(root.classes).toEqual(['dark', 'wide']);
    const h1 = findEl([root], (e) => e.tag === 'h1')!;
    expect(h1.attrs.id).toBe('top');
    expect(textOf(h1)).toBe('Hello there');
    expect(findEl([root], (e) => e.tag === 'a')!.attrs.href).toBe('/pricing');
    expect(parsed.defaultExport).toBe('Home');
  });

  it('turns {arr.map(...)} into a #map element with the array resolved', () => {
    const parsed = parseJsxSource(
      'app/page.tsx',
      `const cards = [
        { title: 'A', body: 'one' },
        { title: 'B', body: 'two' },
        { title: 'C', body: 'three' },
      ];
      export default function Home() {
        return <section>{cards.map((c) => <article key={c.title}><h3>{c.title}</h3></article>)}</section>;
      }`,
    );
    const root = parsed.components.get('Home')![0];
    const map = findEl([root], (e) => e.tag === '#map')!;
    expect(map.map!.arrayName).toBe('cards');
    expect(map.map!.length).toBe(3);
    expect(map.map!.keys).toEqual(['body', 'title']);
    expect(map.map!.item?.tag).toBe('article');
  });

  it('keeps both branches of conditional renders', () => {
    const parsed = parseJsxSource(
      'app/page.tsx',
      `export default function Home() {
        return (
          <div>
            {true && <p>gated</p>}
            {1 ? <span>yes</span> : <em>no</em>}
          </div>
        );
      }`,
    );
    const root = parsed.components.get('Home')![0];
    expect(findEl([root], (e) => e.tag === 'p')).not.toBeNull();
    expect(findEl([root], (e) => e.tag === 'span')).not.toBeNull();
    expect(findEl([root], (e) => e.tag === 'em')).not.toBeNull();
  });

  it('collects string arrays, uniform keys, and metadata description', () => {
    const parsed = parseJsxSource(
      'app/layout.tsx',
      `export const metadata = { title: 'X', description: 'The one-liner.' };
      const logos = ['Acme', 'Globex', 'Initech'];
      const tiers = [
        { name: 'Free', price: 0 },
        { name: 'Pro', price: 29, badge: 'Popular' },
      ];`,
    );
    expect(parsed.metaDescription).toBe('The one-liner.');
    const logos = parsed.arrays.find((a) => a.name === 'logos')!;
    expect(logos.ofStrings).toBe(true);
    expect(logos.items.map((i) => i.value)).toEqual(['Acme', 'Globex', 'Initech']);
    const tiers = parsed.arrays.find((a) => a.name === 'tiers')!;
    expect(tiers.keys).toEqual(['name', 'price']); // one optional badge allowed
    expect(tiers.items[1].price).toBe('29');
  });

  it('records local and package imports separately', () => {
    const parsed = parseJsxSource(
      'app/page.tsx',
      `import Hero from './hero';
      import { Zap } from 'lucide-react';
      export default function Home() { return <Hero />; }`,
    );
    expect(parsed.imports.get('Hero')).toBe('./hero');
    expect(parsed.packageImports.get('Zap')).toBe('lucide-react');
  });
});

describe('parseHtml', () => {
  it('builds a tree with attributes, classes, and text', () => {
    const roots = parseHtml(
      'index.html',
      `<!doctype html>
      <html><body>
        <section class="hero dark">
          <h1>Big claim</h1>
          <a href="#">nowhere</a>
          <img src="/x.png">
        </section>
      </body></html>`,
    );
    const section = findEl(roots, (e) => e.tag === 'section')!;
    expect(section.classes).toEqual(['hero', 'dark']);
    expect(textOf(findEl(roots, (e) => e.tag === 'h1')!)).toBe('Big claim');
    expect(findEl(roots, (e) => e.tag === 'a')!.attrs.href).toBe('#');
    // The void img must not swallow following content.
    expect(childEls(section)).toHaveLength(3);
  });

  it('survives unclosed tags and skips comments and scripts', () => {
    const roots = parseHtml(
      'index.html',
      `<div><p>open paragraph<div>inner</div></div>
      <!-- a comment -->
      <script>const notMarkup = '<h1>fake</h1>';</script>
      <h2>real</h2>`,
    );
    expect(findAll(roots, (e) => e.tag === 'h1')).toHaveLength(0);
    expect(findEl(roots, (e) => e.tag === 'h2')).not.toBeNull();
  });
});

describe('component resolution on the page', () => {
  it('substitutes imported leaf components and keeps wrapper children', () => {
    const repo = new Repo([
      {
        relPath: 'app/page.tsx',
        content: `
          import Hero from '@/components/hero';
          import Shell from '@/components/shell';
          export default function Home() {
            return (
              <Shell>
                <Hero />
                <section><h2>Own section</h2><p>Inline.</p></section>
              </Shell>
            );
          }`,
      },
      {
        relPath: 'components/hero.tsx',
        content: `
          export default function Hero() {
            return <header><h1>From the component</h1><p>Sub</p><a href="/x">Go</a></header>;
          }`,
      },
      {
        relPath: 'components/shell.tsx',
        content: `
          export default function Shell({ children }) {
            return <div><nav><a href="/x">Nav</a></nav>{children}</div>;
          }`,
      },
    ]);
    const page = analyzePage(repo)!;
    expect(findEl([page.root], (e) => e.tag === 'h1')).not.toBeNull();
    expect(findEl([page.root], (e) => e.tag === 'h2')).not.toBeNull();
    expect(page.hero).not.toBeNull();
    expect(page.hero!.file).toBe('components/hero.tsx');
  });

  it('resolves same-file helper components with their props readable', () => {
    const repo = new Repo([
      {
        relPath: 'app/page.tsx',
        content: `
          function SectionHead({ title }: { title: string }) {
            return <p className="text-xs uppercase tracking-widest">{title}</p>;
          }
          export default function Home() {
            return (
              <div>
                <header><h1>H</h1><p>Sub</p><a href="/x">Go</a></header>
                <section>
                  <SectionHead title="The registry" />
                  <h2>Every rule, named</h2>
                </section>
              </div>
            );
          }`,
      },
    ]);
    const page = analyzePage(repo)!;
    const head = findEl([page.root], (e) => e.origComponent === 'SectionHead')!;
    expect(head.classes).toContain('uppercase');
    expect(head.attrs.title).toBe('The registry');
  });

  it('classifies the ten-step sequence on a scripted page', () => {
    const repo = new Repo([
      {
        relPath: 'app/page.tsx',
        content: `
          const stats = [
            { value: '100+', label: 'Users' }, { value: '99%', label: 'Uptime' }, { value: '24/7', label: 'Support' },
          ];
          const faqs = [
            { q: 'One?', a: 'Yes.' }, { q: 'Two?', a: 'Also.' }, { q: 'Three?', a: 'Sure.' },
          ];
          export default function Home() {
            return (
              <div>
                <header><h1>Hero</h1><p>Sub</p><a href="#p">Get started</a></header>
                <section>{stats.map((s) => <div key={s.label}><p>{s.value}</p><p>{s.label}</p></div>)}</section>
                <section><h2>Trusted by</h2><p>Acme Globex Initech Umbrella</p></section>
                <section><h2>Why choose us</h2><div className="grid">{stats.map((s) => <div key={s.label}><h3>{s.label}</h3></div>)}</div></section>
                <section><h2>How it works</h2><p>Three steps.</p></section>
                <section><h2>Pricing</h2><p>$9/mo or $99/mo, cancel any time. Free tier forever.</p></section>
                <section><h2>Frequently Asked Questions</h2>{faqs.map((f) => <details key={f.q}><summary>{f.q}</summary></details>)}</section>
                <section><h2>Ready to start?</h2><a href="#p">Get started</a></section>
                <footer><p>Fin</p></footer>
              </div>
            );
          }`,
      },
    ]);
    const page = analyzePage(repo)!;
    expect(page.scriptMatch).toBeGreaterThanOrEqual(7);
    expect(page.sequence[0]).toBe('hero');
    expect(page.sequence[page.sequence.length - 1]).toBe('footer');
  });
});
