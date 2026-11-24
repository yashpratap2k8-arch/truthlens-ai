import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, getToken, setToken } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }
    api.auth
      .me()
      .then((res) => {
        if (res && res.user) setUser(res.user)
      })
      .catch(() => {
        setToken(null)
        setUser(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const loginWithCredential = useCallback(async (credential) => {
    setAuthError('')
    try {
      const res = await api.auth.google(credential)
      if (res && res.token && res.user) {
        setToken(res.token)
        setUser(res.user)
        return res.user
      }
    } catch (err) {
      const msg = err.message || 'Google sign-in failed. Please try again.'
      setAuthError(msg)
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.auth.logout()
    } catch {
      /* ignore */
    } finally {
      setToken(null)
      setUser(null)
      setAuthError('')
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        setAuthError,
        loginWithCredential,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
