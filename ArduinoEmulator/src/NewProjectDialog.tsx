import { useState } from 'react'
import { HamsterWheel } from './HamsterWheel'

// Asks for a name before creating a project. Enter creates it, Escape or clicking outside cancels.

interface NewProjectDialogProps {
  onCreate: (name: string) => void
  onCancel: () => void
}

export function NewProjectDialog({ onCreate, onCancel }: NewProjectDialogProps) {
  const [name, setName] = useState('')
  const trimmed = name.trim()

  return (
    <div className="wb-theme np-backdrop" onPointerDown={onCancel}>
      <form
        className="np-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="np-title"
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        onSubmit={(e) => {
          e.preventDefault()
          if (trimmed) onCreate(trimmed)
        }}
      >
        <HamsterWheel className="np-hamster" />
        <h2 id="np-title">New project</h2>
        <label className="np-field">
          <span>Project name</span>
          <input
            autoFocus
            value={name}
            maxLength={60}
            placeholder="e.g. Traffic light"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="np-actions">
          <button type="button" className="wb-btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="wb-btn primary" disabled={!trimmed}>
            Create project
          </button>
        </div>
      </form>
    </div>
  )
}
