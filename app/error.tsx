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
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div aria-hidden className="graph graph--fade" />
        <span className="tag tag--wax stamp-in relative text-lg sm:text-xl">Incident report</span>
        <h1 className="display mt-8 text-4xl">
          Something <em className="text-ink-soft">went wrong.</em>
        </h1>
        <p className="prose-serif mx-auto mt-4 max-w-sm text-[15px] text-ink-soft">
          Sorry about that — it&apos;s on us, not you. Try again; if it keeps happening, come
          back in a few minutes.
        </p>
        {error.digest && (
          <p className="mono-tight mt-3 font-mono text-xs text-ink-mute">
            Error reference: {error.digest}
          </p>
        )}
        <div className="mt-8">
          <Button onClick={reset}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
