// app/api/plan/usage — Devuelve el uso actual de recursos para el negocio autenticado
// Usado por páginas de productos, clientes y módulos para mostrar límites en tiempo real.
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { PLAN_LIMITS } from '@/lib/plan-limits'
import type { Plan } from '@/types'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id, business:businesses(plan)')
      .eq('user_id', user.id)
      .single()

    if (!profile?.business_id)
      return NextResponse.json({ error: 'Sin negocio' }, { status: 403 })

    const businessId = profile.business_id
    const plan = ((profile.business as { plan?: string } | null)?.plan ?? 'basic') as Plan
    const limits = PLAN_LIMITS[plan]
    const service = createServiceClient()
    const month = new Date()
    month.setDate(1); month.setHours(0, 0, 0, 0)

    const [ordersRes, productsRes, customersRes, staffRes, modulesRes] = await Promise.all([
      service.from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .gte('created_at', month.toISOString()),
      service.from('products')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('active', true),
      service.from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId),
      service.from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId),
      service.from('custom_modules')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('active', true),
    ])

    return NextResponse.json({
      plan,
      usage: {
        orders_per_month: { current: ordersRes.count ?? 0,    limit: limits.orders_per_month },
        products:         { current: productsRes.count ?? 0,  limit: limits.products },
        customers:        { current: customersRes.count ?? 0, limit: limits.customers },
        staff:            { current: staffRes.count ?? 0,     limit: limits.staff },
        custom_modules:   { current: modulesRes.count ?? 0,   limit: limits.custom_modules },
        ai_queries:       { current: 0,                       limit: limits.ai_queries }, // AI usa su propio tracker
      },
    })
  } catch (err) {
    console.error('[api/plan/usage]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
