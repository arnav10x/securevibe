// The shared page model for the UI/UX grader (SECUREVIBE-GRADING.md).
//
// Both parsers — the TSX/JSX parser built on the TypeScript compiler API
// and the small HTML parser — produce this one tree shape, so every
// detector in signals.ts is written once and runs against React pages and
// static HTML alike. The spec's rule is "do not rely on regex for
// structure"; this tree is what structure means here.

/** A text run inside an element. */
export interface TextNode {
  kind: 'text';
  text: string;
  line: number;
}

/**
 * A rendered element. `tag` keeps the author's casing so `Hero` stays
 * distinguishable from `section`; lowercase means a plain HTML tag.
 */
export interface El {
  kind: 'el';
  tag: string;
  /** Attributes whose value was statically knowable. Lowercased names. */
  attrs: Record<string, string>;
  /** Class tokens from class/className, static parts of templates included. */
  classes: string[];
  children: Node[];
  /** 1-based line in the source file this element came from. */
  line: number;
  /** Set when this subtree came from a resolved component in another file. */
  sourceFile?: string;
  /** The component name this subtree was resolved from, when it was. */
  origComponent?: string;
  /**
   * Set on the synthetic '#map' element that stands where `{arr.map(...)}`
   * appeared: the section renders from data, and the spec scores that.
   */
  map?: MapRender;
}

export interface MapRender {
  /** The identifier being mapped, e.g. "features". */
  arrayName: string;
  /** Element count when the array literal was found in scope, else null. */
  length: number | null;
  /** Shared key set of the array's object items, when uniform. */
  keys: string[] | null;
  /** The JSX returned per item, when the callback returned one element. */
  item: El | null;
}

export type Node = El | TextNode;

/** A `const x = [...]` of object literals (or plain strings). */
export interface DataArray {
  name: string;
  file: string;
  line: number;
  length: number;
  /** Sorted key set when every item shares it; null for string arrays. */
  keys: string[] | null;
  /** String-literal properties per item, for content checks. Bounded. */
  items: Record<string, string>[];
  /** True for `const logos = ['A', 'B']`-style arrays of bare strings. */
  ofStrings?: boolean;
}

/** What one source file parses into. */
export interface ParsedSource {
  file: string;
  /** Component name -> the root JSX it returns (top-level JSX per component). */
  components: Map<string, El[]>;
  /** The component the file default-exports, when identifiable. */
  defaultExport: string | null;
  /** Local import name -> module specifier (relative and alias paths only). */
  imports: Map<string, string>;
  /** Local import name -> npm package it came from (icon libraries etc). */
  packageImports: Map<string, string>;
  arrays: DataArray[];
  /** metadata/meta description found in this file (Next metadata or <meta>). */
  metaDescription: string | null;
}

export function isEl(n: Node): n is El {
  return n.kind === 'el';
}

/** Depth-first walk over every element in a tree. */
export function* walkEls(nodes: Node[]): Generator<El> {
  for (const n of nodes) {
    if (n.kind !== 'el') continue;
    yield n;
    yield* walkEls(n.children);
  }
}

/** Every element plus its parent, for sibling-sensitive checks. */
export function* walkWithParent(
  nodes: Node[],
  parent: El | null = null,
): Generator<{ el: El; parent: El | null }> {
  for (const n of nodes) {
    if (n.kind !== 'el') continue;
    yield { el: n, parent };
    yield* walkWithParent(n.children, n);
  }
}

/** Visible text of a subtree, joined with single spaces. */
export function textOf(n: Node): string {
  if (n.kind === 'text') return n.text;
  return n.children.map(textOf).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/** Direct child elements only. */
export function childEls(el: El): El[] {
  return el.children.filter(isEl);
}

/** The element's own immediate text (not descendants'), trimmed. */
export function ownText(el: El): string {
  return el.children
    .filter((c): c is TextNode => c.kind === 'text')
    .map((c) => c.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasClass(el: El, re: RegExp): boolean {
  return el.classes.some((c) => re.test(c));
}

const HEADING = /^h[1-6]$/;

export function isHeading(el: El, level?: number): boolean {
  if (level) return el.tag === `h${level}`;
  return HEADING.test(el.tag);
}

/** First element matching `pred` in the subtree, or null. */
export function findEl(nodes: Node[], pred: (el: El) => boolean): El | null {
  for (const el of walkEls(nodes)) {
    if (pred(el)) return el;
  }
  return null;
}

export function findAll(nodes: Node[], pred: (el: El) => boolean): El[] {
  const out: El[] = [];
  for (const el of walkEls(nodes)) {
    if (pred(el)) out.push(el);
  }
  return out;
}

/** True for tags that render as anchors or buttons. */
export function isInteractive(el: El): boolean {
  return el.tag === 'a' || el.tag === 'button' || /button|link/i.test(el.tag);
}

/** How many sentences a quote contains, by terminal punctuation. */
export function sentenceCount(text: string): number {
  const marks = text.match(/[.!?](?:\s|$|["'”])/g);
  if (!marks) return text.trim() ? 1 : 0;
  return marks.length;
}

/**
 * Content-word tokens for the restatement check: lowercased words with the
 * grammar words dropped, so overlap measures shared meaning, not shared
 * articles.
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'for', 'with', 'without', 'your',
  'you', 'to', 'of', 'in', 'on', 'at', 'by', 'is', 'are', 'it', 'its',
  'that', 'this', 'we', 'our', 'all', 'any', 'get', 'more', 'from', 'into',
]);

export function contentTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9']+/)) {
    const w = raw.replace(/^'+|'+$/g, '');
    if (w.length >= 2 && !STOPWORDS.has(w)) out.add(w);
  }
  return out;
}

/** Jaccard overlap of content tokens, 0..1. */
export function tokenOverlap(a: string, b: string): number {
  const ta = contentTokens(a);
  const tb = contentTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared++;
  return shared / (ta.size + tb.size - shared);
}
