import { describe, expect, it } from 'vitest';
import { canStartScan, startOfMonthUtc, FREE_SCANS_PER_MONTH } from '@/lib/quota';

describe('canStartScan', () => {
  it('allows a free user under quota', () => {
    expect(canStartScan({ plan: 'free', scansThisMonth: 2, scansLastHour: 1 })).toEqual({
      allowed: true,
    });
  });

  it('blocks the 4th free scan of the month with an upgrade message', () => {
    const decision = canStartScan({
      plan: 'free',
      scansThisMonth: FREE_SCANS_PER_MONTH,
      scansLastHour: 0,
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe('quota_exceeded');
      expect(decision.message).toContain('Upgrade');
    }
  });

  it('gives pro users unlimited monthly scans', () => {
    expect(canStartScan({ plan: 'pro', scansThisMonth: 999, scansLastHour: 0 })).toEqual({
      allowed: true,
    });
  });

  it('rate-limits everyone, including pro, at 5 scans/hour', () => {
    const decision = canStartScan({ plan: 'pro', scansThisMonth: 10, scansLastHour: 5 });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe('rate_limited');
  });

  it('computes the start of the current UTC month', () => {
    const start = startOfMonthUtc(new Date('2026-07-15T23:59:00Z'));
    expect(start.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });
});
