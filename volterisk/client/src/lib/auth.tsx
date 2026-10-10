import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, clearToken, getToken, setToken } from './api.ts'
import type { Profile } from './types.ts'

type AuthValue = {
  me: Profile | null
  loading: boolean
  refresh: () => Promise<void>
  applyCash: (cash: number) => void
  /** Optimistic spend: card users debit vault; others debit pocket cash. */
  applySpend: (amount: number) => void
  patchMe: (update: (current: Profile) => Profile) => void
  login: (token: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(Boolean(getToken()))

  async function refresh() {
    setMe(await api<Profile>('/api/me'))
  }

  function applyCash(cash: number) {
    setMe((current) => (current ? { ...current, cash } : current))
  }

  function applySpend(amount: number) {
    setMe((current) => {
      if (!current || amount <= 0) return current
      if (current.vaultCreditCard) {
        return {
          ...current,
          vault: { ...current.vault, balance: Math.max(0, current.vault.balance - amount) },
        }
      }
      return { ...current, cash: Math.max(0, current.cash - amount) }
    })
  }

  function patchMe(update: (current: Profile) => Profile) {
    setMe((current) => (current ? update(current) : current))
  }

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    refresh()
      .catch(() => {
        clearToken()
        setMe(null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function login(token: string) {
    setToken(token)
    await refresh()
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } catch {
      /* local session still ends */
    }
    clearToken()
    setMe(null)
  }

  return (
    <AuthContext.Provider value={{ me, loading, refresh, applyCash, applySpend, patchMe, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider missing')
  return value
}
