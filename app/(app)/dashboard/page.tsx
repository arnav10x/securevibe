import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ButtonLink, Card, SeverityBadge } from '@/components/ui';
import { FREE_SCANS_PER_MONTH, startOfMonthUtc } from '@/lib/quota';

export const metadata = { title: 'Dashboard — SecureVibe' };

const STATUS_LABELS: Record<string, string> = {
  queued: '⏳ Queued',
  running: '🔎 Scanning…',
  completed: '✅ Completed',
  failed: '⚠️ Failed',
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: scans }, { count: usedThisMonth }] = await Promise.all([
    supabase.from('profiles').select('plan').eq('id', user!.id).single(),
    supabase
      .from('scans')
      .select('id, source_ref, source_type, status, created_at, stats')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'failed')
      .gte('created_at', startOfMonthUtc().toISOString()),
  ]);

  const plan = profile?.plan ?? 'free';
  const used = usedThisMonth ?? 0;
  const outOfScans = plan === 'free' && used >= FREE_SCANS_PER_MONTH;

  // Findings counts per scan for the severity chips.
  const scanIds = (scans ?? []).map((s) => s.id);
  const severityByScan = new Map<string, Record<string, number>>();
  if (scanIds.length > 0) {
    const { data: findingRows } = await supabase
      .from('findings')
      .select('scan_id, severity')
      .in('scan_id', scanIds);
    for (const row of findingRows ?? []) {
      const counts = severityByScan.get(row.scan_id) ?? {};
      counts[row.severity] = (counts[row.severity] ?? 0) + 1;
      severityByScan.set(row.scan_id, counts);
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Your scans</h1>
          <p className="mt-1 text-sm text-slate-400">
            {plan === 'pro' ? (
              <>Pro plan — unlimited scans. {used} run this month.</>
            ) : (
              <>
                Free plan — {used} of {FREE_SCANS_PER_MONTH} scans used this month.
              </>
            )}
          </p>
        </div>
        <ButtonLink href="/scans/new">+ New scan</ButtonLink>
      </div>

      {outOfScans && (
        <Card className="mb-6 border-emerald-500/40">
          <p className="text-sm text-slate-200">
            You&apos;ve used all {FREE_SCANS_PER_MONTH} free scans this month.{' '}
            <Link href="/account" className="font-semibold text-emerald-400 hover:text-emerald-300">
              Upgrade to Pro
            </Link>{' '}
            for unlimited scans, or come back on the 1st.
          </p>
        </Card>
      )}

      {(scans ?? []).length === 0 ? (
        <Card className="text-center">
          <p className="text-4xl" aria-hidden>
            🔍
          </p>
          <h2 className="mt-3 text-lg font-semibold">No scans yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            Point SecureVibe at a public GitHub repo or upload a zip of your project, and get a
            plain-English security report in about a minute.
          </p>
          <div className="mt-5">
            <ButtonLink href="/scans/new">Run your first scan</ButtonLink>
          </div>
        </Card>
      ) : (
        <ul className="space-y-3">
          {(scans ?? []).map((scan) => {
            const counts = severityByScan.get(scan.id) ?? {};
            return (
              <li key={scan.id}>
                <Link
                  href={`/scans/${scan.id}`}
                  className="block rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-colors hover:border-slate-600"
                >
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="font-medium">
                      {scan.source_type === 'github' ? '📦' : '🗜️'} {scan.source_ref}
                    </span>
                    <span className="text-sm text-slate-400">
                      {STATUS_LABELS[scan.status] ?? scan.status}
                    </span>
                    <span className="ml-auto text-sm text-slate-500">
                      {new Date(scan.created_at).toLocaleString()}
                    </span>
                  </div>
                  {scan.status === 'completed' && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {(['critical', 'high', 'medium', 'low'] as const).map((sev) =>
                        counts[sev] ? (
                          <span key={sev} className="flex items-center gap-1.5 text-sm">
                            <SeverityBadge severity={sev} /> {counts[sev]}
                          </span>
                        ) : null,
                      )}
                      {Object.keys(counts).length === 0 && (
                        <span className="text-sm text-emerald-400">
                          ✨ No issues found by our checks
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
