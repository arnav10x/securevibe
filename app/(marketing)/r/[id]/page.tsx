// /r/[id] — the preview report for an instant (anonymous) scan.
//
// Medium/low findings are open: real, useful, fixable today. Critical and
// high findings arrive sealed — severity and check type only (the server
// never sends their contents here) — and unseal by creating the free
// account that adopts this scan. Once claimed, this URL goes dark and the
// report lives at /scans/[id].

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { CLAIM_COOKIE, parseClaimCookie } from '@/lib/anon';
import { claimScan, getPublicScan } from '@/lib/teaser';
import type { ReportCard } from '@/lib/scanner/types';
import { Alert, ButtonLink, Card, SeverityBadge } from '@/components/ui';
import { AutoRefresh } from '@/components/auto-refresh';
import { FindingsBrowser } from '@/components/findings-browser';
import { ReportCardPlate } from '@/components/report-card';
import { StampIn } from '@/components/fx';
import { IconGitHub, IconLock, IconSparkle, LogoMark } from '@/components/icons';

export const metadata: Metadata = {
  title: 'Scan preview',
  robots: { index: false, follow: false },
};

const CHECK_NAMES: Record<string, string> = {
  secret: 'Secrets check',
  platform_config: 'Platform config',
  dependency: 'Dependencies',
  insecure_pattern: 'Code patterns',
  design: 'Craft',
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--color-critical)',
  high: 'var(--color-high)',
  medium: 'var(--color-medium)',
  low: 'var(--color-low)',
};

export default async function PreviewReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // A signed-in owner lands on the real report, not the preview.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: own } = await supabase.from('scans').select('id').eq('id', id).maybeSingle();
    if (own) redirect(`/scans/${id}`);
  }

  const scan = await getPublicScan(id);
  if (!scan) notFound();

  // Signed in, holding the claim cookie for this scan → adopt it now.
  if (user) {
    const claim = parseClaimCookie((await cookies()).get(CLAIM_COOKIE)?.value);
    if (claim && claim.scanId === id) {
      const claimed = await claimScan(claim.scanId, claim.token, user.id);
      if (claimed) redirect(`/scans/${id}`);
    }
  }

  const inFlight = scan.status === 'queued' || scan.status === 'running';
  const lockedCount = scan.locked.length;
  const stats = scan.stats as {
    filesScanned?: number;
    durationMs?: number;
    packagesChecked?: number;
    report?: ReportCard;
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {inFlight && <AutoRefresh />}

      {/* Letterhead */}
      <div className="plate relative px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="label">Instant scan — preview report</p>
            <h1 className="mt-3 flex min-w-0 items-center gap-2.5">
              <span className="shrink-0 text-ink-mute">
                <IconGitHub className="h-5 w-5" />
              </span>
              <span className="mono-tight break-all font-mono text-lg font-semibold text-ink sm:text-xl">
                {scan.sourceRef}
              </span>
            </h1>
            <p className="mono-tight mt-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
              Scanned {new Date(scan.createdAt).toLocaleString()}
              {typeof stats.filesScanned === 'number' && <> · {stats.filesScanned} files</>}
              {typeof stats.durationMs === 'number' && (
                <> · {(stats.durationMs / 1000).toFixed(1)}s</>
              )}
            </p>
          </div>
          <span className="tag tag--ink shrink-0 text-[10px]">Preview</span>
        </div>

        {scan.sourceDeletedAt && (
          <div className="rule-hair mt-5 pt-4">
            <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px] leading-relaxed text-ink-soft">
              <StampIn>
                <span className="tag tag--safe text-[10px]">
                  <IconLock className="inline-block h-3 w-3 align-[-1.5px]" />
                  Source destroyed
                </span>
              </StampIn>
              <span>
                The source was permanently deleted at{' '}
                <strong className="font-semibold text-ink">
                  {new Date(scan.sourceDeletedAt).toLocaleString()}
                </strong>{' '}
                — before this page ever loaded.
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 space-y-8">
        {inFlight && (
          <Card className="py-14 text-center">
            <div className="relative mx-auto h-16 w-16">
              <span className="absolute inset-0 rounded-2xl border-[1.5px] border-verdant/60 [animation:ping-square_2s_ease-out_infinite]" />
              <span className="absolute inset-0 grid place-items-center rounded-2xl border-[1.5px] border-ink/40 text-ink">
                <LogoMark className="h-7 w-7" />
              </span>
            </div>
            <p className="mx-auto mt-6 w-fit">
              <span className="tag text-[11px]">Scan in progress</span>
            </p>
            <p className="mt-4 text-sm text-ink-soft">This page refreshes automatically.</p>
          </Card>
        )}

        {scan.status === 'failed' && (
          <Alert tone="error">
            <strong>This scan failed.</strong> {scan.errorMessage ?? 'Please try again.'}
          </Alert>
        )}

        {scan.status === 'completed' && (
          <>
            {/* The grade is free — the reasons behind it are the product */}
            {stats.report && <ReportCardPlate report={stats.report} />}

            {/* The tally — every severity counted, sealed or not */}
            <div className="plate flex flex-wrap divide-x divide-[var(--line)] px-2 py-4">
              {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
                const count = scan.tally[sev] ?? 0;
                if (count === 0) return null;
                return (
                  <span key={sev} className="flex items-center gap-3 px-5 py-1">
                    <span
                      className="display text-3xl tabular-nums"
                      style={{ color: SEVERITY_COLOR[sev] }}
                    >
                      {count}
                    </span>
                    <SeverityBadge severity={sev} />
                    {(sev === 'critical' || sev === 'high') && (
                      <IconLock className="h-3.5 w-3.5 text-ink-mute" aria-label="sealed" />
                    )}
                  </span>
                );
              })}
              {Object.values(scan.tally).every((n) => n === 0) && (
                <span className="flex items-center gap-2 px-5 py-1 text-sm text-safe">
                  <IconSparkle className="h-4 w-4" /> No issues found by our checks
                </span>
              )}
            </div>

            {/* Sealed findings — the reason to make an account */}
            {lockedCount > 0 && (
              <section>
                <div className="rule-index pt-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-lg font-semibold tracking-tight">
                      Sealed — {lockedCount} {lockedCount === 1 ? 'finding' : 'findings'}
                    </h2>
                    <p className="text-sm text-ink-soft">
                      Critical and high-severity findings open with a free account.
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-4">
                  {scan.locked.map((f, i) => (
                    <div
                      key={i}
                      className="plate plate--plain p-6"
                      style={{ borderLeft: `3px solid ${SEVERITY_COLOR[f.severity]}` }}
                      aria-label={`Sealed ${f.severity} finding from the ${CHECK_NAMES[f.checkType] ?? f.checkType}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <SeverityBadge severity={f.severity} />
                          <span className="mono-tight font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                            {CHECK_NAMES[f.checkType] ?? f.checkType}
                          </span>
                        </div>
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--line-strong)] bg-well text-ink-soft" role="img" aria-label="Sealed finding"><IconLock className="h-4 w-4" /></span>
                      </div>
                      {/* Redaction bars — decorative; the real content never left the server */}
                      <div aria-hidden className="mt-4 space-y-2.5">
                        <div className="h-3.5 w-3/5 bg-ink/75" />
                        <div className="h-2.5 w-11/12 bg-ink/25" />
                        <div className="h-2.5 w-4/6 bg-ink/25" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* The unseal CTA */}
                <div className="plate--ultra plate mt-6 p-7">
                  <p className="label label--bone">Break the seal</p>
                  <h3 className="display mt-3 text-2xl text-bone">
                    {lockedCount} {lockedCount === 1 ? 'finding stays' : 'findings stay'} sealed{' '}
                    <em>until you have an account.</em>
                  </h3>
                  <ul className="mt-4 space-y-1.5 text-sm text-bone/85">
                    <li>· This report attaches to your new account automatically</li>
                    <li>· Free plan: 3 scans a month, zip uploads included</li>
                    <li>· Same guarantee — source deleted after every scan</li>
                  </ul>
                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    <ButtonLink
                      href="/signup"
                      className="!border-transparent !bg-sheet px-6 py-3 !text-ink hover:!bg-bone"
                    >
                      Create free account
                    </ButtonLink>
                    <Link href="/login" className="u-link text-sm text-bone hover:!text-sheet">
                      I already have one — sign in
                    </Link>
                  </div>
                </div>
              </section>
            )}

            {/* Open findings — medium & low, in full */}
            {scan.unlocked.length > 0 && (
              <section>
                <div className="rule-index pt-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-lg font-semibold tracking-tight">
                      Open — {scan.unlocked.length}{' '}
                      {scan.unlocked.length === 1 ? 'finding' : 'findings'}
                    </h2>
                    <p className="text-sm text-ink-soft">
                      Medium and low severity — yours to read now, on the house.
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <FindingsBrowser
                    findings={scan.unlocked.map((f) => ({
                      ...f,
                      typeLabel: CHECK_NAMES[f.checkType] ?? f.checkType,
                    }))}
                  />
                </div>
              </section>
            )}

            {/* Entirely clean */}
            {lockedCount === 0 && scan.unlocked.length === 0 && (
              <Card className="py-14 text-center">
                <StampIn>
                  <span className="tag tag--safe text-base">Clear · no findings</span>
                </StampIn>
                <p className="prose-serif mx-auto mt-6 max-w-lg text-[15px] text-ink-soft">
                  None of our five checks flagged anything. Automated checks can&apos;t prove an
                  app is secure — this is a good sign, not a guarantee. Create a free account to
                  keep this report and re-scan after every change.
                </p>
                <div className="mt-6 flex justify-center">
                  <ButtonLink href="/signup">Create free account</ButtonLink>
                </div>
              </Card>
            )}

            <p className="rule-hair pt-5 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-ink-mute">
              Preview link — not indexed, goes private once claimed ∎
            </p>
          </>
        )}
      </div>
    </div>
  );
}
