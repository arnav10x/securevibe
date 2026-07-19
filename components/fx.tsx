'use client';

// Small motion/interaction primitives shared across the site.
// Each one is a thin wrapper: no animation library, just rAF + CSS.
// All of them respect prefers-reduced-motion.

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/* ------------------------------------------------------------------ */
/*  watchInView — fire a callback once, when an element scrolls into   */
/*  view. IntersectionObserver is the fast path; a passive scroll      */
/*  fallback double-checks geometry so content can never stay hidden   */
/*  in environments where observer callbacks go silent (embedded       */
/*  webviews, some in-app browsers). One registry serves every         */
/*  primitive in this file.                                            */
/* ------------------------------------------------------------------ */

type InViewEntry = { cb: () => void; threshold: number };

const pending = new Map<Element, InViewEntry>();
let sharedObserver: IntersectionObserver | null = null;
let fallbackArmed = false;
let checkScheduled = false;

function fireInView(el: Element) {
  const entry = pending.get(el);
  if (!entry) return;
  pending.delete(el);
  sharedObserver?.unobserve(el);
  entry.cb();
  if (pending.size === 0) disarmFallback();
}

/* Geometry check for everything still waiting — the fallback path. */
function checkPending() {
  const vh = window.innerHeight || document.documentElement.clientHeight;
  if (vh === 0) {
    // Some embedded webviews report a zero-height viewport. If we can't
    // measure, never leave content hidden — fire everything at once.
    for (const el of [...pending.keys()]) fireInView(el);
    return;
  }
  for (const [el, { threshold }] of pending) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue; // display:none — skip
    const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    if (visible >= Math.max(1, r.height * threshold * 0.5)) fireInView(el);
  }
}

function scheduleCheck() {
  if (checkScheduled) return;
  checkScheduled = true;
  // A timer, not requestAnimationFrame: rAF callbacks can be suspended
  // entirely in embedded webviews, and this check must never be lost.
  setTimeout(() => {
    checkScheduled = false;
    if (pending.size > 0) checkPending();
  }, 60);
}

function armFallback() {
  if (fallbackArmed) return;
  fallbackArmed = true;
  window.addEventListener('scroll', scheduleCheck, { passive: true });
  window.addEventListener('resize', scheduleCheck);
}

function disarmFallback() {
  if (!fallbackArmed) return;
  fallbackArmed = false;
  window.removeEventListener('scroll', scheduleCheck);
  window.removeEventListener('resize', scheduleCheck);
}

/** Watch an element; runs `cb` once when it enters the viewport.
    Returns an unsubscribe for effect cleanup. */
function watchInView(el: Element, cb: () => void, threshold = 0.05) {
  pending.set(el, { cb, threshold });
  if (!sharedObserver && typeof IntersectionObserver !== 'undefined') {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) fireInView(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: [0, 0.05, 0.4, 0.6] },
    );
  }
  sharedObserver?.observe(el);
  armFallback();
  scheduleCheck(); // catch elements already in view at mount
  return () => {
    pending.delete(el);
    sharedObserver?.unobserve(el);
    if (pending.size === 0) disarmFallback();
  };
}

/* ------------------------------------------------------------------ */
/*  Reveal — pulls content into focus as it scrolls in (rise + un-blur, */
/*  like an exposure developing). CSS animates; this toggles a class.  */
/* ------------------------------------------------------------------ */

export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  /** Stagger offset in ms — use 60–120ms steps between siblings. */
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'span';
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return watchInView(el, () => el.classList.add('is-revealed'));
  }, []);

  return (
    <Tag
      ref={ref as never}
      data-reveal
      className={className}
      style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/*  StampIn — plays the inspection-stamp thunk when scrolled into      */
/*  view. Wrap any .tag element with it.                               */
/* ------------------------------------------------------------------ */

export function StampIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [hit, setHit] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unwatch = watchInView(
      el,
      () => {
        // Reduced motion: land immediately, no theatrical delay.
        if (prefersReducedMotion()) setHit(true);
        else timer = setTimeout(() => setHit(true), delay);
      },
      0.5,
    );
    return () => {
      unwatch();
      clearTimeout(timer);
    };
  }, [delay]);

  return (
    <span
      ref={ref}
      className={className}
      style={{ display: 'inline-block', opacity: hit ? undefined : 0 }}
    >
      <span className={hit ? 'stamp-in inline-block' : 'inline-block'}>{children}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Sighted — draws reticle corner brackets around the key word once   */
/*  it scrolls into view: the word, targeted.                          */
/* ------------------------------------------------------------------ */

export function Sighted({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Reduced motion needs no special case: the global media query zeroes
    // the corner transitions, so this reveal is instant there anyway.
    return watchInView(el, () => setLocked(true), 0.6);
  }, []);

  const corner = (pos: string, d: string) => (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className={`absolute h-[0.28em] w-[0.28em] overflow-visible ${pos}`}
      style={{
        opacity: locked ? 1 : 0,
        transform: locked ? 'scale(1)' : 'scale(1.8)',
        transition: 'opacity 0.4s var(--ease-out-quart) 0.35s, transform 0.4s var(--ease-out-quart) 0.35s',
      }}
    >
      <path d={d} fill="none" stroke="var(--color-verdant)" strokeWidth="2.5" />
    </svg>
  );

  return (
    <span ref={ref} className="relative inline-block whitespace-nowrap px-[0.14em]">
      {corner('left-0 top-[0.02em]', 'M1 11V1h10')}
      {corner('right-0 top-[0.02em]', 'M1 1h10v10')}
      {corner('bottom-[0.02em] left-0', 'M1 1v10h10')}
      {corner('bottom-[0.02em] right-0', 'M11 1v10H1')}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Tilt — gentle 3D parallax so blueprint plates feel like sheets     */
/*  pinned to a light table, not pixels.                               */
/* ------------------------------------------------------------------ */

export function Tilt({
  children,
  className,
  max = 5,
}: {
  children: ReactNode;
  className?: string;
  /** Max tilt in degrees. Keep small — this should whisper, not shout. */
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const target = useRef({ rx: 0, ry: 0 });
  const current = useRef({ rx: 0, ry: 0 });
  const raf = useRef(0);

  // Plain hoisted function so the rAF loop can reference itself.
  function animate() {
    const el = ref.current;
    if (!el) return;
    // Ease toward the target angle so movement feels weighted, not twitchy.
    current.current.rx += (target.current.rx - current.current.rx) * 0.12;
    current.current.ry += (target.current.ry - current.current.ry) * 0.12;
    el.style.transform = `perspective(1100px) rotateX(${current.current.rx.toFixed(
      3,
    )}deg) rotateY(${current.current.ry.toFixed(3)}deg)`;
    const settled =
      Math.abs(target.current.rx - current.current.rx) < 0.01 &&
      Math.abs(target.current.ry - current.current.ry) < 0.01;
    raf.current = settled ? 0 : requestAnimationFrame(animate);
  }

  function kick() {
    if (!raf.current) raf.current = requestAnimationFrame(animate);
  }

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (prefersReducedMotion() || e.pointerType === 'touch') return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    target.current = { rx: -py * max, ry: px * max };
    kick();
  }

  function onLeave() {
    target.current = { rx: 0, ry: 0 };
    kick();
  }

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={className}
      style={{ transform: 'perspective(1100px)', transformStyle: 'preserve-3d' }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Magnetic — controls that lean a few pixels toward the pointer,     */
/*  then settle back. Weighted, not springy.                           */
/* ------------------------------------------------------------------ */

export function Magnetic({
  children,
  className,
  strength = 0.18,
}: {
  children: ReactNode;
  className?: string;
  /** Fraction of the pointer offset the element follows. Keep ≤ 0.25. */
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const raf = useRef(0);

  function animate() {
    const el = ref.current;
    if (!el) return;
    current.current.x += (target.current.x - current.current.x) * 0.16;
    current.current.y += (target.current.y - current.current.y) * 0.16;
    el.style.transform = `translate(${current.current.x.toFixed(2)}px, ${current.current.y.toFixed(2)}px)`;
    const settled =
      Math.abs(target.current.x - current.current.x) < 0.05 &&
      Math.abs(target.current.y - current.current.y) < 0.05;
    if (settled && target.current.x === 0 && target.current.y === 0) {
      el.style.transform = '';
      raf.current = 0;
      return;
    }
    raf.current = requestAnimationFrame(animate);
  }

  function kick() {
    if (!raf.current) raf.current = requestAnimationFrame(animate);
  }

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (prefersReducedMotion() || e.pointerType === 'touch') return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    target.current = {
      x: (e.clientX - rect.left - rect.width / 2) * strength,
      y: (e.clientY - rect.top - rect.height / 2) * strength,
    };
    kick();
  }

  function onLeave() {
    target.current = { x: 0, y: 0 };
    kick();
  }

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={className}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ScrollRail — the altimeter down the right edge: one tick per       */
/*  section, the active one extended in verdant. Click to jump.  */
/* ------------------------------------------------------------------ */

export function ScrollRail({ stops }: { stops: { id: string; label: string }[] }) {
  const [active, setActive] = useState(stops[0]?.id ?? '');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      // A thin band around the upper-middle of the viewport decides
      // which section is "current" — stable while scrolling.
      { rootMargin: '-35% 0px -55% 0px' },
    );
    for (const stop of stops) {
      const el = document.getElementById(stop.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [stops]);

  return (
    <nav className="rail" aria-label="Page sections">
      {stops.map((stop) => (
        <button
          key={stop.id}
          type="button"
          onClick={() => document.getElementById(stop.id)?.scrollIntoView({ block: 'start' })}
          className={`rail-stop ${active === stop.id ? 'is-active' : ''}`}
          aria-current={active === stop.id ? 'true' : undefined}
        >
          <span className="rail-label">{stop.label}</span>
          <span className="rail-tick" />
        </button>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  CountUp — instrument figures that tick up when they enter view.    */
/* ------------------------------------------------------------------ */

export function CountUp({
  to,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 1400,
  className,
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return watchInView(
      el,
      () => {
        if (prefersReducedMotion()) {
          setValue(to);
          return;
        }
        const start = performance.now();
        // If rAF is suspended (some embedded webviews), land on the final
        // value anyway — a stuck "0" is worse than a skipped animation.
        const failsafe = setTimeout(() => setValue(to), duration + 250);
        function tick(now: number) {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(2, -10 * t); // ease-out-expo
          setValue(to * eased);
          if (t < 1) requestAnimationFrame(tick);
          else {
            clearTimeout(failsafe);
            setValue(to);
          }
        }
        requestAnimationFrame(tick);
      },
      0.4,
    );
  }, [to, duration]);

  return (
    <span ref={ref} className={`tabular-nums ${className ?? ''}`}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Marquee — the telemetry band. Endless, pausable.                   */
/* ------------------------------------------------------------------ */

export function Marquee({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`ticker overflow-hidden ${className ?? ''}`}>
      <div className="ticker-track">
        <div className="flex shrink-0 items-center">{children}</div>
        {/* Second copy makes the 50% translate loop seamless. */}
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
