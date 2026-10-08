/**
 * src/auth/AuthContext.tsx
 *
 * Provides the current Supabase auth session (user + session) to the app via
 * React context.  In local-only mode (no Supabase credentials) the context
 * always exposes a null user and a no-op signIn/signOut.
 *
 * Auth events update the context in real time via onAuthStateChange, so every
 * component reading useAuth() automatically re-renders on sign-in / sign-out.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './supabase'

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

export interface AuthState {
  /** The signed-in user, or null in local mode / signed-out. */
  user: User | null
  /** The active session, or null. */
  session: Session | null
  /** True while the initial auth check is in flight. */
  loading: boolean
  /** True when Supabase credentials are present in the environment. */
  supabaseEnabled: boolean
  /** Sign in with a magic-link email. No-op in local mode. */
  signInWithEmail: (email: string) => Promise<{ error: string | null }>
  /** Sign in with OAuth provider. No-op in local mode. */
  signInWithOAuth: (provider: 'google' | 'github') => Promise<{ error: string | null }>
  /** Sign out the current user. No-op in local mode. */
  signOut: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthState | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured) // only loading if Supabase is configured

  useEffect(() => {
    if (!supabase) {
      // In local-only mode loading was initialized to false, nothing to do.
      return
    }

    // Get the initial session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })

    // Listen for future auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function signInWithEmail(email: string): Promise<{ error: string | null }> {
    if (!supabase) return { error: null }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    return { error: error?.message ?? null }
  }

  async function signInWithOAuth(provider: 'google' | 'github'): Promise<{ error: string | null }> {
    if (!supabase) return { error: null }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    })
    return { error: error?.message ?? null }
  }

  async function signOut(): Promise<void> {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  const value: AuthState = {
    user,
    session,
    loading,
    supabaseEnabled: isSupabaseConfigured,
    signInWithEmail,
    signInWithOAuth,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
