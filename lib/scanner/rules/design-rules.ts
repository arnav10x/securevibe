// Rules for the craft audit: does this repository show human judgment
// applied after generation?
//
// The detection model comes from SECUREVIBE.md (the master reference).
// Signals live in seven layers, weighted strongest first:
//
//   A. Design token system   — does a design system exist at all?
//   B. State coverage        — empty, loading, error, partial states
//   C. Typography system     — scale, hierarchy discipline
//   D. Interaction & motion  — feedback, purposeful animation
//   E. Structural layout     — grid discipline, content-model thinking
//   F. Copy and content      — voice, specificity, honesty
//   G. Accessibility floor   — below the floor, the craft score is capped
//
// Two kinds of rules live here:
//   - line rules: a regex tested against each line of UI/CSS files
//   - file rules: a regex run across a whole file (for tags spanning lines)
// Aggregate checks that need the WHOLE project (token ratios, state
// coverage, the template page sequence) live in checks/design.ts.
//
// HARD RULES this file must obey (the anti-heuristic list):
//   - Never flag a hue. Flag structure, never chroma.
//   - Never flag a typeface, framework, or library by name.
//   - Never compare the repo to a named company's product.
//   - Provenance markers (CLAUDE.md, .cursorrules) are context, not penalty.
//   - Never flag a named style (dark mode, glassmorphism, brutalism).
// The voice rules are enforced by tests/scanner/voice.test.ts, which runs
// every string in this file through the language filter in ../voice.ts.

import type { Severity } from '../types';

/**
 * The seven craft layers and their share of the craft score.
 * Weights must sum to 100. Order matters: strongest evidence first.
 */
export const CRAFT_LAYERS = [
  { id: 'tokens', label: 'Design tokens', weight: 22 },
  { id: 'states', label: 'State coverage', weight: 20 },
  { id: 'typography', label: 'Typography', weight: 15 },
  { id: 'motion', label: 'Interaction & motion', weight: 13 },
  { id: 'layout', label: 'Structural layout', weight: 12 },
  { id: 'copy', label: 'Copy & content', weight: 10 },
  { id: 'accessibility', label: 'Accessibility floor', weight: 8 },
] as const;

export type CraftLayerId = (typeof CRAFT_LAYERS)[number]['id'];

export interface DesignRule {
  id: string;
  title: string;
  severity: Severity;
  layer: CraftLayerId;
  /** 'line': regex tested per line. 'file': regex run over the whole file. */
  scope: 'line' | 'file';
  regex: RegExp;
  /** A line/file matching this is NOT flagged even if `regex` matches. */
  unless?: RegExp;
  /** Extra structural check on the matched line, for logic a regex cannot say. */
  test?: (line: string) => boolean;
  /** File extensions this rule applies to (with the dot). */
  extensions: Set<string>;
  /** Line rules normally skip comment lines; set true to scan them too. */
  includeComments?: boolean;
  /** How many individual findings to file before folding the rest into a note. */
  maxFindings: number;
  /**
   * 0–1: how strongly a hit says "unreviewed model output". 0 for rules that
   * are plain craft gaps (a person can ship bad contrast too).
   */
  vibeWeight: number;
  /**
   * Marks a Layer G rule as load-bearing: when one fires, the craft score is
   * capped at 60 no matter what else the report says. An interface keyboard
   * users cannot operate is not well designed, whatever it looks like.
   */
  loadBearing?: boolean;
  explanation: string;
  recommendation: string;
  /** The check a coding agent runs to confirm the fix landed. */
  verify?: string;
}

/** Files that carry markup the user actually sees. */
export const UI = new Set(['.jsx', '.tsx', '.html', '.vue', '.svelte', '.astro']);
/** Stylesheets. */
export const CSS = new Set(['.css', '.scss', '.sass', '.less']);
const UI_AND_CSS = new Set([...UI, ...CSS]);
const UI_AND_JS = new Set([...UI, '.js', '.ts', '.mjs']);

/** The default framework hue families, for structural (never chromatic) checks. */
const HUE_FAMILY =
  /\b(?:from|via|to)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;

export const DESIGN_RULES: DesignRule[] = [
  // ─────────────── Layer A: design token system ───────────────
  {
    id: 'tokens-multi-hue-gradient',
    title: 'Multi-hue gradient as a surface treatment',
    severity: 'high',
    layer: 'tokens',
    scope: 'line',
    regex: /\bbg-gradient-to-[trbl]{1,2}\b/,
    test: (line) => {
      const families = new Set<string>();
      for (const m of line.matchAll(new RegExp(HUE_FAMILY.source, 'g'))) {
        families.add(m[1]);
      }
      return families.size >= 2;
    },
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.9,
    explanation:
      'This gradient crosses more than one hue family. The multi-hue sweep is ' +
      'the highest-frequency default in generated output and it carries no ' +
      'information about this product. The issue is structure, not the colors ' +
      'themselves. A single-hue gradient in a tight value range is a real ' +
      'craft choice and is not flagged.',
    recommendation:
      'Decide what this surface should say, then say it with one hue. Either ' +
      'flatten to your brand color or tighten the gradient to two close ' +
      'values of a single family.',
    verify:
      'Search UI files for bg-gradient utilities whose from/via/to stops span ' +
      'more than one color family. None should remain on large surfaces.',
  },
  {
    id: 'tokens-gradient-text',
    title: 'Gradient fill on heading text',
    severity: 'medium',
    layer: 'tokens',
    scope: 'line',
    regex: /(?=.*\bbg-clip-text\b)(?=.*\btext-transparent\b)/,
    extensions: UI,
    maxFindings: 2,
    vibeWeight: 0.85,
    explanation:
      'Gradient-filled headline text is a stock generative flourish. It adds ' +
      'a second visual treatment to the one element that should already win ' +
      'attention on its own, so it weakens hierarchy instead of building it.',
    recommendation:
      'Set the headline in one strong color with high contrast against its ' +
      'background. Let size, weight, and surrounding space do the work.',
    verify: 'Search for bg-clip-text paired with text-transparent. Headings should not match.',
  },
  {
    id: 'tokens-glow-orbs',
    title: 'Decorative blur orbs behind content',
    severity: 'medium',
    layer: 'tokens',
    scope: 'line',
    regex:
      /(?=.*\bblur-[23]xl\b)(?=.*\b(?:bg|from)-[a-z]+-\d{2,3})|\bshadow-\[0_0_\d+px[^\]]*\]/,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.8,
    explanation:
      'Blurred glow shapes floating behind the hero are stock template ' +
      'decoration. They add luminance noise around the exact area where one ' +
      'element should hold attention, and they answer no question a visitor ' +
      'has.',
    recommendation:
      'Delete the glow divs. Whitespace and one clear focal element do the ' +
      'work this decoration is imitating.',
    verify: 'Search for blur-2xl and blur-3xl on positioned decorative divs. None should remain.',
  },

  // ─────────────── Layer B: state coverage ───────────────
  {
    id: 'states-simulated-backend',
    title: 'Loading state driven by a timer, not a request',
    severity: 'high',
    layer: 'states',
    scope: 'line',
    regex:
      /await\s+new\s+Promise\(\s*\(?(\w+)\)?\s*=>\s*setTimeout\(\s*\1\s*,\s*\d{3,5}\s*\)\s*\)|setTimeout\(\s*\(\)\s*=>\s*\{?\s*set(?:Loading|IsLoading|Submitting|Success|Sent|Subscribed|Complete)\w*\(\s*false\s*\)/,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.85,
    explanation:
      'A spinner driven by setTimeout with no request behind it performs work ' +
      'the code is not doing. The form appears to submit, the toast reports ' +
      'success, and nothing was saved. People find out after trusting the ' +
      'product with their data.',
    recommendation:
      'Wire the handler to a real endpoint. If the feature has no backend ' +
      'yet, remove its UI. A smaller honest product beats a demo posing as ' +
      'one.',
    verify:
      'Search for setTimeout calls that flip loading or success state. Every ' +
      'pending state should be driven by an actual awaited request.',
  },
  {
    id: 'states-dead-end-button',
    title: 'Button that answers with a "coming soon" message',
    severity: 'medium',
    layer: 'states',
    scope: 'line',
    regex:
      /(?:alert|toast)\(\s*["'`][^"'`]*(?:coming soon|not (?:yet )?(?:implemented|available)|under construction)/i,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.8,
    explanation:
      'A control that pops "coming soon" is a dead end dressed as a feature. ' +
      'Each click on one teaches the visitor that other controls may also be ' +
      'hollow.',
    recommendation:
      'Hide unfinished features instead of stubbing them. Ship the three ' +
      'controls that work, not ten that apologize.',
    verify: 'Search for alert and toast calls containing "coming soon". None should remain.',
  },
  {
    id: 'states-swallowed-error',
    title: 'Error caught and discarded',
    severity: 'medium',
    layer: 'states',
    scope: 'file',
    regex: /catch\s*(?:\([^)]*\))?\s*\{\s*\}/g,
    extensions: UI_AND_JS,
    maxFindings: 3,
    vibeWeight: 0.4,
    explanation:
      'An empty catch block swallows the failure. The user sees nothing, the ' +
      'developer sees nothing, and the interface silently stops matching ' +
      'reality. This is the most common state-coverage gap in unreviewed ' +
      'output.',
    recommendation:
      'Handle the failure where it happens: show an error state that names ' +
      'what failed and offers a retry, and report the exception somewhere a ' +
      'developer will see it.',
    verify: 'Search for empty catch blocks. Each should render or report the error.',
  },

  // ─────────────── Layer C: typography ───────────────
  {
    id: 'type-below-floor',
    title: 'Text below the legibility floor',
    severity: 'medium',
    layer: 'typography',
    scope: 'line',
    regex: /\btext-\[(?:[0-9]|1[01])px\]|font-size:\s*(?:[0-9]|1[01])px\b/,
    // An uppercase micro-label with wide tracking reads larger than its
    // nominal size: capitals have no descenders, cap height stands in for
    // x-height, and the letter-spacing separates the forms. Ten pixels of
    // tracked capitals is a deliberate label style, not unreadable body text.
    // Only 10px and 11px earn this exemption, and only with both signals
    // present. Nine pixels and below still fires, tracked or not.
    test: (line) => {
      const tracked = /\buppercase\b/.test(line) && /\btracking-/.test(line);
      const labelSize = /\btext-\[1[01]px\]|font-size:\s*1[01]px\b/.test(line);
      return !(tracked && labelSize);
    },
    extensions: UI_AND_CSS,
    maxFindings: 3,
    vibeWeight: 0,
    explanation:
      'Text under 12px is unreadable for a large share of users, and it ' +
      'fails at small sizes long before it fails a checker. Body copy reads ' +
      'comfortably at 14px to 16px.',
    recommendation:
      'Raise it to at least 12px, and reserve even that for labels and ' +
      'captions. Body copy belongs at 14px or larger.',
    verify: 'Search for font sizes below 12px. None should remain in user-facing text.',
  },
  {
    id: 'type-offscale-size',
    title: 'One-off font size outside the scale',
    severity: 'low',
    layer: 'typography',
    scope: 'line',
    regex: /\btext-\[\d+(?:px|rem)\]/,
    // On-scale sizes are fine; below-12px sizes belong to the legibility rule.
    unless: /\btext-\[(?:[0-9]|1[01]|12|14|16|18|20|24|30|36|48|60|72|96|128)px\]/,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.2,
    explanation:
      'Arbitrary sizes like 13px or 17px mean each piece of type was ' +
      'negotiated per element instead of coming from a scale. A type scale is ' +
      'a set of decided steps, and scattered one-off values are the mark that ' +
      'no decision was made.',
    recommendation:
      'Snap each one-off value to the nearest step of your scale. If you need ' +
      'a custom size, define it once in the theme instead of inline.',
    verify: 'Search for bracketed one-off text sizes. Each should map to a scale step.',
  },

  // ─────────────── Layer D: interaction and motion ───────────────
  {
    id: 'motion-transition-all',
    title: 'transition-all animating every property',
    severity: 'low',
    layer: 'motion',
    scope: 'line',
    regex: /\btransition-all\b/,
    extensions: UI,
    maxFindings: 2,
    vibeWeight: 0.3,
    explanation:
      'transition-all animates properties that should never animate, ' +
      'including layout-affecting ones the browser cannot composite. The ' +
      'result is a laggy feel on interactions that should be instant.',
    recommendation:
      'Name the properties you mean: transition-colors for color changes, ' +
      'transition-transform for movement. Animate only transform and opacity ' +
      'where you can.',
    verify: 'Search for transition-all. Each use should name specific properties instead.',
  },
  {
    id: 'motion-glacial-duration',
    title: 'Transition slower than the usable band',
    severity: 'low',
    layer: 'motion',
    scope: 'line',
    regex: /\bduration-(?:700|1000)\b/,
    unless: /animate-|@keyframes/,
    extensions: UI,
    maxFindings: 2,
    vibeWeight: 0.2,
    explanation:
      'Transitions above roughly 400ms on frequent interactions make the ' +
      'interface feel like it is waiting for itself. Small elements moving ' +
      'short distances read best between 100ms and 300ms.',
    recommendation:
      'Drop interactive transitions to 150ms to 300ms. Reserve longer ' +
      'durations for large surfaces that cross the screen.',
    verify: 'Search for duration-700 and duration-1000 on hover and press interactions.',
  },

  // ─────────────── Layer E: structural layout ───────────────
  {
    id: 'layout-fixed-width',
    title: 'Fixed pixel width wider than a phone',
    severity: 'medium',
    layer: 'layout',
    scope: 'line',
    regex:
      /(?<!max-)(?<!min-)\bw-\[(?:4\d\d|[5-9]\d\d|\d{4,})px\]|(?<![-\w])width:\s*(?:4\d\d|[5-9]\d\d|\d{4,})px/,
    // Decoration is exempt. An aria-hidden, non-interactive background shape
    // holds no content, cannot overflow the reading column, and is sized on
    // purpose. The rule is about content containers.
    unless: /\bmax-w-full\b|\bmd:|\blg:|@media|aria-hidden|pointer-events-none/,
    extensions: UI_AND_CSS,
    maxFindings: 3,
    vibeWeight: 0,
    explanation:
      'A hard width of 400px or more with no responsive override forces ' +
      'horizontal scrolling on phones, where more than half of first visits ' +
      'happen. Content must reflow to 320px without sideways scrolling.',
    recommendation:
      'Use a fluid width with a ceiling: w-full plus max-w-[480px] instead of ' +
      'w-[480px], so the element shrinks with the screen.',
    verify: 'Load the page at 320px wide. Nothing should scroll horizontally.',
  },
  {
    id: 'layout-fixed-height',
    title: 'Fixed height on a container holding variable content',
    severity: 'low',
    layer: 'layout',
    scope: 'line',
    regex: /\bh-\[(?:[3-9]\d\d|\d{4,})px\]/,
    // Same exemption as the width rule: a decorative shape is not a content
    // container, so a fixed height on it clips nothing.
    unless: /overflow-(?:auto|y-auto|scroll)|\bmin-h-|aria-hidden|pointer-events-none/,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.3,
    explanation:
      'A hardcoded height on a content container means the layout was ' +
      'designed against one example, not against a content model. Longer ' +
      'text clips, shorter text floats in dead space.',
    recommendation:
      'Let the container size itself from its content, or set min-h with ' +
      'overflow handling when a ceiling is genuinely needed.',
    verify: 'Fill the container with twice the current content. Nothing should clip.',
  },

  // ─────────────── Layer F: copy and content ───────────────
  {
    id: 'copy-lorem',
    title: 'Placeholder latin shipped in user-facing text',
    severity: 'high',
    layer: 'copy',
    scope: 'line',
    regex: /lorem ipsum|dolor sit amet/i,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.75,
    explanation:
      'Placeholder latin in visible text is the universal mark of an ' +
      'unfinished page. It tells every visitor the site shipped without ' +
      'anyone reading it.',
    recommendation:
      'Write the real sentence. If a section has nothing real to say yet, ' +
      'remove the section. A shorter honest page beats a padded one.',
    verify: 'Search the project for "lorem ipsum". No user-facing file should match.',
  },
  {
    id: 'copy-fabricated-user-count',
    title: 'User-count claim with nothing behind it',
    severity: 'high',
    layer: 'copy',
    scope: 'line',
    regex:
      /(?:trusted by|join(?:ed)?(?: by)?|loved by|used by)\s*(?:over\s*)?[\d,.]+k?\+?\s*(?:users|developers|devs|teams|customers|companies|founders|creators|builders)|[\d,]{4,}\+\s*(?:happy\s+)?(?:users|developers|customers|downloads|teams)/i,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.9,
    explanation:
      'A "trusted by 10,000 developers" line on a product that launched last ' +
      'week is a claim anyone can check and no one can verify. Fabricated ' +
      'social proof is the fastest credibility destroyer a page can carry, ' +
      'and it creates real legal exposure in advertising law.',
    recommendation:
      'Delete the number or make it true. Specific honest claims read as ' +
      'true: "in early access" or a real quote from a real person with their ' +
      'permission.',
    verify: 'Search for user-count phrases. Every remaining claim should be verifiable.',
  },
  {
    id: 'copy-fabricated-testimonials',
    title: 'Testimonial data hardcoded in the page source',
    severity: 'medium',
    layer: 'copy',
    scope: 'line',
    regex: /(?:const|let|var)\s+(?:testimonials|reviews|customerQuotes)\s*(?::[^=]+)?=\s*\[/i,
    extensions: UI_AND_JS,
    maxFindings: 2,
    vibeWeight: 0.6,
    explanation:
      'A testimonials array in the source usually means the quotes were ' +
      'invented during generation. Fabricated endorsements poison trust on ' +
      'discovery and are illegal advertising in many jurisdictions.',
    recommendation:
      'If the quotes are real, keep them. If they were generated, remove the ' +
      'section until real ones exist. An honest page without testimonials ' +
      'outperforms a fake one.',
    verify: 'Confirm every quoted person exists and approved their quote.',
  },
  {
    id: 'copy-fabricated-stats',
    title: 'Stock credibility statistics',
    severity: 'medium',
    layer: 'copy',
    scope: 'line',
    regex: /\b99\.9%(?:\s*uptime)?|\b24\/7\s+(?:support|customer|human)|\b4\.[89]\s*\/\s*5\b/i,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.6,
    explanation:
      'The same three numbers appear on thousands of generated pages: 99.9% ' +
      'uptime, 24/7 support, a 4.9 rating. If no SLA, support rota, or ' +
      'ratings page backs the claim, it is fiction a customer can quote back ' +
      'at you.',
    recommendation:
      'Replace invented metrics with something true and specific: your actual ' +
      'response time, a real capability, or nothing.',
    verify: 'Each remaining statistic should have a source you could show a customer.',
  },
  {
    id: 'copy-superlative-voice',
    title: 'Superlative-dense marketing voice',
    severity: 'low',
    layer: 'copy',
    scope: 'line',
    regex:
      /\b(?:supercharge[sd]?|revolutioniz\w+|game-?chang\w+|blazing[- ]fast|lightning[- ]fast|next-generation|best-in-class|cutting-edge|in seconds,? not (?:hours|days|weeks))\b|(?:It'?s|This is) not just (?:a|an)\s/i,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.5,
    explanation:
      'Superlatives are the statistical average of all marketing copy, which ' +
      'is why generated pages are dense with them. Readers now parse this ' +
      'register as machine-written and discount every claim near it. ' +
      'Specific claims with numbers and named constraints read as true.',
    recommendation:
      'Write the way you would explain the product to a friend: what it ' +
      'does, for whom, and one concrete detail only you can say.',
    verify: 'Read the page copy aloud. Every sentence should survive being questioned.',
  },
  {
    id: 'copy-template-closer',
    title: 'The "Ready to…?" closing pitch',
    severity: 'low',
    layer: 'copy',
    scope: 'line',
    regex:
      /Ready to (?:get started|level up|take (?:your|control)|streamline|ship|join|build|grow|scale)/i,
    extensions: UI,
    maxFindings: 2,
    vibeWeight: 0.7,
    explanation:
      'The rhetorical "Ready to…?" band before the footer closes thousands ' +
      'of generated pages verbatim. It carries no information a visitor ' +
      'could not predict.',
    recommendation:
      'Close with something specific: what happens in the first five minutes ' +
      'after signing up, or the product name and the one action.',
    verify: 'The final call to action should name a concrete outcome.',
  },
  {
    id: 'copy-emoji-ui',
    title: 'Emoji standing in for interface icons',
    severity: 'high',
    layer: 'copy',
    scope: 'line',
    // Excludes ©®™, arrows, and check marks — legitimate typography, not emoji.
    regex: /(?![©®™←-⇿✓✔✖✗])\p{Extended_Pictographic}/u,
    extensions: UI,
    maxFindings: 4,
    vibeWeight: 0.85,
    explanation:
      'Emoji used as feature icons render differently on every operating ' +
      'system, carry no brand identity, and repeat the adjacent word without ' +
      'adding information. They are frequent in unreviewed output because ' +
      'they cost the model nothing.',
    recommendation:
      'Replace each emoji with an icon from one consistent set, or with ' +
      'nothing. Text alone is cleaner than text plus a pictograph.',
    verify: 'Search UI files for emoji characters. Headings and buttons should not match.',
  },
  {
    id: 'copy-scaffold-meta',
    title: 'Scaffold title still shipping',
    severity: 'high',
    layer: 'copy',
    scope: 'line',
    // Anchored to title/meta context so prose that merely mentions the
    // scaffold strings doesn't trip it.
    regex:
      /title\s*[:=]\s*["'{]*\s*(?:Create Next App|Vite \+ React|React App)|<title>\s*(?:Create Next App|Vite \+ React(?: \+ TS)?|React App)|Generated by create next app|Web site created using create-react-app/,
    extensions: new Set([...UI, '.js', '.ts']),
    maxFindings: 2,
    vibeWeight: 0.95,
    explanation:
      'The browser tab still shows the scaffold default title. It is the ' +
      'first text search engines and visitors see, and it announces that ' +
      'nobody looked at the details.',
    recommendation:
      'Set a real title and description in the root metadata: the product ' +
      'name plus one specific sentence about what it does.',
    verify: 'Load the site and read the browser tab. It should name the product.',
  },
  {
    id: 'copy-placeholder-comment',
    title: 'Placeholder comment documenting unfinished work',
    severity: 'medium',
    layer: 'copy',
    scope: 'line',
    includeComments: true,
    regex:
      /(?:\/\/|\/\*|\{\s*\/\*|#)\s*(?:In a real (?:app|application|production)|For demo purposes|This is a placeholder|You would typically|Replace (?:this|these|with) (?:your|actual|real)|Add your own|In production,? you(?:'d| would)|\.\.\. rest of (?:the )?code|Simulat(?:e|ing) (?:an? )?(?:API|network|delay|response)|TODO:?\s*(?:Add (?:error handling|validation|authentication)|Replace with (?:real|actual|your)|Implement (?:this|actual|real)|Connect to (?:backend|API|database)))/i,
    extensions: UI_AND_JS,
    maxFindings: 3,
    vibeWeight: 0.7,
    explanation:
      'Comments like "in a real app, you would…" are the assistant talking ' +
      'to the person who prompted it. Left in the repo, each one documents a ' +
      'part that was never finished.',
    recommendation:
      'Treat each of these comments as a task: do the real thing it ' +
      'describes, or delete the feature it excuses. Then delete the comment.',
    verify: 'Search for placeholder comments. Each should be resolved, not reworded.',
  },
  {
    id: 'copy-generation-narration',
    title: 'Section-narration comments in the markup',
    severity: 'low',
    layer: 'copy',
    scope: 'line',
    includeComments: true,
    regex:
      /\{\/\*\s*(?:Hero|Features?|Testimonials?|Pricing|FAQ|CTA|Footer|Navbar|Header|Stats|How It Works)(?:\s+Section)?\s*\*\/\}/i,
    extensions: UI,
    maxFindings: 2,
    vibeWeight: 0.6,
    explanation:
      'A full set of section markers in one file is the model keeping its ' +
      'place during a single long generation. It records that the page came ' +
      'out in one pass and was never revisited.',
    recommendation:
      'Extract the sections into named components. The file names then do ' +
      'the narrating, and each piece becomes safe to edit alone.',
    verify: 'The page file should compose named section components, not inline blocks.',
  },
  {
    id: 'copy-social-stub',
    title: 'Social icon linking to a platform homepage',
    severity: 'medium',
    layer: 'copy',
    scope: 'line',
    regex:
      /href\s*=\s*["']https?:\/\/(?:www\.)?(?:twitter|x|github|linkedin|facebook|instagram|discord|youtube)\.(?:com|gg)\/?["']/,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.7,
    explanation:
      'A footer social icon that links to the platform itself, with no ' +
      'account path, is a template stub shipped as-is. It tells visitors the ' +
      'social presence is fictional.',
    recommendation:
      'Link each icon to your actual profile, or remove icons for networks ' +
      'you are not on.',
    verify: 'Click every social link on the deployed site. Each should reach a real profile.',
  },
  {
    id: 'copy-dead-link',
    title: 'Link that goes nowhere',
    severity: 'medium',
    layer: 'copy',
    scope: 'line',
    regex: /href\s*=\s*["']#?["']/,
    unless: /onClick|role\s*=\s*["']button/,
    extensions: UI,
    maxFindings: 4,
    vibeWeight: 0.45,
    explanation:
      'An href="#" link scrolls to the top and does nothing. Each one a ' +
      'visitor clicks teaches them the site is a facade, and it teaches the ' +
      'lesson on the exact element that invited the click.',
    recommendation:
      'Point every link at a real destination, or delete it. An honest ' +
      'three-link footer beats ten decorative dead ends.',
    verify: 'Search for href="#". None should remain.',
  },
  {
    id: 'copy-placeholder-image',
    title: 'Placeholder image service in production',
    severity: 'medium',
    layer: 'copy',
    scope: 'line',
    regex:
      /via\.placeholder\.com|placehold\.co|placekitten\.com|dummyimage\.com|picsum\.photos|i\.pravatar\.cc|randomuser\.me|ui-avatars\.com|api\.dicebear\.com/i,
    extensions: UI_AND_JS,
    maxFindings: 3,
    vibeWeight: 0.5,
    explanation:
      'Images loaded from placeholder services stand where a screenshot or ' +
      'product photo should be. They are unfinished by definition, and they ' +
      'break when the service is down.',
    recommendation:
      'Replace each with a real asset. An actual product screenshot beats ' +
      'any stock art. If nothing real exists yet, cut the image.',
    verify: 'Search for placeholder image domains. None should remain.',
  },
  {
    id: 'copy-mechanism-label',
    title: 'Button named after the mechanism, not the outcome',
    severity: 'low',
    layer: 'copy',
    scope: 'line',
    regex: />\s*(?:Submit|Click here|Go|OK)\s*<\/(?:button|a)>/i,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.2,
    explanation:
      '"Submit" describes the implementation. Good interface copy names ' +
      'what the person controls: the label is the entire information scent ' +
      'the control gives off.',
    recommendation:
      'Label the action with its result: "Create account", "Send message", ' +
      '"Start the scan".',
    verify: 'Every button label should answer "what happens when I press this?".',
  },

  // ─────────────── Layer G: accessibility floor ───────────────
  {
    id: 'a11y-outline-suppressed',
    title: 'Focus outline removed without a replacement',
    severity: 'medium',
    layer: 'accessibility',
    scope: 'line',
    regex: /\b(?:focus:)?outline-none\b|outline:\s*(?:none|0)\b/,
    unless: /focus:ring|focus-visible:|focus:border|focus:outline-|focus:shadow|focus-within:/,
    extensions: UI_AND_CSS,
    maxFindings: 3,
    vibeWeight: 0,
    loadBearing: true,
    explanation:
      'outline-none with no visible replacement means keyboard users cannot ' +
      'see where they are on the page. WCAG 2.4.7 requires a visible focus ' +
      'indicator on every interactive element. This is common, severe, and ' +
      'quick to fix.',
    recommendation:
      'Pair every outline-none with a visible alternative on the same ' +
      'element, for example focus-visible:ring-2 with a ring offset.',
    verify: 'Tab through the page. Focus should be visible on every stop.',
  },
  {
    id: 'a11y-div-onclick',
    title: 'Click handler on a non-interactive element',
    severity: 'medium',
    layer: 'accessibility',
    scope: 'file',
    regex: /<(?:div|span|li|p)\b(?![^>]*\brole\s*=)[^>]*\bonClick\s*=/g,
    extensions: UI,
    maxFindings: 4,
    vibeWeight: 0,
    loadBearing: true,
    explanation:
      'A clickable div works for a mouse and for nobody else. Keyboard users ' +
      'cannot reach it and screen readers do not announce it as pressable. ' +
      'WCAG 2.1.1 makes keyboard operability a level-A requirement.',
    recommendation:
      'Make it a real button element, styled however you like, or a link if ' +
      'it navigates. Focus, key handling, and semantics then come free.',
    verify: 'Tab to the element and press Enter. The action should fire.',
  },
  {
    id: 'a11y-img-no-alt',
    title: 'Image without alt text',
    severity: 'medium',
    layer: 'accessibility',
    scope: 'file',
    regex: /<(?:img|Image)\b(?![^>]*\balt\s*=)[^>]*>/g,
    extensions: UI,
    maxFindings: 4,
    vibeWeight: 0,
    explanation:
      'An image with no alt attribute is invisible to screen readers and to ' +
      'search engines. WCAG 1.1.1 requires a text alternative for every ' +
      'informative image, at level A.',
    recommendation:
      'Describe what the image shows. For purely decorative images, use an ' +
      'empty alt so screen readers skip them.',
    verify: 'Search for img and Image tags without alt. None should remain.',
  },
  {
    id: 'a11y-junk-alt',
    title: 'Alt text that says nothing',
    severity: 'low',
    layer: 'accessibility',
    scope: 'line',
    regex: /\balt\s*=\s*["'](?:image|photo|picture|img|icon|logo)["']/i,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.3,
    explanation:
      'alt="image" tells a screen-reader user there is an image here, which ' +
      'they already know. It wastes the listener’s time while passing ' +
      'automated checks.',
    recommendation:
      'Say what the image communicates, or use an empty alt if it is ' +
      'decoration.',
    verify: 'Read each alt text aloud without the image. It should carry the meaning.',
  },
  {
    id: 'a11y-unlabeled-input',
    title: 'Input with a placeholder as its only label',
    severity: 'medium',
    layer: 'accessibility',
    scope: 'file',
    regex:
      /<input\b(?![^>]*(?:aria-label|aria-labelledby|id\s*=|type\s*=\s*["'](?:hidden|submit|checkbox|radio)))[^>]*\bplaceholder\s*=[^>]*>/g,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0,
    explanation:
      'Placeholder text disappears the moment typing starts, so the field ' +
      'loses its name exactly when the person needs it. Screen readers may ' +
      'never announce it at all. WCAG 3.3.2 requires a persistent label.',
    recommendation:
      'Give the input a real label element tied to its id, or an aria-label ' +
      'when a visible label truly cannot fit.',
    verify: 'Every input should keep a visible or announced name while filled in.',
  },
  {
    id: 'a11y-positive-tabindex',
    title: 'Positive tabindex hijacking focus order',
    severity: 'low',
    layer: 'accessibility',
    scope: 'line',
    regex: /\btab[iI]ndex\s*=\s*[{"']?\s*[1-9]\d*/,
    extensions: UI,
    maxFindings: 2,
    vibeWeight: 0,
    explanation:
      'A positive tabindex pulls keyboard focus out of reading order, making ' +
      'navigation unpredictable. WCAG 2.4.3 requires a focus order that ' +
      'preserves meaning.',
    recommendation:
      'Use tabindex="0" to make something focusable in natural order, or ' +
      'restructure the markup so the order is right by default.',
    verify: 'Tab through the page. Focus should move in reading order.',
  },
  {
    id: 'a11y-zoom-disabled',
    title: 'Pinch-zoom disabled',
    severity: 'high',
    layer: 'accessibility',
    scope: 'line',
    // Anchored to the meta content attribute / Next viewport export so a
    // sentence about the setting doesn't trip it.
    regex:
      /content\s*=\s*["'][^"']*(?:user-scalable\s*=\s*(?:no|0)|maximum-scale\s*=\s*1(?:\.0)?\b)|userScalable\s*:\s*(?:false|0)|maximumScale\s*:\s*1\b/,
    extensions: new Set([...UI, '.js', '.ts']),
    maxFindings: 1,
    vibeWeight: 0,
    loadBearing: true,
    explanation:
      'The viewport meta blocks zooming. WCAG 1.4.4 requires text to resize ' +
      'to 200%, and people with low vision cannot read a page that traps ' +
      'them at 1x.',
    recommendation:
      'Remove user-scalable=no and maximum-scale=1 from the viewport ' +
      'configuration. The default behavior is correct.',
    verify: 'Pinch-zoom the deployed page on a phone. It should zoom.',
  },
  {
    id: 'a11y-contrast-default-pair',
    title: 'Text and background too close in luminance',
    severity: 'medium',
    layer: 'accessibility',
    scope: 'line',
    regex:
      /(?=.*\btext-(?:gray|slate|zinc|neutral|stone)-(?:200|300)\b)(?=.*\b(?:bg-white|bg-(?:gray|slate|zinc|neutral|stone)-(?:50|100))\b)|(?=.*\btext-white\b)(?=.*\bbg-(?:yellow|lime|amber|cyan)-(?:200|300|400)\b)/,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0,
    explanation:
      'This element pairs very light text with a light background. WCAG ' +
      '1.4.3 requires a 4.5:1 contrast ratio for body text, and this pair ' +
      'sits far below it. The text disappears in sunlight and for low-vision ' +
      'readers.',
    recommendation:
      'Darken the text several steps. Check the exact pair with a contrast ' +
      'checker: 4.5:1 for body text, 3:1 for large headlines.',
    verify: 'Run the flagged pair through a contrast checker. It should reach 4.5:1.',
  },
];
