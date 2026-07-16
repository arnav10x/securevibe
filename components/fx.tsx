'use client';

// Small motion/interaction primitives shared across the site.
// Each one is a thin wrapper: no animation library, just rAF + CSS.
// All of them respect prefers-reduced-motion.

import {
  useCallback,
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
/*  Reveal — fades content up (with a blur settle) as it scrolls in.   */
/*  CSS does the animating; this only toggles a class.                 */
/* ------------------------------------------------------------------ */

let sharedObserver: IntersectionObserver | null = null;

function getObserver() {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            sharedObserver!.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );
  }
  return sharedObserver;
}

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
    const observer = getObserver();
    observer.observe(el);
    return () => observer.unobserve(el);
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
/*  Spotlight — cards whose border area glows where the pointer is.    */
/*  Pairs with the .spotlight class in globals.css.                    */
/* ------------------------------------------------------------------ */

export function Spotlight({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  }, []);

  return (
    <div ref={ref} onPointerMove={onMove} className={`spotlight ${className ?? ''}`}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tilt — gentle 3D parallax for the hero visual.                     */
/* ------------------------------------------------------------------ */

export function Tilt({
  children,
  className,
  max = 7,
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
/*  Magnetic — buttons that lean a few pixels toward the cursor.       */
/* ------------------------------------------------------------------ */

export function Magnetic({
  children,
  className,
  strength = 0.25,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (prefersReducedMotion() || e.pointerType === 'touch') return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
  }

  function onLeave() {
    const el = ref.current;
    if (el) el.style.transform = 'translate(0, 0)';
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`inline-block transition-transform duration-300 ease-out ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CountUp — numbers that tick up when they enter the viewport.       */
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
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        if (prefersReducedMotion()) {
          setValue(to);
          return;
        }
        const start = performance.now();
        function tick(now: number) {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(2, -10 * t); // ease-out-expo
          setValue(to * eased);
          if (t < 1) requestAnimationFrame(tick);
          else setValue(to);
        }
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
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
/*  Marquee — an endless, pausable belt of items.                      */
/* ------------------------------------------------------------------ */

export function Marquee({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`marquee overflow-hidden ${className ?? ''}`}>
      <div className="marquee-track">
        <div className="flex shrink-0 items-center">{children}</div>
        {/* Second copy makes the 50% translate loop seamless. */}
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
