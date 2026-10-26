import { useEffect, useRef } from 'react'
import { seconds, type BuildState, type OutputLine } from './buildLog'

// A Visual Studio style Output panel docked under the editor and bench, and the status bar along the
// bottom of the workspace that sums up the build and opens or closes the panel.

interface OutputPanelProps {
  lines: OutputLine[]
  height: number
  onResize: (height: number) => void
  onClear: () => void
  onClose: () => void
}

export function OutputPanel({ lines, height, onResize, onClear, onClose }: OutputPanelProps) {
  const bodyRef = useRef<HTMLDivElement>(null)

  // Follow the newest line, like a terminal
  useEffect(() => {
    const body = bodyRef.current
    if (body) body.scrollTop = body.scrollHeight
  }, [lines])

  // Drag the top edge to resize
  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = height
    const move = (ev: PointerEvent) => onResize(Math.min(Math.max(startHeight + startY - ev.clientY, 110), window.innerHeight * 0.6))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <section className="output-panel" style={{ height }} aria-label="Output">
      <div className="output-resize" onPointerDown={startResize} />
      <header className="output-head">
        <span className="output-tab">Output</span>
        <span className="output-source">
          Show output from: <strong>Build</strong>
        </span>
        <div className="output-actions">
          <button type="button" onClick={onClear} title="Clear output" aria-label="Clear output">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 4h10M6 4V2.5h4V4M4.5 4l.7 9.5h5.6l.7-9.5" />
            </svg>
          </button>
          <button type="button" onClick={onClose} title="Close panel" aria-label="Close panel">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </header>
      <div className="output-body" ref={bodyRef} role="log" aria-live="polite">
        {lines.length === 0 ? (
          <div className="output-empty">No output yet. Build your sketch to see its output here.</div>
        ) : (
          lines.map((line, i) => (
            <div key={i} className={`output-line${line.kind ? ` ${line.kind}` : ''}`}>
              {line.text}
            </div>
          ))
        )}
      </div>
    </section>
  )
}

interface StatusBarProps {
  build: BuildState | null
  now: number
  /** Shows a just-finished successful build in green for a few seconds */
  freshSuccess: boolean
  /** The program's state (Ready, Running, Stopped…) when no build is showing */
  idleText: string
  running: boolean
  outputOpen: boolean
  onToggleOutput: () => void
}

export function StatusBar({ build, now, freshSuccess, idleText, running, outputOpen, onToggleOutput }: StatusBarProps) {
  const building = !!build && !build.endedAt
  const active = build?.steps.find((s) => s.status === 'active')
  const state = building ? 'building' : build?.failed ? 'failed' : freshSuccess ? 'succeeded' : 'idle'

  let text = idleText
  if (building) text = `${active ? active.label : build.title}…`
  else if (build?.failed) text = `Build failed after ${seconds((build.endedAt ?? now) - build.startedAt)}`
  else if (freshSuccess && build) text = `Build succeeded in ${seconds((build.endedAt ?? now) - build.startedAt)}`

  return (
    <footer className={`wb-statusbar ${state}`}>
      <button type="button" className="statusbar-build" onClick={onToggleOutput} title={outputOpen ? 'Hide output' : 'Show output'}>
        {building ? (
          <span className="statusbar-spinner" aria-hidden="true" />
        ) : (
          <span className={`statusbar-icon${state === 'idle' && running ? ' running' : ''}`} aria-hidden="true">
            {state === 'failed' ? '✕' : state === 'succeeded' ? '✓' : '●'}
          </span>
        )}
        <span>{text}</span>
        {building && (
          <span className="statusbar-progress" role="progressbar" aria-valuenow={Math.round(build.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${build.progress * 100}%` }} />
          </span>
        )}
        {building && <span className="statusbar-percent">{Math.round(build.progress * 100)}%</span>}
      </button>
      <span className="statusbar-right">Arduino Uno · ATmega328P · 16 MHz</span>
      <button type="button" className="statusbar-output" onClick={onToggleOutput}>
        Output {outputOpen ? '▾' : '▴'}
      </button>
    </footer>
  )
}
