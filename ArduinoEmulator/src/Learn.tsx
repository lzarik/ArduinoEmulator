import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { HamsterWheel } from './HamsterWheel'
import { COURSE, type Lesson } from './lessons'
import { lessonDoc } from './lessonDoc'
import { LessonBody, Quiz } from './LessonDocument'

// The Learn tab: the course drawn as a circuit of LEDs, one per lesson, beside the selected lesson's
// document. Finishing a lesson's quiz lights its LED, and the trace between two lit LEDs lights too.
// The circuit is powered by Ohmster's hamster, who runs its wheel each time an LED comes on.

const ALL_LESSONS = COURSE.flatMap((unit, u) => unit.lessons.map((lesson) => ({ ...lesson, unit, unitNumber: u + 1 })))
const LESSON_INDEX = new Map(ALL_LESSONS.map((l, i) => [l.id, i]))
const LESSON_KEY = 'eexpo.learn.lesson'
const DONE_KEY = 'eexpo.learn.done'

function rememberedLesson() {
  try {
    const id = localStorage.getItem(LESSON_KEY)
    return ALL_LESSONS.find((l) => l.id === id)?.id ?? ALL_LESSONS[0].id
  } catch {
    return ALL_LESSONS[0].id
  }
}

function rememberedDone() {
  try {
    const ids = JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]')
    return new Set<string>(Array.isArray(ids) ? ids.filter((id) => LESSON_INDEX.has(id)) : [])
  } catch {
    return new Set<string>()
  }
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Not remembering progress is fine; it just won't survive a reload.
  }
}

// YouTube links are embedded; anything else is treated as a video file.
function youtubeEmbed(url: string) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
}

function LessonVideo({ lesson }: { lesson: Lesson }) {
  if (!lesson.video) {
    return (
      <div className="lesson-video placeholder">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5 L19 12 L8 19 Z" />
        </svg>
        <span>Video coming soon</span>
      </div>
    )
  }
  const embed = youtubeEmbed(lesson.video)
  return (
    <div className="lesson-video">
      {embed ? (
        <iframe src={embed} title={lesson.title} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
      ) : (
        <video src={lesson.video} controls />
      )}
    </div>
  )
}

interface LearnProps {
  /** Opens a lesson's example code in the editor, as a new project named after the lesson. */
  onTryCode: (code: string, lessonTitle: string) => void
}

export function Learn({ onTryCode }: LearnProps) {
  const [lessonId, setLessonId] = useState(rememberedLesson)
  const [done, setDone] = useState(rememberedDone)
  // The LED that was just lit, so only it plays the switch-on flicker.
  const [justLit, setJustLit] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const generatingTimer = useRef<number | undefined>(undefined)
  const docRef = useRef<HTMLElement>(null)
  const railRef = useRef<HTMLElement>(null)

  const index = LESSON_INDEX.get(lessonId) ?? 0
  const lesson = ALL_LESSONS[index]
  const doc = lessonDoc(lesson.id)
  const isDone = done.has(lesson.id)

  const open = (id: string) => {
    setLessonId(id)
    remember(LESSON_KEY, id)
  }

  // A new lesson starts at the top, and its LED is scrolled into view on the map.
  useEffect(() => {
    docRef.current?.scrollTo({ top: 0 })
    railRef.current?.querySelector('.rail-lesson.active')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [lessonId])

  useEffect(() => () => window.clearTimeout(generatingTimer.current), [])

  const complete = () => {
    if (done.has(lesson.id)) return
    const next = new Set(done).add(lesson.id)
    setDone(next)
    setJustLit(lesson.id)
    remember(DONE_KEY, JSON.stringify([...next]))
    setGenerating(true)
    window.clearTimeout(generatingTimer.current)
    generatingTimer.current = window.setTimeout(() => setGenerating(false), 2600)
  }

  const resetProgress = () => {
    if (!window.confirm('Turn off every LED and start the course again?')) return
    setDone(new Set())
    remember(DONE_KEY, '[]')
  }

  const lit = (i: number) => i >= 0 && i < ALL_LESSONS.length && done.has(ALL_LESSONS[i].id)

  return (
    <div className="learn">
      <nav className="circuit-rail" aria-label="Course" ref={railRef}>
        <div className="rail-head">
          <span>Course</span>
          <span className="rail-count">
            {done.size} of {ALL_LESSONS.length} lit
          </span>
        </div>

        <div className={`rail-power${lit(0) ? ' out-lit' : ''}`} style={{ '--led': COURSE[0].led } as CSSProperties}>
          <HamsterWheel running={generating} className="rail-hamster" />
          <span className="rail-power-label">
            <strong>5V</strong> hamster power
          </span>
        </div>

        {COURSE.map((unit, u) => {
          const first = LESSON_INDEX.get(unit.lessons[0].id) ?? 0
          return (
            <section key={unit.id} className="rail-unit" style={{ '--led': unit.led } as CSSProperties}>
              <div className={`rail-chip${lit(first) && (first === 0 || lit(first - 1)) ? ' through-lit' : ''}`}>
                <div className="rail-chip-body">
                  <span className="rail-chip-ref">U{u + 1}</span>
                  <span className="rail-chip-title">{unit.title}</span>
                </div>
              </div>
              <ol>
                {unit.lessons.map((l) => {
                  const i = LESSON_INDEX.get(l.id) ?? 0
                  const isLit = lit(i)
                  const classes = [
                    'rail-lesson',
                    l.id === lessonId && 'active',
                    isLit && 'lit',
                    l.id === justLit && 'just-lit',
                    isLit && (i === 0 || lit(i - 1)) && 'in-lit',
                    isLit && lit(i + 1) && 'out-lit',
                  ]
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        className={classes.filter(Boolean).join(' ')}
                        onClick={() => open(l.id)}
                        aria-current={l.id === lessonId ? 'page' : undefined}
                      >
                        <span className="rail-node">
                          <span className="rail-led" />
                        </span>
                        <span className="rail-lesson-number">{i + 1}</span>
                        <span className="rail-lesson-title">{l.title}</span>
                        <span className="sr-only">{isLit ? ' (complete)' : ''}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </section>
          )
        })}

        <div className={`rail-ground${lit(ALL_LESSONS.length - 1) ? ' in-lit' : ''}`} style={{ '--led': COURSE[COURSE.length - 1].led } as CSSProperties}>
          <span className="rail-pin">GND</span>
        </div>

        {done.size > 0 && (
          <button type="button" className="rail-reset" onClick={resetProgress}>
            Reset progress
          </button>
        )}
      </nav>

      <article className="learn-doc-scroll" ref={docRef}>
        <div className="learn-doc" style={{ '--led': lesson.unit.led } as CSSProperties}>
          <div className="learn-breadcrumb">
            Unit {lesson.unitNumber}: {lesson.unit.title} · Lesson {index + 1} of {ALL_LESSONS.length}
          </div>
          <h1>{lesson.title}</h1>
          <p className="learn-lede">{lesson.summary}</p>
          <LessonVideo lesson={lesson} />

          {doc ? <LessonBody blocks={doc.blocks} onTryCode={(code) => onTryCode(code, lesson.title)} /> : <p>This lesson hasn't been written yet.</p>}

          {doc && doc.quiz.length > 0 && <Quiz key={lesson.id} questions={doc.quiz} onComplete={complete} />}

          <div className={`learn-status${isDone ? ' done' : ''}`}>
            <span className="learn-status-led" />
            {isDone ? (
              <span>
                <strong>Lesson complete.</strong> LED {index + 1} is lit.
              </span>
            ) : doc && doc.quiz.length > 0 ? (
              <span>Answer every question above correctly to light this lesson's LED.</span>
            ) : (
              <button type="button" className="wb-btn" onClick={complete}>
                Mark lesson complete
              </button>
            )}
          </div>

          <div className="learn-nav">
            <button type="button" className="wb-btn" disabled={index === 0} onClick={() => open(ALL_LESSONS[index - 1].id)}>
              ← Previous
            </button>
            <button
              type="button"
              className={`wb-btn${isDone ? ' primary' : ''}`}
              disabled={index === ALL_LESSONS.length - 1}
              onClick={() => open(ALL_LESSONS[index + 1].id)}
            >
              Next lesson →
            </button>
          </div>
        </div>
      </article>
    </div>
  )
}
