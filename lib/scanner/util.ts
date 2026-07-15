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

/** True if the buffer looks binary (contains a NUL byte in its first 8KB). */
export function looksBinary(buffer: Buffer): boolean {
  const slice = buffer.subarray(0, 8192);
  return slice.includes(0);
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
