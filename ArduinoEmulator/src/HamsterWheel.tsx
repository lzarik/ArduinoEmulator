import { useId } from 'react'

// Ohmster's mascot: a hamster running in its wheel. It jogs all the time, sprints while `running`, and
// naps while `sleeping`. The "ink" variant is drawn in e-paper greys and moves in choppy e-ink frames;
// the "letter" variant is the O in the Ohmster wordmark. With `hops`, it hops off the wheel to sit beside
// it while `resting` (the wheel stops), and hops back on when that ends.

interface HamsterWheelProps {
  running?: boolean
  sleeping?: boolean
  variant?: 'color' | 'ink' | 'letter'
  hops?: boolean
  resting?: boolean
  /** Draw just one depth layer, to stack the mascot in 3D: the wheel and stand at the back, the
   *  hamster in the middle, the wheel's front rim nearest. */
  layer?: 'all' | 'back' | 'hamster' | 'front'
  className?: string
}

// Legs, as [hip x, hip y]: swinging from the hip in two pairs, diagonal legs together, like a real trot
const LEGS = [
  { hip: [41, 74.5], pair: 'a' },
  { hip: [57, 74], pair: 'a' },
  { hip: [38, 74], pair: 'b' },
  { hip: [54, 74.5], pair: 'b' },
] as const

// Rungs around the running surface, so the wheel visibly turns
const RUNGS = Array.from({ length: 16 }, (_, i) => (i * Math.PI * 2) / 16)
const SPOKES = Array.from({ length: 6 }, (_, i) => (i * Math.PI * 2) / 6 + Math.PI / 12)

export function HamsterWheel({
  running = false,
  sleeping = false,
  variant = 'color',
  hops = false,
  resting = false,
  layer = 'all',
  className = '',
}: HamsterWheelProps) {
  const clip = useId()
  const state = (running ? ' running' : sleeping ? ' sleeping' : '') + (hops ? ' hw-hops' : '') + (resting ? ' resting' : '')
  const back = layer === 'all' || layer === 'back'
  const hamster = layer === 'all' || layer === 'hamster'
  if (layer === 'front') {
    return (
      <svg className={`hw hw-${variant}${state} ${className}`} viewBox="0 0 100 100" aria-hidden="true">
        <circle cx={50} cy={46} r={36} className="hw-rim hw-rim-front" />
      </svg>
    )
  }
  return (
    <svg className={`hw hw-${variant}${state} ${className}`} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <ellipse cx={48} cy={68} rx={14} ry={9.5} />
          <circle cx={59} cy={64.5} r={8} />
        </clipPath>
      </defs>

      {back && (
        <>
          <path d="M50 46 L31 93 M50 46 L69 93 M22 93 H78" className="hw-stand" />

          <g className="hw-wheel">
            <circle cx={50} cy={46} r={36} className="hw-rim" />
            <circle cx={50} cy={46} r={31} className="hw-rim-inner" />
            {RUNGS.map((a) => (
              <line
                key={a}
                x1={50 + Math.cos(a) * 31}
                y1={46 + Math.sin(a) * 31}
                x2={50 + Math.cos(a) * 36}
                y2={46 + Math.sin(a) * 36}
                className="hw-rung"
              />
            ))}
            {SPOKES.map((a) => (
              <line key={a} x1={50} y1={46} x2={50 + Math.cos(a) * 31} y2={46 + Math.sin(a) * 31} className="hw-spoke" />
            ))}
          </g>
          <circle cx={50} cy={46} r={3.5} className="hw-hub" />
        </>
      )}

      {/* Drawn larger than life inside the wheel, paws (y = 79.5) on its running surface (y = 77) */}
      {hamster && (
        <g className="hw-hamster-pos">
          <g transform="translate(50 77) scale(1.3) translate(-50 -79.5)">
            <g className="hw-hamster">
              <circle cx={34.5} cy={66} r={1.8} className="hw-fur-dark" />
              {LEGS.map(({ hip: [x, y], pair }) => (
                <g key={`${x}-${y}`} className={`hw-leg hw-leg-${pair}`}>
                  <line x1={x} y1={y} x2={x} y2={78.6} className="hw-leg-line" />
                  <ellipse cx={x + 0.6} cy={79.2} rx={1.9} ry={1.1} className="hw-pink" />
                </g>
              ))}

              {/* Outline drawn under the fur, so only the outer edge of body and head shows (ink variant) */}
              <ellipse cx={48} cy={68} rx={14} ry={9.5} className="hw-outline" />
              <circle cx={59} cy={64.5} r={8} className="hw-outline" />
              <ellipse cx={48} cy={68} rx={14} ry={9.5} className="hw-fur" />
              <circle cx={59} cy={64.5} r={8} className="hw-fur" />
              <g clipPath={`url(#${clip})`}>
                {/* Golden back, cream tummy and cheeks */}
                <ellipse cx={45} cy={60} rx={15} ry={6.5} className="hw-fur-dark" />
                <ellipse cx={48} cy={76} rx={12} ry={5} className="hw-cream" />
                <ellipse cx={61} cy={69.5} rx={6.5} ry={4.4} className="hw-cream" />
              </g>

              <circle cx={55.5} cy={57.5} r={3.1} className="hw-fur-dark" />
              <circle cx={55.7} cy={57.7} r={1.6} className="hw-pink" />

              {sleeping ? (
                <path d="M60.8 63.4 q1.7 1.4 3.4 0" className="hw-eye-closed" />
              ) : (
                <g className="hw-eye">
                  <circle cx={62.4} cy={63} r={1.55} className="hw-ink-dark" />
                  <circle cx={62.9} cy={62.5} r={0.5} className="hw-shine" />
                </g>
              )}
              <circle cx={66.9} cy={65.4} r={1.1} className="hw-nose" />
              <ellipse cx={61.2} cy={67.6} rx={2} ry={1.2} className="hw-blush" />
            </g>
          </g>
        </g>
      )}

      {sleeping && (
        <g className="hw-z">
          <text x={68} y={54}>
            z
          </text>
          <text x={73} y={46}>
            z
          </text>
        </g>
      )}
    </svg>
  )
}
