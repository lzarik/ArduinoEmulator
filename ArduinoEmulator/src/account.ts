import { API_BASE_URL } from './api'

// Ohmster accounts, kept by the C# API (API/Controllers/AuthController.cs). Being signed in is an
// HttpOnly cookie the API sets, so every call here (and in projects.ts) sends credentials.

export interface Account {
  username: string
}

/** A request the API turned down, with its message for the form (e.g. "That username is taken."). */
export class AccountError extends Error {}

export async function apiFetch(path: string, init: RequestInit = {}) {
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: init.body ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
    })
  } catch {
    throw new AccountError("Can't reach the Ohmster server. Check that the API is running, then try again.")
  }
}

/** Who's signed in from an earlier visit, or null. */
export async function currentAccount(): Promise<Account | null> {
  const response = await apiFetch('/Auth/Me', { signal: AbortSignal.timeout(4000) })
  return response.ok ? ((await response.json()) as Account) : null
}

async function submit(path: string, username: string, password: string): Promise<Account> {
  const response = await apiFetch(path, { method: 'POST', body: JSON.stringify({ username, password }) })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new AccountError(body?.detail ?? 'Something went wrong. Please try again.')
  return body as Account
}

export const signUp = (username: string, password: string) => submit('/Auth/SignUp', username, password)
export const logIn = (username: string, password: string) => submit('/Auth/LogIn', username, password)

export async function logOut() {
  await apiFetch('/Auth/LogOut', { method: 'POST' }).catch(() => undefined)
}
