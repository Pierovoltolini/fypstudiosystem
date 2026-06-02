'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FypLogo from '@/components/ui/FypLogo'

export default function UpdatePasswordPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [checking,  setChecking]  = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [hasSession, setHasSession] = useState(false)

  // Verify there's an active recovery session before showing the form
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session)
      setChecking(false)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    if (password.length < 6)  { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    setLoading(true); setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push('/admin')
    router.refresh()
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin" />
      </div>
    )
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <p className="text-sm text-gray-600 mb-4">
            El link de recuperación es inválido o ya expiró.
          </p>
          <a href="/auth/reset-password"
            className="text-sm font-medium text-gray-900 hover:underline">
            Solicitar un nuevo link →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-2">
            <FypLogo size={36} />
            <span className="font-bold text-xl tracking-tight">FYP.STUDIO</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">Crear nueva contraseña</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nueva contraseña</label>
              <input
                type="password" required value={password} minLength={6}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres" className="input-base"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
              <input
                type="password" required value={confirm} minLength={6}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repetí la contraseña" className="input-base"
              />
            </div>
            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-black py-3 text-sm font-medium text-white
                         hover:bg-gray-800 transition-colors disabled:opacity-50 active:scale-[0.98]">
              {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
