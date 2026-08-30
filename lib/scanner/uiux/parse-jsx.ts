// TSX/JSX -> element tree, on the TypeScript compiler API.
//
// SECUREVIBE-GRADING.md section 8 is explicit: use an AST for structure,
// keep regex for copy greps. This file is the AST half. It reads one
// source file and reports, per component, the JSX it returns — with three
// constructs the grader cares about made explicit:
//
//   {items.map(item => <Card/>)}  ->  a '#map' element (content-as-data)
//   {cond && <X/>} / ternaries    ->  both branches kept (they render)
//   const features = [{...}]      ->  a DataArray with its key set
//
// The parser never executes anything and tolerates code it cannot
// statically read: a dynamic attribute is simply absent from the tree.

import ts from 'typescript';
import type { DataArray, El, MapRender, Node, ParsedSource } from './model';

/** Attribute values we can read without running the program. */
function staticString(expr: ts.Expression): string | null {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return expr.text;
  }
  if (ts.isTemplateExpression(expr)) {
    const parts = [expr.head.text, ...expr.templateSpans.map((s) => s.literal.text)];
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }
  if (ts.isConditionalExpression(expr)) {
    const a = staticString(expr.whenTrue);
    const b = staticString(expr.whenFalse);
    if (a !== null || b !== null) return [a, b].filter((x) => x !== null).join(' ');
  }
  if (ts.isParenthesizedExpression(expr)) return staticString(expr.expression);
  return null;
}

/** The last identifier of `a.b.items` — the name a human would use. */
function tailName(expr: ts.Expression): string {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  if (ts.isCallExpression(expr)) return tailName(expr.expression);
  return expr.getText().slice(0, 40);
}

export function parseJsxSource(file: string, content: string): ParsedSource {
  const sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lineAt = (node: ts.Node): number =>
    sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

  const components = new Map<string, El[]>();
  const imports = new Map<string, string>();
  const packageImports = new Map<string, string>();
  const arrays: DataArray[] = [];
  let defaultExport: string | null = null;
  let metaDescription: string | null = null;

  // ── JSX conversion ───────────────────────────────────────────────────

  function convertAttrs(
    attrs: ts.JsxAttributes,
  ): { attrs: Record<string, string>; classes: string[] } {
    const out: Record<string, string> = {};
    const classes: string[] = [];
    for (const a of attrs.properties) {
      if (!ts.isJsxAttribute(a)) continue;
      const name = a.name.getText(sf).toLowerCase();
      let value: string | null = null;
      if (a.initializer === undefined) value = 'true';
      else if (ts.isStringLiteral(a.initializer)) value = a.initializer.text;
      else if (ts.isJsxExpression(a.initializer) && a.initializer.expression) {
        value = staticString(a.initializer.expression);
      }
      if (value === null) continue;
      if (name === 'classname' || name === 'class') {
        classes.push(...value.split(/\s+/).filter(Boolean));
      } else {
        out[name] = value;
      }
    }
    return { attrs: out, classes };
  }

  /** The first JSX root inside an arrow/function body, converted. */
  function firstJsxIn(node: ts.Node): El | null {
    let found: El | null = null;
    const visit = (n: ts.Node): void => {
      if (found) return;
      if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
        const el = convertJsx(n);
        if (el) found = el;
        return;
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
    return found;
  }

  function mapElement(call: ts.CallExpression): El {
    const target = (call.expression as ts.PropertyAccessExpression).expression;
    const cb = call.arguments[0];
    let item: El | null = null;
    if (cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))) {
      item = firstJsxIn(cb.body);
    }
    const map: MapRender = {
      arrayName: tailName(target),
      length: null,
      keys: null,
      item,
    };
    return {
      kind: 'el',
      tag: '#map',
      attrs: {},
      classes: [],
      children: item ? [item] : [],
      line: lineAt(call),
      map,
    };
  }

  /** Children of a JSX expression container that actually render. */
  function convertExpression(expr: ts.Expression, out: Node[]): void {
    if (ts.isParenthesizedExpression(expr)) return convertExpression(expr.expression, out);
    if (ts.isJsxElement(expr) || ts.isJsxSelfClosingElement(expr) || ts.isJsxFragment(expr)) {
      const el = convertJsx(expr);
      if (el) out.push(el);
      return;
    }
    const text = staticString(expr);
    if (text !== null) {
      if (text.trim()) out.push({ kind: 'text', text: text.trim(), line: lineAt(expr) });
      return;
    }
    if (
      ts.isCallExpression(expr) &&
      ts.isPropertyAccessExpression(expr.expression) &&
      expr.expression.name.text === 'map'
    ) {
      out.push(mapElement(expr));
      return;
    }
    if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return convertExpression(expr.right, out);
    }
    if (ts.isConditionalExpression(expr)) {
      convertExpression(expr.whenTrue, out);
      convertExpression(expr.whenFalse, out);
    }
  }

  function convertChildren(children: ts.NodeArray<ts.JsxChild>): Node[] {
    const out: Node[] = [];
    for (const child of children) {
      if (ts.isJsxText(child)) {
        const text = child.text.replace(/\s+/g, ' ').trim();
        if (text) out.push({ kind: 'text', text, line: lineAt(child) });
      } else if (ts.isJsxExpression(child)) {
        if (child.expression) convertExpression(child.expression, out);
      } else if (
        ts.isJsxElement(child) ||
        ts.isJsxSelfClosingElement(child) ||
        ts.isJsxFragment(child)
      ) {
        const el = convertJsx(child);
        if (el) out.push(el);
      }
    }
    return out;
  }

  function convertJsx(
    node: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment,
  ): El | null {
    if (ts.isJsxFragment(node)) {
      return {
        kind: 'el',
        tag: '#fragment',
        attrs: {},
        classes: [],
        children: convertChildren(node.children),
        line: lineAt(node),
      };
    }
    const opening = ts.isJsxElement(node) ? node.openingElement : node;
    const tag = opening.tagName.getText(sf);
    const { attrs, classes } = convertAttrs(opening.attributes);
    return {
      kind: 'el',
      tag,
      attrs,
      classes,
      children: ts.isJsxElement(node) ? convertChildren(node.children) : [],
      line: lineAt(node),
    };
  }

  // ── component discovery ──────────────────────────────────────────────

  /** The function-like ancestor a JSX root belongs to, named. */
  function componentNameFor(node: ts.Node): string {
    let cur: ts.Node | undefined = node.parent;
    while (cur) {
      if (ts.isFunctionDeclaration(cur) && cur.name) return cur.name.text;
      if ((ts.isArrowFunction(cur) || ts.isFunctionExpression(cur)) && cur.parent) {
        const p = cur.parent;
        if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
        if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) return p.name.text;
      }
      cur = cur.parent;
    }
    return '(module)';
  }

  function isDefaultExported(fn: ts.FunctionDeclaration): boolean {
    const mods = ts.getModifiers(fn) ?? [];
    return (
      mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
      mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
    );
  }

  // ── arrays of object literals ────────────────────────────────────────

  const MAX_ITEMS = 40;
  const MAX_VALUE = 400;

  function readArray(decl: ts.VariableDeclaration): void {
    if (!ts.isIdentifier(decl.name) || !decl.initializer) return;
    let init: ts.Expression = decl.initializer;
    if (ts.isAsExpression(init) || ts.isSatisfiesExpression(init)) init = init.expression;
    if (!ts.isArrayLiteralExpression(init)) return;

    // Arrays of bare strings matter too: `const logos = ['Acme', ...]` is
    // a logo cloud with no logo files behind it.
    const strings = init.elements.filter(
      (e): e is ts.StringLiteral => ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e),
    );
    if (strings.length >= 3 && strings.length === init.elements.length) {
      arrays.push({
        name: decl.name.text,
        file,
        line: lineAt(decl),
        length: strings.length,
        keys: null,
        items: strings.slice(0, MAX_ITEMS).map((s) => ({ value: s.text.slice(0, MAX_VALUE) })),
        ofStrings: true,
      });
      return;
    }

    const objects = init.elements.filter(ts.isObjectLiteralExpression);
    if (objects.length < 2 || objects.length < init.elements.length * 0.8) return;

    const keySets: string[][] = [];
    const items: Record<string, string>[] = [];
    for (const obj of objects.slice(0, MAX_ITEMS)) {
      const keys: string[] = [];
      const item: Record<string, string> = {};
      for (const prop of obj.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)
          ? prop.name.text
          : null;
        if (!key) continue;
        keys.push(key);
        const value = staticString(prop.initializer);
        if (value !== null) item[key] = value.slice(0, MAX_VALUE);
        else if (ts.isNumericLiteral(prop.initializer)) item[key] = prop.initializer.text;
      }
      keySets.push(keys.sort());
      items.push(item);
    }

    // "Same key set" per the spec, with a small allowance for one optional
    // property (a `badge` on the popular tier is still the same shape).
    const union = new Set<string>();
    const counts = new Map<string, number>();
    for (const keys of keySets) {
      for (const k of keys) {
        union.add(k);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    const core = [...union].filter((k) => (counts.get(k) ?? 0) >= keySets.length * 0.8);
    const uniform = keySets.every((keys) => {
      const set = new Set(keys);
      return core.filter((k) => set.has(k)).length >= Math.max(1, core.length - 1);
    });

    arrays.push({
      name: decl.name.text,
      file,
      line: lineAt(decl),
      length: init.elements.length,
      keys: uniform && core.length > 0 ? core.sort() : null,
      items,
    });
  }

  // ── metadata description ─────────────────────────────────────────────

  function readMetadata(decl: ts.VariableDeclaration): void {
    if (!ts.isIdentifier(decl.name) || decl.name.text !== 'metadata') return;
    if (!decl.initializer) return;
    let init: ts.Expression = decl.initializer;
    if (ts.isAsExpression(init) || ts.isSatisfiesExpression(init)) init = init.expression;
    if (!ts.isObjectLiteralExpression(init)) return;
    for (const prop of init.properties) {
      if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
      if (prop.name.text !== 'description') continue;
      const value = staticString(prop.initializer);
      if (value) metaDescription = value;
    }
  }

  // ── the outer walk ───────────────────────────────────────────────────

  function visit(node: ts.Node): void {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      // A JSX root: convert the whole subtree here, do not re-walk into it.
      const el = convertJsx(node);
      if (el) {
        const name = componentNameFor(node);
        const list = components.get(name) ?? [];
        list.push(el);
        components.set(name, list);
      }
      return;
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      const local = /^[./]|^@\/|^~\/|^src\//.test(spec);
      const clause = node.importClause;
      const record = (name: string) =>
        local ? imports.set(name, spec) : packageImports.set(name, spec);
      if (clause?.name) record(clause.name.text);
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const e of clause.namedBindings.elements) record(e.name.text);
      }
    }
    if (ts.isVariableDeclaration(node)) {
      readArray(node);
      readMetadata(node);
    }
    if (ts.isFunctionDeclaration(node) && node.name && isDefaultExported(node)) {
      defaultExport = node.name.text;
    }
    if (ts.isExportAssignment(node) && !node.isExportEquals && ts.isIdentifier(node.expression)) {
      defaultExport = node.expression.text;
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);

  // Resolve #map placeholders against arrays declared in this file, so a
  // section mapped over a local const knows its length and item shape.
  const byName = new Map(arrays.map((a) => [a.name, a] as const));
  for (const roots of components.values()) {
    for (const el of roots) fillMapData(el, byName);
  }

  return { file, components, defaultExport, imports, packageImports, arrays, metaDescription };
}

export function fillMapData(el: El, arraysByName: Map<string, DataArray>): void {
  if (el.map && el.map.length === null) {
    const arr = arraysByName.get(el.map.arrayName);
    if (arr) {
      el.map.length = arr.length;
      el.map.keys = arr.keys;
    }
  }
  for (const child of el.children) {
    if (child.kind === 'el') fillMapData(child, arraysByName);
  }
}
