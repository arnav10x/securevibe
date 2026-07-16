// SecureVibe icon set — one hand-drawn family so every glyph shares the
// same stroke weight (1.5), rounded caps, and 24px grid. No emoji anywhere:
// these scale crisply, inherit currentColor, and look intentional.

import type { ComponentProps } from 'react';

type IconProps = ComponentProps<'svg'>;

// Shared shell so all icons stay visually identical in weight and sizing.
function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Brand                                                              */
/* ------------------------------------------------------------------ */

// The mark: a shield holding a waveform — security wrapped around a vibe.
export function LogoMark(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 2.75 19.25 5.6v5.15c0 4.8-2.9 8.5-7.25 10.5-4.35-2-7.25-5.7-7.25-10.5V5.6L12 2.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8.75 10.75v2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 8.5v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15.25 10.25v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Logo lockup: mark + wordmark, used in navs and footers.
export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <span className="grid h-8 w-8 place-items-center rounded-[10px] border border-[var(--line-strong)] bg-ink-800 text-signal shadow-[0_0_18px_rgba(54,226,168,0.18)]">
        <LogoMark className="h-[18px] w-[18px]" />
      </span>
      <span className="text-[1.05rem] font-semibold tracking-tight text-fg">
        Secure<span className="text-signal">Vibe</span>
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  The four checks                                                    */
/* ------------------------------------------------------------------ */

export function IconKey(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="8" cy="15" r="4.25" />
      <path d="M11 12 19.25 3.75M15.5 7.5l2.75 2.75M13 10l1.75 1.75" />
    </Base>
  );
}

export function IconDatabase(props: IconProps) {
  return (
    <Base {...props}>
      <ellipse cx="12" cy="5.5" rx="7.25" ry="2.75" />
      <path d="M4.75 5.5v13c0 1.52 3.25 2.75 7.25 2.75s7.25-1.23 7.25-2.75v-13" />
      <path d="M4.75 12c0 1.52 3.25 2.75 7.25 2.75S19.25 13.52 19.25 12" />
    </Base>
  );
}

export function IconPackage(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 2.75 20.25 7v10L12 21.25 3.75 17V7L12 2.75Z" />
      <path d="M3.75 7 12 11.25 20.25 7M12 11.25v10" />
    </Base>
  );
}

export function IconBraces(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M8.5 3.75c-2 0-2.75 1-2.75 2.5v2.5c0 1.5-.75 2.5-2.25 2.5v1.5c1.5 0 2.25 1 2.25 2.5v2.5c0 1.5.75 2.5 2.75 2.5" />
      <path d="M15.5 3.75c2 0 2.75 1 2.75 2.5v2.5c0 1.5.75 2.5 2.25 2.5v1.5c-1.5 0-2.25 1-2.25 2.5v2.5c0 1.5-.75 2.5-2.75 2.5" />
    </Base>
  );
}

/* ------------------------------------------------------------------ */
/*  Product & interface                                                */
/* ------------------------------------------------------------------ */

export function IconShieldCheck(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 2.75 19.25 5.6v5.15c0 4.8-2.9 8.5-7.25 10.5-4.35-2-7.25-5.7-7.25-10.5V5.6L12 2.75Z" />
      <path d="m8.75 11.75 2.25 2.25 4.25-4.5" />
    </Base>
  );
}

export function IconScan(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3.75 8V5.75C3.75 4.6 4.6 3.75 5.75 3.75H8M16 3.75h2.25c1.15 0 2 .85 2 2V8M20.25 16v2.25c0 1.15-.85 2-2 2H16M8 20.25H5.75c-1.15 0-2-.85-2-2V16" />
      <path d="M3.75 12h16.5" />
    </Base>
  );
}

export function IconLock(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4.75" y="10.75" width="14.5" height="9.5" rx="2.5" />
      <path d="M8 10.75V7.9a4 4 0 0 1 8 0v2.85M12 14.75v1.75" />
    </Base>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4.75 6.25h14.5M9.5 6V4.75c0-.55.45-1 1-1h3c.55 0 1 .45 1 1V6M6.75 6.5l.7 11.9c.06 1.05.93 1.85 2 1.85h5.1c1.07 0 1.94-.8 2-1.85l.7-11.9" />
      <path d="M10 10.25v5M14 10.25v5" />
    </Base>
  );
}

export function IconFileText(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M13.5 3.25H7.25c-1.1 0-2 .9-2 2v13.5c0 1.1.9 2 2 2h9.5c1.1 0 2-.9 2-2V8.5l-5.25-5.25Z" />
      <path d="M13.25 3.5V9h5.5M9 13h6M9 16.5h4" />
    </Base>
  );
}

export function IconClock(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5V12l3 2" />
    </Base>
  );
}

export function IconSparkle(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.75c.9 4.4 2.85 6.35 7.25 7.25-4.4.9-6.35 2.85-7.25 7.25-.9-4.4-2.85-6.35-7.25-7.25 4.4-.9 6.35-2.85 7.25-7.25Z" />
      <path d="M18.5 15.5c.35 1.7 1.1 2.45 2.75 2.75-1.65.35-2.4 1.1-2.75 2.75-.35-1.65-1.1-2.4-2.75-2.75 1.65-.3 2.4-1.05 2.75-2.75Z" />
    </Base>
  );
}

export function IconAlertTriangle(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M10.3 4.1 3.05 16.65c-.75 1.3.2 2.95 1.7 2.95h14.5c1.5 0 2.45-1.65 1.7-2.95L13.7 4.1a1.95 1.95 0 0 0-3.4 0Z" />
      <path d="M12 9.25v4M12 16.4v.1" />
    </Base>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4.75 12h14.5M13.5 6.25 19.25 12l-5.75 5.75" />
    </Base>
  );
}

export function IconArrowUpRight(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6.75 17.25 17.25 6.75M8.5 6.75h8.75v8.75" />
    </Base>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m4.75 12.75 4.5 4.5 10-10.5" />
    </Base>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m5.75 9 6.25 6.25L18.25 9" />
    </Base>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 4.75v14.5M4.75 12h14.5" />
    </Base>
  );
}

export function IconUpload(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 15.25v-11M7.5 8.75 12 4.25l4.5 4.5" />
      <path d="M4.75 15.5v2.25c0 1.1.9 2 2 2h10.5c1.1 0 2-.9 2-2V15.5" />
    </Base>
  );
}

export function IconArchive(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.75" y="4.25" width="16.5" height="4.5" rx="1.5" />
      <path d="M5.25 8.75v9c0 1.1.9 2 2 2h9.5c1.1 0 2-.9 2-2v-9M9.75 12.75h4.5" />
    </Base>
  );
}

export function IconUser(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M5.25 20c.75-3.25 3.5-5 6.75-5s6 1.75 6.75 5" />
    </Base>
  );
}

export function IconCreditCard(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.25" y="5.25" width="17.5" height="13.5" rx="2.5" />
      <path d="M3.5 9.75h17M7 14.75h4" />
    </Base>
  );
}

export function IconLogout(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M10 4.75H7.25c-1.1 0-2 .9-2 2v10.5c0 1.1.9 2 2 2H10M15.25 8.5 18.75 12l-3.5 3.5M18.5 12H9.75" />
    </Base>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M19.25 12a7.25 7.25 0 1 1-2.12-5.13M19.25 4.75v3.5h-3.5" />
    </Base>
  );
}

export function IconMail(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.25" y="5.25" width="17.5" height="13.5" rx="2.5" />
      <path d="m4.5 7.5 7.5 5.5 7.5-5.5" />
    </Base>
  );
}

// GitHub's official mark (solid path, no stroke) — kept in its real shape
// per brand guidelines rather than redrawn.
export function IconGitHub(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.91c.58.11.79-.25.79-.55l-.01-2.16c-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.25.45-2.28 1.19-3.09-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.24 2.76.12 3.05.74.81 1.18 1.84 1.18 3.09 0 4.42-2.69 5.4-5.26 5.68.41.36.78 1.06.78 2.14l-.01 3.17c0 .3.2.67.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}
