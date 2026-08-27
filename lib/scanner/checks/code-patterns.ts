// Check 4: common insecure code patterns (eval, SQL concatenation,
// disabled TLS, client-side-only auth, hardcoded passwords).

import path from 'node:path';
import type { Finding } from '../types';
import { PATTERN_RULES } from '../rules/insecure-patterns';
import { isPatternDefinitionLine, matchIsInsideProseString } from '../util';

export function checkCodePatternsInFile(relPath: string, content: string): Finding[] {
  const ext = path.posix.extname(relPath).toLowerCase();
  const rules = PATTERN_RULES.filter((r) => r.extensions.has(ext));
  if (rules.length === 0) return [];

  const findings: Finding[] = [];
  const lines = content.split('\n');
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 2000) continue; // bundled/minified, skip
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) {
      continue; // commented-out code is not a live vulnerability
    }
    // A line that DEFINES a pattern is not a line that runs it. Without this
    // the scanner flags its own rule definitions, and every linter config or
    // WAF rule list it ever scans.
    if (isPatternDefinitionLine(line)) continue;

    for (const rule of rules) {
      const match = rule.regex.exec(line);
      if (!match) continue;
      // The pattern described in prose ("new Function() builds code from
      // strings") is documentation, not a call. Skip it.
      if (matchIsInsideProseString(line, match.index)) continue;
      const key = `${rule.id}:${i}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // A guess becomes 'likely' when the same line also shows a real sink —
      // the cheap stand-in for taint tracking (see PatternRule.sinkPattern).
      let confidence = rule.confidence ?? 'heuristic';
      if (rule.sinkPattern && rule.sinkPattern.test(line) && confidence === 'heuristic') {
        confidence = 'likely';
      }

      findings.push({
        checkType: 'insecure_pattern',
        severity: rule.severity,
        confidence,
        ruleId: rule.id,
        title: rule.title,
        explanation: rule.explanation,
        filePath: relPath,
        lineStart: i + 1,
        evidenceMasked: line.trim().slice(0, 160),
        recommendation: rule.recommendation,
      });
    }
  }

  return findings;
}
