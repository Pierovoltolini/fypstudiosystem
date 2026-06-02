// app/api/ai/custom-module/route.ts
// IA sugiere la estructura de un módulo personalizado basándose en la descripción del usuario
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkAndIncrementAIUsage } from '@/lib/ai-usage'
import { env } from '@/lib/env'
import { z } from 'zod'
import type { Plan } from '@/types'

const OPENAI_API = 'https://api.openai.com/v1/chat/completions'

const schema = z.object({
  description: z.string().min(5).max(500),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id, business:businesses(plan, name)')
      .eq('user_id', user.id)
      .single()

    const biz = profile?.business as unknown as { plan: Plan; name: string } | null
    if (!biz) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

    const usage = await checkAndIncrementAIUsage(profile!.business_id, biz.plan)
    if (!usage.allowed) {
      return NextResponse.json({
        error: `Alcanzaste el límite de ${usage.limit} consultas de IA este mes.`,
        upgradePrompt: true,
      }, { status: 429 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Descripción inválida' }, { status: 400 })

    const systemPrompt = `Sos un experto en diseño de sistemas de gestión para pequeños comercios latinoamericanos.
El usuario te describe qué quiere trackear en su negocio y vos sugerís la estructura del módulo.
SIEMPRE respondés con un JSON válido con esta estructura exacta:
{
  "name": "Nombre del módulo (máx 30 chars)",
  "icon": "uno de: LayoutGrid, Package, Users, ShoppingBag, TrendingUp, Wallet, Layers, Tag, Calendar, FileText, Clipboard, BarChart2",
  "description": "Descripción breve (máx 80 chars)",
  "fields": [
    { "key": "campo_snake_case", "label": "Nombre visible", "type": "text|number|date|select|boolean", "required": true|false, "options": ["opción1","opción2"] }
  ]
}
- Máximo 8 campos. Mínimo 2.
- Solo incluir "options" cuando type="select".
- Los keys deben ser snake_case sin espacios.
- El módulo debe ser práctico y específico al rubro del negocio.`

    const userMsg = `Negocio: ${biz.name}
El usuario quiere trackear: ${parsed.data.description}

Sugerí la estructura del módulo.`

    const res = await fetch(OPENAI_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini', max_tokens: 800, temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMsg },
        ],
      }),
    })

    if (!res.ok) throw new Error(`OpenAI error ${res.status}`)
    const data = await res.json()
    const suggestion = JSON.parse(data.choices[0].message.content)

    return NextResponse.json({ suggestion, _usage: { used: usage.used, limit: usage.limit } })
  } catch (err) {
    console.error('[api/ai/custom-module]', err)
    return NextResponse.json({ error: 'Error generando sugerencia' }, { status: 500 })
  }
}
