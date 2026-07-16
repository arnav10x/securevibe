// Layout for everything behind login. The proxy already redirects
// signed-out visitors; this check is the server-side belt-and-suspenders.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';
import { Logo, IconLogout } from '@/components/icons';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-ink text-fg">
      {/* Soft signal glow at the very top of the app — sets the mood without noise */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-64"
        style={{
          background:
            'radial-gradient(50% 100% at 50% 0%, rgba(54,226,168,0.07), transparent 75%)',
        }}
      />

      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-ink/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-7 gap-y-2 px-4 py-3.5 sm:px-6">
          <Link href="/dashboard" className="rounded-lg" aria-label="SecureVibe dashboard">
            <Logo />
          </Link>
          <div className="flex items-center gap-5 text-sm text-fg-dim">
            <Link href="/dashboard" className="transition-colors hover:text-fg">
              Dashboard
            </Link>
            <Link href="/scans/new" className="transition-colors hover:text-fg">
              New scan
            </Link>
            <Link href="/account" className="transition-colors hover:text-fg">
              Account
            </Link>
          </div>
          <form action="/auth/signout" method="post" className="ml-auto">
            <button
              className="flex cursor-pointer items-center gap-1.5 rounded-lg text-sm text-fg-mute transition-colors hover:text-fg"
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
