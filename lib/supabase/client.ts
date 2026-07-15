// Supabase client for BROWSER code ('use client' components).
// Uses the publishable key — safe to expose; Row Level Security is what
// actually protects the data.

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
