// app/api/tour/complete — Marca el tour de bienvenida como completado o saltado
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  action: z.enum(['complete', 'skip']),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body   = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })

    const now = new Date().toISOString()
    const patch = parsed.data.action === 'complete'
      ? { completed_at: now }
      : { skipped_at: now }

    await supabase.from('user_onboarding').upsert(
      { user_id: user.id, ...patch },
      { onConflict: 'user_id' }
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/tour/complete]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
