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
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: {updated}</p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-300 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-100 [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-slate-100 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6 [&_strong]:text-slate-100">
        {children}
      </div>
    </article>
  );
}
