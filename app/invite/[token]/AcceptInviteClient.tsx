// app/invite/[token]/AcceptInviteClient.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AcceptInviteClient({
  token, inviteEmail, primaryColor,
}: {
  token: string
  inviteEmail: string
  primaryColor: string
}) {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode]       = useState<'signup' | 'login'>('signup')
  const [email, setEmail]     = useState(inviteEmail)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (mode === 'signup') {
        const { error: signUpErr } = await supabase.auth.signUp({ email, password })
        if (signUpErr) throw signUpErr
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signInErr) throw signInErr
      }

      const res = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Error al aceptar la invitación')

      router.push('/admin')
      router.refresh()

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setError(
        msg.includes('already registered')  ? 'Este email ya tiene una cuenta. Iniciá sesión o usá Google.' :
        msg.includes('Invalid login')        ? 'Email o contraseña incorrectos. Si usás Gmail, probá con el botón de Google.' :
        msg
      )
      if (msg.includes('already registered')) setMode('login')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true)
    setError(null)
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // After OAuth, Google redirects back here → page.tsx detects user and auto-accepts
        redirectTo: window.location.href,
      },
    })
    if (oauthErr) {
      setError(oauthErr.message)
      setLoading(false)
    }
    // On success: browser redirects to Google, then back — no need to setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">

      {/* Google sign-in */}
      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-gray-200
                   bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50
                   transition-colors disabled:opacity-40 mb-4"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
        </svg>
        Continuar con Google
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-xs text-gray-400">o con email y contraseña</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 mb-4">
        {(['signup', 'login'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all"
            style={mode === m ? { background: 'white', color: primaryColor, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: '#6B7280' }}
          >
            {m === 'signup' ? 'Crear cuenta' : 'Ya tengo cuenta'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                       focus:outline-none focus:border-gray-400 transition-colors"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : ''}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                       focus:outline-none focus:border-gray-400 transition-colors"
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl py-2.5 text-sm font-semibold text-white
                     transition-all hover:opacity-90 disabled:opacity-40 mt-1"
          style={{ background: primaryColor }}
        >
          {loading ? 'Un momento…' : mode === 'signup' ? 'Crear cuenta y unirme' : 'Iniciar sesión y unirme'}
        </button>
      </form>
    </div>
  )
}
