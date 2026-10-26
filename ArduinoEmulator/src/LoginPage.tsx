import { useCallback, useEffect, useRef, useState } from 'react'
import { AccountError, logIn, signUp, type Account } from './account'
import { ArduinoBoard } from './ArduinoBoard'
import { HamsterWheel } from './HamsterWheel'
import { HeroWordmark } from './HeroWordmark'
import { FeaturesPage, HowItWorksPage, MissionPage } from './SplashPages'
import { TeamSection } from './TeamSection'

interface Props {
  onLogin: (account: Account) => void
  /** Called when the sign-in form opens, so the workspace can start loading. */
  onSignInIntent?: () => void
}

type AuthMode = 'signin' | 'create'

interface AuthFormProps {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  /** Signs up or logs in; rejects with the message to show if the API turns it down. */
  onSubmit: (username: string, password: string) => Promise<void>
}

function AuthForm({ mode, onModeChange, onSubmit }: AuthFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Enter a username and password.')
      return
    }
    if (mode === 'create' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setError('')
    setBusy(true)
    try {
      await onSubmit(username.trim(), password)
    } catch (err) {
      setError(err instanceof AccountError ? err.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-toggle" role="tablist" aria-label="Account">
        {(['signin', 'create'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={mode === m ? 'active' : ''}
            onClick={() => {
              onModeChange(m)
              setError('')
            }}
          >
            {m === 'signin' ? 'Log In' : 'Sign Up'}
          </button>
        ))}
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="login-field">
          <label className="login-label" htmlFor="login-username">Username</label>
          <input
            id="login-username"
            className="login-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </div>
        <div className="login-field">
          <label className="login-label" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            className="login-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </div>
        {mode === 'create' && (
          <div className="login-field">
            <label className="login-label" htmlFor="login-confirm">Confirm password</label>
            <input
              id="login-confirm"
              className="login-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                setError('')
              }}
              autoComplete="new-password"
            />
          </div>
        )}

        {mode === 'create' && !error && <div className="auth-hint">At least 8 characters.</div>}
        {error && <div className="auth-error" role="alert">{error}</div>}

        <button type="submit" className="landing-btn primary auth-submit" disabled={busy}>
          {busy ? (mode === 'signin' ? 'Logging in…' : 'Creating account…') : mode === 'signin' ? 'Log In' : 'Sign Up'}
        </button>
      </form>
    </div>
  )
}

interface AuthModalProps extends AuthFormProps {
  onClose: () => void
}

function AuthModal({ mode, onModeChange, onSubmit, onClose }: AuthModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="auth-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'signin' ? 'Log In' : 'Sign Up'}
      >
        <button type="button" className="auth-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <AuthForm mode={mode} onModeChange={onModeChange} onSubmit={onSubmit} />
      </div>
    </div>
  )
}

// "Ohm" is drawn in the accent color, the rest of the name in white.
function BrandName() {
  return (
    <>
      <span className="brand-ohm">Ohm</span>ster
    </>
  )
}

// Splash page sections, in scroll order. What is Ohmster is your own text, with the board slamming onto
// the page under it; Mission, Features and How It Works are in SplashPages.tsx; Meet the Team lists the
// people in team.ts.
const SPLASH_SECTIONS = [
  { id: 'what', title: 'What is Ohmster' },
  { id: 'mission', title: 'Mission' },
  { id: 'features', title: 'Features' },
  { id: 'how', title: 'How It Works' },
  { id: 'team', title: 'Meet the Team' },
]

// Length of the opening sequence (title, then the notebook swinging up to face the camera), and of the
// dive into its label that fades into the splash page. The keyframes in App.css are timed against these.
const INTRO_MS = 4600
const DIVE_MS = 1300

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Show each .reveal block while any of it is on screen (ignoring the bottom 12%, so it rises in a
// little after it appears), and hide it once it leaves so it animates again when you scroll back.
function updateReveals(root: HTMLElement) {
  const { top } = root.getBoundingClientRect()
  const bottom = top + root.clientHeight * 0.88
  root.querySelectorAll<HTMLElement>('.reveal').forEach((el) => {
    const rect = el.getBoundingClientRect()
    el.classList.toggle('in-view', rect.top < bottom && rect.bottom > top)
  })
}

function Cover() {
  return (
    <div className="cover">
      <span className="cover-hinge" />
      <span className="cover-corner cover-corner-top" />
      <span className="cover-corner cover-corner-bottom" />
      <div className="cover-label">
        <div className="cover-name">
          <span className="cover-name-ohm">Ohm</span>ster
        </div>
        <div className="cover-sub">Engineering Notebook</div>
      </div>
      <div className="cover-board">
        {/* LEDs held still: each blink would repaint the whole cover, which the dive draws at up to 3x */}
        <ArduinoBoard ledL={false} activity={false} />
      </div>
    </div>
  )
}

// Opening title: each letter flies in out of the dark, then the whole word tilts away into the distance.
function IntroTitle() {
  return (
    <div className="intro-cam intro-title-cam" aria-hidden="true">
      <div className="intro-title">
        {'Ohmster'.split('').map((ch, i) => (
          <span
            key={i}
            className={`intro-letter${i < 3 ? ' intro-letter-ohm' : ''}`}
            style={{ animationDelay: `${0.25 + i * 0.11}s, ${1.2 + i * 0.09}s` }}
          >
            {ch}
          </span>
        ))}
      </div>
    </div>
  )
}

// A solid 3D version of the closed notebook (covers, spine and page edges) for the opening camera move,
// which ends by diving into its label.
function ClosedBook3D() {
  return (
    <div className="intro-cam intro-book-cam">
      <div className="book3d">
        <div className="book3d-face book3d-front">
          <Cover />
          <div className="book3d-glare" />
        </div>
        <div className="book3d-face book3d-back" />
        <div className="book3d-face book3d-spine" />
        <div className="book3d-face book3d-pages-right" />
        <div className="book3d-face book3d-pages-top" />
        <div className="book3d-face book3d-pages-bottom" />
      </div>
    </div>
  )
}

// Parts called out on the board under What is Ohmster. Positions are in the board drawing's own
// coordinates: `part` is the point on the board, `label` where the callout sits.
const BOARD_PARTS: { name: string; note: string; part: [number, number]; label: [number, number]; side: 'top' | 'bottom' }[] = [
  { name: 'USB', note: 'Connects to your computer', part: [46, 70], label: [-10, -90], side: 'top' },
  { name: 'Reset', note: 'Restarts your program', part: [140, 22], label: [175, -90], side: 'top' },
  { name: 'Pin 13 LED', note: 'Blinks with your code', part: [330, 112], label: [375, -90], side: 'top' },
  { name: 'Digital Pins', note: 'On/off pins 0–13', part: [560, 16], label: [585, -90], side: 'top' },
  { name: 'Power Jack', note: 'Plug in power here', part: [44, 470], label: [20, 625], side: 'bottom' },
  { name: 'Power Pins', note: '5 V, 3.3 V and ground', part: [328, 518], label: [235, 625], side: 'bottom' },
  { name: 'Microcontroller', note: 'The computer that runs your code', part: [480, 402], label: [445, 625], side: 'bottom' },
  { name: 'Analog Pins', note: 'Read sensors, A0–A5', part: [608, 518], label: [655, 625], side: 'bottom' },
]

// Board drawing viewBox, so callouts can be placed as percentages of the board's box.
const BOARD_VIEW = { x: -40, y: -6, w: 740, h: 548 }
const BOARD_CENTER: [number, number] = [330, 268]

// The board slams onto the page, ink ripples spread from the impact, and each callout appears as the
// ripple reaches it. Remounted (via key) every time its section scrolls into view, so it replays.
// `visit` goes up each time the board comes back into view; the slam then plays again on the same
// drawing (restarting its animations), rather than drawing the whole board again mid-scroll.
function BoardDiagram({ visit }: { visit: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const firstVisit = useRef(visit)

  useEffect(() => {
    if (visit === firstVisit.current) return
    ref.current?.getAnimations({ subtree: true }).forEach((animation) => {
      animation.cancel()
      animation.play()
    })
  }, [visit])

  return (
    <div className="about-diagram" ref={ref}>
      <div className="about-board-wrap">
        <div className="about-impact-shadow" />
        {[0, 1, 2].map((i) => (
          <span key={i} className="about-ripple" style={{ '--i': i } as React.CSSProperties} />
        ))}
        <div className="about-slam">
          <ArduinoBoard />
        </div>

        <svg className="about-leaders" viewBox={`${BOARD_VIEW.x} ${BOARD_VIEW.y} ${BOARD_VIEW.w} ${BOARD_VIEW.h}`} aria-hidden="true">
          {BOARD_PARTS.map((p) => {
            const d = Math.hypot(p.part[0] - BOARD_CENTER[0], p.part[1] - BOARD_CENTER[1]) * 0.0011
            return (
              <g key={p.name} style={{ '--d': `${d}s` } as React.CSSProperties}>
                <path d={`M${p.part[0]} ${p.part[1]} L${p.label[0]} ${p.label[1]}`} pathLength={1} className="about-leader" />
                <circle cx={p.part[0]} cy={p.part[1]} r={7} className="about-dot-pulse" />
                <circle cx={p.part[0]} cy={p.part[1]} r={6} className="about-dot" />
              </g>
            )
          })}
        </svg>

        {BOARD_PARTS.map((p) => {
          const d = Math.hypot(p.part[0] - BOARD_CENTER[0], p.part[1] - BOARD_CENTER[1]) * 0.0011
          return (
            <div
              key={p.name}
              className={`callout callout-${p.side}`}
              style={
                {
                  left: `${((p.label[0] - BOARD_VIEW.x) / BOARD_VIEW.w) * 100}%`,
                  top: `${((p.label[1] - BOARD_VIEW.y) / BOARD_VIEW.h) * 100}%`,
                  '--d': `${d}s`,
                } as React.CSSProperties
              }
            >
              <div className="callout-inner">
                <div className="callout-name">{p.name}</div>
                <div className="callout-note">{p.note}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WhatIsOhmster() {
  return (
    <div className="notebook-text">
      <p>
        <span className="brand-name">
          <span className="cover-name-ohm">Ohm</span>ster
        </span>{' '}
        is a free tool designed for aspiring engineers who want to learn more about Electrical Engineering as a
        whole. This tool provides lessons on Electrical Engineering fundamentals and displays the underlying magic of
        typing in functions such as <code className="notebook-code">digitalWrite(HIGH, 3)</code>. The goal of this
        product is to lower the bar for entry for young engineers who want to learn about Instruction Set
        Architecture and Computer Engineering as a whole.
      </p>
    </div>
  )
}

export function LoginPage({ onLogin, onSignInIntent }: Props) {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null)
  const [leaving, setLeaving] = useState(false)
  // intro: the opening plays · dive: the camera dives into the label as the splash fades in · done
  const [stage, setStage] = useState<'intro' | 'dive' | 'done'>('intro')
  const [activeSection, setActiveSection] = useState('')
  // Bumped each time the What is Ohmster section's board scrolls back into view, to replay the slam.
  const [boardVisit, setBoardVisit] = useState(0)
  const pageRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const boardInView = useRef(false)
  const timers = useRef<number[]>([])

  const finishIntro = useCallback((skip: boolean) => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    if (skip) {
      setStage('done')
      return
    }
    setStage('dive')
    timers.current.push(window.setTimeout(() => setStage('done'), DIVE_MS))
  }, [])

  // With reduced motion the intro is skipped straight away.
  useEffect(() => {
    const reduced = prefersReducedMotion()
    const id = window.setTimeout(() => finishIntro(reduced), reduced ? 0 : INTRO_MS)
    timers.current.push(id)
    return () => timers.current.forEach(clearTimeout)
  }, [finishIntro])

  // Any key skips the intro.
  useEffect(() => {
    if (stage !== 'intro' || authMode) return
    const onKey = () => finishIntro(true)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stage, authMode, finishIntro])

  useEffect(() => {
    if (authMode) onSignInIntent?.()
  }, [authMode, onSignInIntent])

  // On scroll: reveal blocks coming into view, highlight the section being read, and replay the board
  // slam when it comes back into view.
  const handleScroll = useCallback(() => {
    const root = pageRef.current
    if (!root) return
    updateReveals(root)

    // How far the hero has scrolled away (0 to 1), for its parallax.
    const hero = heroRef.current
    if (hero) hero.style.setProperty('--hero-p', String(Math.min(1, root.scrollTop / Math.max(1, hero.offsetHeight))))

    const rootTop = root.getBoundingClientRect().top
    const line = rootTop + root.clientHeight / 3
    let current = ''
    root.querySelectorAll<HTMLElement>('[data-section]').forEach((el) => {
      if (el.getBoundingClientRect().top <= line) current = el.dataset.section ?? ''
    })
    if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2) current = SPLASH_SECTIONS[SPLASH_SECTIONS.length - 1].id
    setActiveSection(current)

    // The slam plays once the board's spot is well into view, and only plays again after the spot has
    // gone completely off screen, so it never replays on a board that's still visible.
    const board = root.querySelector('#splash-what .about-board-spot')?.getBoundingClientRect()
    if (board) {
      const viewBottom = rootTop + root.clientHeight
      const wellInView = board.top < rootTop + root.clientHeight * 0.7 && board.bottom > rootTop + root.clientHeight * 0.3
      const offScreen = board.bottom <= rootTop || board.top >= viewBottom
      if (wellInView && !boardInView.current) {
        boardInView.current = true
        setBoardVisit((v) => v + 1)
      } else if (offScreen) {
        boardInView.current = false
      }
    }
  }, [])

  // Reveal what's on screen once the splash appears.
  useEffect(() => {
    if (stage === 'intro') return
    const id = requestAnimationFrame(handleScroll)
    return () => cancelAnimationFrame(id)
  }, [stage, handleScroll])

  const scrollToSection = (id: string) => {
    document.getElementById(`splash-${id}`)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  }

  const closeAuth = useCallback(() => setAuthMode(null), [])

  const handleAuthSubmit = async (username: string, password: string) => {
    const account = await (authMode === 'create' ? signUp : logIn)(username, password)
    setLeaving(true)
    setTimeout(() => onLogin(account), 380)
  }

  const sectionBody = (id: string) => {
    switch (id) {
      case 'what':
        return (
          <>
            <WhatIsOhmster />
            {/* Not drawn until it's first reached: it's a second detailed board drawing */}
            <div className="about-board-spot">{boardVisit > 0 && <BoardDiagram visit={boardVisit} />}</div>
          </>
        )
      case 'mission':
        return <MissionPage />
      case 'features':
        return <FeaturesPage />
      case 'how':
        return <HowItWorksPage />
      case 'team':
        return <TeamSection />
      default:
        return null
    }
  }

  return (
    <div
      ref={pageRef}
      className={`landing${leaving ? ' landing-out' : ''}${authMode ? ' modal-open' : ''}${stage === 'intro' ? ' intro-playing' : ''}`}
      onScroll={handleScroll}
    >
      <nav className="landing-nav">
        <button type="button" className="nav-brand" onClick={() => pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>
          <HamsterWheel className="nav-hamster" />
          <span><BrandName /></span>
        </button>
        <div className="nav-links">
          {SPLASH_SECTIONS.map((sec) => (
            <button
              key={sec.id}
              type="button"
              className={`nav-link${activeSection === sec.id ? ' active' : ''}`}
              onClick={() => scrollToSection(sec.id)}
            >
              {sec.title}
            </button>
          ))}
        </div>
        <div className="nav-auth">
          <button type="button" className="nav-link" onClick={() => setAuthMode('signin')}>
            Log In
          </button>
          <button type="button" className="landing-btn primary small" onClick={() => setAuthMode('create')}>
            Sign Up
          </button>
        </div>
      </nav>

      <main className="splash">
        {/* The first screen after the intro: the wordmark (which the intro's dive hands off to), the
            phrase, and the way in */}
        <section ref={heroRef} className={`splash-hero${stage !== 'intro' ? ' enter' : ''}`} data-section="">
          <div className="hero-light" />
          <div className="hero-stage">
            <HeroWordmark active={stage !== 'intro'} />
            <p className="hero-phrase">From blink to bare metal.</p>
            <div className="hero-actions">
              <button type="button" className="hero-big primary" onClick={() => setAuthMode('create')}>
                Sign Up
              </button>
              <button type="button" className="hero-big" onClick={() => setAuthMode('signin')}>
                Log In
              </button>
            </div>
          </div>
          <button type="button" className="splash-scroll-cue" onClick={() => scrollToSection('what')} aria-label="Scroll down">
            ↓
          </button>
        </section>

        {SPLASH_SECTIONS.map((sec, i) => (
          <section key={sec.id} id={`splash-${sec.id}`} data-section={sec.id} className={`splash-page splash-page-${sec.id}`}>
            <div className="splash-sheet reveal">
              <header className="splash-sheet-head">
                <div className="splash-field splash-field-title">
                  <span className="splash-field-label">Title</span>
                  <h2>{sec.title}</h2>
                </div>
                <div className="splash-field">
                  <span className="splash-field-label">Page</span>
                  <span className="splash-field-value">{i + 1}</span>
                </div>
              </header>
              <div className="splash-sheet-body">{sectionBody(sec.id)}</div>
            </div>
          </section>
        ))}
      </main>

      <div className="intro-light" />
      {stage !== 'done' && (
        <div className={`intro-scene${stage === 'dive' ? ' diving' : ''}`} onClick={() => stage === 'intro' && finishIntro(true)}>
          <IntroTitle />
          <div className="intro-book-shadow" />
          <ClosedBook3D />
        </div>
      )}
      {stage === 'intro' && (
        <button type="button" className="intro-skip" onClick={() => finishIntro(true)}>
          Skip intro ›
        </button>
      )}

      {authMode && (
        <AuthModal mode={authMode} onModeChange={setAuthMode} onSubmit={handleAuthSubmit} onClose={closeAuth} />
      )}
    </div>
  )
}
