// Supabase client for SERVER code (server components, route handlers).
// It reads the user's session from cookies, so database calls run AS the
// user — Row Level Security applies exactly as it would in the browser.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component (no response to write to).
            // Safe to ignore: the proxy refreshes sessions.
          }
        },
      },
    },
  );
}
