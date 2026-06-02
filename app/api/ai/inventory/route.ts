import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { checkAndIncrementAIUsage } from '@/lib/ai-usage'
import { env } from '@/lib/env'
import type { Plan } from '@/types'

const OPENAI_API = 'https://api.openai.com/v1/chat/completions'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const limited = await checkRateLimit(`ai:${user.id}`, 30, '1 h')
    if (limited) return NextResponse.json({ error: 'Demasiadas solicitudes. Esperá un momento.' }, { status: 429 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id, business:businesses(plan)')
      .eq('user_id', user.id)
      .single()

    const biz = profile?.business as unknown as { plan: Plan } | null
    if (!biz) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

    const usage = await checkAndIncrementAIUsage(profile!.business_id, biz.plan)
    if (!usage.allowed) {
      return NextResponse.json({
        error: `Alcanzaste el límite de ${usage.limit} consultas de IA este mes.`,
        plan: biz.plan, used: usage.used, limit: usage.limit, upgradePrompt: true,
      }, { status: 429 })
    }

    const body = await req.json()
    const { businessName, totalItems, lowStockItems, outOfStock, totalValue } = body

    const systemPrompt = `Sos un experto en gestión de inventarios para pequeños comercios latinoamericanos.
Respondés SIEMPRE con un JSON válido: { "insights": ["insight1", "insight2", ...] }
Máximo 5 insights, cada uno es una oración práctica y accionable en español rioplatense.`

    const userMsg = `Comercio: "${businessName}"
Total items en inventario: ${totalItems}
Valor total del inventario: $${(totalValue ?? 0).toFixed(0)}
Items con stock bajo o crítico: ${lowStockItems?.length > 0
  ? lowStockItems.map((i: { name: string; current: number; min: number; unit: string }) =>
      `${i.name} (tiene ${i.current} ${i.unit}, mínimo ${i.min} ${i.unit})`
    ).join(', ')
  : 'ninguno'}
Items sin stock: ${outOfStock?.length > 0 ? outOfStock.join(', ') : 'ninguno'}

Generá insights prácticos: qué reabastecer urgente, qué optimizar, alertas importantes.`

    const res = await fetch(OPENAI_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini', max_tokens: 600, temperature: 0.6,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMsg },
        ],
      }),
    })

    if (!res.ok) throw new Error(`OpenAI error ${res.status}`)
    const data = await res.json()
    const parsed = JSON.parse(data.choices[0].message.content)

    await supabase.from('ai_generations').insert({
      business_id: profile!.business_id, type: 'insights', input: body, output: parsed,
    })

    return NextResponse.json({ ...parsed, _usage: { used: usage.used, limit: usage.limit, unlimited: usage.unlimited } })
  } catch (err) {
    console.error('[api/ai/inventory]', err)
    return NextResponse.json({ error: 'Error al analizar inventario' }, { status: 500 })
  }
}
