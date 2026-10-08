/**
 * src/features/auth/AuthPanel.tsx
 *
 * Sign-in and account management UI.
 * Only visible when Supabase is configured (isSupabaseConfigured = true).
 * In local-only mode this component renders nothing.
 */
import { useState } from 'react'
import { LogIn, LogOut, Mail, User as UserIcon, Github } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { AlertBanner } from '../../components/AlertBanner'

export function AuthPanel() {
  const { user, loading, supabaseEnabled, signInWithEmail, signInWithOAuth, signOut } = useAuth()

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  // Local-only mode: render nothing
  if (!supabaseEnabled) return null

  if (loading) return null

  if (user) {
    return (
      <div className="auth-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <UserIcon size={14} style={{ color: 'var(--slate-400)' }} aria-hidden="true" />
        <span style={{ fontSize: '0.8rem', color: 'var(--slate-300)', maxWidth: '14rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.email}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          id="auth-sign-out-btn"
          onClick={() => void signOut()}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={13} />
          <span>Sign out</span>
        </button>
      </div>
    )
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setWorking(true)
    setError(null)
    const { error: err } = await signInWithEmail(email.trim())
    setWorking(false)
    if (err) {
      setError(err)
    } else {
      setSent(true)
    }
  }

  async function handleOAuth(provider: 'google' | 'github') {
    setWorking(true)
    setError(null)
    const { error: err } = await signInWithOAuth(provider)
    setWorking(false)
    if (err) setError(err)
  }

  return (
    <div
      className="card"
      style={{ maxWidth: '28rem', margin: '0 auto' }}
      aria-labelledby="auth-panel-heading"
      role="region"
    >
      <h2 id="auth-panel-heading" style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--slate-200)' }}>
        Sign in to sync your plans
      </h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--slate-400)', marginBottom: '1.25rem' }}>
        Your data is stored locally when not signed in. Sign in to save plans
        across devices. Your plans are private and no other user can access them.
      </p>

      {error && (
        <AlertBanner variant="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </AlertBanner>
      )}

      {sent ? (
        <AlertBanner variant="success">
          Check your email — we sent a magic link to <strong>{email}</strong>.
        </AlertBanner>
      ) : (
        <>
          {/* Magic-link email */}
          <form onSubmit={(e) => void handleMagicLink(e)} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            <label htmlFor="auth-email-input" style={{ fontSize: '0.82rem', color: 'var(--slate-300)', fontWeight: 600 }}>
              Email address
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="auth-email-input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-required="true"
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                id="auth-magic-link-btn"
                disabled={working || !email.trim()}
              >
                <Mail size={13} />
                {working ? 'Sending…' : 'Send link'}
              </button>
            </div>
          </form>

          {/* OAuth providers */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              id="auth-google-btn"
              onClick={() => void handleOAuth('google')}
              disabled={working}
              style={{ flex: 1 }}
            >
              <LogIn size={13} />
              Continue with Google
            </button>
            <button
              className="btn btn-secondary"
              id="auth-github-btn"
              onClick={() => void handleOAuth('github')}
              disabled={working}
              style={{ flex: 1 }}
            >
              <Github size={13} />
              Continue with GitHub
            </button>
          </div>
        </>
      )}
    </div>
  )
}
