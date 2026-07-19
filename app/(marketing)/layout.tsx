// Layout for the public site: a letterhead masthead on top, an engraved
// colophon below. The masthead floats on blurred bone paper with a single
// hairline — the page itself is the ornament, the chrome stays quiet.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';
import { ButtonLink } from '@/components/ui';
import { Rosette } from '@/components/ornament';
import { Logo } from '@/components/icons';

const NAV_LINKS = [
  ['/#scan-desk', 'Scan now'],
  ['/#checks', 'What we check'],
  ['/#pricing', 'Pricing'],
  ['/#faq', 'FAQ'],
] as const;

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-paper/90 backdrop-blur-md">
        <nav className="mx-auto flex max-w-screen-2xl items-center gap-x-8 px-4 py-3.5 sm:px-8">
          <Link href="/" className="shrink-0" aria-label="SecureVibe home">
            <Logo />
          </Link>
          <div className="hidden items-center gap-6 text-[13.5px] font-medium text-ink-soft md:flex">
            {NAV_LINKS.map(([href, label]) => (
              <Link key={href} href={href} className="u-link transition-colors hover:text-ink">
                {label}
              </Link>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3 sm:gap-5">
            {user ? (
              <ButtonLink href="/dashboard" className="px-4 py-2 text-[13px]">
                Dashboard
              </ButtonLink>
            ) : (
              <>
                <Link
                  href="/login"
                  className="u-link text-[13.5px] font-medium text-ink-soft transition-colors hover:text-ink"
                >
                  Sign in
                </Link>
                <ButtonLink href="/signup" className="px-4 py-2 text-[13px]">
                  Get started
                </ButtonLink>
              </>
            )}
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      {/* The colophon */}
      <footer className="mt-20">
        <div aria-hidden className="hazard-rule" />
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-10 py-12">
            <div className="max-w-xs">
              <Logo />
              <p className="prose-serif mt-4 text-[15px] text-ink-soft">
                A pre-launch security checkup for apps built with AI coding tools. Scan, read
                the plain-English report, launch with confidence.
              </p>
              <p className="tag tag--safe mt-6 text-[10px]">Code deleted after every scan</p>
            </div>
            <nav className="flex flex-wrap gap-x-16 gap-y-8 text-sm">
              <div className="space-y-3">
                <p className="label label--bare">Product</p>
                <ul className="space-y-2.5 text-ink-soft">
                  <li>
                    <Link href="/#pricing" className="u-link hover:text-ink">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link href="/signup" className="u-link hover:text-ink">
                      Get started
                    </Link>
                  </li>
                  <li>
                    <Link href="/security" className="u-link hover:text-ink">
                      Security &amp; disclosure
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <p className="label label--bare">Legal</p>
                <ul className="space-y-2.5 text-ink-soft">
                  <li>
                    <Link href="/privacy" className="u-link hover:text-ink">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms" className="u-link hover:text-ink">
                      Terms of Service
                    </Link>
                  </li>
                  <li>
                    <Link href="/refunds" className="u-link hover:text-ink">
                      Refund Policy
                    </Link>
                  </li>
                </ul>
              </div>
            </nav>
            <Rosette className="hidden h-24 w-24 text-ink/30 lg:block" petals={12} />
          </div>
          <div className="rule-hair flex flex-wrap items-center justify-between gap-3 py-6">
            <p className="max-w-3xl text-xs leading-relaxed text-ink-mute">
              © {new Date().getFullYear()} SecureVibe. SecureVibe is an automated review tool —
              it does not guarantee your app is secure and is not a substitute for a
              professional security audit.
            </p>
            <p className="mono-tight font-mono text-[10px] uppercase tracking-[0.24em] text-ink-mute">
              Machine-turned · zero bytes retained ∎
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
