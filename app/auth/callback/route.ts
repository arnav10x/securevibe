// Handles redirects from Supabase auth emails (signup confirmation,
// password reset). Exchanges the one-time ?code= for a real session,
// then forwards the user onward — first adopting any instant scan this
// browser ran before the account existed (the claim cookie), so the
// full report is waiting the moment they arrive.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { CLAIM_COOKIE, parseClaimCookie } from '@/lib/anon';
import { claimScan } from '@/lib/teaser';

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
      // Claim the pre-signup scan, if this browser ran one.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const claim = parseClaimCookie((await cookies()).get(CLAIM_COOKIE)?.value);
      if (user && claim) {
        const claimed = await claimScan(claim.scanId, claim.token, user.id);
        const response = NextResponse.redirect(
          new URL(claimed ? `/scans/${claim.scanId}` : safeNext, url.origin),
        );
        response.cookies.delete(CLAIM_COOKIE);
        return response;
      }
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
