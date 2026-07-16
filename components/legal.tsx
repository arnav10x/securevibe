// Shared wrapper + typography for legal pages.

import type { ReactNode } from 'react';

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-16 pt-32 sm:px-6 sm:pt-36">
      <p className="kicker">Legal</p>
      <h1 className="display mt-3 text-4xl">{title}</h1>
      <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-fg-mute">
        Last updated: {updated}
      </p>
      <div className="mt-10 space-y-6 text-sm leading-relaxed text-fg-dim [&_a]:text-signal [&_a:hover]:text-signal-bright [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-fg [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-fg [&_strong]:text-fg [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6">
        {children}
      </div>
    </article>
  );
}
