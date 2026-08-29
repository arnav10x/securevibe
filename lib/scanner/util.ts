// Small helpers shared by the checks.

/**
 * Shannon entropy of a string in bits per character.
 * Random secrets score high (4+); words and paths score low (~3 or less).
 * We use this to tell a real credential apart from e.g. "not-set-yet".
 */
export function shannonEntropy(value: string): number {
  if (value.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const ch of value) {
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Masks a secret so the report can show WHERE it is without re-leaking it.
 * "sk_live_abc123def456ghi789" -> "sk_live_ab**********"
 */
export function maskSecret(secret: string): string {
  const visible = Math.min(6, Math.floor(secret.length / 3));
  return secret.slice(0, visible) + '*'.repeat(Math.min(secret.length - visible, 12));
}

/**
 * Produces the single evidence line we are allowed to keep: the source line
 * with the matched secret replaced by its masked form, trimmed to 160 chars.
 */
export function maskLine(line: string, secret: string): string {
  const masked = line.split(secret).join(maskSecret(secret));
  const trimmed = masked.trim();
  return trimmed.length > 160 ? trimmed.slice(0, 157) + '...' : trimmed;
}

/** Values that look like docs/placeholders, not real credentials. */
export function looksLikePlaceholder(value: string): boolean {
  if (/^(.)\1+$/.test(value)) return true; // "aaaaaaaa", "xxxxxxxx"
  return /(example|sample|placeholder|change[-_ ]?me|your[-_ ]?|<|>|\$\{|\bprocess\.env|os\.environ|\benv\(|dummy|fake|not[-_ ]?set|todo|insert[-_ ]?here|xxx)/i.test(
    value,
  );
}

/**
 * True for a value that reads as a documentation example rather than a real
 * credential: it contains runs of the alphabet or of digits in order
 * ("abc123def456"). Real keys are random, so two or more such runs in one
 * value effectively never happen by chance.
 *
 * This is deliberately narrow. It is only ever consulted together with
 * `isCommentLine`, because a genuine key pasted into a comment is still a
 * genuine leak and must keep firing.
 */
export function looksLikeDocExample(value: string): boolean {
  const runs = value
    .toLowerCase()
    .match(/abc|bcd|cde|def|efg|ghi|hij|ijk|xyz|012|123|234|345|456|567|678|789/g);
  return (runs?.length ?? 0) >= 2;
}

/** True when the line is a comment (line, block, or doc-block continuation). */
export function isCommentLine(line: string): boolean {
  const t = line.trimStart();
  return t.startsWith('//') || t.startsWith('#') || t.startsWith('*') || t.startsWith('/*');
}

/**
 * True when the line DEFINES a pattern rather than running dangerous code:
 * a regex assigned to a `regex:`/`pattern:` property, or a `new RegExp(...)`.
 *
 * Without this the scanner reports its own rule definitions as
 * vulnerabilities, and it does the same to anyone else's linter config or
 * WAF rule list. A rule that says "eval( is dangerous" is not an eval call.
 */
export function isPatternDefinitionLine(line: string): boolean {
  return (
    /^\s*(?:regex|pattern|re|rx|matcher)\s*:\s*\//.test(line) ||
    /\bnew RegExp\s*\(/.test(line) ||
    /^\s*\/(?!\/)/.test(line) // a bare regex literal opening the line
  );
}

/**
 * True when a match at `index` falls inside a quoted string that reads as
 * prose (four or more words). Such a match is the pattern being DESCRIBED,
 * not executed: a rule titled "new Function() builds code from strings", an
 * error message, or documentation showing the safe alternative.
 *
 * Dangerous code puts the call outside the quotes (`exec('rm ' + x)` matches
 * at `exec(`), so this never suppresses a real finding.
 */
export function matchIsInsideProseString(line: string, index: number): boolean {
  const stringLiteral = /(['"`])(?:\\.|(?!\1)[^\\])*\1/g;
  let m: RegExpExecArray | null;
  while ((m = stringLiteral.exec(line)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    if (index <= start || index >= end) continue;
    const words = m[0].slice(1, -1).trim().split(/\s+/).filter(Boolean);
    return words.length >= 4;
  }
  return false;
}

/** True if the buffer looks binary (contains a NUL byte in its first 8KB). */
export function looksBinary(buffer: Buffer): boolean {
  const slice = buffer.subarray(0, 8192);
  return slice.includes(0);
}

/**
 * True for files that are tests, fixtures, mocks, or examples — code that is
 * not shipped to users. Secrets planted in a test must not fail the whole
 * app's security grade (they are still reported, just not counted as the app
 * being broken). Mirrors the exclusion the design audit already applies.
 */
export function isTestPath(relPath: string): boolean {
  return (
    /(?:^|\/)(?:tests?|__tests__|__mocks__|fixtures?|e2e|cypress|playwright|stories|\.storybook|examples?|samples?)\//i.test(
      relPath,
    ) || /\.(?:test|spec|stories|fixture|mock)\.[cm]?[jt]sx?$/i.test(relPath)
  );
}

/**
 * A deliberately small .gitignore matcher — enough to answer one question:
 * "would git ignore this env file?" It understands the patterns that actually
 * appear for env files (`.env`, `.env*`, `*.local`, `.env.local`, a leading
 * slash, a trailing slash for dirs). It is not a full gitignore engine and
 * does not try to be; when unsure it returns false (safer to warn than to
 * silently clear a real leak).
 */
export function makeGitignoreMatcher(gitignoreContent: string | null): (relPath: string) => boolean {
  if (!gitignoreContent) return () => false;
  const patterns = gitignoreContent
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('!'));

  const regexes = patterns.map((raw) => {
    let p = raw.replace(/\/$/, ''); // trailing slash (dir) — treat as name
    const anchored = p.startsWith('/');
    if (anchored) p = p.slice(1);
    // Escape regex metachars except * and ?, which are globs.
    const body = p
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
    // Anchored patterns match from root; unanchored match any path segment.
    return new RegExp(anchored ? `^${body}(?:/|$)` : `(?:^|/)${body}(?:/|$)`);
  });

  return (relPath: string) => regexes.some((re) => re.test(relPath));
}

/**
 * Pull a concrete version out of a package.json / requirements spec so we can
 * ask a vuln database about it. Returns the exact version when the spec pins
 * one (`1.2.3`, `==1.2.3`, `=1.2.3`, `v1.2.3`), or the FLOOR of a caret/tilde
 * range (`^1.2.3` -> `1.2.3`) — the floor is the version most likely still
 * installed on an app that never ran `npm update`. Returns null when the spec
 * is a tag, URL, or wildcard we cannot resolve to a number.
 */
export function versionFromSpec(spec: string): string | null {
  const s = spec.trim();
  if (!s || s === '*' || s === 'latest' || s === 'x') return null;
  const m = s.match(/(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?|\d+\.\d+|\d+)/);
  if (!m) return null;
  // Normalize partials like "1" or "1.2" to a full semver for the DB.
  const parts = m[1].split('+')[0].split('-')[0].split('.');
  while (parts.length < 3) parts.push('0');
  const pre = m[1].includes('-') ? m[1].slice(m[1].indexOf('-')) : '';
  return parts.slice(0, 3).join('.') + pre;
}

/** Decode a base64url JWT segment; returns null if it isn't valid JSON. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}
