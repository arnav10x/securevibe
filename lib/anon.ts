// Anonymous "instant scan" plumbing: per-visitor rate limiting and the
// claim cookie that lets a newly created account adopt the scan it ran
// before signing up.

import { createHash } from 'node:crypto';

/** Instant scans allowed per visitor (hashed IP) per rolling 24 hours. */
export const ANON_SCANS_PER_DAY = 3;

/** Cookie holding "<scanId>.<claimToken>" for the claim-on-signup flow. */
export const CLAIM_COOKIE = 'sv_claim';
export const CLAIM_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * A stable, non-reversible fingerprint of the caller's IP. We never store
 * the raw address — only this salted hash, used to count scans per day.
 */
export function clientIpHash(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = (forwarded?.split(',')[0] ?? request.headers.get('x-real-ip') ?? 'local').trim();
  return createHash('sha256').update(`securevibe-anon:${ip}`).digest('hex').slice(0, 32);
}

/** Parse the claim cookie value into its parts (or null if malformed). */
export function parseClaimCookie(value: string | undefined) {
  if (!value) return null;
  const dot = value.indexOf('.');
  if (dot <= 0) return null;
  const scanId = value.slice(0, dot);
  const token = value.slice(dot + 1);
  if (!scanId || !token) return null;
  return { scanId, token };
}
