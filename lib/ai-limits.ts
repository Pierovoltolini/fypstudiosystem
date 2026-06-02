// lib/ai-limits.ts — compartido entre cliente y servidor
// Los valores se derivan de PLAN_LIMITS para mantener consistencia.
import type { Plan } from '@/types'
import { PLAN_LIMITS } from '@/lib/plan-limits'

export const AI_LIMITS: Record<Plan, number> = {
  basic:   PLAN_LIMITS.basic.ai_queries,    // 15
  pro:     PLAN_LIMITS.pro.ai_queries,      // 75
  premium: PLAN_LIMITS.premium.ai_queries,  // Infinity
}

export const PLAN_DISPLAY: Record<Plan, string> = {
  basic:   'Free',
  pro:     'Pro',
  premium: 'Premium',
}
