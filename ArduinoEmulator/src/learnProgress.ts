import { apiFetch } from './account'

// The signed-in account's progress through the Learn course, kept by the C# API
// (API/Controllers/LearnController.cs): which lessons are finished, and which one was open.

export interface LearnProgress {
  /** Finished lessons' ids, in the order they were finished */
  completed: string[]
  currentLesson: string | null
}

// Before accounts, progress was saved in the browser under these keys. Like projects (see projects.ts),
// the first account to sign in on this browser takes it over, and the old copy is kept as a backup.
const BROWSER_DONE_KEY = 'eexpo.learn.done'
const BROWSER_LESSON_KEY = 'eexpo.learn.lesson'
const BROWSER_BACKUP_KEY = 'ohmster.learn.imported'

export async function fetchLearnProgress(): Promise<LearnProgress> {
  const response = await apiFetch('/Learn/Progress')
  if (!response.ok) throw new Error(`Couldn't load Learn progress (${response.status})`)
  return (await response.json()) as LearnProgress
}

export async function saveCompletedLesson(lessonId: string) {
  const response = await apiFetch(`/Learn/Completed/${encodeURIComponent(lessonId)}`, { method: 'PUT' })
  if (!response.ok) throw new Error(`Couldn't save progress (${response.status})`)
}

export async function resetLearnProgress() {
  const response = await apiFetch('/Learn/Completed', { method: 'DELETE' })
  if (!response.ok) throw new Error(`Couldn't reset progress (${response.status})`)
}

export async function saveCurrentLesson(lessonId: string) {
  await apiFetch('/Learn/CurrentLesson', { method: 'PUT', body: JSON.stringify({ lessonId }) })
}

/** Moves Learn progress saved in this browser from before accounts into the signed-in account. */
export async function importBrowserLearnProgress() {
  let done: string | null = null
  let lesson: string | null = null
  try {
    done = localStorage.getItem(BROWSER_DONE_KEY)
    lesson = localStorage.getItem(BROWSER_LESSON_KEY)
  } catch {
    return
  }
  if (done === null && lesson === null) return

  let ids: string[] = []
  try {
    const parsed = JSON.parse(done ?? '[]')
    if (Array.isArray(parsed)) ids = parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    // Unreadable: just the open lesson, if any
  }
  // Only forget it once it's all safely on the server
  await Promise.all(ids.map(saveCompletedLesson))
  if (lesson) await saveCurrentLesson(lesson)
  try {
    localStorage.setItem(BROWSER_BACKUP_KEY, JSON.stringify({ done: ids, lesson }))
    localStorage.removeItem(BROWSER_DONE_KEY)
    localStorage.removeItem(BROWSER_LESSON_KEY)
  } catch {
    // It's saved to the account either way
  }
}
