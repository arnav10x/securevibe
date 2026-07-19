import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/icons';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div aria-hidden className="graph graph--fade" />
        <Link href="/" className="relative mb-8" aria-label="SecureVibe home">
          <Logo />
        </Link>
        <div className="relative w-full max-w-md">{children}</div>
        <p className="label label--bare relative mt-8">Code deleted after every scan</p>
      </div>
    </div>
  );
}
