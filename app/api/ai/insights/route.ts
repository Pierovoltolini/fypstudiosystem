import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateInsightsAI } from '@/lib/ai'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { checkAndIncrementAIUsage } from '@/lib/ai-usage'
import type { Plan } from '@/types'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const limited = await checkRateLimit(`ai:${user.id}`, 30, '1 h')
    if (limited) return NextResponse.json({ error: 'Demasiadas solicitudes. Esperá un momento.' }, { status: 429 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id, business:businesses(name, plan)')
      .eq('user_id', user.id)
      .single()

    const biz = profile?.business as unknown as { name: string; plan: Plan } | null
    if (!biz) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

    const businessId = profile!.business_id

    const usage = await checkAndIncrementAIUsage(businessId, biz.plan)
    if (!usage.allowed) {
      return NextResponse.json({
        error: `Alcanzaste el límite de ${usage.limit} consultas de IA este mes.`,
        plan: biz.plan, used: usage.used, limit: usage.limit, upgradePrompt: true,
      }, { status: 429 })
    }

    const service = createServiceClient()
    const [ordersRes, productsRes, customersRes] = await Promise.all([
      service.from('orders').select('status, confirmed_sale, total').eq('business_id', businessId),
      service.from('products').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('active', true),
      service.from('customers').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
    ])

    const orders         = ordersRes.data ?? []
    const confirmedOrders = orders.filter(o => o.confirmed_sale).length
    const cancelledOrders = orders.filter(o => o.status === 'cancelled').length
    const totalRevenue    = orders.filter(o => o.confirmed_sale).reduce((acc, o) => acc + (o.total ?? 0), 0)
    const cancelRate      = orders.length > 0 ? Math.round((cancelledOrders / orders.length) * 100) : 0

    const { data: topItems } = await service
      .from('order_items').select('product_name, quantity').limit(100)

    const productCounts: Record<string, number> = {}
    ;(topItems ?? []).forEach(item => {
      productCounts[item.product_name] = (productCounts[item.product_name] ?? 0) + item.quantity
    })
    const topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, count]) => ({ name, count, revenue: 0 }))

    const stats = {
      pendingOrders:   orders.filter(o => o.status === 'pending').length,
      confirmedOrders, totalRevenue,
      totalCustomers:  customersRes.count ?? 0,
      totalProducts:   productsRes.count ?? 0,
      topProducts, cancelRate, todayRevenue: 0, recentOrders: [],
    }

    const insights = await generateInsightsAI(biz.name, stats)

    await supabase.from('ai_generations').insert({
      business_id: businessId, type: 'insights',
      input: { stats }, output: { insights },
    })

    return NextResponse.json({
      insights,
      _usage: { used: usage.used, limit: usage.limit, unlimited: usage.unlimited },
    })
  } catch (err) {
    console.error('[api/ai/insights]', err)
    return NextResponse.json({ error: 'Error generando insights' }, { status: 500 })
  }
}
