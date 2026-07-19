import Link from 'next/link';
import type { ReactNode } from 'react';
import { Guilloche } from '@/components/guilloche';
import { Logo } from '@/components/icons';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-paper">
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-12">
        {/* The rose blooms in behind the card on first paint, then keeps
            turning — the same engraving that opens the landing page. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[680px] w-[680px] -translate-x-1/2 -translate-y-1/2"
          style={{ maskImage: 'radial-gradient(closest-side, black 55%, transparent 98%)' }}
        >
          <div className="rose-enter h-full w-full">
            <Guilloche opacity={0.5} />
          </div>
        </div>
        <Link href="/" className="relative mb-8" aria-label="SecureVibe home">
          <Logo />
        </Link>
        <div className="relative w-full max-w-md">{children}</div>
        <p className="label label--bare relative mt-8">Code deleted after every scan</p>
      </div>
    </div>
  );
}
