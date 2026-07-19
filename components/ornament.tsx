// Static engraved ornaments, generated server-side as plain SVG paths.
// Same harmonic-ring math as the animated canvas rosette, computed once
// at render — zero client JavaScript, crisp at any size.

function rosePath(half: number, base: number, amp: number, petals: number, phase: number) {
  const steps = 180;
  let d = '';
  for (let s = 0; s <= steps; s++) {
    const t = (s / steps) * Math.PI * 2;
    const r = half * (base + amp * Math.sin(petals * t + phase));
    const x = (half + r * Math.cos(t)).toFixed(1);
    const y = (half + r * Math.sin(t)).toFixed(1);
    d += `${s === 0 ? 'M' : 'L'}${x} ${y}`;
  }
  return d + 'Z';
}

/** A small still rosette — certificate corners, footers, empty states. */
export function Rosette({
  className,
  petals = 10,
  copies = 14,
}: {
  className?: string;
  petals?: number;
  copies?: number;
}) {
  const size = 120;
  const half = size / 2;
  const paths: string[] = [];
  for (let c = 0; c < copies; c++) {
    const phase = (c / copies) * Math.PI * 2;
    paths.push(rosePath(half, 0.52, 0.28 * (0.7 + 0.3 * Math.sin(phase * 2)), petals, phase));
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} aria-hidden>
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.6"
          opacity="0.55"
        />
      ))}
    </svg>
  );
}
