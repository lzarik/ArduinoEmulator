import { timeAgo, type Project } from './projects'

// Left-hand menu of saved projects, with a button to start a new one. Collapses to a narrow strip.

interface ProjectsSidebarProps {
  projects: Project[]
  currentId: string
  currentName: string
  collapsed: boolean
  onToggle: () => void
  onOpen: (project: Project) => void
  onNew: () => void
  onDelete: (project: Project) => void
}

export function ProjectsSidebar({ projects, currentId, currentName, collapsed, onToggle, onOpen, onNew, onDelete }: ProjectsSidebarProps) {
  const currentIsSaved = projects.some((p) => p.id === currentId)

  if (collapsed) {
    return (
      <aside className="projects-sidebar collapsed">
        <button type="button" className="sidebar-icon-btn" onClick={onToggle} aria-label="Show projects" title="Show projects">
          »
        </button>
        <button type="button" className="sidebar-icon-btn" onClick={onNew} aria-label="New project" title="New project">
          +
        </button>
      </aside>
    )
  }

  return (
    <aside className="projects-sidebar">
      <div className="sidebar-head">
        <span>Projects</span>
        <button type="button" className="sidebar-icon-btn" onClick={onToggle} aria-label="Hide projects" title="Hide projects">
          «
        </button>
      </div>
      <button type="button" className="sidebar-new" onClick={onNew}>
        + New project
      </button>

      <ul className="sidebar-list">
        {!currentIsSaved && (
          <li className="current">
            <div className="sidebar-item">
              <span className="sidebar-item-name">{currentName || 'Untitled project'}</span>
              <span className="sidebar-item-meta">Not saved yet</span>
            </div>
          </li>
        )}
        {projects.map((p) => (
          <li key={p.id} className={p.id === currentId ? 'current' : ''}>
            <button type="button" className="sidebar-item" onClick={() => p.id !== currentId && onOpen(p)}>
              <span className="sidebar-item-name">{p.name}</span>
              <span className="sidebar-item-meta">
                {p.circuit.parts.length} parts · {timeAgo(p.updatedAt)}
              </span>
            </button>
            <button type="button" className="sidebar-delete" aria-label={`Delete ${p.name}`} title="Delete" onClick={() => onDelete(p)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      {projects.length === 0 && <p className="sidebar-empty">Press Save to keep your project here.</p>}
    </aside>
  )
}
