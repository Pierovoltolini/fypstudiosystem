import { createClient } from '@/lib/supabase/server'
import { generateProductAI } from '@/lib/ai'
import { NextResponse } from 'next/server'
import { aiProductSchema } from '@/lib/schemas'
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

    const usage = await checkAndIncrementAIUsage(profile!.business_id, biz.plan)
    if (!usage.allowed) {
      return NextResponse.json({
        error: `Alcanzaste el límite de ${usage.limit} consultas de IA este mes.`,
        plan: biz.plan, used: usage.used, limit: usage.limit, upgradePrompt: true,
      }, { status: 429 })
    }

    const body = await req.json()
    const parsed = aiProductSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Texto requerido' }, { status: 400 })

    const result = await generateProductAI(parsed.data.rawText, biz.name, parsed.data.businessType)

    await supabase.from('ai_generations').insert({
      business_id: profile!.business_id, type: 'product',
      input: { rawText: parsed.data.rawText, businessType: parsed.data.businessType },
      output: result,
    })

    return NextResponse.json({ ...result, _usage: { used: usage.used, limit: usage.limit, unlimited: usage.unlimited } })
  } catch (err) {
    console.error('[api/ai/product]', err)
    return NextResponse.json({ error: 'Error generando con IA' }, { status: 500 })
  }
}
