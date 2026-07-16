'use client';

// Graceful error boundary for anything that throws while rendering.

import { Button } from '@/components/ui';
import { IconAlertTriangle } from '@/components/icons';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink px-4 text-center text-fg">
      <div className="grid-bg absolute inset-0" aria-hidden />
      <div className="relative">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-high/30 bg-high/10 text-high">
          <IconAlertTriangle className="h-7 w-7" />
        </span>
        <h1 className="display mt-6 text-4xl">
          Something <em className="serif-accent">went wrong.</em>
        </h1>
        <p className="mx-auto mt-4 max-w-sm leading-relaxed text-fg-dim">
          Sorry about that — it&apos;s on us, not you. Try again; if it keeps happening, come
          back in a few minutes.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-fg-mute">Error reference: {error.digest}</p>
        )}
        <div className="mt-8">
          <Button onClick={reset}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
