'use client';

// Accessible FAQ accordion with a smooth height animation
// (the CSS grid-rows trick: 0fr → 1fr animates cleanly, unlike height:auto).

import { useState } from 'react';
import { IconChevronDown } from '@/components/icons';

export interface FaqItem {
  q: string;
  a: string;
}

export function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.q}
            className={`glass rounded-2xl transition-colors duration-300 ${
              isOpen ? 'border-[var(--line-strong)]' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${i}`}
              className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left sm:px-6"
            >
              <span className="font-medium text-fg">{item.q}</span>
              <IconChevronDown
                className={`h-4 w-4 shrink-0 text-signal transition-transform duration-300 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            <div
              id={`faq-panel-${i}`}
              role="region"
              className="grid transition-[grid-template-rows] duration-300 ease-[var(--ease-out-soft)]"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-sm leading-relaxed text-fg-dim sm:px-6">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
