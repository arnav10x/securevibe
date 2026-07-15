import { createClient } from '@/lib/supabase/server';
import { Alert, Card } from '@/components/ui';
import { ManageBillingButton, UpgradeButton } from '@/components/billing-buttons';
import { FREE_SCANS_PER_MONTH, startOfMonthUtc } from '@/lib/quota';
import { billingConfigured } from '@/lib/stripe';

export const metadata = { title: 'Account — SecureVibe' };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { count: usedThisMonth }, { data: subscription }] = await Promise.all([
    supabase.from('profiles').select('plan, email, stripe_customer_id').eq('id', user!.id).single(),
    supabase
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'failed')
      .gte('created_at', startOfMonthUtc().toISOString()),
    supabase
      .from('subscriptions')
      .select('status, current_period_end, cancel_at_period_end')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const plan = profile?.plan ?? 'free';

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Account</h1>

      {checkout === 'success' && (
        <Alert tone="success">
          Payment received — welcome to Pro! 🎉 It can take a few seconds for your plan to update;
          refresh if it still shows Free.
        </Alert>
      )}

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Your plan</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-400">Email</dt>
            <dd>{profile?.email ?? user!.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Plan</dt>
            <dd className="font-semibold">
              {plan === 'pro' ? '⭐ Pro — unlimited scans' : 'Free'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Scans this month</dt>
            <dd>
              {usedThisMonth ?? 0}
              {plan === 'free' ? ` of ${FREE_SCANS_PER_MONTH}` : ''}
            </dd>
          </div>
          {subscription?.current_period_end && (
            <div className="flex justify-between">
              <dt className="text-slate-400">
                {subscription.cancel_at_period_end ? 'Pro ends' : 'Renews'}
              </dt>
              <dd>{new Date(subscription.current_period_end).toLocaleDateString()}</dd>
            </div>
          )}
        </dl>

        <div className="mt-6">
          {!billingConfigured() ? (
            <Alert tone="info">
              Billing isn&apos;t configured yet (Stripe keys missing). The free plan works
              normally — see the README to enable subscriptions.
            </Alert>
          ) : plan === 'free' ? (
            <UpgradeButton />
          ) : (
            <ManageBillingButton />
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-semibold">Your data</h2>
        <p className="text-sm leading-relaxed text-slate-400">
          We never keep your source code — it is deleted the moment each scan finishes. Reports
          (findings only) stay until you delete them. To close your account and erase everything,
          email{' '}
          <a href="mailto:privacy@securevibe.app" className="text-emerald-400 hover:underline">
            privacy@securevibe.app
          </a>
          .
        </p>
      </Card>
    </div>
  );
}
