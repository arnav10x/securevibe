// HTML -> element tree: a small, tolerant stack parser for static sites
// and template-flavored files (.html, .astro, .vue, .svelte).
//
// It tokenizes tags and builds a tree, forgiving the mistakes shipped
// pages actually contain (unclosed <p>, stray </div>). It is a parser,
// not a regex over structure: nesting, siblings, and attributes all
// survive, which is what the eyebrow and section checks need.

import type { El, Node, ParsedSource } from './model';

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'param', 'source', 'track', 'wbr',
]);

/** Tags whose raw content is never markup. */
const RAW = new Set(['script', 'style']);

const ATTR_RE = /([^\s=/>"']+)\s*(?:=\s*("([^"]*)"|'([^']*)'|[^\s>]+))?/g;

function parseAttrs(raw: string): { attrs: Record<string, string>; classes: string[] } {
  const attrs: Record<string, string> = {};
  const classes: string[] = [];
  for (const m of raw.matchAll(ATTR_RE)) {
    const name = m[1].toLowerCase();
    let value = m[3] ?? m[4] ?? m[2] ?? 'true';
    // Astro/Vue expression values are not static; keep static text only.
    if (value.startsWith('{') || value.startsWith('`')) value = '';
    if (name === 'class' || name === 'class:list' || name === ':class') {
      classes.push(...value.split(/\s+/).filter(Boolean));
    } else {
      attrs[name] = value;
    }
  }
  return { attrs, classes };
}

export function parseHtml(file: string, source: string): El[] {
  let content = source;

  // .astro frontmatter fence, .vue/.svelte script and style blocks: not markup.
  if (/\.astro$/.test(file)) {
    content = content.replace(/^---[\s\S]*?---/, (m) => m.replace(/[^\n]/g, ' '));
  }
  if (/\.(?:vue|svelte)$/.test(file)) {
    content = content.replace(/<script[\s\S]*?<\/script>/gi, (m) => m.replace(/[^\n]/g, ' '));
    content = content.replace(/<style[\s\S]*?<\/style>/gi, (m) => m.replace(/[^\n]/g, ' '));
  }

  // Precompute line starts for O(log n) lookups on big files.
  const lineStarts: number[] = [0];
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) lineStarts.push(i + 1);
  }
  const lineAt = (index: number): number => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };

  const roots: El[] = [];
  const stack: El[] = [];
  const parentChildren = (): Node[] => (stack.length > 0 ? stack[stack.length - 1].children : roots as unknown as Node[]);

  const pushText = (text: string, index: number): void => {
    const collapsed = text.replace(/\s+/g, ' ').trim();
    if (!collapsed) return;
    // Template expressions render dynamic content; drop the braces' insides
    // but keep surrounding static text.
    const cleaned = collapsed.replace(/\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned) parentChildren().push({ kind: 'text', text: cleaned, line: lineAt(index) });
  };

  let i = 0;
  while (i < content.length) {
    const lt = content.indexOf('<', i);
    if (lt === -1) {
      pushText(content.slice(i), i);
      break;
    }
    if (lt > i) pushText(content.slice(i, lt), i);

    // Comment or doctype.
    if (content.startsWith('<!--', lt)) {
      const end = content.indexOf('-->', lt + 4);
      i = end === -1 ? content.length : end + 3;
      continue;
    }
    if (content.startsWith('<!', lt)) {
      const end = content.indexOf('>', lt);
      i = end === -1 ? content.length : end + 1;
      continue;
    }

    // Closing tag.
    if (content.startsWith('</', lt)) {
      const end = content.indexOf('>', lt);
      if (end === -1) break;
      const tag = content.slice(lt + 2, end).trim().toLowerCase().split(/[\s/]/)[0];
      // Close up to the matching open tag; ignore a close with no match.
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s].tag.toLowerCase() === tag) {
          stack.length = s;
          break;
        }
      }
      i = end + 1;
      continue;
    }

    // Opening tag.
    const end = content.indexOf('>', lt);
    if (end === -1) break;
    const inner = content.slice(lt + 1, end);
    const selfClosed = inner.endsWith('/');
    const body = selfClosed ? inner.slice(0, -1) : inner;
    const spaceIdx = body.search(/[\s\n]/);
    const tag = (spaceIdx === -1 ? body : body.slice(0, spaceIdx)).trim();
    if (!/^[a-zA-Z][\w.:-]*$/.test(tag)) {
      i = end + 1;
      continue;
    }
    const { attrs, classes } = parseAttrs(spaceIdx === -1 ? '' : body.slice(spaceIdx));
    const el: El = {
      kind: 'el',
      tag: /^[a-z]/.test(tag) ? tag.toLowerCase() : tag,
      attrs,
      classes,
      children: [],
      line: lineAt(lt),
    };
    parentChildren().push(el);
    i = end + 1;

    const lower = tag.toLowerCase();
    if (RAW.has(lower)) {
      // Swallow raw content up to the closing tag; keep style text for
      // the dialect check by storing it as the element's text.
      const close = content.toLowerCase().indexOf(`</${lower}`, i);
      const rawEnd = close === -1 ? content.length : close;
      if (lower === 'style') {
        el.children.push({ kind: 'text', text: content.slice(i, rawEnd), line: lineAt(i) });
      }
      const closeEnd = content.indexOf('>', rawEnd);
      i = closeEnd === -1 ? content.length : closeEnd + 1;
      continue;
    }
    if (!selfClosed && !VOID.has(lower)) stack.push(el);
  }

  return roots;
}

/** Wrap an HTML file in the ParsedSource shape the aggregator expects. */
export function parseHtmlSource(file: string, content: string): ParsedSource {
  const roots = parseHtml(file, content);
  const components = new Map<string, El[]>();
  components.set('(document)', roots);

  let metaDescription: string | null = null;
  const stackWalk = (els: El[]): void => {
    for (const el of els) {
      if (
        el.tag === 'meta' &&
        (el.attrs.name === 'description' || el.attrs.property === 'og:description') &&
        el.attrs.content
      ) {
        metaDescription ??= el.attrs.content;
      }
      stackWalk(el.children.filter((c): c is El => c.kind === 'el'));
    }
  };
  stackWalk(roots);

  return {
    file,
    components,
    defaultExport: '(document)',
    imports: new Map(),
    packageImports: new Map(),
    arrays: [],
    metaDescription,
  };
}
