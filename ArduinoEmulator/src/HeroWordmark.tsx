import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { HamsterWheel } from './HamsterWheel'

// The splash hero's wordmark: "Ohmster", with a live hamster wheel for the O. Once the hero is showing, the
// hamster hops onto the wheel and runs; every so often it hops off to sit beside the O, then hops back on.
//
// The wheel powers a little circuit drawn under the word: a wire from its stand, through a resistor, to an
// LED standing after the "r" (its other leg to ground). The LED glows, with current flowing along the wire,
// only while the hamster runs.

const FIRST_HOP_MS = 1700
const RUN_MS = 8000
const REST_MS = 3200

/** Where the circuit attaches, measured from the laid-out wordmark (px, in the brand box). */
interface Layout {
  em: number
  footX: number
  footY: number
  baseline: number
  textRight: number
  width: number
  height: number
}

function Circuit({ layout }: { layout: Layout }) {
  const { em, footX, footY, baseline, textRight, width, height } = layout
  const wireY = baseline + 0.11 * em
  // The LED stands on the wire just after the word; its left leg (the anode) meets the wire.
  const ledX = textRight + 0.34 * em
  const anodeX = ledX - 0.05 * em
  const cathodeX = ledX + 0.05 * em
  const bodyBottom = baseline - 0.14 * em
  const bodyW = 0.21 * em
  const bodyH = 0.2 * em
  const domeR = bodyW / 2
  const domeY = bodyBottom - bodyH
  // A resistor halfway along the wire
  const resW = 0.5 * em
  const resX = (footX + anodeX) / 2 - resW / 2
  const amp = 0.055 * em
  const teeth = 6
  const zigzag = Array.from({ length: teeth * 2 }, (_, i) => `L${resX + (resW / (teeth * 2)) * (i + 0.5)} ${wireY + (i % 2 ? amp : -amp)}`).join(' ')
  const wire = `M${footX} ${footY} V${wireY} H${resX} ${zigzag} L${resX + resW} ${wireY} H${anodeX} V${bodyBottom}`
  const groundY = wireY + 0.13 * em
  const g = 0.08 * em

  return (
    <svg className="hero-circuit" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <defs>
        <radialGradient id="hero-led-glow">
          <stop offset="0" stopColor="#ff6b5a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff6b5a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={wire} className="hero-wire" style={{ strokeWidth: Math.max(1.5, em * 0.012) }} />
      <path d={wire} pathLength={1} className="hero-flow" style={{ strokeWidth: Math.max(3, em * 0.028) }} />
      <path
        d={`M${cathodeX} ${bodyBottom} V${groundY} M${cathodeX - g} ${groundY} H${cathodeX + g} M${cathodeX - g * 0.6} ${groundY + g * 0.5} H${cathodeX + g * 0.6} M${cathodeX - g * 0.25} ${groundY + g} H${cathodeX + g * 0.25}`}
        className="hero-wire"
        style={{ strokeWidth: Math.max(1.5, em * 0.012) }}
      />
      <circle cx={ledX} cy={domeY} r={em * 0.55} fill="url(#hero-led-glow)" className="hero-led-halo" />
      <path
        d={`M${ledX - bodyW / 2} ${bodyBottom} V${domeY} A${domeR} ${domeR} 0 0 1 ${ledX + bodyW / 2} ${domeY} V${bodyBottom} Z`}
        className="hero-led-lens"
      />
      <rect x={ledX - bodyW / 2 - em * 0.02} y={bodyBottom - em * 0.025} width={bodyW + em * 0.04} height={em * 0.025} rx={em * 0.01} className="hero-led-lens hero-led-rim" />
      <ellipse cx={ledX - bodyW * 0.18} cy={domeY - domeR * 0.15} rx={bodyW * 0.12} ry={domeR * 0.5} className="hero-led-shine" />
    </svg>
  )
}

export function HeroWordmark({ active }: { active: boolean }) {
  const [onWheel, setOnWheel] = useState(false)
  const [layout, setLayout] = useState<Layout | null>(null)
  const brandRef = useRef<HTMLDivElement>(null)
  const oRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!active) return
    let timer = 0
    const hopOn = () => {
      setOnWheel(true)
      timer = window.setTimeout(hopOff, RUN_MS)
    }
    const hopOff = () => {
      setOnWheel(false)
      timer = window.setTimeout(hopOn, REST_MS)
    }
    timer = window.setTimeout(hopOn, FIRST_HOP_MS)
    return () => window.clearTimeout(timer)
  }, [active])

  // Measure where the wheel's stand and the end of the word are, again whenever the size or the font changes.
  useLayoutEffect(() => {
    const brand = brandRef.current
    if (!brand) return
    let frame = 0
    const measure = () => {
      const o = oRef.current
      const text = textRef.current
      if (!o || !text) return
      setLayout({
        em: parseFloat(getComputedStyle(brand).fontSize),
        // The wheel's box is laid out so its rim bottom sits on the baseline (see .hero-o in App.css)
        footX: o.offsetLeft + o.offsetWidth / 2,
        footY: o.offsetTop + o.offsetHeight * 0.93,
        baseline: o.offsetTop + o.offsetHeight * 0.88,
        textRight: text.offsetLeft + text.offsetWidth,
        width: brand.offsetWidth,
        height: brand.offsetHeight,
      })
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    schedule()
    const observer = new ResizeObserver(schedule)
    observer.observe(brand)
    document.fonts.ready.then(schedule)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div ref={brandRef} className={`hero-brand${onWheel ? ' powered' : ''}`}>
      <h1 className="hero-wordmark" aria-label="Ohmster">
        <span ref={oRef} className="hero-o" aria-hidden="true">
          <HamsterWheel variant="letter" running={onWheel} hops resting={!onWheel} />
        </span>
        <span ref={textRef} aria-hidden="true">
          <span className="hero-ohm">hm</span>ster
        </span>
      </h1>
      {layout && <Circuit layout={layout} />}
    </div>
  )
}
