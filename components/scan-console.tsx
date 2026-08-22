'use client';

// The scan desk: a working instrument on the landing page, struck in
// near-black — the one dark object on the paper-white page, so the eye
// lands on it first. Paste a public GitHub repo URL, run the pass,
// and get the teaser verdict inline — no account needed. Critical/high
// findings come back sealed; the full report opens behind a free account
// (the API sets a claim cookie so the new account adopts this scan).

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ButtonLink, SeverityBadge } from '@/components/ui';
import { IconArrowRight, IconLock, IconSparkle } from '@/components/icons';

interface Teaser {
  id: string;
  status: string;
  sourceRef: string;
  tally: Record<string, number>;
  unlocked: { id: string; title: string; severity: string }[];
  locked: { severity: string }[];
  stats?: {
    report?: {
      securityGrade: string;
      securityScore: number;
      securityCapReason: string | null;
      insufficientSignal: boolean;
      craftScore: number;
      vibeScore: number;
    };
  };
}

type Phase = 'idle' | 'running' | 'done' | 'failed';

// Honest stage labels, revealed on a clock while the single server pass
// runs. If the scan finishes early we jump straight to the verdict.
const STAGES: [number, string][] = [
  [0, 'Acquiring source (isolated workspace)'],
  [6, 'Secrets sweep'],
  [14, 'Platform config audit'],
  [24, 'Dependency registry check'],
  [36, 'Insecure pattern analysis'],
  [46, 'Design audit · vibe check'],
  [56, 'Grading · writing report · purging source'],
];

export function ScanConsole() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [rights, setRights] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState(false);
  const [teaser, setTeaser] = useState<Teaser | null>(null);
  const [failedScanId, setFailedScanId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // The running clock that paces the stage readout.
  useEffect(() => {
    if (phase !== 'running') return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 250);
    return () => clearInterval(timer);
  }, [phase]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLimitHit(false);
    setTeaser(null);
    setFailedScanId(null);
    setElapsed(0);
    setPhase('running');

    try {
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceType: 'github', url }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        // Signed-in users go straight to their full report.
        if (!data.anon) {
          router.push(`/scans/${data.id}`);
          return;
        }
        const teaserRes = await fetch(`/api/scans/${data.id}/public`, { cache: 'no-store' });
        if (teaserRes.ok) {
          setTeaser(await teaserRes.json());
          setPhase('done');
          return;
        }
        // Teaser unavailable (edge case) — the preview page will have it.
        router.push(`/r/${data.id}`);
        return;
      }

      setPhase('failed');
      if (res.status === 429 || res.status === 402) setLimitHit(true);
      if (data.id) setFailedScanId(data.id);
      setError(data.error ?? 'Something went wrong. Please try again.');
    } catch {
      setPhase('failed');
      setError('Something went wrong. Please check your connection and try again.');
    }
  }

  function reset() {
    setPhase('idle');
    setError(null);
    setTeaser(null);
    setFailedScanId(null);
    // Let the state settle, then put the cursor back on the ledger line.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  const stageIndex = STAGES.reduce((acc, [at], i) => (elapsed >= at ? i : acc), 0);
  const lockedCount = teaser?.locked.length ?? 0;
  const openCount = teaser?.unlocked.length ?? 0;
  const clean = teaser && lockedCount === 0 && openCount === 0;

  return (
    <div className="plate plate--ultra overflow-hidden">
      <style>{`
        .csl-caret { animation: csl-blink 1.1s steps(2, jump-none) infinite; }
        @keyframes csl-blink { 50% { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .csl-caret { animation: none; } }
      `}</style>

      {/* Console header */}
      <div className="flex items-center justify-between gap-4 border-b border-[var(--line-bone)] px-5 py-3">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-bone/85">
          Scan desk — live
        </span>
        <span className="flex items-center gap-2" aria-hidden>
          <span className="h-2 w-2 rounded-full bg-safe" />
          <span
            className={`h-2 w-2 rounded-full bg-signal ${phase === 'running' ? 'csl-caret' : 'opacity-30'}`}
          />
          <span className="h-2 w-2 rounded-full bg-bone/30" />
        </span>
      </div>

      <div className="p-5 sm:p-7">
        {/* ---- Input row ---- */}
        {(phase === 'idle' || phase === 'failed') && (
          <form onSubmit={run}>
            <label
              htmlFor="desk-url"
              className="mono-tight font-mono text-[10px] uppercase tracking-[0.18em] text-bone/60"
            >
              Public GitHub repository URL
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input
                ref={inputRef}
                id="desk-url"
                type="url"
                required
                placeholder="https://github.com/you/your-app"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full rounded-xl border border-bone/20 bg-ultra-deep px-4 py-3.5 font-mono text-sm text-bone placeholder:text-bone/40 focus:border-bone/50 focus:outline-none focus:ring-2 focus:ring-bone/20"
              />
              <button
                type="submit"
                className="ctl inline-flex shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-full border border-transparent bg-sheet px-7 py-3.5 text-[14px] font-semibold text-ink shadow-[0_10px_24px_-10px_rgba(0,0,0,0.7)] hover:bg-bone"
              >
                Run the scan
                <IconArrowRight className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-bone/80">
              <input
                type="checkbox"
                required
                checked={rights}
                onChange={(e) => setRights(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[#131313]"
              />
              <span>I have the right to submit this code for analysis.</span>
            </label>

            {error && (
              <div className="mt-4 rounded-lg border border-signal/70 bg-ultra-deep px-4 py-3 text-sm leading-relaxed text-bone">
                {error}{' '}
                {limitHit && (
                  <Link href="/signup" className="u-link font-semibold text-bone hover:text-bone">
                    Create a free account →
                  </Link>
                )}
                {failedScanId && !limitHit && (
                  <Link
                    href={`/r/${failedScanId}`}
                    className="u-link font-semibold text-bone hover:text-bone"
                  >
                    See details →
                  </Link>
                )}
              </div>
            )}
          </form>
        )}

        {/* ---- Running readout ---- */}
        {phase === 'running' && (
          <div aria-live="polite">
            <div className="flex items-baseline justify-between gap-4">
              <p className="mono-tight break-all font-mono text-sm font-semibold text-bone">
                {url.replace(/^https?:\/\//, '')}
              </p>
              <p className="font-mono text-[11px] tabular-nums text-bone/60">
                T+{elapsed.toFixed(0)}s
              </p>
            </div>
            <ol className="mt-5 space-y-2.5 font-mono text-[12px] leading-relaxed">
              {STAGES.map(([, label], i) => (
                <li
                  key={label}
                  className={`flex items-center gap-3 ${
                    i < stageIndex
                      ? 'text-bone/50'
                      : i === stageIndex
                        ? 'text-bone'
                        : 'text-bone/25'
                  }`}
                >
                  <span aria-hidden className="w-3 text-center">
                    {i < stageIndex ? '·' : i === stageIndex ? <span className="csl-caret">▸</span> : ' '}
                  </span>
                  <span className="uppercase tracking-[0.12em]">{label}</span>
                  {i < stageIndex && <span className="text-bone/60">ok</span>}
                </li>
              ))}
            </ol>
            <div className="mt-6 h-1 overflow-hidden rounded-full bg-bone/15">
              <div className="h-full w-1/4 rounded-full bg-bone [animation:scan-bar_1.6s_linear_infinite]" />
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-bone/70">
              Bigger repos take a minute or two — keep this tab open. The source is destroyed the
              moment the report is written.
            </p>
          </div>
        )}

        {/* ---- Verdict ---- */}
        {phase === 'done' && teaser && (
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="mono-tight break-all font-mono text-sm font-semibold text-bone">
                {teaser.sourceRef}
              </p>
              <button
                type="button"
                onClick={reset}
                className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.14em] text-bone/60 underline underline-offset-4 hover:text-bone"
              >
                Scan another
              </button>
            </div>

            {teaser.stats?.report && (
              <div className="mt-5 rounded-xl bg-ultra-deep px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <span className="flex items-baseline gap-2.5">
                    <span className="display text-4xl leading-none text-bone">
                      {teaser.stats.report.securityGrade}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone/60">
                      Security grade
                    </span>
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-bone/80">
                    {teaser.stats.report.insufficientSignal
                      ? 'not enough code to grade'
                      : `Security ${teaser.stats.report.securityScore} · Craft ${teaser.stats.report.craftScore} · Vibe ${teaser.stats.report.vibeScore}/100`}
                  </span>
                </div>
                {teaser.stats.report.securityCapReason && (
                  <p className="mt-2 font-mono text-[10.5px] leading-snug text-signal">
                    {teaser.stats.report.securityCapReason}
                  </p>
                )}
              </div>
            )}

            {clean ? (
              <p className="mt-5 flex items-center gap-2.5 text-sm text-bone">
                <IconSparkle className="h-4 w-4 text-safe" /> No issues found by our five
                checks — a good sign, not a guarantee.
              </p>
            ) : (
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2.5">
                {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
                  const n = teaser.tally[sev] ?? 0;
                  if (n === 0) return null;
                  const sealed = sev === 'critical' || sev === 'high';
                  return (
                    <span
                      key={sev}
                      className="flex items-center gap-2.5 rounded-xl bg-sheet px-3 py-1.5 shadow-[0_2px_5px_rgba(0,0,0,0.35)]"
                    >
                      <span className="display text-xl tabular-nums text-ink">{n}</span>
                      <SeverityBadge severity={sev} />
                      {sealed && <IconLock className="h-3.5 w-3.5 text-ink-mute" />}
                    </span>
                  );
                })}
              </div>
            )}

            {lockedCount > 0 && (
              <p className="mt-4 text-[14px] leading-relaxed text-bone/85">
                <strong className="font-semibold text-bone">
                  {lockedCount} {lockedCount === 1 ? 'finding' : 'findings'} sealed.
                </strong>{' '}
                Critical &amp; high severity open with a free account — this scan attaches to it
                automatically.
              </p>
            )}
            {openCount > 0 && (
              <p className="mt-2 text-[14px] leading-relaxed text-bone/70">
                {openCount} medium/low {openCount === 1 ? 'finding is' : 'findings are'} open in
                the preview now.
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-4">
              {lockedCount > 0 ? (
                <>
                  <ButtonLink
                    href="/signup"
                    className="!border-transparent !bg-sheet px-6 py-3 !text-ink hover:!bg-bone"
                  >
                    Break the seal — free
                  </ButtonLink>
                  <Link
                    href={`/r/${teaser.id}`}
                    className="u-link inline-flex items-center gap-1.5 text-sm text-bone hover:text-bone"
                  >
                    Open the preview <IconArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </>
              ) : (
                <ButtonLink
                  href={`/r/${teaser.id}`}
                  className="!border-transparent !bg-sheet px-6 py-3 !text-ink hover:!bg-bone"
                >
                  Open the report preview
                  <IconArrowRight className="h-4 w-4" />
                </ButtonLink>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Console footer */}
      <div className="mono-tight flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[var(--line-bone)] px-5 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-bone/60">
        <span>Public repos · no signup · nothing installed</span>
        <Link href="/signup" className="text-bone/85 underline underline-offset-2 hover:text-bone">
          Zip upload → free account
        </Link>
      </div>
    </div>
  );
}
