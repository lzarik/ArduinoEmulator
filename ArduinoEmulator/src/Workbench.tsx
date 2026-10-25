import { memo, useEffect, useRef, useState } from 'react'
import { BoardGroup } from './ArduinoBoard'
import { BOARD_PINS } from './boardGeometry'
import {
  BREADBOARD,
  LAYOUTS,
  CHANNEL_Y,
  PART_INFO,
  RAILS,
  RAIL_X,
  ROW_LETTERS,
  ROW_Y,
  boardPinXY,
  canPlace,
  colX,
  endpointLabel,
  endpointXY,
  holeXY,
  newId,
  partLeads,
  railXY,
  snapPart,
  type Circuit,
  type CircuitState,
  type Layout,
  type LedColor,
  type Part,
  type PartType,
  type RailName,
} from './circuit'

export type Tool = { kind: 'select' } | { kind: 'place'; type: PartType; color?: LedColor }

type Selection = { kind: 'wire' | 'part'; id: string } | null

const LED_COLORS: Record<LedColor, { base: string; lit: string; glow: string }> = {
  red: { base: '#c62828', lit: '#ff8a80', glow: '#ff3b2a' },
  green: { base: '#2e7d32', lit: '#b9f6ca', glow: '#33e06a' },
  yellow: { base: '#e0b400', lit: '#fff59d', glow: '#ffd42a' },
  blue: { base: '#1565c0', lit: '#9fc3ff', glow: '#3d8bff' },
}

// ---------------------------------------------------------------------------------------------------
// Drawings

// Memoised: the breadboard only changes when the layout does, not on every instruction.
const Breadboard = memo(function Breadboard({ layout }: { layout: Layout }) {
  const { w, h } = BREADBOARD
  const { x, y } = layout.breadboard
  return (
    <g className="bb">
      <rect x={x} y={y + 8} width={w} height={h} rx={12} className="bb-side" />
      <rect x={x} y={y} width={w} height={h} rx={12} className="bb-body" />
      <rect x={x + 8} y={y + CHANNEL_Y - 7} width={w - 16} height={14} rx={3} className="bb-channel" />

      {(Object.keys(RAILS) as RailName[]).map((rail) => {
        const ry = y + RAILS[rail].y
        const lineY = rail[0] === 't' ? (rail === 'tn' ? ry - 13 : ry + 13) : rail === 'bp' ? ry - 13 : ry + 13
        return (
          <g key={rail}>
            <line x1={x + 60} x2={x + w - 60} y1={lineY} y2={lineY} className={RAILS[rail].sign === '+' ? 'bb-rail-pos' : 'bb-rail-neg'} />
            <text x={x + 36} y={ry + 4} className="bb-mark">{RAILS[rail].sign === '+' ? '+' : '−'}</text>
            <text x={x + w - 36} y={ry + 4} className="bb-mark">{RAILS[rail].sign === '+' ? '+' : '−'}</text>
            {RAIL_X.map((rx, i) => (
              <rect key={i} x={x + rx - 3} y={ry - 3} width={6} height={6} rx={1} className="bb-hole" />
            ))}
          </g>
        )
      })}

      {ROW_Y.map((ry, row) => (
        <g key={row}>
          <text x={x + 34} y={y + ry + 3} className="bb-label">{ROW_LETTERS[row]}</text>
          <text x={x + w - 34} y={y + ry + 3} className="bb-label">{ROW_LETTERS[row]}</text>
          {Array.from({ length: BREADBOARD.cols }, (_, i) => (
            <rect key={i} x={colX(i + 1, layout) - 3} y={y + ry - 3} width={6} height={6} rx={1} className="bb-hole" />
          ))}
        </g>
      ))}
      {[1, 5, 10, 15, 20, 25, 30].map((n) => (
        <g key={n}>
          <text x={colX(n, layout)} y={y + 88} className="bb-label">{n}</text>
          <text x={colX(n, layout)} y={y + 340} className="bb-label">{n}</text>
        </g>
      ))}
    </g>
  )
})

interface PartGraphicProps {
  part: Pick<Part, 'type' | 'col' | 'row' | 'color'>
  layout: Layout
  active?: boolean
  pressed?: boolean
  className?: string
  onSelect?: () => void
  onDelete?: () => void
  onPress?: (down: boolean) => void
}

function PartGraphic({ part, layout, active, pressed, className = '', onSelect, onDelete, onPress }: PartGraphicProps) {
  const leads = partLeads(part).map((l) => holeXY(l.col, l.row, layout))
  const [a, b] = leads
  const cx = (a.x + leads[leads.length - 1].x) / 2
  const handlers = {
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation()
      onSelect?.()
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault()
      onDelete?.()
    },
  }

  let art: React.ReactNode
  switch (part.type) {
    case 'led': {
      const c = LED_COLORS[part.color ?? 'red']
      const cy = a.y - 24
      art = (
        <>
          <path d={`M${a.x} ${a.y} V${cy + 16} L${cx - 4} ${cy + 9}`} className="lead" />
          <path d={`M${b.x} ${b.y} V${cy + 9} L${cx + 4} ${cy + 9}`} className="lead" />
          {active && <circle cx={cx} cy={cy} r={34} fill={c.glow} className="led-glow" filter="url(#wb-glow)" />}
          <circle cx={cx} cy={cy} r={13} fill={c.base} className="led-rim" />
          <circle cx={cx} cy={cy} r={11} fill={active ? c.lit : c.base} className="led-dome" />
          <ellipse cx={cx - 4} cy={cy - 4} rx={4} ry={2.6} className="led-shine" />
          <text x={a.x - 7} y={a.y - 8} className="lead-mark">+</text>
        </>
      )
      break
    }
    case 'resistor':
    case 'diode': {
      const isDiode = part.type === 'diode'
      art = (
        <>
          <path d={`M${a.x} ${a.y} H${b.x}`} className="lead" />
          <rect x={cx - 17} y={a.y - 6} width={34} height={12} rx={isDiode ? 2 : 6} className={isDiode ? 'diode-body' : 'resistor-body'} />
          {isDiode ? (
            <rect x={cx + 9} y={a.y - 6} width={4} height={12} className="diode-band" />
          ) : (
            ['#c62828', '#c62828', '#6d3b1e', '#c9a227'].map((color, i) => (
              <rect key={i} x={cx - 11 + i * 6 + (i === 3 ? 3 : 0)} y={a.y - 6} width={3} height={12} fill={color} />
            ))
          )}
        </>
      )
      break
    }
    case 'capacitor': {
      const cy = a.y - 20
      art = (
        <>
          <path d={`M${a.x} ${a.y} V${cy + 4} L${cx - 3} ${cy}`} className="lead" />
          <path d={`M${b.x} ${b.y} V${cy + 4} L${cx + 3} ${cy}`} className="lead" />
          <ellipse cx={cx} cy={cy} rx={12} ry={10} className="cap-body" />
          <text x={cx} y={cy + 3} className="cap-text">104</text>
        </>
      )
      break
    }
    case 'buzzer': {
      art = (
        <>
          {active &&
            [0, 1].map((i) => (
              <circle key={i} cx={cx} cy={a.y} r={24} className="buzz-ring" style={{ animationDelay: `${i * 0.4}s` }} />
            ))}
          <circle cx={cx} cy={a.y} r={24} className="buzzer-body" />
          <circle cx={cx} cy={a.y} r={17} className="buzzer-ring" />
          <circle cx={cx} cy={a.y} r={5} className="buzzer-hole" />
          <text x={a.x - 6} y={a.y - 14} className="lead-mark light">+</text>
        </>
      )
      break
    }
    case 'button': {
      const by = layout.breadboard.y + CHANNEL_Y
      art = (
        <>
          {leads.map((l, i) => (
            <rect key={i} x={l.x - 3} y={l.y - 3} width={6} height={6} className="button-leg" />
          ))}
          <rect x={cx - 22} y={by - 22} width={44} height={44} rx={4} className="button-body" />
          {[[-16, -16], [16, -16], [-16, 16], [16, 16]].map(([dx, dy], i) => (
            <circle key={i} cx={cx + dx} cy={by + dy} r={2.5} className="button-rivet" />
          ))}
          <circle
            cx={cx}
            cy={by}
            r={13}
            className={`button-cap${pressed ? ' pressed' : ''}`}
            onPointerDown={(e) => {
              e.stopPropagation()
              onPress?.(true)
            }}
            onPointerUp={() => onPress?.(false)}
            onPointerLeave={() => pressed && onPress?.(false)}
          />
        </>
      )
      break
    }
    case 'potentiometer': {
      const cy = a.y - 34
      art = (
        <>
          {leads.map((l, i) => (
            <path key={i} d={`M${l.x} ${l.y} V${cy + 18}`} className="lead" />
          ))}
          <rect x={cx - 27} y={cy - 22} width={54} height={44} rx={4} className="pot-body" />
          <circle cx={cx} cy={cy} r={14} className="pot-knob" />
          <line x1={cx} y1={cy} x2={cx + 7} y2={cy - 9} className="pot-pointer" />
        </>
      )
      break
    }
  }

  return (
    <g className={`part part-${part.type} ${className}`} {...handlers}>
      {art}
    </g>
  )
}

function wirePath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  // Mostly vertical runs (board above breadboard) get a soft S-curve; the rest arch upward.
  if (Math.abs(dy) > Math.abs(dx) * 1.2) {
    return `M${from.x} ${from.y} C${from.x + dx * 0.1} ${from.y + dy * 0.5}, ${to.x - dx * 0.1} ${to.y - dy * 0.5}, ${to.x} ${to.y}`
  }
  const dist = Math.hypot(dx, dy)
  const lift = Math.min(Math.max(dist * 0.25, 18), 120)
  const top = Math.min(from.y, to.y) - lift
  return `M${from.x} ${from.y} C${from.x + (to.x - from.x) * 0.2} ${top}, ${from.x + (to.x - from.x) * 0.8} ${top}, ${to.x} ${to.y}`
}

// ---------------------------------------------------------------------------------------------------
// Workbench

interface WorkbenchProps {
  circuit: Circuit
  onChange: (circuit: Circuit) => void
  tool: Tool
  onToolChange: (tool: Tool) => void
  wireColor: string
  state: CircuitState
  pressed: Set<string>
  onPress: (id: string, down: boolean) => void
  running: boolean
  onBoardReset: () => void
}

export function Workbench({ circuit, onChange, tool, onToolChange, wireColor, state, pressed, onPress, running, onBoardReset }: WorkbenchProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<Layout>(LAYOUTS.wide)

  // Use whichever arrangement draws the parts larger in the space available.
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const fit = (L: Layout) => Math.min(width / L.view.w, height / L.view.h)
      setLayout(fit(LAYOUTS.tall) > fit(LAYOUTS.wide) ? LAYOUTS.tall : LAYOUTS.wide)
    })
    observer.observe(box)
    return () => observer.disconnect()
  }, [])
  const [draftFrom, setDraftFrom] = useState<string | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<Selection>(null)

  const toSvg = (e: React.PointerEvent | React.MouseEvent) => {
    const ctm = svgRef.current?.getScreenCTM()
    if (!ctm) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  const remove = (sel: NonNullable<Selection>) => {
    onChange(
      sel.kind === 'wire'
        ? { ...circuit, wires: circuit.wires.filter((w) => w.id !== sel.id) }
        : { ...circuit, parts: circuit.parts.filter((p) => p.id !== sel.id) },
    )
    setSelected(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Leave keys alone while typing in the editor or a text field.
      if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable="true"], .monaco-editor')) return
      if (e.key === 'Escape') {
        setDraftFrom(null)
        setSelected(null)
        onToolChange({ kind: 'select' })
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        e.preventDefault()
        remove(selected)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Where the part being placed would land, snapped to the breadboard.
  const ghost = (() => {
    if (tool.kind !== 'place' || !hovered?.startsWith('hole:')) return null
    const [, col, row] = hovered.split(':').map(Number)
    const spot = snapPart(tool.type, col, row)
    return { part: { type: tool.type, color: tool.color, ...spot }, ok: canPlace(tool.type, spot.col, spot.row, circuit.parts) }
  })()

  const clickEndpoint = (id: string) => {
    if (tool.kind === 'place') {
      if (ghost?.ok) {
        const part: Part = { id: newId(), ...ghost.part }
        onChange({ ...circuit, parts: [...circuit.parts, part] })
        setSelected({ kind: 'part', id: part.id })
        onToolChange({ kind: 'select' })
      }
      return
    }
    setSelected(null)
    if (!draftFrom) setDraftFrom(id)
    else {
      if (id !== draftFrom) {
        onChange({ ...circuit, wires: [...circuit.wires, { id: newId(), from: draftFrom, to: id, color: wireColor }] })
      }
      setDraftFrom(null)
    }
  }

  const endpoints: { id: string; x: number; y: number }[] = [
    ...BOARD_PINS.map((p) => ({ id: `board:${p.id}`, ...boardPinXY(p, layout) })),
    ...ROW_Y.flatMap((_, row) =>
      Array.from({ length: BREADBOARD.cols }, (_, i) => ({ id: `hole:${i + 1}:${row}`, ...holeXY(i + 1, row, layout) })),
    ),
    ...(Object.keys(RAILS) as RailName[]).flatMap((rail) =>
      RAIL_X.map((_, i) => ({ id: `rail:${rail}:${i}`, ...railXY(rail, i, layout) })),
    ),
  ]

  const draftStart = draftFrom ? endpointXY(draftFrom, layout) : null

  let hint = 'Click a pin or hole to start a wire. Select a wire or part and press Delete to remove it.'
  if (draftFrom) hint = `Wiring from ${endpointLabel(draftFrom)}. Click another pin or hole to connect, or press Esc.`
  else if (tool.kind === 'place') hint = `Click a breadboard hole to place the ${PART_INFO[tool.type].label.toLowerCase()}. Esc cancels.`
  else if (hovered) hint = endpointLabel(hovered)

  return (
    <div ref={boxRef} className={`workbench${tool.kind === 'place' ? ' placing' : ''}${draftFrom ? ' wiring' : ''}`}>
      <svg
        ref={svgRef}
        className="workbench-svg"
        viewBox={`${layout.view.x} ${layout.view.y} ${layout.view.w} ${layout.view.h}`}
        onPointerMove={(e) => setPointer(toSvg(e))}
        onClick={() => {
          setDraftFrom(null)
          setSelected(null)
        }}
      >
        <defs>
          <filter id="wb-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <filter id="wb-shadow" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000" floodOpacity="0.28" />
          </filter>
        </defs>

        <BoardGroup {...layout.board} ledL={state.pin13} activity={running} onReset={onBoardReset} />
        <Breadboard layout={layout} />

        {/* Hit targets for every pin and hole, under the parts so a part's body can still be clicked */}
        <g className="endpoints">
          {endpoints.map((p) => (
            <circle
              key={p.id}
              cx={p.x}
              cy={p.y}
              r={7}
              className={`endpoint${draftFrom === p.id ? ' active' : ''}`}
              onPointerEnter={() => setHovered(p.id)}
              onPointerLeave={() => setHovered((h) => (h === p.id ? null : h))}
              onClick={(e) => {
                e.stopPropagation()
                clickEndpoint(p.id)
              }}
            />
          ))}
        </g>

        {circuit.parts.map((part) => (
          <PartGraphic
            key={part.id}
            part={part}
            layout={layout}
            active={state.active.has(part.id)}
            pressed={pressed.has(part.id)}
            className={selected?.kind === 'part' && selected.id === part.id ? 'selected' : ''}
            onSelect={() => {
              setDraftFrom(null)
              setSelected({ kind: 'part', id: part.id })
            }}
            onDelete={() => remove({ kind: 'part', id: part.id })}
            onPress={(down) => onPress(part.id, down)}
          />
        ))}

        {ghost && <PartGraphic part={ghost.part} layout={layout} className={`ghost${ghost.ok ? '' : ' invalid'}`} />}

        {circuit.wires.map((w) => {
          const from = endpointXY(w.from, layout)
          const to = endpointXY(w.to, layout)
          if (!from || !to) return null
          const d = wirePath(from, to)
          const isSelected = selected?.kind === 'wire' && selected.id === w.id
          return (
            <g
              key={w.id}
              className={`wire${isSelected ? ' selected' : ''}${state.shorted.has(state.netOf(w.from)) ? ' shorted' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                setDraftFrom(null)
                setSelected({ kind: 'wire', id: w.id })
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                remove({ kind: 'wire', id: w.id })
              }}
            >
              <path d={d} className="wire-hit" />
              <path d={d} className="wire-outline" />
              <path d={d} className="wire-core" stroke={w.color} />
              <path d={d} className="wire-shine" />
              <circle cx={from.x} cy={from.y} r={3.5} className="wire-tip" />
              <circle cx={to.x} cy={to.y} r={3.5} className="wire-tip" />
            </g>
          )
        })}

        {/* LEDs with no resistor are on fire. Drawn last so the flames sit on top of the wires. */}
        {circuit.parts
          .filter((part) => state.burning.has(part.id))
          .map((part) => {
            const [a, b] = partLeads(part).map((l) => holeXY(l.col, l.row, layout))
            return (
              <text key={part.id} x={(a.x + b.x) / 2} y={a.y - 16} className="led-fire" role="img" aria-label="Burning: this LED has no resistor">
                🔥
              </text>
            )
          })}

        {draftStart && pointer && (
          <path d={wirePath(draftStart, pointer)} className="wire-draft" stroke={wireColor} />
        )}
      </svg>

      {state.warnings.length > 0 && (
        <div className="workbench-warnings" role="status">
          {state.warnings.map((w) => (
            <div key={w} className="workbench-warning">{w}</div>
          ))}
        </div>
      )}
      <div className="workbench-hint">{hint}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------
// A still picture of a project's bench (board, breadboard, parts and wires), for project thumbnails.

export const CircuitPreview = memo(function CircuitPreview({ circuit }: { circuit: Circuit }) {
  const layout = LAYOUTS.wide
  return (
    <svg
      className="circuit-preview"
      viewBox={`${layout.view.x} ${layout.view.y} ${layout.view.w} ${layout.view.h}`}
      aria-hidden="true"
    >
      <defs>
        <filter id="wb-shadow" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000" floodOpacity="0.28" />
        </filter>
      </defs>
      <BoardGroup {...layout.board} ledL={false} activity={false} />
      <Breadboard layout={layout} />
      {circuit.parts.map((part) => (
        <PartGraphic key={part.id} part={part} layout={layout} />
      ))}
      {circuit.wires.map((w) => {
        const from = endpointXY(w.from, layout)
        const to = endpointXY(w.to, layout)
        if (!from || !to) return null
        const d = wirePath(from, to)
        return (
          <g key={w.id} className="wire">
            <path d={d} className="wire-outline" />
            <path d={d} className="wire-core" stroke={w.color} />
            <path d={d} className="wire-shine" />
          </g>
        )
      })}
    </svg>
  )
})
