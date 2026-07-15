// POST /api/stripe/checkout — start a Stripe Checkout session for Pro.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';
import { billingConfigured, getStripe } from '@/lib/stripe';

export async function POST() {
  if (!billingConfigured() || !adminConfigured()) {
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
    .select('plan, stripe_customer_id, email')
    .eq('id', user.id)
    .single();
  if (profile?.plan === 'pro') {
    return NextResponse.json({ error: 'You are already on Pro. 🎉' }, { status: 400 });
  }

  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // Reuse the Stripe customer if we have one; otherwise create it now and
  // remember it (via the admin client — users can't write their own profile).
  let customerId = profile?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await createAdminClient()
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    subscription_data: { metadata: { user_id: user.id } },
    success_url: `${appUrl}/account?checkout=success`,
    cancel_url: `${appUrl}/account?checkout=cancelled`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
