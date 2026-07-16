// Layout for the public site: floating glass nav on top, editorial footer below.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';
import { ButtonLink } from '@/components/ui';
import { Logo, LogoMark } from '@/components/icons';

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col bg-ink text-fg">
      {/* Floating glass navigation */}
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
        <nav className="glass mx-auto flex max-w-6xl items-center gap-x-6 rounded-2xl px-4 py-2.5 sm:px-5">
          <Link href="/" className="shrink-0 rounded-lg" aria-label="SecureVibe home">
            <Logo />
          </Link>
          <div className="hidden items-center gap-6 text-sm text-fg-dim md:flex">
            <Link href="/#how-it-works" className="transition-colors hover:text-fg">
              How it works
            </Link>
            <Link href="/#checks" className="transition-colors hover:text-fg">
              What we check
            </Link>
            <Link href="/#pricing" className="transition-colors hover:text-fg">
              Pricing
            </Link>
            <Link href="/#faq" className="transition-colors hover:text-fg">
              FAQ
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-2.5 sm:gap-4">
            {user ? (
              <ButtonLink href="/dashboard" className="px-4 py-2 text-[13px]">
                Dashboard
              </ButtonLink>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg text-sm text-fg-dim transition-colors hover:text-fg"
                >
                  Sign in
                </Link>
                <ButtonLink href="/signup" className="px-4 py-2 text-[13px]">
                  Get started free
                </ButtonLink>
              </>
            )}
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="relative overflow-hidden border-t border-[var(--line)]">
        {/* Giant ghosted mark anchors the footer like a colophon */}
        <LogoMark
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 text-signal opacity-[0.045]"
        />
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-10">
            <div className="max-w-xs">
              <Logo />
              <p className="mt-4 text-sm leading-relaxed text-fg-dim">
                A pre-launch security checkup for apps built with AI coding tools. Scan, read
                the plain-English report, launch with confidence.
              </p>
              <p className="kicker mt-6">Code deleted after every scan</p>
            </div>
            <nav className="flex flex-wrap gap-x-16 gap-y-8 text-sm">
              <div className="space-y-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-fg-mute">
                  Product
                </p>
                <ul className="space-y-2.5 text-fg-dim">
                  <li>
                    <Link href="/#pricing" className="transition-colors hover:text-fg">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link href="/signup" className="transition-colors hover:text-fg">
                      Get started
                    </Link>
                  </li>
                  <li>
                    <Link href="/security" className="transition-colors hover:text-fg">
                      Security &amp; disclosure
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-fg-mute">
                  Legal
                </p>
                <ul className="space-y-2.5 text-fg-dim">
                  <li>
                    <Link href="/privacy" className="transition-colors hover:text-fg">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms" className="transition-colors hover:text-fg">
                      Terms of Service
                    </Link>
                  </li>
                  <li>
                    <Link href="/refunds" className="transition-colors hover:text-fg">
                      Refund Policy
                    </Link>
                  </li>
                </ul>
              </div>
            </nav>
          </div>
          <p className="mt-12 border-t border-[var(--line)] pt-6 text-xs leading-relaxed text-fg-mute">
            © {new Date().getFullYear()} SecureVibe. SecureVibe is an automated review tool — it
            does not guarantee your app is secure and is not a substitute for a professional
            security audit.
          </p>
        </div>
      </footer>
    </div>
  );
}
