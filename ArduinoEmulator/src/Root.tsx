import { lazy, Suspense, useState } from 'react'
import { HamsterWheel } from './HamsterWheel'
import { LoginPage } from './LoginPage'

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

export function Root() {
  const [signedIn, setSignedIn] = useState(false)

  if (!signedIn) return <LoginPage onLogin={() => setSignedIn(true)} onSignInIntent={loadApp} />
  return (
    <Suspense
      fallback={
        <div className="app-loading">
          <div className="app-loading-inner">
            <HamsterWheel running className="app-loading-hamster" />
            Loading workspace…
          </div>
        </div>
      }
    >
      <App onExit={() => setSignedIn(false)} />
    </Suspense>
  )
}
