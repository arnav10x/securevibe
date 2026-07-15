// POST /api/stripe/portal — open Stripe's hosted Customer Portal
// (update card, cancel subscription, download invoices).

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { billingConfigured, getStripe } from '@/lib/stripe';

export async function POST() {
  if (!billingConfigured()) {
    return NextResponse.json(
      { error: 'Billing is not configured on this deployment yet.' },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();
  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: 'No billing history yet — upgrade first.' },
      { status: 400 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const session = await getStripe().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${appUrl}/account`,
  });

  return NextResponse.json({ url: session.url });
}
