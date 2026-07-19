import Link from 'next/link';
import { ButtonLink } from '@/components/ui';
import { IconArrowRight } from '@/components/icons';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div aria-hidden className="graph graph--fade" />
        <span className="tag stamp-in relative text-xl sm:text-2xl">Not on the chart</span>
        <p className="label label--bare mt-8 justify-center">Error 404</p>
        <h1 className="display mt-3 text-4xl">
          Page <em className="text-ink-soft">not found.</em>
        </h1>
        <p className="prose-serif mx-auto mt-4 max-w-sm text-[15px] text-ink-soft">
          This page doesn&apos;t exist — or you don&apos;t have access to it.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <ButtonLink href="/">Go home</ButtonLink>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-2 py-2.5 text-sm text-ink-soft transition-colors hover:text-ink"
          >
            My dashboard <IconArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
