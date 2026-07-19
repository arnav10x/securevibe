// The deletion rig: a demonstration that loops on the promise section.
// A source file sits on the deep green plate — deliberately the only
// sheet of bright paper in the darkest part of the page — a purge head
// sweeps down it, every line of code is wiped to nothing, the
// "source destroyed" stamp lands, the file reprints and the cycle
// repeats. Pure CSS on one shared 9s clock.

const LINES = [72, 88, 55, 80, 64, 91, 46, 76, 60];

export function DeletionRig() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden>
      <style>{`
        .rig-line {
          height: 8px;
          border-radius: 4px;
          background: color-mix(in srgb, var(--color-ink) 24%, transparent);
          transform-origin: right;
          animation: rig-wipe 9s linear infinite;
        }
        /* Lines are struck in sequence (per-line delay), reprint together. */
        @keyframes rig-wipe {
          0%, 14% { transform: scaleX(1); opacity: 1; }
          17% { transform: scaleX(0); opacity: 1; }
          80% { transform: scaleX(0); opacity: 0; }
          86%, 100% { transform: scaleX(1); opacity: 1; }
        }
        .rig-head {
          position: absolute;
          left: 12px;
          right: 12px;
          height: 2px;
          background: var(--color-signal);
          top: 18%;
          opacity: 0;
          animation: rig-head 9s linear infinite;
        }
        @keyframes rig-head {
          0%, 12% { top: 18%; opacity: 0; }
          14% { opacity: 1; }
          46% { top: 88%; opacity: 1; }
          50%, 100% { top: 88%; opacity: 0; }
        }
        .rig-stamp {
          opacity: 0;
          animation: rig-stamp 9s var(--ease-thunk) infinite;
        }
        @keyframes rig-stamp {
          0%, 52% { opacity: 0; transform: scale(2) rotate(-8deg); }
          56% { opacity: 1; transform: scale(0.95) rotate(-2deg); }
          58% { opacity: 1; transform: scale(1) rotate(-3deg); }
          82% { opacity: 1; transform: scale(1) rotate(-3deg); }
          85%, 100% { opacity: 0; transform: scale(1) rotate(-3deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .rig-line { animation: none; transform: scaleX(0); opacity: 0; }
          .rig-head { animation: none; opacity: 0; }
          .rig-stamp { animation: none; opacity: 1; transform: rotate(-3deg); }
        }
      `}</style>

      {/* The file on the plate — real paper, about to stop existing */}
      <div className="relative rounded-xl bg-sheet text-ink shadow-[0_2px_6px_rgba(0,0,0,0.35),0_20px_45px_-18px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-2.5">
          <span className="mono-tight font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute">
            source · workspace/4f82…9c3a
          </span>
          <span className="mono-tight font-mono text-[9px] uppercase tracking-[0.16em] text-signal-ink">
            purge armed
          </span>
        </div>

        <div className="relative space-y-3 px-4 py-5">
          {LINES.map((width, i) => (
            <div
              key={i}
              className="rig-line"
              style={{ width: `${width}%`, animationDelay: `${i * 0.28}s` }}
            />
          ))}
          {/* The purge head sweeping the file */}
          <div className="rig-head" />
          {/* The verdict */}
          <div className="absolute inset-0 grid place-items-center">
            <span className="rig-stamp tag tag--safe bg-sheet text-sm">Source destroyed</span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute">
          <span>bytes retained</span>
          <span className="font-bold text-safe">0</span>
        </div>
      </div>
    </div>
  );
}
