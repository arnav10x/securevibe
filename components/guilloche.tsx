'use client';

// The guilloché engine — the engraved rosettes that mark this site.
// Guilloché is the machine-turned line-work on banknotes and passports:
// patterns fine enough that forgers can't redraw them. Here it stands
// for what SecureVibe does — inspection down to the hairline.
//
// Pure canvas, no libraries. Each rosette is a stack of harmonic rings:
//   r(θ) = R · (base + amp · sin(petals·θ + phase))
// drawn dozens of times with the phase stepped slightly, which weaves
// the "engine-turned" moiré. The phase drifts slowly over time, so the
// engraving breathes; the pointer tilts it a few degrees. Offscreen it
// draws nothing; with reduced motion it draws exactly one still frame.

import { useEffect, useRef } from 'react';

interface Ring {
  /** Base radius as a fraction of the canvas half-size. */
  base: number;
  /** Wave amplitude as a fraction of the canvas half-size. */
  amp: number;
  /** Petal count of the harmonic. */
  petals: number;
  /** How many phase-stepped copies weave this ring. */
  copies: number;
  /** Phase drift speed (radians per second). */
  speed: number;
  /** Stroke color index: 0 = verdant, 1 = ink. */
  tone: 0 | 1;
}

// Three woven rings: a dense heart, a mid band, an open outer crown.
const RINGS: Ring[] = [
  { base: 0.24, amp: 0.1, petals: 12, copies: 22, speed: 0.05, tone: 0 },
  { base: 0.52, amp: 0.13, petals: 9, copies: 26, speed: -0.035, tone: 1 },
  { base: 0.78, amp: 0.16, petals: 15, copies: 30, speed: 0.022, tone: 0 },
];

const SEGMENTS = 220;
const TAU = Math.PI * 2;

export function Guilloche({
  className,
  opacity = 1,
  /** When true, the rosette leans a few degrees toward the pointer. */
  parallax = false,
}: {
  className?: string;
  opacity?: number;
  parallax?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const styles = getComputedStyle(document.documentElement);
    const tones = [
      styles.getPropertyValue('--color-verdant').trim() || '#3a3a3a',
      styles.getPropertyValue('--color-ink').trim() || '#131313',
    ];

    let width = 0;
    let height = 0;
    let raf = 0;
    let inView = true;
    let last = 0;
    let clock = 0;
    // Pointer-driven tilt, eased so it feels weighted.
    const tilt = { x: 0, y: 0 };
    const tiltTarget = { x: 0, y: 0 };

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const half = Math.min(width, height) / 2;

      ctx!.save();
      ctx!.translate(cx, cy);
      // The pointer tilt: a slight squash + rotation, like turning an
      // engraved plate under a lamp.
      ctx!.rotate(tilt.x * 0.06);
      ctx!.scale(1, 1 - Math.abs(tilt.y) * 0.04);
      ctx!.lineWidth = 0.7;

      for (const ring of RINGS) {
        ctx!.strokeStyle = tones[ring.tone];
        ctx!.globalAlpha = ring.tone === 0 ? 0.32 : 0.16;
        const drift = clock * ring.speed;
        for (let c = 0; c < ring.copies; c++) {
          const phase = drift + (c / ring.copies) * TAU;
          // Copies also swell slightly out of phase, deepening the weave.
          const amp = ring.amp * (0.75 + 0.25 * Math.sin(phase * 2));
          ctx!.beginPath();
          for (let s = 0; s <= SEGMENTS; s++) {
            const t = (s / SEGMENTS) * TAU;
            const r = half * (ring.base + amp * Math.sin(ring.petals * t + phase));
            const x = r * Math.cos(t);
            const y = r * Math.sin(t);
            if (s === 0) ctx!.moveTo(x, y);
            else ctx!.lineTo(x, y);
          }
          ctx!.closePath();
          ctx!.stroke();
        }
      }
      ctx!.restore();
      ctx!.globalAlpha = 1;
    }

    function frame(now: number) {
      raf = 0;
      if (!inView) return;
      // ~30fps is plenty for line drift and halves the main-thread cost.
      if (now - last >= 33) {
        clock += (now - last) / 1000;
        last = now;
        tilt.x += (tiltTarget.x - tilt.x) * 0.06;
        tilt.y += (tiltTarget.y - tilt.y) * 0.06;
        draw();
      }
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (!raf && !reduced) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => {
            inView = entry.isIntersecting;
            if (inView) start();
          })
        : null;
    observer?.observe(canvas);

    function onPointer(e: PointerEvent) {
      if (!parallax || e.pointerType === 'touch') return;
      tiltTarget.x = (e.clientX / window.innerWidth - 0.5) * 2;
      tiltTarget.y = (e.clientY / window.innerHeight - 0.5) * 2;
      start();
    }
    if (parallax && !reduced) {
      window.addEventListener('pointermove', onPointer, { passive: true });
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    start();

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      ro.disconnect();
      if (parallax && !reduced) window.removeEventListener('pointermove', onPointer);
    };
  }, [parallax]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ opacity, display: 'block', width: '100%', height: '100%' }}
    />
  );
}
