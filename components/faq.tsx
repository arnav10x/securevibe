'use client';

// Accessible FAQ accordion styled as numbered appendix entries — one ruled
// list, not floating cards. Smooth height animation via the CSS grid-rows
// trick (0fr → 1fr animates cleanly, unlike height: auto).

import { useState } from 'react';
import { IconPlus } from '@/components/icons';

export interface FaqItem {
  q: string;
  a: string;
}

export function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="border-t-2 border-ink">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className="border-b border-[var(--line)]">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${i}`}
              className="group flex w-full cursor-pointer items-baseline gap-4 px-1 py-5 text-left sm:gap-6"
            >
              <span
                className={`mono-tight font-mono text-[10px] font-medium tracking-[0.14em] tabular-nums transition-colors ${
                  isOpen ? 'text-verdant-ink' : 'text-ink-mute'
                }`}
              >
                Q.{String(i + 1).padStart(2, '0')}
              </span>
              <span className="flex-1 font-medium text-ink transition-colors group-hover:text-ink">
                {item.q}
              </span>
              <IconPlus
                className={`h-4 w-4 shrink-0 self-center transition-transform duration-300 ${
                  isOpen ? 'rotate-45 text-verdant-ink' : 'text-ink-mute'
                }`}
              />
            </button>
            <div
              id={`faq-panel-${i}`}
              role="region"
              className="grid transition-[grid-template-rows] duration-300 ease-[var(--ease-out-quart)]"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <p className="prose-serif max-w-[62ch] px-1 pb-6 pl-10 text-[15px] text-ink-soft sm:pl-14">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
