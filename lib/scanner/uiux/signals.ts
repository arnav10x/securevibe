// The signal catalog from SECUREVIBE-GRADING.md section 3, one detector
// per signal. Every detector returns zero or more findings, and every
// finding carries the four things the report prints: what we found (with
// the file), why it reads as vibe coded, the points it costs, and a
// paste-ready fix prompt built from the spec's template.
//
// Ground rules, from the spec:
//   - Prose quality never raises the score. There are no positive points.
//   - Color never lowers the score on its own (dialect.ts handles hexes).
//   - Fix prompts attack the skeleton: they name the section and file,
//     lead with deletions, forbid the mapped array and the shared card,
//     and never suggest a color or font. Under 120 words each.

import type { DataArray, El } from './model';
import {
  childEls,
  findAll,
  findEl,
  isHeading,
  ownText,
  sentenceCount,
  textOf,
  tokenOverlap,
  walkEls,
} from './model';
import type { ClassifiedSection, PageAnalysis, Repo, SourceFile } from './page';
import { STEP_LABEL } from './page';

export type SignalId =
  | 'content-as-data'
  | 'eyebrow-labels'
  | 'numbered-decor'
  | 'copy-fingerprints'
  | 'negation-headings'
  | 'one-liner-restatement'
  | 'social-proof'
  | 'dead-links'
  | 'leaked-placeholder'
  | 'stale-copyright'
  | 'phantom-routes'
  | 'stat-strip'
  | 'no-real-media'
  | 'div-mock-hero'
  | 'cta-repetition'
  | 'route-depth'
  | 'emoji-icons'
  | 'icon-grid'
  | 'feature-grid-uniformity'
  | 'template-script'
  | 'dialect-hex';

export interface StructuralFinding {
  signal: SignalId;
  /** Display name, uppercased by the report: "CONTENT-AS-DATA ARRAYS". */
  name: string;
  points: number;
  /** "What we found" — one sentence citing the file. */
  found: string;
  /** "Why it reads as vibe coded" — one sentence. */
  why: string;
  /** The paste-ready prompt, filled from the spec template. */
  fixPrompt: string;
  filePath?: string;
  lineStart?: number;
  evidence?: string;
}

export interface SignalContext {
  repo: Repo;
  page: PageAnalysis;
  /** Every path in the repo, binary assets included (media census). */
  allPaths: string[];
  /** UI-flavored source files, for the copy greps. */
  uiFiles: SourceFile[];
  /** Route inventory when the repo's routing is file-based. */
  routes: RouteInventory;
  nowYear: number;
}

export interface RouteInventory {
  /** Exact route urls that exist, e.g. '/', '/pricing'. */
  routes: Set<string>;
  /** Prefixes owned by dynamic segments, e.g. '/blog/'. */
  wildcardPrefixes: string[];
  /** True when a client-side router defines routes in code (do not guess). */
  clientRouter: boolean;
  /** True when we could read the routing scheme at all. */
  known: boolean;
}

const f = (
  signal: SignalId,
  name: string,
  points: number,
  found: string,
  why: string,
  fixPrompt: string,
  at?: { file?: string; line?: number; evidence?: string },
): StructuralFinding => ({
  signal,
  name,
  points,
  found,
  why,
  fixPrompt,
  filePath: at?.file,
  lineStart: at?.line,
  evidence: at?.evidence,
});

function cite(file: string, line?: number): string {
  return line ? `${file}:${line}` : file;
}

/** First line number where `re` matches in `content`, or undefined. */
function lineOfMatch(content: string, re: RegExp): number | undefined {
  const m = re.exec(content);
  if (!m) return undefined;
  return content.slice(0, m.index).split('\n').length;
}

/** Every element's ancestor chain (root first), for sibling lookups. */
function ancestorChains(root: El): Map<El, El[]> {
  const out = new Map<El, El[]>();
  const walk = (el: El, chain: El[]): void => {
    out.set(el, chain);
    const next = [...chain, el];
    for (const child of childEls(el)) walk(child, next);
  };
  walk(root, []);
  return out;
}

// ── 3.1 content-as-data arrays ─────────────────────────────────────────

export function detectContentAsData(ctx: SignalContext): StructuralFinding[] {
  const hits: { section: ClassifiedSection; arrayName: string; file: string; line: number }[] = [];

  for (const section of ctx.page.sections) {
    if (section.step === 'footer' || section.el.tag === 'nav' || section.el.tag === 'header') {
      continue; // footer link columns are navigation, not content sections
    }
    const maps = findAll([section.el], (e) => e.tag === '#map');
    const mapped = maps.find((m) => (m.map!.length ?? 3) >= 3 && (m.map!.keys !== null || m.map!.length !== null));
    if (mapped) {
      hits.push({
        section,
        arrayName: mapped.map!.arrayName,
        file: mapped.sourceFile ?? section.file,
        line: mapped.line,
      });
      continue;
    }
    // The same shared component repeated with prop-only differences.
    for (const container of [section.el, ...childEls(section.el)]) {
      const kids = childEls(container);
      if (kids.length >= 4 && /^[A-Z]/.test(kids[0].tag) && kids.every((k) => k.tag === kids[0].tag)) {
        hits.push({ section, arrayName: `<${kids[0].tag}>`, file: section.file, line: kids[0].line });
        break;
      }
    }
  }

  if (hits.length === 0) return [];
  const points = Math.min(20, hits.length * 4);
  const first = hits[0];
  const sectionNames = hits
    .map((h) => (h.section.step ? STEP_LABEL[h.section.step] : h.section.label))
    .slice(0, 6);
  const target = first.section.step ? STEP_LABEL[first.section.step] : first.section.label;

  return [
    f(
      'content-as-data',
      'Content-as-data arrays',
      points,
      `${hits.length} section${hits.length === 1 ? '' : 's'} render from a mapped array of same-shaped items (${sectionNames.join(', ')}), starting with "${first.arrayName}" in ${cite(first.file, first.line)}.`,
      'Every item has the same shape, so every card has the same shape, and the section reads as a whiteboard of cards instead of content someone laid out.',
      `Rewrite the ${target} section in ${first.file} without a shared card component and without mapping over an array. Lay out each item by hand as its own block. Make the blocks different sizes. Put a real screenshot or photograph in at least one of them. Remove any item that has nothing specific to show. Repeat for: ${sectionNames.join(', ')}.`,
      { file: first.file, line: first.line, evidence: `${first.arrayName} -> .map()` },
    ),
  ];
}

// ── 3.2 eyebrow labels ─────────────────────────────────────────────────

const SMALL_CLASS = /^text-(?:xs|\[(?:0\.\d+rem|1[0-3]px)\])$/;
const EYEBROW_STYLE = /^(?:uppercase|tracking-(?:wide|wider|widest|\[[^\]]+\])|font-mono)$/;
const MONTHISH = /\b(?:20\d\d|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i;

/** Class names the project's own CSS styles as uppercase tracked labels. */
export function cssLabelClasses(cssFiles: SourceFile[]): Set<string> {
  const out = new Set<string>();
  for (const file of cssFiles) {
    for (const m of file.content.matchAll(/\.([\w-]+)[^{}]*\{([^}]*)\}/g)) {
      if (/text-transform\s*:\s*uppercase/i.test(m[2]) && /letter-spacing\s*:/i.test(m[2])) {
        out.add(m[1]);
      }
    }
  }
  return out;
}

function isEyebrow(el: El, labelClasses: Set<string>): boolean {
  const text = textOf(el);
  if (text.length > 40) return false;
  if (MONTHISH.test(text)) return false; // date stamps are not eyebrows
  const hasLabelClass = el.classes.some((c) => labelClasses.has(c));
  // A class the project's own CSS styles as an uppercase tracked label is
  // an eyebrow wherever it sits, even when its text is a dynamic prop.
  if (hasLabelClass) return true;
  const small = el.classes.some((c) => SMALL_CLASS.test(c));
  const styled = el.classes.some((c) => EYEBROW_STYLE.test(c));
  if (small && styled) return true;
  return Boolean(text) && styled && text === text.toUpperCase() && /[A-Z]/.test(text);
}

/**
 * The eyebrow may not be the literal previous sibling: pages wrap both
 * the label and the heading in animation shells and reveal wrappers.
 * Look at the two preceding siblings across up to three ancestor
 * levels, and inside each, at a shallow subtree.
 */
function eyebrowNear(h2: El, chain: El[], labelClasses: Set<string>): El | null {
  const levels = chain.slice(-3).reverse();
  let target: El = h2;
  for (const parent of levels) {
    const kids = childEls(parent);
    const idx = kids.findIndex((k) => k === target || findEl([k], (e) => e === target) !== null);
    for (let back = 1; back <= 2; back++) {
      const prev = idx - back >= 0 ? kids[idx - back] : null;
      if (!prev) break;
      // Navigation preceding a heading is chrome (breadcrumbs, menus),
      // never an eyebrow — whatever its typography.
      if (prev.tag === 'nav' || findEl([prev], (e) => e.tag === 'nav')) continue;
      if (isEyebrow(prev, labelClasses)) return prev;
      const inner = findAll([prev], (e) => isEyebrow(e, labelClasses));
      if (inner.length > 0 && findAll([prev], () => true).length <= 8) return inner[0];
    }
    target = parent;
  }
  return null;
}

export function detectEyebrows(ctx: SignalContext, labelClasses: Set<string>): StructuralFinding[] {
  const h2s = ctx.page.h2s;
  if (h2s.length === 0) return [];

  const eyebrows: { el: El; file: string }[] = [];
  const claimed = new Set<El>();
  const chains = ancestorChains(ctx.page.root);
  for (const h2 of h2s) {
    const chain = chains.get(h2) ?? [];
    if (chain.some((a) => a.tag === 'nav' && /breadcrumb/i.test(a.attrs['aria-label'] ?? ''))) {
      continue;
    }
    const eyebrow = eyebrowNear(h2, chain, labelClasses);
    if (eyebrow && !claimed.has(eyebrow)) {
      claimed.add(eyebrow);
      eyebrows.push({ el: eyebrow, file: eyebrow.sourceFile ?? ctx.page.file });
    }
  }

  if (eyebrows.length === 0) return [];
  const ratio = eyebrows.length / h2s.length;
  let points = 0;
  if (ratio > 0.5 && (eyebrows.length >= 2 || h2s.length === 1)) points = 10;
  else if (ratio > 0.25) points = 5;
  if (ratio > 0.5 && eyebrows.length === 1 && h2s.length > 1) points = 5;
  if (points === 0) return [];

  const first = eyebrows[0];
  const firstText =
    textOf(first.el) || first.el.attrs.title || first.el.attrs.n || first.el.classes.join(' ');
  return [
    f(
      'eyebrow-labels',
      'Eyebrow labels above headings',
      points,
      `${eyebrows.length} of ${h2s.length} section headings carry a small uppercase label above them, starting with "${firstText.slice(0, 40)}" in ${cite(first.file, first.el.line)}.`,
      'The label names the kind of section it sits on, which is the generation prompt left visible on the page.',
      'Remove every small uppercase label that sits above a section heading. The heading must carry the meaning on its own. If the heading cannot stand without the label, rewrite the heading.',
      { file: first.file, line: first.el.line, evidence: firstText.slice(0, 60) },
    ),
  ];
}

// ── 3.3 zero-padded counters ───────────────────────────────────────────

const ZERO_PAD = /^0[1-9](?:\s*[/.\-–—·:].*)?$/;

export function detectNumberedDecor(ctx: SignalContext): StructuralFinding[] {
  const hits: { el: El; section: ClassifiedSection | null }[] = [];
  const sectionOf = (target: El): ClassifiedSection | null => {
    for (const s of ctx.page.sections) {
      for (const el of walkEls([s.el])) if (el === target) return s;
    }
    return null;
  };

  for (const el of walkEls([ctx.page.root])) {
    const own = ownText(el);
    if (!own || !ZERO_PAD.test(own)) continue;
    // Guard from section 8: a plain numbered setup step is not decoration.
    // Zero padding is what makes it decorative, and ZERO_PAD requires it.
    hits.push({ el, section: sectionOf(el) });
    if (hits.length >= 24) break;
  }

  // padStart(2, '0') in the page's own source files is the same move.
  let padStart: { file: string; line: number } | null = null;
  for (const file of ctx.page.files) {
    const src = ctx.repo.files.get(file);
    if (!src) continue;
    const line = lineOfMatch(src.content, /padStart\(\s*2\s*,\s*['"]0['"]\s*\)/);
    if (line) {
      padStart = { file, line };
      break;
    }
  }

  // Counters that ride in the data arrays: { number: '01', ... }.
  const countered = ctx.page.arrays.filter(
    (a) => a.items.filter((it) => Object.values(it).some((v) => /^0[1-9]$/.test(v))).length >= 2,
  );

  if (hits.length === 0 && !padStart && countered.length === 0) return [];

  const steps = new Set(hits.map((h) => h.section?.step ?? null));
  steps.delete(null);
  const typeCount = Math.max(
    steps.size,
    countered.length + (hits.length > 0 && steps.size === 0 ? 1 : 0),
  );
  const multiSection = steps.size >= 2 || countered.length + (hits.length > 0 ? 1 : 0) >= 2;
  const points = 8 + (multiSection ? 4 : 0);
  const first = hits[0];
  const at = first
    ? { file: first.el.sourceFile ?? ctx.page.file, line: first.el.line, evidence: ownText(first.el) }
    : countered[0]
      ? { file: countered[0].file, line: countered[0].line, evidence: `${countered[0].name}: '01', '02', …` }
      : { file: padStart!.file, line: padStart!.line, evidence: "padStart(2, '0')" };
  const where = first?.section?.step
    ? STEP_LABEL[first.section!.step!]
    : countered[0]
      ? `the ${countered[0].name} section`
      : 'the numbered section';

  return [
    f(
      'numbered-decor',
      'Zero-padded counters',
      points,
      `Decorative "01 / 02 / 03" numbering appears ${
        multiSection && typeCount >= 2 ? `across ${typeCount} section types` : `in ${where}`
      }, starting at ${cite(at.file, at.line)}.`,
      'Zero-padded numbering imposes order where no real hierarchy exists, and it ships identically on unrelated generated sites.',
      `Remove all numbered labels (01, 02, 03) from ${where}. Only number items whose order carries meaning, such as literal sequential steps a user must perform. For those, use plain numerals inside the heading text, not decorative counters.`,
      at,
    ),
  ];
}

// ── 3.4 copy fingerprints + negation headings ──────────────────────────

const FINGERPRINTS: { phrase: string; re: RegExp }[] = [
  { phrase: "Everything you need. Nothing you don't.", re: /everything you need\.?,?\s+nothing you don/i },
  { phrase: 'Simple, transparent pricing', re: /simple,?\s+transparent pricing/i },
  { phrase: 'No credit card required', re: /no credit card required/i },
  { phrase: '14-day free trial', re: /14[- ]day free trial/i },
  { phrase: 'Trusted by', re: /trusted by/i },
  { phrase: 'Frequently Asked Questions', re: /frequently asked questions/i },
  { phrase: 'Your Questions, Answered', re: /your questions,?\s+answered/i },
  { phrase: 'How it works', re: /how it works/i },
  { phrase: 'Why choose us', re: /why choose us/i },
];

export function detectCopyFingerprints(ctx: SignalContext): StructuralFinding[] {
  const found: { phrase: string; file: string; line: number }[] = [];
  for (const { phrase, re } of FINGERPRINTS) {
    for (const file of ctx.uiFiles) {
      const line = lineOfMatch(file.content, new RegExp(re.source, re.flags));
      if (line) {
        found.push({ phrase, file: file.relPath, line });
        break;
      }
    }
  }
  // "Ready to [verb]" as the closing H2 comes from the tree, not the grep.
  const readyTo = ctx.page.sections.find(
    (s) => s.step === 'cta' && /^ready (?:to|for)\b/i.test(
      findAll([s.el], (e) => isHeading(e)).map((h) => textOf(h)).join(' ').trim(),
    ),
  );
  if (readyTo) {
    found.push({ phrase: 'Ready to …', file: readyTo.file, line: readyTo.line });
  }

  const out: StructuralFinding[] = [];
  if (found.length > 0) {
    const points = Math.min(10, found.length * 2);
    const list = found.map((p) => `"${p.phrase}"`).slice(0, 5).join(', ');
    out.push(
      f(
        'copy-fingerprints',
        'Copy fingerprints',
        points,
        `${found.length} stock phrase${found.length === 1 ? ' recurs' : 's recur'} on unrelated generated sites: ${list}, first in ${cite(found[0].file, found[0].line)}.`,
        'These exact phrases appear verbatim across unrelated companies because the model produced them, and returning visitors have read them all week.',
        `Replace the phrase "${found[0].phrase}" with a sentence that names what this product specifically does for this specific customer. Do the same for every stock phrase on the page: ${list}. State the thing directly.`,
        { file: found[0].file, line: found[0].line, evidence: found[0].phrase },
      ),
    );
  }

  // Negation-defined value in headings: "X is not Y", "X, not Y".
  const negated = ctx.page.h2s
    .concat(findAll([ctx.page.root], (e) => isHeading(e, 3)))
    .map((h) => ({ h, text: textOf(h) }))
    .filter(({ text }) => /,\s*not\s+|\bis not\b|\bare not\b|\bnever\b|\bnot a\b/i.test(text));
  if (negated.length >= 2) {
    const first = negated[0];
    out.push(
      f(
        'negation-headings',
        'Negation-defined headings',
        3,
        `${negated.length} headings define the product by what it is not, starting with "${first.text.slice(0, 60)}" in ${cite(first.h.sourceFile ?? ctx.page.file, first.h.line)}.`,
        'The contrast construction is a stock rhetorical shape of generated copy, and it spends the heading saying nothing concrete.',
        `Rewrite the heading "${first.text.slice(0, 60)}" and every other heading built as a contrast. Do not use a contrast construction (X not Y). State what this product specifically does for this specific customer, directly.`,
        { file: first.h.sourceFile ?? ctx.page.file, line: first.h.line, evidence: first.text.slice(0, 80) },
      ),
    );
  }
  return out;
}

// ── 3.5 one-liner restatement ──────────────────────────────────────────

/** Overlap against the smaller statement: a trimmed copy still restates. */
function restates(a: string, b: string): boolean {
  return tokenOverlap(a, b) >= 0.6 || sharedOverSmaller(a, b) >= 0.6;
}

function sharedOverSmaller(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/[^a-z0-9']+/).filter((w) => w.length >= 3));
  const tb = new Set(b.toLowerCase().split(/[^a-z0-9']+/).filter((w) => w.length >= 3));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

export function detectRestatement(ctx: SignalContext): StructuralFinding[] {
  const spots: { where: string; text: string }[] = [];
  if (ctx.page.metaDescription && ctx.page.metaDescription.length > 30) {
    spots.push({ where: 'the meta description', text: ctx.page.metaDescription });
  }
  const hero = ctx.page.hero;
  if (hero) {
    const h1 = findEl([hero.el], (e) => isHeading(e, 1));
    const paragraphs = findAll([hero.el], (e) => e.tag === 'p');
    const sub = paragraphs.find((p) => textOf(p).length > 30 && p !== h1);
    if (sub) spots.push({ where: 'the hero subhead', text: textOf(sub) });
  }
  const cta = ctx.page.sections.find((s) => s.step === 'cta');
  if (cta) {
    const p = findAll([cta.el], (e) => e.tag === 'p').find((e) => textOf(e).length > 30);
    if (p) spots.push({ where: 'the final call to action', text: textOf(p) });
  }
  if (ctx.page.footer) {
    const p = findAll([ctx.page.footer.el], (e) => e.tag === 'p').find(
      (e) => textOf(e).length > 30 && !/©|copyright|rights reserved/i.test(textOf(e)),
    );
    if (p) spots.push({ where: 'the footer tagline', text: textOf(p) });
  }

  let pairs = 0;
  const involved = new Set<string>();
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      if (restates(spots[i].text, spots[j].text)) {
        pairs++;
        involved.add(spots[i].where);
        involved.add(spots[j].where);
      }
    }
  }
  if (pairs === 0) return [];
  const points = Math.min(9, pairs * 3);
  const copies = involved.size;

  return [
    f(
      'one-liner-restatement',
      'One-liner restatement',
      points,
      `The product one-liner repeats across ${copies} places on the page: ${[...involved].join(', ')}.`,
      'One idea copied into every slot means the sections exist to fill the template, not because each had something new to say.',
      `The product one-liner appears ${copies} times on this page. Keep it in the hero only. Delete the footer tagline entirely. Rewrite the final CTA to say something the hero did not say, such as a specific next step or a specific outcome.`,
      { file: ctx.page.file },
    ),
  ];
}

// ── 3.6 testimonial and social proof structure ─────────────────────────

const QUOTE_KEYS = ['quote', 'text', 'content', 'body', 'review', 'message'];
const NAME_KEYS = ['name', 'author', 'person', 'customer'];
const IMAGE_KEYS = ['image', 'img', 'avatar', 'photo', 'headshot', 'src', 'picture'];
const LINK_KEYS = ['url', 'link', 'href', 'source'];

function testimonialArrays(arrays: DataArray[]): DataArray[] {
  return arrays.filter((a) => {
    if (!a.keys || a.items.length === 0) return false;
    const keys = new Set(a.keys.map((k) => k.toLowerCase()));
    return QUOTE_KEYS.some((k) => keys.has(k)) && NAME_KEYS.some((k) => keys.has(k));
  });
}

export function detectSocialProof(ctx: SignalContext): StructuralFinding[] {
  const parts: string[] = [];
  let points = 0;
  const testimonials = testimonialArrays(ctx.page.arrays);
  const count = testimonials.reduce((n, a) => n + a.length, 0);
  const first = testimonials[0];

  if (first) {
    // Scale by count (section 8): under three testimonials is weak evidence.
    const scale = count >= 3 ? 1 : 0.5;
    const keys = new Set(first.keys!.map((k) => k.toLowerCase()));

    const hasImageKey = IMAGE_KEYS.some((k) => keys.has(k));
    const hasInitialsKey = keys.has('initials');
    const src = ctx.repo.files.get(first.file)?.content ?? '';
    const initialsCode = /initials|charAt\(0\)|\[0\]\)\.join|split\(['"] ['"]\)\s*\.map/.test(src);
    if (hasInitialsKey || (!hasImageKey && initialsCode)) {
      points += Math.round(6 * scale);
      parts.push('avatars are initials in a colored circle, not photographs');
    } else if (!hasImageKey) {
      points += Math.round(3 * scale);
      parts.push('no headshot files back the testimonials');
    }

    const hasLink = LINK_KEYS.some((k) => keys.has(k)) &&
      first.items.some((it) => Object.entries(it).some(([k, v]) => LINK_KEYS.includes(k.toLowerCase()) && /^https?:\/\//.test(v)));
    if (!hasLink) {
      points += Math.round(4 * scale);
      parts.push('no testimonial links to where it was said');
    }

    const ratings = first.items
      .map((it) => it.rating ?? it.stars ?? it.score)
      .filter((v): v is string => v !== undefined);
    if ((ratings.length >= 2 && new Set(ratings).size === 1) || /Array\(5\)|\[\.\.\.Array\(5\)\]/.test(src)) {
      points += 3;
      parts.push('every rating is the same five stars');
    }

    const quotes = first.items
      .map((it) => QUOTE_KEYS.map((k) => it[k]).find(Boolean))
      .filter((q): q is string => Boolean(q));
    if (quotes.length >= 3 && new Set(quotes.map(sentenceCount)).size === 1) {
      points += 3;
      parts.push(`every quote is exactly ${sentenceCount(quotes[0])} sentence${sentenceCount(quotes[0]) === 1 ? '' : 's'} long`);
    }
  }

  // Logo cloud rendered as text instead of logo files.
  const logoArray = ctx.page.arrays.find((a) => /^(?:logos|brands|companies|clients|partners)$/i.test(a.name));
  const logosSection = ctx.page.sections.find((s) => s.step === 'logos');
  if (logoArray?.ofStrings) {
    points += 4;
    parts.push('the logo cloud is text strings, not logo image files');
  } else if (logosSection && !findEl([logosSection.el], (e) => e.tag === 'img' || e.tag === 'Image' || e.tag === 'svg')) {
    const mapped = findEl([logosSection.el], (e) => e.tag === '#map');
    if (mapped || textOf(logosSection.el).length > 0) {
      points += 4;
      parts.push('the logo cloud renders names as text, with no logo files in the repo');
    }
  }

  points = Math.min(20, points);
  if (points === 0 || parts.length === 0) return [];

  const at = first
    ? { file: first.file, line: first.line, evidence: `${first.name}[${first.length}]` }
    : { file: logosSection?.file ?? ctx.page.file, line: logosSection?.line };

  const partSentences = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1) + '.')
    .join(' ');
  return [
    f(
      'social-proof',
      'Social proof structure',
      points,
      `The social proof is shaped like evidence with nothing behind it (${cite(at.file!, at.line)}). ${partSentences}`,
      'Real proof links out: a person you can find, a company that uses the product, a place the quote was said.',
      'Rebuild the testimonials section with real evidence only. Each testimonial needs a headshot image file, full name, title, company, and a link to where this person said it (a case study page, a tweet, a review site). Remove star ratings. Remove any testimonial you cannot source. If that leaves zero, delete the section. Replace the logo cloud with actual logo files of companies that have used the product, or delete it.',
      at,
    ),
  ];
}

// ── 3.7 placeholder residue ────────────────────────────────────────────

export function detectDeadLinks(ctx: SignalContext): StructuralFinding[] {
  let count = 0;
  let firstAt: { file: string; line: number; evidence: string } | null = null;
  for (const file of ctx.uiFiles) {
    for (const m of file.content.matchAll(/(?:href|to)\s*=\s*(?:["'](#?)["']|\{["'](#?)["']\})/g)) {
      count++;
      if (!firstAt) {
        firstAt = {
          file: file.relPath,
          line: file.content.slice(0, m.index).split('\n').length,
          evidence: m[0],
        };
      }
    }
  }
  if (count === 0 || !firstAt) return [];
  const points = Math.min(10, count * 2);
  return [
    f(
      'dead-links',
      'Dead links',
      points,
      `${count} link${count === 1 ? '' : 's'} point at "#" or an empty href, starting at ${cite(firstAt.file, firstAt.line)}.`,
      'A link that goes nowhere is a control drawn to make the page look finished, and one click exposes it.',
      "Remove every link whose href is '#' or empty. For each one, either build the page it promises with real content, or delete the link. Social icons with nowhere to go get deleted too. Do not leave any placeholder link in a shipped file.",
      firstAt,
    ),
  ];
}

const LEAK_RES: { re: RegExp; label: string }[] = [
  { re: /lorem ipsum/i, label: 'lorem ipsum' },
  { re: /\bsection test\b/i, label: 'a test heading' },
  { re: /\bhey there\b/i, label: '"Hey There" filler' },
  { re: />\s*Loading[.…]/, label: 'a stuck "Loading" state' },
  { re: /placeholder(?: text| copy)\b/i, label: 'placeholder copy' },
];

export function detectLeakedPlaceholders(ctx: SignalContext): StructuralFinding[] {
  const leaks: { label: string; file: string; line: number }[] = [];
  for (const file of ctx.uiFiles) {
    for (const { re, label } of LEAK_RES) {
      const line = lineOfMatch(file.content, new RegExp(re.source, re.flags));
      if (line && !leaks.some((l) => l.label === label)) {
        leaks.push({ label, file: file.relPath, line });
      }
    }
  }
  if (leaks.length === 0) return [];
  const points = Math.min(10, leaks.length * 5);
  const firstAt = leaks[0];
  return [
    f(
      'leaked-placeholder',
      'Leaked placeholder text',
      points,
      `Unfinished work shipped: ${leaks.map((l) => l.label).join(', ')}, starting at ${cite(firstAt.file, firstAt.line)}.`,
      'Placeholder text on a live page says nobody read the page before shipping it.',
      `Remove the text "${firstAt.label}" and every other placeholder string on the page. Write the real content it stood in for, or delete the element that held it. Do not leave any placeholder in a shipped file.`,
      firstAt,
    ),
  ];
}

export function detectStaleCopyright(ctx: SignalContext): StructuralFinding[] {
  let maxYear = 0;
  let at: { file: string; line: number } | null = null;
  for (const file of ctx.uiFiles) {
    for (const m of file.content.matchAll(/(?:©|&copy;|copyright)\s*(\d{4})/gi)) {
      const year = parseInt(m[1], 10);
      if (year > maxYear) {
        maxYear = year;
        at = { file: file.relPath, line: file.content.slice(0, m.index).split('\n').length };
      }
    }
  }
  // The spec keys this on the first commit year; a tarball has no git
  // history, so two calendar years back is the provable version.
  if (maxYear === 0 || maxYear > ctx.nowYear - 2 || !at) return [];
  return [
    f(
      'stale-copyright',
      'Stale copyright year',
      3,
      `The footer says © ${maxYear} and it is ${ctx.nowYear} (${cite(at.file, at.line)}).`,
      'A stale year is the small print of an abandoned page, and visitors doing diligence read it that way.',
      'Update the copyright year, and render it from the current date instead of hardcoding it so it never goes stale again.',
      { ...at, evidence: `© ${maxYear}` },
    ),
  ];
}

export function detectPhantomRoutes(ctx: SignalContext): StructuralFinding[] {
  if (!ctx.routes.known || ctx.routes.clientRouter) return [];
  const missing = new Map<string, { file: string; line: number }>();
  for (const file of ctx.uiFiles) {
    for (const m of file.content.matchAll(/(?:href|to)\s*=\s*["'](\/[\w\-/]*)["']/g)) {
      const href = (m[1].replace(/\/$/, '') || '/');
      if (href.startsWith('/api/')) continue;
      if (ctx.routes.routes.has(href)) continue;
      if (ctx.routes.wildcardPrefixes.some((p) => href.startsWith(p))) continue;
      if (!missing.has(href)) {
        missing.set(href, {
          file: file.relPath,
          line: file.content.slice(0, m.index).split('\n').length,
        });
      }
    }
  }
  if (missing.size < 2) return []; // one odd link is noise, a set is a pattern
  const points = Math.min(9, missing.size * 3);
  const names = [...missing.keys()].sort().slice(0, 6);
  const firstAt = missing.get(names[0])!;
  return [
    f(
      'phantom-routes',
      'Links to pages that do not exist',
      points,
      `${missing.size} link${missing.size === 1 ? ' points' : 's point'} at routes with no matching file, starting at ${cite(firstAt.file, firstAt.line)}. Missing: ${names.join(', ')}.`,
      'The navigation promises a company (blog, docs, careers) that does not exist in the repo, and every one of those links is a 404 in production.',
      `These links point at pages that do not exist: ${names.join(', ')}. For each one, either build that page with real content or delete the link. A footer link column must only contain links to pages that exist.`,
      { ...firstAt, evidence: names.join(', ') },
    ),
  ];
}

// ── 3.8 stat strips ────────────────────────────────────────────────────

const ROUND_NUM = /^[~$€£]?\d*(?:[05]|\d\.\d)\s*(?:%|\+|[kKmMbB]\+?|[xX])?$|^\d+\+$|^\d\/\d+$|^24\/7$/;

export function detectStatStrip(ctx: SignalContext): StructuralFinding[] {
  const section = ctx.page.sections.find((s) => s.step === 'stats');
  if (!section) return [];
  const anchors = findAll([section.el], (e) => e.tag === 'a' && /^(?:https?:)?\//.test(e.attrs.href ?? ''));
  if (anchors.length > 0) return []; // sourced stats are the professional shape

  let points = 5;
  const statsArray = ctx.page.arrays.find((a) => /^(?:stats|metrics|numbers)$/i.test(a.name));
  const values: string[] = statsArray
    ? statsArray.items.map((it) => it.value ?? it.number ?? it.stat ?? it.label ?? '').filter(Boolean)
    : findAll([section.el], (e) => childEls(e).length === 0)
        .map((e) => textOf(e).split(/\s+/)[0])
        .filter((t) => /^\d|^[~$€£]\d/.test(t));
  const numbers = values.filter((v) => /\d/.test(v));
  const allRound = numbers.length >= 3 && numbers.every((n) => ROUND_NUM.test(n.trim()));
  if (allRound) points += 3;

  return [
    f(
      'stat-strip',
      'Unsourced stat strip',
      points,
      `A row of ${Math.max(numbers.length, 3)} statistics sits under the hero with no link to any source${allRound ? ', and every number is round' : ''} (${cite(section.file, section.line)}).`,
      'A round number with no source reads as invented, because sourced numbers are specific and clickable.',
      `Remove the stat row unless every number is specific, true, and linked to its source. Replace a claim like "${numbers[0] ?? '100+'}" with the actual count and a link to where it is verifiable. If you cannot source a number, delete it.`,
      { file: section.file, line: section.line, evidence: numbers.slice(0, 4).join(' · ') },
    ),
  ];
}

// ── 3.9 product screenshots built from divs ────────────────────────────

const MEDIA_EXT = /\.(?:png|jpe?g|webp|avif|gif|mp4|webm|mov)$/i;
const NON_PRODUCT_ASSET = /^(?:favicon|og[-_.]|opengraph|twitter-image|icon|logo|apple-touch|placeholder|next|vercel|globe|window|file|vite|react)/i;
/** Where the spec says shipped media lives: public, assets, static. */
const MEDIA_DIR = /(?:^|\/)(?:public|static|assets|images|img|media)\//;
const TEST_ASSET =
  /(?:^|\/)(?:tests?|__tests__|fixtures?|e2e|cypress|playwright|\.storybook|stories)\//i;

export function realMediaAssets(allPaths: string[]): string[] {
  return allPaths.filter((p) => {
    if (!MEDIA_EXT.test(p)) return false;
    if (!MEDIA_DIR.test(p)) return false;
    if (TEST_ASSET.test(p)) return false; // a fixture is not product proof
    const base = p.split('/').pop() ?? '';
    return !NON_PRODUCT_ASSET.test(base);
  });
}

const MOCK_TEXT = /\$\d|(?:^|\s)(?:Active|Paid|Pending|Completed|Just now|Online|Live|Success)(?:$|\s|\b)|\+\d+(?:\.\d+)?%/;

export function detectDivScreenshots(ctx: SignalContext): StructuralFinding[] {
  const out: StructuralFinding[] = [];
  const media = realMediaAssets(ctx.allPaths);

  // Remote media the page loads is media we cannot audit but must not deny.
  const remoteImgs = findAll([ctx.page.root], (e) =>
    (e.tag === 'img' || e.tag === 'Image' || e.tag === 'video') && /^https?:\/\//.test(e.attrs.src ?? ''),
  );

  if (media.length < 3 && remoteImgs.length < 3) {
    out.push(
      f(
        'no-real-media',
        'No real media on a marketing site',
        10,
        `The repo ships ${media.length} product image${media.length === 1 ? '' : 's'} outside icons and logos, for an entire marketing site.`,
        'Professional pages show the product as real captures or photographs, and a page with none is drawing its product instead of showing it.',
        'Add real media: export real screenshots of the product as PNG or WebP, or add real photographs, and place them in the sections that currently describe the product in text. If the product does not exist yet, show nothing rather than a drawing of something that does not exist.',
        { file: ctx.page.file },
      ),
    );
  }

  const hero = ctx.page.hero;
  if (hero) {
    const heroMedia = findEl([hero.el], (e) => e.tag === 'img' || e.tag === 'Image' || e.tag === 'video' || e.tag === 'iframe');
    if (!heroMedia) {
      const mockPanel = findEl([hero.el], (e) => {
        if (!e.classes.some((c) => /^(?:rounded|border|shadow|bg-)/.test(c))) return false;
        const els = findAll([e], () => true);
        if (els.length < 5) return false;
        return MOCK_TEXT.test(textOf(e));
      });
      if (mockPanel) {
        out.push(
          f(
            'div-mock-hero',
            'Hero visual drawn from divs',
            6,
            `The hero visual is a panel of styled divs with invented data ("${textOf(mockPanel).slice(0, 60)}…") at ${cite(mockPanel.sourceFile ?? hero.file, mockPanel.line)}.`,
            'The model cannot take a screenshot, so it draws one out of cards, and that drawing is the whiteboard feel people recognize instantly.',
            'Replace the mock UI built from divs in the hero with a real screenshot of the product exported as a PNG or WebP, or a real photograph. If the product does not exist yet, show nothing rather than a drawing of something that does not exist.',
            { file: mockPanel.sourceFile ?? hero.file, line: mockPanel.line, evidence: textOf(mockPanel).slice(0, 80) },
          ),
        );
      }
    }
  }
  return out;
}

// ── 3.10 CTA label repetition ──────────────────────────────────────────

export function detectCtaRepetition(ctx: SignalContext): StructuralFinding[] {
  const labels: { label: string; el: El }[] = [];
  for (const el of walkEls([ctx.page.root])) {
    if (!(el.tag === 'a' || el.tag === 'button' || /^(?:Link|Button)$/.test(el.tag))) continue;
    const text = textOf(el);
    if (!text || text.length > 32 || text.length < 3) continue;
    labels.push({ label: text.toLowerCase().replace(/\s+/g, ' ').trim(), el });
  }
  if (labels.length === 0) return [];

  const counts = new Map<string, number>();
  for (const { label } of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  const [topLabel, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  // Only action labels count as CTAs for the repetition test; nav links
  // repeat legitimately ("Pricing" in nav and footer).
  const actionish = /get|start|try|sign|join|book|buy|learn|discover|see|watch|claim|request|contact|download/;
  let points = 0;
  const reasons: string[] = [];
  if (topCount > 2 && actionish.test(topLabel)) {
    points += 4;
    reasons.push(`"${topLabel}" appears ${topCount} times`);
  }
  const sectionCount = ctx.page.sections.filter((s) => s.step && s.step !== 'footer').length;
  const distinctActions = [...counts.keys()].filter((l) => actionish.test(l)).length;
  if (sectionCount >= 6 && distinctActions > 0 && distinctActions < 4) {
    points += 4;
    reasons.push(`only ${distinctActions} distinct action label${distinctActions === 1 ? '' : 's'} across ${sectionCount} sections`);
  }
  if (points === 0) return [];

  const firstEl = labels.find((l) => l.label === topLabel)!.el;
  return [
    f(
      'cta-repetition',
      'One CTA label doing every job',
      points,
      `${reasons.join(', and ')} (first at ${cite(firstEl.sourceFile ?? ctx.page.file, firstEl.line)}).`,
      'Professional pages change the button verb with each section’s purpose, so a repeated label means no section has a purpose of its own.',
      `Give every section its own call to action that names what happens next in that section. Do not reuse "${topLabel}" more than once on the page. Delete secondary buttons that only scroll to the next section.`,
      { file: firstEl.sourceFile ?? ctx.page.file, line: firstEl.line, evidence: topLabel },
    ),
  ];
}

// ── 3.11 route depth ───────────────────────────────────────────────────

export function detectRouteDepth(ctx: SignalContext): StructuralFinding[] {
  const out: StructuralFinding[] = [];
  const anchorLinks: El[] = [];
  for (const nav of ctx.page.navEls) {
    anchorLinks.push(...findAll([nav], (e) => e.tag === 'a' && (e.attrs.href ?? '').startsWith('#')));
  }

  if (ctx.routes.known && !ctx.routes.clientRouter && ctx.routes.routes.size <= 1 && anchorLinks.length >= 3) {
    const firstAt = anchorLinks[0];
    out.push(
      f(
        'route-depth',
        'One page pretending to be a site',
        6,
        `The site has ${ctx.routes.routes.size <= 1 ? 'a single route' : 'few routes'} and the nav is ${anchorLinks.length} anchor links (#features, #pricing) starting at ${cite(firstAt.sourceFile ?? ctx.page.file, firstAt.line)}.`,
        'A professional footer proves depth with working links to real pages, and an anchor-only nav proves there is nothing behind the homepage.',
        'The site has one route and a nav of anchor links. Either build the pages the nav promises (each with content that would not fit on the homepage) or collapse the nav to only what exists. A footer link column must only contain links to pages that exist.',
        { file: firstAt.sourceFile ?? ctx.page.file, line: firstAt.line, evidence: firstAt.attrs.href },
      ),
    );
  }

  const footer = ctx.page.footer;
  if (footer && ctx.routes.known && !ctx.routes.clientRouter) {
    const links = findAll([footer.el], (e) => e.tag === 'a');
    if (links.length >= 6) {
      const dead = links.filter((l) => {
        const href = l.attrs.href ?? '';
        if (href === '#' || href === '') return true;
        if (!href.startsWith('/')) return false;
        const clean = href.replace(/\/$/, '') || '/';
        if (clean.startsWith('/api/')) return false;
        return !ctx.routes.routes.has(clean) && !ctx.routes.wildcardPrefixes.some((p) => clean.startsWith(p));
      });
      if (dead.length > links.length / 2) {
        out.push(
          f(
            'route-depth',
            'A footer of dead links',
            6,
            `${dead.length} of ${links.length} footer links lead nowhere (${cite(footer.file, footer.line)}).`,
            'The footer is where a real company proves its depth, and this one is a set dressing of links that 404.',
            'Delete every footer link that does not lead to a real page. A footer link column must only contain links to pages that exist. Rebuild the columns from what the site actually has, even if that is three links.',
            { file: footer.file, line: footer.line },
          ),
        );
      }
    }
  }
  return out;
}

// ── 3.12 emoji and icon grids ──────────────────────────────────────────

const EMOJI_RE = /\p{Extended_Pictographic}/u;

export function detectEmojiIcons(ctx: SignalContext): StructuralFinding[] {
  const out: StructuralFinding[] = [];
  const emojiEls: El[] = [];
  for (const el of walkEls([ctx.page.root])) {
    const own = ownText(el);
    if (own && own.length <= 4 && EMOJI_RE.test(own) && childEls(el).length === 0) {
      emojiEls.push(el);
    }
  }
  // Emoji inside data arrays render through a #map we cannot see into.
  const emojiArrayItems = ctx.page.arrays.reduce(
    (n, a) => n + a.items.filter((it) => Object.values(it).some((v) => v.length <= 4 && EMOJI_RE.test(v))).length,
    0,
  );
  const emojiCount = emojiEls.length + emojiArrayItems;
  if (emojiCount >= 3) {
    const at = emojiEls[0]
      ? { file: emojiEls[0].sourceFile ?? ctx.page.file, line: emojiEls[0].line, evidence: ownText(emojiEls[0]) }
      : { file: ctx.page.arrays.find((a) => a.items.some((it) => Object.values(it).some((v) => EMOJI_RE.test(v))))?.file ?? ctx.page.file };
    out.push(
      f(
        'emoji-icons',
        'Emoji as icons',
        6,
        `${emojiCount} emoji stand in for icons on the page, starting at ${cite(at.file!, at.line)}.`,
        'Emoji render differently on every platform and mark the exact spot where a generator needed an icon and had none.',
        'Remove all emoji used as icons. Remove the icon from each feature card. If a feature needs a visual, use a cropped screenshot of that feature. Cards without a visual should be text only.',
        at,
      ),
    );
  }

  // Icon-in-rounded-square wrappers, one per card, in a uniform grid.
  const iconLibs = new Set<string>();
  for (const file of ctx.page.files) {
    const parsed = ctx.repo.parse(file);
    if (!parsed) continue;
    for (const pkg of parsed.packageImports.values()) {
      if (/lucide|heroicons|react-icons|tabler|phosphor|feather|fontawesome/i.test(pkg)) iconLibs.add(pkg);
    }
  }
  if (iconLibs.size > 0) {
    const wrappers = findAll([ctx.page.root], (e) =>
      e.classes.some((c) => /^rounded/.test(c)) &&
      e.classes.some((c) => /^[wh]-\d+$|^size-\d+$/.test(c)) &&
      childEls(e).length >= 1 &&
      childEls(e).every((k) => /^[A-Z]/.test(k.tag) && childEls(k).length === 0),
    );
    const iconInMap = ctx.page.arrays.some((a) => a.keys?.some((k) => /^icon$/i.test(k)));
    if (wrappers.length > 2 || (iconInMap && wrappers.length >= 1)) {
      const firstAt = wrappers[0];
      out.push(
        f(
          'icon-grid',
          'Uniform icon grid',
          4,
          `${Math.max(wrappers.length, 3)} feature cards each open with a library icon in a rounded square (${cite(firstAt?.sourceFile ?? ctx.page.file, firstAt?.line)}).`,
          'One icon per card in a uniform grid is the stock decoration of a generated feature section, and it shows every feature mattering equally, which means none does.',
          'Remove the icon from each feature card. If a feature needs a visual, use a cropped screenshot of that feature. Cards without a visual should be text only.',
          { file: firstAt?.sourceFile ?? ctx.page.file, line: firstAt?.line },
        ),
      );
    }
  }
  return out;
}

// ── 3.13 feature grid uniformity ───────────────────────────────────────

export function detectFeatureGrids(ctx: SignalContext): StructuralFinding[] {
  const grids: { section: ClassifiedSection; count: number; at: El }[] = [];
  for (const section of ctx.page.sections) {
    if (section.step === 'footer') continue;
    for (const el of walkEls([section.el])) {
      if (!el.classes.some((c) => /^grid$|^grid-cols-/.test(c))) continue;
      const kids = childEls(el);
      const map = kids.find((k) => k.tag === '#map');
      const size = map ? map.map!.length ?? 0 : kids.length;
      const uniform = map
        ? map.map!.keys !== null
        : kids.length > 0 && kids.every((k) => k.tag === kids[0].tag);
      if (size === 6 && uniform) {
        grids.push({ section, count: size, at: el });
        break;
      }
    }
  }
  if (grids.length === 0) return [];
  const points = Math.min(10, grids.length * 5);
  const first = grids[0];
  const label = first.section.step ? STEP_LABEL[first.section.step] : first.section.label;
  return [
    f(
      'feature-grid-uniformity',
      'The six-card feature grid',
      points,
      `${grids.length === 1 ? 'A' : `${grids.length}`} 3x2 grid${grids.length === 1 ? '' : 's'} of six identical cards (${cite(first.at.sourceFile ?? first.section.file, first.at.line)}).`,
      'Six equal cards say every feature matters equally, which a reader correctly hears as no feature mattering at all.',
      `Rebuild the ${label} so the blocks are different sizes. Give the most important feature the most space and a real screenshot. Give minor features one line each. Merge or delete any feature whose description is generic.`,
      { file: first.at.sourceFile ?? first.section.file, line: first.at.line },
    ),
  ];
}

// ── the template script (section 2) ────────────────────────────────────

export function detectTemplateScript(ctx: SignalContext): StructuralFinding[] {
  const matched = ctx.page.scriptMatch;
  let points = 0;
  if (matched >= 7) points = 10;
  else if (matched >= 5) points = 5;
  if (points === 0) return [];
  const steps = ctx.page.sequence.map((s) => STEP_LABEL[s]).join(' → ');
  return [
    f(
      'template-script',
      'The template script',
      points,
      `${matched} of the script's 10 steps appear in canonical order on ${ctx.page.file}, from ${STEP_LABEL[ctx.page.sequence[0]]} to ${STEP_LABEL[ctx.page.sequence[ctx.page.sequence.length - 1]]}.`,
      'This exact section order ships on thousands of generated landing pages, and a visitor who has seen it all week discounts the product before reading a word.',
      `Break the script in ${ctx.page.file}. Delete every section that exists only because the template has a slot for it. Keep only sections with something specific to show. Reorder what remains around the one thing only this product can demonstrate. Professional sites skip steps freely.`,
      { file: ctx.page.file, evidence: steps },
    ),
  ];
}
