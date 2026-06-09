import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Lock, ExternalLink } from 'lucide-react'
import type { CustomModule } from '@/types'
import SectionTour from '@/components/admin/SectionTour'

export const metadata = { title: 'Módulos personalizados' }
export const dynamic = 'force-dynamic'

export default async function CustomModulesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('business_id').eq('user_id', user.id).single()
  if (!profile?.business_id) redirect('/admin/onboarding')

  const { data: modules } = await supabase
    .from('custom_modules')
    .select('*')
    .eq('business_id', profile.business_id)
    .order('sort_order')
    .order('created_at')

  const all       = (modules ?? []) as CustomModule[]
  const active    = all.filter(m => m.active)
  const pending   = all.filter(m => !m.active)
  const freeUsed  = all.filter(m => !m.is_paid).length
  const canAddFree = freeUsed < 1

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionTour section="custom_modules" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Módulos personalizados</h1>
          <p className="text-sm text-gray-500 mt-1">Creá secciones a medida para tu negocio con ayuda de la IA.</p>
        </div>
        <Link href="/admin/custom-modules/new"
          className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5
                     text-sm font-semibold text-white hover:bg-gray-700 transition-all">
          <Plus size={14} /> Nuevo módulo
        </Link>
      </div>

      {/* Free quota banner */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">
            {canAddFree ? 'Tenés 1 módulo gratis disponible' : 'Módulo gratis usado'}
          </p>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            canAddFree ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
          }`}>
            {freeUsed}/1 gratis
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Los módulos adicionales se crean pero quedan pendientes de activación — te contactamos para habilitarlos.
        </p>
      </div>

      {/* Active modules */}
      {active.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Activos</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {active.map(m => (
              <Link key={m.id} href={`/admin/custom-modules/${m.id}`}
                className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200
                           hover:shadow-sm transition-all group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 text-sm font-bold">
                      {m.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                      {m.description && (
                        <p className="text-xs text-gray-400 truncate max-w-[160px]">{m.description}</p>
                      )}
                    </div>
                  </div>
                  <ExternalLink size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] font-medium text-gray-400">
                    {(m.fields as unknown[]).length} campo{(m.fields as unknown[]).length !== 1 ? 's' : ''}
                  </span>
                  {!m.is_paid && (
                    <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                      Gratis
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Pending modules */}
      {pending.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pendientes de activación</p>
          <div className="space-y-2">
            {pending.map(m => (
              <div key={m.id}
                className="bg-white rounded-2xl border border-gray-100 p-4 opacity-60">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Lock size={13} className="text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700">{m.name}</p>
                    <p className="text-xs text-gray-400">Pendiente de activación — módulo pago</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {all.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400 mb-3">No tenés módulos personalizados todavía.</p>
          <Link href="/admin/custom-modules/new"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
            Crear mi primer módulo gratis →
          </Link>
        </div>
      )}
    </div>
  )
}
