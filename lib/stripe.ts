// Stripe helpers. All payment UI is hosted BY Stripe (Checkout + Customer
// Portal) — card data never touches this app, which is what keeps our
// compliance surface near zero.

import Stripe from 'stripe';

export function billingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set — see the README ("Billing setup").');
  }
  if (!cached) {
    cached = new Stripe(key);
  }
  return cached;
}

/** Statuses that grant Pro access. */
export function statusGrantsPro(status: string): boolean {
  return status === 'active' || status === 'trialing';
}
