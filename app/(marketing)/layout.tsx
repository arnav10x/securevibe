// Layout for the public site: marketing nav on top, legal footer below.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';
import { ButtonLink } from '@/components/ui';

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/60">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            <span aria-hidden>🛡️</span> SecureVibe
          </Link>
          <div className="hidden items-center gap-5 text-sm text-slate-300 sm:flex">
            <Link href="/#how-it-works" className="hover:text-white">
              How it works
            </Link>
            <Link href="/#checks" className="hover:text-white">
              What we check
            </Link>
            <Link href="/#pricing" className="hover:text-white">
              Pricing
            </Link>
            <Link href="/#faq" className="hover:text-white">
              FAQ
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <ButtonLink href="/dashboard">Dashboard</ButtonLink>
            ) : (
              <>
                <Link href="/login" className="text-sm text-slate-300 hover:text-white">
                  Sign in
                </Link>
                <ButtonLink href="/signup">Get started free</ButtonLink>
              </>
            )}
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-800/60">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div>
              <p className="flex items-center gap-2 font-bold">
                <span aria-hidden>🛡️</span> SecureVibe
              </p>
              <p className="mt-2 max-w-xs text-sm text-slate-400">
                A pre-launch security checkup for apps built with AI coding tools.
              </p>
            </div>
            <nav className="flex flex-wrap gap-x-10 gap-y-4 text-sm">
              <div className="space-y-2">
                <p className="font-semibold text-slate-300">Product</p>
                <ul className="space-y-1.5 text-slate-400">
                  <li>
                    <Link href="/#pricing" className="hover:text-white">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link href="/signup" className="hover:text-white">
                      Get started
                    </Link>
                  </li>
                  <li>
                    <Link href="/security" className="hover:text-white">
                      Security &amp; disclosure
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-slate-300">Legal</p>
                <ul className="space-y-1.5 text-slate-400">
                  <li>
                    <Link href="/privacy" className="hover:text-white">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms" className="hover:text-white">
                      Terms of Service
                    </Link>
                  </li>
                  <li>
                    <Link href="/refunds" className="hover:text-white">
                      Refund Policy
                    </Link>
                  </li>
                </ul>
              </div>
            </nav>
          </div>
          <p className="mt-8 text-xs text-slate-500">
            © {new Date().getFullYear()} SecureVibe. SecureVibe is an automated review tool — it
            does not guarantee your app is secure and is not a substitute for a professional
            security audit.
          </p>
        </div>
      </footer>
    </div>
  );
}
