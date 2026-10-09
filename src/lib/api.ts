import type { FieldError, Meta } from './types'

const BASE = '/api/v1'
const TOKEN_KEY = 'college-reviews.token'

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

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

// Called when the API rejects a token we sent (expired, or the account was deleted)
let handleUnauthorized = () => {}
export function onUnauthorized(handler: () => void) {
  handleUnauthorized = handler
}

type Query = Record<string, string | number | null | undefined>

interface Options {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Query
}

export interface ApiResult<T> {
  data: T
  meta?: Meta
}

export async function request<T>(path: string, { method = 'GET', body, query = {} }: Options = {}): Promise<ApiResult<T>> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const url = `${BASE}${path}${params.size ? `?${params}` : ''}`
  const token = tokenStore.get()

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the API is running.')
  }

  if (response.status === 204) return { data: undefined as T }

  const json = await response.json().catch(() => null)
  if (!response.ok) {
    // A 401 without a token is just a wrong password on the login form, not an expired session
    if (response.status === 401 && token) handleUnauthorized()
    throw new ApiError(response.status, json?.message ?? `Request failed (${response.status})`, json?.errors ?? [])
  }
  return { data: json.data, meta: json.meta }
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}
