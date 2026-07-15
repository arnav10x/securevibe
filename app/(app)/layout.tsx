// Layout for everything behind login. The proxy already redirects
// signed-out visitors; this check is the server-side belt-and-suspenders.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold">
            <span aria-hidden>🛡️</span> SecureVibe
          </Link>
          <div className="flex items-center gap-4 text-sm text-slate-300">
            <Link href="/dashboard" className="hover:text-white">
              Dashboard
            </Link>
            <Link href="/scans/new" className="hover:text-white">
              New scan
            </Link>
            <Link href="/account" className="hover:text-white">
              Account
            </Link>
          </div>
          <form action="/auth/signout" method="post" className="ml-auto">
            <button className="text-sm text-slate-400 hover:text-white" type="submit">
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
