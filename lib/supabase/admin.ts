// Supabase ADMIN client — bypasses Row Level Security. Server-only.
//
// Used exclusively by:
//  - the Stripe webhook (updating plans/subscriptions — no user session there)
//  - the cleanup cron (sweeping orphaned uploads)
//  - the package-check cache writer
//
// Everything else (scans, findings, uploads) runs as the signed-in user
// under RLS, on purpose: less power lying around = less to get wrong.

import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      'SUPABASE_SECRET_KEY is not set. Billing and cron features need it — ' +
        'see the README ("Environment variables") for where to get it.',
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** True when the admin features are configured (billing, cron). */
export function adminConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SECRET_KEY);
}
