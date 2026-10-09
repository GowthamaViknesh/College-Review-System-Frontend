import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi } from '../api/resources'
import { onUnauthorized, tokenStore } from '../lib/api'
import type { User } from '../lib/types'

interface AuthValue {
  // null when nobody is logged in
  user: User | null
  // True while the stored token is being checked on page load
  loading: boolean
  // Whether the logged-in user's role grants a permission, e.g. can('college:create').
  // This only decides what to show; the API enforces the same rule on every request.
  can: (permission: string) => boolean
  login: (token: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState(tokenStore.get)

  const logout = useCallback(() => {
    tokenStore.clear()
    setToken(null)
    // Drop everything fetched for the previous user
    queryClient.clear()
  }, [queryClient])

  const login = useCallback((newToken: string) => {
    tokenStore.set(newToken)
    setToken(newToken)
  }, [])

  // If the API stops accepting the token (expired, account deleted), fall back to the login page
  useEffect(() => onUnauthorized(logout), [logout])

  // Who am I, and what am I allowed to do? Permissions come from the server, never from the token.
  const me = useQuery({
    queryKey: ['me', token],
    queryFn: () => authApi.me().then((result) => result.data),
    enabled: Boolean(token),
    staleTime: 60_000,
    retry: false,
  })

  const value = useMemo<AuthValue>(() => {
    const permissions = new Set(me.data?.permissions)
    return {
      user: token ? (me.data?.user ?? null) : null,
      loading: Boolean(token) && me.isPending,
      can: (permission) => permissions.has(permission),
      login,
      logout,
    }
  }, [token, me.data, me.isPending, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
