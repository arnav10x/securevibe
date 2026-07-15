// Check 1: hardcoded secrets and credentials.

import path from 'node:path';
import type { Finding } from '../types';
import {
  SECRET_RULES,
  ENV_FILE_PATTERN,
  ENV_EXAMPLE_PATTERN,
} from '../rules/secret-patterns';
import {
  shannonEntropy,
  looksLikePlaceholder,
  maskLine,
  decodeJwtPayload,
  maskSecret,
} from '../util';

/** Files where secret-looking strings are expected and harmless. */
const SKIP_BASENAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'composer.lock',
]);

function shouldSkipFile(relPath: string): boolean {
  const base = path.posix.basename(relPath);
  if (SKIP_BASENAMES.has(base)) return true;
  if (ENV_EXAMPLE_PATTERN.test(base)) return true; // .env.example etc.
  if (base.endsWith('.min.js') || base.endsWith('.map')) return true;
  return false;
}

/** Local/dev database hosts — not worth alarming anyone about. */
function isLocalConnectionString(line: string): boolean {
  return /@(localhost|127\.0\.0\.1|0\.0\.0\.0|host\.docker\.internal|db:)/.test(line);
}

export function checkSecretsInFile(relPath: string, content: string): Finding[] {
  if (shouldSkipFile(relPath)) return [];

  const findings: Finding[] = [];
  const base = path.posix.basename(relPath);

  // A committed .env file is a finding all by itself.
  if (ENV_FILE_PATTERN.test(base) && !ENV_EXAMPLE_PATTERN.test(base)) {
    findings.push({
      checkType: 'secret',
      severity: 'critical',
      title: `Environment file "${base}" is committed to the repository`,
      explanation:
        'Files like .env exist specifically to hold secrets, and this one is ' +
        'part of the codebase. Anyone with access to the repo — or its full ' +
        'git history — has every credential inside it.',
      filePath: relPath,
      recommendation:
        'Add the file to .gitignore, remove it from git (git rm --cached), ' +
        'and rotate every credential it contains. Note: deleting the file in ' +
        'a new commit does NOT remove it from git history.',
    });
  }

  const lines = content.split('\n');
  const seen = new Set<string>(); // dedupe: one finding per rule+line

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 2000) continue; // minified/bundled line, skip

    for (const rule of SECRET_RULES) {
      const match = rule.regex.exec(line);
      if (!match) continue;
      const secret = match[1];

      if (rule.requiresEntropy) {
        if (shannonEntropy(secret) < 3.5) continue;
        if (looksLikePlaceholder(secret)) continue;
      }
      if (rule.id === 'connection-string-password') {
        if (isLocalConnectionString(line)) continue;
        if (looksLikePlaceholder(secret)) continue;
      }

      const key = `${rule.id}:${i}`;
      if (seen.has(key)) continue;
      seen.add(key);

      findings.push({
        checkType: 'secret',
        severity: rule.severity,
        title: rule.title,
        explanation: rule.explanation,
        filePath: relPath,
        lineStart: i + 1,
        evidenceMasked: maskLine(line, secret),
        recommendation: rule.recommendation,
      });
      break; // one rule per line is enough; most specific rules run first
    }

    // Special case: Supabase LEGACY keys are JWTs. The anon key is public by
    // design (safe), but the service_role key bypasses all security. We only
    // flag the dangerous one — a scanner that cried wolf on every anon key
    // would teach users to ignore it.
    const jwtMatch = /\b(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,})\b/.exec(line);
    if (jwtMatch) {
      const payload = decodeJwtPayload(jwtMatch[1]);
      if (payload && payload['role'] === 'service_role' && !seen.has(`service-role:${i}`)) {
        seen.add(`service-role:${i}`);
        findings.push({
          checkType: 'secret',
          severity: 'critical',
          title: 'Supabase service_role key committed to code',
          explanation:
            'This JWT is a Supabase service_role key. It bypasses ALL Row ' +
            'Level Security — anyone holding it can read and modify every ' +
            'row in your database, regardless of your security rules.',
          filePath: relPath,
          lineStart: i + 1,
          evidenceMasked: maskLine(line, jwtMatch[1]),
          recommendation:
            'Rotate your project\'s JWT secret / API keys in the Supabase ' +
            'dashboard, and only ever use the service key in server-side ' +
            'code loaded from an environment variable.',
        });
      }
    }
  }

  return findings;
}

export { maskSecret };
