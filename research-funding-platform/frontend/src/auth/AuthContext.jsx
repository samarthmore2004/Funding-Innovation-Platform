import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getErrorMessage, setUnauthorizedHandler, tokenStore } from '../api/client'
import { authApi } from '../api/auth'

const AuthContext = createContext(null)

/** Only an explicit auth rejection invalidates a stored token; outages must not log people out. */
const isAuthRejection = (error) => [401, 403].includes(error?.response?.status)

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()))
  // Set when a stored session could not be verified because the API was unreachable or failed.
  const [sessionError, setSessionError] = useState(null)

  const refreshUser = useCallback(async () => {
    const me = await authApi.me()
    setUser(me)
    return me
  }, [])

  const restoreSession = useCallback(async () => {
    if (!tokenStore.get()) {
      setLoading(false)
      return
    }
    setLoading(true)
    setSessionError(null)
    try {
      await refreshUser()
    } catch (error) {
      if (isAuthRejection(error)) {
        tokenStore.clear()
        setUser(null)
      } else {
        setSessionError(getErrorMessage(error))
      }
    } finally {
      setLoading(false)
    }
  }, [refreshUser])

  // Restore the session from a stored token on first load.
  useEffect(() => {
    restoreSession()
  }, [restoreSession])

  // Any 401 from the API (expired/invalid token) ends the session.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      setSessionError(null)
      const from = `${window.location.pathname}${window.location.search}`
      navigate('/login', { replace: true, state: { expired: true, from } })
    })
    return () => setUnauthorizedHandler(null)
  }, [navigate])

  const acceptToken = useCallback((payload) => {
    tokenStore.set(payload.access_token)
    setSessionError(null)
    setUser(payload.user)
    return payload.user
  }, [])

  const login = useCallback(async (email, password) => acceptToken(await authApi.login({ email, password })), [acceptToken])

  const register = useCallback(async (payload) => acceptToken(await authApi.register(payload)), [acceptToken])

  const loginWithToken = useCallback(
    async (token) => {
      tokenStore.set(token)
      try {
        return await refreshUser()
      } catch (error) {
        tokenStore.clear()
        throw error
      }
    },
    [refreshUser],
  )

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    setSessionError(null)
    navigate('/login', { replace: true })
  }, [navigate])

  const hasRole = useCallback((...roles) => Boolean(user && roles.includes(user.role)), [user])

  const value = useMemo(
    () => ({ user, setUser, loading, sessionError, restoreSession, login, register, loginWithToken, logout, refreshUser, hasRole }),
    [user, loading, sessionError, restoreSession, login, register, loginWithToken, logout, refreshUser, hasRole],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
