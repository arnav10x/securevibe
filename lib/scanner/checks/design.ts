// Check 5: the design audit. Two layers work together:
//
//   1. Per-file rules from rules/design-rules.ts (regex hits with evidence)
//   2. Project-wide signals that only make sense in aggregate — how many
//      fonts, how many accent colors, whether the landing page is the
//      standard AI template, whether the legal pages are real
//
// Usage from the orchestrator:
//   const design = new DesignAnalyzer();
//   design.addFile(relPath, content);   // once per text file, in the walk loop
//   const audit = design.finish();      // findings + scores, once at the end

import path from 'node:path';
import type { DesignCategoryScore, Finding, Severity } from '../types';
import {
  CSS,
  DESIGN_CATEGORIES,
  DESIGN_RULES,
  UI,
  type DesignCategoryId,
  type DesignRule,
} from '../rules/design-rules';

export interface DesignAudit {
  findings: Finding[];
  notes: string[];
  /** 0–100, weighted across categories — higher is better craft. */
  designScore: number;
  /** 0–100, how loudly the project announces "unedited AI output". */
  vibeScore: number;
  categories: DesignCategoryScore[];
}

/** Points a finding costs its category, by severity. */
const CATEGORY_PENALTY: Record<Severity, number> = {
  critical: 18, // design rules never use critical today, but be safe
  high: 14,
  medium: 8,
  low: 4,
};

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

const USER_COUNT =
  /(?:trusted by|join(?:ed)?(?: by)?|loved by|used by)\s*(?:over\s*)?[\d,.]+k?\+?\s*(?:users|developers|devs|teams|customers|companies|founders|creators|builders)|[\d,]{4,}\+\s*(?:happy\s+)?(?:users|developers|customers|downloads|teams)/i;

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

  private uiFileCount = 0;
  private breakpointHits = 0;
  private mediaQueryHits = 0;
  private fontFamilies = new Set<string>();
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

  addFile(relPath: string, content: string): void {
    // Test files and fixtures are not shipped UI — planted junk in a test
    // must not drag the design grade (secrets there still matter, but the
    // security checks handle those independently).
    if (
      /(?:^|\/)(?:tests?|__tests__|__mocks__|fixtures?|e2e|cypress|playwright|stories|\.storybook)\//i.test(relPath) ||
      /\.(?:test|spec|stories)\.[jt]sx?$/.test(relPath)
    ) {
      return;
    }

    const ext = path.posix.extname(relPath).toLowerCase();
    const base = relPath.split('/').pop() ?? '';

    this.noteScaffoldAsset(relPath);
    this.noteRoute(relPath);

    if (base === 'README.md' && !relPath.includes('/')) {
      this.checkReadme(content);
      return; // the README gets its own checks, not the UI rules
    }
    if (base === 'package.json') {
      if (/"(?:stripe|@stripe\/|paddle|@paddle\/|lemonsqueezy|@lemonsqueezy)/i.test(content)) {
        this.paymentRailSeen = true;
      }
      this.runRules(relPath, ext, content); // builder fingerprints live here too
      return;
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

  /** Build the route inventory so we can catch links to pages that don't exist. */
  private noteRoute(relPath: string): void {
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

    this.scoreLandingShape(relPath, content);
  }

  private collectCssSignals(content: string): void {
    this.mediaQueryHits += content.match(/@media\b/g)?.length ?? 0;
    if (/@keyframes\b/.test(content)) this.usesMotion = true;
    if (/prefers-reduced-motion/.test(content)) this.guardsMotion = true;

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
    for (const m of content.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]next\/font\/google['"]/g)) {
      for (const name of m[1].split(',')) {
        const clean = name.trim().split(/\s+as\s+/)[0].replace(/_/g, ' ').toLowerCase();
        if (clean) this.fontFamilies.add(clean);
      }
    }
    this.consoleLogCount += content.match(/\bconsole\.log\(/g)?.length ?? 0;
    this.todoCount += content.match(/\b(?:TODO|FIXME|HACK)\b/g)?.length ?? 0;
  }

  /**
   * The classic AI landing page, measured: badge pill over the H1, a
   * feature-card grid, an FAQ, a user-count boast, and a big "Get started".
   * Any one alone is normal; four or more in one file is the template.
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
      this.readmeTemplate = 'the Lovable default';
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

  // ── aggregate findings + scoring ─────────────────────────────────────

  finish(): DesignAudit {
    this.emitAggregates();

    // Deductions per category: base penalty per rule, +25% of base for each
    // repeat occurrence, capped at 2× so one noisy rule can't zero a grade.
    const deductions = new Map<DesignCategoryId, number>();
    let vibe = 0;
    for (const { rule, count } of this.hits.values()) {
      const base = CATEGORY_PENALTY[rule.severity];
      const scaled = Math.min(base * 2, base + (count - 1) * base * 0.25);
      deductions.set(rule.category, (deductions.get(rule.category) ?? 0) + scaled);
      if (rule.vibeWeight > 0) {
        vibe += Math.round(rule.vibeWeight * 25) + Math.min(count - 1, 4) * 3;
      }
    }

    const categories: DesignCategoryScore[] = DESIGN_CATEGORIES.map((cat) => {
      const findingCount = [...this.hits.values()].filter(
        (h) => h.rule.category === cat.id,
      ).reduce((n, h) => n + h.count, 0);
      return {
        id: cat.id,
        label: cat.label,
        score: Math.max(0, Math.round(100 - (deductions.get(cat.id) ?? 0))),
        findingCount,
      };
    });

    const designScore = Math.round(
      DESIGN_CATEGORIES.reduce((sum, cat, i) => sum + categories[i].score * cat.weight, 0) / 100,
    );

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

    return {
      findings: this.findings,
      notes,
      designScore,
      vibeScore: Math.min(100, vibe),
      categories,
    };
  }

  /** The whole-project checks; each files a synthetic rule hit so scoring sees it. */
  private emitAggregates(): void {
    const agg = (
      rule: Omit<DesignRule, 'scope' | 'regex' | 'extensions' | 'maxFindings'>,
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
        title: rule.title,
        explanation: rule.explanation,
        filePath,
        evidenceMasked: evidence?.slice(0, 160),
        recommendation: rule.recommendation,
      });
    };

    // Hero + FAQ + CTA alone is just a website; a fabricated-credibility
    // signal (fake stats, testimonials, user counts) is what makes it the
    // template rather than a page a person composed.
    if (this.bestLanding && this.bestLanding.score >= 4 && this.bestLanding.strong >= 1) {
      agg(
        {
          id: 'vibe-classic-layout',
          title: 'The standard AI landing-page template',
          severity: 'high',
          category: 'originality',
          vibeWeight: 1,
          explanation:
            `This page follows the layout every AI generator produces: a hero, ${this.bestLanding.parts.join(
              ', ',
            )}. Each piece is fine alone — together they are the template ` +
            'thousands of other sites shipped this month, and visitors ' +
            'pattern-match it in seconds. A page that looks auto-generated ' +
            'makes people assume the product is too.',
          recommendation:
            'Break the template where it matters most: replace the feature-card ' +
            'grid with one section that SHOWS the product (screenshot, live ' +
            'demo, real output), cut sections that repeat each other, and lead ' +
            'with the one sentence only your product can say.',
        },
        this.bestLanding.relPath,
      );
    }

    const stubs = this.legalFiles.filter((f) => f.stubby);
    if (stubs.length > 0) {
      agg(
        {
          id: 'vibe-legal-stub',
          title: 'Placeholder legal pages',
          severity: 'high',
          category: 'content',
          vibeWeight: 0.8,
          explanation:
            'The privacy policy / terms of service look generated and unedited ' +
            '(template markers or near-empty content). Publishing legal pages ' +
            'that do not describe what you actually do with data is worse than ' +
            'having none: it can create real legal exposure (GDPR/CCPA fines ' +
            'key on inaccurate disclosures), and savvy users check.',
          recommendation:
            'Write what is true: what data you collect, where it is stored, who ' +
            'processes it (list your real vendors), and how to get it deleted. ' +
            'A short accurate policy beats ten pages of template. For terms, a ' +
            'generator like Termly gives a legitimate starting point — but you ' +
            'must fill in the real details.',
        },
        stubs[0].relPath,
      );
    } else if (this.legalLinkSeen && this.legalFiles.length === 0) {
      agg({
        id: 'vibe-legal-missing',
        title: 'Legal links with no legal pages in the repo',
        severity: 'medium',
        category: 'content',
        vibeWeight: 0.6,
        explanation:
          'The site links to privacy/terms pages we could not find in this ' +
          'repository. If those links 404 in production, that is a broken ' +
          'promise on the most trust-sensitive pages a product has. (If they ' +
          'live outside this repo, ignore this finding.)',
        recommendation:
          'Click both links on your deployed site. If they 404, write the real ' +
          'pages — what data you collect, where it goes, how users can leave.',
      });
    }

    if (this.uiFileCount >= 3 && this.breakpointHits === 0 && this.mediaQueryHits === 0) {
      agg({
        id: 'layout-no-responsive',
        title: 'No responsive breakpoints anywhere',
        severity: 'high',
        category: 'layout',
        vibeWeight: 0,
        explanation:
          'Not a single sm:/md:/lg: class or @media query exists in the ' +
          'project, so the layout cannot adapt to phones — where more than ' +
          'half of first visits happen. Whatever renders on a laptop is being ' +
          'crushed or clipped on mobile.',
        recommendation:
          'Open the site at 375px wide and fix what breaks, starting with ' +
          'grids (grid-cols-1 md:grid-cols-3) and horizontal padding.',
      });
    }

    if (this.fontFamilies.size > 3) {
      agg(
        {
          id: 'type-font-zoo',
          title: `${this.fontFamilies.size} different typefaces in one product`,
          severity: 'medium',
          category: 'typography',
          vibeWeight: 0.2,
          explanation:
            'Professional products use one or two typefaces — Stripe, Linear, ' +
            'and Apple all do. Every additional family fragments the visual ' +
            'voice and adds page weight; a crowd of fonts is one of the ' +
            'fastest "no designer was here" signals.',
          recommendation:
            'Pick one family for everything (plus a monospace for code if you ' +
            'need it) and delete the rest.',
        },
        undefined,
        [...this.fontFamilies].slice(0, 8).join(', '),
      );
    }

    if (this.hueFamilies.size > 4) {
      agg(
        {
          id: 'color-hue-zoo',
          title: `${this.hueFamilies.size} accent color families in use`,
          severity: 'medium',
          category: 'color',
          vibeWeight: 0.35,
          explanation:
            'The UI draws from many unrelated color families. Refined ' +
            'interfaces are neutrals plus one to three accents used with ' +
            'intent; a rainbow of section colors reads as decoration applied ' +
            'at random — which is exactly how generators apply it.',
          recommendation:
            'Choose one brand accent (two at most) plus a green/red for ' +
            'success/error, then repaint every stray color to a neutral.',
        },
        undefined,
        [...this.hueFamilies].slice(0, 10).join(', '),
      );
    }

    if (this.radiusTokens.size > 3) {
      agg({
        id: 'consistency-radius-zoo',
        title: `${this.radiusTokens.size} different corner radii`,
        severity: 'low',
        category: 'consistency',
        vibeWeight: 0.25,
        explanation:
          'Cards, buttons, and inputs each rounding their corners differently ' +
          'is subtle, but it is precisely the kind of drift a design system ' +
          'prevents — and the eye registers it as "something is off".',
        recommendation:
          'Standardize on two radii (e.g. rounded-lg for containers, ' +
          'rounded-md for controls, rounded-full for pills) and apply them ' +
          'everywhere.',
      });
    }

    if (this.shadowTokens.size > 3) {
      agg({
        id: 'consistency-shadow-zoo',
        title: `${this.shadowTokens.size} different shadow depths`,
        severity: 'low',
        category: 'consistency',
        vibeWeight: 0.2,
        explanation:
          'Shadows form an elevation language: Material Design uses 2–3 ' +
          'levels, not five. Mixed depths on similar components make the page ' +
          'feel assembled from parts rather than designed.',
        recommendation:
          'Keep two shadows: a subtle one for resting cards, a stronger one ' +
          'for overlays/menus. Delete the rest.',
      });
    }

    if (this.iconLibraries.size >= 2) {
      agg(
        {
          id: 'consistency-icon-mix',
          title: 'Multiple icon libraries mixed together',
          severity: 'medium',
          category: 'consistency',
          vibeWeight: 0.3,
          explanation:
            'Icons from different sets have different stroke weights, corner ' +
            'styles, and grids — mixing them is like mixing fonts mid-sentence. ' +
            'It happens when code is generated in pieces that never met.',
          recommendation:
            'Pick one set (Lucide and Heroicons are both free and complete) ' +
            'and migrate every icon to it.',
        },
        undefined,
        [...this.iconLibraries].join(', '),
      );
    }

    if (this.usesMotion && !this.guardsMotion) {
      agg({
        id: 'a11y-no-reduced-motion',
        title: 'Animations ignore reduced-motion preference',
        severity: 'low',
        category: 'accessibility',
        vibeWeight: 0,
        explanation:
          'The project animates (animate-pulse, keyframes, or motion ' +
          'libraries) but never checks prefers-reduced-motion. For people ' +
          'with vestibular disorders, unexpected motion is not a style choice ' +
          '— it causes real dizziness and nausea (WCAG 2.3.3).',
        recommendation:
          'Gate decorative animation behind the preference: in Tailwind, add ' +
          'motion-reduce:animate-none (or motion-safe: variants); in CSS, wrap ' +
          'keyframe animations in @media (prefers-reduced-motion: no-preference).',
      });
    }

    if (this.htmlTagFiles > 0 && this.htmlLangFiles === 0) {
      agg({
        id: 'a11y-no-html-lang',
        title: 'Page language never declared',
        severity: 'medium',
        category: 'accessibility',
        vibeWeight: 0,
        explanation:
          'The <html> element has no lang attribute, so screen readers have ' +
          'to guess the language and often mispronounce every word — WCAG ' +
          '3.1.1, level A.',
        recommendation: 'Add lang="en" (or your language) to the <html> tag in the root layout.',
      });
    }

    if (this.readmeTemplate) {
      agg({
        id: 'vibe-readme-template',
        title: `README is still ${this.readmeTemplate}`,
        severity: 'low',
        category: 'polish',
        vibeWeight: 0.9,
        explanation:
          'The README is the scaffold default — the first thing anyone ' +
          '(investors, contributors, customers doing due diligence) sees on ' +
          'GitHub, and it currently says "nobody has touched this".',
        recommendation:
          'Three honest paragraphs beat the template: what the product does, ' +
          'how to run it locally, and its current status.',
      });
    }

    if (this.fakeAuthFile) {
      agg(
        {
          id: 'vibe-fake-auth',
          title: 'Login form that does not authenticate',
          severity: 'high',
          category: 'content',
          vibeWeight: 0.85,
          explanation:
            'This login/signup form navigates straight to the app without ' +
            'calling any authentication service — a movie-set door. Anyone ' +
            'can type anything and get in, and users who "create accounts" ' +
            'are storing nothing.',
          recommendation:
            'Wire it to a real auth provider (Supabase Auth, Clerk, and ' +
            'NextAuth all have free tiers) or remove the form until you do.',
        },
        this.fakeAuthFile,
      );
    }

    if (this.pricingArrayFile && !this.paymentRailSeen) {
      agg(
        {
          id: 'vibe-pricing-no-rail',
          title: 'Pricing table with no way to pay',
          severity: 'medium',
          category: 'content',
          vibeWeight: 0.8,
          explanation:
            'The page shows Free/Pro/Enterprise tiers, but there is no ' +
            'payment integration anywhere in the project — no Stripe, no ' +
            'Paddle, nothing. The pricing table is decoration, and a visitor ' +
            'who clicks "Upgrade" discovers that immediately.',
          recommendation:
            'Either wire the paid tier to a real checkout (Stripe Checkout is ' +
            'a day of work) or remove the pricing page until the product can ' +
            'take money. "Free while in beta" is an honest interim answer.',
        },
        this.pricingArrayFile,
      );
    }

    const missingRoutes = this.missingInternalRoutes();
    if (missingRoutes.length >= 2) {
      agg(
        {
          id: 'vibe-missing-routes',
          title: 'Navigation links to pages that do not exist',
          severity: 'medium',
          category: 'content',
          vibeWeight: 0.7,
          explanation:
            `The site links to ${missingRoutes.slice(0, 6).join(', ')} — but no ` +
            'matching pages exist in this repository. AI generators invent a ' +
            'whole company (blog, careers, docs) in the navigation; every one ' +
            'of those links 404s in production.',
          recommendation:
            'Delete links to pages you have not built. When someone asks where ' +
            'the blog went, that is the day to add it back.',
        },
        this.internalLinks.get(missingRoutes[0]) ?? undefined,
      );
    }

    if (this.scaffoldAssets.length >= 2) {
      agg(
        {
          id: 'polish-scaffold-assets',
          title: 'Starter-kit assets still in public/',
          severity: 'low',
          category: 'polish',
          vibeWeight: 0.85,
          explanation:
            'The default framework logos (next.svg, vercel.svg, vite.svg…) ' +
            'are still sitting in the public folder — a small thing that ' +
            'says nobody has looked through the project’s own files.',
          recommendation: 'Delete the unused starter assets.',
        },
        this.scaffoldAssets[0],
      );
    }

    if (this.uiKitFiles.size >= 25) {
      const used = [...this.uiKitImports].filter((n) => this.uiKitFiles.has(n)).length;
      if (used / this.uiKitFiles.size < 0.4) {
        agg({
          id: 'polish-uikit-sink',
          title: `${this.uiKitFiles.size} UI-kit components installed, ${used} used`,
          severity: 'low',
          category: 'polish',
          vibeWeight: 0.8,
          explanation:
            'The full shadcn/ui component set is scaffolded but mostly ' +
            'unused — the signature of an AI builder that installs everything ' +
            'up front. It bloats the repo and slows every tooling pass.',
          recommendation:
            'Delete the components you do not import (each lives in its own ' +
            'file under components/ui/). You can always re-add one later.',
        });
      }
    }

    if (this.megaPageFile) {
      agg(
        {
          id: 'polish-mega-page',
          title: `One ${this.megaPageFile.lines}-line page file holds the whole site`,
          severity: 'medium',
          category: 'polish',
          vibeWeight: 0.6,
          explanation:
            `This file contains the entire page — ${this.megaPageFile.arrays} hardcoded ` +
            'data arrays and every section inline. That is the shape of a ' +
            'single long AI generation, and it makes every future edit ' +
            'riskier: one file, no boundaries, nothing reusable.',
          recommendation:
            'Split each section into its own component and move the data ' +
            'arrays next to them. Smaller files also mean better results the ' +
            'next time you point an AI tool at the code.',
        },
        this.megaPageFile.relPath,
      );
    }

    if (this.bestLanding && this.bestLanding.score >= 3 && !this.ogMetaSeen) {
      agg({
        id: 'polish-no-og',
        title: 'No social-share preview configured',
        severity: 'low',
        category: 'polish',
        vibeWeight: 0.2,
        explanation:
          'The site has a marketing page but no Open Graph or Twitter card ' +
          'metadata, so sharing the link anywhere shows a bare URL instead of ' +
          'a preview — exactly when first impressions matter most.',
        recommendation:
          'Add an openGraph block (title, description, image) to your root ' +
          'metadata and one 1200×630 preview image.',
      });
    }

    if (this.readmeAiStyled && !this.readmeTemplate) {
      agg({
        id: 'polish-readme-ai',
        title: 'README written in AI house style',
        severity: 'low',
        category: 'polish',
        vibeWeight: 0.6,
        explanation:
          'Emoji section headers (## 🚀 Features, ## 🛠️ Tech Stack) and ' +
          '"Made with ❤️" are the model’s README template. Anyone doing ' +
          'diligence on the repo reads it as "generated, unreviewed".',
        recommendation:
          'Rewrite it in your own voice: what it does, how to run it, current ' +
          'status. Three honest paragraphs, no emoji headers.',
      });
    }

    if (this.consoleLogCount >= 8) {
      agg({
        id: 'polish-console-debris',
        title: `${this.consoleLogCount} console.log calls left in the code`,
        severity: 'low',
        category: 'polish',
        vibeWeight: 0.4,
        explanation:
          'Heavy console.log debris means anyone who opens DevTools watches ' +
          'your internal state scroll by — occasionally including things that ' +
          'should not be public. It is the digital equivalent of shipping ' +
          'with the scaffolding still up.',
        recommendation:
          'Delete the logs (your editor can find every console.log in one ' +
          'search). Keep intentional logging behind a debug flag.',
      });
    }

    if (this.todoCount >= 5) {
      agg({
        id: 'polish-todo-debris',
        title: `${this.todoCount} TODO/FIXME markers in the code`,
        severity: 'low',
        category: 'polish',
        vibeWeight: 0.3,
        explanation:
          'A scattering of TODOs is normal; dozens of them — especially ' +
          'AI-generated "TODO: implement" stubs — map exactly to features ' +
          'that look finished on screen but are not.',
        recommendation:
          'Triage them: do it, ticket it, or delete it. Anything user-facing ' +
          '("TODO: actually validate this") goes first.',
      });
    }
  }
}
