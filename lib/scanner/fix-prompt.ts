// The fix prompt IS the product; everything else is the setup
// (SECUREVIBE.md 4.2). This builds the copy-pasteable prompt a user drops
// into their own coding agent, from a single finding.
//
// Requirements it satisfies:
//   1. Self-contained — names the file, the current state, the target state.
//   2. Specific to this repo — cites the actual path and evidence found.
//   3. Constrained — states what must not change, because the most common
//      failure of a fix prompt is an agent rewriting far more than intended.
//   4. Verifiable — ends with a check to confirm the fix landed.
//
// Pure function of the finding, so it works identically in the report UI
// and in tests.

export interface FixPromptInput {
  title: string;
  explanation: string;
  recommendation: string;
  filePath?: string | null;
  lineStart?: number | null;
  evidenceMasked?: string | null;
  /** The rule's own verification step, when it defines one. */
  verify?: string | null;
}

export function buildFixPrompt(f: FixPromptInput): string {
  const where = f.filePath
    ? `${f.filePath}${f.lineStart ? ` (line ${f.lineStart})` : ''}`
    : 'this project';

  const context = [
    `This repository has the following issue in ${where}: ${f.title}.`,
    f.evidenceMasked ? `The flagged code is:\n  ${f.evidenceMasked}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const verify =
    f.verify ??
    'Show me the diff, then search the project for the original pattern and confirm this occurrence is resolved.';

  return [
    'CONTEXT',
    context,
    '',
    'PROBLEM',
    f.explanation,
    '',
    'TASK',
    f.recommendation,
    '',
    'CONSTRAINTS',
    '- Change only what this fix requires. Keep all other behavior, routes, and styling identical.',
    '- Do not reformat or rewrite unrelated code in the files you touch.',
    '- If the right fix involves a taste decision (a color, a wording), list the options and ask me before proceeding.',
    '',
    'VERIFY',
    verify,
  ].join('\n');
}
