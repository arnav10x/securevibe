// Layout for everything behind login. The proxy already redirects
// signed-out visitors; this check is the server-side belt-and-suspenders.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';
import { Logo, IconLogout } from '@/components/icons';

const NAV = [
  ['/dashboard', 'Dashboard'],
  ['/scans/new', 'New scan'],
  ['/account', 'Account'],
] as const;

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-paper text-ink">

      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-paper/92 backdrop-blur-sm">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-7 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/dashboard" aria-label="SecureVibe dashboard">
            <Logo />
          </Link>
          <div className="flex items-center gap-5 text-[13.5px] font-medium text-ink-soft">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className="u-link transition-colors hover:text-ink">
                {label}
              </Link>
            ))}
          </div>
          <form action="/auth/signout" method="post" className="ml-auto">
            <button
              className="flex cursor-pointer items-center gap-1.5 text-[13.5px] text-ink-mute transition-colors hover:text-ink"
              type="submit"
            >
              <IconLogout className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <main className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
