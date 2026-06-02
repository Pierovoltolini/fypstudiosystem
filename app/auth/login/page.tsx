'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FypLogo from '@/components/ui/FypLogo'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/admin'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push(redirectTo)
        router.refresh()
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        })
        if (error) throw error
        setError('Revisá tu email para confirmar la cuenta.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setError(msg === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-2">
            <FypLogo size={36} />
            <span className="font-bold text-xl tracking-tight">FYP.STUDIO</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'login' ? 'Iniciá sesión en tu panel' : 'Creá tu cuenta'}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com" className="input-base" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                {mode === 'login' && (
                  <Link href="/auth/reset-password" className="text-xs text-gray-500 hover:text-gray-800 transition-colors">
                    ¿Olvidaste tu contraseña?
                  </Link>
                )}
              </div>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" className="input-base" minLength={6} />
            </div>
            {error && (
              <div className={`rounded-xl px-4 py-3 text-sm ${error.includes('Revisá') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-black py-3 text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-50 active:scale-[0.98]">
              {loading ? 'Cargando...' : mode === 'login' ? 'Entrar al panel' : 'Crear cuenta'}
            </button>
          </form>
        </div>
        <p className="text-center text-sm text-gray-500 mt-4">
          {mode === 'login' ? '¿No tenés cuenta? ' : '¿Ya tenés cuenta? '}
          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}
            className="font-medium text-gray-900 hover:underline">
            {mode === 'login' ? 'Registrate' : 'Iniciá sesión'}
          </button>
        </p>
      </div>
    </div>
  )
}
