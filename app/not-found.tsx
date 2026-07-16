import Link from 'next/link';
import { ButtonLink } from '@/components/ui';
import { IconArrowRight, IconScan } from '@/components/icons';

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink px-4 text-center text-fg">
      <div className="grid-bg absolute inset-0" aria-hidden />
      <div className="relative">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-signal/25 bg-signal/10 text-signal shadow-[0_0_36px_rgba(54,226,168,0.2)]">
          <IconScan className="h-7 w-7" />
        </span>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.24em] text-fg-mute">
          Error 404
        </p>
        <h1 className="display mt-3 text-4xl">
          Page <em className="serif-accent">not found.</em>
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-fg-dim">
          This page doesn&apos;t exist — or you don&apos;t have access to it.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <ButtonLink href="/">Go home</ButtonLink>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2.5 text-sm text-fg-dim transition-colors hover:text-fg"
          >
            My dashboard <IconArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
