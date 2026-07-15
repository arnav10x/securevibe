import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 text-xl font-bold text-slate-100">
        <span aria-hidden>🛡️</span> SecureVibe
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
