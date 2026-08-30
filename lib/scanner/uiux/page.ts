// Finding the landing page and reading its skeleton.
//
// SECUREVIBE-GRADING.md section 2: vibe-coded landing pages follow a fixed
// ten-step section order, and detecting that order is the backbone of the
// grader. This file locates the marketing page (section 8's priority
// list), resolves the components it composes, splits the result into
// top-level sections, classifies each one, and measures the longest
// common subsequence against the script.
//
// The false-positive guard from section 8 lives here too: docs sites and
// dashboards are not landing pages, so a page only counts as marketing
// when it has a headline and a call to action and no app chrome.

import type { DataArray, El, Node, ParsedSource } from './model';
import { childEls, findAll, findEl, isHeading, textOf } from './model';
import { parseJsxSource, fillMapData } from './parse-jsx';
import { parseHtmlSource } from './parse-html';

export interface SourceFile {
  relPath: string;
  content: string;
}

/** The ten steps of the template script, in canonical order. */
export const SCRIPT_STEPS = [
  'hero', 'stats', 'logos', 'features', 'how', 'pricing',
  'testimonials', 'faq', 'cta', 'footer',
] as const;
export type StepId = (typeof SCRIPT_STEPS)[number];

export const STEP_LABEL: Record<StepId, string> = {
  hero: 'hero',
  stats: 'stat strip',
  logos: 'logo cloud',
  features: 'feature grid',
  how: 'how-it-works steps',
  pricing: 'pricing tiers',
  testimonials: 'testimonials',
  faq: 'FAQ',
  cta: 'final call to action',
  footer: 'footer',
};

export interface ClassifiedSection {
  step: StepId | null;
  el: El;
  /** File the section's markup lives in, for citations. */
  file: string;
  line: number;
  /** Human handle: the component name or the section heading. */
  label: string;
}

export interface PageAnalysis {
  file: string;
  root: El;
  sections: ClassifiedSection[];
  /** The classified steps in page order (nulls dropped). */
  sequence: StepId[];
  /** Longest common subsequence length against the ten-step script. */
  scriptMatch: number;
  hero: ClassifiedSection | null;
  footer: ClassifiedSection | null;
  navEls: El[];
  metaDescription: string | null;
  /** Data arrays visible from the page and its resolved components. */
  arrays: DataArray[];
  /** Every file whose markup contributes to this page. */
  files: string[];
  h2s: El[];
}

// ── the repo: file map + parse cache + module resolution ───────────────

const PARSE_EXTS = ['.tsx', '.jsx', '.ts', '.js', '.mjs', '.astro', '.vue', '.svelte', '.html'];

export class Repo {
  readonly files = new Map<string, SourceFile>();
  private parseCache = new Map<string, ParsedSource | null>();

  constructor(files: SourceFile[]) {
    for (const f of files) this.files.set(f.relPath, f);
  }

  parse(relPath: string): ParsedSource | null {
    if (this.parseCache.has(relPath)) return this.parseCache.get(relPath)!;
    const file = this.files.get(relPath);
    let parsed: ParsedSource | null = null;
    if (file) {
      try {
        if (/\.(?:tsx|jsx|ts|js|mjs)$/.test(relPath)) {
          parsed = parseJsxSource(relPath, file.content);
        } else if (/\.(?:html|astro|vue|svelte)$/.test(relPath)) {
          parsed = parseHtmlSource(relPath, file.content);
        }
      } catch {
        parsed = null; // an unparseable file is simply not evidence
      }
    }
    this.parseCache.set(relPath, parsed);
    return parsed;
  }

  /** Resolve an import specifier to a repo file, or null. */
  resolveModule(fromFile: string, spec: string): string | null {
    const bases: string[] = [];
    if (spec.startsWith('.')) {
      const dir = fromFile.split('/').slice(0, -1);
      const parts = spec.split('/');
      const stack = [...dir];
      for (const part of parts) {
        if (part === '.' || part === '') continue;
        else if (part === '..') stack.pop();
        else stack.push(part);
      }
      bases.push(stack.join('/'));
    } else if (spec.startsWith('@/') || spec.startsWith('~/')) {
      const rest = spec.slice(2);
      bases.push(rest, `src/${rest}`, `app/${rest}`);
    } else if (spec.startsWith('src/')) {
      bases.push(spec);
    } else {
      return null;
    }
    for (const base of bases) {
      if (this.files.has(base)) return base;
      for (const ext of PARSE_EXTS) {
        if (this.files.has(base + ext)) return base + ext;
        if (this.files.has(`${base}/index${ext}`)) return `${base}/index${ext}`;
      }
    }
    return null;
  }
}

// ── component resolution ───────────────────────────────────────────────

const MAX_RESOLVED = 80;
const MAX_DEPTH = 3;

interface ResolveState {
  repo: Repo;
  files: Set<string>;
  arrays: DataArray[];
  budget: number;
}

function componentRoot(parsed: ParsedSource, name: string): El | null {
  const roots =
    parsed.components.get(name) ??
    (parsed.defaultExport ? parsed.components.get(parsed.defaultExport) : undefined) ??
    parsed.components.get('(document)');
  if (!roots || roots.length === 0) return null;
  // A component's return is its last top-level JSX (helpers come first).
  return roots[roots.length - 1];
}

function cloneWithSource(el: El, sourceFile: string): El {
  return {
    ...el,
    sourceFile: el.sourceFile ?? sourceFile,
    children: el.children.map((c) => (c.kind === 'el' ? cloneWithSource(c, sourceFile) : c)),
  };
}

/**
 * Substitute components with the JSX they return — same-file helpers
 * first (a local `SectionHead` used above every heading), then
 * locally-imported ones. Components that receive children act as
 * wrappers and keep them in place, so `<Layout><Hero/></Layout>` still
 * yields the hero.
 */
function resolveComponents(
  el: El,
  source: ParsedSource,
  state: ResolveState,
  depth: number,
  resolving: Set<string> = new Set(),
): El {
  const resolvedChildren: Node[] = el.children.map((child) => {
    if (child.kind !== 'el') return child;
    return resolveComponents(child, source, state, depth, resolving);
  });
  let out: El = { ...el, children: resolvedChildren };

  const baseTag = el.tag.split('.')[0];
  const isComponent = /^[A-Z]/.test(el.tag) && !el.tag.startsWith('#');
  if (!isComponent || depth >= MAX_DEPTH || state.budget <= 0 || resolving.has(baseTag)) {
    return out;
  }

  // Same-file component: `function SectionHead(...)` defined beside the page.
  const localRoots = source.components.get(baseTag);
  const local = localRoots && localRoots.length > 0 ? localRoots[localRoots.length - 1] : null;

  const spec = local ? null : source.imports.get(baseTag);
  const target = spec ? state.repo.resolveModule(source.file, spec) : null;
  const parsed = target ? state.repo.parse(target) : null;
  const importedRoot = parsed ? componentRoot(parsed, baseTag) : null;

  const root = local ?? importedRoot;
  const rootSource = local ? source : parsed;
  if (!root || !rootSource) return out;

  state.budget--;
  if (!local && parsed) {
    state.files.add(parsed.file);
    state.arrays.push(...parsed.arrays);
  }
  const nextResolving = new Set(resolving).add(baseTag);
  const resolved = resolveComponents(
    cloneWithSource(root, rootSource.file),
    rootSource,
    state,
    depth + 1,
    nextResolving,
  );
  if (childEls(el).length === 0) {
    // The invocation's static props ride along: <SectionHead title="…"/>
    // keeps its title readable even though the body renders {title}.
    out = { ...resolved, attrs: { ...resolved.attrs, ...el.attrs } };
  } else {
    // Wrapper component: keep the callers' children (they are the
    // page content), note the wrapper's own chrome for nav/footer.
    out = {
      ...el,
      children: [...resolved.children.filter(isChrome), ...resolvedChildren],
    };
  }
  out.origComponent = el.tag;
  return out;
}

function isChrome(n: Node): boolean {
  return n.kind === 'el' && (n.tag === 'nav' || n.tag === 'header' || n.tag === 'footer');
}

// ── section splitting ──────────────────────────────────────────────────

const WRAPPERS = new Set(['#fragment', 'div', 'main', 'body', 'html', 'article']);

function sectionish(el: El): boolean {
  if (['section', 'header', 'footer', 'nav', 'aside'].includes(el.tag)) return true;
  if (findEl([el], (e) => isHeading(e))) return true;
  return false;
}

/** Top-level sections in document order. */
export function topSections(root: El): El[] {
  const out: El[] = [];
  const descend = (el: El): void => {
    for (const child of childEls(el)) {
      const tag = child.tag.toLowerCase();
      if (['section', 'header', 'footer', 'nav', 'aside'].includes(tag)) {
        out.push(child);
        continue;
      }
      if (WRAPPERS.has(tag) || child.tag.startsWith('#')) {
        // A wrapper holding several section-ish blocks is scaffolding;
        // a wrapper that IS one block is a section styled with divs.
        const inner = childEls(child).filter(sectionish);
        if (inner.length >= 2 || childEls(child).length > Math.max(1, inner.length)) {
          descend(child);
          continue;
        }
        if (inner.length === 1) {
          descend(child);
          continue;
        }
        continue;
      }
      if (sectionish(child) || /^[A-Z]/.test(child.tag)) out.push(child);
    }
  };
  descend(root);
  return out;
}

// ── classification ─────────────────────────────────────────────────────

const NAME_HINT: [RegExp, StepId][] = [
  [/^(?:hero|masthead|banner)$/i, 'hero'],
  [/stat|metric|number/i, 'stats'],
  [/logo|brand|trustbar|clients?$/i, 'logos'],
  [/feature|benefit|service|capabilit/i, 'features'],
  [/^how|steps?$|process|workflow/i, 'how'],
  [/pricing|plans?$/i, 'pricing'],
  [/testimonial|review|quote|social.?proof/i, 'testimonials'],
  [/faq|question/i, 'faq'],
  [/cta|calltoaction|getstarted|finalcta/i, 'cta'],
  [/footer/i, 'footer'],
];

const ARRAY_HINT: [RegExp, StepId][] = [
  [/^(?:stats|metrics|numbers|counters)$/i, 'stats'],
  [/^(?:logos|brands|companies|clients|partners)$/i, 'logos'],
  [/^(?:features|benefits|services|capabilities|cards|offerings|highlights)$/i, 'features'],
  [/^(?:steps|process|phases|workflow|howitworks)$/i, 'how'],
  [/^(?:plans|tiers|pricing|prices|packages)$/i, 'pricing'],
  [/^(?:testimonials|reviews|quotes)$/i, 'testimonials'],
  [/^(?:faqs?|questions)$/i, 'faq'],
];

const HEADING_HINT: [RegExp, StepId][] = [
  [/how it works|how we work|\bprocess\b|\bour approach\b|quick start|getting started/i, 'how'],
  [/pricing|^plans\b|choose your plan/i, 'pricing'],
  [/frequently asked|\bfaq\b|questions,? answered|common questions/i, 'faq'],
  [/testimonial|what (?:our|people|customers|clients)|loved by|customer stories|don.t take our word/i, 'testimonials'],
  [/\bfeatures\b|everything you need|why (?:choose|us|we)|built for|what you get|benefits/i, 'features'],
  [/trusted by|backed by|as seen (?:in|on)|featured in|powering/i, 'logos'],
];

const NUMBERY = /^[~$€£]?\d[\d,.]*\s*(?:%|\+|[kKmMbB]\+?|[xX]|\/7|\/5)?$/;
const CTA_VERB = /get started|start (?:now|free|today|building|your)|sign ?up|try (?:it|now|free)|book a|join|claim|request/i;

function statChildren(el: El): El[] {
  // A stat strip is 3-5 short number+label pairs in one row container.
  const rows = [el, ...childEls(el)];
  for (const row of rows) {
    const kids = childEls(row);
    if (kids.length < 3 || kids.length > 5) continue;
    const stats = kids.filter((k) => {
      const text = textOf(k);
      if (!text || text.length > 60) return false;
      const first = text.split(/\s+/)[0];
      return NUMBERY.test(first) || /^\d/.test(first);
    });
    if (stats.length >= 3) return stats;
  }
  return [];
}

export function classifySection(el: El): StepId | null {
  const name = el.origComponent ?? (/^[A-Z]/.test(el.tag) ? el.tag : '');
  const tag = el.tag.toLowerCase();
  const text = textOf(el);
  const headings = findAll([el], (e) => isHeading(e));
  const headingText = headings.map((h) => textOf(h)).join(' ');

  if (tag === 'footer' || /footer/i.test(name)) return 'footer';
  if (tag === 'nav' || (tag === 'header' && !findEl([el], (e) => isHeading(e, 1)))) return null;

  // The hero is wherever the h1 lives.
  if (findEl([el], (e) => isHeading(e, 1))) return 'hero';

  // Mapped arrays name their section outright.
  for (const m of findAll([el], (e) => e.tag === '#map')) {
    for (const [re, step] of ARRAY_HINT) {
      if (re.test(m.map!.arrayName)) return step;
    }
  }

  for (const [re, step] of NAME_HINT) {
    if (name && re.test(name)) return step;
  }

  for (const [re, step] of HEADING_HINT) {
    if (re.test(headingText)) return step;
  }

  // Ready-to CTA: the restated hero at the bottom of the script.
  if (/^ready (?:to|for)\b/i.test(headingText.trim())) return 'cta';

  if (statChildren(el).length >= 3) return 'stats';

  // Pricing: several currency amounts with a period.
  const money = text.match(/[$€£]\s?\d+/g);
  if (money && money.length >= 2 && /\/\s*(?:mo|month|year|yr)|per month|forever|free/i.test(text)) {
    return 'pricing';
  }

  // Testimonials: quoted voices with names.
  const quotes = findAll([el], (e) => e.tag === 'blockquote' || e.tag === 'q');
  if (quotes.length >= 2) return 'testimonials';
  if (/[“"'‘].{40,300}[”"'’]/.test(text) && /(?:CEO|founder|director|manager),?\s|—\s*[A-Z][a-z]+ [A-Z]/.test(text)) {
    return 'testimonials';
  }

  // FAQ: an accordion of questions.
  const details = findAll([el], (e) => e.tag === 'details' || /accordion/i.test(e.tag));
  const questionMarks = (text.match(/\?/g) ?? []).length;
  if (details.length >= 3 || (questionMarks >= 3 && headings.length >= 3)) return 'faq';

  // Logos: several images in a row, little text.
  const imgs = findAll([el], (e) => e.tag === 'img');
  if (imgs.length >= 4 && text.length < 120) return 'logos';

  // Trailing CTA fallback: short block, an h2, and an action verb.
  if (
    headings.some((h) => h.tag === 'h2') &&
    text.length < 400 &&
    CTA_VERB.test(text) &&
    findEl([el], (e) => e.tag === 'a' || e.tag === 'button') !== null
  ) {
    return 'cta';
  }

  // A grid of 4+ same-shaped cards with no other tell reads as features.
  for (const candidate of [el, ...childEls(el)]) {
    const kids = childEls(candidate);
    if (kids.length >= 4 && kids.length <= 9) {
      const tags = new Set(kids.map((k) => k.tag));
      if (tags.size === 1 && kids.every((k) => findEl([k], (e) => isHeading(e) || e.tag === 'h3'))) {
        return 'features';
      }
    }
  }
  if (findEl([el], (e) => e.tag === '#map' && (e.map!.length ?? 0) >= 3)) return 'features';

  return null;
}

// ── the longest common subsequence against the script ──────────────────

export function scriptLcs(sequence: StepId[]): number {
  const script = SCRIPT_STEPS as readonly StepId[];
  const n = sequence.length;
  const m = script.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] =
        sequence[i - 1] === script[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[n][m];
}

// ── the marketing page finder ──────────────────────────────────────────

/** Candidate entry files, in the spec's priority order. */
export function pageCandidates(repo: Repo): string[] {
  const all = [...repo.files.keys()];
  const out: string[] = [];

  // Next app router: any page.* whose URL is '/', groups stripped.
  const appPages = all
    .filter((p) => /^(?:src\/)?app\/(?:\([^)]*\)\/)*page\.(?:tsx|jsx|js|mdx)$/.test(p))
    .sort((a, b) => a.length - b.length);
  out.push(...appPages);

  for (const p of ['pages/index.tsx', 'pages/index.jsx', 'pages/index.js',
    'src/pages/index.tsx', 'src/pages/index.jsx', 'src/pages/index.js']) {
    if (repo.files.has(p)) out.push(p);
  }
  for (const p of ['src/pages/index.astro']) if (repo.files.has(p)) out.push(p);
  for (const p of ['src/App.tsx', 'src/App.jsx', 'src/App.js', 'App.tsx', 'App.jsx']) {
    if (repo.files.has(p)) out.push(p);
  }
  if (repo.files.has('index.html')) out.push('index.html');
  for (const p of all) {
    if (/^src\/pages\/(?:home|landing)\.(?:tsx|jsx|js|astro)$/i.test(p)) out.push(p);
  }
  return [...new Set(out)];
}

/** Layout files that wrap a Next page, root first. */
function layoutChain(repo: Repo, pageFile: string): string[] {
  const m = pageFile.match(/^((?:src\/)?app)\/(.*)page\.\w+$/);
  if (!m) return [];
  const [, appDir, rest] = m;
  const segments = rest.split('/').filter(Boolean);
  const chain: string[] = [];
  for (let i = 0; i <= segments.length; i++) {
    const dir = [appDir, ...segments.slice(0, i)].join('/');
    for (const ext of ['.tsx', '.jsx', '.js']) {
      const candidate = `${dir}/layout${ext}`;
      if (repo.files.has(candidate)) chain.push(candidate);
    }
  }
  return chain;
}

/**
 * Section 8's marketing-route guard: an h1 plus a call-to-action link,
 * and no app chrome (sidebar navigation) — otherwise this page is a
 * dashboard or a docs site and the grader must not run.
 */
export function looksLikeMarketing(root: El): boolean {
  const h1 = findEl([root], (e) => isHeading(e, 1) && textOf(e).length > 0);
  if (!h1) return false;
  const cta = findEl(
    [root],
    (e) => (e.tag === 'a' || e.tag === 'button' || /Link|Button/.test(e.tag)) && textOf(e).length > 0,
  );
  if (!cta) return false;
  const sidebar = findEl(
    [root],
    (e) =>
      (e.tag === 'aside' || e.classes.some((c) => /sidebar/i.test(c))) &&
      findAll([e], (x) => x.tag === 'a').length >= 5,
  );
  return sidebar === null;
}

/** A Vite/CRA index.html is a mount shell, not a page. */
function isMountShell(root: El): boolean {
  const body = findEl([root], (e) => e.tag === 'body');
  if (!body) return false;
  const kids = childEls(body).filter((e) => e.tag !== 'script' && e.tag !== 'noscript');
  return kids.length <= 1 && kids.every((e) => e.tag === 'div' && !!(e.attrs.id ?? '').match(/root|app/));
}

export function analyzePage(repo: Repo): PageAnalysis | null {
  for (const candidate of pageCandidates(repo)) {
    const parsed = repo.parse(candidate);
    if (!parsed) continue;
    const entryRoot = componentRoot(parsed, parsed.defaultExport ?? '(document)');
    if (!entryRoot) continue;

    const state: ResolveState = {
      repo,
      files: new Set([candidate]),
      arrays: [...parsed.arrays],
      budget: MAX_RESOLVED,
    };
    let root = resolveComponents(entryRoot, parsed, state, 0);

    // Merge in the layout chain so the shared nav and footer are visible.
    let metaDescription = parsed.metaDescription;
    const chromeRoots: El[] = [];
    for (const layoutFile of layoutChain(repo, candidate)) {
      const layout = repo.parse(layoutFile);
      if (!layout) continue;
      metaDescription ??= layout.metaDescription;
      const layoutRoot = componentRoot(layout, layout.defaultExport ?? '');
      if (layoutRoot) {
        state.files.add(layoutFile);
        state.arrays.push(...layout.arrays);
        chromeRoots.push(resolveComponents(layoutRoot, layout, state, 1));
      }
    }
    if (chromeRoots.length > 0) {
      const chrome = chromeRoots.flatMap((r) =>
        findAll([r], (e) => e.tag === 'nav' || e.tag === 'header' || e.tag === 'footer'),
      );
      if (chrome.length > 0) {
        root = { ...root, children: [...chrome.filter((c) => c.tag !== 'footer'), ...root.children, ...chrome.filter((c) => c.tag === 'footer')] };
      }
    }

    if (isMountShell(root)) continue;
    if (!looksLikeMarketing(root)) continue;

    // Late resolution: arrays imported from data files fill remaining maps.
    const byName = new Map<string, DataArray>();
    for (const arr of state.arrays) if (!byName.has(arr.name)) byName.set(arr.name, arr);
    fillMapData(root, byName);

    const sectionEls = topSections(root);
    const sections: ClassifiedSection[] = sectionEls.map((el) => ({
      step: classifySection(el),
      el,
      file: el.sourceFile ?? candidate,
      line: el.line,
      label:
        el.origComponent ??
        (findEl([el], (e) => isHeading(e))
          ? textOf(findEl([el], (e) => isHeading(e))!).slice(0, 60)
          : el.tag),
    }));

    // Deduplicate footer/hero repeats from chrome merging.
    const sequence: StepId[] = [];
    for (const s of sections) {
      if (s.step && sequence[sequence.length - 1] !== s.step) sequence.push(s.step);
    }

    const h2s = findAll([root], (e) => isHeading(e, 2));
    const heroSection = sections.find((s) => s.step === 'hero') ?? null;
    const footerSection = [...sections].reverse().find((s) => s.step === 'footer') ?? null;

    return {
      file: candidate,
      root,
      sections,
      sequence,
      scriptMatch: scriptLcs(sequence),
      hero: heroSection,
      footer: footerSection,
      navEls: findAll([root], (e) => e.tag === 'nav'),
      metaDescription,
      arrays: dedupeArrays(state.arrays),
      files: [...state.files],
      h2s,
    };
  }
  return null;
}

function dedupeArrays(arrays: DataArray[]): DataArray[] {
  const seen = new Set<string>();
  const out: DataArray[] = [];
  for (const a of arrays) {
    const key = `${a.file}:${a.name}:${a.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}
