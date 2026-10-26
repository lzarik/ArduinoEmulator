import { HamsterWheel } from './HamsterWheel'
import { Learn, type LearnProps } from './Learn'
import { timeAgo, type Project } from './projects'
import { RESOURCES, siteOf } from './resources'
import { CircuitPreview } from './Workbench'

// The first screen after signing in: your projects, most recent first, each with a picture of its bench;
// the Learn course, which doesn't need a project open; and Resources, other tools worth knowing about.

export type HomeSection = 'projects' | 'learn' | 'resources'

const SECTION_LABELS: Record<HomeSection, string> = { projects: 'Projects', learn: 'Learn', resources: 'Resources' }

interface HomeScreenProps {
  /** Most recent first. */
  projects: Project[]
  /** The project open in the workspace, if it has changes that aren't saved yet. */
  unsavedId: string | null
  onOpen: (project: Project) => void
  onNew: () => void
  onDelete: (project: Project) => void
  onExit: () => void
  /** The signed-in account */
  username: string
  section: HomeSection
  onSection: (section: HomeSection) => void
  /** The account's progress through the course, and what to do as it changes */
  learn: Omit<LearnProps, 'onTryCode'>
  /** "Open in editor" on a lesson's example */
  onTryCode: (code: string, lessonTitle: string) => void
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function HomeScreen({ projects, unsavedId, onOpen, onNew, onDelete, onExit, username, section, onSection, learn, onTryCode }: HomeScreenProps) {
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
          {(['projects', 'learn', 'resources'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={section === s}
              className={section === s ? 'active' : ''}
              onClick={() => onSection(s)}
            >
              {SECTION_LABELS[s]}
            </button>
          ))}
        </nav>
        <div className="wb-header-actions">
          <span className="home-account">
            Signed in as <strong>{username}</strong>
          </span>
          <button type="button" className="wb-btn ghost" onClick={onExit}>
            Sign out
          </button>
        </div>
      </header>

      {section === 'learn' ? (
        <Learn {...learn} onTryCode={onTryCode} />
      ) : section === 'resources' ? (
        <Resources />
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

function Resources() {
  return (
    <main className="home-body">
      <div className="home-inner">
        <div className="home-head">
          <div>
            <h1>Resources</h1>
            <p>Other tools worth knowing about. Each link opens in a new tab.</p>
          </div>
        </div>

        {RESOURCES.map((group) => (
          <section key={group.title} className="resource-group">
            <h2>{group.title}</h2>
            <ul className="resource-list">
              {group.resources.map((r) => (
                <li key={r.url}>
                  <a className="resource" href={r.url} target="_blank" rel="noreferrer">
                    <span className="resource-name">
                      {r.name} <span aria-hidden="true">↗</span>
                    </span>
                    <span className="resource-site">{siteOf(r.url)}</span>
                    <span className="resource-description">{r.description}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}
