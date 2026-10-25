import { useEffect, useRef } from 'react'
import type { CommandInformation, MachineData } from './api'
import { PORT_ADDR, type PortName } from './circuit'
import { HamsterWheel } from './HamsterWheel'

// Right-hand panel: what the CPU is doing right now.

const SREG_FLAGS = ['I', 'T', 'H', 'S', 'V', 'N', 'Z', 'C'] // bit 7 down to bit 0
const SREG_NAMES: Record<string, string> = {
  I: 'Global interrupt enable',
  T: 'Bit copy storage',
  H: 'Half carry',
  S: 'Sign',
  V: 'Overflow',
  N: 'Negative',
  Z: 'Zero',
  C: 'Carry',
}

const hex = (n: number, width = 2) => n.toString(16).toUpperCase().padStart(width, '0')
const bits = (n: number) => n.toString(2).padStart(8, '0')

interface DebuggerProps {
  commands: CommandInformation[]
  position: number
  machine: MachineData
  changedRegisters: Set<number>
  /** Clock cycles run so far (16 MHz). */
  cycles: number
  onInstructionClick: (index: number) => void
}

export function Debugger({ commands, position, machine, changedRegisters, cycles, onInstructionClick }: DebuggerProps) {
  const current = commands[position]
  const sreg = machine.StatusRegister?.sregByte ?? 0
  const listRef = useRef<HTMLOListElement>(null)

  // Keep the current instruction in view as the program runs. Scrolls only the list; scrollIntoView
  // would also scroll the whole panel.
  useEffect(() => {
    const list = listRef.current
    const row = list?.querySelector<HTMLElement>('.current')
    if (!list || !row) return
    const top = row.offsetTop - list.offsetTop
    if (top < list.scrollTop || top + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = top - list.clientHeight / 2
    }
  }, [position, commands])

  return (
    <aside className="dbg">
      <div className="dbg-header">Debugger</div>

      <section className={`dbg-card dbg-instruction${current ? ' live' : ''}`}>
        <div className="dbg-label">Current instruction</div>
        <div className="dbg-mnemonic">{current?.CommandName ?? '—'}</div>
        <div className="dbg-bytes">{current ? current.CommandBytes.map((b) => hex(b)).join(' ') : 'No program loaded'}</div>
        <dl className="dbg-facts">
          <div>
            <dt>PC (word)</dt>
            <dd>0x{hex(machine.PC, 4)}</dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>{current?.ProgramAddressByte != null ? `0x${hex(current.ProgramAddressByte, 4)}` : '—'}</dd>
          </div>
          <div>
            <dt>Source line</dt>
            <dd>{current?.SourceLineNumber ?? '—'}</dd>
          </div>
          <div>
            <dt>SP</dt>
            <dd>0x{hex(machine.SP, 4)}</dd>
          </div>
          <div>
            <dt>Emulated time</dt>
            <dd>{(cycles / 16000).toFixed(1)} ms</dd>
          </div>
          <div>
            <dt>Cycles</dt>
            <dd>{cycles.toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <section className="dbg-section">
        <div className="dbg-label">Status register (SREG)</div>
        <div className="dbg-flags">
          {SREG_FLAGS.map((flag, i) => (
            <div key={flag} className={`dbg-flag${(sreg >> (7 - i)) & 1 ? ' on' : ''}`} title={SREG_NAMES[flag]}>
              {flag}
            </div>
          ))}
        </div>
      </section>

      <section className="dbg-section">
        <div className="dbg-label">Registers</div>
        <div className="dbg-registers">
          {Array.from({ length: 32 }, (_, r) => (
            <div key={r} className={`dbg-reg${changedRegisters.has(r) ? ' changed' : ''}`}>
              <span className="dbg-reg-name">R{r}</span>
              <span className="dbg-reg-value">{hex(machine.DataSpace[r] ?? 0)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="dbg-section">
        <div className="dbg-label">I/O ports</div>
        <table className="dbg-ports">
          <thead>
            <tr>
              <th />
              <th>DDR</th>
              <th>PORT</th>
              <th>PIN</th>
            </tr>
          </thead>
          <tbody>
            {(['B', 'C', 'D'] as PortName[]).map((p) => (
              <tr key={p}>
                <th>{p}</th>
                <td>{bits(machine.DataSpace[PORT_ADDR[p].ddr] ?? 0)}</td>
                <td>{bits(machine.DataSpace[PORT_ADDR[p].port] ?? 0)}</td>
                <td>{bits(machine.DataSpace[PORT_ADDR[p].pin] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="dbg-section dbg-program-section">
        <div className="dbg-label">
          Program <span className="dbg-count">{commands.length ? `${commands.length} instructions` : ''}</span>
        </div>
        {commands.length === 0 ? (
          <div className="dbg-empty">
            <HamsterWheel sleeping className="dbg-empty-hamster" />
            <p>Compile your code or load a .hex file to see the program here.</p>
          </div>
        ) : (
          <ol className="dbg-program" ref={listRef}>
            {commands.map((c, i) => (
              <li key={i} className={i === position ? 'current' : ''} aria-current={i === position ? 'step' : undefined}>
                <button type="button" onClick={() => onInstructionClick(i)}>
                  <span className="dbg-prog-marker" aria-hidden="true">{i === position ? '▶' : ''}</span>
                  <span className="dbg-prog-addr">{c.ProgramAddressByte != null ? hex(c.ProgramAddressByte, 4) : i}</span>
                  <span className={`dbg-prog-name${c.CommandName === 'NO COMMAND FOUND' ? ' unknown' : ''}`}>{c.CommandName}</span>
                  <span className="dbg-prog-line">{c.SourceLineNumber != null ? `L${c.SourceLineNumber}` : ''}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </aside>
  )
}
