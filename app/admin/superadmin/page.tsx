// app/admin/superadmin/page.tsx
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SuperadminClient from './SuperadminClient'
import type { Business } from '@/types'
import { PLAN_PRICES } from '@/lib/plan-limits'

export const metadata = { title: 'Superadmin — FYP Studio' }
export const dynamic = 'force-dynamic'

export default async function SuperadminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (profile?.role !== 'superadmin') redirect('/admin')

  const service = createServiceClient()
  const now     = new Date()
  const ago30   = new Date(now.getTime() - 30 * 86_400_000).toISOString()
  const ago7    = new Date(now.getTime() -  7 * 86_400_000).toISOString()
  const ago14   = new Date(now.getTime() - 14 * 86_400_000).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [bizRes, ordersRes, subsRes, eventsRes, aiRes] = await Promise.all([
    service
      .from('businesses')
      .select('id,name,slug,plan,active,subscription_status,vertical_type,created_at,primary_color')
      .order('created_at', { ascending: false }),

    service
      .from('orders')
      .select('business_id,total,created_at')
      .gte('created_at', ago30),

    service
      .from('subscriptions')
      .select('business_id,plan,status,billing_cycle,current_period_end,internal_note,updated_at'),

    // Historial de cambios de plan (para churn + gestión)
    service
      .from('billing_events')
      .select('business_id,event_type,payload,created_at')
      .order('created_at', { ascending: false })
      .limit(500),

    // Top usuarios de IA del mes actual
    service
      .from('ai_usage')
      .select('business_id,count')
      .gte('month', monthStart.slice(0, 7))
      .order('count', { ascending: false })
      .limit(20),
  ])

  const businesses = (bizRes.data ?? []) as Pick<Business,
    'id' | 'name' | 'slug' | 'plan' | 'active' | 'subscription_status' | 'vertical_type' | 'created_at' | 'primary_color'>[]

  // ── Pedidos por negocio (30d) ──────────────────────────────
  const ordersByBiz = new Map<string, { count: number; revenue: number }>()
  for (const o of ordersRes.data ?? []) {
    const cur = ordersByBiz.get(o.business_id) ?? { count: 0, revenue: 0 }
    cur.count++
    cur.revenue += o.total ?? 0
    ordersByBiz.set(o.business_id, cur)
  }

  // ── Suscripciones indexadas ────────────────────────────────
  const subsByBiz = Object.fromEntries(
    (subsRes.data ?? []).map(s => [s.business_id, s])
  )

  // ── Historial por negocio ──────────────────────────────────
  const allEvents = eventsRes.data ?? []
  const historyByBiz: Record<string, { event_type: string; payload: Record<string, unknown> | null; created_at: string }[]> = {}
  for (const ev of allEvents) {
    if (ev.event_type !== 'manual_plan_change') continue
    if (!historyByBiz[ev.business_id]) historyByBiz[ev.business_id] = []
    historyByBiz[ev.business_id].push(ev as typeof historyByBiz[string][number])
  }

  // ── Stats básicas ──────────────────────────────────────────
  const totalOrders30d  = (ordersRes.data ?? []).length
  const totalRevenue30d = (ordersRes.data ?? []).reduce((a, o) => a + (o.total ?? 0), 0)
  const planCounts = { basic: 0, pro: 0, premium: 0 }
  for (const b of businesses) planCounts[b.plan as keyof typeof planCounts]++

  // ── Analytics avanzados ────────────────────────────────────

  // MRR en USD
  const mrr = planCounts.pro * PLAN_PRICES.pro.monthly + planCounts.premium * PLAN_PRICES.premium.monthly

  // Negocios activos en 30d (con al menos 1 pedido)
  const activeBiz30d = ordersByBiz.size

  // Negocios nuevos: esta semana vs semana anterior
  const newThisWeek = businesses.filter(b => b.created_at >= ago7).length
  const newLastWeek = businesses.filter(b => b.created_at >= ago14 && b.created_at < ago7).length

  // Churn: negocios que bajaron de plan pago → basic en 30d
  const churn30d = allEvents.filter(ev => {
    if (ev.created_at < ago30) return false
    if (ev.event_type !== 'manual_plan_change' &&
        !ev.event_type.includes('cancel')) return false
    const p = (ev.payload ?? {}) as Record<string, unknown>
    const prev = p.previous_plan as string | undefined
    const next = (p.new_plan ?? ev.event_type.includes('cancel') ? 'basic' : undefined) as string | undefined
    return (prev === 'pro' || prev === 'premium') && (next === 'basic' || ev.event_type.includes('cancel'))
  }).length

  // Top 5 negocios por uso de IA
  const bizById = new Map(businesses.map(b => [b.id, b]))
  const top5AI = (aiRes.data ?? [])
    .slice(0, 5)
    .map(row => ({
      name:  bizById.get(row.business_id)?.name ?? 'Desconocido',
      count: row.count as number,
    }))

  const analytics = { mrr, activeBiz30d, newThisWeek, newLastWeek, churn30d, top5AI }

  return (
    <SuperadminClient
      businesses={businesses}
      ordersByBiz={Object.fromEntries(ordersByBiz)}
      subsByBiz={subsByBiz}
      historyByBiz={historyByBiz}
      stats={{ totalBusinesses: businesses.length, totalOrders30d, totalRevenue30d, planCounts }}
      analytics={analytics}
    />
  )
}
