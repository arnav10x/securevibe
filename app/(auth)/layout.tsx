import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/icons';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink px-4 py-12">
      {/* Quiet signal glow — sets the scene without any JS */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(45% 40% at 50% 0%, rgba(54,226,168,0.1), transparent 70%)',
        }}
      />
      <div className="grid-bg absolute inset-0" aria-hidden />

      <Link href="/" className="relative mb-8 rounded-lg" aria-label="SecureVibe home">
        <Logo />
      </Link>
      <div className="relative w-full max-w-md">{children}</div>
      <p className="relative mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-fg-mute">
        Code deleted after every scan
      </p>
    </div>
  );
}
