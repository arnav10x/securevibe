// The language filter from SECUREVIBE.md 5.4, implemented as code with a
// deterministic term list — never as a model check, since a model asked to
// check its own output for these terms passes text that contains them.
//
// Every user-facing string the scanner ships (rule titles, explanations,
// recommendations, verdicts) must pass this filter. It is enforced in CI by
// tests/scanner/voice.test.ts, so a rule that breaks the voice rules breaks
// the build. The tool cannot flag a word it uses itself.

/** The F2 superlative list. The tool flags these, so it must never use them. */
const BANNED_TERMS = [
  'seamless',
  'robust',
  'revolutionary',
  'cutting-edge',
  'effortless',
  'supercharge',
  'next-generation',
  'game-changing',
  'best-in-class',
  'elevate your',
  'unlock the',
  'transform your',
  'delve',
  'leverage',
  'game-changer',
];

/** Fix language must not condescend. */
const CONDESCENSION = [/\bsimply\b/i, /\bobviously\b/i, /\bjust add\b/i, /\bjust use\b/i];

/**
 * Named companies whose products must never be a comparison target.
 * Scoring against a reference product is preference dressed as expertise:
 * their choices are tuned to their audience and support economics, not yours.
 */
const COMPANY_NAMES = [
  'stripe', 'linear', 'apple', 'vercel', 'airbnb', 'notion', 'figma',
  'twitch', 'spotify', 'netflix', 'google', 'microsoft', 'amazon',
];

/**
 * Returns every voice violation in a string, empty when it passes.
 * Rules from 5.4: no F2 terms, no em-dashes, no semicolons in prose, no
 * company comparisons, no condescension, sentences at 30 words or fewer.
 */
export function voiceViolations(text: string): string[] {
  const violations: string[] = [];
  const lowered = text.toLowerCase();

  if (text.includes('—')) violations.push('contains an em-dash');
  if (/;/.test(text)) violations.push('contains a semicolon');

  for (const term of BANNED_TERMS) {
    if (lowered.includes(term)) violations.push(`uses the banned term "${term}"`);
  }
  for (const re of CONDESCENSION) {
    if (re.test(text)) violations.push(`condescending fix language (${re.source})`);
  }
  for (const name of COMPANY_NAMES) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(text)) {
      violations.push(`names a company product ("${name}") as a reference`);
    }
  }

  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const words = sentence.trim().split(/\s+/).filter(Boolean);
    if (words.length > 30) {
      violations.push(`sentence over 30 words: "${sentence.slice(0, 60)}…"`);
    }
  }

  return violations;
}
