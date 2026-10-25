import { HamsterWheel } from './HamsterWheel'
import { Learn } from './Learn'
import { timeAgo, type Project } from './projects'
import { CircuitPreview } from './Workbench'

// The first screen after signing in: your projects, most recent first, each with a picture of its bench,
// and the Learn course, which doesn't need a project open.

export type HomeSection = 'projects' | 'learn'

interface HomeScreenProps {
  /** Most recent first. */
  projects: Project[]
  /** The project open in the workspace, if it has changes that aren't saved yet. */
  unsavedId: string | null
  onOpen: (project: Project) => void
  onNew: () => void
  onDelete: (project: Project) => void
  onExit: () => void
  section: HomeSection
  onSection: (section: HomeSection) => void
  /** "Open in editor" on a lesson's example */
  onTryCode: (code: string, lessonTitle: string) => void
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function HomeScreen({ projects, unsavedId, onOpen, onNew, onDelete, onExit, section, onSection, onTryCode }: HomeScreenProps) {
  return (
    <div className="wb-app home-screen">
      <header className="wb-header">
        <div className="wb-brand">
          <HamsterWheel className="wb-hamster" />
          <span>
            <span className="brand-ohm">Ohm</span>ster
          </span>
        </div>
        <nav className="wb-tabs" role="tablist" aria-label="Home">
          {(['projects', 'learn'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={section === s}
              className={section === s ? 'active' : ''}
              onClick={() => onSection(s)}
            >
              {s === 'projects' ? 'Projects' : 'Learn'}
            </button>
          ))}
        </nav>
        <div className="wb-header-actions">
          <button type="button" className="wb-btn ghost" onClick={onExit}>
            Sign out
          </button>
        </div>
      </header>

      {section === 'learn' ? (
        <Learn onTryCode={onTryCode} />
      ) : (
        <main className="home-body">
          <div className="home-inner">
            <div className="home-head">
              <div>
                <h1>Your projects</h1>
                <p>{projects.length ? `${plural(projects.length, 'project')}, most recent first` : 'Nothing here yet'}</p>
              </div>
              <button type="button" className="wb-btn primary home-new" onClick={onNew}>
                + New Project
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="home-empty">
                <HamsterWheel className="home-empty-hamster" />
                <h2>No projects yet</h2>
                <p>Start one and the hamster will get the wheel turning.</p>
                <button type="button" className="wb-btn primary" onClick={onNew}>
                  + New Project
                </button>
              </div>
            ) : (
              <ul className="home-grid">
                {projects.map((p) => (
                  <li key={p.id} className="home-card">
                    <button type="button" className="home-card-open" onClick={() => onOpen(p)}>
                      <div className="home-card-thumb">
                        <CircuitPreview circuit={p.circuit} />
                      </div>
                      <div className="home-card-body">
                        <span className="home-card-name">{p.name}</span>
                        <span className="home-card-meta">
                          {p.id === unsavedId ? (
                            <span className="home-card-unsaved">Unsaved changes</span>
                          ) : (
                            `Edited ${timeAgo(p.updatedAt)}`
                          )}
                          {' · '}
                          {plural(p.circuit.parts.length, 'part')}
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="home-card-delete"
                      aria-label={`Delete ${p.name}`}
                      title="Delete"
                      onClick={() => onDelete(p)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </main>
      )}
    </div>
  )
}
