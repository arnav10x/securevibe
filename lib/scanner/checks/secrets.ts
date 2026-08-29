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
  looksLikeDocExample,
  isCommentLine,
  isPatternDefinitionLine,
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

/**
 * How we found the code decides what we can HONESTLY claim about a committed
 * .env. A GitHub tarball is exactly what git tracks, so an .env in it really
 * is committed. A zip upload is an arbitrary folder — we cannot prove what git
 * tracks, so we lean on the .gitignore and choose our words with care. This
 * is the fix for the old false positive that called every uploaded .env
 * "committed to the repository".
 */
export interface SecretScanContext {
  sourceType?: 'github' | 'zip';
  /** True when the project's .gitignore would ignore this path. */
  isGitignored?: (relPath: string) => boolean;
}

function envFileFinding(relPath: string, base: string, ctx: SecretScanContext): Finding {
  const fromGitHub = ctx.sourceType === 'github';
  const gitignored = ctx.isGitignored?.(relPath) ?? false;

  if (fromGitHub) {
    // Tarball contents ARE the tracked files — this is a provable leak.
    return {
      checkType: 'secret',
      severity: 'critical',
      confidence: 'verified',
      ruleId: 'env-committed',
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
    };
  }

  if (gitignored) {
    // It sits in the upload but git is told to ignore it — probably fine.
    return {
      checkType: 'secret',
      severity: 'low',
      confidence: 'likely',
      ruleId: 'env-present-ignored',
      title: `Environment file "${base}" is in the upload (but git-ignored)`,
      explanation:
        'This .env file is present in what you uploaded, but your .gitignore ' +
        'lists it — so it should never reach your repository. That is the ' +
        'correct setup. Worth a glance only to be sure it was ignored from ' +
        'the very first commit (git history keeps anything committed before).',
      filePath: relPath,
      recommendation:
        'Confirm this file was never committed: run "git log -- ' + base + '". ' +
        'If it ever was, rotate those credentials — history keeps old copies.',
    };
  }

  // Uploaded, not git-ignored: we can't prove it's committed, but it's at risk.
  return {
    checkType: 'secret',
    severity: 'high',
    confidence: 'likely',
    ruleId: 'env-present-unignored',
    title: `Environment file "${base}" is present and not git-ignored`,
    explanation:
      'This .env file is in your project folder and nothing in .gitignore ' +
      'excludes it. If it is (or ever gets) committed to git, every ' +
      'credential inside it is exposed to anyone who can read the repo. From ' +
      'an upload we cannot see your git history, so treat this as a warning to ' +
      'check now, before it becomes a real leak.',
    filePath: relPath,
    recommendation:
      'Add "' + base + '" to .gitignore before your next commit, and make ' +
      'sure it was never committed already (git rm --cached ' + base + ' if it was).',
  };
}

export function checkSecretsInFile(
  relPath: string,
  content: string,
  ctx: SecretScanContext = {},
): Finding[] {
  if (shouldSkipFile(relPath)) return [];

  const findings: Finding[] = [];
  const base = path.posix.basename(relPath);

  // A committed .env file is a finding all by itself — worded by how sure we
  // can be that it is actually committed (see envFileFinding).
  if (ENV_FILE_PATTERN.test(base) && !ENV_EXAMPLE_PATTERN.test(base)) {
    findings.push(envFileFinding(relPath, base, ctx));
  }

  const lines = content.split('\n');
  const seen = new Set<string>(); // dedupe: one finding per rule+line

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 2000) continue; // minified/bundled line, skip

    // A pattern definition is not a secret: a rule file that says
    // "sk_live_ keys look like this" must not be reported as leaking one.
    if (isPatternDefinitionLine(line)) continue;
    const comment = isCommentLine(line);

    for (const rule of SECRET_RULES) {
      const match = rule.regex.exec(line);
      if (!match) continue;
      const secret = match[1];

      // A made-up key in a doc comment ("sk_live_abc123def456") documents the
      // format; it is not a credential. Both conditions are required, so a
      // real key pasted into a comment still fires.
      if (comment && looksLikeDocExample(secret)) continue;

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

      // A key inside a git-ignored file is not committed to the repository.
      // We cannot say it is a leak, only that it is sitting in the folder, so
      // the wording and the severity both step back. On a GitHub tarball this
      // never applies: ignored files are not in the tarball at all.
      const ignored = ctx.isGitignored?.(relPath) ?? false;
      findings.push({
        checkType: 'secret',
        severity: ignored ? 'low' : rule.severity,
        confidence: ignored ? 'likely' : (rule.confidence ?? 'verified'),
        ruleId: rule.id,
        title: ignored ? `${rule.title.replace(/ committed to code$/, '')} in a git-ignored file` : rule.title,
        explanation: ignored
          ? `${rule.explanation} This file is git-ignored, so it is probably ` +
            'not in your repository. Confirm it was never committed before ' +
            'this rule was added, because .gitignore does not remove history.'
          : rule.explanation,
        filePath: relPath,
        lineStart: i + 1,
        evidenceMasked: maskLine(line, secret),
        recommendation: ignored
          ? 'Run "git log --all -- ' + relPath + '". If it returns nothing, ' +
            'you are fine. If it returns commits, rotate the key and purge the file from history.'
          : rule.recommendation,
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
          confidence: 'verified', // the JWT payload literally decodes to service_role
          ruleId: 'supabase-service-role-jwt',
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
