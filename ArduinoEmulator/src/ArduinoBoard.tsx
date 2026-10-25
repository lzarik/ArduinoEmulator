import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { BOARD_VIEWBOX, PITCH } from './boardGeometry'

// Shared illustration of the Arduino board (ATmega328P), used on the home page and in the workbench.

// Copper traces on the board; each end gets a via.
const BOARD_TRACES = [
  'M270 139 H322',
  'M294 241 H330 V318',
  'M196 305 H240 V390 H322',
  'M630 402 V446 H600 V492',
  'M420 42 V100 H460 V200',
  'M540 42 V96 H580 V180',
  'M120 200 H210 V168',
  'M360 410 V460 H300 V492',
  'M366 164 H400 V216',
  'M520 410 V470 H492 V492',
  'M560 318 V292 H610 V236',
  'M96 300 V342 H150',
  'M382 116 H404 V66 H328 V42',
  'M212 266 H228',
  'M470 296 H500 V318',
]

function pathEnds(d: string): [number, number][] {
  // Walk the M/H/V/L commands to find the first and last points.
  let x = 0
  let y = 0
  const points: [number, number][] = []
  for (const [, cmd, args] of d.matchAll(/([MLHV])\s*([\d\s.]+)/g)) {
    const n = args.trim().split(/\s+/).map(Number)
    if (cmd === 'H') x = n[0]
    else if (cmd === 'V') y = n[0]
    else [x, y] = n
    points.push([x, y])
  }
  return [points[0], points[points.length - 1]]
}

function PinHeader({ x, y, count, labels, labelY }: { x: number; y: number; count: number; labels: string[]; labelY: number }) {
  return (
    <g>
      <g filter="url(#part-shadow)">
        <rect x={x} y={y} width={count * PITCH} height={26} rx={2} className="pcb-header" />
        {Array.from({ length: count - 1 }, (_, i) => (
          <line key={i} x1={x + (i + 1) * PITCH} y1={y + 3} x2={x + (i + 1) * PITCH} y2={y + 23} className="pcb-header-groove" />
        ))}
        {Array.from({ length: count }, (_, i) => (
          <g key={i}>
            <rect x={x + 5 + i * PITCH} y={y + 7} width={12} height={12} rx={1} className="pcb-socket" />
            <rect x={x + 8.5 + i * PITCH} y={y + 10.5} width={5} height={5} fill="url(#gold-grad)" />
          </g>
        ))}
      </g>
      {labels.map((label, i) => (
        <text key={i} x={x + 11 + i * PITCH} y={labelY} className="pcb-pin-label">{label}</text>
      ))}
    </g>
  )
}

// Surface-mount resistor (dark body) or capacitor (tan body) with tinned end caps.
function Smd({ x, y, kind = 'r', vertical = false }: { x: number; y: number; kind?: 'r' | 'c'; vertical?: boolean }) {
  const w = vertical ? 7 : 14
  const h = vertical ? 14 : 7
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={1} className={kind === 'r' ? 'smd-r' : 'smd-c'} />
      {vertical ? (
        <>
          <rect x={x} y={y} width={7} height={3} className="smd-end" />
          <rect x={x} y={y + 11} width={7} height={3} className="smd-end" />
        </>
      ) : (
        <>
          <rect x={x} y={y} width={3} height={7} className="smd-end" />
          <rect x={x + 11} y={y} width={3} height={7} className="smd-end" />
        </>
      )}
    </g>
  )
}

function useResetFlash(onReset?: () => void) {
  const [resetting, setResetting] = useState(false)
  const onResetRef = useRef(onReset)
  const resettingRef = useRef(false)
  useEffect(() => {
    onResetRef.current = onReset
  })
  // Stable, so the memoised drawing doesn't redraw whenever the parent does.
  const pressReset = useCallback((e: React.MouseEvent) => {
    // Don't let the click also reach whatever the board sits on (e.g. turn a notebook page).
    e.stopPropagation()
    onResetRef.current?.()
    if (resettingRef.current) return
    resettingRef.current = true
    setResetting(true)
    setTimeout(() => {
      resettingRef.current = false
      setResetting(false)
    }, 1100)
  }, [])
  return { resetting, pressReset }
}

interface BoardLedProps {
  /** When set, the L LED shows this pin 13 state instead of blinking on its own. */
  ledL?: boolean
  /** Whether the TX/RX LEDs flicker. */
  activity?: boolean
}

function boardClass(resetting: boolean, { ledL, activity = true }: BoardLedProps) {
  return [
    'board',
    resetting && 'resetting',
    ledL !== undefined && 'static-l',
    ledL && 'l-on',
    !activity && 'quiet',
  ]
    .filter(Boolean)
    .join(' ')
}

// Memoised: the drawing never changes, only the classes on its wrapper do.
const BoardGraphics = memo(function BoardGraphics({ onPressReset }: { onPressReset: (e: React.MouseEvent) => void }) {
  return (
    <>
    <defs>
      <linearGradient id="pcb-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#14919a" />
        <stop offset="1" stopColor="#0b6870" />
      </linearGradient>
      <linearGradient id="metal-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#eef1f4" />
        <stop offset="1" stopColor="#a9b2bb" />
      </linearGradient>
      <linearGradient id="chip-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2b2f36" />
        <stop offset="1" stopColor="#15171b" />
      </linearGradient>
      <linearGradient id="gold-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f6dc8c" />
        <stop offset="1" stopColor="#c08f2a" />
      </linearGradient>
      <radialGradient id="cap-grad" cx="0.4" cy="0.35" r="0.7">
        <stop offset="0" stopColor="#f2f5f7" />
        <stop offset="1" stopColor="#9aa4ae" />
      </radialGradient>
      <filter id="part-shadow" x="-20%" y="-20%" width="140%" height="160%">
        <feDropShadow dx="0" dy="2.5" stdDeviation="2" floodColor="#000" floodOpacity="0.35" />
      </filter>
      <filter id="board-led-glow" x="-200%" y="-200%" width="500%" height="500%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
    </defs>

    {/* PCB */}
    <path className="pcb" fill="url(#pcb-grad)" d="M14 0 H650 L686 36 V520 Q686 534 672 534 H14 Q0 534 0 520 V14 Q0 0 14 0 Z" />
    <path className="pcb-edge" d="M18 6 H647 L680 39 V516 Q680 528 668 528 H18 Q6 528 6 516 V18 Q6 6 18 6 Z" />

    {/* Copper traces and vias */}
    <g className="pcb-trace">
      {BOARD_TRACES.map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
    {BOARD_TRACES.flatMap((d) => pathEnds(d)).map(([cx, cy], i) => (
      <circle key={i} cx={cx} cy={cy} r={3.2} className="pcb-via" />
    ))}

    {/* Mounting holes */}
    {[[60, 250], [660, 150], [150, 508], [652, 504]].map(([cx, cy]) => (
      <g key={`${cx}-${cy}`}>
        <circle cx={cx} cy={cy} r={14} className="pcb-hole-ring" />
        <circle cx={cx} cy={cy} r={8.5} className="pcb-hole" />
      </g>
    ))}

    {/* USB-B port */}
    <g filter="url(#part-shadow)">
      <rect x={-34} y={70} width={160} height={118} rx={4} fill="url(#metal-grad)" className="pcb-metal-edge" />
      <line x1={-30} y1={84} x2={122} y2={84} className="pcb-metal-line" />
      <line x1={-30} y1={174} x2={122} y2={174} className="pcb-metal-line" />
      <rect x={-34} y={96} width={46} height={66} rx={2} className="pcb-port-hole" />
      <rect x={-34} y={112} width={30} height={34} rx={1} className="pcb-port-tongue" />
      <rect x={110} y={64} width={12} height={8} fill="url(#metal-grad)" />
      <rect x={110} y={186} width={12} height={8} fill="url(#metal-grad)" />
    </g>

    {/* DC barrel jack */}
    <g filter="url(#part-shadow)">
      <rect x={-26} y={360} width={140} height={110} rx={6} className="pcb-black" />
      <rect x={-26} y={360} width={140} height={14} rx={6} className="pcb-black-top" />
      {[40, 56, 72, 88].map((x) => (
        <line key={x} x1={x} y1={380} x2={x} y2={462} className="pcb-rib" />
      ))}
      <circle cx={12} cy={415} r={24} className="pcb-jack-ring" />
      <circle cx={12} cy={415} r={18} className="pcb-hole-dark" />
      <circle cx={12} cy={415} r={6} fill="url(#metal-grad)" />
    </g>

    {/* Voltage regulator (TO-252) */}
    <g filter="url(#part-shadow)">
      <rect x={146} y={276} width={54} height={18} rx={2} fill="url(#metal-grad)" />
      <rect x={150} y={290} width={46} height={30} rx={2} fill="url(#chip-grad)" />
      {[158, 170, 182].map((x) => (
        <rect key={x} x={x} y={320} width={6} height={8} fill="url(#metal-grad)" />
      ))}
    </g>
    <Smd x={210} y={286} kind="c" vertical />
    <Smd x={222} y={286} kind="c" vertical />

    {/* Electrolytic capacitors */}
    {[380, 432].map((cy, i) => (
      <g key={cy}>
        <circle cx={178} cy={cy} r={23} className="pcb-silk-line" />
        <g filter="url(#part-shadow)">
          <circle cx={178} cy={cy} r={20} fill="url(#cap-grad)" className="pcb-metal-edge" />
          <path d={`M${178 - 20} ${cy} A20 20 0 0 1 ${178 - 6} ${cy - 19}`} className="pcb-cap-stripe" />
          <path d={`M${178 - 9} ${cy} H${178 + 9} M${178} ${cy - 9} V${cy + 9}`} className="pcb-cap-score" />
        </g>
        <text x={208} y={cy + 4} className="pcb-label-sm start">C{i + 1}</text>
      </g>
    ))}

    {/* Diode, polyfuse and support passives */}
    <g filter="url(#part-shadow)">
      <rect x={232} y={328} width={30} height={12} rx={2} className="pcb-black" />
      <rect x={254} y={328} width={4} height={12} fill="url(#metal-grad)" />
      <rect x={226} y={396} width={32} height={14} rx={3} className="pcb-polyfuse" />
    </g>
    <text x={247} y={354} className="pcb-label-sm">D1</text>
    <text x={242} y={424} className="pcb-label-sm">F1</text>
    <Smd x={240} y={444} />
    <Smd x={262} y={444} />

    {/* Reset button */}
    <g className="pcb-reset" onClick={onPressReset} role="button" aria-label="Reset board">
      <rect x={116} y={18} width={48} height={48} rx={2} className="pcb-silk-line" />
      {[[118, 20], [154, 20], [118, 56], [154, 56]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={8} height={8} fill="url(#metal-grad)" />
      ))}
      <g filter="url(#part-shadow)">
        <rect x={122} y={24} width={36} height={36} rx={3} fill="url(#metal-grad)" className="pcb-metal-edge" />
        <circle cx={140} cy={42} r={12} className="pcb-reset-cap" />
        <circle cx={136} cy={38} r={4} className="pcb-reset-shine" />
      </g>
    </g>
    <text x={172} y={46} className="pcb-label-sm start">RESET</text>

    {/* USB interface chip (QFP) */}
    <g transform="rotate(45 239 139)" filter="url(#part-shadow)">
      <rect x={211} y={111} width={56} height={56} className="pcb-chip-pins" />
      <rect x={217} y={117} width={44} height={44} rx={2} fill="url(#chip-grad)" />
      <circle cx={224} cy={124} r={2.5} className="pcb-pin1" />
    </g>
    <text x={276} y={104} className="pcb-label-sm start">U3</text>
    <Smd x={140} y={212} kind="c" />
    <Smd x={160} y={212} kind="c" />
    <Smd x={140} y={228} />
    <Smd x={180} y={228} />

    {/* Crystal */}
    <g filter="url(#part-shadow)">
      <rect x={230} y={230} width={64} height={22} rx={11} fill="url(#metal-grad)" className="pcb-metal-edge" />
      <rect x={236} y={234} width={52} height={14} rx={7} className="pcb-crystal-inner" />
      <text x={262} y={244.5} className="pcb-crystal-text">16.000</text>
    </g>
    <Smd x={236} y={260} kind="c" />
    <Smd x={274} y={260} kind="c" />
    <text x={300} y={246} className="pcb-label-sm start">Y1</text>

    {/* Status LEDs with their resistors */}
    {[
      { x: 322, y: 112, label: 'L', cls: 'led-l' },
      { x: 322, y: 136, label: 'TX', cls: 'led-tx' },
      { x: 322, y: 160, label: 'RX', cls: 'led-rx' },
      { x: 600, y: 112, label: 'ON', cls: 'led-on' },
    ].map((led) => (
      <g key={led.label} className={`board-led ${led.cls}`}>
        <rect x={led.x - 3} y={led.y} width={22} height={9} rx={1} className="smd-end" />
        <rect x={led.x} y={led.y} width={16} height={9} rx={2} className="led-body" />
        <g className="led-lit">
          <ellipse cx={led.x + 8} cy={led.y + 4.5} rx={14} ry={10} filter="url(#board-led-glow)" />
          <rect x={led.x} y={led.y} width={16} height={9} rx={2} />
        </g>
        <text x={led.x - 9} y={led.y + 8} className="pcb-label-sm end">{led.label}</text>
      </g>
    ))}
    <Smd x={352} y={113} />
    <Smd x={352} y={137} />
    <Smd x={352} y={161} />
    <Smd x={600} y={180} />

    {/* Small transistor and 3.3 V regulator */}
    <g filter="url(#part-shadow)">
      <rect x={430} y={136} width={14} height={10} rx={1} fill="url(#chip-grad)" />
      <rect x={432} y={146} width={3} height={4} fill="url(#metal-grad)" />
      <rect x={439} y={146} width={3} height={4} fill="url(#metal-grad)" />
      <rect x={435.5} y={132} width={3} height={4} fill="url(#metal-grad)" />
      <rect x={438} y={430} width={28} height={6} fill="url(#metal-grad)" />
      <rect x={436} y={436} width={32} height={16} rx={1} fill="url(#chip-grad)" />
      {[442, 450, 458].map((x) => (
        <rect key={x} x={x} y={452} width={4} height={5} fill="url(#metal-grad)" />
      ))}
    </g>
    <text x={437} y={128} className="pcb-label-sm">Q1</text>

    {/* Passives near the right edge */}
    <Smd x={636} y={214} kind="c" vertical />
    <Smd x={652} y={214} kind="c" vertical />
    <Smd x={644} y={254} vertical />
    <Smd x={430} y={292} />
    <Smd x={452} y={292} kind="c" />

    {/* Silkscreen name */}
    <text x={490} y={258} className="pcb-brand">
      <tspan className="pcb-brand-ohm">Ohm</tspan>ster
    </text>

    {/* Microcontroller in its DIP socket */}
    <g filter="url(#part-shadow)">
      <rect x={322} y={318} width={316} height={92} rx={3} className="pcb-chip-socket" />
      <line x1={330} y1={364} x2={630} y2={364} className="pcb-socket-groove" />
      {Array.from({ length: 14 }, (_, i) => (
        <g key={i}>
          <rect x={340 + i * 21} y={313} width={9} height={14} rx={1} fill="url(#metal-grad)" />
          <rect x={340 + i * 21} y={401} width={9} height={14} rx={1} fill="url(#metal-grad)" />
        </g>
      ))}
      <rect x={330} y={326} width={300} height={76} rx={3} fill="url(#chip-grad)" />
      <circle cx={330} cy={364} r={9} className="pcb-chip-socket" />
      <circle cx={348} cy={390} r={3.5} className="pcb-pin1" />
      <text x={480} y={362} className="pcb-chip-text">AVR</text>
      <text x={480} y={380} className="pcb-chip-subtext">8-BIT MICROCONTROLLER</text>
    </g>

    {/* ICSP header */}
    <text x={663} y={322} className="pcb-label-sm">ICSP</text>
    <g filter="url(#part-shadow)">
      <rect x={648} y={330} width={30} height={44} rx={2} className="pcb-header" />
      {[0, 1, 2].map((r) =>
        [0, 1].map((c) => (
          <rect key={`${r}-${c}`} x={652.5 + c * 13} y={334.5 + r * 13} width={8} height={8} fill="url(#gold-grad)" />
        )),
      )}
    </g>

    {/* Pin headers */}
    <PinHeader x={240} y={16} count={10} labels={['SCL', 'SDA', 'AREF', 'GND', '13', '12', '~11', '~10', '~9', '8']} labelY={56} />
    <PinHeader x={476} y={16} count={8} labels={['7', '~6', '~5', '4', '~3', '2', 'TX1', 'RX0']} labelY={56} />
    <text x={564} y={80} className="pcb-label">DIGITAL (PWM ~)</text>

    <PinHeader x={240} y={492} count={8} labels={['', 'IO', 'RST', '3V3', '5V', 'GND', 'GND', 'VIN']} labelY={484} />
    <PinHeader x={476} y={492} count={6} labels={['A0', 'A1', 'A2', 'A3', 'A4', 'A5']} labelY={484} />
    <text x={328} y={466} className="pcb-label">POWER</text>
    <text x={542} y={466} className="pcb-label">ANALOG IN</text>
    </>
  )
})

export function ArduinoBoard(props: BoardLedProps & { onReset?: () => void }) {
  const { resetting, pressReset } = useResetFlash(props.onReset)
  return (
    <svg
      className={boardClass(resetting, props)}
      viewBox={`${BOARD_VIEWBOX.x} ${BOARD_VIEWBOX.y} ${BOARD_VIEWBOX.w} ${BOARD_VIEWBOX.h}`}
      role="img"
      aria-label="Illustration of an Arduino board"
    >
      <BoardGraphics onPressReset={pressReset} />
    </svg>
  )
}

// The board drawn inside another SVG, with its top-left corner at (x, y) and the given scale.
export function BoardGroup({ x, y, scale, onReset, ...leds }: BoardLedProps & { x: number; y: number; scale: number; onReset?: () => void }) {
  const { resetting, pressReset } = useResetFlash(onReset)
  return (
    <g
      className={boardClass(resetting, leds)}
      transform={`translate(${x - BOARD_VIEWBOX.x * scale} ${y - BOARD_VIEWBOX.y * scale}) scale(${scale})`}
    >
      <BoardGraphics onPressReset={pressReset} />
    </g>
  )
}
