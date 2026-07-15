// Plan limits and the quota / rate-limit decision logic.
// Pure functions — the API route feeds them counts from the database.

export const FREE_SCANS_PER_MONTH = 3;
export const SCANS_PER_HOUR_LIMIT = 5; // applies to every plan (cost control)

export type Plan = 'free' | 'pro';

export interface QuotaInput {
  plan: Plan;
  scansThisMonth: number;
  scansLastHour: number;
}

export type QuotaDecision =
  | { allowed: true }
  | { allowed: false; reason: 'quota_exceeded' | 'rate_limited'; message: string };

export function canStartScan({ plan, scansThisMonth, scansLastHour }: QuotaInput): QuotaDecision {
  if (scansLastHour >= SCANS_PER_HOUR_LIMIT) {
    return {
      allowed: false,
      reason: 'rate_limited',
      message: `You can start up to ${SCANS_PER_HOUR_LIMIT} scans per hour. Please try again a bit later.`,
    };
  }
  if (plan === 'free' && scansThisMonth >= FREE_SCANS_PER_MONTH) {
    return {
      allowed: false,
      reason: 'quota_exceeded',
      message:
        `You've used all ${FREE_SCANS_PER_MONTH} free scans this month. ` +
        'Upgrade to Pro for unlimited scans.',
    };
  }
  return { allowed: true };
}

/** First moment of the current calendar month, in UTC. */
export function startOfMonthUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
