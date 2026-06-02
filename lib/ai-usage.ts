// lib/ai-usage.ts — server-only
// Verifica y registra el uso de IA por negocio/mes según el plan.
import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import { AI_LIMITS } from '@/lib/ai-limits'
import type { Plan } from '@/types'

export { AI_LIMITS } from '@/lib/ai-limits'

export interface AIUsageResult {
  allowed:   boolean
  used:      number
  limit:     number
  unlimited: boolean
}

/**
 * Verifica si el negocio puede hacer una consulta de IA este mes.
 * Si puede, incrementa el contador y retorna { allowed: true }.
 * Si no, retorna { allowed: false } sin incrementar.
 */
export async function checkAndIncrementAIUsage(
  businessId: string,
  plan: Plan
): Promise<AIUsageResult> {
  const limit     = AI_LIMITS[plan]
  const unlimited = limit === Infinity
  const month     = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  const supabase  = createServiceClient()

  // Get current count
  const { data: existing } = await supabase
    .from('ai_usage')
    .select('count')
    .eq('business_id', businessId)
    .eq('month', month)
    .maybeSingle()

  const used = existing?.count ?? 0

  if (!unlimited && used >= limit) {
    return { allowed: false, used, limit, unlimited }
  }

  // Increment (upsert)
  await supabase
    .from('ai_usage')
    .upsert(
      {
        business_id: businessId,
        month,
        count:       used + 1,
        updated_at:  new Date().toISOString(),
      },
      { onConflict: 'business_id,month' }
    )

  return { allowed: true, used: used + 1, limit, unlimited }
}

/**
 * Solo consulta el uso actual sin modificar el contador.
 */
export async function getAIUsage(businessId: string, plan: Plan): Promise<AIUsageResult> {
  const limit    = AI_LIMITS[plan]
  const unlimited = limit === Infinity
  const month    = new Date().toISOString().slice(0, 7)
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('ai_usage')
    .select('count')
    .eq('business_id', businessId)
    .eq('month', month)
    .maybeSingle()

  const used = data?.count ?? 0
  return { allowed: unlimited || used < limit, used, limit, unlimited }
}
