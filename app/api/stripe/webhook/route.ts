// POST /api/stripe/webhook — Stripe tells us about subscription changes.
//
// This is the ONLY writer of billing state. It verifies the webhook
// signature, then updates profiles.plan and the subscriptions mirror.
// It deliberately never calls the Stripe API — everything it needs is in
// the event payload — which keeps it fast and fully testable offline.

import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, statusGrantsPro } from '@/lib/stripe';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || !process.env.STRIPE_SECRET_KEY || !adminConfigured()) {
    return NextResponse.json({ error: 'Billing not configured.' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (userId && subscriptionId) {
        // Grant Pro right away; the subscription.updated event that follows
        // fills in accurate period/price details.
        await admin.from('profiles').update({ plan: 'pro' }).eq('id', userId);
        await admin.from('subscriptions').upsert(
          {
            user_id: userId,
            stripe_subscription_id: subscriptionId,
            status: 'active',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'stripe_subscription_id' },
        );
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const status =
        event.type === 'customer.subscription.deleted' ? 'canceled' : subscription.status;

      const userId = await resolveUserId(admin, subscription);
      if (!userId) break; // customer we don't know — nothing to update

      await admin.from('subscriptions').upsert(
        {
          user_id: userId,
          stripe_subscription_id: subscription.id,
          status,
          price_id: subscription.items?.data?.[0]?.price?.id ?? null,
          current_period_end: extractPeriodEnd(subscription),
          cancel_at_period_end: subscription.cancel_at_period_end ?? false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'stripe_subscription_id' },
      );
      await admin
        .from('profiles')
        .update({ plan: statusGrantsPro(status) ? 'pro' : 'free' })
        .eq('id', userId);
      break;
    }

    case 'invoice.payment_failed': {
      // Payment failed: mark it, but DON'T revoke Pro yet — Stripe retries,
      // and sends subscription.updated/deleted if it truly lapses.
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = extractInvoiceSubscriptionId(invoice);
      if (subscriptionId) {
        await admin
          .from('subscriptions')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscriptionId);
      }
      break;
    }

    default:
      break; // event types we don't care about — acknowledge and move on
  }

  return NextResponse.json({ received: true });
}

/** Find our user for a subscription: metadata first, then customer lookup. */
async function resolveUserId(
  admin: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromMetadata = subscription.metadata?.user_id;
  if (fromMetadata) return fromMetadata;

  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  if (!customerId) return null;

  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Stripe moved current_period_end from the subscription onto its items in
 * newer API versions — read it from wherever it lives.
 */
function extractPeriodEnd(subscription: Stripe.Subscription): string | null {
  const direct = (subscription as unknown as { current_period_end?: number }).current_period_end;
  const fromItem = (
    subscription.items?.data?.[0] as unknown as { current_period_end?: number }
  )?.current_period_end;
  const epoch = direct ?? fromItem;
  return epoch ? new Date(epoch * 1000).toISOString() : null;
}

/** Same story for the invoice -> subscription link across API versions. */
function extractInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const direct = (invoice as unknown as { subscription?: string | { id: string } }).subscription;
  if (typeof direct === 'string') return direct;
  if (direct?.id) return direct.id;
  const parent = (
    invoice as unknown as {
      parent?: { subscription_details?: { subscription?: string | { id: string } } };
    }
  ).parent?.subscription_details?.subscription;
  if (typeof parent === 'string') return parent;
  return parent?.id ?? null;
}
