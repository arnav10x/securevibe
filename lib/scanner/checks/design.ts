// The craft audit. Two layers of detection work together:
//
//   1. Per-file rules from rules/design-rules.ts (regex hits with evidence)
//   2. Project-wide signals that only make sense in aggregate — whether a
//      design token system exists at all, how default utilities compare to
//      project tokens, state coverage, typography discipline
//
// The score answers ONE question, from SECUREVIBE.md: how much human
// judgment was applied after generation? Detection happens here; the craft
// score itself is computed in grade.ts from the hits this file reports.
//
// Absence is a tell. No theme extension, no empty states, no error
// boundary, no focus styles: each absence is a finding in its own right.
//
// Provenance markers (CLAUDE.md, .cursorrules, generator fingerprints) are
// recorded as CONTEXT and never subtract points. Penalizing a CLAUDE.md
// would penalize exactly the disciplined users this product wants.
//
// Usage from the orchestrator:
//   const design = new DesignAnalyzer();
//   design.addFile(relPath, content);   // once per text file, in the walk loop
//   const audit = design.finish();      // findings + layer hits, once at the end

import path from 'node:path';
import type { Confidence, Finding, Severity } from '../types';
import { isPatternDefinitionLine, matchIsInsideProseString } from '../util';
import { CSS, DESIGN_RULES, UI, type CraftLayerId, type DesignRule } from '../rules/design-rules';
import type { Ceiling, DimensionId, PositiveSignal } from '../craft-score';
import { DIMENSION_MAX } from '../craft-score';

/** One rule's aggregate result, handed to grade.ts for scoring. */
export interface LayerHit {
  ruleId: string;
  title: string;
  layer: CraftLayerId;
  severity: Severity;
  count: number;
  vibeWeight: number;
  loadBearing: boolean;
}

export interface DesignAudit {
  findings: Finding[];
  notes: string[];
  /** Workflow markers recorded as context. Never scored. */
  provenance: string[];
  /** Distinct tell IDs that fired (drives the density multiplier). */
  tells: string[];
  /** Positive evidence of decisions: the only way points are earned. */
  positives: PositiveSignal[];
  /** Score ceilings triggered by detections. The lowest one binds. */
  ceilings: Ceiling[];
  /** Per-dimension point caps imposed by tell effects. */
  dimensionCaps: Partial<Record<DimensionId, number>>;
  /**
   * True when the repo reads as pre-launch (no pricing, no testimonials):
   * operational-evidence scoring normalizes over the subset that applies,
   * because honesty about having no customers must not be punished.
   */
  prelaunch: boolean;
  /** Template / adapted / distinct, from the landing structure. */
  categoryFit: 'template' | 'adapted' | 'distinct' | null;
  /** Whether any UI was found at all (no UI = craft not applicable). */
  uiFileCount: number;
  /** Legacy 0–100 meter derived from tell density (teaser compatibility). */
  vibeScore: number;
  /** Copy excerpts for the optional model-assisted judgment pass. */
  copySamples: string[];
}

/** Generic CSS keywords that are not real typeface choices. */
const GENERIC_FONTS = new Set([
  'inherit', 'initial', 'unset', 'sans-serif', 'serif', 'monospace', 'cursive',
  'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace',
  'ui-rounded', 'emoji', 'math', 'fangsong', '-apple-system',
]);

const ICON_LIBS =
  /from\s+['"](react-icons|lucide-react|@heroicons\/react|@tabler\/icons|@phosphor-icons\/react|phosphor-react|react-feather|@fortawesome\/[\w-]+)['"]/g;

const HUE_CLASS =
  /\b(?:bg|text|border|from|via|to|ring|fill|stroke|accent|caret)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;

/** Default-scale color utilities, including the neutral families. */
const DEFAULT_UTILITY =
  /\b(?:bg|text|border|ring|from|via|to|fill|stroke)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|gray|slate|zinc|neutral|stone)-\d{2,3}\b/g;

const USER_COUNT =
  /(?:trusted by|join(?:ed)?(?: by)?|loved by|used by)\s*(?:over\s*)?[\d,.]+k?\+?\s*(?:users|developers|devs|teams|customers|companies|founders|creators|builders)|[\d,]{4,}\+\s*(?:happy\s+)?(?:users|developers|customers|downloads|teams)/i;

/** Files that mark a disciplined AI-assisted workflow. Context, not penalty. */
const PROVENANCE_FILES = new Set([
  'claude.md', 'agents.md', '.cursorrules', '.windsurfrules', '.clinerules',
  '.aider.conf.yml', 'gemini.md',
]);

const BUILDER_FINGERPRINT =
  /lovable-tagger|cdn\.gpteng\.co|data-lov-id|Welcome to your Lovable project|content=["']v0\.dev["']|generator:\s*["']v0\.dev|Made with Bolt|href=["']https:\/\/bolt\.new/i;

interface Claim {
  kind: string;
  value: number;
  raw: string;
  file: string;
}

/** Synonym buckets so "clients" and "businesses" compare as one kind. */
function bucketOf(noun: string): string {
  const n = noun.toLowerCase();
  if (n === 'users' || n === 'developers') return 'users';
  return 'customers';
}

interface RuleHit {
  rule: DesignRule;
  count: number;
}

interface LandingSignals {
  relPath: string;
  score: number;
  parts: string[];
  /** Fabricated-credibility signals — a real template needs at least one. */
  strong: number;
}

export class DesignAnalyzer {
  private findings: Finding[] = [];
  private hits = new Map<string, RuleHit>();
  private provenance: string[] = [];

  private uiFileCount = 0;
  private breakpointHits = 0;
  /** Responsive VISIBILITY and ORDER decisions — what mobile priority is. */
  private responsivePriorityHits = 0;
  private mediaQueryHits = 0;
  private fontFamilies = new Set<string>();
  private fontWeightCounts = new Map<string, number>();
  private hueFamilies = new Set<string>();
  private radiusTokens = new Set<string>();
  private shadowTokens = new Set<string>();
  private iconLibraries = new Set<string>();
  private usesMotion = false;
  private guardsMotion = false;
  private htmlTagFiles = 0;
  private htmlLangFiles = 0;
  private consoleLogCount = 0;
  private todoCount = 0;
  private legalFiles: { relPath: string; stubby: boolean }[] = [];
  private legalLinkSeen = false;
  private readmeTemplate: string | null = null;
  private readmeAiStyled = false;
  private bestLanding: LandingSignals | null = null;
  private scaffoldAssets: string[] = [];
  private fakeAuthFile: string | null = null;
  private pricingArrayFile: string | null = null;
  private paymentRailSeen = false;
  private ogMetaSeen = false;
  private megaPageFile: { relPath: string; lines: number; arrays: number } | null = null;
  private uiKitFiles = new Set<string>();
  private uiKitImports = new Set<string>();
  private routes = new Set<string>();
  private wildcardRoutes: string[] = [];
  private internalLinks = new Map<string, string>(); // href -> first file seen in
  private clientRouterSeen = false;

  // ── Layer A: token system ──
  private tailwindSeen = false;
  private tailwindConfigPath: string | null = null;
  private themeExtended = false;
  private tokenNames = new Set<string>();
  private cssCustomPropCount = 0;
  private defaultUtilityCount = 0;
  private tokenUtilityCount = 0;
  private spacingCounts = new Map<string, number>();
  private arbitrarySpacingCount = 0;
  private arbitrarySpacingExample: string | null = null;

  // ── Layer B: state coverage ──
  private listRenderFiles = 0;
  private firstListFile: string | null = null;
  private emptyBranchSeen = false;
  private fetchSeen = false;
  private loadingSeen = false;
  private hasAppDir = false;
  private errorBoundarySeen = false;

  // ── Layer C/D extras ──
  private hoverCount = 0;
  private interactiveCount = 0;
  private formSubmitCount = 0;
  private firstFormFile: string | null = null;
  private pendingSignalSeen = false;
  private headingSkipFile: string | null = null;

  // ── copy samples for the optional model-assisted pass ──
  private copySamples: string[] = [];

  /** Every bracketed font size seen, with how often. Drives the scale check. */
  private bracketSizeCounts = new Map<string, number>();

  // ── operational evidence (D8) and positive-signal collectors ──
  private telLinkSeen = false;
  private mailtoSeen = false;
  private jsonLdTypes = new Set<string>();
  private pdfAssets = 0;
  private photoAssets = 0;
  private datedContentFiles = 0;
  private focusVisibleCount = 0;
  private darkTokenOverrides = 0;
  private a11yToolingSeen = false;
  private ciSeen = false;
  private spaOnlyStack = false;
  private ssrStackSeen = false;
  private scaleExtensionSeen = false;
  private durationValues = new Set<string>();
  private staggerSeen = false;
  private skeletonSeen = false;
  private emptyCtaSeen = false;
  private claims: Claim[] = [];
  private copyrightYears: number[] = [];
  private descLengthFiles: { relPath: string; lengths: number[] }[] = [];

  /**
   * Class names the project's own CSS defines as uppercase tracked labels.
   * A design system usually names this style once in CSS rather than
   * repeating utilities, and a rule that only reads inline utilities would
   * call every use of it unreadable body text.
   */
  private labelClasses = new Set<string>();

  addFile(relPath: string, content: string): void {
    // Test files and fixtures are not shipped UI — planted junk in a test
    // must not drag the craft grade (secrets there still matter, but the
    // security checks handle those independently).
    if (
      /(?:^|\/)(?:tests?|__tests__|__mocks__|fixtures?|e2e|cypress|playwright|stories|\.storybook)\//i.test(relPath) ||
      /\.(?:test|spec|stories)\.[jt]sx?$/.test(relPath)
    ) {
      return;
    }

    const ext = path.posix.extname(relPath).toLowerCase();
    const base = relPath.split('/').pop() ?? '';
    const baseLower = base.toLowerCase();

    this.noteScaffoldAsset(relPath);
    this.noteRoute(relPath);
    this.noteProvenance(relPath, baseLower, content);

    if (baseLower === 'readme.md' && !relPath.includes('/')) {
      this.checkReadme(content);
      return; // the README gets its own checks, not the UI rules
    }
    if (base === 'package.json') {
      if (/"(?:stripe|@stripe\/|paddle|@paddle\/|lemonsqueezy|@lemonsqueezy)/i.test(content)) {
        this.paymentRailSeen = true;
      }
      if (/"tailwindcss"/.test(content)) this.tailwindSeen = true;
      if (/"(?:@pandacss\/dev|@vanilla-extract\/css|@stitches\/react)"/.test(content)) {
        this.themeExtended = true; // a dedicated token package is a token system
      }
      // Evidence of accessibility being checked, not assumed.
      if (/"(?:@axe-core\/|axe-core|pa11y|eslint-plugin-jsx-a11y|@lhci\/cli)/.test(content)) {
        this.a11yToolingSeen = true;
      }
      // Client-only stacks serving marketing pages ship empty documents.
      if (/"(?:vite|react-scripts)"/.test(content)) this.spaOnlyStack = true;
      if (/"(?:next|astro|@sveltejs\/kit|@remix-run\/|gatsby|nuxt)"/.test(content)) {
        this.ssrStackSeen = true;
      }
      return;
    }
    if (relPath.startsWith('.github/workflows/')) this.ciSeen = true;
    // Operational evidence sitting in the asset tree.
    if (/\.pdf$/i.test(relPath)) this.pdfAssets++;
    if (/^(?:public|static|assets)\//.test(relPath) && /\.(?:jpe?g|png|webp|avif)$/i.test(relPath)) {
      const name = base.toLowerCase();
      if (!/^(?:favicon|og|icon|logo|apple-touch|placeholder)/.test(name) && name.length > 8) {
        this.photoAssets++;
      }
    }
    // Dated content: a blog, changelog, or docs tree with real entries.
    if (
      /(?:^|\/)(?:blog|posts|changelog|case-studies|docs\/changelog)\//i.test(relPath) &&
      (/\d{4}-\d{2}/.test(relPath) || /^date:\s*['"]?\d{4}/m.test(content.slice(0, 400)))
    ) {
      this.datedContentFiles++;
    }
    if (/^tailwind\.config\.(?:js|ts|mjs|cjs)$/.test(base)) {
      this.tailwindSeen = true;
      this.tailwindConfigPath = relPath;
      this.readTailwindConfig(content);
      return;
    }
    if (/^theme\.(?:ts|js)$/.test(base) && /export/.test(content)) {
      this.themeExtended = true;
    }

    const isUi = UI.has(ext);
    const isCss = CSS.has(ext);
    const isJsLike = /^\.(?:js|jsx|ts|tsx|mjs|cjs|vue|svelte|astro)$/.test(ext);
    if (!isUi && !isCss && !isJsLike && ext !== '.html') return;

    this.runRules(relPath, ext, content);

    if (isUi) {
      this.uiFileCount++;
      this.collectUiSignals(relPath, content);
    }
    if (isCss) this.collectCssSignals(content);
    if (isJsLike || isUi) {
      this.collectCodeSignals(relPath, content);
    }
    this.collectLegalSignals(relPath, ext, content);
  }

  /** Untouched starter files in public/ — nobody even opened the file tree. */
  private noteScaffoldAsset(relPath: string): void {
    if (
      /^public\/(?:next|vercel|globe|window|file|vite)\.svg$/.test(relPath) ||
      relPath === 'src/assets/react.svg'
    ) {
      this.scaffoldAssets.push(relPath);
    }
  }

  /** Workflow and generator markers. Recorded, never penalized. */
  private noteProvenance(relPath: string, baseLower: string, content: string): void {
    if (PROVENANCE_FILES.has(baseLower) && !relPath.includes('/')) {
      this.provenance.push(`${relPath} (agent instructions in the repo)`);
    }
    if (BUILDER_FINGERPRINT.test(content)) {
      this.provenance.push(`generator fingerprint in ${relPath}`);
    }
  }

  /** Build the route inventory so we can catch links to pages that don't exist. */
  private noteRoute(relPath: string): void {
    if (/^(?:src\/)?app\//.test(relPath)) this.hasAppDir = true;
    let m = relPath.match(/^(?:src\/)?app\/(.*?)(?:page|route)\.(?:tsx|jsx|js|mdx)$/);
    if (m) {
      const segments = m[1]
        .split('/')
        .filter((s) => s && !s.startsWith('(') && !s.startsWith('@'));
      const url = '/' + segments.join('/');
      if (segments.some((s) => s.startsWith('['))) {
        this.wildcardRoutes.push(url.slice(0, url.indexOf('[')));
      } else {
        this.routes.add(url.replace(/\/$/, '') || '/');
      }
      return;
    }
    m = relPath.match(/^(?:src\/)?pages\/(.*)\.(?:tsx|jsx|js|mdx)$/);
    if (m && !m[1].startsWith('_') && !m[1].startsWith('api/')) {
      const url = '/' + m[1].replace(/(?:^|\/)index$/, '');
      if (url.includes('[')) {
        this.wildcardRoutes.push(url.slice(0, url.indexOf('[')));
      } else {
        this.routes.add(url.replace(/\/$/, '') || '/');
      }
    }
  }

  /** Crude structural read of tailwind.config: does theme.extend say anything? */
  private readTailwindConfig(content: string): void {
    const extend = content.match(/extend\s*:\s*\{([\s\S]*)/);
    if (!extend) return;
    const body = extend[1];
    if (/(?:colors|fontFamily|spacing|borderRadius|boxShadow)\s*:\s*\{[^}]*[\w'"]/.test(body)) {
      this.themeExtended = true;
    }
    if (/(?:spacing|fontSize)\s*:\s*\{[^}]*[\w'"]/.test(body)) {
      this.scaleExtensionSeen = true;
    }
    // Token names declared under colors:, for the usage-ratio check.
    const colors = body.match(/colors\s*:\s*\{([^}]*)/);
    if (colors) {
      for (const key of colors[1].matchAll(/['"]?([\w-]+)['"]?\s*:/g)) {
        this.tokenNames.add(key[1]);
      }
    }
  }

  // ── per-file rule engine ──────────────────────────────────────────────

  private runRules(relPath: string, ext: string, content: string): void {
    const rules = DESIGN_RULES.filter((r) => r.extensions.has(ext));
    if (rules.length === 0) return;

    const lines = content.split('\n');

    for (const rule of rules) {
      if (rule.scope === 'file') {
        const re = new RegExp(rule.regex.source, rule.regex.flags);
        for (const m of content.matchAll(re)) {
          const lineNo = content.slice(0, m.index).split('\n').length;
          const line = lines[lineNo - 1] ?? '';
          if (rule.unless && rule.unless.test(m[0])) continue;
          if (rule.test && !rule.test(m[0])) continue;
          this.record(rule, relPath, lineNo, (m[0].split('\n')[0] || line).trim());
        }
        continue;
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length > 2000) continue; // bundled/minified
        const trimmed = line.trimStart();
        // A line opening with a regex literal (/ but not //) is pattern
        // code, never UI — a rules file must not match its own patterns.
        if (/^\/(?!\/)/.test(trimmed)) continue;
        if (
          !rule.includeComments &&
          (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*'))
        ) {
          continue;
        }
        if (!rule.regex.test(line)) continue;
        if (rule.unless && rule.unless.test(line)) continue;
        if (rule.test && !rule.test(line)) continue;
        this.record(rule, relPath, i + 1, line.trim());
      }
    }
  }

  private record(rule: DesignRule, relPath: string, lineNo: number, evidence: string): void {
    const hit = this.hits.get(rule.id) ?? { rule, count: 0 };
    hit.count++;
    this.hits.set(rule.id, hit);

    if (hit.count <= rule.maxFindings) {
      this.findings.push({
        checkType: 'design',
        severity: rule.severity,
        confidence: 'likely',
        ruleId: rule.id,
        title: rule.title,
        explanation: rule.explanation,
        filePath: relPath,
        lineStart: lineNo,
        evidenceMasked: evidence.slice(0, 160),
        recommendation: rule.recommendation,
      });
    }
  }

  // ── project-wide signal collection ───────────────────────────────────

  private collectUiSignals(relPath: string, content: string): void {
    this.breakpointHits += content.match(/\b(?:sm|md|lg|xl|2xl):/g)?.length ?? 0;
    // (?!-) keeps md:grid-cols-3 (a column mirror) from counting as md:grid
    // (a visibility decision).
    this.responsivePriorityHits +=
      content.match(/\b(?:sm|md|lg|xl|2xl):(?:hidden|inline-block|block|inline|flex|grid)(?!-)\b|\b(?:sm|md|lg|xl|2xl):order-\d+\b/g)
        ?.length ?? 0;

    // Internal links, for the missing-routes check. Query/hash stripped.
    for (const m of content.matchAll(/(?:href|to)\s*=\s*["'](\/[\w\-/]*)/g)) {
      const href = m[1].replace(/\/$/, '') || '/';
      if (!href.startsWith('/api/') && !this.internalLinks.has(href)) {
        this.internalLinks.set(href, relPath);
      }
    }
    if (/openGraph|og:image|og:title|twitter:card|opengraph-image/.test(content)) {
      this.ogMetaSeen = true;
    }

    // A fake login: a submit handler that just navigates, no auth call anywhere.
    if (
      /(?:^|\/)(?:login|log-in|signin|sign-in|signup|sign-up|auth)(?:\/|[\w-]*\.)/i.test(relPath) &&
      /preventDefault\(\)/.test(content) &&
      /router\.push|navigate\(|window\.location/.test(content) &&
      !/signIn|signUp|signInWith|createUser|auth\.|supabase|firebase|next-auth|clerk|passport|CredentialsProvider|fetch\(|axios/i.test(content)
    ) {
      this.fakeAuthFile ??= relPath;
    }

    // One giant page file with all the section data inlined.
    const lineCount = content.split('\n').length;
    const dataArrays =
      content.match(
        /(?:const|let)\s+(?:features|testimonials|plans|faqs|steps|stats|benefits|services)\s*[:=]/gi,
      )?.length ?? 0;
    if (lineCount > 500 && dataArrays >= 4 && !this.megaPageFile) {
      this.megaPageFile = { relPath, lines: lineCount, arrays: dataArrays };
    }

    for (const m of content.matchAll(HUE_CLASS)) this.hueFamilies.add(m[1]);

    // Layer A: default-utility vs project-token usage.
    this.defaultUtilityCount += content.match(DEFAULT_UTILITY)?.length ?? 0;
    if (this.tokenNames.size > 0) {
      for (const name of this.tokenNames) {
        const re = new RegExp(`\\b(?:bg|text|border|ring|fill|stroke)-${name}\\b`, 'g');
        this.tokenUtilityCount += content.match(re)?.length ?? 0;
      }
    }

    // Layer A: spacing histogram.
    for (const m of content.matchAll(
      /\b(?:p|px|py|pt|pb|pl|pr|gap|gap-x|gap-y|space-x|space-y)-(\d+(?:\.\d+)?)\b/g,
    )) {
      this.spacingCounts.set(m[1], (this.spacingCounts.get(m[1]) ?? 0) + 1);
    }
    for (const m of content.matchAll(
      /\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|gap)-\[\d+px\]/g,
    )) {
      this.arbitrarySpacingCount++;
      this.arbitrarySpacingExample ??= `${m[0]} in ${relPath}`;
    }

    // A size repeated across the project is a scale step, whatever the
    // framework's defaults are. A size used once or twice is the one-off the
    // rule is looking for. finish() drops the findings for repeated values.
    for (const m of content.matchAll(/\btext-\[(\d+)px\]/g)) {
      this.bracketSizeCounts.set(m[1], (this.bracketSizeCounts.get(m[1]) ?? 0) + 1);
    }

    for (const m of content.matchAll(/\brounded(?:-[a-z0-9]+)*/g)) {
      // Normalize rounded-tl-lg → lg, bare rounded → base; ignore full/none.
      const parts = m[0].split('-').slice(1);
      const size = parts.find((p) => /^(?:sm|md|lg|xl|2xl|3xl)$/.test(p));
      const token = size ?? (parts.some((p) => p === 'full' || p === 'none') ? '' : 'base');
      if (token) this.radiusTokens.add(token);
    }
    for (const m of content.matchAll(/\bshadow(?:-(?:2xs|xs|sm|md|lg|xl|2xl))?(?![\w-])/g)) {
      this.shadowTokens.add(m[0]);
    }
    for (const m of content.matchAll(
      /\bfont-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g,
    )) {
      this.fontWeightCounts.set(m[1], (this.fontWeightCounts.get(m[1]) ?? 0) + 1);
    }

    // Focus treatment, evidence links, structured data, claims.
    this.focusVisibleCount += content.match(/focus-visible:|:focus-visible/g)?.length ?? 0;
    if (/href\s*=\s*["']tel:/.test(content)) this.telLinkSeen = true;
    if (/href\s*=\s*["']mailto:/.test(content)) this.mailtoSeen = true;
    for (const m of content.matchAll(/"@type"\s*:\s*"(\w+)"/g)) this.jsonLdTypes.add(m[1]);
    for (const m of content.matchAll(/duration-(\d{2,4})\b/g)) this.durationValues.add(m[1]);
    if (/\bdelay-\d|staggerChildren|stagger\(/.test(content)) this.staggerSeen = true;
    if (/animate-pulse|[Ss]keleton|<Suspense[^>]+fallback=\{(?!null)/.test(content)) {
      this.skeletonSeen = true;
    }
    if (
      /\.length\s*===?\s*0[\s\S]{0,400}?(?:<(?:Button|a\b|Link)|Create|Add|Start|Run|Get started|New )/i.test(
        content,
      )
    ) {
      this.emptyCtaSeen = true;
    }
    // Quantitative claims, for the internal-contradiction check. Buckets
    // normalize synonyms so "clients" and "businesses" compare.
    for (const m of content.matchAll(
      /(\d[\d,]{0,9})\s*\+?\s*(?:happy\s+)?(users|developers|customers|clients|businesses|companies|teams)/gi,
    )) {
      const value = parseInt(m[1].replace(/,/g, ''), 10);
      if (value >= 10) this.claims.push({ kind: bucketOf(m[2]), value, raw: m[0].trim(), file: relPath });
    }
    for (const m of content.matchAll(
      /(hundreds|thousands|millions)\s+of\s+(users|developers|customers|clients|businesses|companies|teams)/gi,
    )) {
      const value = { hundreds: 100, thousands: 1000, millions: 1_000_000 }[m[1].toLowerCase()]!;
      this.claims.push({ kind: bucketOf(m[2]), value, raw: m[0].trim(), file: relPath });
    }
    for (const m of content.matchAll(/(?:©|&copy;|copyright)\s*(\d{4})/gi)) {
      this.copyrightYears.push(parseInt(m[1], 10));
    }
    // Card-description lengths, for the mechanically-equal-copy check.
    const descs = [...content.matchAll(
      /(?:description|desc|body|blurb)\s*:\s*["'\`]([^"'\`]{60,200})["'\`]/g,
    )].map((m) => m[1].length);
    if (descs.length >= 4) this.descLengthFiles.push({ relPath, lengths: descs });

    // Layer D: interaction feedback coverage.
    this.hoverCount += content.match(/\bhover:/g)?.length ?? 0;
    this.interactiveCount +=
      (content.match(/<button\b/g)?.length ?? 0) + (content.match(/\bonClick\s*=/g)?.length ?? 0);
    if (/onSubmit\s*=/.test(content)) {
      this.formSubmitCount++;
      this.firstFormFile ??= relPath;
    }
    if (
      /isSubmitting|isPending|useFormStatus|aria-busy|useTransition|disabled=\{(?:loading|isLoading|pending|submitting)/i.test(
        content,
      )
    ) {
      this.pendingSignalSeen = true;
    }

    // Layer B: list rendering vs empty-state branches.
    if (/\.map\(\s*\(?\w+/.test(content) && /<\w/.test(content)) {
      this.listRenderFiles++;
      this.firstListFile ??= relPath;
    }
    if (
      /\.length\s*===?\s*0|\.length\s*\?|isEmpty|No (?:results|items|posts|data|scans)|length\s*>\s*0\s*&&/i.test(
        content,
      )
    ) {
      this.emptyBranchSeen = true;
    }
    if (/\bfetch\(|axios\.|useSWR|useQuery|use(?:Effect|State)\([^)]*fetch/i.test(content)) {
      this.fetchSeen = true;
    }
    if (/isLoading|<Suspense|skeleton|animate-pulse|loading\s*[?&:]/i.test(content)) {
      this.loadingSeen = true;
    }
    if (/error\.tsx$|global-error\.tsx$/.test(relPath) || /componentDidCatch|ErrorBoundary|react-error-boundary/.test(content)) {
      this.errorBoundarySeen = true;
    }

    // Layer G: heading levels skipping inside one file.
    if (/<h1\b/i.test(content) && /<h3\b/i.test(content) && !/<h2\b/i.test(content)) {
      this.headingSkipFile ??= relPath;
    }

    if (/\banimate-(?:spin|pulse|bounce|ping)\b/.test(content)) this.usesMotion = true;
    if (/motion-reduce:|motion-safe:|prefers-reduced-motion/.test(content)) {
      this.guardsMotion = true;
    }

    if (/<html\b/.test(content)) {
      this.htmlTagFiles++;
      if (/<html[^>]*\slang\s*=/.test(content)) this.htmlLangFiles++;
    }

    // Google Fonts loaded via <link> tags.
    for (const m of content.matchAll(/fonts\.googleapis\.com\/css2?\?[^"')\s]*/g)) {
      for (const fam of m[0].matchAll(/family=([^&:]+)/g)) {
        this.fontFamilies.add(decodeURIComponent(fam[1]).replace(/\+/g, ' ').toLowerCase());
      }
    }
    if (/@tailwind\b|@import\s+["']tailwindcss/.test(content)) this.tailwindSeen = true;

    this.scoreLandingShape(relPath, content);
  }

  private collectCssSignals(content: string): void {
    this.mediaQueryHits += content.match(/@media\b/g)?.length ?? 0;
    if (/@keyframes\b/.test(content)) this.usesMotion = true;
    if (/prefers-reduced-motion/.test(content)) this.guardsMotion = true;
    if (/@tailwind\b|@import\s+["']tailwindcss/.test(content)) this.tailwindSeen = true;

    // Custom properties and the v4 @theme block are both real token systems.
    const props = content.match(/--[\w-]+\s*:/g)?.length ?? 0;
    this.cssCustomPropCount += props;
    if (/@theme\b/.test(content) && props > 0) this.themeExtended = true;
    for (const m of content.matchAll(/--color-([\w-]+)\s*:/g)) {
      this.tokenNames.add(m[1]);
    }
    // Dark mode designed with its own values, not inverted.
    for (const block of content.matchAll(/(?:\[data-theme=["']?dark["']?\]|\.dark\b|prefers-color-scheme:\s*dark)[^{]*\{([\s\S]*?)\}/g)) {
      this.darkTokenOverrides += block[1].match(/--[\w-]+\s*:/g)?.length ?? 0;
    }

    // Collect label styles: a class that sets uppercase AND letter-spacing is
    // this project's micro-label, whatever it is called.
    for (const m of content.matchAll(/\.([\w-]+)[^{}]*\{([^}]*)\}/g)) {
      if (/text-transform\s*:\s*uppercase/i.test(m[2]) && /letter-spacing\s*:/i.test(m[2])) {
        this.labelClasses.add(m[1]);
      }
    }

    for (const m of content.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
      const first = m[1].split(',')[0]?.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
      if (first && !first.startsWith('var(') && !GENERIC_FONTS.has(first)) {
        this.fontFamilies.add(first);
      }
    }
  }

  private collectCodeSignals(relPath: string, content: string): void {
    if (/test|spec|stories/.test(relPath)) return;

    // shadcn kitchen-sink detection: installed ui/ components vs imported ones.
    const uiKit = relPath.match(/(?:^|\/)components\/ui\/([\w-]+)\.(?:tsx|jsx|ts)$/);
    if (uiKit) {
      this.uiKitFiles.add(uiKit[1]);
    } else {
      for (const m of content.matchAll(/["']@\/components\/ui\/([\w-]+)["']/g)) {
        this.uiKitImports.add(m[1]);
      }
    }

    if (/from\s+['"]react-router|<Route\b|createBrowserRouter|createHashRouter/.test(content)) {
      this.clientRouterSeen = true;
    }
    if (/(?:const|let)\s+(?:plans|tiers|pricing|PLANS|PRICING)\s*[:=]\s*\[/.test(content)) {
      this.pricingArrayFile ??= relPath;
    }
    if (/stripe|paddle|lemon.?squeezy|checkout\.session|price_[A-Za-z0-9]/i.test(content)) {
      this.paymentRailSeen = true;
    }

    for (const m of content.matchAll(ICON_LIBS)) {
      // @fortawesome/react-fontawesome and @fortawesome/free-* are one library.
      this.iconLibraries.add(m[1].startsWith('@fortawesome') ? '@fortawesome' : m[1]);
    }
    for (const m of content.matchAll(
      /import\s*\{([^}]*)\}\s*from\s*['"](?:next\/font\/google|geist\/font[\w/]*)['"]/g,
    )) {
      for (const name of m[1].split(',')) {
        const clean = name.trim().split(/\s+as\s+/)[0].replace(/_/g, ' ').toLowerCase();
        if (clean) this.fontFamilies.add(clean);
      }
    }
    if (/from\s+['"]next\/font\/local['"]/.test(content)) {
      this.fontFamilies.add('(local font)');
    }
    this.consoleLogCount += content.match(/\bconsole\.log\(/g)?.length ?? 0;
    // Count real markers only. The word inside a rule definition or a prose
    // string is the marker being described, not a piece of unfinished work —
    // without this the scanner counts its own TODO-detection rule.
    for (const line of content.split('\n')) {
      if (isPatternDefinitionLine(line)) continue;
      const m = /\b(?:TODO|FIXME|HACK)\b/.exec(line);
      if (!m) continue;
      if (matchIsInsideProseString(line, m.index)) continue;
      this.todoCount++;
    }
  }

  /**
   * The canonical page sequence, measured: badge pill over the H1, a
   * feature-card grid, an FAQ, a user-count boast, and a big "Get started".
   * Any one alone is convention; four or more with a fabricated-credibility
   * signal is the template.
   */
  private scoreLandingShape(relPath: string, content: string): void {
    if (!/<h1\b/i.test(content)) return;

    const parts: string[] = [];
    let strong = 0;
    if (/rounded-full[^"'\n]{0,80}(?:text-(?:xs|sm)|px-[34])/.test(content)) {
      parts.push('a badge pill above the headline');
    }
    if (
      /Get Started|Start (?:Now|Free|Today|Building)|Try (?:It|Now|Free)/i.test(content) &&
      /Learn More|View Demo|Watch Demo|See How|Book a Demo/i.test(content)
    ) {
      parts.push('the twin "Get started / Learn more" buttons');
    }
    if (/grid-cols-[234]\b/.test(content) && /\.map\(/.test(content)) {
      parts.push('feature cards rendered from a hardcoded array');
    }
    if (/(?:const|let)\s+stats\s*[:=]\s*\[|\b99\.9%|\b24\/7\s+support/i.test(content)) {
      parts.push('a big-number stats strip');
      strong++;
    }
    if (/(?:const|let)\s+testimonials\s*[:=]\s*\[/i.test(content)) {
      parts.push('hardcoded testimonials');
      strong++;
    }
    if (/\bFAQ\b|Frequently Asked/i.test(content)) parts.push('an FAQ section');
    if (USER_COUNT.test(content)) {
      parts.push('a user-count claim');
      strong++;
    }
    if (/Get Started|Start (?:Now|Free|Today|Building)|Try (?:It|Now|Free)/i.test(content)) {
      parts.push('a final "Get started" call-to-action');
    }

    const score = parts.length + 1; // +1 for the hero itself
    if (!this.bestLanding || score > this.bestLanding.score) {
      this.bestLanding = { relPath, score, parts, strong };
      // Keep the page's visible strings for the optional judgment pass.
      const strings = [...content.matchAll(/>([^<>{}]{12,140})</g)]
        .map((m) => m[1].trim())
        .filter((s) => /[a-z]/i.test(s))
        .slice(0, 30);
      this.copySamples = strings;
    }
  }

  private collectLegalSignals(relPath: string, ext: string, content: string): void {
    if (UI.has(ext) && /href\s*=\s*["'][^"']*(?:privacy|terms)/i.test(content)) {
      this.legalLinkSeen = true;
    }
    if (/(?:^|\/)(?:privacy|terms|tos|legal)[\w-]*(?:\/(?:page|index)\.[\w]+|\.(?:md|mdx|txt|tsx|jsx|html))$/i.test(relPath)) {
      const stubby =
        content.length < 1200 ||
        /\[(?:company|your|insert)[^\]]*\]|lorem ipsum|\{\{\s*\w+\s*\}\}/i.test(content);
      this.legalFiles.push({ relPath, stubby });
    }
  }

  private checkReadme(content: string): void {
    if (content.includes('bootstrapped with [`create-next-app`]')) {
      this.readmeTemplate = 'the create-next-app default';
    } else if (content.includes('This template provides a minimal setup to get React working in Vite')) {
      this.readmeTemplate = 'the Vite starter default';
    } else if (/^# Getting Started with Create React App/m.test(content)) {
      this.readmeTemplate = 'the create-react-app default';
    } else if (content.includes('Welcome to your Lovable project')) {
      this.readmeTemplate = 'a site-builder default';
      this.provenance.push('README carries a generator default');
    }

    const emojiHeadings = content.match(/^#{1,3}\s*\p{Extended_Pictographic}/gmu)?.length ?? 0;
    if (emojiHeadings >= 3 || /Made with ❤️|Made with 💜/.test(content)) {
      this.readmeAiStyled = true;
    }
  }

  /** Internal links with no matching page. Empty when we can't map routes. */
  private missingInternalRoutes(): string[] {
    if (this.routes.size === 0) return []; // unfamiliar routing — don't guess
    // Client-side routers (react-router etc.) define routes in code, not
    // files — file-based inference would cry wolf on every SPA link.
    if (this.clientRouterSeen) return [];
    const missing: string[] = [];
    for (const href of this.internalLinks.keys()) {
      if (this.routes.has(href)) continue;
      if (this.wildcardRoutes.some((prefix) => href.startsWith(prefix))) continue;
      missing.push(href);
    }
    return missing.sort();
  }

  // ── aggregate findings ───────────────────────────────────────────────

  /** A size used this often across the project counts as a scale step. */
  private static readonly SCALE_STEP_THRESHOLD = 5;

  /**
   * Drop off-scale findings for sizes the project uses systematically. Three
   * files at 15px is a decision; one file at 15px among a scatter is not.
   */
  private pruneSystematicSizes(): void {
    const systematic = new Set(
      [...this.bracketSizeCounts.entries()]
        .filter(([, n]) => n >= DesignAnalyzer.SCALE_STEP_THRESHOLD)
        .map(([size]) => size),
    );
    if (systematic.size === 0) return;

    const isSystematic = (f: Finding) => {
      const m = /text-\[(\d+)px\]/.exec(f.evidenceMasked ?? '');
      return m !== null && systematic.has(m[1]);
    };
    const before = this.findings.length;
    this.findings = this.findings.filter(
      (f) => f.ruleId !== 'type-offscale-size' || !isSystematic(f),
    );

    const removed = before - this.findings.length;
    const hit = this.hits.get('type-offscale-size');
    if (hit) {
      hit.count -= removed;
      if (hit.count <= 0) this.hits.delete('type-offscale-size');
    }
  }

  /**
   * Drop legibility findings on 10px and 11px text that carries one of the
   * project's own label classes. Those resolve to uppercase tracked capitals,
   * which read larger than the nominal size.
   */
  private pruneCssLabelSizes(): void {
    if (this.labelClasses.size === 0) return;
    const before = this.findings.length;
    this.findings = this.findings.filter((f) => {
      if (f.ruleId !== 'type-below-floor') return true;
      const evidence = f.evidenceMasked ?? '';
      if (!/text-\[1[01]px\]/.test(evidence)) return true;
      return ![...this.labelClasses].some((c) =>
        new RegExp(`(?:^|["'\\s])${c}(?:["'\\s]|$)`).test(evidence),
      );
    });

    const removed = before - this.findings.length;
    const hit = this.hits.get('type-below-floor');
    if (hit) {
      hit.count -= removed;
      if (hit.count <= 0) this.hits.delete('type-below-floor');
    }
  }

  finish(nowYear: number = new Date().getFullYear()): DesignAudit {
    this.emitAggregates();
    this.emitSecondGeneration(nowYear);
    this.pruneSystematicSizes();
    this.pruneCssLabelSizes();

    // Over-cap rules get one honest note instead of a wall of findings.
    const notes: string[] = [];
    for (const { rule, count } of this.hits.values()) {
      if (count > rule.maxFindings) {
        notes.push(
          `${rule.title}: ${count - rule.maxFindings} more ` +
            `${count - rule.maxFindings === 1 ? 'occurrence' : 'occurrences'} not listed individually.`,
        );
      }
    }

    // ── distinct tells (five hits of one rule count once) ──
    const tells = new Set<string>();
    for (const { rule, count } of this.hits.values()) {
      if (!rule.tell) continue;
      // The emoji and div-button tells require three or more instances.
      if ((rule.tell === 'T-EMOJI-ICON' || rule.tell === 'T-DIV-BUTTON') && count < 3) continue;
      tells.add(rule.tell);
    }

    // ── ceilings (6.4): the lowest one binds, applied in grade.ts ──
    const fired = (id: string) => this.hits.has(id);
    const hitCount = (id: string) => this.hits.get(id)?.count ?? 0;
    const ceilings: Ceiling[] = [];
    if (fired('a11y-outline-suppressed') || (this.interactiveCount >= 15 && this.focusVisibleCount === 0)) {
      ceilings.push({ max: 65, reason: 'no visible keyboard focus indication', dimension: 'accessibility' });
      tells.add('T-NO-FOCUS');
    }
    if (fired('tokens-no-theme-extension')) {
      ceilings.push({ max: 60, reason: 'no design token layer exists', dimension: 'system' });
    }
    if (fired('states-no-empty-states')) {
      ceilings.push({ max: 70, reason: 'no empty-state handling anywhere', dimension: 'states' });
    }
    if (fired('states-no-error-boundary')) {
      ceilings.push({ max: 70, reason: 'no error-path handling anywhere', dimension: 'states' });
    }
    if (fired('layout-no-responsive')) {
      ceilings.push({ max: 55, reason: 'no responsive handling at all', dimension: 'layout' });
    }
    if (hitCount('copy-emoji-ui') >= 3) {
      ceilings.push({ max: 75, reason: 'emoji used as functional iconography', dimension: 'typography' });
    }
    if (hitCount('a11y-div-onclick') >= 3) {
      ceilings.push({ max: 68, reason: 'click handlers on non-interactive elements', dimension: 'accessibility' });
    }
    if (fired('a11y-zoom-disabled')) {
      ceilings.push({ max: 60, reason: 'pinch-zoom is disabled', dimension: 'accessibility' });
    }

    // ── dimension caps from tell effects (Part 7 / 12.3) ──
    const dimensionCaps: Partial<Record<DimensionId, number>> = {};
    const cap = (dim: DimensionId, max: number) => {
      dimensionCaps[dim] = Math.min(dimensionCaps[dim] ?? DIMENSION_MAX[dim], max);
    };
    if (tells.has('T-NO-TOKENS')) cap('system', 4);
    if (tells.has('T-DEFAULT-PALETTE')) { cap('system', 10); cap('color', 4); }
    if (tells.has('T-GRADIENT-DEFAULT')) cap('color', 8);
    if (tells.has('T-DEFAULT-TYPEFACE')) cap('typography', 4);
    if (tells.has('T-EMOJI-ICON')) cap('typography', 8);
    if (tells.has('T-VAGUE-COPY')) cap('typography', 7);
    if (tells.has('T-NO-FOCUS')) cap('accessibility', 4);
    if (tells.has('T-DIV-BUTTON')) cap('accessibility', 6);
    if (tells.has('T-NO-MOTION-PREF')) { cap('motion', 9); cap('accessibility', 9); }
    if (tells.has('T-DEAD-INTERACTION')) cap('motion', 6);
    if (tells.has('T-UNIFORM-RHYTHM')) cap('layout', 7);
    if (tells.has('T-NO-RESPONSIVE')) cap('layout', 1);
    if (tells.has('T-PLACEHOLDER-SOCIAL')) cap('evidence', 4);
    if (tells.has('T2-INTERNAL-CONTRADICTION')) cap('evidence', 2);

    // ── positives: the only way points are earned ──
    const positives = this.collectPositives();

    const prelaunch =
      !this.paymentRailSeen && !fired('copy-fabricated-testimonials') && this.pricingArrayFile === null;

    const categoryFit =
      this.bestLanding === null
        ? null
        : fired('layout-template-sequence')
          ? 'template'
          : this.bestLanding.parts.length <= 1
            ? 'distinct'
            : 'adapted';

    // Legacy meter: derived from tell density so old UI fields keep meaning.
    const weighted = [...tells].reduce((sum, t) => sum + (t.startsWith('T2-') ? 1.5 : 1), 0);

    return {
      findings: this.findings,
      notes,
      provenance: [...new Set(this.provenance)],
      tells: [...tells],
      positives,
      ceilings,
      dimensionCaps,
      prelaunch,
      categoryFit,
      uiFileCount: this.uiFileCount,
      vibeScore: Math.min(100, Math.round(weighted * 9)),
      copySamples: this.copySamples,
    };
  }

  /**
   * Positive evidence of decisions (Part 7.6). Each entry names what was
   * seen, so the report's "what you do well" section is concrete.
   */
  private collectPositives(): PositiveSignal[] {
    const out: PositiveSignal[] = [];
    const add = (id: string, label: string, dimension: DimensionId, points: number, evidence?: string) =>
      out.push({ id, label, dimension, points, evidence });

    // D1 — the token layer and its use
    if (this.themeExtended && (this.tokenUtilityCount > 0 || this.cssCustomPropCount >= 8)) {
      const semantic = [...this.tokenNames].some(
        (n) => !/^(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|gray|grey|slate|zinc|neutral|stone)(?:-\d+)?$/.test(n),
      );
      add('P-TOKENS', semantic ? 'Semantic token layer, consumed by components' : 'Token layer in use', 'system', semantic ? 12 : 8);
    } else if (this.themeExtended || this.cssCustomPropCount >= 8) {
      add('P-TOKENS', 'Token layer defined', 'system', 5);
    }
    if (this.scaleExtensionSeen) {
      add('P-SCALE', 'Defined spacing or type scale', 'system', 4);
      add('P-SCALE-TYPE', 'Type sizes drawn from a scale', 'typography', 2);
    }

    // D2 — type decisions
    if (this.fontFamilies.size >= 2) {
      add('P-TYPE-PAIR', 'Typefaces with distinct roles', 'typography', 6, [...this.fontFamilies].slice(0, 3).join(', '));
    } else if (this.fontFamilies.size === 1) {
      add('P-TYPE-LOADED', 'A chosen face, loaded deliberately', 'typography', 3, [...this.fontFamilies][0]);
    }

    // D3 — color decisions
    if (this.darkTokenOverrides >= 4) {
      add('P-DARK-MODE', 'Dark mode with its own token values', 'color', 4);
    }
    if (this.a11yToolingSeen) {
      add('P-CONTRAST-VERIFIED', 'Accessibility tooling in the project', 'color', 2);
      add('P-CONTRAST-VERIFIED-A11Y', 'Accessibility tooling in the project', 'accessibility', 2);
    }
    if (this.themeExtended && this.hueFamilies.size <= 3 && this.uiFileCount >= 3) {
      add('P-RESTRAINT', 'Restrained accent range', 'color', 3);
    }

    // D4 — layout decisions
    if (this.breakpointHits + this.mediaQueryHits >= 10) {
      add('P-RESPONSIVE', 'Responsive decisions at multiple breakpoints', 'layout', 4);
    } else if (this.breakpointHits + this.mediaQueryHits > 0) {
      add('P-RESPONSIVE', 'Responsive handling present', 'layout', 2);
    }
    if (this.responsivePriorityHits >= 3) {
      add('P-MOBILE-PRIORITY', 'Content priority decided per screen size', 'layout', 3);
    }
    if (this.ogMetaSeen) add('P-SHARE-META', 'Share preview configured', 'layout', 2);
    if (this.photoAssets >= 3) add('P-REAL-ASSETS', 'Real image assets, not placeholders', 'layout', 2);

    // D5 — interaction decisions
    if (this.hoverCount >= 10) add('P-HOVER', 'Hover and press feedback throughout', 'motion', 4);
    else if (this.hoverCount > 0) add('P-HOVER', 'Some interaction feedback', 'motion', 2);
    if (this.pendingSignalSeen) add('P-PENDING', 'Pending feedback on mutations', 'motion', 3);
    if (this.guardsMotion) {
      add('P-REDUCED-MOTION', 'Reduced-motion preference respected', 'motion', 3);
      add('P-REDUCED-MOTION-A11Y', 'Reduced-motion preference respected', 'accessibility', 1);
    }
    if (this.durationValues.size >= 3 && this.staggerSeen) {
      add('P-MOTION-INTENT', 'Motion varies by role, with stagger', 'motion', 4);
    } else if (this.durationValues.size >= 3) {
      add('P-MOTION-INTENT', 'Durations chosen per role', 'motion', 2);
    }

    // D6 — state coverage, the strongest proxy for human iteration
    if (this.emptyBranchSeen) {
      add('P-EMPTY-STATE', this.emptyCtaSeen ? 'Empty states with an action' : 'Empty states handled', 'states', this.emptyCtaSeen ? 6 : 4);
    }
    if (this.errorBoundarySeen) add('P-ERROR-STATE', 'Error paths render for the user', 'states', 5);
    if (this.skeletonSeen) add('P-LOADING', 'Loading handled with skeletons or fallbacks', 'states', 4);
    else if (this.loadingSeen) add('P-LOADING', 'Loading states present', 'states', 2);

    // D7 — accessibility decisions
    if (this.focusVisibleCount >= 3) add('P-FOCUS-VISIBLE', 'Deliberate focus-visible treatment', 'accessibility', 6);
    if (this.htmlLangFiles > 0) add('P-LANG', 'Document language declared', 'accessibility', 1);
    if (this.a11yToolingSeen && this.ciSeen) add('P-A11Y-CI', 'Accessibility checks wired into CI', 'accessibility', 3);

    // D8 — operational evidence
    if (this.jsonLdTypes.has('PostalAddress') || this.jsonLdTypes.has('LocalBusiness')) {
      add('P-ADDRESS', 'Physical address in structured data', 'evidence', 2);
    }
    if (this.telLinkSeen || this.mailtoSeen) add('P-CONTACT', 'Direct contact link', 'evidence', 1);
    if (this.photoAssets >= 4) add('P-OWN-PHOTOS', 'Own photography or product imagery', 'evidence', 3);
    if (this.pdfAssets >= 1) add('P-DOCUMENTS', 'Real documents in the asset tree', 'evidence', 2);
    if ([...this.jsonLdTypes].some((t) => ['LocalBusiness', 'Organization', 'Product'].includes(t))) {
      add('P-STRUCTURED-DATA', 'Structured business data', 'evidence', 1);
    }
    if (this.datedContentFiles >= 3) add('P-DATED-CONTENT', 'Dated content with real entries', 'evidence', 2);
    if (this.legalFiles.some((f) => !f.stubby)) add('P-REAL-LEGAL', 'Legal pages with real content', 'evidence', 2);
    if (this.paymentRailSeen) add('P-PAYMENT-RAIL', 'A working payment integration', 'evidence', 2);

    return out;
  }

  /** Generation-two detections (Part 12.3) that need whole-project context. */
  private emitSecondGeneration(nowYear: number): void {
    const agg = this.aggregateEmitter();

    // T2-INTERNAL-CONTRADICTION — the clearest signal in the labeled set.
    const byKind = new Map<string, { min: Claim; max: Claim }>();
    for (const c of this.claims) {
      const cur = byKind.get(c.kind);
      if (!cur) byKind.set(c.kind, { min: c, max: c });
      else {
        if (c.value < cur.min.value) cur.min = c;
        if (c.value > cur.max.value) cur.max = c;
      }
    }
    for (const { min, max } of byKind.values()) {
      if (max.value >= min.value * 10) {
        agg(
          {
            id: 'evidence-contradiction',
            title: 'Two claims on the site cannot both be true',
            severity: 'high',
            layer: 'evidence',
            tell: 'T2-INTERNAL-CONTRADICTION',
            vibeWeight: 1,
            explanation:
              `One place says "${min.raw}" and another says "${max.raw}". ` +
              'Both were written to fill a slot and neither was checked ' +
              'against the other. A visitor who notices this stops believing ' +
              'everything else on the page.',
            recommendation:
              'Pick the number that is true and use it everywhere. If neither ' +
              'is true yet, remove both. An honest page without counts beats ' +
              'one that argues with itself.',
            verify: 'Every quantitative claim on the site should agree with every other.',
          },
          min.file,
          `"${min.raw}" vs "${max.raw}"`,
        );
        break;
      }
    }

    // Stale copyright: part of the dead-scaffold family.
    const maxYear = Math.max(0, ...this.copyrightYears);
    if (maxYear > 0 && maxYear <= nowYear - 2) {
      agg(
        {
          id: 'evidence-stale-copyright',
          title: `Copyright year is ${maxYear}`,
          severity: 'low',
          layer: 'evidence',
          tell: 'T2-DEAD-SCAFFOLD',
          vibeWeight: 0.4,
          explanation:
            `The footer says ${maxYear} and it is ${nowYear}. A stale year is ` +
            'a small thing that tells visitors nobody is maintaining this.',
          recommendation:
            'Render the year from the clock instead of hardcoding it.',
          verify: 'The footer year should match the current year.',
        },
        undefined,
        `© ${maxYear}`,
      );
    }

    // Mechanically equal content blocks.
    for (const { relPath, lengths } of this.descLengthFiles) {
      const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const sd = Math.sqrt(lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length);
      if (mean > 0 && sd / mean < 0.12) {
        agg(
          {
            id: 'layout-uniform-copy-length',
            title: 'Card descriptions are all the same length',
            severity: 'low',
            layer: 'layout',
            tell: 'T-UNIFORM-COPY-LENGTH',
            vibeWeight: 0.5,
            explanation:
              `${lengths.length} descriptions in this file land within a few ` +
              'characters of each other. Copy that was written to say ' +
              'something varies in length. Copy that was padded to fill a ' +
              'template does not.',
            recommendation:
              'Rewrite each description to say the one specific thing that ' +
              'card is for, at whatever length that takes.',
            verify: 'Card copy should vary in length because it varies in content.',
          },
          relPath,
        );
        break;
      }
    }

    // Client-rendered shell serving a marketing page.
    if (this.spaOnlyStack && !this.ssrStackSeen && this.bestLanding) {
      agg(
        {
          id: 'layout-empty-shell',
          title: 'Marketing page served as an empty client-rendered shell',
          severity: 'medium',
          layer: 'layout',
          tell: 'T2-EMPTY-SHELL',
          confidence: 'likely',
          vibeWeight: 0.6,
          explanation:
            'The served HTML contains a root element and scripts. All ' +
            'content renders client-side, so search engines and link ' +
            'previews see an empty document. For a public marketing page ' +
            'this is a real reach problem, not an architectural taste.',
          recommendation:
            'Pre-render the public pages: a static build step or a ' +
            'framework with server rendering for the marketing routes.',
          verify: 'View source on the deployed landing page. The copy should be in the HTML.',
        },
        this.bestLanding.relPath,
      );
    }
  }

  /** Files a whole-project finding as a synthetic rule hit. */
  private aggregateEmitter() {
    return (
      rule: Omit<DesignRule, 'scope' | 'regex' | 'extensions' | 'maxFindings'> & {
        confidence?: Confidence;
      },
      filePath?: string,
      evidence?: string,
    ) => {
      const full: DesignRule = {
        ...rule,
        scope: 'file',
        regex: /$^/,
        extensions: UI,
        maxFindings: 1,
      };
      this.hits.set(rule.id, { rule: full, count: 1 });
      this.findings.push({
        checkType: 'design',
        severity: rule.severity,
        confidence: rule.confidence ?? 'likely',
        ruleId: rule.id,
        title: rule.title,
        explanation: rule.explanation,
        filePath,
        evidenceMasked: evidence?.slice(0, 160),
        recommendation: rule.recommendation,
      });
    };
  }

  /** The whole-project checks; each files a synthetic rule hit so scoring sees it. */
  private emitAggregates(): void {
    const agg = this.aggregateEmitter();

    // ── Layer A: the token system, or its absence ──
    if (this.tailwindSeen && this.uiFileCount >= 3 && !this.themeExtended && this.cssCustomPropCount < 8) {
      agg(
        {
          id: 'tokens-no-theme-extension',
          title: 'Your design system is the framework defaults',
          severity: 'high',
          layer: 'system',
          tell: 'T-NO-TOKENS',
          vibeWeight: 0.7,
          confidence: 'verified',
          explanation:
            'No theme extension, no custom properties, no token file exists ' +
            'anywhere in the project. Every color, radius, and shadow comes ' +
            'from the framework defaults that every other project also ships. ' +
            'A design system is a set of constrained decisions, and its ' +
            'absence is the clearest evidence that nobody made decisions.',
          recommendation:
            'Define your primitives once: two or three brand colors, one ' +
            'radius pair, one shadow pair, and a type scale. Put them in the ' +
            'theme so every component draws from the same decisions.',
          verify: 'The theme config or global stylesheet should declare project tokens, and components should use them.',
        },
        this.tailwindConfigPath ?? undefined,
      );
    }

    const utilityTotal = this.defaultUtilityCount + this.tokenUtilityCount;
    if (utilityTotal > 40 && this.defaultUtilityCount / utilityTotal > 0.85 && this.themeExtended) {
      agg(
        {
          id: 'tokens-defaults-in-markup',
          title: 'Color decisions made per element, not from tokens',
          severity: 'medium',
          layer: 'system',
          tell: 'T-DEFAULT-PALETTE',
          vibeWeight: 0.5,
          explanation:
            `Default-scale utilities outnumber project tokens ${this.defaultUtilityCount} ` +
            `to ${this.tokenUtilityCount} in the markup. A theme exists but the ` +
            'components are not using it, so color remains a per-element ' +
            'improvisation instead of a system. The issue is structure, never ' +
            'a particular hue.',
          recommendation:
            'Sweep the components and replace default-scale color utilities ' +
            'with your semantic tokens. Each color in the markup should name ' +
            'a role, not a palette step.',
          verify: 'Count default-scale color utilities again. Project tokens should dominate.',
        },
        undefined,
        `${this.defaultUtilityCount} default-scale vs ${this.tokenUtilityCount} token utilities`,
      );
    }

    // Spacing: one value everywhere means no hierarchy. Grouping depends on
    // gaps inside a group being visibly smaller than gaps between groups.
    const spacingTotal = [...this.spacingCounts.values()].reduce((a, b) => a + b, 0);
    if (spacingTotal >= 40) {
      const [topValue, topCount] = [...this.spacingCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (topCount / spacingTotal > 0.8) {
        agg(
          {
            id: 'tokens-spacing-monotone',
            title: 'One spacing value doing every job',
            severity: 'medium',
            layer: 'layout',
            tell: 'T-UNIFORM-RHYTHM',
            vibeWeight: 0.4,
            explanation:
              `A single spacing step (${topValue}) accounts for over 80% of ` +
              'all padding and gaps. Grouping depends on the gap inside a ' +
              'group being clearly smaller than the gap between groups, by a ' +
              'factor of two or more. Uniform spacing breaks that contract ' +
              'everywhere at once.',
            recommendation:
              'Pick two or three spacing roles: tight inside a group, medium ' +
              'between elements, wide between sections. Apply them by role.',
            verify: 'Related elements should sit visibly closer than unrelated ones.',
          },
          undefined,
          `spacing value ${topValue} used ${topCount} of ${spacingTotal} times`,
        );
      }
    }
    if (this.arbitrarySpacingCount >= 5) {
      agg(
        {
          id: 'tokens-spacing-adhoc',
          title: 'Arbitrary pixel spacing scattered through the markup',
          severity: 'low',
          layer: 'layout',
          vibeWeight: 0.4,
          explanation:
            `${this.arbitrarySpacingCount} spacing values are one-off pixel ` +
            'amounts outside any scale. Each was negotiated separately during ' +
            'a fix loop and never reconciled, which is how a spacing system ' +
            'dies.',
          recommendation:
            'Snap each arbitrary value to the nearest scale step. If a value ' +
            'recurs, it has earned a place in the scale.',
          verify: 'Search for bracketed pixel spacing values. Few or none should remain.',
        },
        undefined,
        this.arbitrarySpacingExample ?? undefined,
      );
    }

    if (this.radiusTokens.size > 3) {
      agg({
        id: 'tokens-radius-scatter',
        title: `${this.radiusTokens.size} different corner radii`,
        severity: 'low',
        layer: 'system',
        vibeWeight: 0.25,
        explanation:
          'Cards, buttons, and inputs each round their corners differently. ' +
          'Real systems vary radius by element size and role on purpose: an ' +
          'input and a modal encode different physical scales. Scatter means ' +
          'the values were never decided together.',
        recommendation:
          'Standardize on two radii, one for containers and one for ' +
          'controls, plus full for pills. Apply them everywhere.',
        verify: 'List every radius in the codebase. It should be a short deliberate set.',
      });
    }

    if (this.shadowTokens.size > 3) {
      agg({
        id: 'tokens-shadow-scatter',
        title: `${this.shadowTokens.size} different shadow depths`,
        severity: 'low',
        layer: 'system',
        vibeWeight: 0.2,
        explanation:
          'Shadows form an elevation language. A dropdown, a modal, and a ' +
          'resting card sit at different heights and should cast different ' +
          'shadows, but five depths on similar components means elevation ' +
          'was never mapped to anything.',
        recommendation:
          'Keep two shadows: a subtle one for resting cards and a stronger ' +
          'one for overlays and menus. Delete the rest.',
        verify: 'Each shadow in use should map to a named elevation level.',
      });
    }

    if (this.iconLibraries.size >= 2) {
      agg(
        {
          id: 'tokens-icon-mix',
          title: 'Icons drawn from multiple sets',
          severity: 'medium',
          layer: 'system',
          vibeWeight: 0.3,
          explanation:
            'Icons from different sets carry different stroke weights, corner ' +
            'styles, and grids. Mixing them reads like mixing typefaces ' +
            'mid-sentence, and it happens when code is generated in pieces ' +
            'that never met.',
          recommendation:
            'Pick one icon set and migrate every icon to it.',
          verify: 'The project should import icons from exactly one library.',
        },
        undefined,
        [...this.iconLibraries].join(', '),
      );
    }

    if (this.uiKitFiles.size >= 25) {
      const used = [...this.uiKitImports].filter((n) => this.uiKitFiles.has(n)).length;
      if (used / this.uiKitFiles.size < 0.4) {
        agg({
          id: 'tokens-uikit-uncustomized',
          title: `${this.uiKitFiles.size} kit components installed, ${used} used`,
          severity: 'low',
          layer: 'system',
          vibeWeight: 0.8,
          explanation:
            'The full component kit is scaffolded but mostly unused, the mark ' +
            'of a generator that installs everything up front. Good ' +
            'primitives are craft when customized. Installed wholesale and ' +
            'untouched, they are inventory.',
          recommendation:
            'Delete the components you do not import. Each lives in its own ' +
            'file, and any one can be re-added later.',
          verify: 'Every file under components/ui should be imported somewhere.',
        });
      }
    }

    // ── Layer B: state coverage ──
    if (this.listRenderFiles >= 3 && !this.emptyBranchSeen) {
      agg(
        {
          id: 'states-no-empty-states',
          title: 'Lists render, but never the empty case',
          severity: 'high',
          layer: 'states',
          tell: 'T-NO-EMPTY',
          vibeWeight: 0.5,
          explanation:
            `${this.listRenderFiles} components render collections and none ` +
            'of them branch on zero items. A new user sees a blank region ' +
            'with no explanation on their very first visit, which is the ' +
            'exact moment the interface most needs to speak.',
          recommendation:
            'For each list, add a branch for zero items that names what ' +
            'would be here, why it is not, and the action that fills it.',
          verify: 'Render each list with an empty array. Every one should explain itself.',
        },
        this.firstListFile ?? undefined,
      );
    }

    if (this.fetchSeen && !this.loadingSeen && this.uiFileCount >= 3) {
      agg({
        id: 'states-no-loading-states',
        title: 'Data loads with no pending state anywhere',
        severity: 'medium',
        layer: 'states',
        vibeWeight: 0.4,
        explanation:
          'The interface fetches data but shows nothing while waiting. The ' +
          'page renders empty, then snaps into place when data lands, and ' +
          'every layout shift is a small loss of trust.',
        recommendation:
          'Show a skeleton matched to the final layout while data loads. A ' +
          'skeleton reads faster than a spinner at identical duration ' +
          'because it communicates layout.',
        verify: 'Throttle the network and reload. Content areas should hold their shape.',
      });
    }

    if (this.hasAppDir && this.uiFileCount >= 3 && !this.errorBoundarySeen) {
      agg({
        id: 'states-no-error-boundary',
        title: 'No error boundary anywhere in the tree',
        severity: 'high',
        layer: 'states',
        tell: 'T-NO-ERROR',
        vibeWeight: 0.3,
        confidence: 'verified',
        explanation:
          'No error.tsx or error boundary component exists, so one thrown ' +
          'error blanks the entire application. This is the highest-severity ' +
          'state-coverage gap: everything else degrades, this one erases.',
        recommendation:
          'Add an error.tsx beside your root layout that names what failed ' +
          'and offers a way back. Add a global-error.tsx for the shell.',
        verify: 'Throw inside a page component in development. The app should degrade, not blank.',
      });
    }

    // ── Layer C: typography ──
    if (this.uiFileCount >= 3 && this.fontFamilies.size === 0) {
      agg({
        id: 'type-no-typeface-decision',
        title: 'One default face doing every typographic job',
        severity: 'medium',
        layer: 'typography',
        tell: 'T-DEFAULT-TYPEFACE',
        vibeWeight: 0.3,
        explanation:
          'No font is imported and no family is configured, so the framework ' +
          'default carries display, body, and label duty alone. The default ' +
          'is a fine typeface. The finding is that no typographic decision ' +
          'was made anywhere.',
        recommendation:
          'Decide the type deliberately: keep one face but tune sizes, ' +
          'weights, and tracking per role, or pair a display face with a ' +
          'body face that contrasts in classification or weight.',
        verify: 'The root layout should declare a chosen font setup.',
      });
    }

    if (this.fontFamilies.size > 3) {
      agg(
        {
          id: 'type-font-zoo',
          title: `${this.fontFamilies.size} different typefaces in one product`,
          severity: 'medium',
          layer: 'typography',
          vibeWeight: 0.2,
          explanation:
            'The project loads several unrelated font families. Every ' +
            'additional family fragments the visual voice and adds page ' +
            'weight. A crowd of fonts is one of the fastest signals that ' +
            'the type was never decided as a system.',
          recommendation:
            'Pick one family for everything, plus a monospace for code if ' +
            'needed, and delete the rest.',
          verify: 'The network tab should load at most two font families.',
        },
        undefined,
        [...this.fontFamilies].slice(0, 8).join(', '),
      );
    }

    const weightKeys = [...this.fontWeightCounts.keys()];
    const weightUses = [...this.fontWeightCounts.values()].reduce((a, b) => a + b, 0);
    if (
      weightUses >= 10 &&
      weightKeys.every((w) => w === 'bold' || w === 'normal') &&
      weightKeys.length > 0
    ) {
      agg({
        id: 'type-weight-collapse',
        title: 'Only bold and normal in the whole weight range',
        severity: 'low',
        layer: 'typography',
        vibeWeight: 0.3,
        explanation:
          'Every piece of type is either bold or normal. Real typographic ' +
          'systems use medium and semibold to build hierarchy without ' +
          'shouting, and a two-weight system can only whisper or yell.',
        recommendation:
          'Introduce medium for labels and semibold for subheads, and ' +
          'reserve bold for the few moments that earn it.',
        verify: 'Headings, labels, and body should sit at distinct weights.',
      });
    }

    // ── Layer D: interaction and motion ──
    if (this.interactiveCount >= 10 && this.hoverCount === 0) {
      agg({
        id: 'motion-no-hover-feedback',
        title: 'Interactive elements with no hover or press feedback',
        severity: 'medium',
        layer: 'motion',
        tell: 'T-DEAD-INTERACTION',
        vibeWeight: 0.3,
        explanation:
          `${this.interactiveCount} interactive elements exist and none ` +
          'change on hover or press. A control that does not respond feels ' +
          'dead in a way people register without being able to name, and it ' +
          'removes the signal that the element can be pressed at all.',
        recommendation:
          'Give every interactive element a hover and active state: a ' +
          'surface shift, a border change, or a slight depress on press.',
        verify: 'Hover each button and link. Every one should visibly respond.',
      });
    }

    if (this.formSubmitCount >= 2 && !this.pendingSignalSeen) {
      agg(
        {
          id: 'motion-no-pending-feedback',
          title: 'Forms submit with no pending feedback',
          severity: 'medium',
          layer: 'motion',
          vibeWeight: 0.4,
          explanation:
            'Form submits fire with no disabled state and no pending ' +
            'indicator. The person clicks and nothing happens for the length ' +
            'of the request, so they click again, and now the request runs ' +
            'twice. Feedback later than about 300ms of silence has already ' +
            'failed.',
          recommendation:
            'Disable the submit control while the request is in flight and ' +
            'show a pending indicator on the button itself.',
          verify: 'Submit each form on a slow network. The button should disable and indicate.',
        },
        this.firstFormFile ?? undefined,
      );
    }

    if (this.usesMotion && !this.guardsMotion) {
      agg({
        id: 'motion-no-reduced-motion',
        title: 'Animations ignore the reduced-motion preference',
        severity: 'low',
        layer: 'motion',
        tell: 'T-NO-MOTION-PREF',
        vibeWeight: 0,
        explanation:
          'The project animates but never checks prefers-reduced-motion. ' +
          'For people with vestibular disorders, unexpected motion causes ' +
          'real dizziness and nausea, which WCAG 2.3.3 exists to prevent.',
        recommendation:
          'Gate decorative animation behind the preference and replace ' +
          'movement with opacity changes rather than removing all feedback.',
        verify: 'Enable reduced motion in system settings. Decorative movement should stop.',
      });
    }

    // ── Layer E: structural layout ──
    // Hero + FAQ + CTA alone is convention, and convention is not a defect.
    // A fabricated-credibility signal is what turns the sequence into the
    // template. The finding is that nothing in it is specific to this product.
    if (this.bestLanding && this.bestLanding.score >= 4 && this.bestLanding.strong >= 1) {
      agg(
        {
          id: 'layout-template-sequence',
          title: 'The canonical generated page sequence',
          severity: 'high',
          layer: 'layout',
          vibeWeight: 1,
          explanation:
            `This page runs the standard sequence: a hero, ${this.bestLanding.parts.join(
              ', ',
            )}. The sequence itself is a convention older than the tools. ` +
            'The finding is that nothing in it is specific to this product, ' +
            'and visitors who have seen the pattern all week discount the ' +
            'product before reading a word.',
          recommendation:
            'Break the sequence where it matters most: replace the feature ' +
            'grid with one section that shows the real product, cut sections ' +
            'that repeat each other, and lead with the sentence only this ' +
            'product can say.',
          verify: 'At least one section should be impossible to reuse on another product.',
        },
        this.bestLanding.relPath,
      );
    }

    // Breakpoints exist, but every one of them only re-flows columns:
    // nothing is hidden, shown, or reordered per screen. Mobile receives
    // the entire desktop page, stacked — the endless-scroll page.
    if (
      this.uiFileCount >= 3 &&
      this.breakpointHits >= 10 &&
      this.responsivePriorityHits === 0
    ) {
      agg({
        id: 'layout-no-mobile-priority',
        title: 'Mobile gets the whole desktop page, stacked',
        severity: 'medium',
        layer: 'layout',
        tell: 'T-NO-MOBILE-PRIORITY',
        vibeWeight: 0.4,
        explanation:
          'Breakpoints exist, but every one of them only changes column ' +
          'counts. Nothing is hidden, summarized, or reordered for small ' +
          'screens, so a phone receives the entire desktop page stacked ' +
          'into one very long scroll. Real responsive design decides what ' +
          'matters most on a small screen and defers the rest.',
        recommendation:
          'Pick what a phone visitor needs first and put it on the first ' +
          'screen. Hide or collapse secondary sections on small screens ' +
          'and reorder where reading order should differ from desktop.',
        verify:
          'The mobile page should be meaningfully shorter than the desktop ' +
          'page, not the same content in one column.',
      });
    }

    if (this.uiFileCount >= 3 && this.breakpointHits === 0 && this.mediaQueryHits === 0) {
      agg({
        id: 'layout-no-responsive',
        title: 'No responsive breakpoints anywhere',
        severity: 'high',
        layer: 'layout',
        tell: 'T-NO-RESPONSIVE',
        vibeWeight: 0,
        explanation:
          'Not a single breakpoint or media query exists in the project, so ' +
          'the layout cannot adapt to phones, where more than half of first ' +
          'visits happen. Whatever renders on a laptop is being crushed or ' +
          'clipped on mobile.',
        recommendation:
          'Open the site at 375px wide and fix what breaks, starting with ' +
          'grids and horizontal padding.',
        verify: 'The layout should hold at 375px and at 320px wide.',
      });
    }

    if (this.megaPageFile) {
      agg(
        {
          id: 'layout-mega-page',
          title: `One ${this.megaPageFile.lines}-line file holds the whole page`,
          severity: 'medium',
          layer: 'layout',
          vibeWeight: 0.6,
          explanation:
            `This file contains the entire page: ${this.megaPageFile.arrays} hardcoded ` +
            'data arrays and every section inline. That is the shape of a ' +
            'single long generation pass, and it makes every future edit ' +
            'riskier because nothing has a boundary.',
          recommendation:
            'Split each section into its own component and move the data ' +
            'arrays next to them. Smaller files also give coding tools ' +
            'better context next time.',
          verify: 'The page file should compose named components, each under 200 lines.',
        },
        this.megaPageFile.relPath,
      );
    }

    // ── Layer F: copy and content integrity ──
    const stubs = this.legalFiles.filter((f) => f.stubby);
    if (stubs.length > 0) {
      agg(
        {
          id: 'copy-legal-stub',
          title: 'Placeholder legal pages',
          severity: 'high',
          layer: 'evidence',
          vibeWeight: 0.8,
          explanation:
            'The privacy policy or terms look generated and unedited, with ' +
            'template markers or near-empty content. Legal pages that do not ' +
            'describe what you actually do with data are worse than none. ' +
            'Privacy regulation keys on inaccurate disclosures, and savvy ' +
            'users check.',
          recommendation:
            'Write what is true: what data you collect, where it is stored, ' +
            'which vendors process it, and how to get it deleted. A short ' +
            'accurate policy beats ten template pages.',
          verify: 'Every sentence in the legal pages should be true of this product.',
        },
        stubs[0].relPath,
      );
    } else if (this.legalLinkSeen && this.legalFiles.length === 0) {
      agg({
        id: 'copy-legal-missing',
        title: 'Legal links with no legal pages in the repo',
        severity: 'medium',
        layer: 'evidence',
        vibeWeight: 0.6,
        explanation:
          'The site links to privacy or terms pages that do not exist in ' +
          'this repository. If those links 404 in production, the break ' +
          'lands on the most trust-sensitive pages a product has. If they ' +
          'live outside this repo, ignore this finding.',
        recommendation:
          'Click both links on the deployed site. If they 404, write the ' +
          'real pages.',
        verify: 'The privacy and terms links should resolve on the deployed site.',
      });
    }

    if (this.readmeTemplate) {
      agg({
        id: 'copy-readme-template',
        title: `README is still ${this.readmeTemplate}`,
        severity: 'low',
        layer: 'evidence',
        vibeWeight: 0.9,
        confidence: 'verified',
        explanation:
          'The README is the scaffold default. It is the first thing anyone ' +
          'doing diligence sees, and it currently says nobody has touched ' +
          'this.',
        recommendation:
          'Three honest paragraphs beat the template: what the product does, ' +
          'how to run it locally, and its current status.',
        verify: 'The README should describe this product, not the starter kit.',
      });
    }

    if (this.readmeAiStyled && !this.readmeTemplate) {
      agg({
        id: 'copy-readme-generated-style',
        title: 'README written in generator house style',
        severity: 'low',
        layer: 'evidence',
        vibeWeight: 0.6,
        explanation:
          'Emoji section headers and a "Made with ❤️" footer are the stock ' +
          'README register of unreviewed output. Anyone doing diligence on ' +
          'the repo reads it as generated and unrevised.',
        recommendation:
          'Rewrite it in your own voice: what it does, how to run it, and ' +
          'its current status. No emoji headers.',
        verify: 'The README headings should be plain text.',
      });
    }

    if (this.fakeAuthFile) {
      agg(
        {
          id: 'copy-fake-auth',
          title: 'Login form that does not authenticate',
          severity: 'high',
          layer: 'evidence',
          tell: 'T2-DEAD-SCAFFOLD',
          vibeWeight: 0.85,
          explanation:
            'This login form navigates straight into the app without calling ' +
            'any authentication service. Anyone can type anything and get ' +
            'in, and people who create accounts are storing nothing.',
          recommendation:
            'Wire it to a real auth provider, or remove the form until you ' +
            'do.',
          verify: 'Submitting wrong credentials should fail. Submitting none should fail.',
        },
        this.fakeAuthFile,
      );
    }

    if (this.pricingArrayFile && !this.paymentRailSeen) {
      agg(
        {
          id: 'copy-pricing-no-rail',
          title: 'Pricing table with no way to pay',
          severity: 'medium',
          layer: 'evidence',
          tell: 'T2-DEAD-SCAFFOLD',
          vibeWeight: 0.8,
          explanation:
            'The page shows paid tiers, but no payment integration exists ' +
            'anywhere in the project. The pricing table is decoration, and a ' +
            'visitor who clicks the paid tier discovers that immediately.',
          recommendation:
            'Either wire the paid tier to a real checkout or remove the ' +
            'pricing page until the product can take money. "Free while in ' +
            'beta" is an honest interim answer.',
          verify: 'Clicking the paid tier should start a real checkout.',
        },
        this.pricingArrayFile,
      );
    }

    const missingRoutes = this.missingInternalRoutes();
    if (missingRoutes.length >= 2) {
      agg(
        {
          id: 'copy-missing-routes',
          title: 'Navigation links to pages that do not exist',
          severity: 'medium',
          layer: 'evidence',
          tell: 'T2-DEAD-SCAFFOLD',
          vibeWeight: 0.7,
          explanation:
            `The site links to ${missingRoutes.slice(0, 6).join(', ')} and no ` +
            'matching pages exist in this repository. Generators invent a ' +
            'whole company in the navigation, and every one of those links ' +
            'is a 404 in production.',
          recommendation:
            'Delete links to pages you have not built. When someone asks ' +
            'where the blog went, that is the day to add it back.',
          verify: 'Click every navigation link on the deployed site. None should 404.',
        },
        this.internalLinks.get(missingRoutes[0]) ?? undefined,
      );
    }

    if (this.scaffoldAssets.length >= 2) {
      agg(
        {
          id: 'copy-scaffold-assets',
          title: 'Starter-kit assets still in public/',
          severity: 'low',
          layer: 'evidence',
          vibeWeight: 0.85,
          confidence: 'verified',
          explanation:
            'The default starter logos are still sitting in the public ' +
            'folder. A small thing that says nobody has looked through the ' +
            'project files.',
          recommendation: 'Delete the unused starter assets.',
          verify: 'The public folder should hold only assets this product uses.',
        },
        this.scaffoldAssets[0],
      );
    }

    if (this.bestLanding && this.bestLanding.score >= 3 && !this.ogMetaSeen) {
      agg({
        id: 'copy-no-share-preview',
        title: 'No social-share preview configured',
        severity: 'low',
        layer: 'evidence',
        vibeWeight: 0.2,
        explanation:
          'The site has a marketing page but no share metadata, so posting ' +
          'the link anywhere shows a bare URL instead of a preview, exactly ' +
          'when first impressions matter most.',
        recommendation:
          'Add share metadata with a title, description, and one preview ' +
          'image at 1200 by 630.',
        verify: 'Paste the URL into a chat app. A preview card should render.',
      });
    }

    if (this.consoleLogCount >= 8) {
      agg({
        id: 'copy-console-debris',
        title: `${this.consoleLogCount} console.log calls left in the code`,
        severity: 'low',
        layer: 'evidence',
        vibeWeight: 0.4,
        explanation:
          'Anyone who opens the browser console watches internal state ' +
          'scroll by, occasionally including things that should not be ' +
          'public. It is the digital equivalent of shipping with the ' +
          'scaffolding still up.',
        recommendation:
          'Delete the logs and keep intentional logging behind a debug flag.',
        verify: 'The deployed console should stay quiet during normal use.',
      });
    }

    if (this.todoCount >= 5) {
      agg({
        id: 'copy-todo-debris',
        title: `${this.todoCount} TODO markers in the code`,
        severity: 'low',
        layer: 'evidence',
        vibeWeight: 0.3,
        explanation:
          'A scattering of TODOs is normal. Dozens of them, especially ' +
          'generated "TODO: implement" stubs, map exactly to features that ' +
          'look finished on screen and are not.',
        recommendation:
          'Triage them: do it, ticket it, or delete it. Anything user-facing ' +
          'goes first.',
        verify: 'Remaining TODOs should each have an owner or a ticket.',
      });
    }

    // ── Layer G: document-level accessibility ──
    if (this.htmlTagFiles > 0 && this.htmlLangFiles === 0) {
      agg({
        id: 'a11y-no-html-lang',
        title: 'Page language never declared',
        severity: 'medium',
        layer: 'accessibility',
        vibeWeight: 0,
        confidence: 'verified',
        explanation:
          'The html element has no lang attribute, so screen readers have ' +
          'to guess the language and often mispronounce every word. WCAG ' +
          '3.1.1, level A.',
        recommendation: 'Add lang="en", or your language, to the html tag in the root layout.',
        verify: 'The rendered html element should carry a lang attribute.',
      });
    }

    if (this.headingSkipFile) {
      agg(
        {
          id: 'a11y-heading-skip',
          title: 'Heading levels skip from h1 to h3',
          severity: 'low',
          layer: 'accessibility',
          vibeWeight: 0,
          explanation:
            'A page jumps from h1 to h3 with no h2. Screen-reader users ' +
            'navigate by heading outline, and a skipped level reads like a ' +
            'missing chapter.',
          recommendation:
            'Keep heading levels sequential and style them independently of ' +
            'their level.',
          verify: 'The heading outline should descend one level at a time.',
        },
        this.headingSkipFile,
      );
    }
  }
}

export type { CraftLayerId };
