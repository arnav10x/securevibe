// One copy-pasteable prompt per report SECTION, for the user's own coding
// agent. Where the per-finding prompt fixes an instance, this one asks for
// the system (SECUREVIBE-UIUX.md 10.2): every signal in the dimension,
// batched into a single bounded instruction with the constraints that stop
// an agent from fixing superficially or introducing a different tell.

import { DESIGN_RULES } from '@/lib/scanner/rules/design-rules';

export interface SectionPromptFinding {
  title: string;
  explanation: string;
  recommendation: string;
  filePath?: string | null;
  lineStart?: number | null;
  evidenceMasked?: string | null;
}

export interface SectionPromptGroup {
  title: string;
  count: number;
  findings: SectionPromptFinding[];
}

/** Locations per signal shown in full; the rest fold into "and N more". */
const MAX_LOCATIONS = 3;

const VERIFY_BY_TITLE = new Map(DESIGN_RULES.map((r) => [r.title, r.verify]));

export function buildSectionPrompt(input: {
  section: string;
  hint: string;
  groups: SectionPromptGroup[];
}): string {
  const { section, hint, groups } = input;
  const total = groups.reduce((n, g) => n + g.count, 0);

  const tasks = groups.map((g, i) => {
    const first = g.findings[0];
    const where = g.findings
      .slice(0, MAX_LOCATIONS)
      .map((f) =>
        f.filePath ? `${f.filePath}${f.lineStart ? `:${f.lineStart}` : ''}` : 'project-wide',
      )
      .join(', ');
    const more =
      g.count > MAX_LOCATIONS ? ` and ${g.count - MAX_LOCATIONS} more occurrence${g.count - MAX_LOCATIONS === 1 ? '' : 's'}` : '';
    const evidence = first.evidenceMasked ? `\n   Evidence: ${first.evidenceMasked}` : '';
    return [
      `${i + 1}. ${g.title}${g.count > 1 ? ` (${g.count} occurrences)` : ''}`,
      `   Where: ${where}${more}${evidence}`,
      `   Why: ${first.explanation}`,
      `   Do: ${first.recommendation}`,
    ].join('\n');
  });

  const verifies = [
    ...new Set(
      groups
        .map((g) => VERIFY_BY_TITLE.get(g.title))
        .filter((v): v is string => Boolean(v)),
    ),
  ].slice(0, 8);

  return [
    'CONTEXT',
    `You are fixing every "${section}" finding from a SecureVibe scan of this ` +
      `repository (${hint.toLowerCase()}). There are ${total} finding${total === 1 ? '' : 's'} ` +
      `across ${groups.length} signal${groups.length === 1 ? '' : 's'}, listed below with files and lines.`,
    '',
    'TASKS, in order:',
    ...tasks,
    '',
    'CONSTRAINTS',
    '- Fix the system, not the instances. When several occurrences share a cause, change the shared source (a token, a base component, a shared style) and migrate the call sites.',
    '- Change only what these fixes require. Keep all behavior, routes, and content identical, and do not reformat unrelated code.',
    '- Where a fix involves taste (a color, a typeface, a wording), derive the choice from what this product actually is, and state your reasoning before writing code.',
    '- Do not introduce new tells while fixing these: no gradients spanning hue families, no emoji standing in for icons, no invented numbers or testimonials, no decorative reference stamps.',
    '',
    'VERIFY',
    ...(verifies.length > 0
      ? verifies.map((v) => `- ${v}`)
      : ['- Search the project for each flagged pattern above and confirm it is resolved.']),
    '- Then summarize what changed, file by file, in plain language.',
  ].join('\n');
}
