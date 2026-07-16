// Shared UI primitives, restyled for the "Obsidian Signal" system.
// Same component API as before — every page that imports these gets the
// new look for free. One place to restyle, still deliberately small.

import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { IconAlertTriangle, IconCheck, IconSparkle } from '@/components/icons';

function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */
/*  Buttons — pill-shaped; primary carries the phosphor signal          */
/* ------------------------------------------------------------------ */

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold ' +
  'transition-all duration-200 cursor-pointer select-none ' +
  'active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';

const buttonStyles = {
  primary: cx(
    'btn-shine text-ink',
    'bg-[linear-gradient(120deg,#7cf5cb,#36e2a8_45%,#19c78d)]',
    'shadow-[0_0_24px_rgba(54,226,168,0.35),inset_0_1px_0_rgba(255,255,255,0.4)]',
    'hover:shadow-[0_0_38px_rgba(54,226,168,0.55),inset_0_1px_0_rgba(255,255,255,0.4)] hover:-translate-y-px',
  ),
  secondary: cx(
    'glass text-fg rounded-full',
    'hover:border-[var(--line-strong)] hover:-translate-y-px hover:bg-ink-700/60',
  ),
  danger: cx(
    'border border-critical/40 bg-critical/10 text-[#ffb3b3]',
    'hover:bg-critical/20 hover:border-critical/60',
  ),
} as const;

export function Button({
  variant = 'primary',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: keyof typeof buttonStyles }) {
  return <button className={cx(buttonBase, buttonStyles[variant], className)} {...props} />;
}

export function ButtonLink({
  variant = 'primary',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonStyles }) {
  return <Link className={cx(buttonBase, buttonStyles[variant], className)} {...props} />;
}

/* ------------------------------------------------------------------ */
/*  Form controls                                                      */
/* ------------------------------------------------------------------ */

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cx(
        'w-full rounded-xl border border-[var(--line)] bg-ink-800/70 px-4 py-2.5 text-[0.9375rem] text-fg',
        'placeholder:text-fg-mute transition-colors duration-200',
        'hover:border-[var(--line-strong)]',
        'focus:border-signal/60 focus:outline-none focus:ring-2 focus:ring-signal/25',
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
        'mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-fg-dim',
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
  return <div className={cx('glass rounded-2xl p-6', className)}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/*  Feedback                                                           */
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
      classes: 'border-critical/40 bg-critical/10 text-[#ffc4c4]',
      icon: <IconAlertTriangle className="h-4 w-4 shrink-0 text-critical" />,
    },
    success: {
      classes: 'border-signal/40 bg-signal/10 text-signal-bright',
      icon: <IconCheck className="h-4 w-4 shrink-0 text-signal" />,
    },
    info: {
      classes: 'border-low/40 bg-low/10 text-[#c3ddff]',
      icon: <IconSparkle className="h-4 w-4 shrink-0 text-low" />,
    },
  } as const;
  return (
    <div
      role="alert"
      className={cx(
        'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed',
        tones[tone].classes,
      )}
    >
      <span className="mt-0.5">{tones[tone].icon}</span>
      <div>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Severity — the report's visual language                            */
/* ------------------------------------------------------------------ */

const severityStyles: Record<string, { chip: string; dot: string }> = {
  critical: { chip: 'bg-critical/12 text-critical border-critical/35', dot: 'bg-critical' },
  high: { chip: 'bg-high/12 text-high border-high/35', dot: 'bg-high' },
  medium: { chip: 'bg-medium/12 text-medium border-medium/35', dot: 'bg-medium' },
  low: { chip: 'bg-low/12 text-low border-low/35', dot: 'bg-low' },
};

export function SeverityBadge({ severity }: { severity: string }) {
  const style = severityStyles[severity] ?? severityStyles.low;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5',
        'font-mono text-[10px] font-semibold uppercase tracking-[0.14em]',
        style.chip,
      )}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full', style.dot)} aria-hidden />
      {severity}
    </span>
  );
}
