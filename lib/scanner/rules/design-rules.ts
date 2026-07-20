// Rules for Check 5: the design audit ("does this look vibe coded?").
//
// Two kinds of rules live here:
//   - line rules: a regex tested against each line of UI/CSS files
//   - file rules: a regex run across a whole file (for tags that span lines)
// Aggregate checks that need to see the WHOLE project (font count, color
// count, the template landing-page shape) live in checks/design.ts.
//
// Every rule cites where the standard comes from, because "an algorithm
// disliked your site" convinces nobody — "WCAG 1.4.4 requires this" does.

import type { Severity } from '../types';

/** The graded areas of the design audit. Weights must sum to 100. */
export const DESIGN_CATEGORIES = [
  { id: 'originality', label: 'Originality', weight: 18 },
  { id: 'accessibility', label: 'Accessibility', weight: 16 },
  { id: 'content', label: 'Content integrity', weight: 14 },
  { id: 'typography', label: 'Typography', weight: 12 },
  { id: 'color', label: 'Color discipline', weight: 10 },
  { id: 'layout', label: 'Layout & responsiveness', weight: 10 },
  { id: 'consistency', label: 'Consistency', weight: 10 },
  { id: 'polish', label: 'Finish & polish', weight: 10 },
] as const;

export type DesignCategoryId = (typeof DESIGN_CATEGORIES)[number]['id'];

export interface DesignRule {
  id: string;
  title: string;
  severity: Severity;
  category: DesignCategoryId;
  /** 'line': regex tested per line. 'file': regex run over the whole file. */
  scope: 'line' | 'file';
  regex: RegExp;
  /** A line/file matching this is NOT flagged even if `regex` matches. */
  unless?: RegExp;
  /** File extensions this rule applies to (with the dot). */
  extensions: Set<string>;
  /** Line rules normally skip comment lines; set true to scan them too. */
  includeComments?: boolean;
  /** How many individual findings to file before folding the rest into a note. */
  maxFindings: number;
  /**
   * 0–1: how strongly a hit says "unedited AI output". 0 for rules that are
   * just bad craft (a human can ship bad contrast too).
   */
  vibeWeight: number;
  explanation: string;
  recommendation: string;
}

/** Files that carry markup the user actually sees. */
export const UI = new Set(['.jsx', '.tsx', '.html', '.vue', '.svelte', '.astro']);
/** Stylesheets. */
export const CSS = new Set(['.css', '.scss', '.sass', '.less']);
const UI_AND_CSS = new Set([...UI, ...CSS]);
const UI_AND_JS = new Set([...UI, '.js', '.ts', '.mjs']);

export const DESIGN_RULES: DesignRule[] = [
  // ───────────────────────── originality: the dead giveaways ─────────────────────────
  {
    id: 'vibe-gradient-cliche',
    title: 'The purple-gradient cliché',
    severity: 'high',
    category: 'originality',
    scope: 'line',
    regex:
      /\bbg-gradient-to-[trbl]{1,2}\b(?=.*\bfrom-(?:purple|indigo|violet|fuchsia|pink|blue|cyan)-\d{2,3}\b)/,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.9,
    explanation:
      'A purple/indigo/pink gradient is the single most recognizable signature ' +
      'of AI-generated design — every default v0, Lovable, and Bolt site ships ' +
      'one. Visitors who have seen ten of these this week will assume yours is ' +
      'template output too, and judge the product accordingly.',
    recommendation:
      'Pick one real brand color and use it flat. Look at Stripe, Linear, or ' +
      'Vercel: restrained, mostly-neutral palettes with a single accent read ' +
      'as far more expensive than any gradient.',
  },
  {
    id: 'vibe-gradient-text',
    title: 'Gradient text on a heading',
    severity: 'medium',
    category: 'originality',
    scope: 'line',
    regex: /(?=.*\bbg-clip-text\b)(?=.*\btext-transparent\b)/,
    extensions: UI,
    maxFindings: 2,
    vibeWeight: 0.85,
    explanation:
      'Gradient-filled headline text (bg-clip-text + text-transparent) is a ' +
      'default flourish of AI site builders. It is rarely seen on professional ' +
      'products, so it instantly marks a page as generated.',
    recommendation:
      'Set the headline in a single strong color — near-black on light ' +
      'backgrounds, near-white on dark. Let the words carry the drama.',
  },
  {
    id: 'vibe-neon-glow',
    title: 'Neon glow / blur-orb decoration',
    severity: 'medium',
    category: 'originality',
    scope: 'line',
    regex:
      /(?=.*\bblur-[23]xl\b)(?=.*\b(?:bg|from)-(?:purple|indigo|violet|fuchsia|pink|cyan|blue|emerald)-\d{2,3})|\bshadow-\[0_0_\d+px[^\]]*\]/,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.8,
    explanation:
      'Blurred neon orbs floating behind the hero (blur-3xl on a colored div) ' +
      'and glow shadows are stock AI-template decoration. Like the gradient, ' +
      'they signal "nobody designed this" to anyone who has seen the pattern.',
    recommendation:
      'Delete the glow divs. Whitespace, a good typeface, and one accent color ' +
      'do the work these effects are trying to fake.',
  },
  {
    id: 'vibe-emoji-ui',
    title: 'Emoji used as interface graphics',
    severity: 'high',
    category: 'originality',
    scope: 'line',
    // Excludes ©®™, arrows, and check marks — legitimate typography, not emoji.
    regex: /(?![©®™←-⇿✓✔✖✗])\p{Extended_Pictographic}/u,
    extensions: UI,
    maxFindings: 4,
    vibeWeight: 0.85,
    explanation:
      'Emoji standing in for icons (🚀 on the feature cards, ✨ in the hero) ' +
      'are a hallmark of AI-generated pages — models reach for them because ' +
      'they cost nothing. They render differently on every OS, clash with any ' +
      'real brand, and make a product look like a group chat.',
    recommendation:
      'Replace each emoji with a real icon from one consistent set (Lucide ' +
      'and Heroicons are free) — or with nothing. Text alone is cleaner than ' +
      'text plus 🎯.',
  },
  {
    id: 'vibe-user-count',
    title: 'Unverifiable user-count claim',
    severity: 'high',
    category: 'content',
    scope: 'line',
    regex:
      /(?:trusted by|join(?:ed)?(?: by)?|loved by|used by)\s*(?:over\s*)?[\d,.]+k?\+?\s*(?:users|developers|devs|teams|customers|companies|founders|creators|builders)|[\d,]{4,}\+\s*(?:happy\s+)?(?:users|developers|customers|downloads|teams)/i,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.9,
    explanation:
      '"Trusted by 10,000+ developers" on a product that launched last week is ' +
      'the most common fake claim in AI-generated landing pages — the model ' +
      'invents a number because real landing pages have one. Anyone who checks ' +
      '(and competitors will) can call it a lie, which poisons trust in ' +
      'everything else on the page.',
    recommendation:
      'Delete the number or make it true. Early products earn more trust from ' +
      'honesty: "in early access", "built in the open", or a real testimonial ' +
      'from a real person with their permission.',
  },
  {
    id: 'vibe-hardcoded-testimonials',
    title: 'Hardcoded testimonial data',
    severity: 'medium',
    category: 'content',
    scope: 'line',
    regex: /(?:const|let|var)\s+(?:testimonials|reviews|customerQuotes)\s*(?::[^=]+)?=\s*\[/i,
    extensions: UI_AND_JS,
    maxFindings: 2,
    vibeWeight: 0.6,
    explanation:
      'A testimonials array hardcoded in the page source usually means the ' +
      'quotes were invented by the model ("Sarah K., Product Manager"). ' +
      'Fabricated endorsements are the fastest way to lose a visitor who ' +
      'senses it — and in many jurisdictions they are illegal advertising.',
    recommendation:
      'If the quotes are real, keep them (hardcoding real quotes is fine). If ' +
      'they were generated, remove the section entirely until you have real ' +
      'ones — an honest page without testimonials outperforms a fake one.',
  },
  {
    id: 'vibe-default-meta',
    title: 'Scaffold title/description still shipping',
    severity: 'high',
    category: 'polish',
    scope: 'line',
    // Anchored to title/meta context so prose that merely mentions the
    // scaffold strings doesn't trip it.
    regex:
      /title\s*[:=]\s*["'{]*\s*(?:Create Next App|Vite \+ React|React App)|<title>\s*(?:Create Next App|Vite \+ React(?: \+ TS)?|React App)|Generated by create next app|Web site created using create-react-app/,
    extensions: new Set([...UI, '.js', '.ts']),
    maxFindings: 2,
    vibeWeight: 0.95,
    explanation:
      'The browser tab still says "Create Next App" (or the meta description ' +
      'is the scaffold default). It is the first text search engines and users ' +
      'see, and it announces that nobody looked at the details.',
    recommendation:
      'Set a real title and description in your root layout metadata: the ' +
      'product name plus one specific sentence about what it does.',
  },
  {
    id: 'vibe-ai-comment',
    title: 'AI placeholder comment left in code',
    severity: 'medium',
    category: 'polish',
    scope: 'line',
    includeComments: true,
    regex:
      /(?:\/\/|\/\*|\{\s*\/\*|#)\s*(?:In a real (?:app|application|production)|For demo purposes|This is a placeholder|You would typically|Replace (?:this|these|with) (?:your|actual|real)|Add your own|In production,? you(?:'d| would)|\.\.\. rest of (?:the )?code|Simulat(?:e|ing) (?:an? )?(?:API|network|delay|response)|TODO:?\s*(?:Add (?:error handling|validation|authentication)|Replace with (?:real|actual|your)|Implement (?:this|actual|real)|Connect to (?:backend|API|database)))/i,
    extensions: UI_AND_JS,
    maxFindings: 3,
    vibeWeight: 0.7,
    explanation:
      'Comments like "In a real app, you would..." are the assistant talking ' +
      'to the person who prompted it. Left in the repo, they document that ' +
      'this part was never actually finished — a reviewer or customer reading ' +
      'the source sees an IOU, not a product.',
    recommendation:
      'Treat each of these comments as a task: either do the real thing it ' +
      'describes, or delete the feature it excuses. Then delete the comment.',
  },

  {
    id: 'vibe-builder-fingerprint',
    title: 'AI builder fingerprints left in the code',
    severity: 'high',
    category: 'originality',
    scope: 'line',
    includeComments: true,
    regex:
      /lovable-tagger|cdn\.gpteng\.co|data-lov-id|Welcome to your Lovable project|content=["']v0\.dev["']|generator:\s*["']v0\.dev|Made with Bolt|href=["']https:\/\/bolt\.new/i,
    extensions: new Set([...UI, '.js', '.ts', '.json', '.md']),
    maxFindings: 2,
    vibeWeight: 0.95,
    explanation:
      'The code carries a literal machine-readable signature of the tool that ' +
      'generated it (Lovable’s tagger script, v0’s generator meta, Bolt’s ' +
      'badge). Anyone — including browser extensions built for exactly this — ' +
      'can read it and label the site "AI-generated" in one click.',
    recommendation:
      'Remove the tagger scripts, generator meta tags, and badges from the ' +
      'build. They serve the platform’s marketing, not yours.',
  },
  {
    id: 'vibe-fake-async',
    title: 'Fake loading state (setTimeout pretending to be a backend)',
    severity: 'high',
    category: 'content',
    scope: 'line',
    regex:
      /await\s+new\s+Promise\(\s*\(?(\w+)\)?\s*=>\s*setTimeout\(\s*\1\s*,\s*\d{3,5}\s*\)\s*\)|setTimeout\(\s*\(\)\s*=>\s*\{?\s*set(?:Loading|IsLoading|Submitting|Success|Sent|Subscribed|Complete)\w*\(\s*false\s*\)/,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.85,
    explanation:
      'A spinner driven by setTimeout with no real request behind it means ' +
      'this feature performs work it is not doing — the form "submits", the ' +
      'toast says success, and nothing was saved. Users find out the hard ' +
      'way, usually after trusting you with their data.',
    recommendation:
      'Wire the handler to a real endpoint (or a service like Formspree for ' +
      'simple forms). If the feature has no backend yet, remove the UI for it ' +
      '— a smaller honest product beats a demo pretending to be one.',
  },
  {
    id: 'vibe-coming-soon-alert',
    title: '"Coming soon" alert wired to a real-looking button',
    severity: 'medium',
    category: 'content',
    scope: 'line',
    regex:
      /(?:alert|toast)\(\s*["'`][^"'`]*(?:coming soon|not (?:yet )?(?:implemented|available)|under construction)/i,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.8,
    explanation:
      'Buttons that pop "Coming soon!" are dead ends dressed as features — ' +
      'the AI’s polite way of not finishing. Every click on one erodes the ' +
      'visitor’s belief that anything else on the page works.',
    recommendation:
      'Hide unfinished features instead of stubbing them. Ship the three ' +
      'buttons that work, not ten that apologize.',
  },
  {
    id: 'vibe-social-stub',
    title: 'Social icon linking to a platform homepage',
    severity: 'medium',
    category: 'content',
    scope: 'line',
    regex:
      /href\s*=\s*["']https?:\/\/(?:www\.)?(?:twitter|x|github|linkedin|facebook|instagram|discord|youtube)\.(?:com|gg)\/?["']/,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.7,
    explanation:
      'A footer Twitter/GitHub icon that links to twitter.com itself — no ' +
      'account, no path — is a template stub shipped as-is. It tells visitors ' +
      'the social presence is fictional.',
    recommendation:
      'Link each icon to your actual profile, or remove icons for networks ' +
      'you are not on.',
  },
  {
    id: 'vibe-fake-stats',
    title: 'Stock credibility statistics',
    severity: 'medium',
    category: 'content',
    scope: 'line',
    regex: /\b99\.9%(?:\s*uptime)?|\b24\/7\s+(?:support|customer|human)|\b4\.[89]\s*\/\s*5\b/i,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.6,
    explanation:
      '"99.9% uptime", "24/7 support", "4.9/5 rating" — the same three ' +
      'numbers appear on thousands of AI-generated pages because the model ' +
      'learned that credible sites have metrics. If you cannot back the claim ' +
      '(an SLA, a support rota, a ratings page), it is fiction a customer can ' +
      'quote back at you.',
    recommendation:
      'Replace invented metrics with something true and specific: your actual ' +
      'response time, a real capability, or nothing.',
  },
  {
    id: 'vibe-hype-copy',
    title: 'AI marketing-voice copy',
    severity: 'low',
    category: 'content',
    scope: 'line',
    regex:
      /\b(?:supercharge[sd]?|revolutioniz\w+|game-?chang\w+|blazing[- ]fast|lightning[- ]fast|in seconds,? not (?:hours|days|weeks))\b|(?:It'?s|This is) not just (?:a|an)\s/i,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.5,
    explanation:
      '"Supercharge your workflow" and "It’s not just X, it’s Y" are the ' +
      'model’s house style — readers have now seen this register on so many ' +
      'generated pages that it actively signals "no human wrote this".',
    recommendation:
      'Write the way you would explain the product to a friend: what it does, ' +
      'for whom, and one concrete detail only you can say.',
  },
  {
    id: 'vibe-ready-to-cta',
    title: 'The "Ready to…?" closing pitch',
    severity: 'low',
    category: 'originality',
    scope: 'line',
    regex:
      /Ready to (?:get started|transform|supercharge|level up|take (?:your|control)|streamline|revolutionize|elevate|ship|join|build)/i,
    extensions: UI,
    maxFindings: 2,
    vibeWeight: 0.7,
    explanation:
      'The rhetorical "Ready to transform your workflow?" band before the ' +
      'footer is verbatim template — the same sentence closes thousands of ' +
      'generated landing pages.',
    recommendation:
      'Close with something specific: what happens in the first five minutes ' +
      'after signing up, or simply the product name and the one action.',
  },
  {
    id: 'vibe-glassmorphism',
    title: 'Default glassmorphism cards',
    severity: 'low',
    category: 'originality',
    scope: 'line',
    regex: /(?=.*\bbg-(?:white|black)\/(?:5|10|20)\b)(?=.*backdrop-blur)/,
    extensions: UI,
    maxFindings: 2,
    vibeWeight: 0.5,
    explanation:
      'Semi-transparent white-on-dark cards with backdrop-blur are the AI’s ' +
      'one move for "premium" dark UIs — recognizable at a glance as ' +
      'generated styling.',
    recommendation:
      'Solid surfaces with a clear border read as more confident. If you keep ' +
      'blur, use it once (a nav bar), not on every card.',
  },
  {
    id: 'vibe-section-comments',
    title: 'Section-narration comments in the JSX',
    severity: 'low',
    category: 'polish',
    scope: 'line',
    includeComments: true,
    regex:
      /\{\/\*\s*(?:Hero|Features?|Testimonials?|Pricing|FAQ|CTA|Footer|Navbar|Header|Stats|How It Works)(?:\s+Section)?\s*\*\/\}/i,
    extensions: UI,
    maxFindings: 2,
    vibeWeight: 0.6,
    explanation:
      '{/* Hero Section */} … {/* CTA Section */} is the model keeping its ' +
      'place while generating. A full set of these markers documents that the ' +
      'page came out in one long generation and was never revisited.',
    recommendation:
      'Extract the sections into named components (Hero.tsx, Faq.tsx) — the ' +
      'names then do the narrating, and the file stops reading like a prompt ' +
      'transcript.',
  },

  // ───────────────────────── typography ─────────────────────────
  {
    id: 'type-illegible-size',
    title: 'Text below the legibility floor',
    severity: 'medium',
    category: 'typography',
    scope: 'line',
    regex: /\btext-\[(?:[0-9]|1[01])px\]|font-size:\s*(?:[0-9]|1[01])px\b/,
    extensions: UI_AND_CSS,
    maxFindings: 3,
    vibeWeight: 0,
    explanation:
      'Text under 12px is illegible for a large share of users. Apple’s ' +
      'Human Interface Guidelines set 11pt as the absolute floor on mobile; ' +
      'professional products keep body copy at 14–16px.',
    recommendation:
      'Raise it to at least 12px (text-xs), and reserve even that for labels ' +
      'and captions — body copy belongs at text-sm/text-base or larger.',
  },
  {
    id: 'type-offscale-size',
    title: 'Off-scale one-off font size',
    severity: 'low',
    category: 'typography',
    scope: 'line',
    regex: /\btext-\[\d+(?:px|rem)\]/,
    // On-scale sizes are fine; below-12px sizes belong to the legibility rule.
    unless: /\btext-\[(?:[0-9]|1[01]|12|14|16|18|20|24|30|36|48|60|72|96|128)px\]/,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.2,
    explanation:
      'Arbitrary sizes like text-[13px] or text-[17px] mean the type is being ' +
      'eyeballed per element instead of coming from a scale. Professional ' +
      'products (and Tailwind itself) use a small fixed set of sizes — that ' +
      'consistency is a big part of why they look coherent.',
    recommendation:
      'Snap each one-off to the nearest built-in step (text-sm, text-base, ' +
      'text-lg…). If you genuinely need a custom size, define it once in your ' +
      'theme instead of inline.',
  },

  // ───────────────────────── color ─────────────────────────
  {
    id: 'color-low-contrast-pair',
    title: 'Low-contrast text on a light background',
    severity: 'medium',
    category: 'color',
    scope: 'line',
    regex:
      /(?=.*\btext-(?:gray|slate|zinc|neutral|stone)-(?:200|300)\b)(?=.*\b(?:bg-white|bg-(?:gray|slate|zinc|neutral|stone)-(?:50|100))\b)|(?=.*\btext-white\b)(?=.*\bbg-(?:yellow|lime|amber|cyan)-(?:200|300|400)\b)/,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0,
    explanation:
      'This element pairs very light text with a light background. WCAG 1.4.3 ' +
      'requires a 4.5:1 contrast ratio for normal text; pairs like ' +
      'text-gray-300 on white sit far below it, making the text unreadable in ' +
      'sunlight and for low-vision users.',
    recommendation:
      'Darken the text a few steps (gray-600 or darker on white). Check pairs ' +
      'at webaim.org/resources/contrastchecker — 4.5:1 for body text, 3:1 for ' +
      'large headlines.',
  },

  // ───────────────────────── layout ─────────────────────────
  {
    id: 'layout-zoom-disabled',
    title: 'Pinch-zoom disabled',
    severity: 'high',
    category: 'layout',
    scope: 'line',
    // Anchored to the meta content attribute / Next viewport export so a
    // sentence about the setting doesn't trip it.
    regex:
      /content\s*=\s*["'][^"']*(?:user-scalable\s*=\s*(?:no|0)|maximum-scale\s*=\s*1(?:\.0)?\b)|userScalable\s*:\s*(?:false|0)|maximumScale\s*:\s*1\b/,
    extensions: new Set([...UI, '.js', '.ts']),
    maxFindings: 1,
    vibeWeight: 0,
    explanation:
      'The viewport meta blocks zooming. WCAG 1.4.4 requires text to be ' +
      'resizable to 200% — people with low vision literally cannot read a ' +
      'page that traps them at 1x. Apple ignores this setting for exactly ' +
      'that reason.',
    recommendation:
      'Remove user-scalable=no and maximum-scale=1 from the viewport tag (or ' +
      'the Next.js viewport export). The default behavior is correct.',
  },
  {
    id: 'layout-fixed-width',
    title: 'Fixed pixel width wider than a phone',
    severity: 'medium',
    category: 'layout',
    scope: 'line',
    regex:
      /(?<!max-)(?<!min-)\bw-\[(?:4\d\d|[5-9]\d\d|\d{4,})px\]|(?<![-\w])width:\s*(?:4\d\d|[5-9]\d\d|\d{4,})px/,
    unless: /\bmax-w-full\b|\bmd:|\blg:|@media/,
    extensions: UI_AND_CSS,
    maxFindings: 3,
    vibeWeight: 0,
    explanation:
      'A hard width of 400px+ with no responsive override forces horizontal ' +
      'scrolling on phones — WCAG 1.4.10 (Reflow) calls this out, and over ' +
      'half of web traffic is mobile.',
    recommendation:
      'Use max-width with a fluid fallback: "w-full max-w-[480px]" instead of ' +
      '"w-[480px]", so the element shrinks with the screen.',
  },

  // ───────────────────────── accessibility ─────────────────────────
  {
    id: 'a11y-img-no-alt',
    title: 'Image without alt text',
    severity: 'medium',
    category: 'accessibility',
    scope: 'file',
    regex: /<(?:img|Image)\b(?![^>]*\balt\s*=)[^>]*>/g,
    extensions: UI,
    maxFindings: 4,
    vibeWeight: 0,
    explanation:
      'An image with no alt attribute is invisible to screen readers and to ' +
      'search engines. WCAG 1.1.1 (level A — the legal baseline in many ' +
      'countries) requires a text alternative for every informative image.',
    recommendation:
      'Describe what the image shows: alt="Dashboard showing weekly revenue". ' +
      'For purely decorative images, use alt="" so screen readers skip them.',
  },
  {
    id: 'a11y-junk-alt',
    title: 'Meaningless alt text',
    severity: 'low',
    category: 'accessibility',
    scope: 'line',
    regex: /\balt\s*=\s*["'](?:image|photo|picture|img|icon|logo)["']/i,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.3,
    explanation:
      'alt="image" tells a screen-reader user "there is an image here" — ' +
      'which they already know. Junk alt text is worse than none because it ' +
      'wastes the listener’s time while passing automated checks.',
    recommendation:
      'Say what the image communicates ("Acme logo", "Graph of response ' +
      'times dropping"), or alt="" if it is decoration.',
  },
  {
    id: 'a11y-div-onclick',
    title: 'Click handler on a non-interactive element',
    severity: 'medium',
    category: 'accessibility',
    scope: 'file',
    regex: /<(?:div|span|li|p)\b(?![^>]*\brole\s*=)[^>]*\bonClick\s*=/g,
    extensions: UI,
    maxFindings: 4,
    vibeWeight: 0,
    explanation:
      'A clickable div works for a mouse and for nobody else: keyboard users ' +
      'cannot reach it, screen readers do not announce it as pressable. WCAG ' +
      '2.1.1 (Keyboard) is a level-A requirement.',
    recommendation:
      'Make it a real <button> (styled however you like) or an <a> if it ' +
      'navigates. You get keyboard focus, Enter/Space handling, and correct ' +
      'semantics for free.',
  },
  {
    id: 'a11y-positive-tabindex',
    title: 'Positive tabindex hijacks focus order',
    severity: 'low',
    category: 'accessibility',
    scope: 'line',
    regex: /\btab[iI]ndex\s*=\s*[{"']?\s*[1-9]\d*/,
    extensions: UI,
    maxFindings: 2,
    vibeWeight: 0,
    explanation:
      'tabindex="1" (or any positive value) yanks keyboard focus out of ' +
      'reading order, making navigation unpredictable — WCAG 2.4.3.',
    recommendation:
      'Use tabindex="0" to make something focusable in natural order, or ' +
      'restructure the markup so the order is right by default.',
  },
  {
    id: 'a11y-outline-suppressed',
    title: 'Focus outline removed without a replacement',
    severity: 'medium',
    category: 'accessibility',
    scope: 'line',
    regex: /\b(?:focus:)?outline-none\b|outline:\s*(?:none|0)\b/,
    unless: /focus:ring|focus-visible:|focus:border|focus:outline-|focus:shadow|focus-within:/,
    extensions: UI_AND_CSS,
    maxFindings: 3,
    vibeWeight: 0,
    explanation:
      'outline-none with no visible replacement means keyboard users cannot see ' +
      'where they are on the page. WCAG 2.4.7 (Focus Visible) requires a ' +
      'visible indicator on every interactive element.',
    recommendation:
      'Pair every outline-none with a visible alternative on the same ' +
      'element, e.g. "focus-visible:ring-2 focus-visible:ring-offset-2".',
  },

  // ───────────────────────── content ─────────────────────────
  {
    id: 'content-lorem',
    title: 'Lorem ipsum shipped to production',
    severity: 'high',
    category: 'content',
    scope: 'line',
    regex: /lorem ipsum|dolor sit amet/i,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.75,
    explanation:
      'Placeholder latin in user-visible text is the universal sign of an ' +
      'unfinished page — it tells every visitor the site shipped without ' +
      'anyone reading it.',
    recommendation:
      'Write the real sentence. If a section has nothing real to say yet, ' +
      'remove the section — a shorter honest page beats a padded fake one.',
  },
  {
    id: 'content-placeholder-image',
    title: 'Placeholder image service in production',
    severity: 'medium',
    category: 'content',
    scope: 'line',
    regex:
      /via\.placeholder\.com|placehold\.co|placekitten\.com|dummyimage\.com|picsum\.photos|i\.pravatar\.cc|randomuser\.me|ui-avatars\.com|api\.dicebear\.com/i,
    extensions: UI_AND_JS,
    maxFindings: 3,
    vibeWeight: 0.5,
    explanation:
      'Images loaded from placeholder services are grey boxes standing where ' +
      'a screenshot or product photo should be — unfinished by definition, ' +
      'and they break if the service is down.',
    recommendation:
      'Replace each with a real asset: an actual product screenshot beats any ' +
      'stock art. If nothing real exists yet, cut the image.',
  },
  {
    id: 'content-dead-link',
    title: 'Link that goes nowhere (href="#")',
    severity: 'medium',
    category: 'content',
    scope: 'line',
    regex: /href\s*=\s*["']#?["']/,
    unless: /onClick|role\s*=\s*["']button/,
    extensions: UI,
    maxFindings: 4,
    vibeWeight: 0.45,
    explanation:
      'href="#" is a link wearing a costume: clicking it scrolls to the top ' +
      'and does nothing. AI generators emit them for every nav item and ' +
      'social icon they cannot resolve. Each one a visitor clicks teaches ' +
      'them the site is a facade.',
    recommendation:
      'Point every link at a real destination, or delete it. An honest ' +
      'three-link footer beats ten decorative dead ends.',
  },
  {
    id: 'content-generic-cta',
    title: 'Generic button label',
    severity: 'low',
    category: 'content',
    scope: 'line',
    regex: />\s*(?:Submit|Click here|Go|OK)\s*<\/(?:button|a)>/i,
    extensions: UI,
    maxFindings: 3,
    vibeWeight: 0.2,
    explanation:
      '"Submit" describes the mechanism, not the outcome. Buttons convert ' +
      'better and read as more professional when they say what happens next.',
    recommendation:
      'Label the action with its result: "Create account", "Send message", ' +
      '"Start the scan".',
  },
];
