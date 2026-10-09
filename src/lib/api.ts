import type { FieldError, Meta } from './types'

// Where the API is. While developing this is empty: requests go to the Vite dev server, which forwards
// /api to the backend. For a deployed site, VITE_API_URL is the backend's address (set at build time),
// because the frontend and the backend are then on different hosts.
const API_URL = String(import.meta.env.VITE_API_URL ?? '')
  .trim()
  .replace(/\/+$/, '')
const BASE = `${API_URL}/api/v1`
const TOKEN_KEY = 'college-reviews.token'
const REFRESH_KEY = 'college-reviews.refresh-token'

// An error response from the API: the status, the message, and any per-field validation errors
export class ApiError extends Error {
  status: number
  errors: FieldError[]

  constructor(status: number, message: string, errors: FieldError[] = []) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

// Being logged in means holding two tokens. The access token goes with every request and lasts minutes.
// The refresh token lasts days and is only ever sent to get the next pair, after which it stops working.
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (token: string, refreshToken: string) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(REFRESH_KEY, refreshToken)
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

// Called when the login can no longer be continued (refresh token expired, account deleted, password changed elsewhere)
let handleUnauthorized = () => {}
export function onUnauthorized(handler: () => void) {
  handleUnauthorized = handler
}

// ---------- Keeping the login alive ----------

// When the access token runs out, read from the token itself. No expiry found means "do not know".
function expiresAt(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

// About to run out: renew first, instead of sending a request that is certain to be refused
const EXPIRY_MARGIN_MS = 20_000
function isExpiring(token: string) {
  const expiry = expiresAt(token)
  return expiry !== null && expiry - Date.now() < EXPIRY_MARGIN_MS
}

// renewed: there is a new access token.  ended: the login is over.  unknown: the server could not be asked.
type Renewal = 'renewed' | 'ended' | 'unknown'

async function renew(staleToken: string): Promise<Renewal> {
  // Another tab shares this storage and may have renewed already; its tokens are ours too
  const renewedElsewhere = () => {
    const current = tokenStore.get()
    return current !== null && current !== staleToken
  }
  if (renewedElsewhere()) return 'renewed'

  const refreshToken = tokenStore.getRefresh()
  if (!refreshToken) return 'ended'

  let response: Response
  try {
    response = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) })
  } catch {
    return 'unknown'
  }

  if (response.ok) {
    const json = await response.json().catch(() => null)
    if (!json?.data?.token || !json.data.refreshToken) return 'unknown'
    tokenStore.set(json.data.token, json.data.refreshToken)
    return 'renewed'
  }
  // 400 and 401 are the server saying the refresh token is no good. Anything else (too many requests,
  // a server fault) says nothing about the login, so it must not log the person out.
  if (response.status === 400 || response.status === 401) return renewedElsewhere() ? 'renewed' : 'ended'
  return 'unknown'
}

// A refresh token works once, so several requests failing together must share one renewal
let renewal: Promise<Renewal> | null = null
function renewOnce(staleToken: string) {
  renewal ??= renew(staleToken).finally(() => {
    renewal = null
  })
  return renewal
}

// ---------- Requests ----------

type Query = Record<string, string | number | null | undefined>

interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Query
}

export interface ApiResult<T> {
  data: T
  meta?: Meta
}

// Logging in, registering, logging out and resetting a forgotten password do not depend on an existing
// login, so a 401 from them (a wrong password, say) is an answer to show, not a reason to renew anything
const NO_SESSION = ['/auth/login', '/auth/register', '/auth/logout', '/auth/forgot-password', '/auth/reset-password']

const SESSION_ENDED = 'Your session has ended. Please log in again.'

export async function request<T>(path: string, { method = 'GET', body, query = {} }: Options = {}): Promise<ApiResult<T>> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const url = `${BASE}${path}${params.size ? `?${params}` : ''}`
  // A form with a file in it is sent as it is; the browser adds the right Content-Type itself
  const isForm = body instanceof FormData
  const usesSession = !NO_SESSION.includes(path)

  const send = async (token: string | null) => {
    try {
      return await fetch(url, {
        method,
        headers: {
          ...(body !== undefined && !isForm && { 'Content-Type': 'application/json' }),
          ...(token && usesSession && { Authorization: `Bearer ${token}` }),
        },
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      })
    } catch {
      throw new ApiError(0, 'Cannot reach the server. Check that the API is running.')
    }
  }

  const endSession = () => {
    handleUnauthorized()
    return new ApiError(401, SESSION_ENDED)
  }

  let token = tokenStore.get()
  if (token && usesSession && isExpiring(token)) {
    if ((await renewOnce(token)) === 'ended') throw endSession()
    token = tokenStore.get()
  }

  let response = await send(token)

  // Refused although a token was sent: it expired on the way, or the clocks disagree. Renew and try once more.
  let retried = false
  if (response.status === 401 && token && usesSession) {
    const outcome = await renewOnce(token)
    if (outcome === 'ended') throw endSession()
    if (outcome === 'renewed') {
      response = await send(tokenStore.get())
      retried = true
    }
  }

  if (response.status === 204) return { data: undefined as T }

  const json = await response.json().catch(() => null)
  if (!response.ok) {
    // Still refused with a fresh token: the account is gone or its password was changed.
    // (If renewing could not even be attempted, the login may be fine, so it is left alone.)
    if (response.status === 401 && retried) handleUnauthorized()
    throw new ApiError(response.status, json?.message ?? `Request failed (${response.status})`, json?.errors ?? [])
  }
  return { data: json.data, meta: json.meta }
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}
