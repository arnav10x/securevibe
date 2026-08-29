import Link from 'next/link';
import type { ReactNode } from 'react';
import { GuillocheField } from '@/components/guilloche';
import { Logo } from '@/components/icons';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-paper">
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-12">
        {/* The rose blooms in behind the card on first paint, then keeps
            turning — the same engraving that opens the landing page. */}
        <GuillocheField
          size={680}
          fade={[55, 98]}
          opacity={0.5}
          enter
          className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        />
        <Link href="/" className="relative mb-8" aria-label="SecureVibe home">
          <Logo />
        </Link>
        <div className="relative w-full max-w-md">{children}</div>
        <p className="label label--bare relative mt-8">Code deleted after every scan</p>
      </div>
    </div>
  );
}
