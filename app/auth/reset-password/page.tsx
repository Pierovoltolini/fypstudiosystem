'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import FypLogo from '@/components/ui/FypLogo'

export default function ResetPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-2">
            <FypLogo size={36} />
            <span className="font-bold text-xl tracking-tight">FYP.STUDIO</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">Recuperar contraseña</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          {sent ? (
            <div className="text-center py-2">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1">Email enviado</p>
              <p className="text-sm text-gray-500">
                Revisá tu bandeja de entrada y seguí el link para crear una nueva contraseña.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-gray-600">
                Ingresá tu email y te enviamos un link para restablecer tu contraseña.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com" className="input-base"
                />
              </div>
              {error && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              )}
              <button type="submit" disabled={loading}
                className="w-full rounded-xl bg-black py-3 text-sm font-medium text-white
                           hover:bg-gray-800 transition-colors disabled:opacity-50 active:scale-[0.98]">
                {loading ? 'Enviando...' : 'Enviar link de recuperación'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          <Link href="/auth/login" className="font-medium text-gray-900 hover:underline">
            ← Volver al login
          </Link>
        </p>
      </div>
    </div>
  )
}
