// The UI/UX structural grader (SECUREVIBE-GRADING.md), assembled.
//
//   const report = analyzeStructure(files, allPaths);
//
// Score the skeleton, not the paint: find the marketing page, run the
// signal catalog against its structure, classify the dialect, measure the
// template-script match, and produce a deduction-ordered report where
// every finding carries a paste-ready fix prompt.
//
// When the repo has no marketing page (a pure app, a docs site, an API),
// the grader declines to grade instead of guessing — the section 8 guard.

import type { El } from './model';
import { findAll } from './model';
import {
  analyzePage,
  Repo,
  SCRIPT_STEPS,
  STEP_LABEL,
  type PageAnalysis,
  type SourceFile,
} from './page';
import {
  cssLabelClasses,
  detectContentAsData,
  detectCopyFingerprints,
  detectCtaRepetition,
  detectDeadLinks,
  detectDivScreenshots,
  detectEmojiIcons,
  detectEyebrows,
  detectFeatureGrids,
  detectLeakedPlaceholders,
  detectNumberedDecor,
  detectPhantomRoutes,
  detectRestatement,
  detectRouteDepth,
  detectSocialProof,
  detectStaleCopyright,
  detectStatStrip,
  detectTemplateScript,
  type RouteInventory,
  type SignalContext,
  type StructuralFinding,
} from './signals';
import { dialectNote, readDialect, type Dialect } from './dialect';
import {
  computeScore,
  percentileFor,
  percentileLine,
  scoreBand,
  type PercentileRead,
} from './score';

export interface StructureReport {
  /** False when no marketing page was found; nothing is scored then. */
  applicable: boolean;
  /** Why the grader declined, when it did. */
  notApplicableReason: string | null;
  score: number;
  band: string;
  findings: StructuralFinding[];
  dialect: Dialect | null;
  dialectNote: string | null;
  /** The classified section sequence and its match against the script. */
  scriptMatch: {
    matched: number;
    total: number;
    sequence: string[];
  };
  pageFile: string | null;
  percentile: PercentileRead;
  percentileLine: string;
}

const UI_EXT = /\.(?:tsx|jsx|html|astro|vue|svelte)$/;
const CSS_EXT = /\.(?:css|scss|sass|less)$/;

/** Files that are test scaffolding, never shipped UI. */
const TEST_PATH =
  /(?:^|\/)(?:tests?|__tests__|__mocks__|fixtures?|e2e|cypress|playwright|stories|\.storybook)\//i;

function buildRouteInventory(allPaths: string[], files: SourceFile[]): RouteInventory {
  const routes = new Set<string>();
  const wildcardPrefixes: string[] = [];
  for (const relPath of allPaths) {
    let m = relPath.match(/^(?:src\/)?app\/(.*?)(?:page|route)\.(?:tsx|jsx|js|mdx)$/);
    if (m) {
      const segments = m[1].split('/').filter((s) => s && !s.startsWith('(') && !s.startsWith('@'));
      const url = '/' + segments.join('/');
      if (segments.some((s) => s.startsWith('['))) {
        wildcardPrefixes.push(url.slice(0, url.indexOf('[')));
      } else {
        routes.add(url.replace(/\/$/, '') || '/');
      }
      continue;
    }
    m = relPath.match(/^(?:src\/)?pages\/(.*)\.(?:tsx|jsx|js|mdx|astro|html)$/);
    if (m && !m[1].startsWith('_') && !m[1].startsWith('api/')) {
      const url = '/' + m[1].replace(/(?:^|\/)index$/, '');
      if (url.includes('[')) wildcardPrefixes.push(url.slice(0, url.indexOf('[')));
      else routes.add(url.replace(/\/$/, '') || '/');
    }
  }
  const clientRouter = files.some((file) =>
    /from\s+['"]react-router|<Route\b|createBrowserRouter|createHashRouter/.test(file.content),
  );
  return { routes, wildcardPrefixes, clientRouter, known: routes.size > 0 };
}

const EMPTY_PERCENTILE: PercentileRead = percentileFor(0);

function notApplicable(reason: string): StructureReport {
  return {
    applicable: false,
    notApplicableReason: reason,
    score: 0,
    band: '',
    findings: [],
    dialect: null,
    dialectNote: null,
    scriptMatch: { matched: 0, total: SCRIPT_STEPS.length, sequence: [] },
    pageFile: null,
    percentile: EMPTY_PERCENTILE,
    percentileLine: '',
  };
}

export function analyzeStructure(
  sources: SourceFile[],
  allPaths: string[],
  opts: { nowYear?: number; percentileSample?: number[] } = {},
): StructureReport {
  const nowYear = opts.nowYear ?? new Date().getFullYear();
  const shipped = sources.filter((s) => !TEST_PATH.test(s.relPath));
  const repo = new Repo(shipped);

  const page = analyzePage(repo);
  if (!page) {
    return notApplicable(
      'No marketing page found: this grader reads landing pages, and the repo has none it can locate.',
    );
  }

  const uiFiles = shipped.filter(
    (s) => UI_EXT.test(s.relPath) || page.files.includes(s.relPath),
  );
  const cssFiles = shipped.filter((s) => CSS_EXT.test(s.relPath));
  const routes = buildRouteInventory(allPaths, shipped);

  const ctx: SignalContext = { repo, page, allPaths, uiFiles, routes, nowYear };
  const labelClasses = cssLabelClasses(cssFiles);

  const findings: StructuralFinding[] = [
    ...detectContentAsData(ctx),
    ...detectEyebrows(ctx, labelClasses),
    ...detectNumberedDecor(ctx),
    ...detectCopyFingerprints(ctx),
    ...detectRestatement(ctx),
    ...detectSocialProof(ctx),
    ...detectDeadLinks(ctx),
    ...detectLeakedPlaceholders(ctx),
    ...detectStaleCopyright(ctx),
    ...detectPhantomRoutes(ctx),
    ...detectStatStrip(ctx),
    ...detectDivScreenshots(ctx),
    ...detectCtaRepetition(ctx),
    ...detectRouteDepth(ctx),
    ...detectEmojiIcons(ctx),
    ...detectFeatureGrids(ctx),
    ...detectTemplateScript(ctx),
  ];

  // The dialect is reported, not deducted — except the model-default hexes,
  // which cost 3 only when at least two structural signals co-occur.
  const dialect = readDialect(page, uiFiles, cssFiles);
  if (dialect.modelHex && findings.length >= 2) {
    findings.push({
      signal: 'dialect-hex',
      name: 'The model-default palette hex',
      points: 3,
      found: `The theme color ${dialect.modelHex} in ${dialect.hexFile} ships identically on unrelated generated sites.`,
      why: 'Two unrelated companies in different industries carry this exact hex because the palette came with the model, not from a brand decision.',
      fixPrompt:
        'Do not change the color to fix this: pick the palette from the brand, whatever it is, and derive the page background from that decision. Then fix the structural findings above. Color alone moves nothing.',
      filePath: dialect.hexFile ?? undefined,
      evidence: dialect.modelHex,
    });
  }

  // Largest deduction first: the report order the spec mandates.
  findings.sort((a, b) => b.points - a.points);

  const score = computeScore(findings);
  const percentile = percentileFor(score, opts.percentileSample);

  return {
    applicable: true,
    notApplicableReason: null,
    score,
    band: scoreBand(score),
    findings,
    dialect: dialect.dialect,
    dialectNote: dialectNote(dialect.dialect),
    scriptMatch: {
      matched: page.scriptMatch,
      total: SCRIPT_STEPS.length,
      sequence: page.sequence.map((s) => STEP_LABEL[s]),
    },
    pageFile: page.file,
    percentile,
    percentileLine: percentileLine(score, percentile),
  };
}

export { END_STATE_RULES } from './score';
export type { StructuralFinding, SignalId } from './signals';
export type { SourceFile, PageAnalysis } from './page';
export type { Dialect } from './dialect';

/** Elements a test may want to poke at, re-exported for the suite. */
export function h2Count(page: PageAnalysis): number {
  return findAll([page.root], (e: El) => e.tag === 'h2').length;
}
