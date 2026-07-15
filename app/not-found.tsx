import Link from 'next/link';
import { ButtonLink } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
      <p className="text-6xl" aria-hidden>
        🔍
      </p>
      <h1 className="mt-6 text-3xl font-bold">Page not found</h1>
      <p className="mt-3 max-w-sm text-slate-400">
        This page doesn&apos;t exist — or you don&apos;t have access to it.
      </p>
      <div className="mt-8 flex gap-4">
        <ButtonLink href="/">Go home</ButtonLink>
        <Link
          href="/dashboard"
          className="inline-flex items-center px-4 py-2.5 text-sm text-slate-300 hover:text-white"
        >
          My dashboard →
        </Link>
      </div>
    </div>
  );
}
