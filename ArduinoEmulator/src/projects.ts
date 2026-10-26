import { apiFetch } from './account'
import { defaultCircuit, newId, type Circuit } from './circuit'

// Saved projects belong to the signed-in account and are kept by the C# API
// (API/Controllers/ProjectsController.cs), so they follow the account to any computer.

export interface Project {
  id: string
  name: string
  code: string
  circuit: Circuit
  updatedAt: number
}

// Before accounts, projects were saved in the browser under this key. The first account to sign in on
// this browser takes them over; the old copy is kept under BROWSER_BACKUP_KEY just in case.
const BROWSER_KEY = 'eexpo.projects'
const BROWSER_BACKUP_KEY = 'ohmster.projects.imported'

// New projects start with an empty sketch: the Arduino include and the two functions every Arduino
// program needs (an empty file won't compile), with nothing inside them.
export const BLANK_SKETCH = `#include <Arduino.h>

void setup()
{
}

void loop()
{
}
`

/** "just now", "5 min ago", "3 h ago", or the date for anything older than a day. */
export function timeAgo(t: number) {
  const minutes = Math.round((Date.now() - t) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return new Date(t).toLocaleDateString()
}

export function newProject(name = 'Untitled project'): Project {
  return { id: newId(), name, code: BLANK_SKETCH, circuit: defaultCircuit(), updatedAt: Date.now() }
}

/** The signed-in account's projects, newest first. Throws if the API can't be reached. */
export async function fetchProjects(): Promise<Project[]> {
  const response = await apiFetch('/Projects')
  if (!response.ok) throw new Error(`Couldn't load projects (${response.status})`)
  return ((await response.json()) as Project[]).sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Creates or updates the project on the server. Throws if it wasn't saved. */
export async function uploadProject(project: Project) {
  const response = await apiFetch(`/Projects/${encodeURIComponent(project.id)}`, { method: 'PUT', body: JSON.stringify(project) })
  if (!response.ok) throw new Error(`Couldn't save "${project.name}" (${response.status})`)
}

export async function deleteSavedProject(id: string) {
  const response = await apiFetch(`/Projects/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(`Couldn't delete the project (${response.status})`)
}

/** Moves any projects saved in this browser from before accounts into the signed-in account. */
export async function importBrowserProjects() {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(BROWSER_KEY)
  } catch {
    return
  }
  if (!raw) return
  let list: Project[] = []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) list = parsed
  } catch {
    // Unreadable: leave it where it is
    return
  }
  // Only forget them once every one is safely on the server
  await Promise.all(list.map(uploadProject))
  try {
    localStorage.setItem(BROWSER_BACKUP_KEY, raw)
    localStorage.removeItem(BROWSER_KEY)
  } catch {
    // They're saved to the account either way
  }
}
