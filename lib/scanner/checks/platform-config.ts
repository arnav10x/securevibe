// Check 2: Supabase / Firebase misconfiguration heuristics.
//
// These are the classic "vibe-coded app" failure modes: the app works
// perfectly in the demo, but the database itself is open to the internet.

import path from 'node:path';
import type { Finding } from '../types';

export function checkPlatformConfigInFile(relPath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const base = path.posix.basename(relPath).toLowerCase();

  // ---- Firebase security rules (Firestore / Storage) ----
  const isFirebaseRules =
    base.endsWith('.rules') ||
    content.includes('service cloud.firestore') ||
    content.includes('service firebase.storage');

  if (isFirebaseRules) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (/allow\s+(?:read|write|create|update|delete|get|list)(?:\s*,\s*\w+)*\s*:\s*if\s+true\b/.test(lines[i])) {
        findings.push({
          checkType: 'platform_config',
          severity: 'critical',
          title: 'Firebase rules allow public access to your data',
          explanation:
            'This security rule says "allow ... if true", which means ANYONE ' +
            'on the internet — no login required — can read or modify this ' +
            'data directly, without ever using your app. This is the single ' +
            'most common way AI-built apps leak their entire database.',
          filePath: relPath,
          lineStart: i + 1,
          evidenceMasked: lines[i].trim().slice(0, 160),
          recommendation:
            'Rewrite the rule to require authentication and ownership, e.g. ' +
            '"allow read, write: if request.auth != null && ' +
            'request.auth.uid == resource.data.ownerId;". Test with the ' +
            'Firebase rules simulator before deploying.',
        });
      }
    }
  }

  // ---- Firebase Realtime Database rules (JSON) ----
  if (base === 'database.rules.json' || (base.endsWith('.json') && content.includes('".read"'))) {
    try {
      const parsed = JSON.parse(content);
      const openPaths: string[] = [];
      walkRealtimeRules(parsed, '', openPaths);
      for (const p of openPaths) {
        findings.push({
          checkType: 'platform_config',
          severity: 'critical',
          title: 'Firebase Realtime Database is publicly readable/writable',
          explanation:
            `The rule at ${p || 'the database root'} is set to true, which ` +
            'gives everyone on the internet direct access to that data — no ' +
            'login, no app, just a URL.',
          filePath: relPath,
          recommendation:
            'Replace "true" with an auth condition, e.g. ' +
            '"auth != null && auth.uid === $uid". The Firebase docs call ' +
            'these rules "insecure by design" for a reason.',
        });
      }
    } catch {
      // not valid JSON — ignore
    }
  }

  // ---- SQL files: Row Level Security problems ----
  if (base.endsWith('.sql')) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (/alter\s+table\s+.*disable\s+row\s+level\s+security/i.test(lines[i])) {
        findings.push({
          checkType: 'platform_config',
          severity: 'high',
          title: 'Row Level Security is explicitly disabled on a table',
          explanation:
            'Row Level Security (RLS) is the mechanism that stops one user ' +
            'from reading another user\'s rows. With RLS disabled, anyone ' +
            'holding your public API key (which every visitor to your site ' +
            'has) can read and write the whole table.',
          filePath: relPath,
          lineStart: i + 1,
          evidenceMasked: lines[i].trim().slice(0, 160),
          recommendation:
            'Enable RLS (ALTER TABLE ... ENABLE ROW LEVEL SECURITY) and add ' +
            'policies that check auth.uid(). In Supabase, run the Security ' +
            'Advisor — it lists tables with RLS off.',
        });
      }
    }

    // Inspect CREATE POLICY statements for USING (true) on write operations.
    const policyRegex = /create\s+policy[\s\S]*?;/gi;
    let match: RegExpExecArray | null;
    while ((match = policyRegex.exec(content)) !== null) {
      const stmt = match[0];
      const isPermissiveTrue = /using\s*\(\s*true\s*\)|with\s+check\s*\(\s*true\s*\)/i.test(stmt);
      if (!isPermissiveTrue) continue;
      const lineStart = content.slice(0, match.index).split('\n').length;
      const forSelectOnly = /for\s+select/i.test(stmt);

      if (forSelectOnly) {
        findings.push({
          checkType: 'platform_config',
          severity: 'medium',
          title: 'A table is readable by everyone (policy USING (true))',
          explanation:
            'This policy makes every row in the table readable by anyone. ' +
            'That is sometimes intentional (e.g. public blog posts) — but if ' +
            'this table holds user data, it is a leak.',
          filePath: relPath,
          lineStart,
          evidenceMasked: stmt.split('\n')[0].trim().slice(0, 160),
          recommendation:
            'If the data is meant to be public, you can ignore this. ' +
            'Otherwise change USING (true) to USING (auth.uid() = user_id).',
        });
      } else {
        findings.push({
          checkType: 'platform_config',
          severity: 'high',
          title: 'A table is writable by everyone (policy USING (true))',
          explanation:
            'This policy applies to write operations with no condition, so ' +
            'any visitor can insert, change, or delete rows in the table ' +
            'using only your public API key.',
          filePath: relPath,
          lineStart,
          evidenceMasked: stmt.split('\n')[0].trim().slice(0, 160),
          recommendation:
            'Scope the policy to the owner: USING (auth.uid() = user_id) ' +
            'WITH CHECK (auth.uid() = user_id).',
        });
      }
    }

    // Tables created but RLS never mentioned anywhere in the file.
    if (/create\s+table/i.test(content) && !/row\s+level\s+security/i.test(content)) {
      findings.push({
        checkType: 'platform_config',
        severity: 'medium',
        title: 'Tables are created without Row Level Security',
        explanation:
          'This migration creates tables but never enables Row Level ' +
          'Security. On Supabase, a table without RLS is fully readable and ' +
          'writable with the public API key that ships in your frontend.',
        filePath: relPath,
        recommendation:
          'After each CREATE TABLE, add: ALTER TABLE <name> ENABLE ROW LEVEL ' +
          'SECURITY; then write policies for exactly who can do what. ' +
          '(If this SQL is not used with Supabase/PostgREST, this may not apply.)',
      });
    }
  }

  return findings;
}

/** Recursively find ".read": true / ".write": true in Realtime DB rules. */
function walkRealtimeRules(node: unknown, currentPath: string, out: string[]): void {
  if (typeof node !== 'object' || node === null) return;
  for (const [key, value] of Object.entries(node)) {
    if ((key === '.read' || key === '.write') && value === true) {
      const p = currentPath || '/';
      if (!out.includes(p)) out.push(p); // one finding per open path
    } else if (typeof value === 'object' && value !== null) {
      walkRealtimeRules(value, `${currentPath}/${key}`, out);
    }
  }
}
