import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react'
import { currentAccount, logOut, type Account } from './account'
import { HamsterWheel } from './HamsterWheel'
import { fetchLearnProgress, importBrowserLearnProgress, type LearnProgress } from './learnProgress'
import { LoginPage } from './LoginPage'
import { fetchProjects, importBrowserProjects, type Project } from './projects'

// The workspace (with the Monaco code editor) is a large download that takes most of a second to start
// up. It's loaded only once someone opens the sign-in form, so it never runs during the intro
// animation and is usually ready by the time they submit.
const loadApp = () => import('./App')

// If the workspace code can't be downloaded (dev server stopped, or a new version was deployed),
// say so instead of leaving a blank screen.
function LoadFailed() {
  return (
    <div className="app-loading">
      <div className="app-load-failed">
        <p>Couldn't load the workspace. Check that the app is still running, then reload.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    </div>
  )
}

const App = lazy(() => loadApp().catch(() => ({ default: LoadFailed })))

function Loading({ children }: { children: ReactNode }) {
  return (
    <div className="app-loading">
      <div className="app-loading-inner">
        <HamsterWheel running className="app-loading-hamster" />
        {children}
      </div>
    </div>
  )
}

// checking: asking the API whether someone is still signed in from an earlier visit ·
// signed-out: the splash page · loading: fetching the account's projects and Learn progress ·
// ready: the workspace
type Session =
  | { state: 'checking' }
  | { state: 'signed-out' }
  | { state: 'loading'; account: Account }
  | { state: 'load-failed'; account: Account }
  | { state: 'ready'; account: Account; projects: Project[]; progress: LearnProgress }

export function Root() {
  const [session, setSession] = useState<Session>({ state: 'checking' })

  const openAccount = useCallback(async (account: Account) => {
    setSession({ state: 'loading', account })
    loadApp()
    try {
      // Projects and progress saved in this browser before accounts existed move into the first account
      // to sign in
      await Promise.all([importBrowserProjects().catch(() => undefined), importBrowserLearnProgress().catch(() => undefined)])
      const [projects, progress] = await Promise.all([fetchProjects(), fetchLearnProgress()])
      setSession({ state: 'ready', account, projects, progress })
    } catch {
      setSession({ state: 'load-failed', account })
    }
  }, [])

  useEffect(() => {
    currentAccount()
      .then((account) => (account ? openAccount(account) : setSession({ state: 'signed-out' })))
      .catch(() => setSession({ state: 'signed-out' }))
  }, [openAccount])

  const signOut = () => {
    void logOut()
    setSession({ state: 'signed-out' })
  }

  switch (session.state) {
    case 'checking':
      return <div className="app-loading" />
    case 'signed-out':
      return <LoginPage onLogin={openAccount} onSignInIntent={loadApp} />
    case 'loading':
      return <Loading>Loading your projects…</Loading>
    case 'load-failed':
      return (
        <div className="app-loading">
          <div className="app-load-failed">
            <p>Couldn't load your projects. Check that the Ohmster API is running, then try again.</p>
            <button type="button" onClick={() => openAccount(session.account)}>
              Try again
            </button>
            <button type="button" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      )
    case 'ready':
      return (
        <Suspense fallback={<Loading>Loading workspace…</Loading>}>
          <App
            key={session.account.username}
            account={session.account}
            initialProjects={session.projects}
            initialProgress={session.progress}
            onExit={signOut}
          />
        </Suspense>
      )
  }
}
