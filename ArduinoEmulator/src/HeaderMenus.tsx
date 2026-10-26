import { useEffect, useRef, useState } from 'react'
import { HamsterWheel } from './HamsterWheel'
import { timeAgo, type Project } from './projects'

// The workspace header's two menus: the logo (back to all projects, or sign out) and the project name's
// dropdown (switch to a recent project, or start a new one). They stand in for a projects sidebar.

function useDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on a click outside or Escape
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return { open, setOpen, ref }
}

interface LogoMenuProps {
  /** The hamster sprints while the emulator is busy */
  busy: boolean
  username: string
  onHome: () => void
  onSignOut: () => void
}

export function LogoMenu({ busy, username, onHome, onSignOut }: LogoMenuProps) {
  const { open, setOpen, ref } = useDropdown()
  const choose = (action: () => void) => {
    setOpen(false)
    action()
  }
  return (
    <div className="hdr-menu" ref={ref}>
      <button type="button" className="wb-brand wb-home" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <HamsterWheel running={busy} className="wb-hamster" />
        <span>
          <span className="brand-ohm">Ohm</span>ster
        </span>
        <span className="hdr-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="hdr-dropdown" role="menu">
          <div className="hdr-dropdown-label">Signed in as {username}</div>
          <button type="button" role="menuitem" onClick={() => choose(onHome)}>
            All projects
          </button>
          <button type="button" role="menuitem" onClick={() => choose(onSignOut)}>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

interface ProjectMenuProps {
  projects: Project[]
  currentId: string
  onOpen: (project: Project) => void
  onNew: () => void
  onHome: () => void
}

export function ProjectMenu({ projects, currentId, onOpen, onNew, onHome }: ProjectMenuProps) {
  const { open, setOpen, ref } = useDropdown()
  const recent = projects.filter((p) => p.id !== currentId).slice(0, 6)
  const choose = (action: () => void) => {
    setOpen(false)
    action()
  }
  return (
    <div className="hdr-menu" ref={ref}>
      <button
        type="button"
        className="hdr-project-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Switch project"
        title="Switch project"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="hdr-dropdown wide" role="menu">
          {recent.length > 0 && <div className="hdr-dropdown-label">Recent projects</div>}
          {recent.map((p) => (
            <button key={p.id} type="button" role="menuitem" onClick={() => choose(() => onOpen(p))}>
              <span>{p.name}</span>
              <span className="hdr-dropdown-meta">{timeAgo(p.updatedAt)}</span>
            </button>
          ))}
          {recent.length > 0 && <div className="hdr-dropdown-divider" />}
          <button type="button" role="menuitem" onClick={() => choose(onNew)}>
            + New project
          </button>
          <button type="button" role="menuitem" onClick={() => choose(onHome)}>
            All projects…
          </button>
        </div>
      )}
    </div>
  )
}
