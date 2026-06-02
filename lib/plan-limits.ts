// lib/plan-limits.ts — Source of truth de todos los límites por plan
// Importar desde aquí en lugar de hardcodear valores en cada ruta/componente.
import type { Plan } from '@/types'

export interface PlanLimits {
  orders_per_month: number  // pedidos por mes (Infinity = sin límite)
  products:         number  // productos activos totales
  customers:        number  // clientes totales
  staff:            number  // perfiles activos (incluye el owner)
  custom_modules:   number  // módulos personalizados activos
  ai_queries:       number  // consultas IA por mes
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  basic: {
    orders_per_month: 50,
    products:         20,
    customers:        50,
    staff:            1,
    custom_modules:   1,
    ai_queries:       15,
  },
  pro: {
    orders_per_month: Infinity,
    products:         Infinity,
    customers:        Infinity,
    staff:            3,
    custom_modules:   1,
    ai_queries:       75,
  },
  premium: {
    orders_per_month: Infinity,
    products:         Infinity,
    customers:        Infinity,
    staff:            Infinity,
    custom_modules:   Infinity,
    ai_queries:       Infinity,
  },
}

// Precios base en USD
export const PLAN_PRICES: Record<'pro' | 'premium', { monthly: number; annual: number }> = {
  pro:     { monthly: 9,  annual: 86.40  },  // 9 × 12 × 0.8
  premium: { monthly: 19, annual: 182.40 },  // 19 × 12 × 0.8
}

export const ANNUAL_DISCOUNT = 0.20

/** Retorna true si el recurso tiene límite en este plan */
export function hasLimit(plan: Plan, resource: keyof PlanLimits): boolean {
  return PLAN_LIMITS[plan][resource] !== Infinity
}

/** Retorna true si el uso actual alcanzó o superó el límite */
export function isAtLimit(plan: Plan, resource: keyof PlanLimits, current: number): boolean {
  const limit = PLAN_LIMITS[plan][resource]
  return limit !== Infinity && current >= limit
}
