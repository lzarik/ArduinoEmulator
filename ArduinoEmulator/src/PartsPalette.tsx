import { useEffect, useRef, useState } from 'react'
import { PART_INFO, PART_TYPES, WIRE_COLORS, type LedColor, type PartType } from './circuit'
import type { Tool } from './Workbench'

// Strip of parts across the top of the workbench: icons (named on hover), then the LED and wire colours,
// each one swatch that opens a small picker. Pick a part, then click a breadboard hole to place it.

const LED_SWATCHES: Record<LedColor, string> = { red: '#e53935', green: '#43a047', yellow: '#fbc02d', blue: '#1e88e5' }

function PartIcon({ type, color }: { type: PartType; color: string }) {
  switch (type) {
    case 'led':
      return (
        <svg viewBox="0 0 32 32">
          <path d="M13 22 V29 M19 22 V27" className="pi-lead" />
          <path d="M9 22 V14 a7 7 0 0 1 14 0 V22 Z" fill={color} />
          <rect x="7" y="21" width="18" height="3" rx="1" fill={color} opacity="0.75" />
        </svg>
      )
    case 'resistor':
      return (
        <svg viewBox="0 0 32 32">
          <path d="M2 16 H30" className="pi-lead" />
          <rect x="8" y="11" width="16" height="10" rx="5" fill="#d8c08c" />
          <path d="M12 11 V21 M15 11 V21" stroke="#c62828" strokeWidth="1.6" />
          <path d="M18 11 V21" stroke="#6d3b1e" strokeWidth="1.6" />
          <path d="M21.5 11 V21" stroke="#c9a227" strokeWidth="1.6" />
        </svg>
      )
    case 'button':
      return (
        <svg viewBox="0 0 32 32">
          <rect x="5" y="5" width="22" height="22" rx="3" fill="#2b2f36" />
          <circle cx="16" cy="16" r="7" fill="#5a6069" />
        </svg>
      )
    case 'capacitor':
      return (
        <svg viewBox="0 0 32 32">
          <path d="M13 20 V29 M19 20 V29" className="pi-lead" />
          <ellipse cx="16" cy="14" rx="9" ry="8" fill="#d9822b" />
        </svg>
      )
    case 'diode':
      return (
        <svg viewBox="0 0 32 32">
          <path d="M2 16 H30" className="pi-lead" />
          <rect x="9" y="11" width="14" height="10" rx="2" fill="#24272c" />
          <rect x="19" y="11" width="2.5" height="10" fill="#c9d0d6" />
        </svg>
      )
    case 'buzzer':
      return (
        <svg viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="12" fill="#1c1f24" />
          <circle cx="16" cy="16" r="8" fill="none" stroke="#3a3f47" strokeWidth="1.5" />
          <circle cx="16" cy="16" r="2.5" fill="#000" />
        </svg>
      )
    case 'potentiometer':
      return (
        <svg viewBox="0 0 32 32">
          <rect x="5" y="6" width="22" height="18" rx="2" fill="#2f5fb3" />
          <circle cx="16" cy="15" r="6.5" fill="#e8ecf0" />
          <path d="M16 15 L19 10" stroke="#555" strokeWidth="1.6" />
          <path d="M10 24 V29 M16 24 V29 M22 24 V29" className="pi-lead" />
        </svg>
      )
  }
}

// One swatch showing the current colour; clicking it opens the other choices.
function SwatchPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; name: string }[]
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [open])

  return (
    <div className="palette-group" ref={ref}>
      <span className="palette-group-label">{label}</span>
      <button
        type="button"
        className="swatch active"
        style={{ background: value }}
        aria-label={`${label} colour`}
        aria-expanded={open}
        title={`${label} colour`}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="swatch-popover" role="listbox" aria-label={`${label} colour`}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={`swatch${o.value === value ? ' active' : ''}`}
              style={{ background: o.value }}
              aria-label={o.name}
              title={o.name}
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface PartsPaletteProps {
  tool: Tool
  onToolChange: (tool: Tool) => void
  ledColor: LedColor
  onLedColorChange: (color: LedColor) => void
  wireColor: string
  onWireColorChange: (color: string) => void
}

export function PartsPalette({ tool, onToolChange, ledColor, onLedColorChange, wireColor, onWireColorChange }: PartsPaletteProps) {
  return (
    <div className="palette" role="toolbar" aria-label="Parts">
      <div className="palette-parts">
        {PART_TYPES.map((type) => {
          const active = tool.kind === 'place' && tool.type === type
          return (
            <button
              key={type}
              type="button"
              className={`palette-part${active ? ' active' : ''}`}
              aria-pressed={active}
              aria-label={PART_INFO[type].label}
              title={PART_INFO[type].label}
              onClick={() =>
                onToolChange(active ? { kind: 'select' } : { kind: 'place', type, color: type === 'led' ? ledColor : undefined })
              }
            >
              <PartIcon type={type} color={LED_SWATCHES[ledColor]} />
            </button>
          )
        })}
      </div>

      <div className="palette-options">
        <SwatchPicker
          label="LED"
          value={LED_SWATCHES[ledColor]}
          options={(Object.keys(LED_SWATCHES) as LedColor[]).map((c) => ({ value: LED_SWATCHES[c], name: `${c} LED` }))}
          onChange={(swatch) => {
            const c = (Object.keys(LED_SWATCHES) as LedColor[]).find((k) => LED_SWATCHES[k] === swatch) ?? ledColor
            onLedColorChange(c)
            if (tool.kind === 'place' && tool.type === 'led') onToolChange({ ...tool, color: c })
          }}
        />
        <SwatchPicker
          label="Wire"
          value={wireColor}
          options={WIRE_COLORS.map((c) => ({ value: c, name: 'Wire colour' }))}
          onChange={onWireColorChange}
        />
      </div>
    </div>
  )
}
