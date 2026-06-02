'use client'
// Muestra el uso de IA del mes actual con barra de progreso
// Se usa en /admin/ai y en cualquier página que tenga funciones de IA
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVertical } from '@/lib/vertical-context'
import { Sparkles, Zap, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AI_LIMITS } from '@/lib/ai-limits'
import type { Plan } from '@/types'

const PLAN_LABELS: Record<Plan, string> = { basic: 'Free', pro: 'Pro', premium: 'Premium' }
const PLAN_ICONS:  Record<Plan, React.ElementType> = { basic: Sparkles, pro: Zap, premium: Crown }

export default function AIUsageBanner() {
  const { businessId, business } = useVertical()
  const supabase = createClient()
  const plan = business.plan as Plan

  const [used,    setUsed]    = useState<number | null>(null)
  const limit     = AI_LIMITS[plan]
  const unlimited = limit === Infinity
  const month     = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    supabase
      .from('ai_usage')
      .select('count')
      .eq('business_id', businessId)
      .eq('month', month)
      .maybeSingle()
      .then(({ data }) => setUsed(data?.count ?? 0))
  }, [businessId, month])

  if (used === null) return null

  const pct      = unlimited ? 0 : Math.min((used / limit) * 100, 100)
  const nearLimit = !unlimited && used >= limit * 0.8
  const atLimit   = !unlimited && used >= limit

  const Icon = PLAN_ICONS[plan]

  return (
    <div className={cn(
      'rounded-2xl border p-4',
      atLimit   ? 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-900/60'   :
      nearLimit ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/40 dark:border-yellow-900/60' :
                  'bg-gray-50 border-gray-100 dark:bg-gray-800/60 dark:border-gray-700/60'
    )}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className={cn(
            'h-6 w-6 rounded-lg flex items-center justify-center',
            atLimit   ? 'bg-red-100 dark:bg-red-900/50'    :
            nearLimit ? 'bg-yellow-100 dark:bg-yellow-900/50' :
                        'bg-blue-100 dark:bg-blue-900/50'
          )}>
            <Icon size={12} className={atLimit ? 'text-red-500' : nearLimit ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-500'} />
          </div>
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Consultas de IA · Plan {PLAN_LABELS[plan]}
          </span>
        </div>
        <span className={cn(
          'text-xs font-bold',
          atLimit ? 'text-red-600 dark:text-red-400' : nearLimit ? 'text-yellow-700 dark:text-yellow-400' : 'text-gray-600 dark:text-gray-400'
        )}>
          {unlimited ? '∞' : `${used} / ${limit}`}
        </span>
      </div>

      {!unlimited && (
        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              atLimit ? 'bg-red-500' : nearLimit ? 'bg-yellow-500' : 'bg-blue-500'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {atLimit && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">
          Límite mensual alcanzado. Actualizá tu plan para seguir usando la IA.
        </p>
      )}
      {nearLimit && !atLimit && (
        <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-2">
          Estás cerca del límite mensual ({limit - used} consultas restantes).
        </p>
      )}
      {unlimited && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Consultas ilimitadas con tu plan Premium.</p>
      )}
    </div>
  )
}
