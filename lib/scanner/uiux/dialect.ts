// The two dialects (SECUREVIBE-GRADING.md section 4).
//
// There is not one AI look but two, and users assume switching between
// them will fix their score. Dialect membership is REPORTED, never
// deducted: a legitimately cream or dark brand loses nothing for its
// palette. The one exception is the shipped-with-the-model hexes, which
// cost 3 points only when at least two structural signals co-occur.

import { findAll, findEl, isHeading, textOf, walkEls } from './model';
import type { PageAnalysis, SourceFile } from './page';

export type Dialect = 'A' | 'B';

export interface DialectRead {
  dialect: Dialect | null;
  /** The markers that voted, for the report's evidence line. */
  markers: string[];
  /** True when one of the model-default hexes is present. */
  modelHex: string | null;
  hexFile: string | null;
}

/** The hexes two unrelated generated sites shipped identically. */
const MODEL_HEXES = /#(?:f4f0e7|faf9f7|18181b)\b/i;

export function readDialect(
  page: PageAnalysis,
  uiFiles: SourceFile[],
  cssFiles: SourceFile[],
): DialectRead {
  let aVotes = 0;
  let bVotes = 0;
  const markers: string[] = [];
  const voteA = (marker: string) => {
    aVotes++;
    markers.push(marker);
  };
  const voteB = (marker: string) => {
    bVotes++;
    markers.push(marker);
  };

  const classes = new Set<string>();
  for (const el of walkEls([page.root])) for (const c of el.classes) classes.add(c);
  const classList = [...classes];

  // ── Dialect A markers: the SaaS default ──
  if (classList.some((c) => /^bg-gradient-to-/.test(c)) && classList.some((c) => /^from-/.test(c))) {
    voteA('gradient primary buttons');
  }
  if (classList.filter((c) => c === 'rounded-2xl' || c === 'rounded-3xl').length > 0) {
    const count = findAll([page.root], (e) => e.classes.some((c) => /^rounded-[23]xl$/.test(c))).length;
    if (count >= 6) voteA('rounded-2xl on everything');
  }
  if (classList.some((c) => /^backdrop-blur/.test(c))) voteA('backdrop blur panels');
  if (/most popular/i.test(textOf(page.root))) voteA('a "Most Popular" pricing badge');

  // ── Dialect B markers: the editorial look ──
  const hero = page.hero;
  if (hero) {
    const serifItalic = findEl(
      [hero.el],
      (e) => e.classes.some((c) => /serif/.test(c)) && e.classes.includes('italic'),
    );
    if (serifItalic) voteB('an italic serif word in the hero');
  }
  const monoLabels = findAll(
    [page.root],
    (e) => e.classes.some((c) => /^font-mono$/.test(c)) && e.classes.includes('uppercase'),
  );
  if (monoLabels.length >= 3) voteB('monospace uppercase labels');
  const numbered = findAll([page.root], (e) => /^0[1-9]$/.test(textOf(e)) && textOf(e).length === 2);
  if (numbered.length >= 2) voteB('everything numbered 01 02 03');
  for (const file of cssFiles) {
    if (/#(?:f4f0e7|faf9f7|f5f0e8|fdf6ec|f7f3ea)\b/i.test(file.content)) {
      voteB('a cream page background');
      break;
    }
  }

  // Serif display + h1 without gradient reads editorial even without cream.
  if (hero && !markers.includes('an italic serif word in the hero')) {
    const serifH1 = findEl([hero.el], (e) => isHeading(e, 1) && e.classes.some((c) => /serif/.test(c)));
    if (serifH1 && bVotes > 0) voteB('a serif display headline');
  }

  // ── the model-default hexes (deducted only with structure, in score.ts) ──
  let modelHex: string | null = null;
  let hexFile: string | null = null;
  for (const file of [...cssFiles, ...uiFiles]) {
    const m = MODEL_HEXES.exec(file.content);
    if (m) {
      modelHex = m[0].toLowerCase();
      hexFile = file.relPath;
      break;
    }
  }

  let dialect: Dialect | null = null;
  if (aVotes >= 2 && aVotes > bVotes) dialect = 'A';
  else if (bVotes >= 2 && bVotes > aVotes) dialect = 'B';

  return { dialect, markers, modelHex, hexFile };
}

/** The user-facing line the spec mandates for dialect membership. */
export function dialectNote(dialect: Dialect | null): string | null {
  if (!dialect) return null;
  const label = dialect === 'A' ? 'Dialect A, the SaaS default' : 'Dialect B, the editorial look';
  return (
    `This repo is in ${label}. Rebuilding it in the other dialect will change ` +
    'the paint and leave the skeleton. Your score will move by fewer than 5 points.'
  );
}
