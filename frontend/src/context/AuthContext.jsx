import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, refreshAccessToken, setAccessToken, setAuthLostHandler } from '../api/client'

const AuthContext = createContext(null)

const GUEST = { status: 'guest', user: null, permissions: [] }

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null, permissions: [] })

  const loadProfile = useCallback(async () => {
    const data = await api.get('/auth/me')
    setState({ status: 'authed', user: data.user, permissions: data.permissions })
    return data
  }, [])

  // On page load, silently restore the session from the refresh cookie
  useEffect(() => {
    setAuthLostHandler(() => setState(GUEST))
    let cancelled = false
    ;(async () => {
      try {
        await refreshAccessToken()
        await loadProfile()
      } catch {
        if (!cancelled) setState(GUEST)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadProfile])

  const startSession = useCallback(
    async (data) => {
      setAccessToken(data.accessToken)
      await loadProfile()
      return data
    },
    [loadProfile],
  )

  const login = useCallback(
    async (credentials) => startSession(await api.post('/auth/login', credentials, { auth: false })),
    [startSession],
  )

  const register = useCallback(
    async (payload) => startSession(await api.post('/auth/register', payload, { auth: false })),
    [startSession],
  )

  const changePassword = useCallback(
    async (currentPassword, newPassword) =>
      startSession(await api.post('/auth/change-password', { currentPassword, newPassword })),
    [startSession],
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {}, { auth: false })
    } finally {
      setAccessToken(null)
      setState(GUEST)
    }
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      login,
      register,
      logout,
      changePassword,
      has: (permission) => state.permissions.includes(permission),
    }),
    [state, login, register, logout, changePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
