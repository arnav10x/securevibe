// The public "teaser" view of an anonymous scan. This is the ONLY shape in
// which an unclaimed scan ever leaves the server: medium/low findings in
// full, critical/high as bare severity markers — no titles, no paths, no
// evidence. The full report exists only behind an account.

import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';

export interface TeaserFinding {
  id: string;
  checkType: string;
  severity: string;
  title: string;
  explanation: string;
  filePath: string | null;
  lineStart: number | null;
  evidenceMasked: string | null;
  recommendation: string;
}

export interface LockedFinding {
  severity: string;
  checkType: string;
}

export interface PublicScan {
  id: string;
  status: string;
  sourceRef: string;
  sourceType: string;
  errorMessage: string | null;
  stats: Record<string, unknown>;
  sourceDeletedAt: string | null;
  createdAt: string;
  tally: Record<string, number>;
  /** Medium/low findings, shown in full — the free taste. */
  unlocked: TeaserFinding[];
  /** Critical/high findings, stripped to severity + check type only. */
  locked: LockedFinding[];
}

/** A findings row as it comes out of the database (snake_case). */
export interface FindingRow {
  id: string;
  check_type: string;
  severity: string;
  title: string;
  explanation: string;
  file_path: string | null;
  line_start: number | null;
  evidence_masked: string | null;
  recommendation: string;
}

/**
 * The gate itself, as a pure function: split findings into the open
 * (medium/low, full detail) and the sealed (critical/high, severity and
 * check type ONLY — no other key survives). Unit-tested in
 * tests/app/teaser.test.ts so the seal can never quietly leak fields.
 */
export function partitionFindings(rows: FindingRow[]): {
  tally: Record<string, number>;
  unlocked: TeaserFinding[];
  locked: LockedFinding[];
} {
  const tally: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const unlocked: TeaserFinding[] = [];
  const locked: LockedFinding[] = [];

  for (const f of rows) {
    tally[f.severity] = (tally[f.severity] ?? 0) + 1;
    if (f.severity === 'medium' || f.severity === 'low') {
      unlocked.push({
        id: f.id,
        checkType: f.check_type,
        severity: f.severity,
        title: f.title,
        explanation: f.explanation,
        filePath: f.file_path,
        lineStart: f.line_start,
        evidenceMasked: f.evidence_masked,
        recommendation: f.recommendation,
      });
    } else {
      locked.push({ severity: f.severity, checkType: f.check_type });
    }
  }

  // Worst first within each group, stable order for the page.
  const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  unlocked.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9));
  locked.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9));

  return { tally, unlocked, locked };
}

/**
 * Load the public view of an UNCLAIMED anonymous scan.
 * Returns null when the scan does not exist, belongs to an account
 * (claimed scans are private), or admin access is not configured.
 */
export async function getPublicScan(id: string): Promise<PublicScan | null> {
  if (!adminConfigured()) return null;
  const admin = createAdminClient();

  const { data: scan } = await admin
    .from('scans')
    .select('id, user_id, source_ref, source_type, status, error_message, stats, source_deleted_at, created_at')
    .eq('id', id)
    .maybeSingle();
  if (!scan || scan.user_id) return null;

  const { data: findings } = await admin
    .from('findings')
    .select('id, check_type, severity, title, explanation, file_path, line_start, evidence_masked, recommendation')
    .eq('scan_id', id);

  const { tally, unlocked, locked } = partitionFindings((findings ?? []) as FindingRow[]);

  return {
    id: scan.id,
    status: scan.status,
    sourceRef: scan.source_ref,
    sourceType: scan.source_type,
    errorMessage: scan.error_message,
    stats: (scan.stats ?? {}) as Record<string, unknown>,
    sourceDeletedAt: scan.source_deleted_at,
    createdAt: scan.created_at,
    tally,
    unlocked,
    locked,
  };
}

/**
 * Adopt an anonymous scan into an account. Succeeds only when the caller
 * presents the claim token that was set as an httpOnly cookie in the
 * browser that ran the scan. Returns true when a row was claimed.
 */
export async function claimScan(scanId: string, token: string, userId: string): Promise<boolean> {
  if (!adminConfigured()) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from('scans')
    .update({ user_id: userId, claim_token: null, anon_ip_hash: null })
    .eq('id', scanId)
    .eq('claim_token', token)
    .is('user_id', null)
    .select('id');
  return (data ?? []).length > 0;
}
