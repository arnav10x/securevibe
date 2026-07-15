'use client';

// Graceful error boundary for anything that throws while rendering.

import { Button } from '@/components/ui';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
      <p className="text-6xl" aria-hidden>
        ⚠️
      </p>
      <h1 className="mt-6 text-3xl font-bold">Something went wrong</h1>
      <p className="mt-3 max-w-sm text-slate-400">
        Sorry about that — it&apos;s on us, not you. Try again; if it keeps happening, come back
        in a few minutes.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-slate-600">Error reference: {error.digest}</p>
      )}
      <div className="mt-8">
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
