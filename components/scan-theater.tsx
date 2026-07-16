'use client';

// The hero's centerpiece: a looping ~9s mini-film of what SecureVibe does.
//   Act 1 — a scan beam sweeps a code window, files tick up
//   Act 2 — findings materialize one by one with severity chips
//   Act 3 — the "SOURCE DELETED" seal stamps in (the product's core promise)
// Then it breathes for a moment and loops.
//
// Built as a simple step timeline (setTimeout chain) so it reads like a
// storyboard. With reduced motion, the finished report renders statically.

import { useEffect, useRef, useState } from 'react';
import { IconLock, IconShieldCheck } from '@/components/icons';

const CODE_LINES = [
  { no: 7, text: "const db = connect(process.env.DB_URL)" },
  { no: 8, text: "app.use(cors({ origin: '*' }))" },
  { no: 9, text: 'app.get("/api/users", listUsers)' },
  { no: 12, text: 'const stripeKey = "sk_live_9xF4…"', flagged: true },
  { no: 13, text: "stripe.charges.list({ key: stripeKey })" },
  { no: 18, text: "eval(req.query.filter)" },
];

const FINDINGS = [
  { sev: 'critical', color: 'var(--color-critical)', title: 'Stripe LIVE key committed', loc: 'config.js:12' },
  { sev: 'high', color: 'var(--color-high)', title: 'Database rules allow public writes', loc: 'firestore.rules:3' },
  { sev: 'medium', color: 'var(--color-medium)', title: 'eval() runs on user input', loc: 'server.js:18' },
];

// Timeline (ms from cycle start): [step number, time]
// step 1: beam starts sweeping     step 2: flagged line lights up
// step 3..5: findings 1..3 appear  step 6: seal stamps in
const TIMELINE: [number, number][] = [
  [1, 300],
  [2, 1500],
  [3, 2600],
  [4, 3100],
  [5, 3600],
  [6, 4600],
  [0, 9000], // reset → next cycle
];

export function ScanTheater() {
  const [step, setStep] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [frozen, setFrozen] = useState(false);
  const filesRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Jump straight to the finished report — scheduled a frame later so
      // React isn't asked to re-render in the middle of this effect.
      const raf = requestAnimationFrame(() => {
        setFrozen(true);
        setStep(6);
      });
      return () => cancelAnimationFrame(raf);
    }
    const timers = TIMELINE.map(([s, at]) =>
      setTimeout(() => {
        if (s === 0) setCycle((c) => c + 1);
        setStep(s);
      }, at),
    );
    return () => timers.forEach(clearTimeout);
  }, [cycle]);

  // The "files scanned" readout ticks up during the sweep without re-rendering
  // the component tree — we write straight into the span.
  useEffect(() => {
    if (frozen) {
      if (filesRef.current) filesRef.current.textContent = '214';
      return;
    }
    if (step !== 1) return;
    const start = performance.now();
    let raf = 0;
    function tick(now: number) {
      const t = Math.min((now - start) / 2200, 1);
      if (filesRef.current)
        filesRef.current.textContent = String(Math.round(214 * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, frozen]);

  const scanning = step >= 1 && step < 6;

  return (
    <div className="glass overflow-hidden rounded-2xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)]">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff6159]/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
        <p className="ml-3 truncate font-mono text-[11px] tracking-wide text-fg-mute">
          securevibe scan · github.com/you/your-app
        </p>
        <p className="ml-auto hidden font-mono text-[11px] text-fg-mute sm:block">
          <span ref={filesRef}>0</span> files
        </p>
      </div>

      {/* Act 1 — the code pane being swept. Long lines scroll sideways on
          small screens instead of stretching the hero layout. */}
      <div className="relative overflow-x-auto border-b border-[var(--line)] bg-ink/70 px-4 py-4 font-mono text-[12px] leading-6 sm:px-5">
        {/* The scan beam */}
        {scanning && !frozen && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 h-10"
            style={{
              animation: 'beam-sweep 2.6s var(--ease-out-soft) forwards',
              background:
                'linear-gradient(180deg, transparent, rgba(54,226,168,0.16) 55%, rgba(124,245,203,0.5) 92%, transparent 100%)',
            }}
          />
        )}
        {CODE_LINES.map((line) => {
          const lit = line.flagged && step >= 2;
          return (
            <div
              key={line.no}
              className="flex gap-4 rounded px-1 transition-colors duration-500"
              style={lit ? { background: 'rgba(255,107,107,0.12)' } : undefined}
            >
              <span className="w-5 shrink-0 select-none text-right text-fg-mute/60">
                {line.no}
              </span>
              <span className={`whitespace-nowrap ${lit ? 'text-[#ffb3b3]' : 'text-fg-dim'}`}>
                {line.text}
                {lit && (
                  <span className="ml-2 rounded-sm bg-critical/20 px-1.5 py-px text-[10px] font-semibold tracking-wider text-critical">
                    LIVE SECRET
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Act 2 — findings roll in */}
      <div className="space-y-2 px-4 py-4 sm:px-5">
        {FINDINGS.map((f, i) => {
          const shown = step >= 3 + i;
          return (
            <div
              key={f.sev}
              className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-ink-800/60 px-3 py-2 transition-all duration-500"
              style={{
                opacity: shown ? 1 : 0,
                transform: shown ? 'translateY(0)' : 'translateY(10px)',
                transitionTimingFunction: 'var(--ease-out-soft)',
              }}
            >
              <span
                className="rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: f.color, background: `color-mix(in srgb, ${f.color} 14%, transparent)` }}
              >
                {f.sev}
              </span>
              <span className="truncate text-[13px] text-fg">{f.title}</span>
              <span className="ml-auto hidden shrink-0 font-mono text-[11px] text-fg-mute sm:block">
                {f.loc}
              </span>
            </div>
          );
        })}

        {/* Act 3 — the seal */}
        <div
          className="flex items-center justify-between gap-3 rounded-lg border border-signal/40 bg-signal/10 px-3 py-2.5"
          style={{
            opacity: step >= 6 ? 1 : 0,
            transform: step >= 6 ? 'scale(1)' : 'scale(1.06)',
            transition: 'opacity 0.5s var(--ease-out-soft), transform 0.5s var(--ease-spring)',
          }}
        >
          <span className="flex items-center gap-2 text-[13px] font-medium text-signal-bright">
            <IconLock className="h-4 w-4" />
            Source code permanently deleted
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-signal">
            <IconShieldCheck className="h-3.5 w-3.5" />
            00:41s
          </span>
        </div>
      </div>
    </div>
  );
}
