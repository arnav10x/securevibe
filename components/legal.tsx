// Shared wrapper + typography for legal pages — set like the appendices
// of a flight manual: numbered, ruled, plainly worded.

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
    <article className="mx-auto max-w-3xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
      <p className="label">Legal</p>
      <h1 className="display mt-5 text-4xl">{title}</h1>
      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute">
        Last updated: {updated}
      </p>
      <div className="rule-index mt-8" />
      <div className="prose-serif mt-8 space-y-6 text-[15px] text-ink-soft [&_a]:u-link [&_a]:text-verdant-ink [&_h2]:mt-10 [&_h2]:font-sans [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:font-sans [&_h3]:font-semibold [&_h3]:text-ink [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6">
        {children}
      </div>
      <p className="rule-hair mt-12 pt-5 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-ink-mute">
        End of document ∎
      </p>
    </article>
  );
}
