// Handles redirects from Supabase auth emails (signup confirmation,
// password reset). Exchanges the one-time ?code= for a real session,
// then forwards the user onward.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/dashboard';

  // Only allow same-site relative redirects.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, url.origin));
    }
  }

  return NextResponse.redirect(
    new URL(
      '/login?message=' +
        encodeURIComponent('That link is invalid or has expired. Please try again.'),
      url.origin,
    ),
  );
}
