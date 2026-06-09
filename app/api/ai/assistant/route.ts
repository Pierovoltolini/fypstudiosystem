// app/api/ai/assistant/route.ts
// Asistente IA con RAG: recopila contexto real del negocio antes de cada query
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { checkAndIncrementAIUsage } from '@/lib/ai-usage'
import { env } from '@/lib/env'
import { z } from 'zod'
import type { Plan } from '@/types'

const OPENAI_API = 'https://api.openai.com/v1/chat/completions'

const messageSchema = z.object({
  role:    z.enum(['user', 'assistant']),
  content: z.string().max(2000),
})

const requestSchema = z.object({
  message:  z.string().min(1).max(1000),
  history:  z.array(messageSchema).max(10).optional().default([]),
})

// ── RAG: recopila contexto del negocio ───────────────────────
async function buildContext(
  businessId:    string,
  businessName:  string,
  currency:      string,
  verticalType?: string | null,
  verticalSub?:  string | null,
) {
  const service = createServiceClient()
  const today   = new Date()
  const todayStr  = today.toISOString().split('T')[0]
  const weekAgo   = new Date(today.getTime() -  7 * 864e5).toISOString().split('T')[0]
  const monthAgo  = new Date(today.getTime() - 30 * 864e5).toISOString().split('T')[0]
  const in7Days   = new Date(today.getTime() +  7 * 864e5).toISOString().split('T')[0]

  const isServices   = verticalType === 'servicios'
    || ['barbershop', 'beauty', 'services'].includes(verticalSub ?? '')
  const isRealEstate = verticalSub === 'real_estate'

  // ── Queries base (todas las verticales) ──────────────────
  const [
    todayOrdersRes, weekOrdersRes, monthOrdersRes,
    topItemsRes, inventoryRes, costsRes, cajaRes, customersRes,
  ] = await Promise.all([
    service.from('orders')
      .select('total, confirmed_sale, status')
      .eq('business_id', businessId)
      .gte('created_at', todayStr + 'T00:00:00'),

    service.from('orders')
      .select('total, confirmed_sale')
      .eq('business_id', businessId)
      .gte('created_at', weekAgo + 'T00:00:00')
      .eq('confirmed_sale', true),

    service.from('orders')
      .select('total, confirmed_sale')
      .eq('business_id', businessId)
      .gte('created_at', monthAgo + 'T00:00:00')
      .eq('confirmed_sale', true),

    service.from('order_items')
      .select('product_name, quantity, unit_price')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(200),

    // FIXED: fetch all active items y filtrar client-side (la query anterior
    // intentaba pasar una subquery como valor — no soportado por el JS client)
    service.from('inventory_items')
      .select('name, stock_current, stock_min, unit')
      .eq('business_id', businessId)
      .eq('active', true)
      .limit(100),

    service.from('business_costs')
      .select('name, amount, type')
      .eq('business_id', businessId)
      .gte('date', monthAgo),

    service.from('cash_registers')
      .select('status, opening_amount')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    service.from('customers')
      .select('id, created_at')
      .eq('business_id', businessId),
  ])

  // ── Queries por vertical (en paralelo con las base) ──────
  const nullPromise = Promise.resolve({ data: null })

  const [v0, v1, v2, v3] = await Promise.all(
    isServices ? [
      // Turnos de hoy
      service.from('bookings')
        .select('id, status, price, start_time, customer_name')
        .eq('business_id', businessId)
        .eq('date', todayStr)
        .order('start_time'),
      // Próximos 7 días
      service.from('bookings')
        .select('id, date, start_time, status')
        .eq('business_id', businessId)
        .gt('date', todayStr)
        .lte('date', in7Days)
        .neq('status', 'cancelled')
        .order('date')
        .limit(50),
      // Staff activo
      service.from('staff')
        .select('name, role')
        .eq('business_id', businessId)
        .eq('active', true),
      // Revenue del mes de bookings completados
      service.from('bookings')
        .select('price')
        .eq('business_id', businessId)
        .eq('status', 'done')
        .gte('date', monthAgo),
    ] : isRealEstate ? [
      // Leads recientes
      service.from('leads')
        .select('name, status, created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(10),
      // Visitas próximas
      service.from('bookings')
        .select('id, customer_name, date, start_time')
        .eq('business_id', businessId)
        .gte('date', todayStr)
        .lte('date', in7Days)
        .neq('status', 'cancelled')
        .order('date')
        .limit(20),
      // Propiedades activas (count)
      service.from('products')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('active', true),
      // Todos los leads (para breakdown por status)
      service.from('leads')
        .select('status')
        .eq('business_id', businessId),
    ] : [nullPromise, nullPromise, nullPromise, nullPromise]
  )

  // ── Calcular stats base ───────────────────────────────────
  const todayOrders     = todayOrdersRes.data ?? []
  const todayRevenue    = todayOrders.filter(o => o.confirmed_sale).reduce((s, o) => s + o.total, 0)
  const todayPending    = todayOrders.filter(o => ['pending','confirmed','preparing'].includes(o.status)).length
  const weekRevenue     = (weekOrdersRes.data ?? []).reduce((s, o) => s + o.total, 0)
  const monthRevenue    = (monthOrdersRes.data ?? []).reduce((s, o) => s + o.total, 0)
  const monthOrderCount = (monthOrdersRes.data ?? []).length

  // Top 5 productos del mes
  const prodCounts: Record<string, { qty: number; revenue: number }> = {}
  ;(topItemsRes.data ?? []).forEach(i => {
    if (!prodCounts[i.product_name]) prodCounts[i.product_name] = { qty: 0, revenue: 0 }
    prodCounts[i.product_name].qty     += i.quantity
    prodCounts[i.product_name].revenue += i.quantity * i.unit_price
  })
  const topProducts = Object.entries(prodCounts)
    .sort((a, b) => b[1].qty - a[1].qty).slice(0, 5)

  // Costos del mes
  const totalCosts    = (costsRes.data ?? []).reduce((s, c) => s + c.amount, 0)
  const costBreakdown = (costsRes.data ?? []).slice(0, 5)
    .map(c => `${c.name}: $${c.amount.toFixed(0)}`).join(', ')

  // Stock bajo — FIXED: filtrar client-side
  const allInventory  = inventoryRes.data ?? []
  const lowStockItems = allInventory.filter((i: { stock_current: number; stock_min: number }) => i.stock_current <= i.stock_min)
  const lowStockNote  = lowStockItems.length === 0
    ? 'Sin alertas de stock'
    : `${lowStockItems.length} items con stock bajo: ${
        lowStockItems.slice(0, 3).map((i: { name: string; stock_current: number; stock_min: number; unit: string }) =>
          `${i.name} (${i.stock_current}/${i.stock_min} ${i.unit})`).join(', ')
      }`

  const cajaStatus = cajaRes.data?.status === 'open'
    ? `abierta (fondo: $${cajaRes.data.opening_amount?.toFixed(0) ?? '?'})`
    : 'cerrada'

  // Clientes
  const allCustomers       = customersRes.data ?? []
  const totalCustomers     = allCustomers.length
  const newCustomersMonth  = allCustomers.filter((c: { created_at: string }) => c.created_at >= monthAgo + 'T00:00:00').length

  // ── Armar contexto base ───────────────────────────────────
  let context = `CONTEXTO DEL NEGOCIO "${businessName}" (${currency}):
- Hoy: $${todayRevenue.toFixed(0)} en ventas · ${todayOrders.length} pedidos · ${todayPending} activos
- Esta semana: $${weekRevenue.toFixed(0)} en ventas confirmadas
- Este mes: $${monthRevenue.toFixed(0)} en ventas · ${monthOrderCount} pedidos confirmados
- Top productos del mes: ${topProducts.length > 0 ? topProducts.map(([n, v]) => `${n} (${v.qty}× · $${v.revenue.toFixed(0)})`).join(', ') : 'sin datos'}
- Costos del mes: $${totalCosts.toFixed(0)} total · ${costBreakdown || 'sin registros'}
- Inventario: ${lowStockNote}
- Caja: ${cajaStatus}
- Clientes: ${totalCustomers} totales · ${newCustomersMonth} nuevos este mes`

  // ── Contexto vertical: servicios ─────────────────────────
  if (isServices && v0.data !== undefined) {
    const todayBookings    = (v0 as any).data ?? []
    const upcomingBookings = (v1 as any).data ?? []
    const staffList        = (v2 as any).data ?? []
    const monthBookingRev  = ((v3 as any).data ?? []).reduce((s: number, b: { price?: number | null }) => s + (b.price ?? 0), 0)
    const todayActive      = todayBookings.filter((b: { status: string }) => !['cancelled','noshow'].includes(b.status)).length
    const todayDone        = todayBookings.filter((b: { status: string }) => b.status === 'done').length

    context += `\n\n--- AGENDA Y SERVICIOS ---
- Hoy: ${todayActive} turnos activos · ${todayDone} completados
- Próximos 7 días: ${upcomingBookings.length} turnos agendados
- Ingresos del mes (turnos completados): $${monthBookingRev.toFixed(0)}
- Staff activo: ${staffList.length > 0 ? staffList.map((s: { name: string }) => s.name).join(', ') : 'sin registros'}`
  }

  // ── Contexto vertical: real estate ───────────────────────
  if (isRealEstate && v0.data !== undefined) {
    const recentLeads     = (v0 as any).data ?? []
    const upcomingVisits  = (v1 as any).data ?? []
    const activeProps     = (v2 as any).count ?? 0
    const allLeads        = (v3 as any).data ?? []

    const leadsByStatus: Record<string, number> = {}
    allLeads.forEach((l: { status: string }) => {
      leadsByStatus[l.status] = (leadsByStatus[l.status] ?? 0) + 1
    })
    const statusSummary = Object.entries(leadsByStatus)
      .map(([s, c]) => `${s}: ${c}`).join(', ') || 'sin datos'

    context += `\n\n--- INMOBILIARIA ---
- Propiedades activas: ${activeProps}
- Consultas totales: ${allLeads.length} · por estado: ${statusSummary}
- Consultas recientes: ${recentLeads.slice(0, 5).map((l: { name: string; status: string }) => `${l.name} (${l.status})`).join(', ') || 'sin datos'}
- Visitas próximas 7 días: ${upcomingVisits.length}`
  }

  return context
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const limited = await checkRateLimit(`ai-assistant:${user.id}`, 20, '10 m')
    if (limited) return NextResponse.json({ error: 'Demasiadas solicitudes. Esperá un momento.' }, { status: 429 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id, business:businesses(name, plan, currency, vertical_type, vertical_sub)')
      .eq('user_id', user.id)
      .single()

    const biz = profile?.business as unknown as {
      name: string; plan: Plan; currency: string
      vertical_type?: string | null; vertical_sub?: string | null
    } | null
    if (!biz) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

    const usage = await checkAndIncrementAIUsage(profile!.business_id, biz.plan)
    if (!usage.allowed) {
      return NextResponse.json({
        error: `Alcanzaste el límite de ${usage.limit} consultas de IA este mes.`,
        plan: biz.plan, used: usage.used, limit: usage.limit, upgradePrompt: true,
      }, { status: 429 })
    }

    const body   = await req.json()
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Mensaje inválido' }, { status: 400 })

    const { message, history } = parsed.data

    const context = await buildContext(
      profile!.business_id,
      biz.name,
      biz.currency ?? 'UYU',
      biz.vertical_type,
      biz.vertical_sub,
    )

    const systemPrompt = `Sos el asistente de IA de FYP.STUDIO, un sistema de gestión para comercios.
Ayudás al dueño del comercio a entender su negocio usando sus datos reales.
Respondés SIEMPRE en español rioplatense, de forma clara y directa.
Sos conciso: máximo 3-4 oraciones por respuesta salvo que te pidan un análisis detallado.
No inventés datos que no estén en el contexto.

${context}`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ]

    const res = await fetch(OPENAI_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini', max_tokens: 500, temperature: 0.5,
        messages,
      }),
    })

    if (!res.ok) throw new Error(`OpenAI error ${res.status}`)
    const data = await res.json()
    const reply = data.choices[0]?.message?.content ?? 'No pude generar una respuesta.'

    return NextResponse.json({
      reply,
      _usage: { used: usage.used, limit: usage.limit, unlimited: usage.unlimited },
    })
  } catch (err) {
    console.error('[api/ai/assistant]', err)
    return NextResponse.json({ error: 'Error en el asistente' }, { status: 500 })
  }
}
