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
async function buildContext(businessId: string, businessName: string, currency: string) {
  const service = createServiceClient()
  const today   = new Date()
  const todayStr    = today.toISOString().split('T')[0]
  const weekAgo     = new Date(today.getTime() - 7 * 864e5).toISOString().split('T')[0]
  const monthAgo    = new Date(today.getTime() - 30 * 864e5).toISOString().split('T')[0]

  const [
    todayOrdersRes, weekOrdersRes, monthOrdersRes,
    topItemsRes, lowStockRes, costsRes, cajaRes,
  ] = await Promise.all([
    // Ventas de hoy
    service.from('orders')
      .select('total, confirmed_sale, status')
      .eq('business_id', businessId)
      .gte('created_at', todayStr + 'T00:00:00'),

    // Ventas de la semana
    service.from('orders')
      .select('total, confirmed_sale')
      .eq('business_id', businessId)
      .gte('created_at', weekAgo + 'T00:00:00')
      .eq('confirmed_sale', true),

    // Ventas del mes
    service.from('orders')
      .select('total, confirmed_sale')
      .eq('business_id', businessId)
      .gte('created_at', monthAgo + 'T00:00:00')
      .eq('confirmed_sale', true),

    // Top productos del mes (via order_items)
    service.from('order_items')
      .select('product_name, quantity, unit_price')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(200),

    // Alertas de stock bajo
    service.from('inventory_items')
      .select('name, stock_current, stock_min, unit')
      .eq('business_id', businessId)
      .eq('active', true)
      .lte('stock_current', service.from('inventory_items').select('stock_min') as unknown as number),

    // Costos del mes
    service.from('business_costs')
      .select('name, amount, type')
      .eq('business_id', businessId)
      .gte('date', monthAgo),

    // Caja actual
    service.from('cash_registers')
      .select('status, opening_amount, closing_amount')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // Calcular stats
  const todayOrders   = todayOrdersRes.data ?? []
  const todayRevenue  = todayOrders.filter(o => o.confirmed_sale).reduce((s, o) => s + o.total, 0)
  const todayPending  = todayOrders.filter(o => ['pending','confirmed','preparing'].includes(o.status)).length
  const weekRevenue   = (weekOrdersRes.data ?? []).reduce((s, o) => s + o.total, 0)
  const monthRevenue  = (monthOrdersRes.data ?? []).reduce((s, o) => s + o.total, 0)
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
  const totalCosts = (costsRes.data ?? []).reduce((s, c) => s + c.amount, 0)
  const costBreakdown = (costsRes.data ?? []).slice(0, 5)
    .map(c => `${c.name}: $${c.amount.toFixed(0)}`).join(', ')

  // Stock bajo (simplificado — la query anterior tiene un bug, usamos fallback)
  const lowStockNote = lowStockRes.error
    ? 'no disponible'
    : (lowStockRes.data ?? []).length + ' items con stock bajo o crítico'

  const cajaStatus = cajaRes.data?.status === 'open'
    ? `abierta (fondo: $${cajaRes.data.opening_amount?.toFixed(0) ?? '?'})`
    : 'cerrada'

  return `CONTEXTO DEL NEGOCIO "${businessName}" (${currency}):
- Hoy: $${todayRevenue.toFixed(0)} en ventas · ${todayOrders.length} pedidos · ${todayPending} activos
- Esta semana: $${weekRevenue.toFixed(0)} en ventas confirmadas
- Este mes: $${monthRevenue.toFixed(0)} en ventas · ${monthOrderCount} pedidos confirmados
- Top productos del mes: ${topProducts.length > 0 ? topProducts.map(([n, v]) => `${n} (${v.qty}× · $${v.revenue.toFixed(0)})`).join(', ') : 'sin datos'}
- Costos del mes: $${totalCosts.toFixed(0)} total · ${costBreakdown || 'sin registros'}
- Inventario: ${lowStockNote}
- Caja: ${cajaStatus}`
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
      .select('business_id, business:businesses(name, plan, currency)')
      .eq('user_id', user.id)
      .single()

    const biz = profile?.business as unknown as { name: string; plan: Plan; currency: string } | null
    if (!biz) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

    const usage = await checkAndIncrementAIUsage(profile!.business_id, biz.plan)
    if (!usage.allowed) {
      return NextResponse.json({
        error: `Alcanzaste el límite de ${usage.limit} consultas de IA este mes.`,
        plan: biz.plan, used: usage.used, limit: usage.limit, upgradePrompt: true,
      }, { status: 429 })
    }

    const body = await req.json()
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Mensaje inválido' }, { status: 400 })

    const { message, history } = parsed.data

    // Build RAG context
    const context = await buildContext(profile!.business_id, biz.name, biz.currency ?? 'UYU')

    const systemPrompt = `Sos el asistente de IA de FYP.STUDIO, un sistema de gestión para comercios.
Ayudás al dueño del comercio a entender su negocio usando sus datos reales.
Respondés SIEMPRE en español rioplatense, de forma clara y directa.
Sos conciso: máximo 3-4 oraciones por respuesta salvo que te pidan un análisis detallado.
No inventés datos que no estén en el contexto.

${context}`

    // Build messages array (system + history + new message)
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
