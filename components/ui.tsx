// Shared UI primitives, set in the "Intaglio" system.
// Same component API as before — every page that imports these gets the
// new look for free. One place to restyle, still deliberately small.

import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { IconAlertTriangle, IconCheck, IconSparkle } from '@/components/icons';

function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */
/*  Buttons — minted pills. The primary is the ink die that strikes    */
/*  verdant under the pointer; a small mint mark lights up with it.    */
/* ------------------------------------------------------------------ */

const buttonBase =
  'ctl inline-flex items-center justify-center gap-2.5 px-5 py-2.5 ' +
  'text-[14px] font-semibold tracking-[-0.01em] ' +
  'cursor-pointer select-none ' +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:transform-none';

const buttonStyles = {
  primary: 'ctl-primary',
  secondary: 'ctl-secondary',
  danger: 'ctl-danger',
} as const;

export function Button({
  variant = 'primary',
  className,
  children,
  ...props
}: ComponentProps<'button'> & { variant?: keyof typeof buttonStyles }) {
  return (
    <button className={cx(buttonBase, buttonStyles[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonStyles }) {
  return (
    <Link className={cx(buttonBase, buttonStyles[variant], className)} {...props}>
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Form controls — ruled entries in the ledger                        */
/* ------------------------------------------------------------------ */

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cx(
        'w-full rounded-xl border border-[var(--line-strong)] bg-sheet px-3.5 py-2.5',
        'text-[0.9375rem] text-ink placeholder:text-ink-mute',
        'transition-colors duration-150',
        'hover:border-ink/50',
        'focus:border-verdant focus:outline-none focus:ring-2 focus:ring-verdant/25',
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    <label
      className={cx(
        'mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-soft',
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Surfaces                                                           */
/* ------------------------------------------------------------------ */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('plate p-6', className)}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/*  Feedback — margin annotations with a colored rule down the left    */
/* ------------------------------------------------------------------ */

export function Alert({
  tone,
  children,
}: {
  tone: 'error' | 'success' | 'info';
  children: ReactNode;
}) {
  const tones = {
    error: {
      classes: 'border-l-signal text-ink',
      icon: <IconAlertTriangle className="h-4 w-4 shrink-0 text-signal-ink" />,
    },
    success: {
      classes: 'border-l-safe text-ink',
      icon: <IconCheck className="h-4 w-4 shrink-0 text-safe" />,
    },
    info: {
      classes: 'border-l-low text-ink',
      icon: <IconSparkle className="h-4 w-4 shrink-0 text-low" />,
    },
  } as const;
  return (
    <div
      role="alert"
      className={cx(
        'flex items-start gap-3 rounded-lg border border-[var(--line)] border-l-[3px]',
        'bg-sheet px-4 py-3 text-sm leading-relaxed',
        tones[tone].classes,
      )}
    >
      <span className="mt-0.5">{tones[tone].icon}</span>
      <div>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Severity — archival ink grades                                     */
/* ------------------------------------------------------------------ */

const severityColor: Record<string, string> = {
  critical: 'var(--color-critical)',
  high: 'var(--color-high)',
  medium: 'var(--color-medium)',
  low: 'var(--color-low)',
};

export function SeverityBadge({ severity }: { severity: string }) {
  const color = severityColor[severity] ?? severityColor.low;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-px font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
        background: `color-mix(in srgb, ${color} 7%, transparent)`,
      }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {severity}
    </span>
  );
}
